const fs = require('fs');
const path = require('path');
const { getPool } = require('../database_layer/node/connection');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(PROJECT_ROOT, 'data', 'history.json');
const CANDIDATE_PATH = path.join(PROJECT_ROOT, 'data', 'selected_tool.json');

async function updateHistory() {
  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8') || '[]');
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
  candidate.published_at = new Date().toISOString();

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO publications (candidate_id, published_at, event_type, candidate_snapshot)
         VALUES ($1, $2, $3, $4)`,
        [
          candidate.id,
          candidate.published_at,
          candidate.event_type || 'update',
          candidate
        ]
      );
      console.log(`[DB] Recorded publication for '${candidate.id}' in PostgreSQL.`);
    } catch (dbErr) {
      console.error(`[DB] Database write failed, continuing JSON write: ${dbErr.message}`);
    } finally {
      try {
        await pool.end();
      } catch (closeErr) {
        console.error(`[DB] Failed to close PostgreSQL pool: ${closeErr.message}`);
      }
    }
  } else {
    console.warn('[DB] DATABASE_URL is not configured, continuing JSON write.');
  }

  history.push(candidate);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
}

updateHistory().catch((err) => {
  console.error(`[History] Update failed: ${err.message}`);
  process.exitCode = 1;
});
