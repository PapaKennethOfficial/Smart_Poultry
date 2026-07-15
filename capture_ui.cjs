const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\cf070b2e-384e-4667-a586-425d105708b1';

async function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function capture() {
  const browser = await puppeteer.launch({ headless: 'new' });
  
  // 1. PWA Welcome Desktop
  let page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5174/');
  await delay(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pwa_welcome_desktop.png') });
  
  // 2. PWA Welcome Mobile
  await page.setViewport({ width: 390, height: 844 });
  await delay(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pwa_welcome_mobile.png') });
  
  // 3. Admin Welcome Desktop
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await delay(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'admin_welcome_desktop.png') });

  // 4. Log into PWA as CUSTOMER on Desktop to see layout
  await page.goto('http://localhost:5174/login');
  await delay(1500);
  await page.type('#email', 'customer@example.com');
  await page.type('#password', 'password123');
  // Attempt to click login button - selecting by text
  const [button] = await page.$x("//button[contains(., 'Sign In')]");
  if (button) {
      await button.click();
  }
  await delay(2500); // Wait for redirect and data load
  
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pwa_customer_desktop.png') });

  // 5. PWA Customer on Mobile
  await page.setViewport({ width: 390, height: 844 });
  await delay(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pwa_customer_mobile.png') });
  
  await browser.close();
  console.log("Screenshots captured!");
}

capture().catch(console.error);
