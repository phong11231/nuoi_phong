const crypto = require('crypto');

const ADMIN_USER = 'chetraulamay';
const ADMIN_PASS_HASH = 'db9d8294bcd230b33684b241d4825fe2ab04a2c9aa4e53da88810903f3adf9eb';

const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function login(username, password) {
  if (username !== ADMIN_USER) return null;
  if (hashPassword(password) !== ADMIN_PASS_HASH) return null;

  const token = generateToken();
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

function verifyToken(token) {
  return sessions.has(token);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Chua dang nhap' });
  }
  next();
}

module.exports = { login, verifyToken, authMiddleware };
