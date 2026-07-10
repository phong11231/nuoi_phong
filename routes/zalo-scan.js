const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/auth');
const { ZaloScanner } = require('../services/zalo-scanner');

const scanner = new ZaloScanner();

router.use(authMiddleware);

router.get('/status', (req, res) => {
  res.json(scanner.getStatus());
});

router.get('/results', (req, res) => {
  const grouped = scanner.getResultsByKeyword();
  res.json({
    total: scanner.results.length,
    grouped,
    all: scanner.results
  });
});

router.post('/start', async (req, res) => {
  if (scanner.running) {
    return res.json({ error: 'Dang quet, vui long cho...' });
  }

  const { keywords } = req.body;
  if (!keywords || !keywords.length) {
    return res.json({ error: 'Chua nhap tu khoa' });
  }

  if (!scanner.zaloCredentials) {
    return res.json({ error: 'Chua dang nhap Zalo. Nhap cookie truoc.' });
  }

  res.json({ ok: true, message: 'Bat dau brute-force...' });

  scanner.start(keywords).catch(err => {
    console.error('Loi scanner:', err.message);
  });
});

router.post('/stop', (req, res) => {
  scanner.stop();
  res.json({ ok: true });
});

router.post('/clear', (req, res) => {
  scanner.clear();
  res.json({ ok: true });
});

// Proxy
router.post('/proxy', (req, res) => {
  const { proxy } = req.body;
  if (proxy && !/^[\w.\-]+:\d{1,5}(:\S+:\S+)?$/.test(proxy)) {
    return res.json({ error: 'Sai format. Dung: host:port:user:pass' });
  }
  scanner.setProxy(proxy || null);
  res.json({ ok: true, proxy: proxy || null });
});

router.delete('/proxy', (req, res) => {
  scanner.setProxy(null);
  res.json({ ok: true });
});

router.get('/check-ip', async (req, res) => {
  const result = await scanner.checkIP();
  res.json(result);
});

// Zalo login (cookie)
router.post('/zalo-login', (req, res) => {
  const { cookie, imei } = req.body;
  if (!cookie) {
    return res.json({ error: 'Nhap cookie Zalo' });
  }
  scanner.setZaloCredentials({ cookie, imei: imei || 'browser' });
  res.json({ ok: true, message: 'Da luu cookie Zalo' });
});

router.delete('/zalo-login', (req, res) => {
  scanner.setZaloCredentials(null);
  res.json({ ok: true });
});

router.get('/export', (req, res) => {
  const { keyword } = req.query;
  let data = scanner.results;

  if (keyword && keyword.trim()) {
    const k = keyword.toLowerCase().trim();
    data = data.filter(r => r.name.toLowerCase().includes(k));
  }

  let csv = '﻿Ten nhom,Link,Nguon\n';
  for (const r of data) {
    csv += `"${r.name.replace(/"/g, '""')}","${r.link}","${r.source}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=nhom-zalo-${keyword || 'all'}.csv`);
  res.send(csv);
});

module.exports = router;
