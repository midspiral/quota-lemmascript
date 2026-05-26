-- D1 registry (the only global, cross-DO state). Booking data lives in the
-- per-page Durable Object; this is just accounts + the vanity-URL namespace.

CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  name  TEXT NOT NULL
);

-- Unique public handles (usernames). PRIMARY KEY enforces global uniqueness;
-- one row per claimed handle, owned by an email.
CREATE TABLE IF NOT EXISTS handles (
  handle TEXT PRIMARY KEY,
  email  TEXT NOT NULL
);

-- Vanity (username, pagename) -> opaque page_id. The DO is addressed by page_id,
-- so renaming a page/handle here never moves the DO.
CREATE TABLE IF NOT EXISTS pages (
  username TEXT NOT NULL,
  pagename TEXT NOT NULL,
  page_id  TEXT NOT NULL,
  title    TEXT NOT NULL,
  PRIMARY KEY (username, pagename)
);

CREATE INDEX IF NOT EXISTS pages_by_user ON pages (username);
