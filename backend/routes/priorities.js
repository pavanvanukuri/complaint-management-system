const express = require('express');
const router = express.Router();
const { execute } = require('../db');

router.get('/priorities', async (req, res) => {
  try {
    const result = await execute(
      `SELECT priority_id, priority_name, description
       FROM PRIORITY
       ORDER BY priority_id`
    );

    const priorities = result.rows.map((row) => ({
      priority_id: row[0],
      priority_name: row[1],
      description: row[2],
    }));

    return res.json(priorities);
  } catch (error) {
    console.error('Priority lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load priorities' });
  }
});

module.exports = router;
