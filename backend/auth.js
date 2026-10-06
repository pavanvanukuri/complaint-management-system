const crypto = require('crypto');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

const tokenSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const tokenLifetimeMs = 8 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', tokenSecret).update(value).digest('base64url');
}

function issueToken(user) {
  const payload = Buffer.from(JSON.stringify({
    user_id: user.user_id,
    role: String(user.user_type || '').trim().toLowerCase(),
    department_id: user.department_id,
    email: user.email,
    expires_at: Date.now() + tokenLifetimeMs,
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);

  if (!match) {
    return res.status(401).json({ message: 'Authentication is required' });
  }

  const [payload, signature] = match[1].split('.');
  const expectedSignature = sign(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }

  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(Number(user.user_id)) || !user.expires_at || user.expires_at <= Date.now()) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    req.auth = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function requireRole(...roles) {
  const allowedRoles = roles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ message: 'Authentication is required' });
    }

    if (!allowedRoles.includes(String(req.auth.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'You are not authorized to perform this action' });
    }

    return next();
  };
}

module.exports = { issueToken, requireAuth, requireRole };