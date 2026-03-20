import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('runCli list', () => {
  it('prints session summaries as JSON', async () => {
    const fixtureHome = await createFixtureHome();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(['list', '--json', '--codex-home', fixtureHome], {
      stderr: (chunk) => stderr.push(chunk),
      stdout: (chunk) => stdout.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toEqual([
      expect.objectContaining({
        hasRollout: true,
        historyCount: 2,
        id: '019test-thread-0001',
        indexed: true,
        title: 'Fixture Session',
      }),
    ]);
  });
});
