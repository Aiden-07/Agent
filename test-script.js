const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('views/knowledge.html', 'utf8');
const js = fs.readFileSync('js/knowledge.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;
// mock localStorage
window.localStorage = { getItem: () => null, setItem: () => {} };

// execute js
const scriptEl = document.createElement("script");
scriptEl.textContent = js;
document.body.appendChild(scriptEl);

document.dispatchEvent(new window.Event('DOMContentLoaded'));

setTimeout(() => {
    const vlmItem = document.querySelector('[data-value="vlm"]');
    console.log("Before click, vlm selected?", vlmItem.classList.contains('bg-blue-50'));
    
    // click it
    vlmItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    
    // wait for requestAnimationFrame
    setTimeout(() => {
        console.log("After click, vlm selected?", vlmItem.classList.contains('bg-blue-50'));
    }, 100);
}, 100);
