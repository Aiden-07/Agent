const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Sidebar Functionality Tests', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Setup DOM
        const html = `
            <!DOCTYPE html>
            <html>
            <body>
                <aside id="main-sidebar" class="w-64 transform -translate-x-full">
                    <span class="nav-text">Test Text</span>
                    <i class="nav-icon"></i>
                </aside>
                <div id="mobile-overlay" class="hidden opacity-0"></div>
            </body>
            </html>
        `;
        dom = new JSDOM(html, { runScripts: 'dangerously' });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.localStorage = {
            store: {},
            getItem: jest.fn(key => global.localStorage.store[key] || null),
            setItem: jest.fn((key, value) => { global.localStorage.store[key] = value.toString(); }),
            removeItem: jest.fn(key => { delete global.localStorage.store[key]; })
        };
        global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
        jest.useFakeTimers();

        // Load utils.js
        const utilsPath = path.resolve(__dirname, '../js/utils.js');
        const utilsCode = fs.readFileSync(utilsPath, 'utf8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = utilsCode;
        document.body.appendChild(scriptEl);
    });

    afterEach(() => {
        jest.useRealTimers();
        delete global.window;
        delete global.document;
        delete global.localStorage;
        delete global.requestAnimationFrame;
    });

    test('toggleSidebar should toggle sidebar-collapsed class and save to localStorage', () => {
        const sidebar = document.getElementById('main-sidebar');
        expect(sidebar.classList.contains('sidebar-collapsed')).toBe(false);

        // Call toggleSidebar
        window.toggleSidebar();

        expect(sidebar.classList.contains('sidebar-collapsed')).toBe(true);
        expect(global.localStorage.setItem).toHaveBeenCalledWith('sidebarCollapsed', true);

        // Call toggleSidebar again
        window.toggleSidebar();

        expect(sidebar.classList.contains('sidebar-collapsed')).toBe(false);
        expect(global.localStorage.setItem).toHaveBeenCalledWith('sidebarCollapsed', false);
    });

    test('initSidebarState should restore state from localStorage', () => {
        const sidebar = document.getElementById('main-sidebar');
        
        // Setup initial localStorage
        global.localStorage.store['sidebarCollapsed'] = 'true';

        // Call initSidebarState
        window.initSidebarState();

        expect(sidebar.classList.contains('sidebar-collapsed')).toBe(true);
    });

    test('toggleMobileSidebar should toggle mobile overlay and sidebar transform', () => {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');

        // Initial state: closed
        expect(sidebar.classList.contains('-translate-x-full')).toBe(true);
        expect(overlay.classList.contains('hidden')).toBe(true);

        // Call toggleMobileSidebar to open
        window.toggleMobileSidebar();

        expect(sidebar.classList.contains('-translate-x-full')).toBe(false);
        expect(overlay.classList.contains('hidden')).toBe(false);
        
        // requestAnimationFrame will be executed after a short delay
        jest.advanceTimersByTime(1);
        expect(overlay.classList.contains('opacity-0')).toBe(false);

        // Call toggleMobileSidebar to close
        window.toggleMobileSidebar();

        expect(sidebar.classList.contains('-translate-x-full')).toBe(true);
        expect(overlay.classList.contains('opacity-0')).toBe(true);
        
        // setTimeout for adding 'hidden'
        jest.advanceTimersByTime(300);
        expect(overlay.classList.contains('hidden')).toBe(true);
    });
});