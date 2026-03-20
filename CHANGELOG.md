# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-20

### Added
- **Interactive TUI menu** — running `codex-session-manager` with no arguments launches a `@clack/prompts`-powered menu (list, search, delete, batch delete, restore, doctor).
- **Batch delete** — multiselect multiple sessions in the TUI and archive or hard-delete them in one pass with per-session progress output.
- **Soft delete / archive** (`--soft` flag) — sets `archived = 1` in SQLite instead of removing data; session disappears from `list` but remains restorable.
- **`restore` command** — replays a backup bundle to bring a hard-deleted session back.

### Fixed
- Handle `null`/`undefined` session title in TUI without crashing.
- Strip newlines and Markdown link syntax from session titles in `list` display.
- `list` now shows short 8-char IDs and truncated titles (max 60 chars) by default; full metadata available with `--verbose` / `-v`.
- Use `sqlite3 -json` output mode when reading thread rows — prevents row-splitting bugs when session titles contain newlines.
- Delete command now correctly finds sessions whose titles contain newline or special characters.

## [0.1.0] - 2026-03-01

### Added
- Initial scaffold: `list`, `search`, `doctor` commands.
- Hard delete with full backup bundle (SQLite snapshot + JSONL partition + rollout quarantine).
- `restore` command skeleton.
