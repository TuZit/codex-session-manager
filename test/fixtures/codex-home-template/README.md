# Codex Home Fixture Template

This directory is a canonical fake Codex home used by tests.

Contents:

- `session_index.jsonl` for session listing and search coverage
- `history.jsonl` for history filtering coverage
- `sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl` for rollout-path coverage
- `state_5.seed.sql` for bootstrapping the SQLite store later

The SQLite seed uses `/FAKE-CODEX-HOME` as a placeholder root path so test helpers can rewrite it when copying the fixture into a temp directory.
