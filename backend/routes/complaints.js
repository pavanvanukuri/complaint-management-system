const express = require('express');
const router = express.Router();
const { execute, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { createNotification } = require('../notificationService');

function parsePositiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getLookupId(tableName, idColumn, nameColumn, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (!Number.isNaN(Number(value))) {
    const numericValue = Number(value);
    const exists = await execute(
      `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} = :id_value`,
      { id_value: numericValue }
    );

    if (exists.rows && exists.rows.length > 0) {
      return numericValue;
    }
  }

  const result = await execute(
    `SELECT ${idColumn}
     FROM ${tableName}
     WHERE LOWER(${nameColumn}) = LOWER(:label)
     FETCH FIRST 1 ROWS ONLY`,
    { label: String(value).trim() }
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error(`No match found in ${tableName} for '${value}'`);
  }

  return result.rows[0][0];
}

async function getStatusIdByName(statusValue) {
  if (statusValue === null || statusValue === undefined || statusValue === '') {
    return null;
  }

  if (!Number.isNaN(Number(statusValue))) {
    const statusId = parsePositiveId(statusValue);
    if (!statusId) throw new Error('A valid status is required');
    const result = await execute(
      `SELECT status_id FROM STATUS WHERE status_id = :status_id`,
      { status_id: statusId }
    );
    if (!result.rows || result.rows.length === 0) throw new Error('Status not found');
    return statusId;
  }

  const result = await execute(
    `SELECT status_id
     FROM STATUS
     WHERE LOWER(status_name) = LOWER(:status_name)
     FETCH FIRST 1 ROWS ONLY`,
    { status_name: String(statusValue).trim() }
  );

  if (!result.rows || result.rows.length === 0) {
    throw new Error(`Status '${statusValue}' not found in STATUS table`);
  }

  return result.rows[0][0];
}

router.get('/complaints', requireAuth, requireRole('faculty', 'staff', 'admin'), async (req, res) => {
  const { status, priority, department, category, userId } = req.query;
  const whereClauses = [];
  const binds = {};
  const role = String(req.auth.role || '').toLowerCase();

  for (const [label, value] of Object.entries({ status, priority, department, category, userId })) {
    if (value !== undefined && !parsePositiveId(value)) {
      return res.status(400).json({ message: `Invalid ${label} filter` });
    }
  }

  if (status) {
    whereClauses.push('st.status_id = :status_id');
    binds.status_id = Number(status);
  }

  if (priority) {
    whereClauses.push('p.priority_id = :priority_id');
    binds.priority_id = Number(priority);
  }

  if (department) {
    whereClauses.push('d.department_id = :department_id');
    binds.department_id = Number(department);
  }

  if (category) {
    whereClauses.push('cat.category_id = :category_id');
    binds.category_id = Number(category);
  }

  if (userId) {
    whereClauses.push('c.user_id = :user_id');
    binds.user_id = Number(userId);
  }

  if (role !== 'admin') {
    if (!parsePositiveId(req.auth.department_id)) {
      return res.status(403).json({ message: 'No department is assigned to this account' });
    }
    if (department && Number(department) !== Number(req.auth.department_id)) {
      return res.status(403).json({ message: 'You can only view complaints in your department' });
    }
    whereClauses.push('c.department_id = :auth_department_id');
    binds.auth_department_id = Number(req.auth.department_id);
  }

  const search = String(req.query.search || '').trim();
  if (search) {
    if (search.length > 100) return res.status(400).json({ message: 'Search text is too long' });
    whereClauses.push('(LOWER(c.subject) LIKE LOWER(:search) OR LOWER(u.name) LIKE LOWER(:search) OR TO_CHAR(c.complaint_id) LIKE :search)');
    binds.search = `%${search}%`;
  }

  const whereText = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const result = await execute(
      `SELECT c.complaint_id,
              u.name AS user_name,
              cat.category_name,
              d.department_name,
              NVL(s.staff_name, 'Unassigned') AS staff_name,
              p.priority_name,
              st.status_name,
              c.subject,
              c.description,
              c.user_id,
              c.department_id,
              c.category_id,
              c.priority_id,
              c.status_id
       FROM COMPLAINT c
      JOIN USERS u ON u.user_id = c.user_id
       JOIN CATEGORY cat ON cat.category_id = c.category_id
       JOIN DEPARTMENT d ON d.department_id = c.department_id
       LEFT JOIN STAFF s ON s.staff_id = c.staff_id
       JOIN PRIORITY p ON p.priority_id = c.priority_id
       JOIN STATUS st ON st.status_id = c.status_id
       ${whereText}
       ORDER BY c.complaint_id DESC`,
      binds
    );

    const complaints = result.rows.map((row) => ({
      complaint_id: row[0],
      user_name: row[1],
      category_name: row[2],
      department_name: row[3],
      staff_name: row[4],
      priority_name: row[5],
      status_name: row[6],
      subject: row[7],
      description: row[8],
      user_id: row[9],
      department_id: row[10],
      category_id: row[11],
      priority_id: row[12],
      status_id: row[13],
    }));

    return res.json(complaints);
  } catch (error) {
    console.error('Complaint list query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load complaints' });
  }
});

router.get('/complaints/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const complaintId = parsePositiveId(id);
  if (!complaintId) return res.status(400).json({ message: 'A valid complaint ID is required' });

  try {
    const result = await execute(
      `SELECT c.complaint_id,
              c.user_id,
              u.name AS user_name,
              c.category_id,
              cat.category_name,
              c.department_id,
              d.department_name,
              c.staff_id,
              NVL(s.staff_name, 'Unassigned') AS staff_name,
              c.priority_id,
              p.priority_name,
              c.status_id,
              st.status_name,
              c.subject,
              c.description
       FROM COMPLAINT c
       JOIN USERS u ON u.user_id = c.user_id
       JOIN CATEGORY cat ON cat.category_id = c.category_id
       JOIN DEPARTMENT d ON d.department_id = c.department_id
       LEFT JOIN STAFF s ON s.staff_id = c.staff_id
       JOIN PRIORITY p ON p.priority_id = c.priority_id
       JOIN STATUS st ON st.status_id = c.status_id
       WHERE c.complaint_id = :complaint_id`,
      { complaint_id: complaintId }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const row = result.rows[0];
    const role = String(req.auth.role || '').toLowerCase();
    if (role === 'student' && Number(req.auth.user_id) !== Number(row[1])) {
      return res.status(403).json({ message: 'You can only track your own complaints' });
    }
    if (['faculty', 'staff'].includes(role) && Number(req.auth.department_id) !== Number(row[5])) {
      return res.status(403).json({ message: 'You can only track complaints in your department' });
    }
    if (!['student', 'faculty', 'staff', 'admin'].includes(role)) {
      return res.status(403).json({ message: 'You are not authorized to track complaints' });
    }

    return res.json({
      complaint_id: row[0],
      user_id: row[1],
      user_name: row[2],
      category_id: row[3],
      category_name: row[4],
      department_id: row[5],
      department_name: row[6],
      staff_id: row[7],
      staff_name: row[8],
      priority_id: row[9],
      priority_name: row[10],
      status_id: row[11],
      status_name: row[12],
      subject: row[13],
      description: row[14],
    });
  } catch (error) {
    console.error('Complaint detail query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load complaint' });
  }
});

router.post('/complaints', requireAuth, requireRole('student'), async (req, res) => {
  const body = req.body || {};
  const {
    subject,
    description,
    category,
    priority,
    department,
  } = body;
  const cleanSubject = String(subject || '').trim();
  const cleanDescription = String(description || '').trim();

  if (!cleanSubject || !cleanDescription || !String(category || '').trim() || !String(priority || '').trim() || !String(department || '').trim()) {
    return res.status(400).json({ message: 'All complaint fields are required' });
  }
  if (cleanSubject.length > 200 || cleanDescription.length > 4000) {
    return res.status(400).json({ message: 'Subject or description exceeds the allowed length' });
  }

  try {
    const categoryId = await getLookupId('CATEGORY', 'category_id', 'category_name', category);
    const departmentId = await getLookupId('DEPARTMENT', 'department_id', 'department_name', department);
    const priorityId = await getLookupId('PRIORITY', 'priority_id', 'priority_name', priority);
    const pendingStatusId = await getStatusIdByName('Pending');

    const userId = parsePositiveId(req.auth.user_id);
    if (!userId) return res.status(401).json({ message: 'Invalid user session' });

    const userResult = await execute(
      `SELECT user_id FROM USERS WHERE user_id = :user_id`,
      { user_id: userId }
    );
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(401).json({ message: 'The logged-in user no longer exists' });
    }

    const complaintId = await withTransaction(async (connection) => {
      await connection.execute('LOCK TABLE COMPLAINT IN EXCLUSIVE MODE');
      const nextResult = await connection.execute(
        `SELECT NVL(MAX(COMPLAINT_ID), 0) + 1 AS NEXT_ID
         FROM COMPLAINT`
      );
      const nextId = nextResult.rows[0][0];
      await connection.execute(
        `INSERT INTO COMPLAINT (
          complaint_id,
          user_id,
          category_id,
          department_id,
          staff_id,
          priority_id,
          status_id,
          subject,
          description
        ) VALUES (
          :complaint_id,
          :user_id,
          :category_id,
          :department_id,
          NULL,
          :priority_id,
          :status_id,
          :subject,
          :description
        )`,
        {
          complaint_id: nextId,
          user_id: userId,
          category_id: categoryId,
          department_id: departmentId,
          priority_id: priorityId,
          status_id: pendingStatusId,
          subject: cleanSubject,
          description: cleanDescription,
        }
      );
      return nextId;
    });

    let notificationId = null;
    try {
      notificationId = await createNotification(userId, complaintId, `Your complaint #${complaintId} has been received.`);
    } catch (notificationError) {
      console.error('Complaint notification creation failed:', notificationError.message);
    }

    return res.status(201).json({
      complaint_id: complaintId,
      notification_id: notificationId,
      message: `Complaint submitted successfully with ID ${complaintId}`,
    });
  } catch (error) {
    const isLookupError = /No match found|Status .* not found|valid status/i.test(error.message || '');
    if (isLookupError) return res.status(400).json({ message: error.message });
    console.error('Complaint creation failed:', error.message);
    return res.status(500).json({ message: 'Complaint creation failed' });
  }
});

router.put('/complaints/:id/status', requireAuth, requireRole('faculty', 'staff', 'admin'), async (req, res) => {
  const { id } = req.params;
  const complaintId = parsePositiveId(id);
  const body = req.body || {};
  const { status_id, status_name } = body;
  if (!complaintId) return res.status(400).json({ message: 'A valid complaint ID is required' });
  if (status_id === undefined && !String(status_name || '').trim()) {
    return res.status(400).json({ message: 'A status is required' });
  }

  try {
    const resolvedStatusId = status_id !== undefined ? Number(status_id) : await getStatusIdByName(status_name);
    if (!parsePositiveId(resolvedStatusId)) return res.status(400).json({ message: 'A valid status is required' });
    const statusResult = await execute(
      `SELECT status_name FROM STATUS WHERE status_id = :status_id`,
      { status_id: resolvedStatusId }
    );
    if (!statusResult.rows || statusResult.rows.length === 0) {
      return res.status(400).json({ message: 'Status not found' });
    }

    const complaintResult = await execute(
      `SELECT user_id, department_id, status_id FROM COMPLAINT WHERE complaint_id = :complaint_id`,
      { complaint_id: complaintId }
    );

    if (!complaintResult.rows || complaintResult.rows.length === 0) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const role = String(req.auth.role || '').toLowerCase();
    if (role !== 'admin' && Number(req.auth.department_id) !== Number(complaintResult.rows[0][1])) {
      return res.status(403).json({ message: 'You can only update complaints in your department' });
    }
    if (Number(complaintResult.rows[0][2]) === resolvedStatusId) {
      return res.json({ complaint_id: complaintId, status_id: resolvedStatusId, message: 'Complaint already has this status' });
    }

    await execute(
      `UPDATE COMPLAINT
       SET status_id = :status_id
       WHERE complaint_id = :complaint_id`,
      {
        status_id: resolvedStatusId,
        complaint_id: complaintId,
      }
    );

    const statusName = statusResult.rows[0][0];
    try {
      await createNotification(
        complaintResult.rows[0][0],
        complaintId,
        `The status of complaint #${complaintId} changed to ${statusName}.`
      );
    } catch (notificationError) {
      console.error('Status notification creation failed:', notificationError.message);
    }

    return res.json({
      complaint_id: complaintId,
      status_id: resolvedStatusId,
      message: 'Complaint status updated successfully',
    });
  } catch (error) {
    if (/Status .* not found|valid status/i.test(error.message || '')) return res.status(400).json({ message: error.message });
    console.error('Complaint status update failed:', error.message);
    return res.status(500).json({ message: 'Unable to update complaint status' });
  }
});

router.put('/complaints/:id/assign', requireAuth, requireRole('faculty', 'staff', 'admin'), async (req, res) => {
  const { id } = req.params;
  const complaintId = parsePositiveId(id);
  const staffId = parsePositiveId((req.body || {}).staff_id);

  if (!complaintId || !staffId) {
    return res.status(400).json({ message: 'Valid complaint_id and staff_id are required' });
  }

  try {
    const complaintResult = await execute(
      `SELECT c.department_id,
              s.department_id AS staff_department_id,
              c.user_id,
              c.staff_id
       FROM COMPLAINT c
       JOIN STAFF s ON s.staff_id = :staff_id
       WHERE c.complaint_id = :complaint_id`,
      { complaint_id: complaintId, staff_id: staffId }
    );

    if (!complaintResult.rows || complaintResult.rows.length === 0) {
      return res.status(404).json({ message: 'Complaint or staff member not found' });
    }

    const row = complaintResult.rows[0];
    const role = String(req.auth.role || '').toLowerCase();
    if (role !== 'admin' && Number(req.auth.department_id) !== Number(row[0])) {
      return res.status(403).json({ message: 'You can only assign complaints in your department' });
    }
    if (row[0] !== row[1]) {
      return res.status(400).json({
        message: 'Staff member must belong to the same department as the complaint.',
      });
    }
    if (Number(row[3]) === staffId) {
      return res.json({ complaint_id: complaintId, staff_id: staffId, message: 'Complaint is already assigned to this staff member' });
    }

    await execute(
      `UPDATE COMPLAINT
       SET staff_id = :staff_id
       WHERE complaint_id = :complaint_id`,
      {
        staff_id: staffId,
        complaint_id: complaintId,
      }
    );

    try {
      await createNotification(
        row[2],
        complaintId,
        `Complaint #${complaintId} has been assigned to a staff member.`
      );
    } catch (notificationError) {
      console.error('Assignment notification creation failed:', notificationError.message);
    }

    return res.json({
      complaint_id: complaintId,
      staff_id: staffId,
      message: 'Complaint assigned successfully',
    });
  } catch (error) {
    console.error('Complaint assignment failed:', error.message);
    return res.status(500).json({ message: 'Unable to assign complaint' });
  }
});

module.exports = router;
