const { v4: uuidv4 } = require('uuid');

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

class PhoneManager {
  constructor() {
    this.phones = new Map();
  }

  createPhone(name) {
    const id = uuidv4();
    const deviceConfig = PHONE_MODELS[Math.floor(Math.random() * PHONE_MODELS.length)];

    const phone = {
      id,
      name: name || `Phone ${this.phones.size + 1}`,
      status: 'stopped',
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
      containerId: null,
    };

    this.phones.set(id, phone);
    return phone;
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

    // TODO: Goi Docker API de start container Redroid
    // const docker = new Docker();
    // const container = await docker.createContainer({...});
    // await container.start();
    // phone.containerId = container.id;

    phone.status = 'running';
    phone.startedAt = new Date().toISOString();
    return phone;
  }

  async stopPhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    // TODO: Goi Docker API de stop container
    // if (phone.containerId) {
    //   const docker = new Docker();
    //   const container = docker.getContainer(phone.containerId);
    //   await container.stop();
    // }

    phone.status = 'stopped';
    phone.stoppedAt = new Date().toISOString();
    return phone;
  }

  deletePhone(id) {
    const phone = this.phones.get(id);
    if (!phone) return false;

    // TODO: Xoa container Docker neu dang chay

    this.phones.delete(id);
    return true;
  }

  setProxy(id, proxy) {
    const phone = this.phones.get(id);
    if (!phone) return null;

    phone.proxy = proxy;
    return phone;
  }

  getRunningCount() {
    return Array.from(this.phones.values()).filter(p => p.status === 'running').length;
  }
}

const phoneManager = new PhoneManager();
module.exports = { phoneManager };
