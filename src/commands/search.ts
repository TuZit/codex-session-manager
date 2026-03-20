import type { ResolveCodexHomeOptions } from '../core/codex-home.js';
import { assertCodexStoreFiles, resolveCodexHome } from '../core/codex-home.js';
import { validateCodexSchema } from '../core/schema.js';
import { listSessions } from '../core/session-query.js';

type CommandIo = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

const defaultIo: CommandIo = {
  stderr: (chunk) => process.stderr.write(chunk),
  stdout: (chunk) => process.stdout.write(chunk),
};

function renderSessionsText(
  sessions: Awaited<ReturnType<typeof listSessions>>,
): string {
  return sessions
    .map(
      (session) =>
        `${session.id}  ${session.title}  updated=${session.updatedAt}  history=${session.historyCount}  rollout=${session.hasRollout ? 'yes' : 'no'}`,
    )
    .join('\n');
}

export async function runSearchCommand(
  options: ResolveCodexHomeOptions & {
    io?: CommandIo;
    json?: boolean;
    query: string;
  },
): Promise<number> {
  const io = options.io ?? defaultIo;
  const paths = resolveCodexHome(options);

  await assertCodexStoreFiles(paths);
  await validateCodexSchema(paths.stateDbPath);

  const normalizedQuery = options.query.toLowerCase();
  const sessions = (await listSessions(paths)).filter(
    (session) =>
      session.id.toLowerCase().includes(normalizedQuery) ||
      session.title.toLowerCase().includes(normalizedQuery),
  );

  if (options.json) {
    io.stdout(`${JSON.stringify(sessions)}\n`);
    return 0;
  }

  io.stdout(`${renderSessionsText(sessions)}\n`);
  return 0;
}
