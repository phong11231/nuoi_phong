const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const phoneRoutes = require('./routes/phones');
const folderRoutes = require('./routes/folders');
const scheduleRoutes = require('./routes/schedule');
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

const scheduleManager = new ScheduleManager();
require('./routes/schedule').setScheduleManager(scheduleManager);

server.listen(PORT, () => {
  console.log(`Server chay tai http://localhost:${PORT}`);
});
