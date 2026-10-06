const express = require('express');
const router = express.Router();
const { execute, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { createNotification } = require('../notificationService');

function parsePositiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getAccessibleComplaint(req, complaintId) {
  const result = await execute(
    `SELECT user_id, department_id FROM COMPLAINT WHERE complaint_id = :complaint_id`,
    { complaint_id: complaintId }
  );
  if (!result.rows || result.rows.length === 0) return { status: 404 };

  const [ownerId, departmentId] = result.rows[0];
  const role = String(req.auth.role || '').toLowerCase();
  if (role === 'student' && Number(req.auth.user_id) !== Number(ownerId)) return { status: 403 };
  if (['faculty', 'staff'].includes(role) && Number(req.auth.department_id) !== Number(departmentId)) return { status: 403 };
  if (!['student', 'faculty', 'staff', 'admin'].includes(role)) return { status: 403 };
  return { ownerId };
}

router.get('/complaints/:id/comments', requireAuth, async (req, res) => {
  const { id } = req.params;
  const complaintId = parsePositiveId(id);
  if (!complaintId) return res.status(400).json({ message: 'A valid complaint ID is required' });

  try {
    const access = await getAccessibleComplaint(req, complaintId);
    if (access.status) {
      return res.status(access.status).json({ message: access.status === 404 ? 'Complaint not found' : 'You are not authorized to view these comments' });
    }

    const result = await execute(
      `SELECT c.comment_id,
              c.comment_text,
              c.comment_date,
              u.user_id,
              u.name AS user_name
       FROM COMMENTS c
       JOIN USERS u ON u.user_id = c.user_id
       WHERE c.complaint_id = :complaint_id
       ORDER BY c.comment_date DESC`,
      { complaint_id: complaintId }
    );

    const comments = result.rows.map((row) => ({
      comment_id: row[0],
      comment_text: row[1],
      comment_date: row[2],
      user_id: row[3],
      user_name: row[4],
    }));

    return res.json(comments);
  } catch (error) {
    console.error('Comment load failed:', error.message);
    return res.status(500).json({ message: 'Unable to load comments' });
  }
});

router.post('/complaints/:id/comments', requireAuth, async (req, res) => {
  const { id } = req.params;
  const complaintId = parsePositiveId(id);
  const commentText = String((req.body || {}).comment_text || '').trim();

  if (!complaintId || !commentText) {
    return res.status(400).json({ message: 'A valid complaint ID and comment_text are required' });
  }
  if (commentText.length > 2000) return res.status(400).json({ message: 'Comment exceeds the allowed length' });

  try {
    const access = await getAccessibleComplaint(req, complaintId);
    if (access.status) {
      return res.status(access.status).json({ message: access.status === 404 ? 'Complaint not found' : 'You are not authorized to comment on this complaint' });
    }

    const commentId = await withTransaction(async (connection) => {
      await connection.execute('LOCK TABLE COMMENTS IN EXCLUSIVE MODE');
      const nextResult = await connection.execute(
        `SELECT NVL(MAX(COMMENT_ID), 0) + 1 AS NEXT_ID
         FROM COMMENTS`
      );
      const nextId = nextResult.rows[0][0];
      await connection.execute(
        `INSERT INTO COMMENTS (
          comment_id,
          complaint_id,
          user_id,
          comment_text,
          comment_date
        ) VALUES (
          :comment_id,
          :complaint_id,
          :user_id,
          :comment_text,
          SYSDATE
        )`,
        {
          comment_id: nextId,
          complaint_id: complaintId,
          user_id: Number(req.auth.user_id),
          comment_text: commentText,
        }
      );
      return nextId;
    });

    if (Number(req.auth.user_id) !== Number(access.ownerId)) {
      try {
        await createNotification(access.ownerId, complaintId, `A new comment was added to complaint #${complaintId}.`);
      } catch (notificationError) {
        console.error('Comment notification creation failed:', notificationError.message);
      }
    }

    return res.status(201).json({
      comment_id: commentId,
      complaint_id: complaintId,
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Comment creation failed:', error.message);
    return res.status(500).json({ message: 'Unable to add comment' });
  }
});

module.exports = router;
