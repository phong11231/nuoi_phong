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

router.delete('/:id', async (req, res) => {
  const ok = await phoneManager.deletePhone(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json({ success: true });
});

router.put('/:id/proxy', async (req, res) => {
  const { proxy } = req.body;
  if (!proxy) return res.status(400).json({ error: 'Thieu proxy' });
  const phone = await phoneManager.setProxy(req.params.id, proxy);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

router.delete('/:id/proxy', async (req, res) => {
  const phone = await phoneManager.removeProxy(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

module.exports = router;
