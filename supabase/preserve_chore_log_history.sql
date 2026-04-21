-- Preserve chore log history when a chore is deleted.
-- Previously ON DELETE CASCADE wiped all logs, destroying scoreboard points and achievements.
-- Now chore_id is set to NULL on deletion so history survives.

ALTER TABLE chore_logs DROP CONSTRAINT chore_logs_chore_id_fkey;
ALTER TABLE chore_logs ALTER COLUMN chore_id DROP NOT NULL;
ALTER TABLE chore_logs ADD CONSTRAINT chore_logs_chore_id_fkey
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE SET NULL;
