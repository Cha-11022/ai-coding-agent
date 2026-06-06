import { spawn } from 'child_process';
import { DEFAULT_TIMEOUT } from '../config';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

function runCommand(command: string, timeout: number = DEFAULT_TIMEOUT, cwd?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWin ? ['-Command', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd: cwd || process.cwd(),
      windowsHide: true,
      shell: false,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill(isWin ? 1 : 'SIGTERM');
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: exitCode ?? -1, timedOut });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: -1, timedOut });
    });
  });
}

export { runCommand, CommandResult };