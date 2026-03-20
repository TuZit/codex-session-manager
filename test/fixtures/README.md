# Test Fixtures

`codex-home-template/` is the canonical fake Codex home used by the early test suite.

- Copy it into a temp directory before each test that needs a writable Codex home.
- Materialize `state_5.sqlite` from `state_5.seed.sql` inside the copied temp home.
- Derive broken or partial variants from the temp copy instead of duplicating fixture trees in git.
