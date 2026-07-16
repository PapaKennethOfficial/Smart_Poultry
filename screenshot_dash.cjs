const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const mobile = { width: 390, height: 844 }; // iPhone 14 size
  
  const registerAndCapture = async (role, email, path) => {
    const page = await browser.newPage();
    await page.setViewport(mobile);
    await page.goto('http://localhost:5174/register', { waitUntil: 'networkidle0' });
    
    // Select role
    await page.evaluate((r) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes(r));
      if(btn) btn.click();
    }, role);
    
    // Fill form
    await page.type('#register-name', 'Test ' + role);
    await page.type('#register-email', email);
    await page.type('#register-password', 'password123');
    await page.type('#register-confirm', 'password123');
    
    // Click submit
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(b => b.textContent.includes('Create Account') || b.textContent.includes('Create account'));
      if(submitBtn) submitBtn.click();
    });
    
    // Wait for redirect to dashboard
    await new Promise(r => setTimeout(r, 4000)); // wait 4 seconds for API and redirect
    
    await page.screenshot({ path: path });
    await page.close();
  };

  try {
    const ts = Date.now();
    await registerAndCapture('customer', 'cust' + ts + '@test.com', 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\cf070b2e-384e-4667-a586-425d105708b1\\mob_customer.png');
    console.log("Customer screenshot taken");
    
    await registerAndCapture('delivery', 'del' + ts + '@test.com', 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\cf070b2e-384e-4667-a586-425d105708b1\\mob_delivery.png');
    console.log("Delivery screenshot taken");
    
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
