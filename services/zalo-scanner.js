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

    // 1. Google Custom Search API (chinh, khong bi block)
    const API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyC24PKKj0kIq_3BRdN7yWwTFLR4LkaxeM4';
    const CX = process.env.GOOGLE_CX || 'a6c83666cb79f4d9f';

    for (const kw of keywords) {
      if (this._stopFlag) break;
      await this._searchGoogleAPI(kw, API_KEY, CX);
      await this._sleep(1000);
    }

    // 2. Crawl trang tong hop (backup)
    const staticSources = [
      { name: 'keomemzalo.com', urls: [
        'https://keomemzalo.com/1000-danh-sach-link-nhom-zalo-theo-linh-vuc-nganh-nghe-moi-nhat/',
        'https://keomemzalo.com/danh-sach-100-link-nhom-zalo-cho-ban-hang-tuong-tac-cao/',
      ]},
      { name: 'lamhoang.edu.vn', urls: ['https://lamhoang.edu.vn/nhom-zalo/'] },
      { name: 'ship4p.com', urls: ['https://ship4p.com/nhom-zalo-ban-hang/'] },
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

    this.mode.google = false;
    if (!this.mode.bruteforce) this.currentSource = '';
  }

  async _searchGoogleAPI(keyword, apiKey, cx) {
    const queries = [
      `"zalo.me/g/" ${keyword}`,
      `link nhom zalo ${keyword}`,
      `nhom zalo ${keyword} 2024 2025`,
    ];

    for (const q of queries) {
      if (this._stopFlag) break;
      // API tra ve toi da 10 ket qua/request, dung start de phan trang
      for (let start = 1; start <= 91; start += 10) {
        if (this._stopFlag) break;
        this.currentSource = `Google API: "${keyword}" (trang ${Math.ceil(start/10)})`;
        try {
          const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&start=${start}&num=10&hl=vi`;
          const res = await axios.get(url, { timeout: 15000 });
          const data = res.data;

          if (!data.items || data.items.length === 0) break;

          for (const item of data.items) {
            const title = item.title || '';
            const snippet = item.snippet || '';
            const link = item.link || '';
            const fullText = title + ' ' + snippet + ' ' + link;

            // Tim zalo.me/g/ link trong ket qua
            const zaloRegex = /https?:\/\/zalo\.me\/g\/([a-z0-9]+)/gi;
            let match;
            while ((match = zaloRegex.exec(fullText)) !== null) {
              this._addResult(title, match[0], 'Google API');
              this.stats.googleChecked++;
            }

            // Neu link chinh la zalo.me/g/
            if (link.includes('zalo.me/g/')) {
              this._addResult(title, link, 'Google API');
              this.stats.googleChecked++;
            }

            // Crawl trang ket qua de tim them link zalo
            if (!link.includes('zalo.me') && (snippet.includes('zalo.me/g/') || title.toLowerCase().includes('nhom zalo') || title.toLowerCase().includes('link zalo'))) {
              try {
                await this._crawlPage(link, 'Google API → ' + new URL(link).hostname);
              } catch (e) {}
            }
          }

          if (data.items.length < 10) break;
        } catch (e) {
          if (e.response && e.response.status === 429) {
            console.error('Google API: het quota ngay hom nay (100 query/ngay)');
            return;
          }
          console.error(`Google API loi:`, e.message);
          break;
        }
        await this._sleep(500);
      }
      await this._sleep(1000);
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
