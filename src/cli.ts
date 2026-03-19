#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

export type CliIO = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

const HELP_TEXT = `codex-session-manager

Usage:
  codex-session-manager <command> [options]

Available today:
  -h, --help Show this help message

Planned commands:
  list       List recent Codex sessions
  search     Search sessions by id or title
  delete     Preview or delete a session
  restore    Restore a deleted session from backup
  doctor     Validate the local Codex store setup
`;

export async function runCli(argv: string[], io: CliIO = defaultIo): Promise<number> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    io.stdout(`${HELP_TEXT}\n`);
    return 0;
  }

  io.stderr(`Unknown command: ${argv[0]}\n`);
  io.stderr('Run with --help to see available commands.\n');
  return 1;
}

const defaultIo: CliIO = {
  stderr: (chunk) => process.stderr.write(chunk),
  stdout: (chunk) => process.stdout.write(chunk),
};

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
