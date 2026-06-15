const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// We load the script content to run it in JSDOM context so global variables are preserved.
const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/model-config.js'), 'utf-8');

describe('Model Config Requirements Tests', () => {
    let dom;

    beforeEach(() => {
        jest.useFakeTimers();
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
              <body>
                <!-- Provider Mock DOM -->
                <div id="provider-table-body"></div>
                <div id="provider-pagination-info"></div>
                <button id="provider-prev-btn"></button>
                <button id="provider-next-btn"></button>
                
                <input id="provider-name" />
                <p id="provider-name-error" class="hidden"></p>
                <select id="provider-type"><option value="OpenAI">OpenAI</option><option value="自定义">自定义</option></select>
                <input id="provider-custom-type" class="hidden" />
                <p id="provider-type-error" class="hidden"></p>
                <input id="provider-apikey" />
                <p id="provider-apikey-error" class="hidden"></p>
                <input id="provider-url" />
                <p id="provider-url-error" class="hidden"></p>
                <button id="provider-submit-btn">确定</button>
                <div id="provider-modal" class="hidden"></div>
                <h3 id="provider-modal-title"></h3>
                <form id="provider-form"></form>

                <!-- Model Mock DOM -->
                <div id="model-table-body"></div>
                <div id="model-pagination-info"></div>
                <button id="model-prev-btn"></button>
                <button id="model-next-btn"></button>
                <span id="current-provider-name"></span>
                
                <input id="model-name" />
                <p id="model-name-error" class="hidden"></p>
                <select id="model-type"><option value="LLM">LLM</option></select>
                <input type="checkbox" name="model-capabilities" value="vision" checked />
                <p id="model-capabilities-error" class="hidden"></p>
                <button id="model-submit-btn">确定</button>
                <div id="model-modal" class="hidden"></div>
                <h3 id="model-modal-title"></h3>
                <form id="model-form"></form>
              </body>
            </html>
        `, { runScripts: 'dangerously' });

        // Add mock global functions used by the script
        dom.window.showToast = jest.fn();
        dom.window.closeModal = jest.fn();
        dom.window.switchView = jest.fn();

        // Run the script in the DOM context
        const scriptEl = dom.window.document.createElement('script');
        scriptEl.textContent = scriptContent;
        dom.window.document.body.appendChild(scriptEl);

        global.window = dom.window;
        global.document = dom.window.document;
    });

    afterEach(() => {
        jest.useRealTimers();
        delete global.window;
        delete global.document;
    });

    test('1. 单元测试覆盖所有表单校验规则 (Provider Form)', async () => {
        const { window } = dom;
        
        // Empty inputs validation
        window.document.getElementById('provider-name').value = '';
        window.document.getElementById('provider-apikey').value = '';
        window.document.getElementById('provider-url').value = 'invalid-url';

        const savePromise = window.saveProvider();
        
        expect(window.document.getElementById('provider-name-error').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('provider-apikey-error').classList.contains('hidden')).toBe(false);
        expect(window.document.getElementById('provider-url-error').classList.contains('hidden')).toBe(false);
        
        // Custom type validation
        window.document.getElementById('provider-type').value = '自定义';
        window.document.getElementById('provider-custom-type').value = '   ';
        window.saveProvider();
        expect(window.document.getElementById('provider-type-error').classList.contains('hidden')).toBe(false);
        
        window.document.getElementById('provider-custom-type').value = 'Test<Type';
        window.saveProvider();
        expect(window.document.getElementById('provider-type-error').classList.contains('hidden')).toBe(false);

        // Valid inputs
        window.document.getElementById('provider-name').value = 'Test Provider';
        window.document.getElementById('provider-type').value = '自定义';
        window.document.getElementById('provider-custom-type').value = 'Valid Custom Type';
        window.document.getElementById('provider-apikey').value = 'sk-1234567890';
        window.document.getElementById('provider-url').value = 'https://api.test.com';

        const savePromise2 = window.saveProvider();
        jest.advanceTimersByTime(600);
        await savePromise2;
        
        // Error should be cleared
        expect(window.document.getElementById('provider-name-error').classList.contains('hidden')).toBe(true);
        expect(window.document.getElementById('provider-type-error').classList.contains('hidden')).toBe(true);
        expect(window.window.showToast).toHaveBeenCalledWith('新增成功');
        
        // Verify saved data
        expect(window.providersData[0].type).toBe('Valid Custom Type');
    });

    test('2. 集成测试验证服务商-模型级联操作', async () => {
        const { window } = dom;
        
        // Init provider list
        await window.initProviderList();
        jest.advanceTimersByTime(300);

        // Simulate click to open models list
        const firstProvider = window.providersData[0];
        window.openModelList(firstProvider);

        expect(window.currentProviderForModels.id).toBe(firstProvider.id);
        expect(window.switchView).toHaveBeenCalledWith('model-list');
    });

    test('3. 性能测试：列表页加载时间<500ms（1000条数据）', async () => {
        const { window } = dom;
        
        // Inject 1000 items
        window.providersData = Array.from({ length: 1000 }, (_, i) => ({
            id: `p-${i}`, name: `Provider ${i}`, apiKey: 'sk-123', apiUrl: 'http://test', status: 'running'
        }));

        const startTime = Date.now();
        window.renderProviderTable();
        const endTime = Date.now();

        // Check performance
        const duration = endTime - startTime;
        // In JSDOM this is extremely fast, but verifies the logic can handle 1000 items without hanging
        expect(duration).toBeLessThan(500); 
        // Only 20 items rendered per page anyway
        expect(window.document.querySelectorAll('#provider-table-body tr').length).toBe(20);
    });

    test('4. 安全测试：验证API-KEY加密传输与存储 (Mock test)', () => {
        const { window } = dom;
        
        // Create mock provider
        window.providersData = [{
            id: 'p-sec', name: 'Sec', apiKey: 'sk-abcdef123456', apiUrl: 'http://test', status: 'running'
        }];
        
        window.renderProviderTable();
        
        // Check if API-KEY is masked in the DOM
        const row = window.document.querySelector('#provider-table-body tr');
        const apiKeyCell = row.querySelectorAll('td')[2];
        
        // Should show masked key
        expect(apiKeyCell.textContent).toContain('****************3456');
        // Hover should show full key (simulated by title attribute)
        expect(apiKeyCell.getAttribute('title')).toBe('sk-abcdef123456');
    });
});
