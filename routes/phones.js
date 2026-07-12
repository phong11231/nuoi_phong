const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { phoneManager } = require('../services/phone-manager');
const { authMiddleware } = require('../services/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 100 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(phoneManager.getAllPhones());
});

router.post('/', (req, res) => {
  const { name, folderId, type } = req.body;
  const phone = phoneManager.createPhone(name, folderId, type);
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

router.get('/:id/check-proxy/:index', async (req, res) => {
  const phone = phoneManager.getPhone(req.params.id);
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone' });
  const index = parseInt(req.params.index);
  if (!phone.proxyList || index < 0 || index >= phone.proxyList.length) {
    return res.status(400).json({ error: 'Index proxy sai' });
  }

  const http = require('http');
  const proxyStr = phone.proxyList[index];
  const parts = proxyStr.split(':');
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
});

router.put('/:id/proxy/switch', async (req, res) => {
  const { index } = req.body;
  if (index === undefined) return res.status(400).json({ error: 'Thieu index' });
  const phone = await phoneManager.switchProxy(req.params.id, parseInt(index));
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone hoac index sai' });
  res.json(phone);
});

router.delete('/:id/proxy/:index', async (req, res) => {
  const phone = phoneManager.removeProxyFromList(req.params.id, parseInt(req.params.index));
  if (!phone) return res.status(404).json({ error: 'Khong tim thay phone hoac index sai' });
  res.json(phone);
});

// Media upload/list/delete
router.post('/:id/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thieu file' });
  const phone = phoneManager.getPhone(req.params.id);
  if (!phone) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Khong tim thay phone' }); }
  if (phone.status !== 'running') { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Phone chua chay' }); }
  try {
    const entry = await phoneManager.pushMedia(req.params.id, req.file.path, req.file.originalname);
    fs.unlinkSync(req.file.path);
    if (!entry) return res.status(500).json({ error: 'Loi upload' });
    res.json(entry);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/media', (req, res) => {
  const media = phoneManager.getMedia(req.params.id);
  if (media === null) return res.status(404).json({ error: 'Khong tim thay phone' });
  res.json(media);
});

router.delete('/:id/media/:filename', async (req, res) => {
  const result = await phoneManager.deleteMedia(req.params.id, decodeURIComponent(req.params.filename));
  if (!result) return res.status(404).json({ error: 'Khong tim thay file hoac phone' });
  res.json({ success: true });
});

module.exports = router;
