# Codex Session Manager Design

## Status

Approved for v1 implementation.

## Problem

Codex currently does not expose an official command or UI flow to delete local chat sessions that a user no longer wants to keep. The data is stored locally in multiple places, so manual deletion is risky and easy to get wrong.

Observed local storage on this macOS machine:

- `~/.codex/state_5.sqlite`
- `~/.codex/session_index.jsonl`
- `~/.codex/history.jsonl`
- `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`

The desktop app is actively using SQLite WAL mode, so v1 must assume Codex may still be open while the tool runs.

## Product Direction

Build v1 as an open source npm package that can be run with `npx`.

- Delivery format: standalone CLI package
- Language: TypeScript + Node.js
- Platform scope: macOS only for v1
- User experience: safe delete by default, backup-first, restore supported
- Future direction: VS Code extension that reuses the same core logic

This is a local store management tool, not an official Codex extension or API integration.

## Goals

- Let users inspect local sessions with `list` and `search`
- Let users delete a session by `id` or by resolved title match
- Keep Codex open during operation when possible
- Make delete reversible with backups and restore
- Fail closed when the local store layout no longer matches expected assumptions
- Keep install friction low enough for `npx`

## Non-Goals

- No direct integration into Codex desktop UI in v1
- No Windows or Linux support in v1
- No guarantee of instant UI refresh inside Codex after deletion
- No deletion of the actively changing thread in v1
- No hard delete as the default behavior

## Key Constraints

### 1. Live mutation while Codex is open

The app is using SQLite WAL mode. A naive "delete files and edit JSONL" approach can leave the store inconsistent if Codex is still writing.

### 2. No official active-thread API

There is no supported API for "the thread currently open in the app". v1 will use a best-effort activity guard instead of claiming perfect active-thread detection.

### 3. Multiple storage layers

A session is represented across several stores:

- `threads` row in SQLite
- related rows such as `thread_dynamic_tools`, `stage1_outputs`, `logs`, and `agent_job_items.assigned_thread_id`
- `session_index.jsonl` entries
- `history.jsonl` entries
- rollout transcript file under `~/.codex/sessions/...`

Deleting only one layer is not acceptable.

## Chosen Design: Live Safe Delete With Guardrails

V1 will implement live safe delete with guardrails.

Behavior summary:

1. Resolve Codex home and validate the expected macOS store layout.
2. Resolve the session by exact `id` or by search/title selection.
3. Refuse deletion when the target appears active or recently updated.
4. Create a backup bundle before any mutation.
5. Apply SQLite mutations inside a transaction.
6. Rewrite JSONL files using temp files plus atomic rename.
7. Move the rollout file into a quarantine area inside the backup bundle.
8. Record a manifest so the delete can be restored later.

This keeps UX acceptable without pretending the tool has an official hook into Codex internals.

## Why Not The Other Approaches

### Offline authoritative delete

This is safer technically, but it forces users to close Codex and hurts the core UX goal.

### Live hard delete

This has the highest corruption risk and no recovery path. It is not acceptable as the default for an unofficial local-store tool.

## Package Shape

Use a small monolithic CLI package for v1, but keep the code split internally so VS Code extension work can reuse the core.

Suggested repo structure:

- `src/cli.ts`
- `src/commands/list.ts`
- `src/commands/search.ts`
- `src/commands/delete.ts`
- `src/commands/restore.ts`
- `src/commands/doctor.ts`
- `src/core/codex-home.ts`
- `src/core/schema.ts`
- `src/core/session-query.ts`
- `src/core/activity-guard.ts`
- `src/core/backup.ts`
- `src/core/jsonl-store.ts`
- `src/core/sqlite-store.ts`
- `src/core/rollout-store.ts`
- `src/core/restore.ts`

## Storage Strategy

### SQLite access

V1 should use the system `sqlite3` binary instead of a native Node SQLite dependency.

Reasoning:

- better `npx` experience
- avoid native addon build failures
- acceptable for macOS-only scope
- easy to validate with a `doctor` command

If `sqlite3` is missing, the CLI must stop with a clear message.

### JSONL access

Both `session_index.jsonl` and `history.jsonl` should be treated as append-only logs that must be rewritten safely.

Write strategy:

1. read current file
2. filter targeted lines
3. write a temp file in the same directory
4. `fsync`
5. atomic rename over the original file

### Rollout transcript handling

The rollout file should be moved into the backup bundle instead of being permanently deleted in safe mode.

## Command Surface

### `list`

Show recent sessions with:

- session id
- title
- updated time
- rollout path presence

### `search <query>`

Search sessions by title or id substring.

### `delete`

Supported resolution:

- `delete --id <sessionId>`
- `delete --title <exactTitle>`
- `delete <query>` when it resolves to exactly one session

Safe behavior:

- preview by default
- require `--apply` to actually mutate
- support `--json` output for scripting and future extension use
- support `--yes` to skip confirmation when `--apply` is present

### `restore <backupId>`

Restore a previously deleted session from a backup bundle.

### `doctor`

Validate:

- supported platform
- `sqlite3` availability
- readable and writable Codex paths
- expected schema shape
- WAL presence

## Delete Semantics

### Best-effort activity guard

Because there is no official active-thread API, v1 will refuse delete when any of the following are true:

- target session is the most recently updated thread and was updated within a guard window
- rollout file mtime is within a guard window
- target id matches a rollout file that changed during the delete preflight

The guard window should default to 60 seconds and be configurable.

V1 will not promise perfect active-thread detection. It will promise conservative refusal when a target looks active.

### Backup bundle

Before mutation, create:

- `~/.codex-session-manager/backups/<timestamp>-<session-id>/manifest.json`
- serialized SQLite rows for all affected tables
- removed `session_index.jsonl` lines
- removed `history.jsonl` lines
- moved rollout transcript

### SQLite mutation rules

Delete or detach data in this order inside one transaction:

1. fetch and persist rows for backup
2. delete matching `logs` rows by `thread_id`
3. set `agent_job_items.assigned_thread_id = NULL` where it matches the thread
4. delete from `threads`
5. rely on cascade for `thread_dynamic_tools` and `stage1_outputs`

If the schema differs from the expected shape, abort without mutation.

### JSONL mutation rules

- remove all `session_index.jsonl` lines whose `id` matches the session id
- remove all `history.jsonl` lines whose `session_id` matches the session id
- preserve byte-for-byte copies of removed lines inside the backup bundle

### Rollout mutation rules

- move the rollout file into the backup bundle quarantine area
- keep its original intended restore path in the manifest

## Restore Semantics

Restore should:

1. validate the backup manifest
2. refuse restore if the target id already exists in live storage
3. recreate the rollout parent directories if needed
4. restore the rollout transcript to its original location
5. reinsert SQLite rows in dependency-safe order
6. append back the removed JSONL lines in manifest order

Restore is allowed to be "best effort but explicit". If part of the restore cannot be completed, the CLI must stop and report exactly what was already restored.

## Error Model

The CLI should fail closed in these cases:

- non-macOS platform
- missing `sqlite3`
- unknown Codex schema
- ambiguous title resolution
- target appears active
- backup creation failed
- file rewrite or DB transaction failed

This project should prefer refusing to act over making assumptions.

## Verification Strategy

V1 should use fixture-driven tests instead of mutating the user's real `~/.codex` during normal test runs.

Test fixtures should cover:

- normal delete
- delete preview
- restore after delete
- missing rollout file
- duplicate title search result
- active guard refusal
- schema mismatch refusal
- repeated delete of already deleted session

## UX Notes

- Users may need to refresh or reopen Codex before UI state fully reflects a deletion.
- This should be documented as a known limitation of an unofficial local-store tool.
- The CLI should print what changed in each storage layer after a successful delete.

## Extension Path

The future VS Code extension should call into the same read-only and mutation core instead of reimplementing storage logic.

The extension can add:

- session picker UI
- confirm modal
- restore history view
- output channel for diagnostics

The extension should remain a wrapper around the same tested session-management core.

## Decision Summary

The approved v1 design is:

- TypeScript npm package
- quick run with `npx`
- macOS only
- live safe delete with guardrails
- backup and restore support
- no default hard delete
- no claim of perfect active-thread detection
- extension later, after the CLI is proven in practice
