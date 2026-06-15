const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const statisticsJsContent = fs.readFileSync(path.resolve(__dirname, '../js/statistics.js'), 'utf8');

describe('Statistics Module', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        const virtualConsole = new jsdom.VirtualConsole();
        virtualConsole.on("error", (...args) => console.error("[JSDOM Error]", ...args));
        virtualConsole.on("jsdomError", (err) => console.error("[JSDOM System Error]", err));
        virtualConsole.sendTo(console);
        
        // Setup DOM with necessary elements
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="statistics-container">
                    <table>
                        <thead></thead>
                        <tbody id="stats-table-body"></tbody>
                    </table>
                </div>
                <input id="stats-date-range" />
                <div id="stats-loading-mask" class="hidden"></div>
            </body>
            </html>
        `, {
            runScripts: "dangerously",
            resources: "usable",
            virtualConsole
        });
        window = dom.window;
        document = window.document;

        // Mock external dependencies
        window.flatpickr = jest.fn(() => ({
            selectedDates: [],
            close: jest.fn(),
            clear: jest.fn(),
            setDate: jest.fn(),
            calendarContainer: document.createElement('div')
        }));
        
        window.XLSX = {
            utils: {
                json_to_sheet: jest.fn(),
                book_new: jest.fn(),
                book_append_sheet: jest.fn()
            },
            writeFile: jest.fn()
        };

        // Execute the script
        try {
            window.eval(statisticsJsContent);
        } catch (e) {
            console.error("Script execution failed:", e);
        }
    });

    test('should expose StatisticsModule globally', () => {
        expect(window.StatisticsModule).toBeDefined();
        expect(typeof window.StatisticsModule.init).toBe('function');
    });

    test('renderHeader should create compound header structure', () => {
        window.StatisticsModule.init();
        
        const thead = document.querySelector('#statistics-container thead');
        const rows = thead.querySelectorAll('tr');
        expect(rows.length).toBe(2);

        // First row checks
        const row1Cells = rows[0].querySelectorAll('th');
        expect(row1Cells.length).toBe(4); // Dept, Dialog, Feedback (colspan 3), Satisfaction
        
        expect(row1Cells[0].textContent).toBe('部门名称');
        expect(row1Cells[0].getAttribute('rowspan')).toBe('2');
        
        expect(row1Cells[2].textContent).toContain('用户反馈');
        expect(row1Cells[2].getAttribute('colspan')).toBe('3');

        // Second row checks
        const row2Cells = rows[1].querySelectorAll('th');
        expect(row2Cells.length).toBe(3); // Like, Dislike, NoRating
        expect(row2Cells[0].textContent).toBe('点赞');
        expect(row2Cells[1].textContent).toBe('点踩');
        expect(row2Cells[2].textContent).toBe('未评价');
    });

    test('setConfig should update header text for i18n', () => {
        window.StatisticsModule.init();
        
        window.StatisticsModule.setConfig({
            headers: {
                deptName: 'Dept',
                dialogCount: 'Dialogs',
                userFeedback: 'Feedback',
                like: 'Likes',
                dislike: 'Dislikes',
                noRating: 'None',
                satisfaction: 'Score',
                feedbackTooltip: 'Tooltip'
            }
        });

        const thead = document.querySelector('#statistics-container thead');
        const rows = thead.querySelectorAll('tr');
        
        expect(rows[0].querySelectorAll('th')[0].textContent).toBe('Dept');
        expect(rows[0].querySelectorAll('th')[2].textContent).toContain('Feedback');
        expect(rows[1].querySelectorAll('th')[0].textContent).toBe('Likes');
    });

    test('should generate and render data correctly', () => {
        // Use fake timers to handle the setTimeout in loadTopLevelData
        jest.useFakeTimers();
        window.StatisticsModule.init();
        
        // Fast-forward time
        jest.runAllTimers();
        
        const tbody = document.getElementById('stats-table-body');
        expect(tbody.children.length).toBeGreaterThan(0);
        
        const firstRow = tbody.children[0];
        const cells = firstRow.querySelectorAll('td');
        // 6 columns: Name, Dialog, Like, Dislike, NoRating, Satisfaction
        expect(cells.length).toBe(6);
    });
});
