import type { ResolveCodexHomeOptions } from '../core/codex-home.js';
import { archiveSession, deleteSession } from '../core/delete-session.js';

type DeleteIo = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

const defaultIo: DeleteIo = {
  stderr: (chunk) => process.stderr.write(chunk),
  stdout: (chunk) => process.stdout.write(chunk),
};

type DeleteCommandOptions = ResolveCodexHomeOptions & {
  apply?: boolean;
  id?: string;
  io?: DeleteIo;
  json?: boolean;
  query?: string;
  soft?: boolean;
  sqlite3Command?: string;
  title?: string;
  yes?: boolean;
};

function renderDeleteText(result: Awaited<ReturnType<typeof deleteSession>>): string {
  if (result.mode === 'preview') {
    return [
      'Preview delete',
      `sessionId: ${result.sessionId}`,
      `title: ${result.title}`,
      `layers: ${result.changedLayers.join(', ')}`,
      'Run again with --apply --yes to perform the delete.',
    ].join('\n');
  }

  return [
    'Deleted session',
    `sessionId: ${result.sessionId}`,
    `title: ${result.title}`,
    `backupId: ${result.backupId ?? 'unknown'}`,
    `layers: ${result.changedLayers.join(', ')}`,
  ].join('\n');
}

function renderArchiveText(result: Awaited<ReturnType<typeof archiveSession>>): string {
  if (result.mode === 'preview') {
    return [
      'Preview archive (soft delete)',
      `sessionId: ${result.sessionId}`,
      `title: ${result.title}`,
      'Run again with --apply --yes to archive the session.',
    ].join('\n');
  }

  return [
    'Archived session (soft deleted)',
    `sessionId: ${result.sessionId}`,
    `title: ${result.title}`,
  ].join('\n');
}

export async function runDeleteCommand(options: DeleteCommandOptions): Promise<number> {
  const io = options.io ?? defaultIo;

  try {
    if (options.soft) {
      const result = await archiveSession({
        apply: options.apply,
        codexHome: options.codexHome,
        id: options.id,
        query: options.query,
        sqlite3Command: options.sqlite3Command,
        title: options.title,
        yes: options.yes,
      });

      if (options.json) {
        io.stdout(`${JSON.stringify(result)}\n`);
        return 0;
      }

      io.stdout(`${renderArchiveText(result)}\n`);
      return 0;
    }

    const result = await deleteSession({
      apply: options.apply,
      codexHome: options.codexHome,
      id: options.id,
      query: options.query,
      sqlite3Command: options.sqlite3Command,
      title: options.title,
      yes: options.yes,
    });

    if (options.json) {
      io.stdout(`${JSON.stringify(result)}\n`);
      return 0;
    }

    io.stdout(`${renderDeleteText(result)}\n`);
    return 0;
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
