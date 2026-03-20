import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { resolveCodexHome } from '../src/core/codex-home.js';
import { listSessions } from '../src/core/session-query.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

const FIXTURE_SESSION_ID = '019test-thread-0001';
const FIXTURE_ROLLOUT_RELATIVE_PATH =
  'sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl';

describe('runCli delete', () => {
  it('returns a preview by default and does not mutate the session store', async () => {
    const fixtureHome = await createFixtureHome();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(['delete', '--id', FIXTURE_SESSION_ID, '--json', '--codex-home', fixtureHome], {
      stderr: (chunk) => stderr.push(chunk),
      stdout: (chunk) => stdout.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toEqual(
      expect.objectContaining({
        mode: 'preview',
        ok: true,
        sessionId: FIXTURE_SESSION_ID,
      }),
    );
    expect((await listSessions(resolveCodexHome({ codexHome: fixtureHome }))).map((session) => session.id)).toEqual([
      FIXTURE_SESSION_ID,
    ]);
  });

  it('applies delete with backup when --apply --yes are provided', async () => {
    const fixtureHome = await createFixtureHome();
    const homeDir = await mkdtemp(join(tmpdir(), 'codex-user-home-'));
    const previousHome = process.env.HOME;
    const stdout: string[] = [];
    const stderr: string[] = [];

    process.env.HOME = homeDir;

    try {
      const exitCode = await runCli(
        ['delete', '--id', FIXTURE_SESSION_ID, '--apply', '--yes', '--json', '--codex-home', fixtureHome],
        {
          stderr: (chunk) => stderr.push(chunk),
          stdout: (chunk) => stdout.push(chunk),
        },
      );

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);

      const payload = JSON.parse(stdout.join(''));

      expect(payload).toEqual(
        expect.objectContaining({
          mode: 'apply',
          ok: true,
          sessionId: FIXTURE_SESSION_ID,
        }),
      );

      const backupDir = join(homeDir, '.codex-session-manager', 'backups', payload.backupId);

      expect(await listSessions(resolveCodexHome({ codexHome: fixtureHome }))).toEqual([]);
      expect(await readFile(join(fixtureHome, 'history.jsonl'), 'utf8')).toBe('');
      expect(await readFile(join(fixtureHome, 'session_index.jsonl'), 'utf8')).toBe('');
      await expect(
        readFile(join(fixtureHome, FIXTURE_ROLLOUT_RELATIVE_PATH), 'utf8'),
      ).rejects.toThrow();
      expect(await readFile(join(backupDir, 'manifest.json'), 'utf8')).toContain(FIXTURE_SESSION_ID);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
