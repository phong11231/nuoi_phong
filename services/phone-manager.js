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
  { brand: 'samsung', model: 'SM-G991B', name: 'Galaxy S21', device: 'o1s', board: 'exynos2100', hardware: 'exynos2100', fingerprint: 'samsung/o1sxeuw/o1s:12/SP1A.210812.016/G991BXXU5CVJA:user/release-keys' },
  { brand: 'samsung', model: 'SM-A546B', name: 'Galaxy A54', device: 'a54x', board: 'exynos1380', hardware: 'exynos1380', fingerprint: 'samsung/a54xneuw/a54x:13/TP1A.220624.014/A546BXXU5BWL1:user/release-keys' },
  { brand: 'samsung', model: 'SM-S911B', name: 'Galaxy S23', device: 'dm1q', board: 'kalama', hardware: 'qcom', fingerprint: 'samsung/dm1qxeuw/dm1q:13/TP1A.220624.014/S911BXXU2AWK1:user/release-keys' },
  { brand: 'samsung', model: 'SM-A346B', name: 'Galaxy A34', device: 'a34x', board: 'exynos1280', hardware: 'exynos1280', fingerprint: 'samsung/a34xneuw/a34x:13/TP1A.220624.014/A346BXXU5BWL2:user/release-keys' },
  { brand: 'samsung', model: 'SM-G990B', name: 'Galaxy S21 FE', device: 'r9s', board: 'exynos2100', hardware: 'exynos2100', fingerprint: 'samsung/r9sxeuw/r9s:13/TP1A.220624.014/G990BXXU4DWL1:user/release-keys' },
  { brand: 'Xiaomi', model: 'M2101K6G', name: 'Redmi Note 10 Pro', device: 'sweet', board: 'sm7150', hardware: 'qcom', fingerprint: 'Xiaomi/sweet_eea/sweet:13/TKQ1.221114.001/V14.0.4.0.TKFEUXM:user/release-keys' },
  { brand: 'Xiaomi', model: '22101316G', name: 'Redmi Note 12', device: 'sunstone', board: 'bengal', hardware: 'qcom', fingerprint: 'Xiaomi/sunstone_eea/sunstone:13/TKQ1.221114.001/V14.0.6.0.TMREUXM:user/release-keys' },
  { brand: 'Xiaomi', model: '2211133G', name: 'POCO X5 Pro', device: 'redwood', board: 'sm7325', hardware: 'qcom', fingerprint: 'Xiaomi/redwood_global/redwood:13/TKQ1.221114.001/V14.0.5.0.TMSMIXM:user/release-keys' },
  { brand: 'OPPO', model: 'CPH2505', name: 'Reno 10', device: 'OP5B59L1', board: 'mt6893', hardware: 'mt6893', fingerprint: 'OPPO/CPH2505/OP5B59L1:13/TP1A.220905.001/S.1234567-12345:user/release-keys' },
  { brand: 'vivo', model: 'V2237', name: 'V27', device: 'PD2247F', board: 'mt6893', hardware: 'mt6893', fingerprint: 'vivo/V2237/PD2247F:13/TP1A.220624.014/compiler05230001:user/release-keys' },
  { brand: 'samsung', model: 'SM-M346B', name: 'Galaxy M34', device: 'm34x', board: 'exynos1280', hardware: 'exynos1280', fingerprint: 'samsung/m34xneuw/m34x:13/TP1A.220624.014/M346BXXU3BWK1:user/release-keys' },
  { brand: 'samsung', model: 'SM-S901B', name: 'Galaxy S22', device: 'r0s', board: 'exynos2200', hardware: 'exynos2200', fingerprint: 'samsung/r0sxeuw/r0s:13/TP1A.220624.014/S901BXXU4CWK5:user/release-keys' },
  { brand: 'realme', model: 'RMX3710', name: 'GT Neo 5', device: 'RE58B2', board: 'sm8475', hardware: 'qcom', fingerprint: 'realme/RMX3710/RE58B2:13/TP1A.220905.001/R.1234567:user/release-keys' },
  { brand: 'Xiaomi', model: '2210132G', name: 'Mi 13', device: 'fuxi', board: 'kalama', hardware: 'qcom', fingerprint: 'Xiaomi/fuxi_global/fuxi:13/TKQ1.221114.001/V14.0.9.0.TMCMIXM:user/release-keys' },
  { brand: 'samsung', model: 'SM-A536B', name: 'Galaxy A53', device: 'a53x', board: 'exynos1280', hardware: 'exynos1280', fingerprint: 'samsung/a53xneuw/a53x:13/TP1A.220624.014/A536BXXU6CWL1:user/release-keys' },
  { brand: 'OPPO', model: 'CPH2483', name: 'A78', device: 'OP5B7BL1', board: 'mt6833', hardware: 'mt6833', fingerprint: 'OPPO/CPH2483/OP5B7BL1:13/TP1A.220905.001/S.1234567-12345:user/release-keys' },
  { brand: 'vivo', model: 'V2252', name: 'Y36', device: 'PD2266F', board: 'mt6833', hardware: 'mt6833', fingerprint: 'vivo/V2252/PD2266F:13/TP1A.220624.014/compiler05230002:user/release-keys' },
  { brand: 'samsung', model: 'SM-G996B', name: 'Galaxy S21+', device: 't2s', board: 'exynos2100', hardware: 'exynos2100', fingerprint: 'samsung/t2sxeuw/t2s:13/TP1A.220624.014/G996BXXU6DWL1:user/release-keys' },
  { brand: 'Xiaomi', model: '23021RAAEG', name: 'Redmi 12', device: 'fire', board: 'mt6768', hardware: 'mt6768', fingerprint: 'Xiaomi/fire_global/fire:13/TP1A.220624.014/V14.0.4.0.TMWMIXM:user/release-keys' },
  { brand: 'realme', model: 'RMX3624', name: 'C55', device: 'RE879BL1', board: 'mt6785', hardware: 'mt6785', fingerprint: 'realme/RMX3624/RE879BL1:13/TP1A.220905.001/R.1234567:user/release-keys' },
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
        name: deviceConfig.name,
        device: deviceConfig.device,
        board: deviceConfig.board,
        hardware: deviceConfig.hardware,
        fingerprint: deviceConfig.fingerprint,
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
      const dev = phone.device;
      const container = await docker.createContainer({
        Image: REDROID_IMAGE,
        name: phone.containerName,
        ExposedPorts: { '5555/tcp': {} },
        Cmd: [
          'androidboot.redroid_gpu_mode=guest',
          'ro.product.cpu.abilist=x86_64,arm64-v8a,x86,armeabi-v7a,armeabi',
          'ro.product.cpu.abilist64=x86_64,arm64-v8a',
          'ro.product.cpu.abilist32=x86,armeabi-v7a,armeabi',
          'ro.dalvik.vm.native.bridge=libhoudini.so',
          `ro.product.model=${dev.model}`,
          `ro.product.brand=${dev.brand}`,
          `ro.product.manufacturer=${dev.brand}`,
          `ro.product.device=${dev.device}`,
          `ro.product.board=${dev.board}`,
          `ro.hardware=${dev.hardware}`,
          `ro.build.fingerprint=${dev.fingerprint}`,
          `ro.build.display.id=${dev.fingerprint.split('/').pop().split(':')[0]}`,
          `ro.product.name=${dev.device}`,
          `ro.boot.hardware=${dev.hardware}`,
          `ro.hardware.chipname=${dev.hardware}`,
          'ro.kernel.qemu=0',
          'ro.boot.qemu=0',
          'ro.debuggable=0',
          'ro.secure=1',
          'ro.build.type=user',
          'ro.build.tags=release-keys',
        ],
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
        const adb = `adb -s localhost:${phone.port}`;
        await runCmd(`${adb} shell svc power stayon true`);
        await runCmd(`${adb} shell settings put system screen_off_timeout 2147483647`);
        await runCmd(`${adb} shell input keyevent 26`);
        console.log(`${phone.name}: Da bat man hinh mac dinh`);

        const dev = phone.device;
        await runCmd(`${adb} shell setprop ro.kernel.qemu 0`);
        await runCmd(`${adb} shell setprop ro.boot.qemu 0`);
        await runCmd(`${adb} shell setprop ro.hardware ${dev.hardware}`);
        await runCmd(`${adb} shell setprop ro.product.model ${dev.model}`);
        await runCmd(`${adb} shell setprop ro.product.brand ${dev.brand}`);
        await runCmd(`${adb} shell setprop ro.product.manufacturer ${dev.brand}`);
        await runCmd(`${adb} shell setprop ro.product.device ${dev.device}`);
        await runCmd(`${adb} shell setprop ro.build.fingerprint "${dev.fingerprint}"`);
        await runCmd(`${adb} shell settings put secure android_id ${dev.androidId}`);
        console.log(`${phone.name}: Da spoof device info: ${dev.brand} ${dev.model}`);

        const ZALO_SPLIT_DIR = '/root/zalo_split';
        if (fs.existsSync(ZALO_SPLIT_DIR)) {
          const apks = fs.readdirSync(ZALO_SPLIT_DIR).filter(f => f.endsWith('.apk')).map(f => `${ZALO_SPLIT_DIR}/${f}`).join(' ');
          console.log(`${phone.name}: Dang cai Zalo (split APK)...`);
          const { err } = await runCmd(`${adb} install-multiple -r ${apks}`);
          if (!err) {
            phone.zaloInstalled = true;
            this._saveData();
            console.log(`${phone.name}: Zalo da cai xong`);
          } else {
            console.log(`${phone.name}: Loi cai Zalo split, thu single APK...`);
            if (fs.existsSync(ZALO_APK)) {
              const r = await runCmd(`${adb} install -r ${ZALO_APK}`);
              if (!r.err) { phone.zaloInstalled = true; this._saveData(); }
            }
          }
        } else if (fs.existsSync(ZALO_APK)) {
          console.log(`${phone.name}: Dang cai Zalo...`);
          const { err } = await runCmd(`${adb} install -r ${ZALO_APK}`);
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
