import * as p from '@clack/prompts';

import { runDoctorCommand } from './commands/doctor.js';
import { runDeleteCommand } from './commands/delete.js';
import { runRestoreCommand } from './commands/restore.js';
import { runSearchCommand } from './commands/search.js';
import { resolveCodexHome } from './core/codex-home.js';
import { listSessions } from './core/session-query.js';

const SHORT_ID_LEN = 8;
const MAX_TITLE_DISPLAY = 55;

function cleanTitle(str: string | null | undefined): string {
  return (str ?? '(no title)')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function truncate(str: string | null | undefined, max: number): string {
  const s = cleanTitle(str);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function tuiList(): Promise<void> {
  const s = p.spinner();
  s.start('Loading sessions…');

  try {
    const paths = resolveCodexHome();
    const sessions = await listSessions(paths);
    s.stop(`Found ${sessions.length} session${sessions.length === 1 ? '' : 's'}`);

    if (sessions.length === 0) {
      p.log.info('No sessions found.');
      return;
    }

    const rows = sessions.map((sess) => {
      const id = sess.id.slice(0, SHORT_ID_LEN);
      const title = truncate(sess.title, MAX_TITLE_DISPLAY);
      return `${id}  ${title}`;
    });

    p.note(rows.join('\n'), 'Sessions');
  } catch (error) {
    s.stop('Error');
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

async function tuiSearch(): Promise<void> {
  const query = await p.text({
    message: 'Search query (id or title):',
    placeholder: 'e.g. my-task',
    validate: (v) => (!v || v.trim() === '' ? 'Query cannot be empty' : undefined),
  });

  if (p.isCancel(query)) return;

  const lines: string[] = [];
  await runSearchCommand({
    io: {
      stderr: (chunk) => p.log.error(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
    json: false,
    query: query.trim(),
  });

  const output = lines.join('\n').trim();
  if (output) {
    p.note(output, `Results for "${query}"`);
  } else {
    p.log.info('No sessions found.');
  }
}

async function tuiDelete(): Promise<void> {
  const s = p.spinner();
  s.start('Loading sessions…');

  let sessions: Awaited<ReturnType<typeof listSessions>>;
  try {
    const paths = resolveCodexHome();
    sessions = await listSessions(paths);
    s.stop(`${sessions.length} session${sessions.length === 1 ? '' : 's'}`);
  } catch (error) {
    s.stop('Error');
    p.log.error(error instanceof Error ? error.message : String(error));
    return;
  }

  if (sessions.length === 0) {
    p.log.info('No sessions to delete.');
    return;
  }

  // Step 1: optional filter
  const filterInput = await p.text({
    message: `Filter sessions (Enter to skip, show all ${sessions.length}):`,
    placeholder: 'id or title…',
  });

  if (p.isCancel(filterInput)) return;

  const keyword = (filterInput ?? '').trim().toLowerCase();
  const filtered = keyword
    ? sessions.filter(
        (sess) =>
          sess.id.toLowerCase().includes(keyword) ||
          cleanTitle(sess.title).toLowerCase().includes(keyword),
      )
    : sessions;

  if (filtered.length === 0) {
    p.log.warn(`No sessions matched "${filterInput}".`);
    return;
  }

  // Step 2: multiselect
  const selected = await p.multiselect({
    message: `Select sessions to delete (${filtered.length} result${filtered.length === 1 ? '' : 's'} — Space to select, Enter to confirm):`,
    options: filtered.map((sess) => ({
      label: `${sess.id.slice(0, SHORT_ID_LEN)}  ${truncate(sess.title, MAX_TITLE_DISPLAY)}`,
      value: sess.id,
    })),
    required: true,
  });

  if (p.isCancel(selected)) return;

  const ids = selected as string[];

  // Step 3: soft or hard
  const deleteMode = await p.select({
    message: `Delete mode for ${ids.length} session${ids.length === 1 ? '' : 's'}:`,
    options: [
      {
        hint: 'Hides session, data preserved (restorable)',
        label: 'Soft delete (archive)',
        value: 'soft',
      },
      {
        hint: 'Permanently removes data, creates backup first',
        label: 'Hard delete',
        value: 'hard',
      },
    ],
  });

  if (p.isCancel(deleteMode)) return;

  // Step 4: confirm
  const confirmed = await p.confirm({
    initialValue: false,
    message: `${deleteMode === 'soft' ? 'Archive' : 'Hard delete'} ${ids.length} session${ids.length === 1 ? '' : 's'}?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn('Cancelled.');
    return;
  }

  // Step 5: execute
  let ok = 0;
  let fail = 0;

  for (const id of ids) {
    const sess = filtered.find((s) => s.id === id);
    const label = sess ? truncate(sess.title, 40) : id.slice(0, SHORT_ID_LEN);
    const spin = p.spinner();
    spin.start(label);

    const lines: string[] = [];
    const code = await runDeleteCommand({
      apply: true,
      id,
      io: {
        stderr: (chunk) => lines.push(chunk.trim()),
        stdout: (chunk) => lines.push(chunk.trim()),
      },
      json: false,
      soft: deleteMode === 'soft',
      yes: true,
    });

    if (code === 0) {
      spin.stop(`✓ ${label}`);
      ok++;
    } else {
      spin.stop(`✗ ${label}: ${lines.join(' ')}`);
      fail++;
    }
  }

  p.log.info(`Done: ${ok} succeeded, ${fail} failed.`);
}

async function tuiRestore(): Promise<void> {
  const backupId = await p.text({
    message: 'Backup ID to restore:',
    placeholder: 'e.g. 2026-03-20T10-00-00-000Z-019abc…',
    validate: (v) => (!v || v.trim() === '' ? 'Backup ID cannot be empty' : undefined),
  });

  if (p.isCancel(backupId)) return;

  const spinner = p.spinner();
  spinner.start('Restoring…');

  const lines: string[] = [];
  const code = await runRestoreCommand({
    backupId: backupId.trim(),
    io: {
      stderr: (chunk) => lines.push(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
  });

  spinner.stop(code === 0 ? 'Done' : 'Error');
  p.note(lines.join('\n'), code === 0 ? 'Result' : 'Error');
}

async function tuiDoctor(): Promise<void> {
  const spinner = p.spinner();
  spinner.start('Checking Codex store…');

  const lines: string[] = [];
  const code = await runDoctorCommand({
    io: {
      stderr: (chunk) => lines.push(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
  });

  spinner.stop(code === 0 ? 'OK' : 'Issues found');
  p.note(lines.join('\n'), 'Doctor report');
}

export async function runTui(): Promise<number> {
  p.intro(' Codex Session Manager ');

  let running = true;
  while (running) {
    const action = await p.select({
      message: 'Select an action:',
      options: [
        { label: 'List sessions', value: 'list' },
        { label: 'Search sessions', value: 'search' },
        { label: 'Delete sessions', value: 'delete' },
        { label: 'Restore session', value: 'restore' },
        { label: 'Doctor', value: 'doctor' },
        { label: 'Exit', value: 'exit' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      running = false;
      break;
    }

    console.log('');

    switch (action) {
      case 'list':
        await tuiList();
        break;
      case 'search':
        await tuiSearch();
        break;
      case 'delete':
        await tuiDelete();
        break;
      case 'restore':
        await tuiRestore();
        break;
      case 'doctor':
        await tuiDoctor();
        break;
    }

    console.log('');
  }

  p.outro('Bye!');
  return 0;
}
