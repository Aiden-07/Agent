const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Feature Config and Slice Strategy Tests', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Load the HTML and JS content for knowledge.html
        const html = fs.readFileSync(path.resolve(__dirname, '../views/knowledge.html'), 'utf8');
        const js = fs.readFileSync(path.resolve(__dirname, '../js/knowledge.js'), 'utf8');
        
        dom = new JSDOM(html, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        
        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        window.localStorage = global.localStorage;
        
        // Mock reportEvent
        window.reportEvent = jest.fn();
        
        // Load the JS
        const scriptEl = document.createElement('script');
        scriptEl.textContent = js;
        document.body.appendChild(scriptEl);
        
        // Manually dispatch DOMContentLoaded to trigger init
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
    });

    test('1. 通用解析 div is completely removed and no memory leaks', () => {
        const parserModal = document.getElementById('parser-selection-modal');
        expect(parserModal).toBeNull();
        expect(window.currentParserType).toBeUndefined();
    });

    test('2. slice-strategy-group selectable state via click and keyboard', (done) => {
        const customRadio = document.querySelector('[data-value="custom"]');
        const chapterRadio = document.querySelector('[data-value="chapter"]');
        const pageRadio = document.querySelector('[data-value="page"]');
        const group = document.getElementById('slice-strategy-group');
        
        let selectedValue = null;
        group.addEventListener('selectionChange', (e) => {
            selectedValue = e.detail.value;
        });
        
        expect(customRadio.getAttribute('aria-checked')).toBe('true');
        expect(chapterRadio.getAttribute('aria-checked')).toBe('false');
        
        // Mouse Click
        chapterRadio.click();
        
        // Need to wait for requestAnimationFrame to complete
        requestAnimationFrame(() => {
            expect(customRadio.getAttribute('aria-checked')).toBe('false');
            expect(chapterRadio.getAttribute('aria-checked')).toBe('true');
            expect(window.localStorage.setItem).toHaveBeenCalledWith('defaultSliceStrategy', 'chapter');
            expect(selectedValue).toBe('chapter');
            
            // Keyboard Arrow Navigation (Right arrow from chapter to page)
            const keydownEvent = new window.KeyboardEvent('keydown', { key: 'ArrowRight' });
            chapterRadio.dispatchEvent(keydownEvent);
            
            requestAnimationFrame(() => {
                expect(chapterRadio.getAttribute('aria-checked')).toBe('false');
                expect(pageRadio.getAttribute('aria-checked')).toBe('true');
                expect(window.localStorage.setItem).toHaveBeenCalledWith('defaultSliceStrategy', 'page');
                expect(selectedValue).toBe('page');
                
                // Touch Event
                const touchstartEvent = new window.Event('touchstart');
                customRadio.dispatchEvent(touchstartEvent);
                
                requestAnimationFrame(() => {
                    expect(pageRadio.getAttribute('aria-checked')).toBe('false');
                    expect(customRadio.getAttribute('aria-checked')).toBe('true');
                    expect(selectedValue).toBe('custom');
                    done();
                });
            });
        });
    });

    test('3. slice-strategy-group parameters loading dynamically', () => {
        jest.useFakeTimers();
        const customRadio = document.querySelector('[data-value="custom"]');
        
        customRadio.click();
        
        const parentPanel = document.getElementById('slice-params-panel');
        expect(parentPanel.style.opacity).toBe('0.5'); 
        
        jest.advanceTimersByTime(250);
        
        expect(parentPanel.style.opacity).toBe('1');
        expect(document.getElementById('slice-params-custom').classList.contains('hidden')).toBe(false);
        jest.useRealTimers();
    });

    test('4. Radio mutex and rapid click debounce handling', (done) => {
        const customRadio = document.querySelector('[data-value="custom"]');
        const chapterRadio = document.querySelector('[data-value="chapter"]');
        
        // Initial state
        expect(customRadio.getAttribute('aria-checked')).toBe('true');
        expect(chapterRadio.getAttribute('aria-checked')).toBe('false');
        
        // 1. Trigger rapid clicks on chapterRadio
        chapterRadio.click();
        chapterRadio.click();
        chapterRadio.click();
        
        // The clicks should be debounced via requestAnimationFrame and isProcessingSelection
        requestAnimationFrame(() => {
            // Verify Mutex (only one selected)
            expect(customRadio.getAttribute('aria-checked')).toBe('false');
            expect(chapterRadio.getAttribute('aria-checked')).toBe('true');
            
            // Try to click customRadio immediately (should be blocked by debounce lock)
            customRadio.click();
            
            requestAnimationFrame(() => {
                // Should still be chapter because of the 200ms lock
                expect(customRadio.getAttribute('aria-checked')).toBe('false');
                expect(chapterRadio.getAttribute('aria-checked')).toBe('true');
                
                // Wait for the debounce lock to clear
                setTimeout(() => {
                    customRadio.click();
                    requestAnimationFrame(() => {
                        expect(customRadio.getAttribute('aria-checked')).toBe('true');
                        expect(chapterRadio.getAttribute('aria-checked')).toBe('false');
                        done();
                    });
                }, 250);
            });
        });
    });
});

describe('Feature Config (Orchestrator Editor) Tests', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        const html = fs.readFileSync(path.resolve(__dirname, '../views/orchestrator-editor.html'), 'utf8');
        const js = fs.readFileSync(path.resolve(__dirname, '../js/orchestrator-editor.js'), 'utf8');
        
        dom = new JSDOM(html, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        
        global.localStorage = {
            getItem: jest.fn(() => JSON.stringify({
                contextMemory: { enabled: false, rounds: 3 },
                recommendQuestions: { enabled: false, mode: 'llm', fixedQuestions: [] },
                referenceSource: { enabled: false }
            })),
            setItem: jest.fn(),
            clear: jest.fn()
        };
        window.localStorage = global.localStorage;
        
        window.reportEvent = jest.fn();
        
        const scriptEl = document.createElement('script');
        scriptEl.textContent = js;
        document.body.appendChild(scriptEl);
        
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
    });

    test('1. Context Memory Toggle changes state and reports 埋点', () => {
        const toggle = document.getElementById('feature-context-memory-toggle');
        toggle.checked = true;
        window.handleFeatureToggle('contextMemory');
        
        expect(window.reportEvent).toHaveBeenCalledWith('feature_toggle_contextMemory', { value: true });
        expect(document.getElementById('feature-context-memory-settings').classList.contains('hidden')).toBe(false);
    });

    test('2. Context Memory Rounds Bounds Check', () => {
        const roundsInput = document.getElementById('feature-context-memory-rounds');
        roundsInput.value = '11';
        window.handleFeatureConfigSave('contextMemory');
        
        expect(roundsInput.value).toBe('10'); // Max is 10
        
        roundsInput.value = '0';
        window.handleFeatureConfigSave('contextMemory');
        expect(roundsInput.value).toBe('1'); // Min is 1
    });

    test('3. Fixed Questions CRUD', () => {
        window.addFixedQuestion();
        expect(window.localStorage.setItem).toHaveBeenCalled();
        
        window.updateFixedQuestion(0, 'Test Question 1');
        
        // Render check
        window.addFixedQuestion();
        window.removeFixedQuestion(0);
        expect(window.localStorage.setItem).toHaveBeenCalledTimes(4);
    });

    test('4. Color Strategy and aria-pressed attributes update correctly', () => {
        const toggle = document.getElementById('feature-context-memory-toggle');
        const track = document.getElementById('feature-context-memory-track');
        const label = document.getElementById('feature-context-memory-label');
        
        toggle.checked = true;
        window.handleFeatureToggle('context-memory');
        
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(track.classList.contains('is-active')).toBe(true);
        expect(label.classList.contains('is-active')).toBe(true);
        
        toggle.checked = false;
        window.handleFeatureToggle('context-memory');
        
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(track.classList.contains('is-active')).toBe(false);
        expect(label.classList.contains('is-active')).toBe(false);
    });
});

describe('Agent Editor Reference Source Toggle Tests', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        const html = fs.readFileSync(path.resolve(__dirname, '../views/agent-editor.html'), 'utf8');
        const js = fs.readFileSync(path.resolve(__dirname, '../js/agent.js'), 'utf8');
        
        dom = new JSDOM(html, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        
        window.showToast = jest.fn();
        
        const scriptEl = document.createElement('script');
        scriptEl.textContent = js;
        document.body.appendChild(scriptEl);
        
        document.dispatchEvent(new window.Event('DOMContentLoaded'));
    });

    test('1. Reference Source Toggle exists and triggers correctly', () => {
        const toggle = document.getElementById('agent-reference-source-toggle');
        expect(toggle).not.toBeNull();
        
        toggle.checked = true;
        window.toggleAgentReferenceSource();
        expect(window.showToast).toHaveBeenCalledWith('参考来源已开启', 'success');
        
        toggle.checked = false;
        window.toggleAgentReferenceSource();
        expect(window.showToast).toHaveBeenCalledWith('参考来源已关闭', 'success');
    });
});
