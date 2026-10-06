const oracledb = require('oracledb');
const dotenv = require('dotenv');

dotenv.config();

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

let pool;

async function initPool() {
  if (!pool) {
    const missingConfig = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']
      .filter((name) => !process.env[name]);
    if (missingConfig.length) {
      throw new Error(`Missing required environment variables: ${missingConfig.join(', ')}`);
    }
    pool = await oracledb.createPool(config);
  }
  return pool;
}

async function getPool() {
  if (!pool) {
    await initPool();
  }
  return pool;
}

async function execute(sql, binds = [], options = {}) {
  const dbPool = await getPool();
  const connection = await dbPool.getConnection();

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

async function withTransaction(action) {
  const dbPool = await getPool();
  const connection = await dbPool.getConnection();

  try {
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Database rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    await connection.close();
  }
}

function isOracleLockedError(err) {
  return err && (err.errorNum === 28000 || String(err.message || '').includes('ORA-28000'));
}

module.exports = {
  oracledb,
  initPool,
  getPool,
  execute,
  withTransaction,
  isOracleLockedError,
};
