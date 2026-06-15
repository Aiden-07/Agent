const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/tests/inline_actions_test.html');
  await page.waitForTimeout(2000);
  const output = await page.evaluate(() => {
    return document.getElementById('test-output').innerText;
  });
  console.log(output);
  await browser.close();
})();
