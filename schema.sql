CREATE TABLE IF NOT EXISTS students (
  kurs TEXT NOT NULL,
  nick_key TEXT NOT NULL,
  nick TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  apps TEXT NOT NULL DEFAULT '{}',
  progress TEXT NOT NULL DEFAULT '{}',
  fails INTEGER NOT NULL DEFAULT 0,
  share TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kurs, nick_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS students_share ON students (share);
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kurs TEXT NOT NULL,
  nick_key TEXT NOT NULL,
  apps TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_student ON versions (kurs, nick_key, id);
CREATE TABLE IF NOT EXISTS ratings (
  kurs TEXT NOT NULL,
  nick_key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kurs, nick_key)
);
