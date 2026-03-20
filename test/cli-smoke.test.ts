import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';

describe('runCli', () => {
  it('prints help when invoked with --help', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(['--help'], {
      stdout: (chunk) => stdout.push(chunk),
      stderr: (chunk) => stderr.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join('')).toContain('codex-session-manager');
    expect(stdout.join('')).toContain('Usage:');
    expect(stdout.join('')).toContain('Available today:');
    expect(stdout.join('')).toContain('-h, --help');
    expect(stdout.join('')).toContain('restore');
  });

  it('prints help when invoked with -h', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(['-h'], {
      stdout: (chunk) => stdout.push(chunk),
      stderr: (chunk) => stderr.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('')).toContain('codex-session-manager');
  });
});
