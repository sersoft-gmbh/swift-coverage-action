import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { promises as fs } from 'fs';
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

// Taken and adjusted from https://stackoverflow.com/a/65415138/1388842
async function* forEachFiles(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const res = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            yield* forEachFiles(res);
        } else {
            yield res;
        }
    }
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
        const profDataRegex = /.*\.profdata$/.compile();
        let profDataFiles: string[] = [];
        for await (const file of forEachFiles(derivedData)) {
            if (profDataRegex.test(file)) {
                profDataFiles.push(file);
                core.debug('Found profdata file: ' + file);
            }
        }
        return profDataFiles;
    });

    let outFiles: string[];
    if (profDataFiles.length > 0) {
        outFiles = await core.group('Converting files', async () => {
            const buildDirRegex = /(Build).*/.compile();
            const typesRegex = /.*(app|framework|xctest)$/.compile();
            const pathRegex = /.*\//.compile();
            let outFiles: string[] = [];
            for (const profDataFile of profDataFiles) {
                const buildDir = dirname(profDataFile).replace(buildDirRegex, '$1');
                core.debug(`Checking contents of build dir ${buildDir} of prof data file ${profDataFile}`);
                for await (const file of forEachFiles(buildDir)) {
                    if (!typesRegex.test(file)) continue;
                    const type = file.replace(typesRegex, '$1');
                    const proj = file
                        .replace(pathRegex, '')
                        .replace(`.${type}`, '');
                    const destStat = await fs.stat(path.join(file, proj));
                    const dest = destStat.isFile() ? path.join(file, proj) : path.join(file, 'Contents', 'MacOS', proj);
                    const destName = dest.replace(/\s/g, '');
                    const outFile = path.join(outputFolder, `${destName}.${type}.coverage.txt`);
                    const converted = await runCmd('xcrun', [
                        'llvm-cov', 'show', '-instr-profile', profDataFile, dest,
                    ]);
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
