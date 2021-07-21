import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import {promises as fs, existsSync as exists, PathLike} from 'fs';
import { resolve, dirname } from 'path';
import * as path from "path";
import * as os from "os";

async function runCmd(cmd: string, args?: string[]): Promise<string> {
    let stdOut = '';
    await exec.exec(cmd, args, {
        failOnStdErr: true,
        listeners: {
            stdout: (data: Buffer) => stdOut += data.toString()
        }
    });
    return stdOut;
}

declare type WalkEntry = {
  path: string;
  isDirectory: boolean;
};

// Taken and adjusted from https://stackoverflow.com/a/65415138/1388842
async function* walk(dir: string, onlyFiles: boolean = true): AsyncGenerator<WalkEntry> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const res = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            if (!onlyFiles)
                yield { path: res, isDirectory: true };
            yield* walk(res, onlyFiles);
        } else {
            yield { path: res, isDirectory: false };
        }
    }
}

async function fileExists(path: PathLike): Promise<boolean> {
    if (!exists(path)) return false;
    const stat = await fs.stat(path);
    return stat.isFile();
}

async function main() {
    if (process.platform !== "darwin") {
        throw new Error('This action only supports macOS!');
    }

    core.startGroup('Validating input');
    const derivedData = core.getInput('derived-data', {required: true})
        .replace(/(~|\$HOME|\${HOME})/g, os.homedir);
    const outputFolder = core.getInput('output', {required: true})
        .replace(/(~|\$HOME|\${HOME})/g, os.homedir);
    core.endGroup();

    await core.group('Setting up paths', async () => {
        await io.rmRF(outputFolder);
        await io.mkdirP(outputFolder);
    });

    const profDataFiles = await core.group('Finding coverage files', async () => {
        let profDataFiles: string[] = [];
        for await (const entry of walk(derivedData, true)) {
            if (/.*\.profdata$/.test(entry.path)) {
                profDataFiles.push(entry.path);
                core.debug('Found profdata file: ' + entry.path);
            }
        }
        return profDataFiles;
    });

    let outFiles: string[];
    if (profDataFiles.length > 0) {
        outFiles = await core.group('Converting files', async () => {
            let outFiles: string[] = [];
            for (const profDataFile of profDataFiles) {
                const buildDir = dirname(profDataFile).replace(/(Build).*/, '$1');
                core.debug(`Checking contents of build dir ${buildDir} of prof data file ${profDataFile}`);
                for await (const entry of walk(buildDir, false)) {
                    const typesRegex = /.*\.(app|framework|xctest)$/;
                    if (!typesRegex.test(entry.path)) continue;
                    const type = entry.path.replace(typesRegex, '$1');
                    core.debug(`Found match of type ${type}: ${entry.path}`);
                    const proj = entry.path
                        .replace(/.*\//, '')
                        .replace(`.${type}`, '');
                    core.debug('Project name: ' + proj);

                    let dest = path.join(entry.path, proj);
                    if (!await fileExists(dest)) {
                        dest = path.join(entry.path, 'Contents', 'MacOS', proj);
                    }
                    const converted = await runCmd('xcrun', [
                        'llvm-cov', 'show', '-instr-profile', profDataFile, dest,
                    ]);
                    const destName = proj.replace(/\s/g, '');
                    const outFile = path.join(outputFolder, `${destName}.${type}.coverage.txt`);
                    core.debug('Writing coverage report to ' + outFile);
                    await fs.writeFile(outFile, converted);
                    outFiles.push(outFile);
                }
            }
            return outFiles;
        });
    } else {
        outFiles = [];
    }
    core.setOutput('files', JSON.stringify(outFiles));
}

try {
    main().catch(error => core.setFailed(error.message))
} catch (error) {
    core.setFailed(error.message);
}
