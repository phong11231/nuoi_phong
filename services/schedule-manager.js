const { phoneManager } = require('./phone-manager');
const fs = require('fs');
const path = require('path');

const SCHED_FILE = path.join(__dirname, '..', 'schedule-data.json');

class ScheduleManager {
  constructor() {
    this.config = {
      enabled: false,
      phonesPerBatch: 3,
      runMinutes: 30,
      restMinutes: 10,
    };
    this.currentBatch = [];
    this.rotationIndex = 0;
    this.timer = null;
    this.phase = 'idle';
    this._loadState();
  }

  _loadState() {
    try {
      if (fs.existsSync(SCHED_FILE)) {
        const data = JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'));
        this.config = { ...this.config, ...data.config };
        this.rotationIndex = data.rotationIndex || 0;
        if (this.config.enabled) {
          console.log('[Schedule] Phuc hoi schedule tu file, tu dong bat lai');
          this.start();
        }
      }
    } catch (e) {
      console.error('[Schedule] Loi load state:', e.message);
    }
  }

  _saveState() {
    try {
      fs.writeFileSync(SCHED_FILE, JSON.stringify({
        config: this.config,
        rotationIndex: this.rotationIndex,
      }, null, 2));
    } catch (e) {}
  }

  updateConfig(config) {
    if (config.phonesPerBatch) this.config.phonesPerBatch = config.phonesPerBatch;
    if (config.runMinutes) this.config.runMinutes = config.runMinutes;
    if (config.restMinutes) this.config.restMinutes = config.restMinutes;
    if (typeof config.enabled !== 'undefined') this.config.enabled = config.enabled;
    this._saveState();
    return this.config;
  }

  getConfig() {
    return this.config;
  }

  getStatus() {
    return {
      config: this.config,
      currentBatch: this.currentBatch,
      phase: this.phase,
      rotationIndex: this.rotationIndex,
    };
  }

  start() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.config.enabled = true;
    this._saveState();
    console.log(`[Schedule] Bat dau luan phien: ${this.config.phonesPerBatch} phone/luot, chay ${this.config.runMinutes}p, nghi ${this.config.restMinutes}p`);
    this._startBatch();
  }

  stop() {
    this.config.enabled = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.phase = 'idle';
    this._saveState();
    console.log('[Schedule] Da tat luan phien');
  }

  async _startBatch() {
    if (!this.config.enabled) return;
    this.phase = 'running';

    const allPhones = phoneManager.getAllPhones();
    if (allPhones.length === 0) {
      console.log('[Schedule] Khong co phone nao');
      this.stop();
      return;
    }

    // Tat batch cu
    for (const id of this.currentBatch) {
      const phone = phoneManager.getPhone(id);
      if (phone && phone.status === 'running') {
        await phoneManager.stopPhone(id);
        console.log(`[Schedule] Tat ${phone.name}`);
      }
    }
    this.currentBatch = [];

    // Chon batch moi theo round-robin
    const batchSize = Math.min(this.config.phonesPerBatch, allPhones.length);
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = (this.rotationIndex + i) % allPhones.length;
      batch.push(allPhones[idx]);
    }
    this.rotationIndex = (this.rotationIndex + batchSize) % allPhones.length;
    this._saveState();

    // Bat batch moi
    for (const phone of batch) {
      if (phone.status !== 'running') {
        await phoneManager.startPhone(phone.id);
      }
      // Re-apply proxy neu co
      if (phone.proxy && phone.status === 'running') {
        await phoneManager.setProxy(phone.id, phone.proxy);
      }
      this.currentBatch.push(phone.id);
      console.log(`[Schedule] Bat ${phone.name}`);
    }

    console.log(`[Schedule] Batch ${batch.map(p => p.name).join(', ')} - chay ${this.config.runMinutes} phut`);

    // Hen gio tat sau runMinutes
    this.timer = setTimeout(() => {
      this._restPhase();
    }, this.config.runMinutes * 60 * 1000);
  }

  async _restPhase() {
    if (!this.config.enabled) return;
    this.phase = 'resting';

    // Tat batch hien tai
    for (const id of this.currentBatch) {
      const phone = phoneManager.getPhone(id);
      if (phone && phone.status === 'running') {
        await phoneManager.stopPhone(id);
        console.log(`[Schedule] Tat ${phone.name}`);
      }
    }

    console.log(`[Schedule] Nghi ${this.config.restMinutes} phut...`);

    // Hen gio bat batch moi sau restMinutes
    this.timer = setTimeout(() => {
      this._startBatch();
    }, this.config.restMinutes * 60 * 1000);
  }
}

module.exports = { ScheduleManager };
