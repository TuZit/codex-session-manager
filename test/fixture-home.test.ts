import { access, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('createFixtureHome', () => {
  it('materializes a temp Codex home fixture with the expected core files', async () => {
    const fixtureHome = await createFixtureHome();

    await expect(access(`${fixtureHome}/session_index.jsonl`)).resolves.toBeUndefined();
    await expect(access(`${fixtureHome}/history.jsonl`)).resolves.toBeUndefined();
    await expect(access(`${fixtureHome}/state_5.sqlite`)).resolves.toBeUndefined();

    const rolloutStats = await stat(
      `${fixtureHome}/sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl`,
    );

    expect(rolloutStats.isFile()).toBe(true);

    const rolloutPath = execFileSync(
      'sqlite3',
      [`${fixtureHome}/state_5.sqlite`, "SELECT rollout_path FROM threads WHERE id = '019test-thread-0001';"],
      { encoding: 'utf8' },
    ).trim();

    expect(rolloutPath).toBe(
      `${fixtureHome}/sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl`,
    );
  });
});
