const express = require('express');
const router = express.Router();
const { execute } = require('../db');

router.get('/categories', async (req, res) => {
  try {
    const result = await execute(
      `SELECT category_id, category_code, category_name, description
       FROM CATEGORY
       ORDER BY category_name`
    );

    const categories = result.rows.map((row) => ({
      category_id: row[0],
      category_code: row[1],
      category_name: row[2],
      description: row[3],
    }));

    return res.json(categories);
  } catch (error) {
    console.error('Category lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load categories' });
  }
});

module.exports = router;
