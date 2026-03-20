import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { resolveCodexHome } from '../src/core/codex-home.js';
import { listSessions } from '../src/core/session-query.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('listSessions', () => {
  it('lists fixture sessions with rollout and history enrichment', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    const sessions = await listSessions(paths);

    expect(sessions).toEqual([
      expect.objectContaining({
        id: '019test-thread-0001',
        title: 'Fixture Session',
        updatedAt: 1772327100,
        historyCount: 2,
        indexed: true,
        hasRollout: true,
      }),
    ]);
  });

  it('preserves thread titles that contain sqlite separator characters', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    execFileSync('sqlite3', [
      paths.stateDbPath,
      "UPDATE threads SET title = 'Fixture | Session' WHERE id = '019test-thread-0001';",
    ]);

    const [session] = await listSessions(paths);

    expect(session?.title).toBe('Fixture | Session');
    expect(session?.updatedAt).toBe(1772327100);
    expect(session?.hasRollout).toBe(true);
  });
});
