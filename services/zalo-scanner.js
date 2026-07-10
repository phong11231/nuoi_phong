const axios = require('axios');
const cheerio = require('cheerio');

class ZaloScanner {
  constructor() {
    this.results = [];
    this.running = false;
    this.mode = { google: false, bruteforce: false };
    this.stats = {
      googleChecked: 0,
      bruteChecked: 0,
      found: 0,
      startTime: null
    };
    this.keywords = [];
    this.currentSource = '';
    this._stopFlag = false;
  }

  getStatus() {
    return {
      running: this.running,
      mode: this.mode,
      stats: this.stats,
      keywords: this.keywords,
      currentSource: this.currentSource,
      totalResults: this.results.length
    };
  }

  getResults(filterKeyword) {
    if (!filterKeyword || !filterKeyword.trim()) return this.results;
    const keys = filterKeyword.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
    return this.results.filter(r => {
      const name = r.name.toLowerCase();
      return keys.some(k => name.includes(k));
    });
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
    this.mode = { google: false, bruteforce: false };
    this.currentSource = '';
  }

  clear() {
    this.results = [];
    this.stats.found = 0;
    this.stats.googleChecked = 0;
    this.stats.bruteChecked = 0;
  }

  _addResult(name, link, source) {
    const exists = this.results.find(r => r.link === link);
    if (!exists) {
      this.results.push({ name, link, source, foundAt: Date.now() });
      this.stats.found = this.results.length;
    }
  }

  // ===== GOOGLE CRAWL (khong can login) =====
  async startGoogleCrawl(keywords) {
    this.mode.google = true;
    this.currentSource = 'Google';

    for (const kw of keywords) {
      if (this._stopFlag) break;
      this.currentSource = `Google: "${kw}"`;

      try {
        await this._searchGoogle(kw);
      } catch (e) {
        console.error(`Loi Google crawl "${kw}":`, e.message);
      }

      await this._sleep(2000);
    }

    // Crawl cac trang tong hop
    const sources = [
      { name: 'keomemzalo.com', url: 'https://keomemzalo.com/1000-danh-sach-link-nhom-zalo-theo-linh-vuc-nganh-nghe-moi-nhat/' },
      { name: 'phanmemzalo.vn', url: 'https://phanmemzalo.vn/link-nhom-zalo-kin/' },
      { name: 'lamhoang.edu.vn', url: 'https://lamhoang.edu.vn/nhom-zalo/' },
    ];

    for (const src of sources) {
      if (this._stopFlag) break;
      this.currentSource = src.name;
      try {
        await this._crawlPage(src.url, src.name);
      } catch (e) {
        console.error(`Loi crawl ${src.name}:`, e.message);
      }
      await this._sleep(1500);
    }

    this.mode.google = false;
    if (!this.mode.bruteforce) {
      this.currentSource = '';
    }
  }

  async _searchGoogle(keyword) {
    const queries = [
      `"zalo.me/g/" ${keyword}`,
      `site:zalo.me/g/ ${keyword}`,
      `link nhom zalo ${keyword}`,
    ];

    for (const q of queries) {
      if (this._stopFlag) break;
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=50`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9',
          },
          timeout: 15000
        });

        const links = this._extractZaloLinks(res.data);
        this.stats.googleChecked += links.length;

        for (const link of links) {
          this._addResult(link.name || 'Chua ro ten', link.url, 'Google');
        }
      } catch (e) {}
      await this._sleep(3000);
    }
  }

  async _crawlPage(url, sourceName) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 20000
      });

      const links = this._extractZaloLinks(res.data);
      this.stats.googleChecked += links.length;

      for (const link of links) {
        this._addResult(link.name || 'Chua ro ten', link.url, sourceName);
      }
    } catch (e) {
      console.error(`Crawl ${sourceName} loi:`, e.message);
    }
  }

  _extractZaloLinks(html) {
    const results = [];
    const regex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[0];
      // Tim ten nhom gan link
      const idx = match.index;
      const surrounding = html.substring(Math.max(0, idx - 200), Math.min(html.length, idx + 200));
      const $ = cheerio.load(surrounding);
      let name = $('a').first().text().trim() || $('h2,h3,h4,strong,b').first().text().trim() || '';
      if (!name || name.length < 2 || name.includes('zalo.me')) {
        // Tim text gan nhat
        const textMatch = surrounding.match(/[^<>]{5,80}/);
        name = textMatch ? textMatch[0].trim() : '';
      }
      if (name.length > 100) name = name.substring(0, 100);
      results.push({ url, name: name || 'Nhom Zalo' });
    }
    return results;
  }

  // ===== BRUTE FORCE (can zca-js login) =====
  async startBruteforce(zcaApi) {
    this.mode.bruteforce = true;
    this.currentSource = 'Brute-force';

    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';

    while (!this._stopFlag) {
      let code = '';
      for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * 26)];
      for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * 10)];

      try {
        const info = await zcaApi.getGroupLinkInfo(code);
        if (info && info.name) {
          this._addResult(info.name, `https://zalo.me/g/${code}`, 'Brute-force');
          console.log(`[FOUND] ${info.name} - https://zalo.me/g/${code}`);
        }
      } catch (e) {
        // Link khong ton tai - skip
      }

      this.stats.bruteChecked++;

      if (this.stats.bruteChecked % 100 === 0) {
        this.currentSource = `Brute-force: da quet ${this.stats.bruteChecked.toLocaleString()} link`;
      }

      await this._sleep(50); // ~20 req/s
    }

    this.mode.bruteforce = false;
    if (!this.mode.google) {
      this.currentSource = '';
    }
  }

  async start(keywords, zcaApi = null) {
    if (this.running) return;
    this.running = true;
    this._stopFlag = false;
    this.keywords = keywords;
    this.stats.startTime = Date.now();

    const tasks = [];

    // Luon chay Google crawl
    tasks.push(this.startGoogleCrawl(keywords));

    // Neu co zca-js API thi chay brute-force song song
    if (zcaApi) {
      tasks.push(this.startBruteforce(zcaApi));
    }

    await Promise.all(tasks);
    this.running = false;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloScanner };
