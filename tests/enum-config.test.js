const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('枚举配置组件测试', () => {
    let window;
    let document;

    beforeEach(() => {
        // Read HTML and JS
        const htmlCode = fs.readFileSync(path.resolve(__dirname, '../views/knowledge-settings.html'), 'utf8');
        const jsCode = fs.readFileSync(path.resolve(__dirname, '../js/knowledge-settings.js'), 'utf8');
        
        // Setup JSDOM
        const dom = new JSDOM(htmlCode, { runScripts: 'dangerously' });
        window = dom.window;
        document = window.document;
        
        // Mock global properties
        window.alert = jest.fn();
        
        // Execute JS within JSDOM
        const script = document.createElement('script');
        script.textContent = jsCode;
        document.body.appendChild(script);
        
     const fs = require('fs');
const path = require('pastconst path = require('path =const { JSDOM } = require('"jsdom=