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
  { brand: 'samsung', model: 'SM-G991B', name: 'Galaxy S21', device: 'o1s', board: 'exynos2100', hardware: 'exynos2100', screen: '1080x2400', android: '12', fingerprint: 'samsung/o1sxeuw/o1s:12/SP1A.210812.016/G991BXXU5CVJA:user/release-keys' },
  { brand: 'samsung', model: 'SM-A546B', name: 'Galaxy A54', device: 'a54x', board: 'exynos1380', hardware: 'exynos1380', screen: '1080x2340', android: '13', fingerprint: 'samsung/a54xneuw/a54x:13/TP1A.220624.014/A546BXXU5BWL1:user/release-keys' },
  { brand: 'samsung', model: 'SM-S911B', name: 'Galaxy S23', device: 'dm1q', board: 'kalama', hardware: 'qcom', screen: '1080x2340', android: '13', fingerprint: 'samsung/dm1qxeuw/dm1q:13/TP1A.220624.014/S911BXXU2AWK1:user/release-keys' },
  { brand: 'samsung', model: 'SM-A346B', name: 'Galaxy A34', device: 'a34x', board: 'exynos1280', hardware: 'exynos1280', screen: '1080x2340', android: '13', fingerprint: 'samsung/a34xneuw/a34x:13/TP1A.220624.014/A346BXXU5BWL2:user/release-keys' },
  { brand: 'samsung', model: 'SM-G990B', name: 'Galaxy S21 FE', device: 'r9s', board: 'exynos2100', hardware: 'exynos2100', screen: '1080x2340', android: '13', fingerprint: 'samsung/r9sxeuw/r9s:13/TP1A.220624.014/G990BXXU4DWL1:user/release-keys' },
  { brand: 'Xiaomi', model: 'M2101K6G', name: 'Redmi Note 10 Pro', device: 'sweet', board: 'sm7150', hardware: 'qcom', screen: '1080x2400', android: '13', fingerprint: 'Xiaomi/sweet_eea/sweet:13/TKQ1.221114.001/V14.0.4.0.TKFEUXM:user/release-keys' },
  { brand: 'Xiaomi', model: '22101316G', name: 'Redmi Note 12', device: 'sunstone', board: 'bengal', hardware: 'qcom', screen: '1080x2400', android: '13', fingerprint: 'Xiaomi/sunstone_eea/sunstone:13/TKQ1.221114.001/V14.0.6.0.TMREUXM:user/release-keys' },
  { brand: 'Xiaomi', model: '2211133G', name: 'POCO X5 Pro', device: 'redwood', board: 'sm7325', hardware: 'qcom', screen: '1080x2400', android: '13', fingerprint: 'Xiaomi/redwood_global/redwood:13/TKQ1.221114.001/V14.0.5.0.TMSMIXM:user/release-keys' },
  { brand: 'OPPO', model: 'CPH2505', name: 'Reno 10', device: 'OP5B59L1', board: 'mt6893', hardware: 'mt6893', screen: '1080x2412', android: '13', fingerprint: 'OPPO/CPH2505/OP5B59L1:13/TP1A.220905.001/S.1234567-12345:user/release-keys' },
  { brand: 'vivo', model: 'V2237', name: 'V27', device: 'PD2247F', board: 'mt6893', hardware: 'mt6893', screen: '1080x2400', android: '13', fingerprint: 'vivo/V2237/PD2247F:13/TP1A.220624.014/compiler05230001:user/release-keys' },
  { brand: 'samsung', model: 'SM-M346B', name: 'Galaxy M34', device: 'm34x', board: 'exynos1280', hardware: 'exynos1280', screen: '1080x2340', android: '13', fingerprint: 'samsung/m34xneuw/m34x:13/TP1A.220624.014/M346BXXU3BWK1:user/release-keys' },
  { brand: 'samsung', model: 'SM-S901B', name: 'Galaxy S22', device: 'r0s', board: 'exynos2200', hardware: 'exynos2200', screen: '1080x2400', android: '13', fingerprint: 'samsung/r0sxeuw/r0s:13/TP1A.220624.014/S901BXXU4CWK5:user/release-keys' },
  { brand: 'realme', model: 'RMX3710', name: 'GT Neo 5', device: 'RE58B2', board: 'sm8475', hardware: 'qcom', screen: '1240x2772', android: '13', fingerprint: 'realme/RMX3710/RE58B2:13/TP1A.220905.001/R.1234567:user/release-keys' },
  { brand: 'Xiaomi', model: '2210132G', name: 'Mi 13', device: 'fuxi', board: 'kalama', hardware: 'qcom', screen: '1080x2400', android: '13', fingerprint: 'Xiaomi/fuxi_global/fuxi:13/TKQ1.221114.001/V14.0.9.0.TMCMIXM:user/release-keys' },
  { brand: 'samsung', model: 'SM-A536B', name: 'Galaxy A53', device: 'a53x', board: 'exynos1280', hardware: 'exynos1280', screen: '1080x2400', android: '13', fingerprint: 'samsung/a53xneuw/a53x:13/TP1A.220624.014/A536BXXU6CWL1:user/release-keys' },
  { brand: 'OPPO', model: 'CPH2483', name: 'A78', device: 'OP5B7BL1', board: 'mt6833', hardware: 'mt6833', screen: '1080x2400', android: '13', fingerprint: 'OPPO/CPH2483/OP5B7BL1:13/TP1A.220905.001/S.1234567-12345:user/release-keys' },
  { brand: 'vivo', model: 'V2252', name: 'Y36', device: 'PD2266F', board: 'mt6833', hardware: 'mt6833', screen: '720x1612', android: '13', fingerprint: 'vivo/V2252/PD2266F:13/TP1A.220624.014/compiler05230002:user/release-keys' },
  { brand: 'samsung', model: 'SM-G996B', name: 'Galaxy S21+', device: 't2s', board: 'exynos2100', hardware: 'exynos2100', screen: '1080x2400', android: '12', fingerprint: 'samsung/t2sxeuw/t2s:13/TP1A.220624.014/G996BXXU6DWL1:user/release-keys' },
  { brand: 'Xiaomi', model: '23021RAAEG', name: 'Redmi 12', device: 'fire', board: 'mt6768', hardware: 'mt6768', screen: '1080x2400', android: '13', fingerprint: 'Xiaomi/fire_global/fire:13/TP1A.220624.014/V14.0.4.0.TMWMIXM:user/release-keys' },
  { brand: 'realme', model: 'RMX3624', name: 'C55', device: 'RE879BL1', board: 'mt6785', hardware: 'mt6785', screen: '1080x2400', android: '13', fingerprint: 'realme/RMX3624/RE879BL1:13/TP1A.220905.001/R.1234567:user/release-keys' },
];

const BRAND_MAC_OUI = {
  'samsung': ['A8:7D:12', 'C0:BD:D1', '00:26:37', '78:52:1A', 'D0:22:BE', '34:23:BA', 'F4:7B:5E'],
  'Xiaomi':  ['28:6C:07', '64:CC:2E', '9C:99:A0', '74:23:44', 'AC:C1:EE', '50:64:2B'],
  'OPPO':    ['A4:3B:FA', 'CC:2D:83', '98:F1:99', '2C:5B:E1'],
  'vivo':    ['BC:E7:96', 'D4:6A:6A', '44:A4:2D', '80:A5:02'],
  'realme':  ['A4:3B:FA', 'CC:2D:83', '98:F1:99'],
};

const BRAND_TAC = {
  'samsung': ['35332510', '35290911', '35397010', '35476809', '35836209', '35188710'],
  'Xiaomi':  ['86388003', '86513603', '86461103', '86726903'],
  'OPPO':    ['86776303', '86984804', '86912104'],
  'vivo':    ['86328604', '86471404', '86739004'],
  'realme':  ['86776303', '86912104', '86984804'],
};

function randomMAC(brand) {
  const ouis = BRAND_MAC_OUI[brand] || BRAND_MAC_OUI['samsung'];
  const oui = ouis[Math.floor(Math.random() * ouis.length)];
  const hex = '0123456789ABCDEF';
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += ':' + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
  }
  return oui + suffix;
}

function luhnCheckDigit(digits) {
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]);
    if ((digits.length - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

function randomIMEI(brand) {
  const tacs = BRAND_TAC[brand] || BRAND_TAC['samsung'];
  const tac = tacs[Math.floor(Math.random() * tacs.length)];
  let body = tac;
  for (let i = 0; i < 6; i++) {
    body += Math.floor(Math.random() * 10);
  }
  return body + luhnCheckDigit(body);
}

function randomSerial(brand) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let prefix = brand === 'samsung' ? 'R5' : brand === 'Xiaomi' ? 'X0' : 'SN';
  for (let i = 0; i < 9; i++) {
    prefix += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix;
}

function randomAndroidId() {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

function randomGSFId() {
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
        this._syncContainerStatus().then(() => {
          this._restoreRelays();
          this._reconnectRunningPhones();
        });
      }
    } catch (e) {
      console.error('Loi load data:', e.message);
    }
  }

  async _syncContainerStatus() {
    if (!docker) return;
    let changed = false;
    for (const phone of this.phones.values()) {
      if (!phone.containerId) continue;
      try {
        const container = docker.getContainer(phone.containerId);
        const info = await container.inspect();
        const isRunning = info.State.Running;
        if (phone.status === 'running' && !isRunning) {
          console.log(`${phone.name}: container da stop, cap nhat status`);
          phone.status = 'stopped';
          changed = true;
        } else if (phone.status === 'stopped' && isRunning) {
          console.log(`${phone.name}: container dang chay, cap nhat status`);
          phone.status = 'running';
          changed = true;
        }
      } catch (e) {
        if (e.statusCode === 404) {
          console.log(`${phone.name}: container khong ton tai, dat status error`);
          phone.status = 'error';
          phone.error = 'Container not found';
          changed = true;
        }
      }
    }
    if (changed) this._saveData();
  }

  async _reconnectRunningPhones() {
    for (const phone of this.phones.values()) {
      if (phone.status === 'running') {
        console.log(`Reconnect ws-scrcpy cho ${phone.name}...`);
        try {
          await this._connectWsScrcpy(phone);
        } catch (e) {
          console.error(`Loi reconnect ${phone.name}:`, e.message);
        }
      }
    }
  }

  _restoreRelays() {
    for (const phone of this.phones.values()) {
      if (phone.proxy && phone.relayPort && phone.status === 'running') {
        const parts = phone.proxy.split(':');
        const proxyUser = parts[2] || '';
        const proxyPass = parts[3] || '';
        this._startProxyRelay(phone, phone.relayPort, parts[0], parts[1], proxyUser, proxyPass);
        console.log(`Phuc hoi redsocks+relay cho ${phone.name} tren port ${phone.relayPort}`);
      }
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
    // Dung port le (5555, 5557, 5559...) de ADB auto-detect la emulator
    const usedPorts = new Set(Array.from(this.phones.values()).map(p => p.port));
    let port = BASE_PORT;
    while (usedPorts.has(port)) port += 2;
    return port;
  }

  createPhone(name, folderId) {
    const id = uuidv4();
    const port = this._getNextPort();
    const deviceConfig = PHONE_MODELS[Math.floor(Math.random() * PHONE_MODELS.length)];
    const containerName = `phone-${id.substring(0, 8)}`;

    const phone = {
      id,
      name: name || `Phone ${this.phones.size + 1}`,
      folderId: folderId || null,
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
        screen: deviceConfig.screen,
        android: deviceConfig.android,
        imei: randomIMEI(deviceConfig.brand),
        mac: randomMAC(deviceConfig.brand),
        androidId: randomAndroidId(),
        serial: randomSerial(deviceConfig.brand),
        gsfId: randomGSFId(),
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
      const binds = ['/dev/binderfs:/dev/binderfs'];
      const ZALO_SPLIT_DIR = '/root/zalo_split';
      if (fs.existsSync(ZALO_SPLIT_DIR)) {
        binds.push(`${ZALO_SPLIT_DIR}:/data/zalo:ro`);
      }

      const dev = phone.device;
      const container = await docker.createContainer({
        Image: REDROID_IMAGE,
        name: phone.containerName,
        ExposedPorts: { '5555/tcp': {} },
        Cmd: ['androidboot.redroid_gpu_mode=guest'],
        HostConfig: {
          Privileged: true,
          PortBindings: {
            '5555/tcp': [{ HostPort: String(phone.port) }]
          },
          Binds: binds,
        }
      });

      phone.containerId = container.id;
      this._saveData();

      // Sua build.prop TRUOC khi start -> ro.* co gia tri dung ngay tu boot
      const c = phone.containerName;
      const props = [
        `ro.product.model=${dev.model}`,
        `ro.product.brand=${dev.brand}`,
        `ro.product.manufacturer=${dev.brand}`,
        `ro.product.device=${dev.device}`,
        `ro.product.board=${dev.board}`,
        `ro.product.name=${dev.device}`,
        `ro.hardware=${dev.hardware}`,
        `ro.build.fingerprint=${dev.fingerprint}`,
        `ro.build.display.id=${dev.fingerprint.split('/').pop() || 'OPR1.170623.027'}`,
        `ro.serialno=${dev.serial}`,
        `ro.boot.serialno=${dev.serial}`,
        `ro.kernel.qemu=0`,
        `ro.boot.qemu=0`,
        `ro.boot.hardware=${dev.hardware}`,
        `ro.hardware.chipname=${dev.hardware}`,
        `ro.build.product=${dev.device}`,
        `ro.debuggable=0`,
        `ro.secure=1`,
        `ro.adb.secure=0`,
        `ro.build.type=user`,
        `ro.build.tags=release-keys`,
        `ro.build.description=${dev.device}-user 13 TP1A.220624.014 release-keys`,
        `ro.boot.vbmeta.device_state=locked`,
        `ro.boot.verifiedbootstate=green`,
        `ro.boot.flash.locked=1`,
      ];
      // Copy build.prop ra, sua, copy lai (docker cp hoat dong tren container chua start)
      await runCmd(`docker cp ${c}:/system/build.prop /tmp/build_${c}.prop`);
      const sedCmd = props.map(p => {
        const [key] = p.split('=');
        return `-e '/^${key}=/d'`;
      }).join(' ');
      const appendLines = props.map(p => `echo '${p}' >> /tmp/build_${c}.prop`).join(' && ');
      await runCmd(`sed -i ${sedCmd} /tmp/build_${c}.prop && ${appendLines}`);
      await runCmd(`docker cp /tmp/build_${c}.prop ${c}:/system/build.prop`);
      await runCmd(`rm -f /tmp/build_${c}.prop`);
      console.log(`${phone.name}: Da sua build.prop truoc boot: ${dev.brand} ${dev.model}`);

      await container.start();
      phone.status = 'running';
      phone.startedAt = new Date().toISOString();
      this._saveData();
      console.log(`Container ${c} da tao, port ${phone.port}`);

      this._waitBootAndSetup(phone);
    } catch (err) {
      console.error(`Loi tao container ${phone.name}:`, err.message);
      phone.status = 'error';
      phone.error = err.message;
      this._saveData();
    }
  }

  async _waitBootAndSetup(phone) {
    const c = phone.containerName;
    const maxAttempts = 24;
    let attempt = 0;

    const check = async () => {
      attempt++;
      if (attempt > maxAttempts) {
        console.log(`${phone.name}: timeout cho boot (4 phut)`);
        return;
      }

      const { stdout } = await runCmd(`docker exec ${c} getprop sys.boot_completed`);

      if (stdout === '1') {
        console.log(`${phone.name}: Android da boot xong`);

        await runCmd(`docker exec ${c} svc power stayon true`);
        await runCmd(`docker exec ${c} settings put system screen_off_timeout 2147483647`);
        await runCmd(`docker exec ${c} input keyevent 82`);
        console.log(`${phone.name}: Da bat man hinh`);

        const dev = phone.device;
        // ro.* props da duoc truyen qua Docker Cmd luc tao container
        // Chi can set cac props co the thay doi runtime
        const runtimeProps = [
          ['persist.sys.timezone', 'Asia/Ho_Chi_Minh'],
          ['gsm.operator.alpha', 'Viettel'],
          ['gsm.operator.numeric', '45204'],
          ['gsm.operator.iso-country', 'vn'],
          ['gsm.sim.operator.alpha', 'Viettel'],
          ['gsm.sim.operator.numeric', '45204'],
          ['gsm.sim.operator.iso-country', 'vn'],
          ['gsm.sim.state', 'READY'],
          ['net.hostname', `android-${dev.androidId.substring(0,8)}`],
        ];
        for (const [key, val] of runtimeProps) {
          await runCmd(`docker exec ${c} setprop ${key} ${val}`);
        }
        await runCmd(`docker exec ${c} settings put secure android_id ${dev.androidId}`);
        console.log(`${phone.name}: Da spoof device info: ${dev.brand} ${dev.model}`);

        // Cai Zalo bang docker exec + pm (khong can ADB)
        const { stdout: hasZalo } = await runCmd(`docker exec ${c} ls /data/zalo/ 2>/dev/null`);
        if (hasZalo) {
          console.log(`${phone.name}: Dang cai Zalo (split APK qua pm)...`);
          const installScript = `
            cd /data/zalo && \
            total=0 && \
            for f in *.apk; do s=\$(wc -c < "\$f"); total=\$((total + s)); done && \
            session=\$(pm install-create -S \$total 2>&1 | grep -oE '[0-9]+') && \
            i=0 && \
            for f in *.apk; do \
              s=\$(wc -c < "\$f"); \
              pm install-write -S \$s \$session \$i "/data/zalo/\$f"; \
              i=\$((i + 1)); \
            done && \
            pm install-commit \$session
          `;
          const { err } = await runCmd(`docker exec ${c} sh -c '${installScript.replace(/'/g, "'\\''")}'`);
          if (!err) {
            phone.zaloInstalled = true;
            this._saveData();
            console.log(`${phone.name}: Zalo da cai xong`);
          } else {
            console.log(`${phone.name}: Loi cai Zalo qua pm`);
          }
        }

        // An dau vet emulator
        await this._hideEmulatorTraces(phone);
        // Copy ADB key + connect ws-scrcpy
        await this._authorizeAdbKey(phone);
        await this._connectWsScrcpy(phone);
        // Mo Zalo
        setTimeout(async () => {
          await this.launchZalo(phone.id);
        }, 5000);

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
        phone.status = 'booting';
        phone.startedAt = new Date().toISOString();
        this._saveData();
        console.log(`${phone.name}: Da start container, doi boot...`);
        this._waitBootAndResume(phone);
      } catch (err) {
        console.error(`Loi start ${phone.name}:`, err.message);
      }
    } else {
      phone.status = 'running';
    }

    this._saveData();
    return phone;
  }

  async _waitBootAndResume(phone) {
    const c = phone.containerName;
    let attempt = 0;
    const check = async () => {
      attempt++;
      if (attempt > 24) {
        console.log(`${phone.name}: timeout doi boot (4 phut)`);
        phone.status = 'error';
        phone.error = 'Boot timeout';
        this._saveData();
        return;
      }
      const { stdout } = await runCmd(`docker exec ${c} getprop sys.boot_completed`);
      if (stdout === '1') {
        console.log(`${phone.name}: Boot xong, chuan bi adbd...`);
        // Dam bao ADB TCP port
        await runCmd(`docker exec ${c} setprop persist.adb.tcp.port 5555`);
        // Copy ADB key TRUOC khi lam gi khac
        await this._authorizeAdbKey(phone);
        // Set ro.adb.secure=0 va restart adbd de doc key
        await runCmd(`docker exec ${c} setprop ro.adb.secure 0`);
        await runCmd(`docker exec ${c} setprop ctl.restart adbd`);
        await new Promise(r => setTimeout(r, 3000));
        // Bat man hinh
        await runCmd(`docker exec ${c} svc power stayon true`);
        await runCmd(`docker exec ${c} settings put system screen_off_timeout 2147483647`);
        await runCmd(`docker exec ${c} input keyevent 26`);
        await runCmd(`docker exec ${c} input keyevent 82`);
        await runCmd(`docker exec ${c} input keyevent 3`);
        // An dau vet emulator lai sau restart
        await this._hideEmulatorTraces(phone);
        await new Promise(r => setTimeout(r, 5000));
        console.log(`${phone.name}: Man hinh da san sang`);

        phone.status = 'running';
        this._saveData();

        if (phone.proxy) {
          await this.setProxy(phone.id, phone.proxy);
        }

        await this._connectWsScrcpy(phone);

        setTimeout(async () => {
          await this.launchZalo(phone.id);
        }, 5000);
      } else {
        setTimeout(check, 10000);
      }
    };
    setTimeout(check, 15000);
  }

  async _authorizeAdbKey(phone) {
    const c = phone.containerName;
    // Kiem tra ws-scrcpy co ADB key chua
    const { stdout: wsKeyExists } = await runCmd(`docker exec ws-scrcpy sh -c "test -f /root/.android/adbkey.pub && echo YES || echo NO"`);
    if (wsKeyExists !== 'YES') {
      console.log(`${phone.name}: ws-scrcpy chua co ADB key, tao moi...`);
      await runCmd(`docker exec ws-scrcpy adb start-server 2>/dev/null`);
      await new Promise(r => setTimeout(r, 2000));
    }
    // Copy key tu ws-scrcpy ra host
    await runCmd(`docker exec ws-scrcpy cat /root/.android/adbkey.pub > /tmp/ws_adbkey.pub 2>/dev/null`);
    const { stdout: hostKeySize } = await runCmd(`wc -c < /tmp/ws_adbkey.pub 2>/dev/null`);
    console.log(`${phone.name}: ws-scrcpy key size: ${hostKeySize} bytes`);
    // Copy vao phone voi quyen dung (system:shell = 1000:2000)
    await runCmd(`docker exec ${c} mkdir -p /data/misc/adb`);
    await runCmd(`docker cp /tmp/ws_adbkey.pub ${c}:/data/misc/adb/adb_keys`);
    await runCmd(`docker exec ${c} sh -c "chown 1000:2000 /data/misc/adb/adb_keys && chmod 640 /data/misc/adb/adb_keys"`);
    // Verify
    const { stdout: phoneKeyInfo } = await runCmd(`docker exec ${c} sh -c "ls -la /data/misc/adb/adb_keys 2>/dev/null && echo '---' && wc -c < /data/misc/adb/adb_keys"`);
    console.log(`${phone.name}: phone adb_keys: ${phoneKeyInfo}`);
  }

  async _ensureWsScrcpy() {
    const { stdout: running } = await runCmd(`docker inspect -f '{{.State.Running}}' ws-scrcpy 2>/dev/null`);
    if (running === 'true') return;
    console.log('ws-scrcpy khong chay, dang khoi dong lai...');
    const { stdout: exists } = await runCmd(`docker inspect -f '{{.Id}}' ws-scrcpy 2>/dev/null`);
    if (exists) {
      await runCmd(`docker start ws-scrcpy`);
    } else {
      await runCmd(`docker run -d --name ws-scrcpy --restart=always -p 8000:8000 scavin/ws-scrcpy`);
    }
    await new Promise(r => setTimeout(r, 5000));
    // Dam bao restart policy luon la always
    await runCmd(`docker update --restart=always ws-scrcpy`);
    console.log('ws-scrcpy da san sang');
  }

  async _connectWsScrcpy(phone) {
    console.log(`${phone.name}: Dang ket noi ws-scrcpy...`);
    await this._ensureWsScrcpy();
    // 1. Copy ADB key vao phone TRUOC khi restart adbd
    await this._authorizeAdbKey(phone);
    // 2. Restart adbd de doc key moi
    await runCmd(`docker exec ${phone.containerName} setprop ctl.restart adbd`);
    await new Promise(r => setTimeout(r, 3000));
    // Verify adbd dang lang nghe
    const { stdout: adbdCheck } = await runCmd(`docker exec ${phone.containerName} sh -c "getprop ro.adb.secure && netstat -tlnp 2>/dev/null | grep 5555 || echo 'port 5555 not listening'"`);
    console.log(`${phone.name}: adbd check: ${adbdCheck}`);
    // 3. Disconnect entry cu trong ws-scrcpy
    await runCmd(`docker exec ws-scrcpy adb disconnect 172.17.0.1:${phone.port} 2>/dev/null`);
    await new Promise(r => setTimeout(r, 1000));
    // 4. Connect - thu 5 lan
    let connected = false;
    for (let i = 0; i < 5; i++) {
      const { stdout } = await runCmd(`docker exec ws-scrcpy adb connect 172.17.0.1:${phone.port}`);
      console.log(`  ws-scrcpy connect ${phone.name} (${phone.port}) lan ${i+1}: ${stdout}`);
      if (stdout.includes('connected')) {
        connected = true;
        break;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    if (!connected) {
      console.log(`${phone.name}: Khong the connect ws-scrcpy sau 5 lan thu`);
    }
    // 5. Kiem tra trang thai device
    const { stdout } = await runCmd(`docker exec ws-scrcpy adb devices`);
    console.log(`${phone.name}: ws-scrcpy devices: ${stdout.replace(/\n/g, ', ')}`);
    if (stdout.includes('unauthorized')) {
      console.log(`${phone.name}: CANH BAO - device van unauthorized! Thu lai...`);
      // Thu copy key lai va restart adbd 1 lan nua
      await this._authorizeAdbKey(phone);
      await runCmd(`docker exec ${phone.containerName} setprop ctl.restart adbd`);
      await new Promise(r => setTimeout(r, 5000));
      await runCmd(`docker exec ws-scrcpy adb disconnect 172.17.0.1:${phone.port} 2>/dev/null`);
      await new Promise(r => setTimeout(r, 1000));
      const { stdout: retry } = await runCmd(`docker exec ws-scrcpy adb connect 172.17.0.1:${phone.port}`);
      console.log(`  ws-scrcpy retry connect: ${retry}`);
      const { stdout: devicesRetry } = await runCmd(`docker exec ws-scrcpy adb devices`);
      console.log(`${phone.name}: ws-scrcpy devices (retry): ${devicesRetry.replace(/\n/g, ', ')}`);
    }
  }

  async _disconnectWsScrcpy(phone) {
    await runCmd(`docker exec ws-scrcpy adb disconnect 172.17.0.1:${phone.port}`);
    console.log(`${phone.name}: Da disconnect khoi ws-scrcpy`);
  }

  async launchZalo(id) {
    const phone = this.phones.get(id);
    if (!phone || phone.status !== 'running') return;
    const c = phone.containerName;
    const { stdout } = await runCmd(`docker exec ${c} pm list packages com.zing.zalo 2>/dev/null`);
    if (stdout && stdout.includes('com.zing.zalo')) {
      await runCmd(`docker exec ${c} am start -n com.zing.zalo/com.zing.zalo.ui.LaunchActivity`);
      console.log(`${phone.name}: Da tu dong mo Zalo`);
    } else {
      console.log(`${phone.name}: Zalo chua cai, bo qua launch`);
    }
  }

  async stopPhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    if (docker && phone.containerId) {
      try {
        await this._disconnectWsScrcpy(phone);
        const container = docker.getContainer(phone.containerId);
        await container.stop();
        phone.status = 'stopped';
        phone.stoppedAt = new Date().toISOString();
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
        await this._disconnectWsScrcpy(phone);
        const container = docker.getContainer(phone.containerId);
        try { await container.stop(); } catch (e) {}
        await container.remove();
        console.log(`Container ${phone.containerName} da xoa`);
      } catch (err) {
        console.error(`Loi xoa container ${phone.name}:`, err.message);
      }
    }

    if (this._relays && this._relays[id]) {
      try { this._relays[id].close(); } catch (e) {}
      delete this._relays[id];
    }

    this.phones.delete(id);
    this._saveData();
    return true;
  }

  async setProxy(id, proxyStr) {
    const phone = this.phones.get(id);
    if (!phone) return null;
    phone.proxy = proxyStr;
    this._saveData();

    if (phone.status !== 'running') return phone;

    const parts = proxyStr.split(':');
    const proxyHost = parts[0];
    const proxyPort = parts[1];
    const proxyUser = parts[2] || '';
    const proxyPass = parts[3] || '';

    const relayPort = 20000 + phone.port;
    phone.relayPort = relayPort;
    await this._startProxyRelay(phone, relayPort, proxyHost, proxyPort, proxyUser, proxyPass);

    // Set http_proxy lam backup cho apps co dung
    const httpRelayPort = relayPort + 5000;
    await runCmd(`docker exec ${phone.containerName} settings put global http_proxy 172.17.0.1:${httpRelayPort}`);

    await this._hardenProxy(phone);

    this._saveData();
    console.log(`${phone.name}: Da set proxy ${proxyStr} (hardened)`);
    return phone;
  }

  async _hideEmulatorTraces(phone) {
    const c = phone.containerName;
    const dev = phone.device;
    const isQcom = dev.hardware === 'qcom' || dev.hardware.startsWith('sm');
    const cpuModel = isQcom ? 'Qualcomm Technologies, Inc Kryo 585' : 'ARMv8 Processor rev 4 (v8l)';
    const cpuArch = 'aarch64';
    // Fake /proc/cpuinfo (che CPU x86)
    const fakeCpuInfo = [
      `Processor\\t: ${cpuModel}`,
      `processor\\t: 0`, `BogoMIPS\\t: 38.40`,
      `processor\\t: 1`, `BogoMIPS\\t: 38.40`,
      `processor\\t: 2`, `BogoMIPS\\t: 38.40`,
      `processor\\t: 3`, `BogoMIPS\\t: 38.40`,
      `Features\\t: fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics`,
      `CPU implementer\\t: 0x51`,
      `CPU architecture: 8`,
      `CPU variant\\t: 0x1`,
      `CPU part\\t: 0x804`,
      `CPU revision\\t: 14`,
      `Hardware\\t: ${dev.hardware}`,
      `Serial\\t\\t: ${dev.serial}`,
    ].join('\\n');
    await runCmd(`docker exec ${c} sh -c "mount -o bind /dev/null /proc/version 2>/dev/null; echo '${fakeCpuInfo}' > /data/local/tmp/cpuinfo; mount -o bind /data/local/tmp/cpuinfo /proc/cpuinfo 2>/dev/null"`);
    // Xoa file dac trung emulator
    await runCmd(`docker exec ${c} sh -c "rm -f /system/bin/qemu-props /system/lib/libc_malloc_debug_qemu.so /sys/qemu_trace 2>/dev/null"`);
    await runCmd(`docker exec ${c} sh -c "rm -f /system/bin/microvirt* /system/bin/nox* /system/bin/ttVM* 2>/dev/null"`);
    // Fake battery (gia lap pin 78%)
    await runCmd(`docker exec ${c} sh -c "mkdir -p /data/local/tmp && echo 78 > /data/local/tmp/battery_level"`);
    await runCmd(`docker exec ${c} dumpsys battery set level 78 2>/dev/null`);
    await runCmd(`docker exec ${c} dumpsys battery set status 5 2>/dev/null`);
    await runCmd(`docker exec ${c} dumpsys battery set plugged 0 2>/dev/null`);
    // An /sys/devices/virtual (dau hieu VM)
    await runCmd(`docker exec ${c} sh -c "chmod 000 /sys/devices/virtual/thermal 2>/dev/null"`);
    // Spoof sensors (accelerometer, gyroscope)
    await runCmd(`docker exec ${c} setprop debug.sensors.hal.fake 1`);
    console.log(`${phone.name}: Da an dau vet emulator (cpuinfo, battery, sensors)`);
  }

  async _hardenProxy(phone) {
    const c = phone.containerName;
    const redsocksPort = phone.relayPort;

    await runCmd(`docker exec ${c} setprop net.dns1 8.8.8.8`);
    await runCmd(`docker exec ${c} setprop net.dns2 8.8.4.4`);
    await runCmd(`docker exec ${c} setprop persist.sys.timezone Asia/Ho_Chi_Minh`);
    // Tat IPv6
    await runCmd(`docker exec ${c} sysctl -w net.ipv6.conf.all.disable_ipv6=1 2>/dev/null`);
    await runCmd(`docker exec ${c} sysctl -w net.ipv6.conf.default.disable_ipv6=1 2>/dev/null`);

    // Xoa iptables cu
    await runCmd(`docker exec ${c} iptables -t nat -F OUTPUT 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -F OUTPUT 2>/dev/null`);

    // Redirect TOAN BO TCP qua redsocks (transparent proxy)
    // Khong redirect traffic den chinh redsocks (tranh loop)
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -d 172.17.0.1 -j RETURN 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -d 127.0.0.0/8 -j RETURN 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -d 10.0.0.0/8 -j RETURN 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -p tcp -j DNAT --to-destination 172.17.0.1:${redsocksPort} 2>/dev/null`);

    // Force DNS
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -p tcp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null`);

    // Block STUN/WebRTC leak
    await runCmd(`docker exec ${c} iptables -A OUTPUT -p udp --dport 3478 -j DROP 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -A OUTPUT -p udp --dport 19302:19309 -j DROP 2>/dev/null`);

    console.log(`${phone.name}: Hardened proxy - ALL TCP qua redsocks:${redsocksPort}, STUN blocked, IPv6 off`);
  }

  async _ensureRedsocks() {
    if (this._redsocksChecked) return;
    const { stdout } = await runCmd('which redsocks 2>/dev/null');
    if (!stdout) {
      console.log('Dang cai redsocks...');
      await runCmd('apt-get update -qq && apt-get install -y -qq redsocks 2>/dev/null');
      await runCmd('systemctl stop redsocks 2>/dev/null; systemctl disable redsocks 2>/dev/null');
    }
    this._redsocksChecked = true;
  }

  async _startProxyRelay(phone, relayPort, targetHost, targetPort, user, pass) {
    if (!this._relays) this._relays = {};
    if (this._relays[phone.id]) {
      try {
        if (this._relays[phone.id].process) this._relays[phone.id].process.kill();
        if (this._relays[phone.id].server) this._relays[phone.id].server.close();
      } catch (e) {}
    }

    await this._ensureRedsocks();

    const redsocksPort = relayPort;
    const configPath = `/tmp/redsocks_${phone.containerName}.conf`;
    const proxyType = user ? 'http-connect' : 'http-connect';
    const loginLine = user ? `login = "${user}";` : '';
    const passLine = pass ? `password = "${pass}";` : '';

    const config = `
base { log_debug = off; log_info = off; daemon = off; redirector = iptables; }
redsocks {
  local_ip = 172.17.0.1;
  local_port = ${redsocksPort};
  ip = ${targetHost};
  port = ${targetPort};
  type = ${proxyType};
  ${loginLine}
  ${passLine}
}`;

    const { writeFileSync } = require('fs');
    writeFileSync(configPath, config);

    const { spawn } = require('child_process');
    const proc = spawn('redsocks', ['-c', configPath], { stdio: 'ignore', detached: true });
    proc.unref();
    proc.on('error', (err) => console.error(`Loi redsocks ${phone.name}:`, err.message));

    await new Promise(r => setTimeout(r, 1000));
    console.log(`Redsocks cho ${phone.name} tren port ${redsocksPort} -> ${targetHost}:${targetPort}`);

    // HTTP relay van can cho http_proxy setting (backup)
    const http = require('http');
    const net = require('net');
    const httpRelayPort = redsocksPort + 5000;
    const authHeader = user ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') : null;

    const server = http.createServer((req, res) => {
      const headers = { ...req.headers };
      if (authHeader) headers['Proxy-Authorization'] = authHeader;
      const upstream = http.request({
        host: targetHost, port: parseInt(targetPort),
        method: req.method, path: req.url, headers,
      }, (upRes) => { res.writeHead(upRes.statusCode, upRes.headers); upRes.pipe(res); });
      upstream.on('error', () => res.destroy());
      req.pipe(upstream);
    });

    server.on('connect', (req, clientSocket, head) => {
      const proxySocket = net.createConnection(parseInt(targetPort), targetHost, () => {
        let connectReq = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n`;
        if (authHeader) connectReq += `Proxy-Authorization: ${authHeader}\r\n`;
        connectReq += '\r\n';
        proxySocket.write(connectReq);
      });
      proxySocket.once('data', (chunk) => {
        if (chunk.toString().includes('200')) {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head && head.length) proxySocket.write(head);
          proxySocket.pipe(clientSocket); clientSocket.pipe(proxySocket);
        } else { clientSocket.destroy(); proxySocket.destroy(); }
      });
      proxySocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => proxySocket.destroy());
    });

    server.listen(httpRelayPort, '172.17.0.1', () => {
      console.log(`HTTP relay cho ${phone.name} tren port ${httpRelayPort}`);
    });
    server.on('error', () => {});

    this._relays[phone.id] = { process: proc, server, configPath };
  }

  async removeProxy(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    if (phone.status === 'running') {
      await runCmd(`docker exec ${phone.containerName} settings put global http_proxy :0`);
      // Xoa iptables redirect
      await runCmd(`docker exec ${phone.containerName} iptables -t nat -F OUTPUT 2>/dev/null`);
      await runCmd(`docker exec ${phone.containerName} iptables -F OUTPUT 2>/dev/null`);
    }

    if (this._relays && this._relays[id]) {
      try {
        if (this._relays[id].process) this._relays[id].process.kill();
        if (this._relays[id].server) this._relays[id].server.close();
        if (this._relays[id].configPath) {
          try { require('fs').unlinkSync(this._relays[id].configPath); } catch (e) {}
        }
      } catch (e) {}
      delete this._relays[id];
    }

    phone.proxy = null;
    phone.relayPort = null;
    this._saveData();
    return phone;
  }

  getRunningCount() {
    return Array.from(this.phones.values()).filter(p => p.status === 'running').length;
  }
}

const phoneManager = new PhoneManager();
module.exports = { phoneManager };
