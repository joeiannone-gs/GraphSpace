/** Migration n brings the schema from version n to n + 1. Never edit a shipped migration; add one. */
export const migrations: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  -- Full project documents, content-addressed (sha256 of the JSON), gzipped.
  CREATE TABLE snapshots (
    hash TEXT PRIMARY KEY,
    doc BLOB NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    default_branch_id TEXT,
    forked_from TEXT,
    lesson_id TEXT,
    thumb TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX projects_owner ON projects(owner_id, deleted_at, updated_at);

  -- Each branch has its own autosaved working copy; version guards against lost updates.
  CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    head_commit_id TEXT,
    working_doc BLOB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (project_id, name)
  );

  CREATE TABLE commits (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL,
    parent_id TEXT,
    snapshot_hash TEXT NOT NULL REFERENCES snapshots(hash),
    thumb TEXT NOT NULL,
    message TEXT NOT NULL,
    author_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX commits_project ON commits(project_id, created_at);

  -- Groups a user saved as reusable nodes ("Nodes" in My GraphSpace).
  CREATE TABLE library_nodes (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    subtree BLOB NOT NULL,
    thumb TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX library_owner ON library_nodes(owner_id);
  `,
];
