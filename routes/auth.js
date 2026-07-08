const express = require('express');
const router = express.Router();
const { login } = require('../services/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Thieu tai khoan hoac mat khau' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const result = login(username, password, ip);
  if (!result) {
    return res.status(401).json({ error: 'Sai tai khoan hoac mat khau' });
  }
  if (result.error === 'lockout') {
    return res.status(429).json({ error: `Qua nhieu lan thu. Cho ${result.remaining} phut` });
  }

  res.json({ token: result.token });
});

module.exports = router;
