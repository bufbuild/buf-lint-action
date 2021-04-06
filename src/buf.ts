// Copyright 2020-2021 Buf Technologies, Inc.
//
// All rights reserved.

import * as child from 'child_process';
import { Error, isError } from './error';

// lintExitCode is the exit code used to signal that buf
// successfully found lint errors.
const lintExitCode = 100

// LintResult includes both the raw and formatted FileAnnotation
// output of a 'buf lint` command execution. We include both so
// that we preserve the same content users would see on the command line.
export interface LintResult {
    raw: string;
    fileAnnotations: FileAnnotation[];
}

// FileAnnotation conforms the buf FileAnnotation definition
// referenced from the following:
// https://github.com/bufbuild/buf/blob/8255257bd94c9f1b5faa27242211c5caad05be79/internal/buf/bufanalysis/bufanalysis.go#L102
export interface FileAnnotation {
    type: string;
    message: string;
    path?: string;
    start_line?: number;
    end_line?: number;
}

// ExecException is a subset of the child.ExecException interface.
interface ExecException {
    status: number;
    stdout: Buffer | string;
    stderr: Buffer | string;
}

// lint runs 'buf lint' with the given command line arguments.
// Note that we run the same 'buf lint' command twice so that we
// can write out the raw content that users see on the command line.
// We do NOT attempt to reformat the structured FileAnnotation because
// this approach is prone to differentiate from the raw output.
export function lint(
    binaryPath: string,
    input: string,
): LintResult | Error {
    const rawOutput = runLintCommand(`${binaryPath} lint ${input}`);
    if (isError(rawOutput)) {
        return rawOutput
    }
    const jsonOutput = runLintCommand(`${binaryPath} lint ${input} --error-format=json`);
    if (isError(jsonOutput)) {
        return jsonOutput
    }
    const fileAnnotations = parseLines(jsonOutput.trim().split('\n').filter(elem => {
        return elem !== ''
    }))
    if (isError(fileAnnotations)) {
        return fileAnnotations
    }
    return {
        raw: rawOutput,
        fileAnnotations: fileAnnotations,
    };
}

// runLintCommand runs the given command. Note that this function assumes
// the given command is 'buf lint', and handles its exit code as such.
function runLintCommand(cmd: string): string | Error {
    try {
        child.execSync(cmd);
    } catch (error) {
        if (isExecException(error)) {
            if (error.status == lintExitCode) {
                // The command found warnings to report.
                return error.stdout.toString();
            }
            return {
                message: error.stderr.toString(),
            };
        }
        return {
            message: `failed to run command: ${cmd}`
        };
    }
    return ''
}

// parseLines parses the given output lines into an array
// of FileAnnotations.
function parseLines(lines: string[]): FileAnnotation[] | Error {
  const fileAnnotations: FileAnnotation[] = [];
  for (let index = 0; index < lines.length; index++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileAnnotation = JSON.parse(lines[index]);
      if (!isFileAnnotation(fileAnnotation)) {
        return {
          message: `failed to parse "${lines[index]}" as file annotation`,
        };
      }
      fileAnnotations.push(fileAnnotation);
    } catch (error) {
      return {
        message: `failed to parse "${lines[index]}" as file annotation`,
      };
    }
  }
  return fileAnnotations;
}

// isFileAnnotation returns true if the given object is
// a FileAnnotation according to the minimal fields that
// must be present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFileAnnotation(o: any): o is FileAnnotation {
  return (
    'type' in o &&
    'message' in o
  );
}

// isExecException returns true if the given object is
// a ExecException according to the minimal fields that
// are used in this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExecException(o: any): o is ExecException {
  return (
    'status' in o &&
    'stdout' in o &&
    'stderr' in o
  );
}
