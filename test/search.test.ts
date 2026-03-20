import { describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('runCli search', () => {
  it('filters sessions by title or id substring', async () => {
    const fixtureHome = await createFixtureHome();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(['search', 'Fixture', '--json', '--codex-home', fixtureHome], {
      stderr: (chunk) => stderr.push(chunk),
      stdout: (chunk) => stdout.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toEqual([
      expect.objectContaining({
        id: '019test-thread-0001',
        title: 'Fixture Session',
      }),
    ]);
  });

  it('returns an empty JSON array when nothing matches', async () => {
    const fixtureHome = await createFixtureHome();
    const stdout: string[] = [];

    const exitCode = await runCli(['search', 'missing-query', '--json', '--codex-home', fixtureHome], {
      stderr: () => undefined,
      stdout: (chunk) => stdout.push(chunk),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join(''))).toEqual([]);
  });
});
