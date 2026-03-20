#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { runDoctorCommand } from './commands/doctor.js';
import { runDeleteCommand } from './commands/delete.js';
import { runListCommand } from './commands/list.js';
import { runRestoreCommand } from './commands/restore.js';
import { runSearchCommand } from './commands/search.js';
import { runTui } from './tui.js';

export type CliIO = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

const HELP_TEXT = `codex-session-manager

Usage:
  codex-session-manager <command> [options]

Available today:
  -h, --help Show this help message
  list       List recent Codex sessions
  search     Search sessions by id or title
  doctor     Validate the local Codex store setup
  delete     Preview or delete a session
  restore    Restore a deleted session from backup
`;

export async function runCli(argv: string[], io: CliIO = defaultIo): Promise<number> {
  if (argv.length === 0) {
    return runTui();
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    io.stdout(`${HELP_TEXT}\n`);
    return 0;
  }

  const [command, ...commandArgs] = argv;

  switch (command) {
    case 'list': {
      const parsed = parseCommandArgs(commandArgs);
      return runListCommand({
        codexHome: parsed.codexHome,
        io,
        json: parsed.json,
        verbose: parsed.verbose,
      });
    }
    case 'search': {
      const parsed = parseCommandArgs(commandArgs);
      const query = parsed.positionals[0];

      if (!query) {
        io.stderr('Missing required search query.\n');
        return 1;
      }

      return runSearchCommand({
        codexHome: parsed.codexHome,
        io,
        json: parsed.json,
        query,
      });
    }
    case 'doctor': {
      const parsed = parseCommandArgs(commandArgs);
      return runDoctorCommand({
        codexHome: parsed.codexHome,
        io,
        json: parsed.json,
      });
    }
    case 'delete': {
      const parsed = parseCommandArgs(commandArgs);
      return runDeleteCommand({
        apply: parsed.apply,
        codexHome: parsed.codexHome,
        id: parsed.id,
        io,
        json: parsed.json,
        query: parsed.positionals[0],
        soft: parsed.soft,
        title: parsed.title,
        yes: parsed.yes,
      });
    }
    case 'restore': {
      const parsed = parseCommandArgs(commandArgs);
      const backupId = parsed.positionals[0];

      if (!backupId) {
        io.stderr('Missing required backup id.\n');
        return 1;
      }

      return runRestoreCommand({
        backupId,
        codexHome: parsed.codexHome,
        io,
        json: parsed.json,
      });
    }
    default:
      break;
  }

  io.stderr(`Unknown command: ${command}\n`);
  io.stderr('Run with --help to see available commands.\n');
  return 1;
}

function parseCommandArgs(args: string[]): {
  apply: boolean;
  codexHome?: string;
  id?: string;
  json: boolean;
  positionals: string[];
  soft: boolean;
  title?: string;
  verbose: boolean;
  yes: boolean;
} {
  const parsed = parseArgs({
    allowPositionals: true,
    args,
    options: {
      apply: {
        type: 'boolean',
      },
      'codex-home': {
        type: 'string',
      },
      id: {
        type: 'string',
      },
      json: {
        type: 'boolean',
      },
      soft: {
        type: 'boolean',
      },
      title: {
        type: 'string',
      },
      verbose: {
        short: 'v',
        type: 'boolean',
      },
      yes: {
        type: 'boolean',
      },
    },
    strict: true,
  });

  return {
    apply: parsed.values.apply ?? false,
    codexHome: parsed.values['codex-home'],
    id: parsed.values.id,
    json: parsed.values.json ?? false,
    positionals: parsed.positionals,
    soft: parsed.values.soft ?? false,
    title: parsed.values.title,
    verbose: parsed.values.verbose ?? false,
    yes: parsed.values.yes ?? false,
  };
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
