const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { initDb } = require('./initDb');

dotenv.config();

let activeDialect = null;
let pgPool = null;
let sqliteDb = null;
let oraclePool = null;

function getDialect() {
  if (activeDialect) return activeDialect;

  if (process.env.DB_DIALECT) {
    return process.env.DB_DIALECT.toLowerCase();
  }
  if (process.env.DATABASE_URL) {
    if (process.env.DATABASE_URL.startsWith('sqlite')) {
      return 'sqlite';
    }
    return 'postgres';
  }
  if (process.env.DB_CONNECT_STRING) {
    return 'oracle';
  }
  return 'sqlite';
}

function translateSql(sql, dialect) {
  let cleanSql = sql.replace(/\s+FROM\s+DUAL\b/gi, '');
  cleanSql = cleanSql.replace(/\bNVL\s*\(/gi, 'COALESCE(');
  cleanSql = cleanSql.replace(/\bSYSDATE\b/gi, 'CURRENT_TIMESTAMP');
  cleanSql = cleanSql.replace(/\bTO_CHAR\s*\(\s*([^)]+)\s*\)/gi, 'CAST($1 AS TEXT)');
  cleanSql = cleanSql.replace(/FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY/gi, 'LIMIT $1');

  if (dialect === 'sqlite') {
    if (/^\s*LOCK\s+TABLE\b/i.test(cleanSql)) {
      return { isLock: true, sql: cleanSql };
    }
  }

  return { isLock: false, sql: cleanSql };
}

function translateBindsForPostgres(sql, binds) {
  const { sql: translatedSql } = translateSql(sql, 'postgres');
  let pgSql = translatedSql;

  if (binds && typeof binds === 'object' && !Array.isArray(binds)) {
    const values = [];
    const keyMap = {};
    pgSql = pgSql.replace(/:([a-zA-Z0-9_]+)/g, (match, paramName) => {
      if (binds[paramName] === undefined) return match;
      if (!keyMap[paramName]) {
        values.push(binds[paramName]);
        keyMap[paramName] = values.length;
      }
      return '$' + keyMap[paramName];
    });
    return { sql: pgSql, values };
  }

  return { sql: pgSql, values: binds || [] };
}

async function initSqliteDriver() {
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'cms.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  initDb('sqlite', sqliteDb);
  activeDialect = 'sqlite';
  console.log(`[Database] SQLite connected at ${dbPath}`);
  return sqliteDb;
}

async function initPostgresDriver() {
  const { Pool } = require('pg');
  const connectionString = process.env.DATABASE_URL;

  const poolConfig = {
    connectionString,
  };

  const isRemote =
    (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) ||
    process.env.NODE_ENV === 'production';

  if (isRemote) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pgPool = new Pool(poolConfig);
  await initDb('postgres', pgPool);
  activeDialect = 'postgres';
  console.log('[Database] PostgreSQL connected successfully.');
  return pgPool;
}

async function initOracleDriver() {
  const oracledb = require('oracledb');
  const missingConfig = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']
    .filter((name) => !process.env[name]);

  if (missingConfig.length) {
    throw new Error(`Missing required Oracle environment variables: ${missingConfig.join(', ')}`);
  }

  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
    queueRequests: true,
    queueTimeout: 30000,
  };

  oraclePool = await oracledb.createPool(config);
  activeDialect = 'oracle';
  console.log('[Database] Oracle DB connected successfully.');
  return oraclePool;
}

async function initPool() {
  const targetDialect = getDialect();

  if (targetDialect === 'postgres') {
    try {
      return await initPostgresDriver();
    } catch (err) {
      console.error('[Database] Failed to connect to PostgreSQL:', err.message);
      console.warn('[Database] Falling back to embedded SQLite...');
      return await initSqliteDriver();
    }
  }

  if (targetDialect === 'oracle') {
    try {
      return await initOracleDriver();
    } catch (err) {
      console.error('[Database] Failed to connect to Oracle DB:', err.message);
      console.warn('[Database] Falling back to embedded SQLite...');
      return await initSqliteDriver();
    }
  }

  return await initSqliteDriver();
}

async function getPool() {
  const dialect = getDialect();
  if (dialect === 'postgres' && !pgPool) await initPool();
  if (dialect === 'sqlite' && !sqliteDb) await initPool();
  if (dialect === 'oracle' && !oraclePool) await initPool();

  return {
    getConnection: async () => ({
      execute: (sql, binds, options) => execute(sql, binds, options),
      close: async () => {},
    }),
  };
}

async function execute(sql, binds = {}, options = {}) {
  const dialect = activeDialect || getDialect();

  if (dialect === 'postgres') {
    if (!pgPool) await initPool();
    const { sql: pgSql, values } = translateBindsForPostgres(sql, binds);
    const result = await pgPool.query({ text: pgSql, values, rowMode: 'array' });
    return {
      rows: result.rows,
      rowsAffected: result.rowCount || 0,
    };
  }

  if (dialect === 'sqlite') {
    if (!sqliteDb) await initPool();
    const { isLock, sql: sqliteSql } = translateSql(sql, 'sqlite');
    if (isLock) {
      return { rows: [], rowsAffected: 0 };
    }

    const stmt = sqliteDb.prepare(sqliteSql);
    if (stmt.reader) {
      const rows = stmt.raw(true).all(binds || {});
      return {
        rows,
        rowsAffected: rows.length,
      };
    } else {
      const info = stmt.run(binds || {});
      return {
        rows: [],
        rowsAffected: info.changes,
      };
    }
  }

  if (dialect === 'oracle') {
    if (!oraclePool) await initPool();
    const oracledb = require('oracledb');
    const connection = await oraclePool.getConnection();
    try {
      const executionOptions = {
        autoCommit: true,
        ...options,
      };
      return await connection.execute(sql, binds, executionOptions);
    } finally {
      await connection.close();
    }
  }

  throw new Error(`Unsupported database dialect: ${dialect}`);
}

async function withTransaction(action) {
  const dialect = activeDialect || getDialect();

  if (dialect === 'postgres') {
    if (!pgPool) await initPool();
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const connWrapper = {
        execute: async (sql, binds) => {
          const { sql: pgSql, values } = translateBindsForPostgres(sql, binds);
          const result = await client.query({ text: pgSql, values, rowMode: 'array' });
          return {
            rows: result.rows,
            rowsAffected: result.rowCount || 0,
          };
        },
      };
      const result = await action(connWrapper);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('PostgreSQL rollback error:', rollbackErr.message);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  if (dialect === 'sqlite') {
    if (!sqliteDb) await initPool();
    sqliteDb.exec('BEGIN IMMEDIATE');
    try {
      const connWrapper = {
        execute: async (sql, binds) => {
          const { isLock, sql: sqliteSql } = translateSql(sql, 'sqlite');
          if (isLock) return { rows: [], rowsAffected: 0 };
          const stmt = sqliteDb.prepare(sqliteSql);
          if (stmt.reader) {
            const rows = stmt.raw(true).all(binds || {});
            return { rows, rowsAffected: rows.length };
          } else {
            const info = stmt.run(binds || {});
            return { rows: [], rowsAffected: info.changes };
          }
        },
      };
      const result = await action(connWrapper);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        sqliteDb.exec('ROLLBACK');
      } catch (rollbackErr) {
        console.error('SQLite rollback error:', rollbackErr.message);
      }
      throw error;
    }
  }

  if (dialect === 'oracle') {
    if (!oraclePool) await initPool();
    const connection = await oraclePool.getConnection();
    try {
      const result = await action(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Oracle database rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      await connection.close();
    }
  }

  throw new Error(`Unsupported database dialect: ${dialect}`);
}

function isOracleLockedError(err) {
  return err && (err.errorNum === 28000 || String(err.message || '').includes('ORA-28000'));
}

module.exports = {
  getDialect,
  initPool,
  getPool,
  execute,
  withTransaction,
  isOracleLockedError,
};
