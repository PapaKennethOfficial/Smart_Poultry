const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'pwa-error.png' });
    console.log("Screenshot taken");
    
    // Also get console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();
