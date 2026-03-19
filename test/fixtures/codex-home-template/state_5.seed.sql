PRAGMA foreign_keys = ON;

CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    rollout_path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL,
    sandbox_policy TEXT NOT NULL,
    approval_mode TEXT NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    has_user_event INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    git_sha TEXT,
    git_branch TEXT,
    git_origin_url TEXT,
    cli_version TEXT NOT NULL DEFAULT '',
    first_user_message TEXT NOT NULL DEFAULT '',
    agent_nickname TEXT,
    agent_role TEXT,
    memory_mode TEXT NOT NULL DEFAULT 'enabled'
);

CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    ts_nanos INTEGER NOT NULL,
    level TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT,
    module_path TEXT,
    file TEXT,
    line INTEGER,
    thread_id TEXT,
    process_uuid TEXT,
    estimated_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE thread_dynamic_tools (
    thread_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    input_schema TEXT NOT NULL,
    defer_loading INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(thread_id, position),
    FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE stage1_outputs (
    thread_id TEXT PRIMARY KEY,
    source_updated_at INTEGER NOT NULL,
    raw_memory TEXT NOT NULL,
    rollout_summary TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    rollout_slug TEXT,
    usage_count INTEGER,
    last_usage INTEGER,
    selected_for_phase2 INTEGER NOT NULL DEFAULT 0,
    selected_for_phase2_source_updated_at INTEGER,
    FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

CREATE TABLE agent_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    instruction TEXT NOT NULL,
    output_schema_json TEXT,
    input_headers_json TEXT NOT NULL,
    input_csv_path TEXT NOT NULL,
    output_csv_path TEXT NOT NULL,
    auto_export INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    last_error TEXT,
    max_runtime_seconds INTEGER
);

CREATE TABLE agent_job_items (
    job_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    source_id TEXT,
    row_json TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_thread_id TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    result_json TEXT,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,
    reported_at INTEGER,
    PRIMARY KEY (job_id, item_id),
    FOREIGN KEY(job_id) REFERENCES agent_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_logs_thread_id ON logs(thread_id);
CREATE INDEX idx_thread_dynamic_tools_thread ON thread_dynamic_tools(thread_id);
CREATE INDEX idx_stage1_outputs_source_updated_at ON stage1_outputs(source_updated_at DESC, thread_id DESC);
CREATE INDEX idx_agent_jobs_status ON agent_jobs(status, updated_at DESC);
CREATE INDEX idx_agent_job_items_status ON agent_job_items(job_id, status, row_index ASC);

INSERT INTO threads (
    id,
    rollout_path,
    created_at,
    updated_at,
    source,
    model_provider,
    cwd,
    title,
    sandbox_policy,
    approval_mode,
    tokens_used,
    has_user_event,
    archived,
    cli_version,
    first_user_message,
    memory_mode
) VALUES (
    '019test-thread-0001',
    '/FAKE-CODEX-HOME/sessions/2026/03/01/rollout-2026-03-01T09-00-00-019test-thread-0001.jsonl',
    1772326800,
    1772327100,
    'vscode',
    'openai',
    '/tmp/fixture-project',
    'Fixture Session',
    'workspace-write',
    'default',
    42,
    1,
    0,
    '0.116.0-alpha.1',
    'help me test',
    'enabled'
);

INSERT INTO logs (
    ts,
    ts_nanos,
    level,
    target,
    message,
    thread_id,
    process_uuid,
    estimated_bytes
) VALUES (
    1772327060,
    0,
    'info',
    'codex.fixture',
    'fixture log line',
    '019test-thread-0001',
    'fixture-process-1',
    128
);

INSERT INTO thread_dynamic_tools (
    thread_id,
    position,
    name,
    description,
    input_schema,
    defer_loading
) VALUES (
    '019test-thread-0001',
    0,
    'shell',
    'Run shell commands',
    '{"type":"object"}',
    0
);

INSERT INTO stage1_outputs (
    thread_id,
    source_updated_at,
    raw_memory,
    rollout_summary,
    generated_at,
    rollout_slug,
    usage_count,
    last_usage,
    selected_for_phase2,
    selected_for_phase2_source_updated_at
) VALUES (
    '019test-thread-0001',
    1772327100,
    '{}',
    'Fixture summary',
    1772327200,
    'fixture-rollout',
    1,
    1772327200,
    0,
    NULL
);

INSERT INTO agent_jobs (
    id,
    name,
    status,
    instruction,
    output_schema_json,
    input_headers_json,
    input_csv_path,
    output_csv_path,
    auto_export,
    created_at,
    updated_at,
    started_at,
    completed_at,
    last_error,
    max_runtime_seconds
) VALUES (
    'job-fixture-1',
    'fixture-job',
    'completed',
    'fixture',
    NULL,
    '[]',
    '/tmp/in.csv',
    '/tmp/out.csv',
    1,
    1772327000,
    1772327200,
    1772327000,
    1772327200,
    NULL,
    NULL
);

INSERT INTO agent_job_items (
    job_id,
    item_id,
    row_index,
    source_id,
    row_json,
    status,
    assigned_thread_id,
    attempt_count,
    result_json,
    last_error,
    created_at,
    updated_at,
    completed_at,
    reported_at
) VALUES (
    'job-fixture-1',
    'item-1',
    0,
    'source-1',
    '{}',
    'completed',
    '019test-thread-0001',
    1,
    '{}',
    NULL,
    1772327000,
    1772327200,
    1772327200,
    1772327200
);
