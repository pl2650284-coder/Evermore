const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let database;

function getDatabasePath() {
  return path.resolve(
    process.env.DB_PATH || path.join(__dirname, 'data', 'love-museum.sqlite')
  );
}

function getDatabase() {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  return database;
}

function normalizeSql(sql) {
  return sql.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
}

function normalizeParameter(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }

  return value;
}

async function query(sql, params = []) {
  const normalizedSql = normalizeSql(sql);
  const statement = getDatabase().prepare(normalizedSql);
  const normalizedParams = params.map(normalizeParameter);

  if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(normalizedSql)) {
    return [statement.all(...normalizedParams), []];
  }

  const result = statement.run(...normalizedParams);
  return [{
    affectedRows: result.changes,
    insertId: Number(result.lastInsertRowid),
  }, []];
}

const pool = {
  query,
  execute: query,
  async getConnection() {
    return {
      query,
      execute: query,
      release() {},
      async end() {},
    };
  },
  async end() {
    closeDatabase();
  },
};

async function testConnection() {
  try {
    getDatabase().prepare('SELECT 1').get();
    console.log(`SQLite database ready: ${getDatabasePath()}`);
    return true;
  } catch (error) {
    console.error('SQLite connection failed:', error.message);
    return false;
  }
}

function closeDatabase() {
  if (!database) {
    return;
  }

  database.close();
  database = undefined;
}

module.exports = {
  pool,
  testConnection,
  getDatabase,
  getDatabasePath,
  closeDatabase,
};
