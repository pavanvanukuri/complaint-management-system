const express = require('express');
const router = express.Router();
const { execute } = require('../db');
const { requireAuth, requireRole } = require('../auth');

router.get('/staff', requireAuth, requireRole('faculty', 'staff', 'admin'), async (req, res) => {
  try {
    const result = await execute(
      `SELECT s.staff_id,
              s.department_id,
              s.staff_name,
              s.email,
              s.designation,
              d.department_name
       FROM STAFF s
       JOIN DEPARTMENT d ON d.department_id = s.department_id
       ORDER BY s.staff_name`
    );

    const staff = result.rows.map((row) => ({
      staff_id: row[0],
      department_id: row[1],
      staff_name: row[2],
      email: row[3],
      designation: row[4],
      department_name: row[5],
    }));

    return res.json(staff);
  } catch (error) {
    console.error('Staff lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load staff' });
  }
});

router.get('/staff/:id/complaints', requireAuth, requireRole('faculty', 'staff', 'admin'), async (req, res) => {
  const { id } = req.params;
  const staffId = Number(id);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return res.status(400).json({ message: 'A valid staff ID is required' });
  }

  try {
    if (String(req.auth.role || '').toLowerCase() !== 'admin') {
      const match = await execute(
        `SELECT staff_id FROM STAFF
         WHERE staff_id = :staff_id
           AND LOWER(email) = LOWER(:email)
           AND department_id = :department_id`,
        { staff_id: staffId, email: req.auth.email, department_id: req.auth.department_id }
      );
      if (!match.rows || match.rows.length === 0) {
        return res.status(403).json({ message: 'This staff account is not linked to your user record' });
      }
    }

    const result = await execute(
      `SELECT c.complaint_id,
              c.subject,
              u.name AS user_name,
              cat.category_name,
              d.department_name,
              s.staff_name,
              p.priority_name,
              st.status_name,
              c.description
       FROM COMPLAINT c
       JOIN USERS u ON u.user_id = c.user_id
       JOIN CATEGORY cat ON cat.category_id = c.category_id
       JOIN DEPARTMENT d ON d.department_id = c.department_id
       LEFT JOIN STAFF s ON s.staff_id = c.staff_id
       JOIN PRIORITY p ON p.priority_id = c.priority_id
       JOIN STATUS st ON st.status_id = c.status_id
       WHERE c.staff_id = :staff_id
       ORDER BY c.complaint_id DESC`,
      { staff_id: staffId }
    );

    const complaints = result.rows.map((row) => ({
      complaint_id: row[0],
      subject: row[1],
      user_name: row[2],
      category_name: row[3],
      department_name: row[4],
      staff_name: row[5],
      priority_name: row[6],
      status_name: row[7],
      description: row[8],
    }));

    return res.json(complaints);
  } catch (error) {
    console.error('Staff complaints query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load staff complaints' });
  }
});

module.exports = router;
