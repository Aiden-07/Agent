const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('views/knowledge.html', 'utf8');
const js = fs.readFileSync('js/knowledge.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
const window = dom.window;
const document = window.document;

// Mock localStorage and requestAnimationFrame
Object.defineProperty(window, 'localStorage', {
    value: { getItem: () => null, setItem: () => {} },
    writable: true
});
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const scriptEl = document.createElement("script");
scriptEl.textContent = js;
document.body.appendChild(scriptEl);

document.dispatchEvent(new window.Event('DOMContentLoaded'));

setTimeout(() => {
    const vlmItem = document.querySelector('[data-value="vlm"]');
    const ocrItem = document.querySelector('[data-value="ocr"]');
    
    console.log("--- BEFORE CLICK ---");
    console.log("OCR aria-checked:", ocrItem.getAttribute('aria-checked'));
    console.log("VLM aria-checked:", vlmItem.getAttribute('aria-checked'));
    console.log("VLM classList:", vlmItem.className);
    
    // Simulate click on VLM
    vlmItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    
    setTimeout(() => {
        console.log("\n--- AFTER CLICK ---");
        console.log("OCR aria-checked:", ocrItem.getAttribute('aria-checked'));
        console.log("VLM aria-checked:", vlmItem.getAttribute('aria-checked'));
        console.log("VLM classList:", vlmItem.className);
        
        const icon = vlmItem.querySelector('.w-8.h-8');
        console.log("VLM Icon classList:", icon.className);
    }, 100);
}, 100);
