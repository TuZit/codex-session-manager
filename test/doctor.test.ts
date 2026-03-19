import { describe, expect, it } from 'vitest';

import { buildDoctorReport, runDoctorCommand } from '../src/commands/doctor.js';
import { createFixtureHome } from './helpers/createFixtureHome.js';

describe('buildDoctorReport', () => {
  it('reports fixture path checks, sqlite3 availability, and schema support', async () => {
    const fixtureHome = await createFixtureHome();

    const report = await buildDoctorReport({ codexHome: fixtureHome });

    expect(report.ok).toBe(true);
    expect(report.paths.codexHome).toBe(fixtureHome);
    expect(report.paths.missingRequiredPaths).toEqual([]);
    expect(report.sqlite3.ok).toBe(true);
    expect(report.journalMode).toBe('delete');
    expect(report.schema.supported).toBe(true);
  });
});

describe('runDoctorCommand', () => {
  it('prints the doctor report as JSON when requested', async () => {
    const fixtureHome = await createFixtureHome();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runDoctorCommand({
      codexHome: fixtureHome,
      io: {
        stderr: (chunk) => stderr.push(chunk),
        stdout: (chunk) => stdout.push(chunk),
      },
      json: true,
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toEqual(
      expect.objectContaining({
        ok: true,
        journalMode: 'delete',
      }),
    );
  });
});
