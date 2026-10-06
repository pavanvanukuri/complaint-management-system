const express = require('express');
const router = express.Router();
const { execute } = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await execute(
      `SELECT user_id, registration_no, name, email, phone, department_id, user_type
       FROM USERS
       ORDER BY name`
    );

    const users = result.rows.map((row) => ({
      user_id: row[0],
      registration_no: row[1],
      name: row[2],
      email: row[3],
      phone: row[4],
      department_id: row[5],
      user_type: row[6],
    }));

    return res.json(users);
  } catch (error) {
    console.error('User lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load users' });
  }
});

router.get('/users/:id/complaints', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'A valid user ID is required' });
  }

  const role = String(req.auth?.role || '').toLowerCase();
  if (!req.auth) {
    return res.status(401).json({ message: 'Authentication is required' });
  }
  if (role === 'student' && Number(req.auth.user_id) !== userId) {
    return res.status(403).json({ message: 'You can only view your own complaints' });
  }
  if (!['student', 'faculty', 'staff', 'admin'].includes(role)) {
    return res.status(403).json({ message: 'You are not authorized to view complaints' });
  }

  const departmentFilter = role === 'admin' || role === 'student' ? '' : 'AND owner.department_id = :department_id';
  const binds = { user_id: userId };
  if (departmentFilter) binds.department_id = req.auth.department_id;

  try {
    const result = await execute(
      `SELECT c.complaint_id,
              c.subject,
              cat.category_name,
              d.department_name,
              NVL(s.staff_name, 'Unassigned') AS staff_name,
              p.priority_name,
              st.status_name,
              c.description,
              c.user_id,
              c.status_id,
              c.priority_id
       FROM COMPLAINT c
            JOIN USERS owner ON owner.user_id = c.user_id
       JOIN CATEGORY cat ON cat.category_id = c.category_id
       JOIN DEPARTMENT d ON d.department_id = c.department_id
       LEFT JOIN STAFF s ON s.staff_id = c.staff_id
       JOIN PRIORITY p ON p.priority_id = c.priority_id
       JOIN STATUS st ON st.status_id = c.status_id
      WHERE c.user_id = :user_id
      ${departmentFilter}
       ORDER BY c.complaint_id DESC`,
          binds
    );

    const complaints = result.rows.map((row) => ({
      complaint_id: row[0],
      subject: row[1],
      category_name: row[2],
      department_name: row[3],
      staff_name: row[4],
      priority_name: row[5],
      status_name: row[6],
      description: row[7],
      user_id: row[8],
      status_id: row[9],
      priority_id: row[10],
    }));

    return res.json(complaints);
  } catch (error) {
    console.error('User complaints query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load user complaints' });
  }
});

module.exports = router;
