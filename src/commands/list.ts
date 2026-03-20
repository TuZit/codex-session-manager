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

const SHORT_ID_LEN = 8;
const MAX_TITLE_LEN = 60;

function shortId(id: string): string {
  return id.slice(0, SHORT_ID_LEN);
}

function shortTitle(title: string | null | undefined): string {
  const clean = (title ?? '(no title)')
    .replace(/\s*\n\s*/g, ' ')   // collapse newlines to space
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip markdown links
    .trim();
  return clean.length > MAX_TITLE_LEN ? `${clean.slice(0, MAX_TITLE_LEN)}…` : clean;
}

function renderSessionsText(
  sessions: Awaited<ReturnType<typeof listSessions>>,
  verbose: boolean,
): string {
  return sessions
    .map((session) =>
      verbose
        ? `${session.id}  ${session.title}  updated=${session.updatedAt}  history=${session.historyCount}  rollout=${session.hasRollout ? 'yes' : 'no'}`
        : `${shortId(session.id)}  ${shortTitle(session.title)}`,
    )
    .join('\n');
}

export async function runListCommand(
  options: ResolveCodexHomeOptions & {
    io?: CommandIo;
    json?: boolean;
    verbose?: boolean;
  } = {},
): Promise<number> {
  const io = options.io ?? defaultIo;
  const paths = resolveCodexHome(options);

  await assertCodexStoreFiles(paths);
  await validateCodexSchema(paths.stateDbPath);

  const sessions = await listSessions(paths);

  if (options.json) {
    io.stdout(`${JSON.stringify(sessions)}\n`);
    return 0;
  }

  io.stdout(`${renderSessionsText(sessions, options.verbose ?? false)}\n`);
  return 0;
}
