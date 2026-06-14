PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  date TEXT NOT NULL,
  iso_date TEXT NOT NULL,
  time TEXT NOT NULL,
  kickoff TEXT NOT NULL,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  group_name TEXT,
  status TEXT NOT NULL,
  result_home INTEGER,
  result_away INTEGER,
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  match_number INTEGER NOT NULL,
  source_order TEXT NOT NULL,
  source_match_number INTEGER NOT NULL,
  predicted_home INTEGER,
  predicted_away INTEGER,
  points INTEGER,
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  FOREIGN KEY (match_id) REFERENCES matches(id),
  UNIQUE (participant_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_participant_id
  ON predictions(participant_id);

CREATE INDEX IF NOT EXISTS idx_predictions_match_id
  ON predictions(match_id);

CREATE INDEX IF NOT EXISTS idx_matches_number
  ON matches(number);
