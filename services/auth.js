const crypto = require('crypto');

const ADMIN_USER = 'chetraulamay';
const ADMIN_PASS_HASH = 'db9d8294bcd230b33684b241d4825fe2ab04a2c9aa4e53da88810903f3adf9eb';
const SESSION_TTL = 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const sessions = new Map();
const loginAttempts = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function login(username, password, ip) {
  const key = ip || 'unknown';
  const attempts = loginAttempts.get(key);
  if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS && Date.now() - attempts.lastAttempt < LOCKOUT_MS) {
    return { error: 'lockout', remaining: Math.ceil((LOCKOUT_MS - (Date.now() - attempts.lastAttempt)) / 60000) };
  }

  if (username !== ADMIN_USER || hashPassword(password) !== ADMIN_PASS_HASH) {
    const current = loginAttempts.get(key) || { count: 0 };
    current.count++;
    current.lastAttempt = Date.now();
    loginAttempts.set(key, current);
    return null;
  }

  loginAttempts.delete(key);
  const token = generateToken();
  sessions.set(token, { username, createdAt: Date.now() });
  return { token };
}

function verifyToken(token) {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Chua dang nhap' });
  }
  next();
}

module.exports = { login, verifyToken, authMiddleware };
