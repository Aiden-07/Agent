const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/views/knowledge.html');
    
    // Wait for the elements
    await page.waitForSelector('[data-value="vlm"]');
    
    // Get initial classes
    let vlmClass = await page.$eval('[data-value="vlm"]', el => el.className);
    console.log("Before click:", vlmClass);
    
    // Click it
    await page.click('[data-value="vlm"]');
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 500));
    
    // Get classes after
    vlmClass = await page.$eval('[data-value="vlm"]', el => el.className);
    console.log("After click:", vlmClass);
    
    let ocrClass = await page.$eval('[data-value="ocr"]', el => el.className);
    console.log("OCR class after click:", ocrClass);
    
    await browser.close();
})();
