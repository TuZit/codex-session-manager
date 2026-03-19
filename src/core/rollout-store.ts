import { basename, join } from 'node:path';
import { mkdir, rename } from 'node:fs/promises';

export type QuarantinedRollout = {
  originalPath: string;
  quarantinedPath: string;
};

export async function quarantineRollout(
  rolloutPath: string,
  backupDir: string,
): Promise<QuarantinedRollout> {
  const rolloutDir = join(backupDir, 'rollout');
  const rolloutFilename = basename(rolloutPath);
  const quarantinedPath = `rollout/${rolloutFilename}`;
  const quarantinedAbsolutePath = join(rolloutDir, rolloutFilename);

  await mkdir(rolloutDir, { recursive: true });
  await rename(rolloutPath, quarantinedAbsolutePath);

  return {
    originalPath: rolloutPath,
    quarantinedPath,
  };
}
