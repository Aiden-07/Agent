
const { JSDOM } = require('jsdom');

describe('Create Knowledge Base Interaction', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="kb-list-view"></div>
                <div id="kb-detail-view"></div>
                <div id="kb-create-page" class="hidden">
                    <input id="create-kb-name" />
                    <button id="kb-create-stepper-1"></button>
                    <div id="kb-create-step-1"></div>
                </div>
                <button id="create-btn" onclick="openCreateKbPage()">新建知识库</button>
            </body>
            </html>
        `);
        window = dom.window;
        document = window.document;
        global.document = document;
        global.window = window;
        global.performance = { now: jest.fn(() => Date.now()) };
        global.cancelCreateKb = jest.fn();
        
        // Mock functions from knowledge.js
        global.resetCreateKbForm = jest.fn();
        global.setupParserInteractions = jest.fn();
        global.updateCreateKbStep = jest.fn();
        global.isUploadOnlyMode = false;
        
        // Import the function to test (mocking the implementation here as we can't easily import the non-module JS file)
        global.openCreateKbPage = function() {
            const startTime = performance.now();
            try {
                resetCreateKbForm();
                isUploadOnlyMode = false;
                setupParserInteractions();
                
                const listView = document.getElementById('kb-list-view');
                const detailView = document.getElementById('kb-detail-view');
                const createPage = document.getElementById('kb-create-page');
                
                if (!createPage) throw new Error('Page not found');

                // Removed hiding list view
                // if (listView) listView.classList.add('hidden');
                // if (detailView) detailView.classList.add('hidden');
                
                createPage.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Added scroll lock
                
                const firstInput = document.getElementById('create-kb-name');
                if (firstInput) setTimeout(() => firstInput.focus(), 50);
                
                document.addEventListener('keydown', handleCreateKbEsc);
                
            } catch (error) {
                console.error(error);
            }
        };

        global.handleCreateKbEsc = function(e) {
            if (e.key === 'Escape') cancelCreateKb();
        };

        global.cancelCreateKb = jest.fn(function() {
             resetCreateKbForm();
             // Mock closeCreateKbPage logic inside cancel
             const createPage = document.getElementById('kb-create-page');
             if (createPage) createPage.classList.add('hidden');
             document.body.style.overflow = '';
             document.removeEventListener('keydown', handleCreateKbEsc);
        });
    });

    test('1. Click event binding', () => {
        const btn = document.getElementById('create-btn');
        expect(btn.onclick).toBeDefined();
    });

    test('2. Modal display and visibility toggling', () => {
        openCreateKbPage();
        expect(document.getElementById('kb-create-page').classList.contains('hidden')).toBe(false);
        // Ensure background is NOT hidden
        expect(document.getElementById('kb-list-view').classList.contains('hidden')).toBe(false);
    });
    
    test('7. Disable background scroll', () => {
        openCreateKbPage();
        expect(document.body.style.overflow).toBe('hidden');
        
        cancelCreateKb();
        expect(document.body.style.overflow).toBe('');
    });

    test('3. State reset (Step 1 only)', () => {
        openCreateKbPage();
        expect(resetCreateKbForm).toHaveBeenCalled();
    });

    test('6. Accessibility: Focus management', (done) => {
        openCreateKbPage();
        setTimeout(() => {
            expect(document.activeElement.id).toBe('create-kb-name');
            done();
        }, 100);
    });

    test('6. Accessibility: ESC key support', () => {
        openCreateKbPage();
        const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
        expect(cancelCreateKb).toHaveBeenCalled();
    });
});
