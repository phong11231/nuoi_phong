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
    grouped['_all'] = this.results;
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

    const CONCURRENCY = 200;
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

  _isInvalidCode(code) {
    for (let i = 0; i < code.length - 2; i++) {
      // Khong co 3 ky tu giong nhau lien tiep
      if (code[i] === code[i + 1] && code[i] === code[i + 2]) return true;
      // Khong co 3 so lien tiep
      if (/\d/.test(code[i]) && /\d/.test(code[i + 1]) && /\d/.test(code[i + 2])) return true;
    }
    for (let i = 0; i < code.length - 1; i++) {
      const a = code.charCodeAt(i);
      const b = code.charCodeAt(i + 1);
      // 2 ky tu lien tiep khong duoc ke nhau trong bang chu cai/so (chenh 1)
      if (Math.abs(a - b) === 1) {
        // Ca 2 deu la chu hoac ca 2 deu la so
        const aIsLetter = code[i] >= 'a' && code[i] <= 'z';
        const bIsLetter = code[i + 1] >= 'a' && code[i + 1] <= 'z';
        const aIsDigit = code[i] >= '0' && code[i] <= '9';
        const bIsDigit = code[i + 1] >= '0' && code[i + 1] <= '9';
        if ((aIsLetter && bIsLetter) || (aIsDigit && bIsDigit)) return true;
      }
    }
    return false;
  }

  async _bruteWorker(workerId) {
    while (!this._stopFlag) {
      if (this._blocked) {
        await this._sleep(5000);
        continue;
      }

      let code = this._randomCode(workerId);
      while (this._isInvalidCode(code)) {
        code = this._randomCode(workerId);
      }

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
              await this._addResultWithPageName(code, link, 'Google');
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
              await this._addResultWithPageName(code, link, site.name);
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

  // Lay ten nhom tu trang zalo.me/g/xxx (khong can cookie)
  async _getGroupNameFromPage(code) {
    try {
      const config = this._getAxiosConfig(10000);
      config.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      };
      config.maxRedirects = 5;
      const res = await axios.get(`https://zalo.me/g/${code}`, config);
      const html = res.data;

      // Thu lay tu og:title
      const ogMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
      if (ogMatch && ogMatch[1] && ogMatch[1].length > 1) {
        return ogMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      }

      // Thu lay tu <title>
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1] && !titleMatch[1].includes('Zalo') && titleMatch[1].length > 2) {
        return titleMatch[1].replace(/&amp;/g, '&').trim();
      }

      // Thu lay tu og:description
      const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
      if (descMatch && descMatch[1]) {
        return descMatch[1].replace(/&amp;/g, '&').trim();
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // Luu link khi khong co cookie — thu lay ten tu trang web
  async _addResultWithPageName(code, link, source) {
    link = link.split('?')[0].split('#')[0];
    const exists = this.results.find(r => r.link === link);
    if (exists) return;

    const name = await this._getGroupNameFromPage(code);
    if (name) {
      this._addResult(name, link, source);
      console.log(`[FOUND-${source}] ${name} - ${link}`);
    } else {
      this.results.push({ name: '(khong lay duoc ten)', link, source, foundAt: Date.now() });
      this.stats.found = this.results.length;
    }
  }

  // ===== BING CRAWL =====
  async _crawlBing(keyword) {
    const queries = [
      `"zalo.me/g/" ${keyword}`,
      `site:zalo.me/g/ ${keyword}`,
      `link nhóm zalo ${keyword}`,
    ];

    for (const q of queries) {
      if (this._stopFlag) return;
      this.currentSource = `Bing: "${q}"`;
      console.log(`[Crawl] Bing: ${q}`);

      for (let page = 0; page < 5; page++) {
        if (this._stopFlag) return;
        try {
          const config = this._getAxiosConfig(15000);
          config.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          };
          const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&first=${page * 10 + 1}`;
          const res = await axios.get(url, config);
          await this._extractZaloLinks(res.data, 'Bing');
          await this._sleep(3000);
        } catch (e) {
          console.log(`[Crawl] Bing loi: ${e.message}`);
          break;
        }
      }
    }
  }

  // ===== DUCKDUCKGO CRAWL =====
  async _crawlDuckDuckGo(keyword) {
    const queries = [
      `"zalo.me/g/" ${keyword}`,
      `nhóm zalo ${keyword} zalo.me/g/`,
    ];

    for (const q of queries) {
      if (this._stopFlag) return;
      this.currentSource = `DuckDuckGo: "${q}"`;
      console.log(`[Crawl] DuckDuckGo: ${q}`);

      try {
        const config = this._getAxiosConfig(15000);
        config.headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html',
        };
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const res = await axios.get(url, config);
        await this._extractZaloLinks(res.data, 'DuckDuckGo');
        await this._sleep(3000);
      } catch (e) {
        console.log(`[Crawl] DuckDuckGo loi: ${e.message}`);
      }
    }
  }

  // ===== YANDEX CRAWL =====
  async _crawlYandex(keyword) {
    const queries = [
      `"zalo.me/g/" ${keyword}`,
      `nhóm zalo ${keyword}`,
    ];

    for (const q of queries) {
      if (this._stopFlag) return;
      this.currentSource = `Yandex: "${q}"`;
      console.log(`[Crawl] Yandex: ${q}`);

      for (let page = 0; page < 3; page++) {
        if (this._stopFlag) return;
        try {
          const config = this._getAxiosConfig(15000);
          config.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html',
          };
          const url = `https://yandex.com/search/?text=${encodeURIComponent(q)}&p=${page}`;
          const res = await axios.get(url, config);
          await this._extractZaloLinks(res.data, 'Yandex');
          await this._sleep(4000);
        } catch (e) {
          console.log(`[Crawl] Yandex loi: ${e.message}`);
          break;
        }
      }
    }
  }

  // ===== SCRAPE TRANG TONG HOP LINK =====
  async _crawlLinkSites() {
    const sites = [
      // Trang quoc te
      { name: 'whtspgrouplink', url: 'https://whtspgrouplink.com/zalo-group-links/' },

      // vinazalo.vn - hang nghin link
      { name: 'vinazalo-sinhvien', url: 'https://vinazalo.vn/tong-hop-danh-sach-100-nhom-zalo-sinh-vien-khap-ca-nuoc/' },
      { name: 'vinazalo-vieclam', url: 'https://vinazalo.vn/danh-sach-100-nhom-zalo-viec-lam-tang-co-hoi-tim-kiem-cong-viec/' },
      { name: 'vinazalo-doanhnhan', url: 'https://vinazalo.vn/danh-sach-50-link-nhom-zalo-doanh-nhan-toan-quoc/' },
      { name: 'vinazalo-cokhi', url: 'https://vinazalo.vn/danh-sach-100-link-nhom-zalo-co-khi-toan-quoc/' },
      { name: 'vinazalo-nhathuoc', url: 'https://vinazalo.vn/danh-sach-100-link-nhom-zalo-nha-thuoc-mua-ban-va-trao-doi/' },
      { name: 'vinazalo-hcm', url: 'https://vinazalo.vn/tong-hop-250-link-nhom-zalo-ho-chi-minh-moi-nhat/' },
      { name: 'vinazalo-thanhhoa', url: 'https://vinazalo.vn/danh-sach-360-link-nhom-zalo-thanh-hoa-moi-nganh-nghe/' },
      { name: 'vinazalo-daklak', url: 'https://vinazalo.vn/danh-sach-100-link-nhom-zalo-dak-lak-moi-nhat/' },
      { name: 'vinazalo-ninhbinh', url: 'https://vinazalo.vn/danh-sach-200-link-nhom-zalo-ninh-binh-moi-linh-vuc/' },
      { name: 'vinazalo-maybay', url: 'https://vinazalo.vn/danh-sach-50-link-nhom-zalo-may-bay-cua-cac-hang/' },
      { name: 'vinazalo-gaixinh', url: 'https://vinazalo.vn/danh-sach-1000-link-nhom-zalo-gai-xinh-moi-nhat/' },
      { name: 'vinazalo-phim', url: 'https://vinazalo.vn/tong-hop-danh-sach-50-link-nhom-zalo-phim-hot-nhat/' },

      // vinazalo.com
      { name: 'vinazalo2-vieclam', url: 'https://vinazalo.com/danh-sach-50-link-nhom-zalo-tim-viec-tren-toan-quoc/' },
      { name: 'vinazalo2-hue', url: 'https://vinazalo.com/danh-sach-200-link-nhom-zalo-hue-tat-ca-cac-nganh-nghe/' },
      { name: 'vinazalo2-bachhoa', url: 'https://vinazalo.com/danh-sach-500-link-nhom-zalo-bach-hoa-xanh-toan-quoc/' },
      { name: 'vinazalo2-mmo', url: 'https://vinazalo.com/danh-sach-100-link-nhom-zalo-mmo-kiem-tien-online/' },
      { name: 'vinazalo2-nhac', url: 'https://vinazalo.com/danh-sach-50-link-nhom-zalo-nhac-lot-giao-luu-am-nhac/' },
      { name: 'vinazalo2-quangninh', url: 'https://vinazalo.com/tong-hop-danh-sach-100-link-nhom-zalo-quang-ninh-moi-nhat/' },
      { name: 'vinazalo2-thuenha', url: 'https://vinazalo.com/tong-hop-danh-sach-50-link-nhom-zalo-thue-nha-tren-toan-quoc/' },

      // Trang khac
      { name: 'ship4p', url: 'https://ship4p.com/nhom-zalo-ban-hang/' },
      { name: 'phanmemninja', url: 'https://www.phanmemninja.com/nhom-ban-hang-online-zalo' },
      { name: 'phanmemninja2', url: 'https://www.phanmemninja.com/group-zalo-ban-hang-chat-luong-theo-tung-chu-de' },
      { name: 'phanmemninja3', url: 'https://www.phanmemninja.com/cach-tim-nhom-tren-zalo' },
      { name: 'balico', url: 'https://balico.com.vn/cach-tim-nhom-tren-zalo-chua-tham-gia/' },
      { name: 'cellphones', url: 'https://cellphones.com.vn/sforum/tim-nhom-chat-zalo' },
      { name: 'mytour', url: 'https://mytour.vn/en/blog/bai-viet/how-to-create-and-find-zalo-groups-using-group-codes.html' },
      { name: 'lamchame', url: 'https://www.lamchame.com/forum/threads/mach-ban-101-link-nhom-zalo-ban-hang-online-tuyet-dinh.2653449/' },
      { name: 'vnseo', url: 'https://vnseo.edu.vn/threads/danh-sach-50-link-nhom-zalo-nhac-lot-giao-luu-am-nhac.567959.html' },
      { name: 'congdongketoan', url: 'https://congdongketoan.vn/threads/tim-kiem-nhom-zalo-chuyen-nghiep-cach-san-nhom-dung-tep-khach-hang.86952/' },
      { name: 'tinhte', url: 'https://tinhte.vn/thread/huong-dan-tim-nhom-tren-zalo-theo-tu-khoa-linh-vuc.4039021/' },
      { name: 'webtretho', url: 'https://www.webtretho.vn/f/kinh-nghiem-hay-huu-ich/cach-tim-nhom-zalo-theo-tu-khoa-hieu-qua-voi-tool-tu-dong' },
    ];

    for (const site of sites) {
      if (this._stopFlag) return;
      this.currentSource = `Scrape: ${site.name}`;
      console.log(`[Crawl] Scrape ${site.name}...`);

      try {
        const config = this._getAxiosConfig(15000);
        config.headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        };
        const res = await axios.get(site.url, config);
        await this._extractZaloLinks(res.data, site.name);
        await this._sleep(2000);
      } catch (e) {
        console.log(`[Crawl] ${site.name} loi: ${e.message}`);
      }
    }
  }

  // ===== HELPER: Extract zalo.me/g/ links tu HTML =====
  async _extractZaloLinks(html, source) {
    const codes = new Set();
    let match;

    // Decode URL-encoded truoc (search engine encode link)
    let decoded = html;
    try {
      decoded = decodeURIComponent(html.replace(/%25/g, '%'));
    } catch (e) {
      try { decoded = decodeURIComponent(html); } catch (e2) {}
    }

    // Tim trong ca ban goc va ban decoded
    for (const text of [html, decoded]) {
      // Dang day du: https://zalo.me/g/xxx
      const r1 = /https?:\/\/zalo\.me\/g\/([a-zA-Z0-9]{5,25})/g;
      while ((match = r1.exec(text)) !== null) codes.add(match[1]);

      // Dang khong co protocol
      const r2 = /zalo\.me\/g\/([a-zA-Z0-9]{5,25})/g;
      while ((match = r2.exec(text)) !== null) codes.add(match[1]);
    }

    // Tim dang URL-encoded trong HTML goc (chua decode): zalo.me%2Fg%2Fxxx
    const r3 = /zalo\.me%2Fg%2F([a-zA-Z0-9]{5,25})/gi;
    while ((match = r3.exec(html)) !== null) codes.add(match[1]);

    // Tim dang double-encoded: zalo.me%252Fg%252Fxxx
    const r4 = /zalo\.me%252Fg%252F([a-zA-Z0-9]{5,25})/gi;
    while ((match = r4.exec(html)) !== null) codes.add(match[1]);

    // Bing dung redirect: u=a1...base64... -> decode base64 tim link
    const bingRedirects = html.match(/u=a1([A-Za-z0-9_-]+)/g);
    if (bingRedirects) {
      for (const br of bingRedirects) {
        try {
          const b64 = br.substring(4).replace(/-/g, '+').replace(/_/g, '/');
          const decoded64 = Buffer.from(b64, 'base64').toString('utf-8');
          const m = decoded64.match(/zalo\.me\/g\/([a-zA-Z0-9]{5,25})/);
          if (m) codes.add(m[1]);
        } catch (e) {}
      }
    }

    // DuckDuckGo dung uddg=URL_ENCODED
    const ddgLinks = html.match(/uddg=([^&"]+)/g);
    if (ddgLinks) {
      for (const dl of ddgLinks) {
        try {
          const url = decodeURIComponent(dl.substring(5));
          const m = url.match(/zalo\.me\/g\/([a-zA-Z0-9]{5,25})/);
          if (m) codes.add(m[1]);
        } catch (e) {}
      }
    }

    console.log(`[Crawl] ${source}: tim thay ${codes.size} link`);

    for (const code of codes) {
      if (this._stopFlag) return;
      const link = `https://zalo.me/g/${code}`;

      if (this.results.find(r => r.link === link)) continue;

      if (this.zaloCredentials) {
        try {
          const info = await this._checkGroupLink(code);
          if (info && info.name) {
            this._addResult(info.name, link, source);
            console.log(`[FOUND-${source}] ${info.name} - ${link}`);
          }
        } catch (e) {
          if (e.message && e.message.includes('blocked')) {
            console.log(`[Crawl] Zalo block khi verify, doi 30s...`);
            await this._sleep(30000);
          }
        }
      } else {
        await this._addResultWithPageName(code, link, source);
      }

      await this._sleep(500);
    }
  }

  // Crawl tat ca nguon (khong can cookie)
  async startCrawl(keywords) {
    if (this.running) return;
    this.keywords = keywords;
    this.running = true;
    this._stopFlag = false;
    this.stats.startTime = Date.now();
    this.stats.bruteChecked = 0;

    console.log('[Scanner] Bat dau crawl da nguon...');

    // 1. Scrape trang tong hop link (khong can keyword)
    await this._crawlLinkSites();

    // 2. Crawl search engines theo keyword
    for (const kw of keywords) {
      if (this._stopFlag) break;
      console.log(`[Scanner] Crawl keyword: "${kw}"`);

      await this._crawlBing(kw);
      await this._crawlDuckDuckGo(kw);
      await this._crawlYandex(kw);
      await this._crawlGoogle(kw);
      await this._crawlShareSites(kw);
    }

    this.running = false;
    this.currentSource = `Crawl hoan tat. Tim duoc ${this.stats.found} nhom.`;
    console.log(`[Scanner] Crawl xong. Tim duoc ${this.stats.found} nhom.`);
  }

  // Brute-force (can cookie)
  async start(keywords) {
    if (this.running) return;
    if (!this.zaloCredentials) return;
    this.keywords = keywords;
    await this.startBruteforce();
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloScanner };
