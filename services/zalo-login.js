const puppeteer = require('puppeteer');

class ZaloLogin {
  constructor() {
    this.browser = null;
    this.page = null;
    this.status = 'idle';
    this.qrImage = null;
    this.cookies = null;
    this.errorMsg = '';
    this._loginId = 0;
  }

  getStatus() {
    return {
      status: this.status,
      qrImage: this.qrImage,
      loggedIn: this.status === 'logged_in',
      error: this.errorMsg,
    };
  }

  async startLogin() {
    await this.cleanup();

    this._loginId++;
    const myId = this._loginId;

    this.status = 'waiting';
    this.qrImage = null;
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
      await this.page.setViewport({ width: 500, height: 700 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

      console.log('[QR] Dang mo chat.zalo.me...');
      await this.page.goto('https://chat.zalo.me/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      if (this._loginId !== myId) return;

      const url = this.page.url();
      console.log(`[QR] URL sau redirect: ${url}`);

      // Doi trang login load xong (co the redirect sang id.zalo.me)
      await this._sleep(3000);
      if (this._loginId !== myId) return;

      // Tim QR element: thu canvas, img trong vung QR, hoac bat ky img nao lon
      const qrBase64 = await this._captureQR();

      if (qrBase64) {
        this.qrImage = qrBase64;
        this.status = 'qr_ready';
        console.log('[QR] Da chup QR thanh cong');
      } else {
        // Fallback: chup toan trang
        console.log('[QR] Khong tim thay QR element, chup toan trang...');
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        this.qrImage = screenshot;
        this.status = 'qr_ready';
      }

      this._pollLogin(myId);

    } catch (e) {
      if (this._loginId === myId) {
        this.status = 'error';
        this.errorMsg = e.message;
        console.error('[QR] Loi:', e.message);
      }
    }
  }

  async _captureQR() {
    if (!this.page) return null;

    // Thu nhieu selector co the chua QR
    const selectors = [
      'canvas',                        // QR thuong render trong canvas
      'img[src*="qr"]',               // img co src chua "qr"
      'img[src*="data:image"]',       // img base64 inline
      '[class*="qr" i] canvas',       // canvas trong div co class chua "qr"
      '[class*="qr" i] img',          // img trong div co class chua "qr"
      '[class*="qr" i]',              // div co class chua "qr"
      '[id*="qr" i]',                 // element co id chua "qr"
      'svg[width][height]',           // QR dang SVG
    ];

    for (const sel of selectors) {
      try {
        const el = await this.page.$(sel);
        if (!el) continue;

        const box = await el.boundingBox();
        if (!box) continue;

        // QR thuong la hinh vuong, kich thuoc > 100px
        if (box.width >= 80 && box.height >= 80) {
          console.log(`[QR] Tim thay element: ${sel} (${Math.round(box.width)}x${Math.round(box.height)})`);
          const screenshot = await el.screenshot({ encoding: 'base64' });
          return screenshot;
        }
      } catch (e) {}
    }

    // Thu tim qua evaluate - tim canvas hoac img lon nhat
    try {
      const qrData = await this.page.evaluate(() => {
        // Check canvas
        const canvases = document.querySelectorAll('canvas');
        for (const c of canvases) {
          if (c.width >= 80 && c.height >= 80) {
            try {
              return { type: 'dataurl', data: c.toDataURL('image/png') };
            } catch (e) {}
          }
        }
        return null;
      });

      if (qrData && qrData.data) {
        console.log('[QR] Lay QR tu canvas.toDataURL');
        return qrData.data.replace(/^data:image\/png;base64,/, '');
      }
    } catch (e) {}

    return null;
  }

  async _pollLogin(myId) {
    for (let i = 0; i < 120; i++) {
      if (this._loginId !== myId) return;
      if (!this.page) return;

      try {
        const cookies = await this.page.cookies();
        const hasZpw = cookies.some(c => c.name === 'zpw_sek' || c.name === 'zpsid' || c.name === 'zpw_enk');

        if (hasZpw) {
          this.cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          this.status = 'logged_in';
          console.log('[QR] Zalo login thanh cong! Cookie length:', this.cookies.length);

          try {
            const localData = await this.page.evaluate(() => ({
              imei: localStorage.getItem('z_uuid') || localStorage.getItem('imei') || '',
              zpw_sek: localStorage.getItem('zpw_sek') || '',
            }));
            this._localData = localData;
          } catch (e) {}

          return;
        }

        // Cap nhat QR moi moi 60 giay
        if (i > 0 && i % 30 === 0 && this._loginId === myId) {
          const newQR = await this._captureQR();
          if (newQR) {
            this.qrImage = newQR;
          } else {
            const newScreenshot = await this.page.screenshot({ encoding: 'base64' });
            this.qrImage = newScreenshot;
          }
          console.log('[QR] Cap nhat QR moi');
        }
      } catch (e) {}

      await this._sleep(2000);
    }

    if (this._loginId === myId) {
      this.status = 'error';
      this.errorMsg = 'Het thoi gian cho (4 phut). Thu lai.';
      await this.cleanup();
    }
  }

  getCookieString() {
    return this.cookies;
  }

  getLocalData() {
    return this._localData || {};
  }

  async cleanup() {
    this.status = 'idle';
    this.qrImage = null;
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
