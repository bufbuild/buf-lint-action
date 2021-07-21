// Copyright 2020-2021 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { lint, FileAnnotation } from './buf';
import { Error, isError } from './error';

// minimumBufVersion is the minimum buf version required to
// run this action. At least this version is required because
// the implementation uses the FileAnnotation exit code introduced
// in the following release:
// https://github.com/bufbuild/buf/releases/tag/v0.41.0
const minimumBufVersion = '0.41.0'

// runnerTempEnvKey is the environment variable key
// used to access a temporary directory. Although
// undocumented in the Github Actions documentation,
// this can be found in the @actions/tools-cache module.
// https://github.com/actions/toolkit/blob/4bf916289e5e32bb7d1bd7f21842c3afeab3b25a/packages/tool-cache/src/tool-cache.ts#L701
const runnerTempEnvKey = 'RUNNER_TEMP'

export async function run(): Promise<void> {
    try {
        const result = await runLint();
        if (result !== null && isError(result)) {
            core.setFailed(result.message);
        }
    } catch (error) {
        // In case we ever fail to catch an error
        // in the call chain, we catch the error
        // and mark the build as a failure. The
        // user is otherwise prone to false positives.
        if (isError(error)) {
            core.setFailed(error.message);
            return;
        }
        core.setFailed('Internal error');
    }
}

// runLint runs the buf-lint action, and returns
// a non-empty error if it fails.
async function runLint(): Promise<null|Error> {
    const input = core.getInput('input');
    if (input === '') {
        return {
            message: 'an input was not provided'
        };
    }
    const binaryPath = await io.which('buf', true);
    if (binaryPath === '') {
        return {
            message: 'buf is not installed; please add the "bufbuild/buf-setup-action" step to your job found at https://github.com/bufbuild/buf-setup-action'
        };
    }
    const version = child.execSync(`${binaryPath} --version 2>&1`).toString();
    if (semver.lt(version, minimumBufVersion)) {
        return {
            message: `buf must be at least version ${minimumBufVersion}, but found ${version}`
        };
    }

    const bufToken = core.getInput('buf_token');
    if (bufToken !== '') {
        // If the BUF_TOKEN is set, add it to the runner's .netrc.
        const tempDir = process.env[runnerTempEnvKey] ?? '';
        if (tempDir === '') {
            return {
                message: `expected ${runnerTempEnvKey} to be defined`
            };
        }

        // TODO: For now, we hard-code the 'buf.build' remote. This will
        // need to be refactored once we support federation between other
        // BSR remotes.
        const netrcPath = path.join(tempDir, '.netrc');
        fs.writeFileSync(netrcPath, `machine buf.build\npassword ${bufToken}`, { flag: 'w' });
        process.env.NETRC = netrcPath;
    }

    const result = lint(binaryPath, input);
    if (isError(result)) {
        return result
    }
    if (result.fileAnnotations.length === 0) {
        core.info('No lint errors were found.');
        return null;
    }

    // If this action was configured for pull requests, we post the
    // FileAnnotations as comments.
    result.fileAnnotations.forEach((fileAnnotation: FileAnnotation) => {
        const { path, start_line, start_column, message } = fileAnnotation;
        if (path === undefined || start_line === undefined || start_column === undefined) {
          core.error(message);
          return;
        }
        // This uses the `::error` message feature of Github Actions. It converts the message to
        // an error log in the Github Actions console and creates an error annotation at the given
        // file path and line. This is not currently supported with `core.error`.
        // For more information, see the documentation:
        // https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions#setting-an-error-message
        core.info(`::error file=${path},line=${start_line},col=${start_column}::${message}`);
    })
    return {
        message: `buf found ${result.fileAnnotations.length} lint failures.`
    };
}
