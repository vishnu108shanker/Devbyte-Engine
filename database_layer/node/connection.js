const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

function getPool() {
  if (!pool && DATABASE_URL) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

module.exports = {
  getPool,
};
