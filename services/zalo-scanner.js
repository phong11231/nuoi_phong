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

  _cleanName(raw) {
    if (!raw) return '';
    let name = raw
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/&[a-z]+;/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/zalo\.me\/g\/[a-z0-9]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 3) return '';
    if (name.length > 120) name = name.substring(0, 120);
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

  // ===== CRAWL DA NGUON =====
  async startGoogleCrawl(keywords) {
    this.mode.google = true;

    // 1. Google search voi nhieu query
    for (const kw of keywords) {
      if (this._stopFlag) break;
      await this._searchEngine('Google', kw);
      await this._sleep(2000);
    }

    // 2. Bing search
    for (const kw of keywords) {
      if (this._stopFlag) break;
      await this._searchBing(kw);
      await this._sleep(2000);
    }

    // 3. Crawl trang tong hop
    const staticSources = [
      { name: 'keomemzalo.com', urls: [
        'https://keomemzalo.com/1000-danh-sach-link-nhom-zalo-theo-linh-vuc-nganh-nghe-moi-nhat/',
        'https://keomemzalo.com/danh-sach-100-link-nhom-zalo-cho-ban-hang-tuong-tac-cao/',
      ]},
      { name: 'phanmemzalo.vn', urls: ['https://phanmemzalo.vn/link-nhom-zalo-kin/'] },
      { name: 'lamhoang.edu.vn', urls: ['https://lamhoang.edu.vn/nhom-zalo/'] },
      { name: 'nhomkinzalo.com', urls: ['https://nhomkinzalo.com/'] },
      { name: 'ship4p.com', urls: ['https://ship4p.com/nhom-zalo-ban-hang/'] },
      { name: 'whtspgrouplink', urls: ['https://whtspgrouplink.com/zalo-group-links/'] },
    ];

    for (const src of staticSources) {
      if (this._stopFlag) break;
      for (const url of src.urls) {
        if (this._stopFlag) break;
        this.currentSource = src.name;
        try {
          await this._crawlPage(url, src.name);
        } catch (e) {
          console.error(`Crawl ${src.name} loi:`, e.message);
        }
        await this._sleep(1500);
      }
    }

    // 4. Tim tren forum VN
    for (const kw of keywords) {
      if (this._stopFlag) break;
      await this._searchForums(kw);
      await this._sleep(2000);
    }

    this.mode.google = false;
    if (!this.mode.bruteforce) this.currentSource = '';
  }

  async _searchEngine(engine, keyword) {
    const queries = [
      `"zalo.me/g/" "${keyword}"`,
      `"zalo.me/g/" nhom ${keyword}`,
      `link nhom zalo "${keyword}" 2024 OR 2025 OR 2026`,
      `"tham gia nhom" zalo "${keyword}"`,
      `site:facebook.com "zalo.me/g/" "${keyword}"`,
    ];

    for (const q of queries) {
      if (this._stopFlag) break;
      this.currentSource = `Google: "${keyword}" (${this.stats.googleChecked})`;
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=100&hl=vi`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml',
          },
          timeout: 15000,
          maxRedirects: 3,
        });

        this._extractFromGoogle(res.data);
      } catch (e) {
        console.error(`Google search loi:`, e.message);
      }
      await this._sleep(3000 + Math.random() * 2000);
    }
  }

  async _searchBing(keyword) {
    const queries = [
      `"zalo.me/g/" "${keyword}"`,
      `link nhom zalo "${keyword}"`,
    ];

    for (const q of queries) {
      if (this._stopFlag) break;
      this.currentSource = `Bing: "${keyword}"`;
      try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=50`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9',
          },
          timeout: 15000,
        });

        this._extractFromSearchPage(res.data, 'Bing');
      } catch (e) {}
      await this._sleep(2000 + Math.random() * 1000);
    }
  }

  async _searchForums(keyword) {
    const forumQueries = [
      `site:tinhte.vn "zalo.me/g/" "${keyword}"`,
      `site:voz.vn "zalo.me/g/" "${keyword}"`,
      `site:facebook.com "zalo.me/g/" "${keyword}"`,
      `site:congdongketoan.vn "zalo.me/g/" "${keyword}"`,
    ];

    for (const q of forumQueries) {
      if (this._stopFlag) break;
      this.currentSource = `Forum: "${keyword}"`;
      try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=50&hl=vi`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9',
          },
          timeout: 15000,
        });
        this._extractFromGoogle(res.data);
      } catch (e) {}
      await this._sleep(4000 + Math.random() * 2000);
    }
  }

  _extractFromGoogle(html) {
    const $ = cheerio.load(html);
    const zaloLinkRegex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;

    // Tim trong ket qua Google
    $('div.g, div[data-hveid], div.tF2Cxc, div.MjjYud').each((_, el) => {
      const block = $(el);
      const blockHtml = block.html() || '';
      const blockText = block.text() || '';

      let match;
      zaloLinkRegex.lastIndex = 0;
      while ((match = zaloLinkRegex.exec(blockHtml)) !== null) {
        const link = match[0];
        // Lay ten tu title cua ket qua
        let name = block.find('h3').first().text().trim();
        if (!name) name = block.find('a').first().text().trim();
        if (!name) {
          // Lay snippet
          name = block.find('.VwiC3b, .st, span[style]').first().text().trim();
        }
        this._addResult(name, link, 'Google');
        this.stats.googleChecked++;
      }
    });

    // Fallback: tim link trong toan bo HTML
    let match;
    zaloLinkRegex.lastIndex = 0;
    while ((match = zaloLinkRegex.exec(html)) !== null) {
      const link = match[0];
      const idx = match.index;
      const before = html.substring(Math.max(0, idx - 300), idx);
      const after = html.substring(idx, Math.min(html.length, idx + 300));
      const context = before + after;

      const $ctx = cheerio.load(context);
      let name = $ctx('h3').first().text().trim()
        || $ctx('a').first().text().trim()
        || $ctx('strong,b,em').first().text().trim();

      if (!name || name.includes('zalo.me')) {
        const textParts = context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').split(/[.!?\n]/);
        for (const part of textParts) {
          const clean = part.trim();
          if (clean.length >= 5 && clean.length <= 100 && !clean.includes('zalo.me') && !clean.includes('http')) {
            name = clean;
            break;
          }
        }
      }

      this._addResult(name, link, 'Google');
      this.stats.googleChecked++;
    }
  }

  _extractFromSearchPage(html, source) {
    const zaloLinkRegex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;
    const $ = cheerio.load(html);

    $('li.b_algo, div.b_algo').each((_, el) => {
      const block = $(el);
      const blockHtml = block.html() || '';
      let match;
      zaloLinkRegex.lastIndex = 0;
      while ((match = zaloLinkRegex.exec(blockHtml)) !== null) {
        let name = block.find('h2 a, h2').first().text().trim();
        if (!name) name = block.find('p').first().text().trim();
        this._addResult(name, match[0], source);
        this.stats.googleChecked++;
      }
    });

    // Fallback
    zaloLinkRegex.lastIndex = 0;
    let match;
    while ((match = zaloLinkRegex.exec(html)) !== null) {
      this._addResult('', match[0], source);
      this.stats.googleChecked++;
    }
  }

  async _crawlPage(url, sourceName) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);
      const zaloLinkRegex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;

      // Tim cac link trong the <a>
      $('a[href*="zalo.me/g/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const linkMatch = href.match(/https?:\/\/zalo\.me\/g\/([a-z0-9]+)/i);
        if (linkMatch) {
          // Tim ten nhom: text cua link, hoac text trong cung dong/row
          let name = $(el).text().trim();
          if (!name || name.includes('zalo.me')) {
            const parent = $(el).closest('tr, li, div, p, td');
            name = parent.text().trim();
            // Bo phan URL
            name = name.replace(/https?:\/\/[^\s]+/g, '').trim();
          }
          // Tim trong cot truoc (neu la table)
          if (!name || name.length < 3) {
            const td = $(el).closest('td');
            if (td.length) {
              const prevTd = td.prev('td');
              if (prevTd.length) name = prevTd.text().trim();
            }
          }
          this._addResult(name, linkMatch[0], sourceName);
          this.stats.googleChecked++;
        }
      });

      // Fallback: tim link trong text
      let match;
      zaloLinkRegex.lastIndex = 0;
      const fullText = res.data;
      while ((match = zaloLinkRegex.exec(fullText)) !== null) {
        const idx = match.index;
        const context = fullText.substring(Math.max(0, idx - 200), Math.min(fullText.length, idx + 50));
        const $ctx = cheerio.load(context);

        let name = '';
        // Tim text trong the gan nhat
        const prevEl = $ctx('td, li, strong, b, h2, h3, h4, p, span').last();
        if (prevEl.length) {
          name = prevEl.text().trim();
        }

        if (!name || name.includes('zalo.me')) {
          const lines = context.replace(/<[^>]+>/g, '\n').split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.length >= 3 && line.length <= 100 && !line.includes('zalo.me') && !line.includes('http')) {
              name = line;
              break;
            }
          }
        }

        this._addResult(name, match[0], sourceName);
        this.stats.googleChecked++;
      }
    } catch (e) {
      console.error(`Crawl ${sourceName} loi:`, e.message);
    }
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
      } catch (e) {}

      this.stats.bruteChecked++;
      if (this.stats.bruteChecked % 100 === 0) {
        this.currentSource = `Brute-force: da quet ${this.stats.bruteChecked.toLocaleString()} link`;
      }

      await this._sleep(50);
    }

    this.mode.bruteforce = false;
    if (!this.mode.google) this.currentSource = '';
  }

  async start(keywords, zcaApi = null) {
    if (this.running) return;
    this.running = true;
    this._stopFlag = false;
    this.keywords = keywords;
    this.stats.startTime = Date.now();

    const tasks = [];
    tasks.push(this.startGoogleCrawl(keywords));
    if (zcaApi) tasks.push(this.startBruteforce(zcaApi));

    await Promise.all(tasks);
    this.running = false;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloScanner };
