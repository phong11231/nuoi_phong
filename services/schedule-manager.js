const { phoneManager } = require('./phone-manager');

class ScheduleManager {
  constructor() {
    this.config = {
      enabled: false,
      phonesPerBatch: 3,
      runMinutes: 30,
      restMinutes: 10,
    };
    this.currentBatch = [];
    this.queue = [];
    this.timer = null;
  }

  updateConfig(config) {
    Object.assign(this.config, config);
    return this.config;
  }

  getConfig() {
    return this.config;
  }

  getStatus() {
    return {
      config: this.config,
      currentBatch: this.currentBatch,
      queueLength: this.queue.length,
    };
  }

  start() {
    if (!this.config.enabled) return;
    this._runCycle();
  }

  stop() {
    this.config.enabled = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async _runCycle() {
    if (!this.config.enabled) return;

    const allPhones = phoneManager.getAllPhones();
    const stoppedPhones = allPhones.filter(p => p.status === 'stopped');

    // Tat batch cu
    for (const id of this.currentBatch) {
      await phoneManager.stopPhone(id);
    }

    // Bat batch moi
    this.currentBatch = [];
    const batch = stoppedPhones.slice(0, this.config.phonesPerBatch);
    for (const phone of batch) {
      await phoneManager.startPhone(phone.id);
      this.currentBatch.push(phone.id);
    }

    console.log(`[Schedule] Bat ${batch.length} phone, chay ${this.config.runMinutes} phut`);

    this.timer = setTimeout(() => {
      this._runCycle();
    }, this.config.runMinutes * 60 * 1000);
  }
}

module.exports = { ScheduleManager };
