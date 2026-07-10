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

  // ===== BRUTE FORCE (song song) =====
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
    this._blocked = false;

    const CONCURRENCY = 50;
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(this._bruteWorker(i));
    }
    await Promise.all(workers);

    this.running = false;
    this.currentSource = '';
  }

  _randomCode(workerId) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';

    // Nua worker dung dang 9 ky tu (6 chu + 3 so), nua dung dang 18 ky tu
    if (workerId % 2 === 0) {
      let code = '';
      for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * 26)];
      for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * 10)];
      return code;
    } else {
      let code = '';
      for (let i = 0; i < 18; i++) code += chars[Math.floor(Math.random() * 36)];
      return code;
    }
  }

  async _bruteWorker(workerId) {
    while (!this._stopFlag) {
      if (this._blocked) {
        await this._sleep(5000);
        continue;
      }

      const code = this._randomCode(workerId);

      try {
        const info = await this._checkGroupLink(code);
        if (info && info.name) {
          this._addResult(info.name, `https://zalo.me/g/${code}`, 'Brute-force');
          console.log(`[FOUND] ${info.name} - https://zalo.me/g/${code}`);
        }
      } catch (e) {
        if (e.message && e.message.includes('blocked')) {
          if (!this._blocked) {
            this._blocked = true;
            console.error('Zalo block! Tat ca worker dung 30 giay...');
            setTimeout(() => { this._blocked = false; }, 30000);
          }
        }
      }

      this.stats.bruteChecked++;

      const now = Date.now();
      if (now - this._lastSpeedCheck >= 10000) {
        this.stats.speed = Math.round((this.stats.bruteChecked - this._lastSpeedCount) / ((now - this._lastSpeedCheck) / 1000));
        this._lastSpeedCheck = now;
        this._lastSpeedCount = this.stats.bruteChecked;
        this.currentSource = `Brute-force: ${this.stats.bruteChecked.toLocaleString()} da quet, ${this.stats.speed} req/s`;
      }
    }
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

  async checkCookie() {
    if (!this.zaloCredentials) return { error: 'Chua co cookie' };
    try {
      const { cookie } = this.zaloCredentials;
      const config = this._getAxiosConfig(10000);
      config.headers = {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://chat.zalo.me/',
      };
      // Thu lay profile
      try {
        const profileRes = await axios.get('https://tt-profile-wpa.chat.zalo.me/api/social/profile/me', config);
        if (profileRes.data && profileRes.data.data) {
          const d = profileRes.data.data;
          return { ok: true, name: d.displayName || d.zaloName || 'Unknown' };
        }
      } catch (e) {}
      // Fallback: thu check 1 group link de xem cookie co hoat dong
      const testRes = await axios.get('https://tt-group-wpa.chat.zalo.me/api/group/link/ginfo?link=hghlyl492', config);
      if (testRes.data && testRes.data.error_code === 0) {
        return { ok: true, name: '(Cookie hop le - da kiem tra bang group API)' };
      }
      if (testRes.data && testRes.data.error_code === -1000) {
        return { error: 'Cookie bi block. Thu cookie khac.' };
      }
      return { error: 'Cookie khong hop le hoac het han. error_code=' + (testRes.data ? testRes.data.error_code : '?') };
    } catch (e) {
      return { error: e.message };
    }
  }

  async extractZaloFromPhone(containerName) {
    try {
      const { exec } = require('child_process');
      const run = (cmd) => new Promise((resolve) => {
        exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout) => resolve(stdout ? stdout.trim() : ''));
      });

      // Doc SharedPreferences cua Zalo
      const prefsDir = '/data/data/com.zing.zalo/shared_prefs';
      const files = await run(`docker exec ${containerName} ls ${prefsDir} 2>/dev/null`);
      if (!files) return { error: 'Khong tim thay du lieu Zalo. Zalo chua dang nhap?' };

      let zpwSek = '', zpwEnk = '', zpsid = '', imei = '', uid = '', displayName = '';

      // Doc tat ca pref files de tim token
      const prefFiles = files.split('\n').filter(f => f.endsWith('.xml'));
      for (const f of prefFiles) {
        const content = await run(`docker exec ${containerName} cat ${prefsDir}/${f} 2>/dev/null`);
        if (!content) continue;

        const sekMatch = content.match(/name="zpw_sek"[^>]*>([^<]+)/);
        if (sekMatch) zpwSek = sekMatch[1];

        const enkMatch = content.match(/name="zpw_enk"[^>]*>([^<]+)/);
        if (enkMatch) zpwEnk = enkMatch[1];

        const sidMatch = content.match(/name="zpsid"[^>]*>([^<]+)/);
        if (sidMatch) zpsid = sidMatch[1];

        const imeiMatch = content.match(/name="imei"[^>]*>([^<]+)/) || content.match(/name="z_uuid"[^>]*>([^<]+)/);
        if (imeiMatch) imei = imeiMatch[1];

        const uidMatch = content.match(/name="uid"[^>]*>([^<]+)/) || content.match(/name="userId"[^>]*>([^<]+)/);
        if (uidMatch) uid = uidMatch[1];

        const nameMatch = content.match(/name="displayName"[^>]*>([^<]+)/) || content.match(/name="zaloName"[^>]*>([^<]+)/);
        if (nameMatch) displayName = nameMatch[1];
      }

      // Thu doc database neu khong co trong prefs
      if (!zpwSek && !zpwEnk) {
        const dbContent = await run(`docker exec ${containerName} sqlite3 /data/data/com.zing.zalo/databases/zlstorage.db "SELECT key,value FROM kv WHERE key LIKE '%zpw%' OR key LIKE '%zpsid%' OR key LIKE '%imei%'" 2>/dev/null`);
        if (dbContent) {
          for (const line of dbContent.split('\n')) {
            const [key, val] = line.split('|');
            if (key === 'zpw_sek') zpwSek = val;
            if (key === 'zpw_enk') zpwEnk = val;
            if (key === 'zpsid') zpsid = val;
            if (key === 'imei' || key === 'z_uuid') imei = val;
          }
        }
      }

      if (!zpwSek && !zpwEnk && !zpsid) {
        return { error: 'Khong tim thay token Zalo. Tai khoan chua dang nhap hoac Zalo phien ban moi luu khac.' };
      }

      // Tao cookie string
      const parts = [];
      if (zpwSek) parts.push(`zpw_sek=${zpwSek}`);
      if (zpwEnk) parts.push(`zpw_enk=${zpwEnk}`);
      if (zpsid) parts.push(`zpsid=${zpsid}`);
      const cookie = parts.join('; ');

      return {
        ok: true,
        cookie,
        imei: imei || 'browser',
        displayName: displayName || uid || '(khong ro)',
        tokens: { zpwSek: !!zpwSek, zpwEnk: !!zpwEnk, zpsid: !!zpsid },
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  // ===== CRAWL GOOGLE + WEB =====
  async _crawlGoogle(keyword) {
    const queries = [
      `site:zalo.me/g/ ${keyword}`,
      `zalo.me/g/ nhóm ${keyword}`,
      `"zalo.me/g/" "${keyword}"`,
      `link nhóm zalo ${keyword}`,
    ];

    for (const q of queries) {
      if (this._stopFlag) return;
      this.currentSource = `Google: "${q}"`;
      console.log(`[Crawl] Google: ${q}`);

      for (let page = 0; page < 5; page++) {
        if (this._stopFlag) return;
        try {
          const config = this._getAxiosConfig(15000);
          config.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html',
          };
          const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&start=${page * 10}`;
          const res = await axios.get(url, config);
          const html = res.data;

          // Tim tat ca link zalo.me/g/
          const linkRegex = /https?:\/\/zalo\.me\/g\/([a-zA-Z0-9]+)/g;
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            const code = match[1];
            const link = `https://zalo.me/g/${code}`;

            // Thu lay ten nhom qua API
            if (this.zaloCredentials) {
              try {
                const info = await this._checkGroupLink(code);
                if (info && info.name) {
                  this._addResult(info.name, link, 'Google');
                  console.log(`[FOUND-Google] ${info.name} - ${link}`);
                }
              } catch (e) {}
            } else {
              // Khong co cookie thi van luu link, ten = code
              this._addResultAny(link, 'Google');
            }
          }

          // Tim ten nhom trong snippet Google
          const snippetRegex = /zalo\.me\/g\/([a-zA-Z0-9]+)[^"]*?<[^>]*>([^<]{3,80})/g;
          while ((match = snippetRegex.exec(html)) !== null) {
            const code = match[1];
            const name = match[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
            if (name && code) {
              this._addResult(name, `https://zalo.me/g/${code}`, 'Google');
            }
          }

          await this._sleep(2000);
        } catch (e) {
          console.log(`[Crawl] Google loi: ${e.message}`);
          if (e.response && e.response.status === 429) {
            console.log('[Crawl] Google rate limit, doi 30s...');
            await this._sleep(30000);
          }
          break;
        }
      }
    }
  }

  async _crawlShareSites(keyword) {
    const sites = [
      { name: 'nhomkinzalo.com', url: `https://nhomkinzalo.com/?s=${encodeURIComponent(keyword)}` },
      { name: 'phanmemzalo.vn', url: `https://phanmemzalo.vn/?s=${encodeURIComponent(keyword)}` },
      { name: 'timgroup.vn', url: `https://timgroup.vn/?s=${encodeURIComponent(keyword)}` },
      { name: 'zalogroup.com', url: `https://zalogroup.com/?s=${encodeURIComponent(keyword)}` },
    ];

    for (const site of sites) {
      if (this._stopFlag) return;
      this.currentSource = `Crawl: ${site.name}`;
      console.log(`[Crawl] ${site.name}: ${keyword}`);

      for (let page = 1; page <= 10; page++) {
        if (this._stopFlag) return;
        try {
          const config = this._getAxiosConfig(15000);
          config.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          };
          const pageUrl = page === 1 ? site.url : `${site.url}&page=${page}`;
          const res = await axios.get(pageUrl, config);
          const html = res.data;

          const linkRegex = /https?:\/\/zalo\.me\/g\/([a-zA-Z0-9]+)/g;
          let match;
          let foundOnPage = 0;
          while ((match = linkRegex.exec(html)) !== null) {
            const code = match[1];
            const link = `https://zalo.me/g/${code}`;
            foundOnPage++;

            if (this.zaloCredentials) {
              try {
                const info = await this._checkGroupLink(code);
                if (info && info.name) {
                  this._addResult(info.name, link, site.name);
                  console.log(`[FOUND-${site.name}] ${info.name} - ${link}`);
                }
              } catch (e) {}
            } else {
              this._addResultAny(link, site.name);
            }
          }

          if (foundOnPage === 0) break;
          await this._sleep(1000);
        } catch (e) {
          console.log(`[Crawl] ${site.name} loi: ${e.message}`);
          break;
        }
      }
    }
  }

  // Luu link khi khong co cookie (khong check ten)
  _addResultAny(link, source) {
    link = link.split('?')[0].split('#')[0];
    const exists = this.results.find(r => r.link === link);
    if (!exists) {
      this.results.push({ name: '(chua check ten)', link, source, foundAt: Date.now() });
      this.stats.found = this.results.length;
    }
  }

  async start(keywords) {
    if (this.running) return;
    this.keywords = keywords;
    this.running = true;
    this._stopFlag = false;
    this.stats.startTime = Date.now();

    // Buoc 1: Crawl Google + web chia se (nhanh, co ket qua lien)
    console.log('[Scanner] Bat dau crawl Google + web...');
    for (const kw of keywords) {
      if (this._stopFlag) break;
      await this._crawlGoogle(kw);
      await this._crawlShareSites(kw);
    }

    if (this._stopFlag) {
      this.running = false;
      return;
    }

    // Buoc 2: Brute-force chay nen (tiep tuc tim them)
    console.log('[Scanner] Crawl xong, chuyen sang brute-force...');
    if (this.zaloCredentials) {
      await this.startBruteforce();
    }

    this.running = false;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloScanner };
