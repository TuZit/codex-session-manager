import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { resolveCodexHome } from '../src/core/codex-home.js';
import { inspectCodexSchema, validateCodexSchema } from '../src/core/schema.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('inspectCodexSchema', () => {
  it('reports the supported fixture schema', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    const report = await inspectCodexSchema(paths.stateDbPath);

    expect(report.supported).toBe(true);
    expect(report.missingTables).toEqual([]);
    expect(report.missingThreadColumns).toEqual([]);
    expect(report.tables).toContain('threads');
    expect(report.tables).toContain('logs');
  });

  it('reports missing required tables', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    execFileSync('sqlite3', [paths.stateDbPath, 'DROP TABLE threads;']);

    const report = await inspectCodexSchema(paths.stateDbPath);

    expect(report.supported).toBe(false);
    expect(report.missingTables).toContain('threads');
  });

  it('reports schemas that are missing later-required thread columns', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    execFileSync(
      'sqlite3',
      [
        paths.stateDbPath,
        `
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;
        ALTER TABLE threads RENAME TO threads_old;
        CREATE TABLE threads (
            id TEXT PRIMARY KEY,
            rollout_path TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            title TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0,
            cli_version TEXT NOT NULL DEFAULT '',
            memory_mode TEXT NOT NULL DEFAULT 'enabled'
        );
        INSERT INTO threads (id, rollout_path, updated_at, title, archived, cli_version, memory_mode)
        SELECT id, rollout_path, updated_at, title, archived, cli_version, memory_mode
        FROM threads_old;
        DROP TABLE threads_old;
        COMMIT;
        PRAGMA foreign_keys = ON;
        `,
      ],
    );

    const report = await inspectCodexSchema(paths.stateDbPath);

    expect(report.supported).toBe(false);
    expect(report.missingThreadColumns).toContain('created_at');
    expect(report.missingThreadColumns).toContain('source');
  });
});

describe('validateCodexSchema', () => {
  it('throws when the schema is unsupported', async () => {
    const fixtureHome = await createFixtureHome();
    const paths = resolveCodexHome({ codexHome: fixtureHome });

    execFileSync('sqlite3', [paths.stateDbPath, 'DROP TABLE thread_dynamic_tools;']);

    await expect(validateCodexSchema(paths.stateDbPath)).rejects.toThrow(/thread_dynamic_tools/);
  });
});
