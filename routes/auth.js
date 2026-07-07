const express = require('express');
const router = express.Router();
const { login } = require('../services/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Thieu tai khoan hoac mat khau' });
  }

  const token = login(username, password);
  if (!token) {
    return res.status(401).json({ error: 'Sai tai khoan hoac mat khau' });
  }

  res.json({ token });
});

module.exports = router;
