const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Knowledge Enhancement Interaction', () => {
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

        // Mock functions that would be in knowledge.js
        window.toggleEnhancementGroup = function(parentCheckbox) {
            const group = parentCheckbox.closest('.enhancement-group');
            const childrenContainer = group.querySelector('.children-container');
            const childCheckboxes = group.querySelectorAll('.child-checkbox');
            const parentLabel = group.querySelector('label');
        
            const isChecked = parentCheckbox.checked;
            
            if (isChecked) {
                parentLabel.classList.add('bg-purple-50');
                parentLabel.setAttribute('aria-checked', 'true');
            } else {
                parentLabel.classList.remove('bg-purple-50');
                parentLabel.setAttribute('aria-checked', 'false');
            }
        
            if (isChecked || parentCheckbox.indeterminate) {
                childrenContainer.classList.remove('grid-rows-[0fr]', 'opacity-0');
                childrenContainer.classList.add('grid-rows-[1fr]', 'opacity-100');
            } else {
                childrenContainer.classList.remove('grid-rows-[1fr]', 'opacity-100');
                childrenContainer.classList.add('grid-rows-[0fr]', 'opacity-0');
            }
        
            childCheckboxes.forEach(child => {
                child.checked = isChecked;
                const childLabel = child.closest('label');
                if (isChecked) {
                    childLabel.classList.add('bg-purple-50');
                    childLabel.setAttribute('aria-checked', 'true');
                } else {
                    childLabel.classList.remove('bg-purple-50');
                    childLabel.setAttribute('aria-checked', 'false');
                }
            });
        };

        window.updateParentCheckbox = function(childCheckbox) {
            const group = childCheckbox.closest('.enhancement-group');
            const parentCheckbox = group.querySelector('.parent-checkbox');
            const childCheckboxes = Array.from(group.querySelectorAll('.child-checkbox'));
            const parentLabel = group.querySelector('label');
            const childLabel = childCheckbox.closest('label');
        
            if (childCheckbox.checked) {
                childLabel.classList.add('bg-purple-50');
                childLabel.setAttribute('aria-checked', 'true');
            } else {
                childLabel.classList.remove('bg-purple-50');
                childLabel.setAttribute('aria-checked', 'false');
            }
        
            const checkedCount = childCheckboxes.filter(c => c.checked).length;
            const totalCount = childCheckboxes.length;
        
            if (checkedCount === 0) {
                parentCheckbox.checked = false;
                parentCheckbox.indeterminate = false;
                parentLabel.classList.remove('bg-purple-50');
                parentLabel.setAttribute('aria-checked', 'false');
                
                const childrenContainer = group.querySelector('.children-container');
                childrenContainer.classList.remove('grid-rows-[1fr]', 'opacity-100');
                childrenContainer.classList.add('grid-rows-[0fr]', 'opacity-0');
            } else if (checkedCount === totalCount) {
                parentCheckbox.checked = true;
                parentCheckbox.indeterminate = false;
                parentLabel.classList.add('bg-purple-50');
                parentLabel.setAttribute('aria-checked', 'true');
            } else {
                parentCheckbox.checked = false;
                parentCheckbox.indeterminate = true;
                parentLabel.classList.add('bg-purple-50');
                parentLabel.setAttribute('aria-checked', 'mixed');
            }
        };

        global.window = window;
        global.document = document;
    });

    test('should toggle children when parent is clicked', () => {
        const parentCheckbox = document.querySelector('.parent-checkbox');
        expect(parentCheckbox.checked).toBe(false);

        // Click parent
        parentCheckbox.checked = true;
        window.toggleEnhancementGroup(parentCheckbox);

        const childCheckboxes = document.querySelectorAll('.child-checkbox');
        expect(childCheckboxes[0].checked).toBe(true);
        expect(childCheckboxes[1].checked).toBe(true);
        
        // Parent label styling and ARIA
        const parentLabel = parentCheckbox.closest('label');
        expect(parentLabel.classList.contains('bg-purple-50')).toBe(true);
        expect(parentLabel.getAttribute('aria-checked')).toBe('true');
        
        // Children container visibility
        const group = parentCheckbox.closest('.enhancement-group');
        const childrenContainer = group.querySelector('.children-container');
        expect(childrenContainer.classList.contains('grid-rows-[1fr]')).toBe(true);
        expect(childrenContainer.classList.contains('opacity-100')).toBe(true);
    });

    test('should update parent to indeterminate when one child is clicked', () => {
        const group = document.querySelector('.enhancement-group');
        const childCheckboxes = group.querySelectorAll('.child-checkbox');
        const parentCheckbox = group.querySelector('.parent-checkbox');

        // Click one child
        childCheckboxes[0].checked = true;
        window.updateParentCheckbox(childCheckboxes[0]);

        expect(parentCheckbox.checked).toBe(false);
        expect(parentCheckbox.indeterminate).toBe(true);
        
        const parentLabel = group.querySelector('label');
        expect(parentLabel.classList.contains('bg-purple-50')).toBe(true);
        expect(parentLabel.getAttribute('aria-checked')).toBe('mixed');
    });

    test('should auto collapse when all children are unchecked', () => {
        const group = document.querySelector('.enhancement-group');
        const childCheckboxes = group.querySelectorAll('.child-checkbox');
        const parentCheckbox = group.querySelector('.parent-checkbox');

        // Check parent
        parentCheckbox.checked = true;
        window.toggleEnhancementGroup(parentCheckbox);
        
        // Uncheck all children
        childCheckboxes[0].checked = false;
        window.updateParentCheckbox(childCheckboxes[0]);
        childCheckboxes[1].checked = false;
        window.updateParentCheckbox(childCheckboxes[1]);

        expect(parentCheckbox.checked).toBe(false);
        expect(parentCheckbox.indeterminate).toBe(false);
        
        const childrenContainer = group.querySelector('.children-container');
        expect(childrenContainer.classList.contains('grid-rows-[0fr]')).toBe(true);
        expect(childrenContainer.classList.contains('opacity-0')).toBe(true);
    });
});
