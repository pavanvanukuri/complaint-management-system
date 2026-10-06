const path = require('path');
const fs = require('fs');

const seedDataPath = path.join(__dirname, 'seedData.json');
let cachedSeedData = null;

function getSeedData() {
  if (!cachedSeedData) {
    if (fs.existsSync(seedDataPath)) {
      try {
        cachedSeedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
      } catch (err) {
        console.error('[Database] Failed to read seedData.json:', err.message);
        cachedSeedData = {};
      }
    } else {
      cachedSeedData = {};
    }
  }
  return cachedSeedData;
}

function initSqlite(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS DEPARTMENT (
      department_id INTEGER PRIMARY KEY,
      department_code TEXT,
      department_name TEXT,
      contact_email TEXT
    );

    CREATE TABLE IF NOT EXISTS CATEGORY (
      category_id INTEGER PRIMARY KEY,
      category_code TEXT,
      category_name TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS STATUS (
      status_id INTEGER PRIMARY KEY,
      status_name TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS PRIORITY (
      priority_id INTEGER PRIMARY KEY,
      priority_name TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS STAFF (
      staff_id INTEGER PRIMARY KEY,
      department_id INTEGER REFERENCES DEPARTMENT(department_id),
      staff_name TEXT,
      email TEXT,
      designation TEXT
    );

    CREATE TABLE IF NOT EXISTS USERS (
      user_id INTEGER PRIMARY KEY,
      registration_no TEXT UNIQUE,
      name TEXT,
      email TEXT,
      phone TEXT,
      department_id INTEGER REFERENCES DEPARTMENT(department_id),
      user_type TEXT
    );

    CREATE TABLE IF NOT EXISTS COMPLAINT (
      complaint_id INTEGER PRIMARY KEY,
      user_id INTEGER REFERENCES USERS(user_id),
      category_id INTEGER REFERENCES CATEGORY(category_id),
      department_id INTEGER REFERENCES DEPARTMENT(department_id),
      staff_id INTEGER REFERENCES STAFF(staff_id),
      priority_id INTEGER REFERENCES PRIORITY(priority_id),
      status_id INTEGER REFERENCES STATUS(status_id),
      subject TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS COMMENTS (
      comment_id INTEGER PRIMARY KEY,
      complaint_id INTEGER REFERENCES COMPLAINT(complaint_id),
      user_id INTEGER REFERENCES USERS(user_id),
      comment_text TEXT,
      comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS NOTIFICATION (
      notification_id INTEGER PRIMARY KEY,
      user_id INTEGER REFERENCES USERS(user_id),
      complaint_id INTEGER REFERENCES COMPLAINT(complaint_id),
      message TEXT,
      read_status TEXT DEFAULT 'Unread'
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM USERS').get();
  if (countRow && countRow.cnt > 0) {
    return;
  }

  const data = getSeedData();
  const insertAll = db.transaction(() => {
    if (Array.isArray(data.department)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO DEPARTMENT (department_id, department_code, department_name, contact_email) VALUES (?, ?, ?, ?)');
      for (const d of data.department) stmt.run(d.department_id, d.department_code, d.department_name, d.contact_email);
    }
    if (Array.isArray(data.category)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO CATEGORY (category_id, category_code, category_name, description) VALUES (?, ?, ?, ?)');
      for (const c of data.category) stmt.run(c.category_id, c.category_code, c.category_name, c.description);
    }
    if (Array.isArray(data.status)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO STATUS (status_id, status_name, description) VALUES (?, ?, ?)');
      for (const s of data.status) stmt.run(s.status_id, s.status_name, s.description);
    }
    if (Array.isArray(data.priority)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO PRIORITY (priority_id, priority_name, description) VALUES (?, ?, ?)');
      for (const p of data.priority) stmt.run(p.priority_id, p.priority_name, p.description);
    }
    if (Array.isArray(data.staff)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO STAFF (staff_id, department_id, staff_name, email, designation) VALUES (?, ?, ?, ?, ?)');
      for (const s of data.staff) stmt.run(s.staff_id, s.department_id, s.staff_name, s.email, s.designation);
    }
    if (Array.isArray(data.users)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO USERS (user_id, registration_no, name, email, phone, department_id, user_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const u of data.users) stmt.run(u.user_id, u.registration_no, u.name, u.email, u.phone, u.department_id, u.user_type);
    }
    if (Array.isArray(data.complaint)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO COMPLAINT (complaint_id, user_id, category_id, department_id, staff_id, priority_id, status_id, subject, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const c of data.complaint) stmt.run(c.complaint_id, c.user_id, c.category_id, c.department_id, c.staff_id, c.priority_id, c.status_id, c.subject, c.description);
    }
    if (Array.isArray(data.comments)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO COMMENTS (comment_id, complaint_id, user_id, comment_text, comment_date) VALUES (?, ?, ?, ?, ?)');
      for (const c of data.comments) stmt.run(c.comment_id, c.complaint_id, c.user_id, c.comment_text, c.comment_date);
    }
    if (Array.isArray(data.notification)) {
      const stmt = db.prepare('INSERT OR IGNORE INTO NOTIFICATION (notification_id, user_id, complaint_id, message, read_status) VALUES (?, ?, ?, ?, ?)');
      for (const n of data.notification) stmt.run(n.notification_id, n.user_id, n.complaint_id, n.message, n.read_status);
    }
  });

  insertAll();
  console.log('[Database] SQLite initialized with seed data successfully.');
}

async function initPostgres(pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS department (
        department_id INTEGER PRIMARY KEY,
        department_code VARCHAR(20),
        department_name VARCHAR(100),
        contact_email VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS category (
        category_id INTEGER PRIMARY KEY,
        category_code VARCHAR(20),
        category_name VARCHAR(100),
        description VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS status (
        status_id INTEGER PRIMARY KEY,
        status_name VARCHAR(50),
        description VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS priority (
        priority_id INTEGER PRIMARY KEY,
        priority_name VARCHAR(50),
        description VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS staff (
        staff_id INTEGER PRIMARY KEY,
        department_id INTEGER REFERENCES department(department_id),
        staff_name VARCHAR(100),
        email VARCHAR(100),
        designation VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        registration_no VARCHAR(20) UNIQUE,
        name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(15),
        department_id INTEGER REFERENCES department(department_id),
        user_type VARCHAR(30)
      );

      CREATE TABLE IF NOT EXISTS complaint (
        complaint_id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id),
        category_id INTEGER REFERENCES category(category_id),
        department_id INTEGER REFERENCES department(department_id),
        staff_id INTEGER REFERENCES staff(staff_id),
        priority_id INTEGER REFERENCES priority(priority_id),
        status_id INTEGER REFERENCES status(status_id),
        subject VARCHAR(150),
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS comments (
        comment_id INTEGER PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaint(complaint_id),
        user_id INTEGER REFERENCES users(user_id),
        comment_text VARCHAR(2000),
        comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notification (
        notification_id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id),
        complaint_id INTEGER REFERENCES complaint(complaint_id),
        message VARCHAR(500),
        read_status VARCHAR(20) DEFAULT 'Unread'
      );
    `);

    const countRes = await client.query('SELECT COUNT(*) AS cnt FROM users');
    if (countRes.rows[0] && Number(countRes.rows[0].cnt) > 0) {
      return;
    }

    const data = getSeedData();
    await client.query('BEGIN');
    try {
      if (Array.isArray(data.department)) {
        for (const d of data.department) {
          await client.query(
            'INSERT INTO department (department_id, department_code, department_name, contact_email) VALUES ($1, $2, $3, $4) ON CONFLICT (department_id) DO NOTHING',
            [d.department_id, d.department_code, d.department_name, d.contact_email]
          );
        }
      }
      if (Array.isArray(data.category)) {
        for (const c of data.category) {
          await client.query(
            'INSERT INTO category (category_id, category_code, category_name, description) VALUES ($1, $2, $3, $4) ON CONFLICT (category_id) DO NOTHING',
            [c.category_id, c.category_code, c.category_name, c.description]
          );
        }
      }
      if (Array.isArray(data.status)) {
        for (const s of data.status) {
          await client.query(
            'INSERT INTO status (status_id, status_name, description) VALUES ($1, $2, $3) ON CONFLICT (status_id) DO NOTHING',
            [s.status_id, s.status_name, s.description]
          );
        }
      }
      if (Array.isArray(data.priority)) {
        for (const p of data.priority) {
          await client.query(
            'INSERT INTO priority (priority_id, priority_name, description) VALUES ($1, $2, $3) ON CONFLICT (priority_id) DO NOTHING',
            [p.priority_id, p.priority_name, p.description]
          );
        }
      }
      if (Array.isArray(data.staff)) {
        for (const s of data.staff) {
          await client.query(
            'INSERT INTO staff (staff_id, department_id, staff_name, email, designation) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (staff_id) DO NOTHING',
            [s.staff_id, s.department_id, s.staff_name, s.email, s.designation]
          );
        }
      }
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          await client.query(
            'INSERT INTO users (user_id, registration_no, name, email, phone, department_id, user_type) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (user_id) DO NOTHING',
            [u.user_id, u.registration_no, u.name, u.email, u.phone, u.department_id, u.user_type]
          );
        }
      }
      if (Array.isArray(data.complaint)) {
        for (const c of data.complaint) {
          await client.query(
            'INSERT INTO complaint (complaint_id, user_id, category_id, department_id, staff_id, priority_id, status_id, subject, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (complaint_id) DO NOTHING',
            [c.complaint_id, c.user_id, c.category_id, c.department_id, c.staff_id, c.priority_id, c.status_id, c.subject, c.description]
          );
        }
      }
      if (Array.isArray(data.comments)) {
        for (const c of data.comments) {
          await client.query(
            'INSERT INTO comments (comment_id, complaint_id, user_id, comment_text, comment_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (comment_id) DO NOTHING',
            [c.comment_id, c.complaint_id, c.user_id, c.comment_text, c.comment_date]
          );
        }
      }
      if (Array.isArray(data.notification)) {
        for (const n of data.notification) {
          await client.query(
            'INSERT INTO notification (notification_id, user_id, complaint_id, message, read_status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (notification_id) DO NOTHING',
            [n.notification_id, n.user_id, n.complaint_id, n.message, n.read_status]
          );
        }
      }
      await client.query('COMMIT');
      console.log('[Database] PostgreSQL initialized with seed data successfully.');
    } catch (seedErr) {
      await client.query('ROLLBACK');
      throw seedErr;
    }
  } finally {
    client.release();
  }
}

async function initDb(dialect, clientOrPool) {
  if (dialect === 'postgres') {
    await initPostgres(clientOrPool);
  } else if (dialect === 'sqlite') {
    initSqlite(clientOrPool);
  }
}

module.exports = {
  initDb,
  initSqlite,
  initPostgres,
  getSeedData,
};
