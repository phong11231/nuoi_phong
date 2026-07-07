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
    if ((digits.length - i) % 2 === 1) {
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
    // Dung port le (5555, 5557, 5559...) de ADB auto-detect la emulator
    const usedPorts = new Set(Array.from(this.phones.values()).map(p => p.port));
    let port = BASE_PORT;
    while (usedPorts.has(port)) port += 2;
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

      // Restart ws-scrcpy de ADB scan lai tat ca emulator ports
      await runCmd(`adb kill-server 2>/dev/null`);
      await runCmd(`docker restart ws-scrcpy`);
      await new Promise(r => setTimeout(r, 5000));
      const scrcpyAdb = `docker exec ws-scrcpy adb`;
      const emulatorId = `emulator-${phone.port - 1}`;
      await runCmd(`${scrcpyAdb} devices`);
      await new Promise(r => setTimeout(r, 2000));
      const { stdout } = await runCmd(`${scrcpyAdb} -s ${emulatorId} shell getprop sys.boot_completed`);

      if (stdout === '1') {
        console.log(`${phone.name}: Android da boot xong`);
        const adb = `${scrcpyAdb} -s ${emulatorId}`;
        await runCmd(`${adb} shell svc power stayon true`);
        await runCmd(`${adb} shell settings put system screen_off_timeout 2147483647`);
        await runCmd(`${adb} shell input keyevent 26`);
        console.log(`${phone.name}: Da bat man hinh mac dinh`);
        console.log(`${phone.name}: Da ket noi ws-scrcpy`);

        const dev = phone.device;
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
          `persist.sys.timezone=Asia/Ho_Chi_Minh`,
          `gsm.operator.alpha=Viettel`,
          `gsm.operator.numeric=45204`,
          `gsm.operator.iso-country=vn`,
          `gsm.sim.operator.alpha=Viettel`,
          `gsm.sim.operator.numeric=45204`,
          `gsm.sim.operator.iso-country=vn`,
          `gsm.sim.state=READY`,
          `ro.telephony.default_network=13`,
        ];
        const sedCmd = props.map(p => {
          const [key] = p.split('=');
          return `-e '/^${key}=/d'`;
        }).join(' ');
        const appendCmd = props.map(p => `echo '${p}' >> /system/build.prop`).join(' && ');
        await runCmd(`docker exec ${c} sh -c "mount -o remount,rw /system 2>/dev/null; sed -i ${sedCmd} /system/build.prop && ${appendCmd}"`);
        await runCmd(`docker exec ${c} settings put secure android_id ${dev.androidId}`);
        await runCmd(`docker exec ${c} setprop net.hostname android-${dev.androidId.substring(0,8)}`);
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

    if (proxyUser) {
      const relayPort = 20000 + phone.port;
      await this._startProxyRelay(phone, relayPort, proxyHost, proxyPort, proxyUser, proxyPass);
      await runCmd(`docker exec ${phone.containerName} settings put global http_proxy 172.17.0.1:${relayPort}`);
      phone.relayPort = relayPort;
    } else {
      await runCmd(`docker exec ${phone.containerName} settings put global http_proxy ${proxyHost}:${proxyPort}`);
    }

    await this._hardenProxy(phone);

    this._saveData();
    console.log(`${phone.name}: Da set proxy ${proxyStr} (hardened)`);
    return phone;
  }

  async _hardenProxy(phone) {
    const c = phone.containerName;
    await runCmd(`docker exec ${c} setprop net.dns1 8.8.8.8`);
    await runCmd(`docker exec ${c} setprop net.dns2 8.8.4.4`);
    await runCmd(`docker exec ${c} setprop persist.sys.timezone Asia/Ho_Chi_Minh`);
    await runCmd(`docker exec ${c} sysctl -w net.ipv6.conf.all.disable_ipv6=1 2>/dev/null`);
    await runCmd(`docker exec ${c} sysctl -w net.ipv6.conf.default.disable_ipv6=1 2>/dev/null`);
    // Force DNS qua iptables (chong app bypass)
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null`);
    await runCmd(`docker exec ${c} iptables -t nat -A OUTPUT -p tcp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null`);
    console.log(`${phone.name}: Hardened proxy (DNS forced, timezone, IPv6 off)`);
  }

  async _startProxyRelay(phone, relayPort, targetHost, targetPort, user, pass) {
    if (!this._relays) this._relays = {};
    if (this._relays[phone.id]) {
      try { this._relays[phone.id].close(); } catch (e) {}
    }

    const http = require('http');
    const net = require('net');
    const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

    const server = http.createServer((req, res) => {
      const upstream = http.request({
        host: targetHost,
        port: parseInt(targetPort),
        method: req.method,
        path: req.url,
        headers: { ...req.headers, 'Proxy-Authorization': authHeader },
      }, (upRes) => {
        res.writeHead(upRes.statusCode, upRes.headers);
        upRes.pipe(res);
      });
      upstream.on('error', () => res.destroy());
      req.pipe(upstream);
    });

    server.on('connect', (req, clientSocket, head) => {
      const proxySocket = net.createConnection(parseInt(targetPort), targetHost, () => {
        proxySocket.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${authHeader}\r\n\r\n`);
      });
      proxySocket.once('data', (chunk) => {
        if (chunk.toString().includes('200')) {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head && head.length) proxySocket.write(head);
          proxySocket.pipe(clientSocket);
          clientSocket.pipe(proxySocket);
        } else {
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.destroy();
          proxySocket.destroy();
        }
      });
      proxySocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => proxySocket.destroy());
    });

    server.listen(relayPort, '172.17.0.1', () => {
      console.log(`Proxy relay cho ${phone.name} tren port ${relayPort} (chi Docker)`);
    });
    server.on('error', (err) => {
      console.error(`Loi proxy relay ${phone.name}:`, err.message);
    });

    this._relays[phone.id] = server;
  }

  async removeProxy(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    if (phone.status === 'running') {
      await runCmd(`docker exec ${phone.containerName} settings put global http_proxy :0`);
    }

    if (this._relays && this._relays[id]) {
      try { this._relays[id].close(); } catch (e) {}
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
