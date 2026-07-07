const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/auth');

let scheduleManager = null;

function setScheduleManager(sm) {
  scheduleManager = sm;
}

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(scheduleManager.getStatus());
});

router.put('/', (req, res) => {
  const config = scheduleManager.updateConfig(req.body);
  if (req.body.enabled) {
    scheduleManager.start();
  } else {
    scheduleManager.stop();
  }
  res.json(config);
});

module.exports = router;
module.exports.setScheduleManager = setScheduleManager;
