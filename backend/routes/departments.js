const express = require('express');
const router = express.Router();
const { execute } = require('../db');

router.get('/departments', async (req, res) => {
  try {
    const result = await execute(
      `SELECT department_id, department_code, department_name, contact_email
       FROM DEPARTMENT
       ORDER BY department_name`
    );

    const departments = result.rows.map((row) => ({
      department_id: row[0],
      department_code: row[1],
      department_name: row[2],
      contact_email: row[3],
    }));

    return res.json(departments);
  } catch (error) {
    console.error('Department lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load departments' });
  }
});

module.exports = router;
