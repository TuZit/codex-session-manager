import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { CodexStorePaths, ResolveCodexHomeOptions } from './session-types.js';

const REQUIRED_STORE_ENTRIES: Array<keyof Pick<
  CodexStorePaths,
  'historyPath' | 'sessionIndexPath' | 'stateDbPath'
>> = ['stateDbPath', 'sessionIndexPath', 'historyPath'];

export function resolveCodexHome(options: ResolveCodexHomeOptions = {}): CodexStorePaths {
  const platform = options.platform ?? process.platform;

  if (platform !== 'darwin') {
    throw new Error('codex-session-manager v1 currently supports macOS only.');
  }

  const codexHome = options.codexHome ?? join(options.homeDir ?? homedir(), '.codex');

  return {
    codexHome,
    historyPath: join(codexHome, 'history.jsonl'),
    sessionIndexPath: join(codexHome, 'session_index.jsonl'),
    sessionsDir: join(codexHome, 'sessions'),
    stateDbPath: join(codexHome, 'state_5.sqlite'),
  };
}

export async function assertCodexStoreFiles(paths: CodexStorePaths): Promise<void> {
  for (const key of REQUIRED_STORE_ENTRIES) {
    try {
      await access(paths[key]);
    } catch {
      throw new Error(`Missing required Codex store entry: ${paths[key]}`);
    }
  }
}

export type { CodexStorePaths, ResolveCodexHomeOptions } from './session-types.js';
