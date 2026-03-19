# codex-session-manager

`codex-session-manager` is an experimental, unofficial, macOS-first TypeScript CLI for inspecting the local Codex session store.

It exists for the case where Codex does not yet expose an official delete UI or command, and you need a practical way to inspect local sessions stored under `~/.codex` before guarded delete and restore land.

## Status

The current implementation is read-only.

Available today:

- `list`
- `search`
- `doctor`
- `delete`

Planned next:

- `restore`

This is a local store management tool, not an official Codex extension or API integration.

## Requirements

- macOS
- Node.js `>= 18`
- `sqlite3` available in `PATH`

The CLI currently validates and reads these local Codex files:

- `~/.codex/state_5.sqlite`
- `~/.codex/session_index.jsonl`
- `~/.codex/history.jsonl`
- rollout files under `~/.codex/sessions/`

## Installation

This repo is ready for npm packaging, but if the package is not published yet you should run it locally from source.

### Local development

```bash
npm install
npm run build
node dist/cli.js --help
```

You can also run the TypeScript entry directly during development:

```bash
npm run dev -- --help
```

### `npx` usage after publish

```bash
npx codex-session-manager --help
```

## Usage

### Help

```bash
codex-session-manager --help
```

Current help output:

```text
codex-session-manager

Usage:
  codex-session-manager <command> [options]

Available today:
  -h, --help Show this help message
  list       List recent Codex sessions
  search     Search sessions by id or title
  doctor     Validate the local Codex store setup
  delete     Preview or delete a session

Planned commands:
  restore    Restore a deleted session from backup
```

### `list`

List non-archived sessions discovered from the local Codex store.

```bash
codex-session-manager list
```

Example text output:

```text
019test-thread-0001  Fixture Session  updated=1772327100  history=2  rollout=yes
```

Machine-readable output:

```bash
codex-session-manager list --json
```

Example JSON fields:

- `id`
- `title`
- `updatedAt`
- `historyCount`
- `indexed`
- `hasRollout`
- `rolloutPath`

### `search <query>`

Search sessions by `id` substring or `title` substring.

```bash
codex-session-manager search "deploy rollback"
codex-session-manager search 019abc --json
```

Notes:

- search is case-insensitive
- `search` returns an empty array with `--json` when nothing matches
- a missing query is treated as an error

### `doctor`

Validate whether the local Codex store looks compatible with this tool.

```bash
codex-session-manager doctor
codex-session-manager doctor --json
```

`doctor` currently checks:

- macOS path resolution
- required store files are present
- `sqlite3` is installed
- the SQLite journal mode can be read
- the expected Codex schema is supported

Text output example:

```text
ok: true
codexHome: /Users/you/.codex
sqlite3: ok
journalMode: delete
schemaSupported: true
```

`doctor` exits with:

- `0` when the environment looks supported
- `1` when validation fails or the store cannot be inspected

### `delete`

Preview by default:

```bash
codex-session-manager delete --id 019abc
codex-session-manager delete "rollback"
```

Apply the delete:

```bash
codex-session-manager delete --id 019abc --apply --yes
codex-session-manager delete "rollback" --apply --yes --json
```

Current behavior:

- preview mode is the default
- apply mode requires `--apply --yes`
- target resolution supports `--id`, `--title`, or a single positional query
- delete creates a backup bundle before mutating local storage
- delete currently updates SQLite, `session_index.jsonl`, `history.jsonl`, and the rollout file

## Options

### `--codex-home <path>`

Override the default Codex home directory.

By default, the CLI reads from:

```text
~/.codex
```

Example:

```bash
codex-session-manager list --codex-home /tmp/fake-codex-home
codex-session-manager search fixture --json --codex-home /tmp/fake-codex-home
codex-session-manager doctor --codex-home /tmp/fake-codex-home
```

### `--json`

Available on:

- `list`
- `search`
- `doctor`

Use this for scripting or for future editor/extension integration.

## Safety And Scope

- `list`, `search`, and `doctor` are read-only; `delete` is mutating
- the tool reads Codex local storage directly instead of using an official Codex API
- compatibility depends on the currently observed `~/.codex` layout and schema
- future delete support is intended to be backup-first and conservative, not a blind hard delete
- delete refuses sessions that look recently active

## Development

Install dependencies:

```bash
npm install
```

Run verification:

```bash
npm test
npm run build
npm run typecheck
```

## Limitations

- v1 currently supports macOS only
- restore is not implemented yet
- the tool reads Codex local storage directly, so future Codex schema changes may require updates here
- there is no Codex app UI integration yet
- there is no Windows or Linux support in v1
- there is no promise of instant Codex UI refresh after future delete operations

## Roadmap

- add guarded safe-delete with backup bundles
- add restore from backup
- keep the core reusable for a future VS Code extension
