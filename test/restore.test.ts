import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { resolveCodexHome } from '../src/core/codex-home.js';
import { listSessions } from '../src/core/session-query.js';
import { snapshotSessionDeleteRows } from '../src/core/sqlite-store.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

const FIXTURE_SESSION_ID = '019test-thread-0001';
const FIXTURE_ROLLOUT_RELATIVE_PATH =
  'sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl';

describe('runCli restore', () => {
  it('restores a deleted session from its backup bundle', async () => {
    const fixtureHome = await createFixtureHome();
    const homeDir = await mkdtemp(join(tmpdir(), 'codex-user-home-'));
    const previousHome = process.env.HOME;

    process.env.HOME = homeDir;

    try {
      const deleteStdout: string[] = [];
      const deleteStderr: string[] = [];
      const deleteExitCode = await runCli(
        ['delete', '--id', FIXTURE_SESSION_ID, '--apply', '--yes', '--json', '--codex-home', fixtureHome],
        {
          stderr: (chunk) => deleteStderr.push(chunk),
          stdout: (chunk) => deleteStdout.push(chunk),
        },
      );

      expect(deleteExitCode).toBe(0);
      expect(deleteStderr).toEqual([]);

      const deletePayload = JSON.parse(deleteStdout.join(''));
      const restoreStdout: string[] = [];
      const restoreStderr: string[] = [];

      expect(await listSessions(resolveCodexHome({ codexHome: fixtureHome }))).toEqual([]);

      const restoreExitCode = await runCli(
        ['restore', deletePayload.backupId, '--json', '--codex-home', fixtureHome],
        {
          stderr: (chunk) => restoreStderr.push(chunk),
          stdout: (chunk) => restoreStdout.push(chunk),
        },
      );

      expect(restoreExitCode).toBe(0);
      expect(restoreStderr).toEqual([]);
      expect(JSON.parse(restoreStdout.join(''))).toEqual(
        expect.objectContaining({
          backupId: deletePayload.backupId,
          ok: true,
          sessionId: FIXTURE_SESSION_ID,
        }),
      );

      expect(await listSessions(resolveCodexHome({ codexHome: fixtureHome }))).toEqual([
        expect.objectContaining({
          hasRollout: true,
          historyCount: 2,
          id: FIXTURE_SESSION_ID,
          indexed: true,
          title: 'Fixture Session',
        }),
      ]);
      expect(await readFile(join(fixtureHome, 'history.jsonl'), 'utf8')).toContain(FIXTURE_SESSION_ID);
      expect(await readFile(join(fixtureHome, 'session_index.jsonl'), 'utf8')).toContain(
        FIXTURE_SESSION_ID,
      );
      expect(await readFile(join(fixtureHome, FIXTURE_ROLLOUT_RELATIVE_PATH), 'utf8')).toContain(
        'fixture reply',
      );
      expect(
        (await snapshotSessionDeleteRows(
          resolveCodexHome({ codexHome: fixtureHome }).stateDbPath,
          FIXTURE_SESSION_ID,
        )).map((snapshot) => snapshot.table),
      ).toEqual(
        expect.arrayContaining([
          'threads',
          'logs',
          'thread_dynamic_tools',
          'stage1_outputs',
          'agent_job_items',
        ]),
      );
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
