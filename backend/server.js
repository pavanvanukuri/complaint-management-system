const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { initPool, getPool, isOracleLockedError } = require('./db');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port number');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/departments'));
app.use('/api', require('./routes/categories'));
app.use('/api', require('./routes/statuses'));
app.use('/api', require('./routes/priorities'));
app.use('/api', require('./routes/staff'));
app.use('/api', require('./routes/users'));
app.use('/api', require('./routes/complaints'));
app.use('/api', require('./routes/comments'));
app.use('/api', require('./routes/notifications'));

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/api/health', async (req, res) => {
  let connection;

  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    const result = await connection.execute('SELECT 1 AS RESULT FROM DUAL');

    if (!result.rows || !result.rows.length) {
      return res.status(500).json({
        status: 'error',
        oracle: 'not_connected',
        message: 'Oracle query returned no data.',
      });
    }

    return res.status(200).json({
      status: 'ok',
      oracle: 'connected',
      databaseUser: process.env.DB_USER || null,
      connectString: process.env.DB_CONNECT_STRING || null,
      result: result.rows[0][0],
    });
  } catch (error) {
    if (isOracleLockedError(error)) {
      return res.status(401).json({
        status: 'error',
        oracle: 'locked',
        message: 'CMSUSER is locked in Oracle. Unlock the account and retry.',
      });
    }

    console.error('Oracle health check failed:', error.message);
    return res.status(500).json({
      status: 'error',
      oracle: 'not_connected',
      message: 'Unable to connect to Oracle',
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Database close failed:', closeError.message);
      }
    }
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body contains malformed JSON' });
  }
  console.error('Unhandled request error:', error.message);
  return res.status(500).json({ message: 'Internal server error' });
});

async function startServer() {
  await initPool();

  const server = app.listen(PORT, () => {
    console.log(`Complaint Management System listening on port ${PORT}`);
  });
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. No additional server was started.`);
    } else {
      console.error('Server failed to listen:', error.message);
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
