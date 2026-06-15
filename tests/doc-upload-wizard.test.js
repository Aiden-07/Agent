const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../js/knowledge.js'), 'utf-8');

describe('Doc Upload Wizard Tests', () => {
    let dom;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
              <body>
                <div id="doc-upload-wizard" data-bound-close-handlers="false">
                    <div></div> <!-- overlay -->
                    <div> <!-- panel -->
                        <div id="step-1-indicator" class="opacity-40"><div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold shadow-sm ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all">1</div></div>
                        <div id="step-2-indicator" class="opacity-40"><div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-500 text-sm font-bold">2</div></div>
                        
                        <div id="doc-upload-step-1" class="hidden"></div>
                        <div id="doc-upload-step-2" class="hidden"></div>
                        
                        <div id="doc-upload-local-panel" class="hidden"></div>
                        <button id="doc-upload-next">下一步</button>
                    </div>
                </div>
              </body>
            </html>
        `, { runScripts: 'dangerously' });

        dom.window.showToast = jest.fn();
        dom.window.closeDocUploadWizard = jest.fn();
        
        // Setup initial global variables needed by script
        dom.window.docUploadStep = 1;
        dom.window.docUploadSliceMode = 'length';

        const scriptEl = dom.window.document.createElement('script');
        scriptEl.textContent = scriptContent;
        dom.window.document.body.appendChild(scriptEl);

        global.window = dom.window;
        global.document = dom.window.document;
        
        // Wait for script to initialize
        window.initDocUploadWizard();
        window.updateDocUploadStep();
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    test('Initial state: Step 1 should be active', () => {
        const { document, docUploadStep } = window;
        expect(docUploadStep).toBe(1);
        
        const step1 = document.getElementById('doc-upload-step-1');
        const step2 = document.getElementById('doc-upload-step-2');
        const step1Ind = document.getElementById('step-1-indicator');
        const step2Ind = document.getElementById('step-2-indicator');
        const nextBtn = document.getElementById('doc-upload-next');

        expect(step1.classList.contains('hidden')).toBe(false);
        expect(step2.classList.contains('hidden')).toBe(true);
        expect(step1Ind.classList.contains('opacity-40')).toBe(false);
        expect(step2Ind.classList.contains('opacity-40')).toBe(true);
        expect(nextBtn.textContent).toBe('下一步');
        
        const ind1Circle = step1Ind.querySelector('div');
        expect(ind1Circle.className).toContain('bg-blue-600');
    });

    test('Clicking Next Button transitions to Step 2', () => {
        const { document } = window;
        const nextBtn = document.getElementById('doc-upload-next');
        
        // Trigger click
        nextBtn.click();
        
        expect(window.docUploadStep).toBe(2);
        
        const step1 = document.getElementById('doc-upload-step-1');
        const step2 = document.getElementById('doc-upload-step-2');
        const step1Ind = document.getElementById('step-1-indicator');
        const step2Ind = document.getElementById('step-2-indicator');

        expect(step1.classList.contains('hidden')).toBe(true);
        expect(step2.classList.contains('hidden')).toBe(false);
        
        expect(step1Ind.classList.contains('opacity-40')).toBe(true);
        expect(step2Ind.classList.contains('opacity-40')).toBe(false);
        
        const ind1Circle = step1Ind.querySelector('div');
        const ind2Circle = step2Ind.querySelector('div');
        expect(ind1Circle.className).toContain('bg-gray-200');
        expect(ind2Circle.className).toContain('bg-blue-600');
        
        expect(nextBtn.textContent).toBe('完成');
    });
    
    test('Clicking Finish Button completes wizard', () => {
        const { document } = window;
        const nextBtn = document.getElementById('doc-upload-next');
        
        // Move to step 2
        nextBtn.click();
        // Click again to finish
        nextBtn.click();
        
        expect(window.closeDocUploadWizard).toHaveBeenCalled();
        expect(window.showToast).toHaveBeenCalledWith('文档上传完成', 'success');
    });
});
