import * as p from '@clack/prompts';

import { runDoctorCommand } from './commands/doctor.js';
import { runDeleteCommand } from './commands/delete.js';
import { runListCommand } from './commands/list.js';
import { runRestoreCommand } from './commands/restore.js';
import { runSearchCommand } from './commands/search.js';
import { resolveCodexHome } from './core/codex-home.js';
import { listSessions } from './core/session-query.js';

const MAX_TITLE_DISPLAY = 55;

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function formatUpdatedAt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

async function tuiList(): Promise<void> {
  const s = p.spinner();
  s.start('Đang tải danh sách session…');

  try {
    const paths = resolveCodexHome();
    const sessions = await listSessions(paths);
    s.stop(`Tìm thấy ${sessions.length} session`);

    if (sessions.length === 0) {
      p.log.info('Không có session nào.');
      return;
    }

    const rows = sessions.map((sess) => {
      const title = truncate(sess.title, MAX_TITLE_DISPLAY);
      const updated = formatUpdatedAt(sess.updatedAt);
      return `${sess.id}  ${title}  (${updated})`;
    });

    p.note(rows.join('\n'), 'Danh sách session');
  } catch (error) {
    s.stop('Lỗi');
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

async function tuiSearch(): Promise<void> {
  const query = await p.text({
    message: 'Nhập từ khoá tìm kiếm (id hoặc title):',
    placeholder: 'ví dụ: my-task',
    validate: (v) => (!v || v.trim() === '' ? 'Không được để trống' : undefined),
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
    p.note(output, `Kết quả cho "${query}"`);
  } else {
    p.log.info('Không tìm thấy session nào.');
  }
}

async function tuiDelete(): Promise<void> {
  // Load sessions for picker
  const s = p.spinner();
  s.start('Đang tải danh sách session…');

  let sessions: Awaited<ReturnType<typeof listSessions>>;
  try {
    const paths = resolveCodexHome();
    sessions = await listSessions(paths);
    s.stop(`${sessions.length} session`);
  } catch (error) {
    s.stop('Lỗi');
    p.log.error(error instanceof Error ? error.message : String(error));
    return;
  }

  if (sessions.length === 0) {
    p.log.info('Không có session nào để xoá.');
    return;
  }

  const sessionId = await p.select({
    message: 'Chọn session muốn xoá:',
    options: sessions.map((sess) => ({
      label: `${truncate(sess.title, MAX_TITLE_DISPLAY)}  [${sess.id.slice(0, 16)}…]`,
      value: sess.id,
    })),
  });

  if (p.isCancel(sessionId)) return;

  const deleteMode = await p.select({
    message: 'Kiểu xoá:',
    options: [
      {
        hint: 'Ẩn session, dữ liệu vẫn còn (có thể restore)',
        label: 'Soft delete (archive)',
        value: 'soft',
      },
      {
        hint: 'Xoá hoàn toàn, tạo backup trước',
        label: 'Hard delete (xoá hẳn)',
        value: 'hard',
      },
    ],
  });

  if (p.isCancel(deleteMode)) return;

  const target = sessions.find((s) => s.id === sessionId);
  const confirmed = await p.confirm({
    initialValue: false,
    message: `Xác nhận ${deleteMode === 'soft' ? 'archive' : 'xoá hẳn'} session:\n  "${target?.title ?? sessionId}"?`,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn('Đã huỷ.');
    return;
  }

  const spinner2 = p.spinner();
  spinner2.start('Đang xử lý…');

  const lines: string[] = [];
  const code = await runDeleteCommand({
    apply: true,
    id: String(sessionId),
    io: {
      stderr: (chunk) => lines.push(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
    json: false,
    soft: deleteMode === 'soft',
    yes: true,
  });

  spinner2.stop(code === 0 ? 'Hoàn thành' : 'Có lỗi');
  p.note(lines.join('\n'), code === 0 ? 'Kết quả' : 'Lỗi');
}

async function tuiRestore(): Promise<void> {
  const backupId = await p.text({
    message: 'Nhập backup ID để restore:',
    placeholder: 'ví dụ: 2026-03-20T10-00-00-000Z-019abc…',
    validate: (v) => (!v || v.trim() === '' ? 'Không được để trống' : undefined),
  });

  if (p.isCancel(backupId)) return;

  const spinner = p.spinner();
  spinner.start('Đang restore…');

  const lines: string[] = [];
  const code = await runRestoreCommand({
    backupId: backupId.trim(),
    io: {
      stderr: (chunk) => lines.push(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
  });

  spinner.stop(code === 0 ? 'Hoàn thành' : 'Có lỗi');
  p.note(lines.join('\n'), code === 0 ? 'Kết quả' : 'Lỗi');
}

async function tuiDoctor(): Promise<void> {
  const spinner = p.spinner();
  spinner.start('Đang kiểm tra Codex store…');

  const lines: string[] = [];
  const code = await runDoctorCommand({
    io: {
      stderr: (chunk) => lines.push(chunk.trim()),
      stdout: (chunk) => lines.push(chunk.trim()),
    },
  });

  spinner.stop(code === 0 ? 'OK' : 'Có vấn đề');
  p.note(lines.join('\n'), 'Doctor report');
}

export async function runTui(): Promise<number> {
  p.intro(' Codex Session Manager ');

  let running = true;
  while (running) {
    const action = await p.select({
      message: 'Chọn hành động:',
      options: [
        { label: 'List sessions', value: 'list' },
        { label: 'Search sessions', value: 'search' },
        { label: 'Delete session', value: 'delete' },
        { label: 'Restore session', value: 'restore' },
        { label: 'Doctor (kiểm tra store)', value: 'doctor' },
        { label: 'Thoát', value: 'exit' },
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

  p.outro('Tạm biệt!');
  return 0;
}
