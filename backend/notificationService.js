const { withTransaction } = require('./db');

async function createNotification(userId, complaintId, message) {
  return withTransaction(async (connection) => {
    await connection.execute('LOCK TABLE NOTIFICATION IN EXCLUSIVE MODE');
    const nextResult = await connection.execute(
      `SELECT NVL(MAX(NOTIFICATION_ID), 0) + 1 AS NEXT_ID
       FROM NOTIFICATION`
    );
    const notificationId = nextResult.rows[0][0];

    await connection.execute(
      `INSERT INTO NOTIFICATION (
        notification_id,
        user_id,
        complaint_id,
        message,
        read_status
      ) VALUES (
        :notification_id,
        :user_id,
        :complaint_id,
        :message,
        'Unread'
      )`,
      {
        notification_id: notificationId,
        user_id: Number(userId),
        complaint_id: Number(complaintId),
        message: String(message).trim(),
      }
    );

    return notificationId;
  });
}

module.exports = { createNotification };