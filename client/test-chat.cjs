const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Intercept console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    console.log("Navigating to auth...");
    await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });

    // Login
    await page.type('input[type="email"]', 'test@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    console.log("Waiting for dashboard...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log("Navigating to chat...");
    await page.goto('http://localhost:5173/dashboard/chat', { waitUntil: 'networkidle2' });

    // Wait for chat input to be available
    await page.waitForSelector('input[placeholder="Ask your AI career coach..."]');

    // Type message
    console.log("Typing message...");
    await page.type('input[placeholder="Ask your AI career coach..."]', 'Hello Puppeteer!');

    console.log("Pressing Enter...");
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 1000));

    // Check if input was cleared
    const inputValue = await page.$eval('input[placeholder="Ask your AI career coach..."]', el => el.value);
    console.log("Input value after Enter:", inputValue);

    // Click Send button
    console.log("Clicking Send button...");
    await page.click('button.bg-blue-electric');

    await new Promise(r => setTimeout(r, 1000));

    const inputValue2 = await page.$eval('input[placeholder="Ask your AI career coach..."]', el => el.value);
    console.log("Input value after Send click:", inputValue2);

    await browser.close();
})();
