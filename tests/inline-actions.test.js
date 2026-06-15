// tests/inline-actions.test.js
// Unit tests for window.createInlineActions
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Inline Actions Component', () => {
    let window;
    let document;
    let createInlineActions;

    beforeAll(() => {
        // Read the utils.js file
        const jsCode = fs.readFileSync(path.resolve(__dirname, '../js/utils.js'), 'utf8');
        
        // Setup JSDOM
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: 'dangerously' });
        window = dom.window;
        document = window.document;
        
        // Mock global properties
        window.innerWidth = 1024;
        
        // Execute utils.js within the JSDOM context
        const script = document.createElement('script');
        script.textContent = jsCode;
        document.body.appendChild(script);
        
        createInlineActions = window.createInlineActions;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('1. 验证初始渲染仅显示两项', () => {
        const actions = [
            { label: 'Action 1', onClick: jest.fn() },
            { label: 'Action 2', onClick: jest.fn() },
            { label: 'Action 3', onClick: jest.fn() },
            { label: 'Action 4', onClick: jest.fn() }
        ];

        const container = createInlineActions(actions);
        document.body.appendChild(container);

        // First two are visible buttons directly in the container
        const directButtons = container.querySelectorAll(':scope > button');
        expect(directButtons.length).toBe(2);
        expect(directButtons[0].textContent).toBe('Action 1');
        expect(directButtons[1].textContent).toBe('Action 2');

        // More button exists
        const moreBtn = container.querySelector('button[aria-expanded]');
        expect(moreBtn).not.toBeNull();
        expect(moreBtn.getAttribute('aria-expanded')).toBe('false');
        expect(moreBtn.querySelector('.more-text').textContent.trim()).toBe('更多 (+2)');
        
        // The hidden list is not accessible
        const expandList = container.querySelector('.absolute');
        expect(expandList.style.maxHeight).toBe('0px');
    });

    test('2. 点击后展示全部', () => {
        const actions = [
            { label: 'Action 1', onClick: jest.fn() },
            { label: 'Action 2', onClick: jest.fn() },
            { label: 'Action 3', onClick: jest.fn() },
            { label: 'Action 4', onClick: jest.fn() }
        ];

        const container = createInlineActions(actions);
        document.body.appendChild(container);

        const moreBtn = container.querySelector('button[aria-expanded]');
        
        // Simulate click
        moreBtn.click();
        
        // Verify state changed
        expect(moreBtn.getAttribute('aria-expanded')).toBe('true');
        expect(moreBtn.querySelector('.more-text').textContent.trim()).toBe('收起');
        
        const expandList = container.querySelector('.absolute');
        expect(expandList.style.opacity).toBe('1');
        expect(expandList.style.pointerEvents).toBe('auto');
    });

    test('3. 再次点击收起', () => {
        const actions = [
            { label: 'Action 1', onClick: jest.fn() },
            { label: 'Action 2', onClick: jest.fn() },
            { label: 'Action 3', onClick: jest.fn() },
            { label: 'Action 4', onClick: jest.fn() }
        ];

        const container = createInlineActions(actions);
        document.body.appendChild(container);

        const moreBtn = container.querySelector('button[aria-expanded]');
        
        // Expand
        moreBtn.click();
        expect(moreBtn.getAttribute('aria-expanded')).toBe('true');
        
        // Collapse
        moreBtn.click();
        expect(moreBtn.getAttribute('aria-expanded')).toBe('false');
        expect(moreBtn.querySelector('.more-text').textContent.trim()).toBe('更多 (+2)');
        
        const expandList = container.querySelector('.absolute');
        expect(expandList.style.maxHeight).toBe('0px');
    });

    test('4. 键盘导航顺序正确 (tabindex更新)', () => {
        const actions = [
            { label: 'Action 1', onClick: jest.fn() },
            { label: 'Action 2', onClick: jest.fn() },
            { label: 'Action 3', onClick: jest.fn() },
            { label: 'Action 4', onClick: jest.fn() }
        ];

        const container = createInlineActions(actions);
        document.body.appendChild(container);

        const moreBtn = container.querySelector('button[aria-expanded]');
        const expandList = container.querySelector('.absolute');
        const hiddenButtons = expandList.querySelectorAll('button');

        // Initially hidden buttons should have tabindex="-1"
        hiddenButtons.forEach(btn => {
            expect(btn.getAttribute('tabindex')).toBe('-1');
        });

        // Expand
        moreBtn.click();

        // After expanding, they should have tabindex="0"
        hiddenButtons.forEach(btn => {
            expect(btn.getAttribute('tabindex')).toBe('0');
        });
        
        // Collapse
        moreBtn.click();
        
        // After collapsing, they should revert to tabindex="-1"
        hiddenButtons.forEach(btn => {
            expect(btn.getAttribute('tabindex')).toBe('-1');
        });
    });
});
