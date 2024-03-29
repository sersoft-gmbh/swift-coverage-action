import * as core from '@actions/core';
import { getExecOutput } from '@actions/exec';
import * as io from '@actions/io';
import { existsSync as exists, PathLike, promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

async function runCmd(cmd: string, ...args: string[]): Promise<string> {
    const output = await getExecOutput(cmd, args.length <= 0 ? undefined : args, { silent: !core.isDebug() });
    if (output.stderr.length > 0)
        core.warning(`Command execution wrote lines to stderr:\n${output.stderr}`);
    return output.stdout;
}

enum CovFormat {
    txt = 'txt',
    lcov = 'lcov',
}

declare type WalkEntry = {
  path: string;
  isDirectory: boolean;

  skipDescendants(): void;
};

// Taken and adjusted from https://stackoverflow.com/a/65415138/1388842
async function* walk(dir: string, onlyFiles: boolean = true): AsyncGenerator<WalkEntry> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const res = path.resolve(dir, entry.name);
        if (entry.isDirectory()) {
            let skipDesc = false;
            if (!onlyFiles)
                yield { path: res, isDirectory: true, skipDescendants: () => skipDesc = true };
            if (!skipDesc)
                yield* walk(res, onlyFiles);
        } else {
            yield { path: res, isDirectory: false, skipDescendants: () => {} };
        }
    }
}

async function directoryExists(path: PathLike): Promise<boolean> {
    if (!exists(path)) return false;
    const stat = await fs.stat(path);
    return stat.isDirectory();
}

async function fileExists(path: PathLike): Promise<boolean> {
    if (!exists(path)) return false;
    const stat = await fs.stat(path);
    return stat.isFile();
}

async function main() {
    switch (process.platform) {
        case 'darwin': break;
        case 'linux': break;
        default: throw new Error('This action only supports macOS and Linux!');
    }

    core.startGroup('Validating input');
    const searchPaths = core.getMultilineInput('search-paths', { required: true })
            .map(p => path.resolve(p.replace(/(~|\$HOME|\${HOME})/g, os.homedir)));
    const outputFolder = path.resolve(core.getInput('output', { required: true })
        .replace(/(~|\$HOME|\${HOME})/g, os.homedir));
    const _format = core.getInput('format', { required: true })
    const format = CovFormat[_format as keyof typeof CovFormat];
    if (!format) throw new Error(`Invalid format: ${_format}`);
    const _targetNameFilter = core.getInput('target-name-filter');
    const targetNameFilter = _targetNameFilter ? new RegExp(_targetNameFilter) : null;
    const ignoreConversionFailures = core.getBooleanInput('ignore-conversion-failures');
    const failOnEmptyOutput = core.getBooleanInput('fail-on-empty-output');
    core.endGroup();

    await core.group('Setting up paths', async () => {
        await io.rmRF(outputFolder);
        await io.mkdirP(outputFolder);
    });

    const profDataFiles = await core.group('Finding coverage files', async () => {
        let profDataFiles: string[] = [];
        for (const searchPath of searchPaths) {
            if (!await directoryExists(searchPath)) {
                core.info(`Skipping non-existent search path ${searchPath}...`);
                continue;
            }
            for await (const entry of walk(searchPath, true)) {
                if (/.*\.profdata$/.test(entry.path)) {
                    profDataFiles.push(entry.path);
                    core.debug(`Found profdata file: ${entry.path}`);
                }
            }
        }
        core.info(`Found ${profDataFiles.length} profiling data file(s):\n${profDataFiles.join('\n')}`);
        return profDataFiles;
    });

    let convertedFiles: string[] = [];
    if (profDataFiles.length > 0) {
        convertedFiles = await core.group('Converting files', async () => {
            let outFiles: string[] = [];
            let conversionFailures: Error[] = [];
            let processedTargets = new Set<string>();
            for (const profDataFile of profDataFiles) {
                const profDataDir = path.dirname(profDataFile);
                const xcodeRegex = /(Build).*/;
                let buildDir: string;
                let isXcode: boolean;
                if (xcodeRegex.test(profDataDir)) {
                    buildDir = profDataDir.replace(xcodeRegex, '$1');
                    isXcode = true;
                } else { // SPM
                    buildDir = path.dirname(profDataDir);
                    isXcode = false;
                }
                core.debug(`Checking contents of build dir ${buildDir} of prof data file ${profDataFile}`);
                for await (const entry of walk(buildDir, false)) {
                    const typesRegex = /.*\.(app|framework|xctest)$/;
                    if (!typesRegex.test(entry.path)) continue;
                    entry.skipDescendants(); // Don't process any further files inside this container.
                    if (isXcode && !/\/Build[^/]*\/Products\//.test(entry.path)) {
                        core.info(`Skipping ${entry.path} because it is not in a Xcode build products directory...`);
                        continue;
                    }
                    const type = entry.path.replace(typesRegex, '$1');
                    core.debug(`Found match of type ${type}: ${entry.path}`);
                    const proj = entry.path
                        .replace(/.*\//, '')
                        .replace(`.${type}`, '');
                    core.debug(`Project name: ${proj}`);
                    if (processedTargets.has(`${proj}.${type}`)) {
                        core.info(`Skipping ${proj} with type ${type} because it has already been converted...`);
                        continue;
                    }
                    if (targetNameFilter && !targetNameFilter.test(proj)) {
                        core.info(`Skipping ${proj} due to target name filter...`);
                        continue;
                    }

                    let dest: string;
                    let cmd: string;
                    let args: string[];
                    if (process.platform === 'darwin') {
                        dest = path.join(entry.path, proj);
                        if (!await fileExists(dest)) {
                            const macOSPath = path.join(entry.path, 'Contents', 'MacOS');
                            dest = path.join(macOSPath, proj);
                            if (!await fileExists(dest)) {
                                // Try again with whitespaces removed.
                                dest = path.join(macOSPath, proj.replace(' ', ''));
                            }
                            if (!await fileExists(dest)) {
                                core.warning(`Couldn't find a suitable target file in ${entry.path}. Using the path itself...`);
                                dest = entry.path;
                            }
                        }
                        cmd = 'xcrun';
                        args = ['llvm-cov'];
                    } else {
                        dest = entry.path;
                        cmd = 'llvm-cov';
                        args = [];
                    }
                    let fileEnding: string;
                    switch (format) {
                        case CovFormat.txt:
                            args.push('show');
                            fileEnding = 'txt';
                            break;
                        case CovFormat.lcov:
                            args.push('export', '-format=lcov');
                            fileEnding = 'lcov';
                            break;
                    }
                    args.push('-instr-profile', profDataFile, dest);
                    let converted: string;
                    try {
                        converted = await runCmd(cmd, ...args);
                    } catch (error: any) {
                        const msg = `Failed to convert ${dest}: ${error}`;
                        if (error instanceof Error)
                            conversionFailures.push(error);
                        else
                            conversionFailures.push(new Error(msg));
                        if (ignoreConversionFailures) core.info(msg);
                        else core.error(msg);
                        continue;
                    }
                    const projFileName = proj.replace(/\s/g, '');
                    const outFile = path.join(outputFolder, `${projFileName}.${type}.coverage.${fileEnding}`);
                    core.debug(`Writing coverage report to ${outFile}`);
                    await fs.writeFile(outFile, converted);
                    outFiles.push(outFile);
                    processedTargets.add(`${proj}.${type}`);
                }
            }
            if (conversionFailures.length > 0) {
                if (ignoreConversionFailures)
                    core.info(`Failed to convert ${conversionFailures.length} file(s)...`);
                else
                    throw new Error('Conversion failures:\n' + conversionFailures.map(e => e.toString()).join('\n'));
            }
            core.info(`Processed ${outFiles.length} file(s):\n${outFiles.join('\n')}`);
            return outFiles;
        });
    }
    core.setOutput('files', JSON.stringify(convertedFiles));
    if (convertedFiles.length <= 0 && failOnEmptyOutput)
        throw new Error('No coverage files found (or none succeeded to convert)!');
}

try {
    main().catch(error => core.setFailed(error.message));
} catch (error: any) {
    core.setFailed(error.message);
}
