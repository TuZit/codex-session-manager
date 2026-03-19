# Codex Session Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS-only TypeScript CLI package that can safely preview, delete, and restore local Codex sessions while Codex may still be open.

**Architecture:** The CLI will treat the local Codex store as a multi-layer data source composed of SQLite, JSONL indexes, and rollout transcript files. Delete will be backup-first and guarded by a conservative activity heuristic; restore will replay the manifest back into each layer.

**Tech Stack:** TypeScript, Node.js, system `sqlite3`, Vitest, npm package bin entry

---

## Chunk 1: Package Scaffold And Fixtures

### Task 1: Create the package skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/cli.ts`

- [ ] **Step 1: Write the failing package smoke test**

Create `test/cli-smoke.test.ts` expecting the CLI to print help when invoked with no args.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`
Expected: FAIL because the package and CLI entry do not exist yet.

- [ ] **Step 3: Add the minimal package scaffold**

Define:

- package name placeholder
- `bin` entry pointing to `dist/cli.js`
- `build`, `test`, and `dev` scripts
- TypeScript compiler config
- basic CLI help text in `src/cli.ts`

- [ ] **Step 4: Run the smoke test again**

Run: `npm test -- --runInBand`
Expected: PASS for the help output test.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .gitignore README.md src/cli.ts test/cli-smoke.test.ts
git commit -m "chore: scaffold codex session manager package"
```

### Task 2: Add fixture support for fake Codex homes

**Files:**
- Create: `test/fixtures/README.md`
- Create: `test/helpers/createFixtureHome.ts`
- Create: `test/fixtures/codex-home-template/`
- Modify: `package.json`

- [ ] **Step 1: Write a failing fixture-path test**

Create `test/fixture-home.test.ts` that expects a helper to materialize a temporary fake Codex home for test runs.

- [ ] **Step 2: Run the fixture test to verify it fails**

Run: `npm test -- --runInBand test/fixture-home.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the fixture helper**

Add a reusable test helper that copies a canned fixture directory into a temp folder and returns the resolved fake Codex home path.

- [ ] **Step 4: Run the fixture test again**

Run: `npm test -- --runInBand test/fixture-home.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json test/fixtures test/helpers test/fixture-home.test.ts
git commit -m "test: add codex home fixture support"
```

## Chunk 2: Read-Only Inspection Commands

### Task 3: Implement Codex home resolution and schema validation

**Files:**
- Create: `src/core/codex-home.ts`
- Create: `src/core/schema.ts`
- Create: `src/core/session-types.ts`
- Test: `test/codex-home.test.ts`
- Test: `test/schema.test.ts`

- [ ] **Step 1: Write failing tests for home resolution and schema checks**

Cover:

- default `~/.codex` resolution on macOS
- `--codex-home` override
- refusal on unsupported platform
- refusal when required files are missing
- refusal when expected SQLite tables or columns are missing

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runInBand test/codex-home.test.ts test/schema.test.ts`
Expected: FAIL because the core modules do not exist.

- [ ] **Step 3: Implement the resolvers and schema guard**

Add functions that:

- resolve Codex paths
- verify presence of `state_5.sqlite`, `session_index.jsonl`, and `history.jsonl`
- inspect SQLite schema through `sqlite3`
- return a typed capability report

- [ ] **Step 4: Run the tests again**

Run: `npm test -- --runInBand test/codex-home.test.ts test/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/codex-home.ts src/core/schema.ts src/core/session-types.ts test/codex-home.test.ts test/schema.test.ts
git commit -m "feat: add codex home and schema validation"
```

### Task 4: Implement session query primitives and `doctor`

**Files:**
- Create: `src/core/sqlite-store.ts`
- Create: `src/core/jsonl-store.ts`
- Create: `src/core/session-query.ts`
- Create: `src/commands/doctor.ts`
- Test: `test/session-query.test.ts`
- Test: `test/doctor.test.ts`

- [ ] **Step 1: Write failing tests for session reads and diagnostics**

Cover:

- listing sessions from SQLite
- enriching rows with rollout and JSONL presence
- reporting `sqlite3` availability
- reporting WAL mode and path checks in `doctor`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --runInBand test/session-query.test.ts test/doctor.test.ts`
Expected: FAIL because the query and doctor code does not exist.

- [ ] **Step 3: Implement read-only store access**

Use the system `sqlite3` binary for:

- thread listing
- session lookup by id
- schema inspection
- WAL mode detection

Use filesystem reads for JSONL and rollout presence checks.

- [ ] **Step 4: Run the tests again**

Run: `npm test -- --runInBand test/session-query.test.ts test/doctor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sqlite-store.ts src/core/jsonl-store.ts src/core/session-query.ts src/commands/doctor.ts test/session-query.test.ts test/doctor.test.ts
git commit -m "feat: add session query and doctor commands"
```

### Task 5: Implement `list` and `search`

**Files:**
- Create: `src/commands/list.ts`
- Create: `src/commands/search.ts`
- Modify: `src/cli.ts`
- Test: `test/list.test.ts`
- Test: `test/search.test.ts`

- [ ] **Step 1: Write failing command tests**

Cover:

- `list` showing recent sessions
- `search` by id substring
- `search` by title substring
- machine-readable `--json` output

- [ ] **Step 2: Run the command tests to verify they fail**

Run: `npm test -- --runInBand test/list.test.ts test/search.test.ts`
Expected: FAIL because the commands are not registered.

- [ ] **Step 3: Implement the commands**

Wire the CLI so these commands call the session query layer and format text and JSON output consistently.

- [ ] **Step 4: Run the command tests again**

Run: `npm test -- --runInBand test/list.test.ts test/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts src/commands/search.ts src/cli.ts test/list.test.ts test/search.test.ts
git commit -m "feat: add list and search commands"
```

## Chunk 3: Safe Delete Engine

### Task 6: Implement backup bundles and rollout quarantine

**Files:**
- Create: `src/core/backup.ts`
- Create: `src/core/rollout-store.ts`
- Test: `test/backup.test.ts`

- [ ] **Step 1: Write failing backup tests**

Cover:

- manifest creation
- backup directory naming
- serializing removed JSONL lines
- moving rollout files into quarantine

- [ ] **Step 2: Run the backup tests to verify they fail**

Run: `npm test -- --runInBand test/backup.test.ts`
Expected: FAIL because the backup layer does not exist.

- [ ] **Step 3: Implement the backup primitives**

Create a backup bundle under `~/.codex-session-manager/backups/<timestamp>-<session-id>/` with:

- `manifest.json`
- SQLite row snapshots
- removed JSONL line files
- quarantined rollout transcript

- [ ] **Step 4: Run the backup tests again**

Run: `npm test -- --runInBand test/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/backup.ts src/core/rollout-store.ts test/backup.test.ts
git commit -m "feat: add backup bundle support"
```

### Task 7: Implement activity guard and delete transaction

**Files:**
- Create: `src/core/activity-guard.ts`
- Modify: `src/core/sqlite-store.ts`
- Modify: `src/core/jsonl-store.ts`
- Create: `src/core/delete-session.ts`
- Test: `test/activity-guard.test.ts`
- Test: `test/delete-session.test.ts`

- [ ] **Step 1: Write failing delete-engine tests**

Cover:

- refusal when a session looks recently active
- deletion of one inactive session
- deletion of related `logs` rows
- nulling `agent_job_items.assigned_thread_id`
- cascade removal of `thread_dynamic_tools`
- removal of all matching `session_index.jsonl` and `history.jsonl` lines
- preservation of removed data in backup

- [ ] **Step 2: Run the delete-engine tests to verify they fail**

Run: `npm test -- --runInBand test/activity-guard.test.ts test/delete-session.test.ts`
Expected: FAIL because the guard and delete engine do not exist.

- [ ] **Step 3: Implement the delete engine**

Implement a service that:

- resolves the target session
- applies the activity guard
- captures backup data
- runs a SQLite transaction that deletes `logs`, nulls `agent_job_items.assigned_thread_id`, and deletes from `threads`
- rewrites JSONL files using temp files and atomic rename
- quarantines the rollout file

- [ ] **Step 4: Run the delete-engine tests again**

Run: `npm test -- --runInBand test/activity-guard.test.ts test/delete-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/activity-guard.ts src/core/delete-session.ts src/core/sqlite-store.ts src/core/jsonl-store.ts test/activity-guard.test.ts test/delete-session.test.ts
git commit -m "feat: add guarded safe delete engine"
```

### Task 8: Implement the `delete` command

**Files:**
- Create: `src/commands/delete.ts`
- Modify: `src/cli.ts`
- Test: `test/delete-command.test.ts`

- [ ] **Step 1: Write failing command tests**

Cover:

- preview mode by default
- `--apply` requirement for mutation
- `--yes` non-interactive apply
- delete by id
- delete by exact title
- refusal on ambiguous search results

- [ ] **Step 2: Run the delete command tests to verify they fail**

Run: `npm test -- --runInBand test/delete-command.test.ts`
Expected: FAIL because the command is not wired.

- [ ] **Step 3: Implement the command**

Make `delete`:

- resolve the target
- print a dry-run summary by default
- require `--apply` for mutation
- print backup id and changed storage layers after success

- [ ] **Step 4: Run the delete command tests again**

Run: `npm test -- --runInBand test/delete-command.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/delete.ts src/cli.ts test/delete-command.test.ts
git commit -m "feat: add delete command"
```

## Chunk 4: Restore And Release Readiness

### Task 9: Implement restore

**Files:**
- Create: `src/core/restore.ts`
- Create: `src/commands/restore.ts`
- Modify: `src/cli.ts`
- Test: `test/restore.test.ts`

- [ ] **Step 1: Write failing restore tests**

Cover:

- restoring a previously deleted session
- refusing restore when the thread id already exists
- restoring rollout files to the original path
- restoring JSONL lines
- restoring deleted SQLite rows

- [ ] **Step 2: Run the restore tests to verify they fail**

Run: `npm test -- --runInBand test/restore.test.ts`
Expected: FAIL because restore does not exist.

- [ ] **Step 3: Implement restore**

Replay the backup manifest into:

- rollout file location
- SQLite tables
- `session_index.jsonl`
- `history.jsonl`

- [ ] **Step 4: Run the restore tests again**

Run: `npm test -- --runInBand test/restore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/restore.ts src/commands/restore.ts src/cli.ts test/restore.test.ts
git commit -m "feat: add restore command"
```

### Task 10: Finish docs and release workflow

**Files:**
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Test: `test/e2e-fixture.test.ts`

- [ ] **Step 1: Write the failing e2e fixture test**

Cover an end-to-end flow:

1. list fixture sessions
2. preview delete
3. apply delete
4. restore the same session

- [ ] **Step 2: Run the e2e test to verify it fails**

Run: `npm test -- --runInBand test/e2e-fixture.test.ts`
Expected: FAIL because not all commands are complete or documented.

- [ ] **Step 3: Finish README and CI**

Document:

- supported scope
- install and `npx` usage
- known limitations
- refresh/reopen expectation for Codex UI
- backup and restore behavior

Add CI for build and test. Add a release workflow suitable for npm publish after the package name is finalized.

- [ ] **Step 4: Run the full verification suite**

Run: `npm test -- --runInBand`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md .github/workflows/ci.yml .github/workflows/release.yml test/e2e-fixture.test.ts
git commit -m "docs: finalize release and usage documentation"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-19-codex-session-manager.md`. Ready to execute?
