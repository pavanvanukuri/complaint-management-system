const express = require('express');
const router = express.Router();
const { execute } = require('../db');
const { issueToken } = require('../auth');

router.post('/login', async (req, res) => {
  const registrationNo = String((req.body || {}).registration_no || '').trim();

  if (!registrationNo) {
    return res.status(400).json({ message: 'Registration number is required' });
  }

  try {
    const result = await execute(
      `SELECT USER_ID,
              REGISTRATION_NO,
              NAME,
              EMAIL,
              PHONE,
              DEPARTMENT_ID,
              USER_TYPE
       FROM USERS
       WHERE REGISTRATION_NO = :registration_no`,
      { registration_no: registrationNo }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const row = result.rows[0];
    const user = {
      user_id: row[0],
      registration_no: row[1],
      name: row[2],
      email: row[3],
      phone: row[4],
      department_id: row[5],
      user_type: row[6],
      role: String(row[6] || '').trim(),
    };

    return res.status(200).json({ ...user, access_token: issueToken(user) });
  } catch (error) {
    console.error('Login query failed:', error.message);
    return res.status(500).json({ message: 'Login failed' });
  }
});

module.exports = router;
