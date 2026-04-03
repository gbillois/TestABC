-- Schéma de la base de données D1 pour les scores du Casse-Briques
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Index pour accélérer le classement
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
