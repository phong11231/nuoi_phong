const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

class ZaloScanner {
  constructor() {
    this.results = [];
    this.running = false;
    this.stats = {
      bruteChecked: 0,
      found: 0,
      startTime: null,
      speed: 0,
    };
    this.keywords = [];
    this.currentSource = '';
    this._stopFlag = false;
    this.proxy = null; // host:port:user:pass
    this.zaloCredentials = null; // { cookie, imei } tu dang nhap
    this._lastSpeedCheck = 0;
    this._lastSpeedCount = 0;
  }

  getStatus() {
    return {
      running: this.running,
      stats: this.stats,
      keywords: this.keywords,
      currentSource: this.currentSource,
      totalResults: this.results.length,
      proxy: this.proxy ? this.proxy.split(':').slice(0, 2).join(':') : null,
      loggedIn: !!this.zaloCredentials,
    };
  }

  getResultsByKeyword() {
    const grouped = {};
    for (const kw of this.keywords) {
      const k = kw.toLowerCase().trim();
      grouped[kw] = this.results.filter(r => r.name.toLowerCase().includes(k));
    }
    return grouped;
  }

  stop() {
    this._stopFlag = true;
    this.running = false;
    this.currentSource = '';
  }

  clear() {
    this.results = [];
    this.stats.found = 0;
    this.stats.bruteChecked = 0;
    this.stats.speed = 0;
  }

  setProxy(proxyStr) {
    this.proxy = proxyStr || null;
  }

  _getAxiosConfig(timeout = 15000) {
    const config = { timeout };
    if (this.proxy) {
      const parts = this.proxy.split(':');
      const host = parts[0];
      const port = parts[1];
      const user = parts[2];
      const pass = parts[3];
      const proxyUrl = user && pass
        ? `http://${user}:${pass}@${host}:${port}`
        : `http://${host}:${port}`;
      config.httpAgent = new HttpProxyAgent(proxyUrl);
      config.httpsAgent = new HttpsProxyAgent(proxyUrl);
      config.proxy = false;
    }
    return config;
  }

  async checkIP() {
    try {
      const config = this._getAxiosConfig(10000);
      const res = await axios.get('http://api.ipify.org/', config);
      return { ip: res.data.trim() };
    } catch (e) {
      return { error: e.message };
    }
  }

  _cleanName(raw) {
    if (!raw) return '';
    let name = raw.replace(/\s+/g, ' ').trim();
    if (name.length < 2) return '';
    if (name.length > 150) name = name.substring(0, 150);
    return name;
  }

  _addResult(name, link, source) {
    name = this._cleanName(name);
    if (!name) return;
    link = link.split('?')[0].split('#')[0];
    const nameLower = name.toLowerCase();
    const matched = this.keywords.some(kw => nameLower.includes(kw.toLowerCase().trim()));
    if (!matched) return;
    const exists = this.results.find(r => r.link === link);
    if (!exists) {
      this.results.push({ name, link, source, foundAt: Date.now() });
      this.stats.found = this.results.length;
    }
  }

  // ===== ZALO LOGIN (QR hoac cookie) =====
  setZaloCredentials(credentials) {
    this.zaloCredentials = credentials;
  }

  // ===== BRUTE FORCE =====
  async startBruteforce() {
    if (!this.zaloCredentials) {
      console.error('Chua dang nhap Zalo');
      return;
    }

    this.running = true;
    this._stopFlag = false;
    this.stats.startTime = Date.now();
    this._lastSpeedCheck = Date.now();
    this._lastSpeedCount = 0;

    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';

    while (!this._stopFlag) {
      let code = '';
      for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * 26)];
      for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * 10)];

      try {
        const info = await this._checkGroupLink(code);
        if (info && info.name) {
          this._addResult(info.name, `https://zalo.me/g/${code}`, 'Brute-force');
          console.log(`[FOUND] ${info.name} - https://zalo.me/g/${code}`);
        }
      } catch (e) {
        if (e.message && e.message.includes('blocked')) {
          console.error('Zalo block! Dung 30 giay...');
          await this._sleep(30000);
        }
      }

      this.stats.bruteChecked++;

      // Tinh toc do moi 10 giay
      const now = Date.now();
      if (now - this._lastSpeedCheck >= 10000) {
        this.stats.speed = Math.round((this.stats.bruteChecked - this._lastSpeedCount) / ((now - this._lastSpeedCheck) / 1000));
        this._lastSpeedCheck = now;
        this._lastSpeedCount = this.stats.bruteChecked;
      }

      if (this.stats.bruteChecked % 100 === 0) {
        this.currentSource = `Brute-force: ${this.stats.bruteChecked.toLocaleString()} da quet, ${this.stats.speed} req/s`;
      }

      await this._sleep(20);
    }

    this.running = false;
    this.currentSource = '';
  }

  async _checkGroupLink(code) {
    const { cookie, imei } = this.zaloCredentials;
    const config = this._getAxiosConfig(10000);

    config.headers = {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://chat.zalo.me/',
    };

    const url = `https://tt-group-wpa.chat.zalo.me/api/group/link/ginfo?link=${code}`;
    const res = await axios.get(url, config);

    if (res.data && res.data.error_code === 0 && res.data.data) {
      return { name: res.data.data.name, memberCount: res.data.data.totalMember };
    }
    if (res.data && res.data.error_code === -1000) {
      throw new Error('blocked');
    }
    return null;
  }

  async start(keywords) {
    if (this.running) return;
    this.keywords = keywords;
    await this.startBruteforce();
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloScanner };
