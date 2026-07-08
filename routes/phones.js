const express = require('express');
const router = express.Router();
const { phoneManager } = require('../services/phone-manager');
const { authMiddleware } = require('../services/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(phoneManager.getAllPhones());
});

router.post('/', (req, res) => {
  const { name, folderId } = req.body;
  const phone = phoneManager.createPhone(name, folderId);
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
  if (!/^[\w.\-]+:\d{1,5}(:\S+:\S+)?$/.test(proxy)) {
    return res.status(400).json({ error: 'Sai format proxy (host:port hoac host:port:user:pass)' });
  }
  const phone = await phoneManager.setProxy(req.params.id, proxy);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

router.get('/:id/check-proxy', async (req, res) => {
  const phone = phoneManager.getPhone(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  if (phone.status !== 'running') return res.status(400).json({ error: 'Phone chua chay' });

  const http = require('http');
  const net = require('net');
  const url = require('url');

  if (phone.proxy) {
    const parts = phone.proxy.split(':');
    const host = parts[0], port = parseInt(parts[1]), user = parts[2], pass = parts[3];
    const proxyHeaders = {};
    if (user && pass) {
      proxyHeaders['Proxy-Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    }
    const proxyReq = http.request({
      host: host, port: port, method: 'GET', path: 'http://api.ipify.org/',
      headers: { ...proxyHeaders, Host: 'api.ipify.org' },
      timeout: 10000,
    }, (proxyRes) => {
      let body = '';
      proxyRes.on('data', d => body += d);
      proxyRes.on('end', () => res.json({ ip: body.trim() }));
    });
    proxyReq.on('error', () => res.json({ error: 'Khong kiem tra duoc IP' }));
    proxyReq.on('timeout', () => { proxyReq.destroy(); res.json({ error: 'Timeout' }); });
    proxyReq.end();
  } else {
    http.get('http://api.ipify.org/', { timeout: 10000 }, (r) => {
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => res.json({ ip: body.trim() }));
    }).on('error', () => res.json({ error: 'Khong kiem tra duoc IP' }));
  }
});

router.delete('/:id/proxy', async (req, res) => {
  const phone = await phoneManager.removeProxy(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(phone);
});

module.exports = router;
