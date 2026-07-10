const puppeteer = require('puppeteer');

class ZaloLogin {
  constructor() {
    this.browser = null;
    this.page = null;
    this.status = 'idle'; // idle | loading | browsing | logged_in | error
    this.cookies = null;
    this.errorMsg = '';
    this._loginId = 0;
    this._localData = {};
    this._lastScreenshot = null;
    this._screenshotInterval = null;
  }

  getStatus() {
    return {
      status: this.status,
      screenshot: this._lastScreenshot,
      loggedIn: this.status === 'logged_in',
      error: this.errorMsg,
    };
  }

  async startLogin() {
    await this.cleanup();

    this._loginId++;
    const myId = this._loginId;

    this.status = 'loading';
    this._lastScreenshot = null;
    this.cookies = null;
    this.errorMsg = '';

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 450, height: 600 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

      console.log('[Browser] Dang mo chat.zalo.me...');
      await this.page.goto('https://chat.zalo.me/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      if (this._loginId !== myId) return;

      this.status = 'browsing';
      console.log('[Browser] Trang da load, bat dau stream...');

      // Chup screenshot lien tuc
      this._startScreenshotLoop(myId);

      // Poll cookie lien tuc
      this._pollCookies(myId);

    } catch (e) {
      if (this._loginId === myId) {
        this.status = 'error';
        this.errorMsg = e.message;
        console.error('[Browser] Loi:', e.message);
      }
    }
  }

  _startScreenshotLoop(myId) {
    if (this._screenshotInterval) clearInterval(this._screenshotInterval);

    const capture = async () => {
      if (this._loginId !== myId || !this.page || this.status === 'logged_in') {
        clearInterval(this._screenshotInterval);
        return;
      }
      try {
        const buf = await this.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
        this._lastScreenshot = buf;
      } catch (e) {}
    };

    capture();
    this._screenshotInterval = setInterval(capture, 600);
  }

  async _pollCookies(myId) {
    for (let i = 0; i < 300; i++) {
      if (this._loginId !== myId) return;
      if (!this.page) return;

      try {
        const cookies = await this.page.cookies();
        const hasZpw = cookies.some(c => c.name === 'zpw_sek' || c.name === 'zpsid' || c.name === 'zpw_enk');

        if (hasZpw) {
          this.cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          this.status = 'logged_in';
          console.log('[Browser] Zalo login thanh cong! Cookie length:', this.cookies.length);

          try {
            const localData = await this.page.evaluate(() => ({
              imei: localStorage.getItem('z_uuid') || localStorage.getItem('imei') || '',
            }));
            this._localData = localData;
          } catch (e) {}

          // Chup 1 screenshot cuoi
          try {
            this._lastScreenshot = await this.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 60 });
          } catch (e) {}

          return;
        }
      } catch (e) {}

      await this._sleep(2000);
    }

    if (this._loginId === myId) {
      this.status = 'error';
      this.errorMsg = 'Het thoi gian cho (10 phut). Thu lai.';
      await this.cleanup();
    }
  }

  // Xu ly click chuot tu frontend
  async click(x, y) {
    if (!this.page) return;
    try {
      await this.page.mouse.click(x, y);
    } catch (e) {
      console.error('[Browser] Click loi:', e.message);
    }
  }

  // Xu ly go phim tu frontend
  async type(text) {
    if (!this.page) return;
    try {
      await this.page.keyboard.type(text);
    } catch (e) {
      console.error('[Browser] Type loi:', e.message);
    }
  }

  // Xu ly phim dac biet
  async keyPress(key) {
    if (!this.page) return;
    try {
      await this.page.keyboard.press(key);
    } catch (e) {
      console.error('[Browser] KeyPress loi:', e.message);
    }
  }

  // Lay screenshot moi nhat (khong chup moi, tra ve cache)
  getScreenshot() {
    return this._lastScreenshot;
  }

  getCookieString() {
    return this.cookies;
  }

  getLocalData() {
    return this._localData || {};
  }

  async cleanup() {
    this.status = 'idle';
    this._lastScreenshot = null;
    if (this._screenshotInterval) {
      clearInterval(this._screenshotInterval);
      this._screenshotInterval = null;
    }
    const browser = this.browser;
    const page = this.page;
    this.browser = null;
    this.page = null;

    try {
      if (page) await page.close().catch(() => {});
    } catch (e) {}
    try {
      if (browser) await browser.close().catch(() => {});
    } catch (e) {}
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloLogin };
