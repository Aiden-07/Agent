
let selectedDocIds = new Set();

function toggleAllDocs(checkbox) {
    const isChecked = checkbox.checked;
    selectedDocIds.clear();
    
    // Use filteredDocs logic to only select visible/filtered items if desired
    // For simplicity, let's assume we select from currently visible docs in render context
    // But since this is a global function, we need to access current context or data.
    // Let's use mockDocs filtered by search query.
    
    const query = (window.docSearchQuery || '').toLowerCase();
    const docs = mockDocs.filter(doc => doc.name.toLowerCase().includes(query));
    
    if (isChecked) {
        docs.forEach(doc => selectedDocIds.add(doc.id));
    }
    
    renderDocList();
}

function toggleDocSelection(id) {
    if (selectedDocIds.has(id)) {
        selectedDocIds.delete(id);
    } else {
        selectedDocIds.add(id);
    }
    renderDocList();
}
