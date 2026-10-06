const express = require('express');
const router = express.Router();
const { execute } = require('../db');

router.get('/statuses', async (req, res) => {
  try {
    const result = await execute(
      `SELECT status_id, status_name, description
       FROM STATUS
       ORDER BY status_id`
    );

    const statuses = result.rows.map((row) => ({
      status_id: row[0],
      status_name: row[1],
      description: row[2],
    }));

    return res.json(statuses);
  } catch (error) {
    console.error('Status lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load statuses' });
  }
});

module.exports = router;
