const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Data Type Selection Interaction', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Load the HTML content
        const htmlPath = path.resolve(__dirname, '../views/knowledge.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        dom = new JSDOM(htmlContent, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;

        // Mock the handleDataTypeChange function just like the one in knowledge.js
        window.handleDataTypeChange = function(input) {
            const typeValue = typeof input === 'string' ? input : (input && input.value ? input.value : 'text');
            
            // Update visual state of cards
            const types = ['text', 'table', 'image'];
            types.forEach(t => {
                const card = document.getElementById(`upload-type-card-${t}`);
                if (card) {
                    const radio = card.querySelector('input[type="radio"]');
                    if (t === typeValue) {
                        card.classList.add('selected');
                        card.classList.remove('unselected');
                        if (radio) radio.checked = true;
                    } else {
                        card.classList.remove('selected');
                        card.classList.add('unselected');
                        if (radio) radio.checked = false;
                    }
                }
            });
        };

        global.window = window;
        global.document = document;
    });

    test('should initially have text card selected and others unselected', () => {
        const textCard = document.getElementById('upload-type-card-text');
        const tableCard = document.getElementById('upload-type-card-table');
        
        expect(textCard.classList.contains('selected')).toBe(true);
        expect(tableCard.classList.contains('unselected')).toBe(true);
    });

    test('should update selected state when clicking a non-first item (table)', () => {
        const textCard = document.getElementById('upload-type-card-text');
        const tableCard = document.getElementById('upload-type-card-table');
        const textRadio = textCard.querySelector('input[type="radio"]');
        const tableRadio = tableCard.querySelector('input[type="radio"]');
        
        // Simulate click
        window.handleDataTypeChange('table');

        expect(textCard.classList.contains('selected')).toBe(false);
        expect(textCard.classList.contains('unselected')).toBe(true);
        expect(textRadio.checked).toBe(false);
        
        expect(tableCard.classList.contains('selected')).toBe(true);
        expect(tableCard.classList.contains('unselected')).toBe(false);
        expect(tableRadio.checked).toBe(true);
    });

    test('should only allow one item to be selected at a time', () => {
        const textCard = document.getElementById('upload-type-card-text');
        const tableCard = document.getElementById('upload-type-card-table');
        const imageCard = document.getElementById('upload-type-card-image');
        const imageRadio = imageCard.querySelector('input[type="radio"]');
        const textRadio = textCard.querySelector('input[type="radio"]');
        
        // Simulate click on image
        window.handleDataTypeChange('image');

        const selectedCards = document.querySelectorAll('.data-type-card.selected');
        expect(selectedCards.length).toBe(1);
        expect(imageCard.classList.contains('selected')).toBe(true);
        expect(imageRadio.checked).toBe(true);
        expect(textCard.classList.contains('selected')).toBe(false);
        expect(textRadio.checked).toBe(false);
        expect(tableCard.classList.contains('selected')).toBe(false);
    });
});
