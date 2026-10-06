const express = require('express');
const router = express.Router();
const { execute } = require('../db');
const { requireAuth } = require('../auth');

router.get('/users/:id/notifications', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'A valid user ID is required' });
  }
  if (userId !== Number(req.auth.user_id)) {
    return res.status(403).json({ message: 'You can only view your own notifications' });
  }

  try {
    const result = await execute(
      `SELECT notification_id,
              complaint_id,
              message,
              read_status
       FROM NOTIFICATION
       WHERE user_id = :user_id
       ORDER BY notification_id DESC`,
      { user_id: Number(id) }
    );

    const notifications = result.rows.map((row) => ({
      notification_id: row[0],
      complaint_id: row[1],
      message: row[2],
      read_status: row[3],
    }));

    return res.json(notifications);
  } catch (error) {
    console.error('Notification lookup failed:', error.message);
    return res.status(500).json({ message: 'Unable to load notifications' });
  }
});

router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: 'A valid notification ID is required' });
  }

  try {
    const result = await execute(
      `UPDATE NOTIFICATION
       SET read_status = 'Read'
       WHERE notification_id = :notification_id
         AND user_id = :user_id`,
      { notification_id: notificationId, user_id: Number(req.auth.user_id) }
    );
    if (!result.rowsAffected) return res.status(404).json({ message: 'Notification not found' });

    return res.json({
      notification_id: notificationId,
      read_status: 'Read',
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Notification update failed:', error.message);
    return res.status(500).json({ message: 'Unable to update notification' });
  }
});

module.exports = router;
