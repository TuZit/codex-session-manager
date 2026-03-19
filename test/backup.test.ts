import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createBackupBundle } from '../src/core/backup.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

const FIXTURE_SESSION_ID = '019test-thread-0001';
const FIXTURE_ROLLOUT_RELATIVE_PATH =
  'sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl';

describe('createBackupBundle', () => {
  it('creates a timestamped backup bundle with manifest, sqlite snapshots, and removed jsonl lines', async () => {
    const backupRootDir = await mkdtemp(join(tmpdir(), 'codex-backups-'));
    const createdAt = new Date('2026-03-19T08:09:10.111Z');

    const result = await createBackupBundle({
      backupRootDir,
      createdAt,
      historyLines: [
        '{"session_id":"019test-thread-0001","ts":1772327060,"text":"help me test"}',
        '{"session_id":"019test-thread-0001","ts":1772327080,"text":"show fixture output"}',
      ],
      sessionId: FIXTURE_SESSION_ID,
      sessionIndexLines: [
        '{"id":"019test-thread-0001","thread_name":"Fixture Session","updated_at":"2026-03-01T09:05:00.000000Z"}',
      ],
      sqliteSnapshots: [
        {
          rowsSql: [
            "INSERT INTO threads(id, title) VALUES('019test-thread-0001', 'Fixture Session');",
          ],
          table: 'threads',
        },
        {
          rowsSql: ["INSERT INTO logs(id, thread_id) VALUES(1, '019test-thread-0001');"],
          table: 'logs',
        },
      ],
    });

    expect(result.backupId).toBe('2026-03-19T08-09-10.111Z-019test-thread-0001');
    expect(result.backupDir).toBe(join(backupRootDir, result.backupId));

    const manifest = JSON.parse(await readFile(join(result.backupDir, 'manifest.json'), 'utf8'));
    expect(manifest).toEqual(
      expect.objectContaining({
        backupId: result.backupId,
        createdAt: createdAt.toISOString(),
        sessionId: FIXTURE_SESSION_ID,
      }),
    );

    expect(await readFile(join(result.backupDir, 'jsonl', 'history.jsonl'), 'utf8')).toBe(
      [
        '{"session_id":"019test-thread-0001","ts":1772327060,"text":"help me test"}',
        '{"session_id":"019test-thread-0001","ts":1772327080,"text":"show fixture output"}',
        '',
      ].join('\n'),
    );
    expect(await readFile(join(result.backupDir, 'jsonl', 'session_index.jsonl'), 'utf8')).toBe(
      '{"id":"019test-thread-0001","thread_name":"Fixture Session","updated_at":"2026-03-01T09:05:00.000000Z"}\n',
    );
    expect(await readFile(join(result.backupDir, 'sqlite', 'threads.sql'), 'utf8')).toContain(
      'INSERT INTO threads',
    );
    expect(await readFile(join(result.backupDir, 'sqlite', 'logs.sql'), 'utf8')).toContain(
      'INSERT INTO logs',
    );
  });

  it('moves the rollout transcript into quarantine and records the original path', async () => {
    const fixtureHome = await createFixtureHome();
    const backupRootDir = await mkdtemp(join(tmpdir(), 'codex-backups-'));
    const rolloutPath = join(fixtureHome, FIXTURE_ROLLOUT_RELATIVE_PATH);
    const originalContent = await readFile(rolloutPath, 'utf8');

    const result = await createBackupBundle({
      backupRootDir,
      createdAt: new Date('2026-03-19T08:09:10.111Z'),
      rolloutPath,
      sessionId: FIXTURE_SESSION_ID,
    });

    const manifest = JSON.parse(await readFile(join(result.backupDir, 'manifest.json'), 'utf8'));

    await expect(access(rolloutPath)).rejects.toThrow();
    expect(
      await readFile(
        join(
          result.backupDir,
          'rollout',
          'rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl',
        ),
        'utf8',
      ),
    ).toBe(originalContent);
    expect(manifest.rollout).toEqual(
      expect.objectContaining({
        originalPath: rolloutPath,
        quarantinedPath: 'rollout/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl',
      }),
    );
  });
});
