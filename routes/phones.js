const express = require('express');
const router = express.Router();
const { phoneManager } = require('../services/phone-manager');
const { authMiddleware } = require('../services/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(phoneManager.getAllPhones());
});

router.post('/', (req, res) => {
  const { name } = req.body;
  const phone = phoneManager.createPhone(name);
  res.status(201).json(phone);
});

router.get('/:id', (req, res) => {
  const phone = phoneManager.getPhone(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

router.post('/:id/start', async (req, res) => {
  const phone = await phoneManager.startPhone(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

router.post('/:id/stop', async (req, res) => {
  const phone = await phoneManager.stopPhone(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

router.delete('/:id', (req, res) => {
  const ok = phoneManager.deletePhone(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json({ success: true });
});

router.put('/:id/proxy', (req, res) => {
  const { host, port, username, password, type } = req.body;
  const proxy = { host, port, username, password, type: type || 'socks5' };
  const phone = phoneManager.setProxy(req.params.id, proxy);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

module.exports = router;
