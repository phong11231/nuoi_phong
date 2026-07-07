const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let Docker;
let docker;
try {
  Docker = require('dockerode');
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
} catch (e) {
  docker = null;
}

const REDROID_IMAGE = 'redroid/redroid:12.0.0-latest';
const BASE_PORT = 5555;
const ZALO_APK = '/root/zalo.apk';
const DATA_FILE = path.join(__dirname, '..', 'phones-data.json');

const PHONE_MODELS = [
  { brand: 'Samsung', model: 'Galaxy S23', screen: '1080x2340', android: '13' },
  { brand: 'Samsung', model: 'Galaxy A54', screen: '1080x2340', android: '13' },
  { brand: 'Samsung', model: 'Galaxy S22', screen: '1080x2400', android: '12' },
  { brand: 'Xiaomi', model: 'Redmi Note 12', screen: '1080x2400', android: '13' },
  { brand: 'Xiaomi', model: 'POCO X5', screen: '1080x2400', android: '12' },
  { brand: 'OPPO', model: 'Reno 10', screen: '1080x2412', android: '13' },
  { brand: 'OPPO', model: 'A78', screen: '1080x2400', android: '13' },
  { brand: 'Vivo', model: 'V27', screen: '1080x2400', android: '13' },
  { brand: 'Vivo', model: 'Y36', screen: '720x1612', android: '13' },
  { brand: 'Realme', model: 'C55', screen: '1080x2400', android: '13' },
  { brand: 'Huawei', model: 'Nova 11', screen: '1080x2400', android: '12' },
  { brand: 'Nokia', model: 'G60', screen: '1080x2400', android: '12' },
  { brand: 'Samsung', model: 'Galaxy M34', screen: '1080x2340', android: '13' },
  { brand: 'Xiaomi', model: 'Redmi 12', screen: '1080x2400', android: '13' },
  { brand: 'OPPO', model: 'Find N2', screen: '1080x2520', android: '13' },
  { brand: 'Samsung', model: 'Galaxy A34', screen: '1080x2340', android: '13' },
  { brand: 'Xiaomi', model: 'Mi 13', screen: '1080x2400', android: '13' },
  { brand: 'Vivo', model: 'X90', screen: '1080x2400', android: '13' },
  { brand: 'Realme', model: 'GT Neo 5', screen: '1240x2772', android: '13' },
  { brand: 'Samsung', model: 'Galaxy S21 FE', screen: '1080x2340', android: '12' },
];

function randomMAC() {
  const hex = '0123456789ABCDEF';
  let mac = '02';
  for (let i = 0; i < 5; i++) {
    mac += ':' + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
  }
  return mac;
}

function randomIMEI() {
  let imei = '';
  for (let i = 0; i < 15; i++) {
    imei += Math.floor(Math.random() * 10);
  }
  return imei;
}

function randomAndroidId() {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

function runCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
    });
  });
}

class PhoneManager {
  constructor() {
    this.phones = new Map();
    this._loadData();
  }

  _loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        data.forEach(p => this.phones.set(p.id, p));
        console.log(`Da load ${data.length} phone tu file`);
      }
    } catch (e) {
      console.error('Loi load data:', e.message);
    }
  }

  _saveData() {
    try {
      const data = Array.from(this.phones.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Loi save data:', e.message);
    }
  }

  _getNextPort() {
    const usedPorts = new Set(Array.from(this.phones.values()).map(p => p.port));
    let port = BASE_PORT;
    while (usedPorts.has(port)) port++;
    return port;
  }

  createPhone(name) {
    const id = uuidv4();
    const port = this._getNextPort();
    const deviceConfig = PHONE_MODELS[Math.floor(Math.random() * PHONE_MODELS.length)];
    const containerName = `phone-${id.substring(0, 8)}`;

    const phone = {
      id,
      name: name || `Phone ${this.phones.size + 1}`,
      status: 'creating',
      port,
      containerName,
      containerId: null,
      createdAt: new Date().toISOString(),
      device: {
        brand: deviceConfig.brand,
        model: deviceConfig.model,
        screen: deviceConfig.screen,
        android: deviceConfig.android,
        imei: randomIMEI(),
        mac: randomMAC(),
        androidId: randomAndroidId(),
      },
      proxy: null,
      zaloInstalled: false,
    };

    this.phones.set(id, phone);
    this._saveData();

    if (docker) {
      this._createContainer(phone);
    } else {
      phone.status = 'running';
      this._saveData();
    }

    return phone;
  }

  async _createContainer(phone) {
    try {
      const container = await docker.createContainer({
        Image: REDROID_IMAGE,
        name: phone.containerName,
        ExposedPorts: { '5555/tcp': {} },
        HostConfig: {
          Privileged: true,
          PortBindings: {
            '5555/tcp': [{ HostPort: String(phone.port) }]
          },
          Binds: ['/dev/binderfs:/dev/binderfs']
        }
      });

      await container.start();
      phone.containerId = container.id;
      phone.status = 'running';
      phone.startedAt = new Date().toISOString();
      this._saveData();
      console.log(`Container ${phone.containerName} da tao, port ${phone.port}`);

      this._waitBootAndSetup(phone);
    } catch (err) {
      console.error(`Loi tao container ${phone.name}:`, err.message);
      phone.status = 'error';
      phone.error = err.message;
      this._saveData();
    }
  }

  async _waitBootAndSetup(phone) {
    const maxAttempts = 18;
    let attempt = 0;

    const check = async () => {
      attempt++;
      if (attempt > maxAttempts) {
        console.log(`${phone.name}: timeout cho boot`);
        return;
      }

      await runCmd(`adb connect localhost:${phone.port}`);
      const { stdout } = await runCmd(`adb -s localhost:${phone.port} shell getprop sys.boot_completed`);

      if (stdout === '1') {
        console.log(`${phone.name}: Android da boot xong`);
        if (fs.existsSync(ZALO_APK)) {
          console.log(`${phone.name}: Dang cai Zalo...`);
          const { err } = await runCmd(`adb -s localhost:${phone.port} install -r ${ZALO_APK}`);
          if (!err) {
            phone.zaloInstalled = true;
            this._saveData();
            console.log(`${phone.name}: Zalo da cai xong`);
          }
        }
      } else {
        setTimeout(check, 10000);
      }
    };

    setTimeout(check, 30000);
  }

  getPhone(id) {
    return this.phones.get(id) || null;
  }

  getAllPhones() {
    return Array.from(this.phones.values());
  }

  async startPhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    if (docker && phone.containerId) {
      try {
        const container = docker.getContainer(phone.containerId);
        await container.start();
        phone.status = 'running';
        phone.startedAt = new Date().toISOString();
        await runCmd(`adb connect localhost:${phone.port}`);
      } catch (err) {
        console.error(`Loi start ${phone.name}:`, err.message);
      }
    } else {
      phone.status = 'running';
    }

    this._saveData();
    return phone;
  }

  async stopPhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    if (docker && phone.containerId) {
      try {
        const container = docker.getContainer(phone.containerId);
        await container.stop();
        phone.status = 'stopped';
        phone.stoppedAt = new Date().toISOString();
        await runCmd(`adb disconnect localhost:${phone.port}`);
      } catch (err) {
        console.error(`Loi stop ${phone.name}:`, err.message);
      }
    } else {
      phone.status = 'stopped';
    }

    this._saveData();
    return phone;
  }

  async deletePhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return false;

    if (docker && phone.containerId) {
      try {
        const container = docker.getContainer(phone.containerId);
        try { await container.stop(); } catch (e) {}
        await container.remove();
        await runCmd(`adb disconnect localhost:${phone.port}`);
        console.log(`Container ${phone.containerName} da xoa`);
      } catch (err) {
        console.error(`Loi xoa container ${phone.name}:`, err.message);
      }
    }

    this.phones.delete(id);
    this._saveData();
    return true;
  }

  setProxy(id, proxy) {
    const phone = this.phones.get(id);
    if (!phone) return null;
    phone.proxy = proxy;
    this._saveData();
    return phone;
  }

  getRunningCount() {
    return Array.from(this.phones.values()).filter(p => p.status === 'running').length;
  }
}

const phoneManager = new PhoneManager();
module.exports = { phoneManager };
