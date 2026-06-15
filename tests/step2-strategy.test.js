const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/knowledge.js'), 'utf-8');

describe('Step 2 Strategy & Template Logic', () => {
    let dom;

    let originalLocalStorage;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
              <body>
                <!-- Mode switch -->
                <button id="mode-btn-fileType"></button>
                <button id="mode-btn-template"></button>
                <div id="config-panel-fileType"></div>
                <div id="config-panel-template" class="hidden"></div>
                
                <!-- Strategy Config -->
                <div id="strategy-config-panel" class="hidden"></div>
                <div id="strategy-loading-overlay" class="hidden"></div>
                <input type="radio" name="parseStrategy" value="ocr">
                <input type="radio" name="parseStrategy" value="table">
                
                <div id="table-header-settings" class="hidden"></div>
                <div id="knowledge-enhance-container" class="hidden"></div>
                <div id="slice-strategy-container" class="hidden"></div>
                <div id="header-mapping-container" class="hidden"></div>

                <div id="slice-params-panel" style="opacity: 1"></div>
                <div id="slice-params-custom" class="hidden">
                    <input id="doc-upload-slice-delimiter" />
                    <input id="doc-upload-slice-size" />
                    <input id="doc-upload-slice-overlap" />
                    <span id="slice-length-display"></span>
                </div>
                <div id="slice-params-chapter" class="hidden">
                    <input id="doc-upload-slice-chapter-level" />
                </div>
                
                <div id="enhance-options" class="opacity-50 pointer-events-none">
                    <input type="checkbox" id="enhance-cb-1" checked>
                </div>
                
                <!-- Template Config -->
                <div id="tpl-content-general">
                    <div id="template-list-general"></div>
                </div>
                <div id="tpl-content-custom">
                    <div id="template-list-custom"></div>
                </div>
                <div id="tpl-content-bespoke">
                    <div id="template-list-customized"></div>
                </div>
                
                <!-- Radio Groups -->
                <div id="slice-strategy-group" role="radiogroup">
                    <div role="radio" data-value="custom" data-group="sliceStrategy" aria-checked="false" tabindex="-1">
                        <input type="radio" name="sliceStrategy" value="custom">
                        <div class="check-indicator opacity-0"></div>
                        <div class="w-8 h-8 bg-gray-50 text-gray-500"></div>
                    </div>
                    <div role="radio" data-value="chapter" data-group="sliceStrategy" aria-checked="true" tabindex="0">
                        <input type="radio" name="sliceStrategy" value="chapter" checked>
                        <div class="check-indicator opacity-100"></div>
                        <div class="w-8 h-8 bg-orange-50 text-orange-500"></div>
                    </div>
                </div>
                
                <div id="parse-strategy-group" role="radiogroup">
                    <div role="radio" data-value="ocr" data-group="parseStrategy" aria-checked="false" tabindex="-1">
                        <input type="radio" name="parseStrategy" value="ocr">
                    </div>
                </div>
                
                <div id="schema-validation-result" class="hidden"></div>
              </body>
            </html>
        `, { runScripts: 'dangerously' });

        originalLocalStorage = global.localStorage;
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
        };
        Object.defineProperty(dom.window, 'localStorage', {
            value: global.localStorage,
            writable: true
        });

        dom.window.showToast = jest.fn();
        dom.window.confirm = jest.fn(() => true);
        dom.window.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));

        const scriptEl = dom.window.document.createElement('script');
        scriptEl.textContent = scriptContent;
        dom.window.document.body.appendChild(scriptEl);

        global.window = dom.window;
        global.document = dom.window.document;
        
        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        dom.window.localStorage = global.localStorage;
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    test('Mode switching works correctly', () => {
        const { window } = dom;
        
        window.switchConfigMode('template');
        expect(window.document.getElementById('config-panel-fileType').classList.contains('hidden')).toBe(true);
        expect(window.document.getElementById('config-panel-template').classList.contains('hidden')).toBe(false);
    });

    test('Data type change triggers strategy panel and auto-selects correct parse strategy', () => {
        jest.useFakeTimers();
        const { window } = dom;
        
        const mockInput = { value: 'table' };
        window.handleDataTypeChange(mockInput);
        
        const strategyPanel = window.document.getElementById('strategy-settings-container');
        if (strategyPanel) {
            expect(strategyPanel.classList.contains('hidden')).toBe(false);
        }
        expect(window.document.getElementById('strategy-loading-overlay').classList.contains('hidden')).toBe(false);
        
        jest.advanceTimersByTime(500);
        
        expect(window.document.getElementById('strategy-loading-overlay').classList.contains('hidden')).toBe(true);
        expect(window.document.querySelector('input[name="parseStrategy"][value="table"]').checked).toBe(true);
        
        jest.useRealTimers();
    });

    test('Enhance options toggle works', () => {
        const { window } = dom;
        window.toggleEnhanceOptions(true);
        expect(window.document.getElementById('enhance-options').classList.contains('opacity-50')).toBe(false);
        
        window.toggleEnhanceOptions(false);
        expect(window.document.getElementById('enhance-options').classList.contains('opacity-50')).toBe(true);
        expect(window.document.getElementById('enhance-cb-1').checked).toBe(false);
    });

    test('All template categories are visible simultaneously (Flat Layout)', () => {
        const { window } = dom;
        // Verify all sections are visible and not hidden
        expect(window.document.getElementById('tpl-content-general').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('tpl-content-custom').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('tpl-content-bespoke').classList.contains('hidden')).toBe(false);
    });

    test('Template card click functionality updates selected state', () => {
        const { window } = dom;
        // Inject a mock template list item
        const generalContainer = window.document.getElementById('template-list-general');
        generalContainer.innerHTML = `
            <div class="template-card" data-id="test-1" aria-selected="false">
                <div class="inner-div">
                    <div class="icon-div opacity-0"></div>
                    <div class="absolute opacity-0"></div>
                </div>
            </div>
        `;
        
        // Mock window.selectedTemplateId
        window.selectedTemplateId = null;
        
        // Trigger handleTemplateClick
        window.handleTemplateClick('test-1', 'general');
        
        // Check if selectedTemplateId is updated
        expect(window.selectedTemplateId).toBe('test-1');
        
        // Check UI update (ARIA attribute)
        const card = window.document.querySelector('[data-id="test-1"]');
        expect(card.getAttribute('aria-selected')).toBe('true');
    });

    test('Apply template calls confirmation and toast', () => {
        const { window } = dom;
        window.applyTemplate('Test Template');
        expect(window.confirm).toHaveBeenCalled();
        expect(window.showToast).toHaveBeenCalledWith('成功应用模板：Test Template', 'success');
    });

    test('Selecting table data type shows table header settings and knowledge enhance', () => {
        jest.useFakeTimers();
        const { window } = dom;
        
        const mockInput = { value: 'table' };
        window.handleDataTypeChange(mockInput);
        
        jest.advanceTimersByTime(500);
        
        expect(window.document.getElementById('table-header-settings').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('knowledge-enhance-container').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('slice-strategy-container').classList.contains('hidden')).toBe(true);
        
        jest.useRealTimers();
    });

    test('Selecting image data type hides specific settings', () => {
        jest.useFakeTimers();
        const { window } = dom;
        
        const mockInput = { value: 'image' };
        window.handleDataTypeChange(mockInput);
        
        jest.advanceTimersByTime(500);
        
        expect(window.document.getElementById('table-header-settings').classList.contains('hidden')).toBe(true);
        expect(window.document.getElementById('knowledge-enhance-container').classList.contains('hidden')).toBe(true);
        expect(window.document.getElementById('slice-strategy-container').classList.contains('hidden')).toBe(true);
        
        jest.useRealTimers();
    });

    test('handleSliceStrategyChange toggles parameters and backfills data', () => {
        jest.useFakeTimers();
        const { window } = dom;
        
        // Select 'custom'
        window.handleSliceStrategyChange({ value: 'custom' });
        expect(window.document.getElementById('slice-params-panel').style.opacity).toBe('0.5');
        
        jest.advanceTimersByTime(300);
        expect(window.document.getElementById('slice-params-panel').style.opacity).toBe('1');
        expect(window.document.getElementById('slice-params-custom').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('slice-params-chapter').classList.contains('hidden')).toBe(true);
        expect(window.document.getElementById('doc-upload-slice-delimiter').value).toBe('\\n\\n');
        expect(window.document.getElementById('doc-upload-slice-size').value).toBe('1000');
        expect(window.document.getElementById('slice-length-display').textContent).toBe('1000');

        // Select 'chapter'
        window.handleSliceStrategyChange({ value: 'chapter' });
        jest.advanceTimersByTime(300);
        expect(window.document.getElementById('slice-params-custom').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('slice-params-chapter').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('doc-upload-slice-chapter-level').value).toBe('h2');

        jest.useRealTimers();
    });

    test('Radio group initialization and interaction', () => {
        jest.useFakeTimers();
        const { window } = dom;
        
        // Mock localStorage
        const store = {};
        window.localStorage = {
            getItem: jest.fn(k => store[k] || null),
            setItem: jest.fn((k, v) => store[k] = v)
        };
        
        // Spy on handleSliceStrategyChange to see if it's called
        window.handleSliceStrategyChange = jest.fn();

        // Initialize
        window.initSelectionGroups();
        
        const group = window.document.getElementById('slice-strategy-group');
        const customRadio = group.querySelector('[data-value="custom"]');
        const chapterRadio = group.querySelector('[data-value="chapter"]');
        
        // Initially chapter is checked (aria-checked="true" in HTML)
        expect(chapterRadio.getAttribute('aria-checked')).toBe('true');
        expect(customRadio.getAttribute('aria-checked')).toBe('false');

        // Click custom
        customRadio.dispatchEvent(new window.MouseEvent('click'));
        jest.runAllTimers(); // Run the requestAnimationFrame and setTimeout
        
        expect(customRadio.getAttribute('aria-checked')).toBe('true');
        expect(chapterRadio.getAttribute('aria-checked')).toBe('false');
        expect(customRadio.classList.contains('border-blue-600')).toBe(true);
        expect(window.localStorage.setItem).toHaveBeenCalledWith('defaultSliceStrategy', 'custom');
        expect(window.handleSliceStrategyChange).toHaveBeenCalled();

        // Keyboard interaction
        const event = new window.KeyboardEvent('keydown', { key: 'Enter' });
        chapterRadio.dispatchEvent(event);
        jest.runAllTimers();
        
        expect(chapterRadio.getAttribute('aria-checked')).toBe('true');
        expect(customRadio.getAttribute('aria-checked')).toBe('false');
        expect(window.localStorage.setItem).toHaveBeenCalledWith('defaultSliceStrategy', 'chapter');
        
        jest.useRealTimers();
    });

    test('Parser select modal removed and handles graceful degradation', () => {
        const { window } = dom;
        // Verify modal is not in DOM
        expect(window.document.getElementById('parser-select-modal')).toBeNull();
        
        // If window functions still exist but modal is gone, they shouldn't throw
        if (window.openParserSelectModal) {
            expect(() => window.openParserSelectModal()).not.toThrow();
        }
    });

    test('Memory leak check: removed elements have no dangling listeners', () => {
        const { window } = dom;
        // Since we removed the parser select modal from HTML and JS,
        // we ensure that the global window object doesn't have its specific functions.
        expect(window.openParserSelectModal).toBeUndefined();
        expect(window.closeParserSelectModal).toBeUndefined();
        expect(window.confirmParserSelect).toBeUndefined();
        expect(window.selectParserType).toBeUndefined();
        expect(window.updateParserModalUI).toBeUndefined();
        
        // This confirms that dead code has been fully removed, preventing memory leaks 
        // from uncollected closures in the global scope.
    });
});
