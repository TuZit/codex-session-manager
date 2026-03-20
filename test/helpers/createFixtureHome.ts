import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const FIXTURE_ROLLOUT_RELATIVE_PATH =
  'sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl';

export async function createFixtureHome(): Promise<string> {
  const templateDir = fileURLToPath(new URL('../fixtures/codex-home-template/', import.meta.url));
  const tempRoot = await mkdtemp(join(tmpdir(), 'codex-home-fixture-'));
  const fixtureHome = join(tempRoot, 'home');

  await cp(templateDir, fixtureHome, { recursive: true });

  const seedSqlPath = join(fixtureHome, 'state_5.seed.sql');
  const rolloutPath = join(fixtureHome, FIXTURE_ROLLOUT_RELATIVE_PATH);
  const sql = (await readFile(seedSqlPath, 'utf8'))
    .replaceAll('/FAKE-CODEX-HOME', fixtureHome)
    .replaceAll('__ROLLOUT_PATH__', rolloutPath);

  execFileSync('sqlite3', [join(fixtureHome, 'state_5.sqlite')], {
    input: sql,
    stdio: 'pipe',
  });

  return fixtureHome;
}
