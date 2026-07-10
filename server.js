const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const phoneRoutes = require('./routes/phones');
const folderRoutes = require('./routes/folders');
const scheduleRoutes = require('./routes/schedule');
const zaloScanRoutes = require('./routes/zalo-scan');
const { ScheduleManager } = require('./services/schedule-manager');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/phones', phoneRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/zalo-scan', zaloScanRoutes);

const os = require('os');
const { authMiddleware } = require('./services/auth');
app.get('/api/system', authMiddleware, async (req, res) => {
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMB = totalMB - freeMB;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const uptimeSec = os.uptime();
  // Doc swap tu /proc/meminfo
  let swap = { total: 0, free: 0, used: 0, percent: 0 };
  try {
    const fs = require('fs');
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const swapTotal = parseInt((meminfo.match(/SwapTotal:\s+(\d+)/) || [])[1] || '0');
    const swapFree = parseInt((meminfo.match(/SwapFree:\s+(\d+)/) || [])[1] || '0');
    const swapTotalMB = Math.round(swapTotal / 1024);
    const swapFreeMB = Math.round(swapFree / 1024);
    const swapUsedMB = swapTotalMB - swapFreeMB;
    swap = { total: swapTotalMB, free: swapFreeMB, used: swapUsedMB, percent: swapTotalMB ? Math.round(swapUsedMB / swapTotalMB * 100) : 0 };
  } catch (e) {}
  res.json({
    ram: { total: totalMB, free: freeMB, used: usedMB, percent: Math.round(usedMB / totalMB * 100) },
    swap,
    cpu: { cores: cpus.length, model: cpus[0] ? cpus[0].model.trim() : '', load1m: loadAvg[0].toFixed(2) },
    uptime: uptimeSec,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

const scheduleManager = new ScheduleManager();
require('./routes/schedule').setScheduleManager(scheduleManager);

server.listen(PORT, () => {
  console.log(`Server chay tai http://localhost:${PORT}`);
});
