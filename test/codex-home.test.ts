import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCodexStoreFiles,
  resolveCodexHome,
  type ResolveCodexHomeOptions,
} from '../src/core/codex-home.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('resolveCodexHome', () => {
  it('uses ~/.codex on macOS by default', () => {
    const paths = resolveCodexHome({
      homeDir: '/Users/example',
      platform: 'darwin',
    });

    expect(paths.codexHome).toBe('/Users/example/.codex');
    expect(paths.stateDbPath).toBe('/Users/example/.codex/state_5.sqlite');
    expect(paths.sessionIndexPath).toBe('/Users/example/.codex/session_index.jsonl');
    expect(paths.historyPath).toBe('/Users/example/.codex/history.jsonl');
    expect(paths.sessionsDir).toBe('/Users/example/.codex/sessions');
  });

  it('prefers an explicit codex home override', () => {
    const paths = resolveCodexHome({
      codexHome: '/tmp/custom-codex-home',
      homeDir: '/Users/example',
      platform: 'darwin',
    });

    expect(paths.codexHome).toBe('/tmp/custom-codex-home');
    expect(paths.stateDbPath).toBe('/tmp/custom-codex-home/state_5.sqlite');
  });

  it('refuses unsupported platforms', () => {
    expect(() =>
      resolveCodexHome({
        homeDir: '/Users/example',
        platform: 'linux',
      }),
    ).toThrow(/macOS/i);
  });
});

describe('assertCodexStoreFiles', () => {
  it('accepts a materialized fixture home', async () => {
    const fixtureHome = await createFixtureHome();

    await expect(assertCodexStoreFiles(resolveCodexHome({ codexHome: fixtureHome }))).resolves.toBeUndefined();
  });

  it('fails when a required Codex store file is missing', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    await rm(paths.historyPath);

    await expect(assertCodexStoreFiles(paths)).rejects.toThrow(/history\.jsonl/);
  });

  it('does not require the sessions directory to exist yet', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    await rm(paths.sessionsDir, { recursive: true, force: true });

    await expect(assertCodexStoreFiles(paths)).resolves.toBeUndefined();
  });
});
