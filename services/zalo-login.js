const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class ZaloLogin {
  constructor() {
    this.browser = null;
    this.page = null;
    this.status = 'idle'; // idle, qr_ready, waiting, logged_in, error
    this.qrImage = null; // base64
    this.cookies = null;
    this.errorMsg = '';
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
    if (this.browser) {
      await this.cleanup();
    }

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
      await this.page.setViewport({ width: 500, height: 600 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

      await this.page.goto('https://chat.zalo.me/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Cho QR code hien
      await this._waitForQR();

      // Poll cho den khi dang nhap thanh cong
      this._pollLogin();

    } catch (e) {
      this.status = 'error';
      this.errorMsg = e.message;
      console.error('Zalo login loi:', e.message);
    }
  }

  async _waitForQR() {
    for (let i = 0; i < 20; i++) {
      try {
        // Tim QR code image tren trang
        const qrEl = await this.page.$('canvas, img[src*="qr"], div[class*="qr"] canvas, #qr-code, .login-qr img, .qr-code img');
        if (qrEl) {
          const screenshot = await qrEl.screenshot({ encoding: 'base64' });
          this.qrImage = screenshot;
          this.status = 'qr_ready';
          console.log('QR code da san sang');
          return;
        }

        // Fallback: chup man hinh vung QR
        const screenshot = await this.page.screenshot({ encoding: 'base64', clip: { x: 50, y: 100, width: 400, height: 400 } });
        this.qrImage = screenshot;
        this.status = 'qr_ready';
        return;
      } catch (e) {}
      await this._sleep(1000);
    }

    // Fallback cuoi: chup toan trang
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
    this.qrImage = screenshot;
    this.status = 'qr_ready';
  }

  async _pollLogin() {
    for (let i = 0; i < 120; i++) {
      if (this.status === 'idle') return;

      try {
        // Check xem da login chua bang URL hoac element
        const url = this.page.url();

        // Neu URL doi sang trang chat = da login
        if (url.includes('chat.zalo.me') && !url.includes('login')) {
          const cookies = await this.page.cookies();
          const hasZpw = cookies.some(c => c.name.includes('zpw') || c.name.includes('zpsid'));

          if (hasZpw || cookies.length > 3) {
            this.cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            this.status = 'logged_in';
            console.log('Zalo login thanh cong! Cookie length:', this.cookies.length);

            // Lay them localStorage data neu can
            try {
              const localData = await this.page.evaluate(() => {
                return {
                  imei: localStorage.getItem('z_uuid') || localStorage.getItem('imei') || '',
                  zpw_sek: localStorage.getItem('zpw_sek') || '',
                };
              });
              this._localData = localData;
            } catch (e) {}

            return;
          }
        }

        // Cap nhat QR moi (QR het han sau 1-2 phut)
        if (i > 0 && i % 30 === 0) {
          await this._waitForQR();
        }

      } catch (e) {}
      await this._sleep(2000);
    }

    this.status = 'error';
    this.errorMsg = 'Het thoi gian cho (4 phut). Thu lai.';
    await this.cleanup();
  }

  getCookieString() {
    return this.cookies;
  }

  getLocalData() {
    return this._localData || {};
  }

  async cleanup() {
    this.status = 'idle';
    try {
      if (this.page) await this.page.close().catch(() => {});
      if (this.browser) await this.browser.close().catch(() => {});
    } catch (e) {}
    this.browser = null;
    this.page = null;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { ZaloLogin };
