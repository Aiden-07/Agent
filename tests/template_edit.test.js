describe('Template Editing functionality', () => {
    beforeEach(() => {
        global.window = {};
        global.document = {
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            createElement: function() { return {}; },
            getElementById: function() { return { classList: { add: function(){}, remove: function(){} } }; }
        };
        
        window.TEMPLATE_DATA = { custom: [{ id: "c1", name: "Test Template", config: { type: "text", chunking: "custom" } }] };
        window.KNOWLEDGE_DOCS = [{ id: "d1", name: "doc1.txt", parser: "Test Template", slice: "Test Template" }, { id: "d2", name: "doc2.txt", parser: "Other", slice: "Other" }];
        
        window.currentStrategyType = "text";
        window.toggleSyncStrategy = function() {};
        window.showToast = function(msg) { window.lastToast = msg; };
        
        window.openTemplateSyncModal = function(id) {
            const template = window.TEMPLATE_DATA.custom.find(t => t.id === id);
            if (!template) return;
            const type = window.currentStrategyType;
            let chunking = global.document.querySelector()?.value;
            if (!chunking && type !== 'image') {
                if(window.showToast) window.showToast('参数验证失败：请选择切片策略', 'error');
                return;
            }
            window.currentSyncTemplateData = { id, affectedDocs: window.KNOWLEDGE_DOCS.filter(doc => doc.parser === template.name || doc.slice === template.name) };
        };
    });

    test('Validation should fail when no chunking strategy is selected', () => {
        window.openTemplateSyncModal("c1");
        expect(window.lastToast).toBe("参数验证失败：请选择切片策略");
    });

    test('Should populate currentSyncTemplateData and find affected docs', () => {
        global.document.querySelector = function() { return { value: "custom" }; };
        window.openTemplateSyncModal("c1");
        expect(window.currentSyncTemplateData).toBeDefined();
        expect(window.currentSyncTemplateData.affectedDocs.length).toBe(1);
        expect(window.currentSyncTemplateData.affectedDocs[0].id).toBe("d1");
    });
});
