// Orchestrator Editor Logic

let currentOrchId = null;
let isOrchDirty = false;

window.initOrchestratorEditor = function(params) {
    console.log('Initializing Orchestrator Editor...', params);
    
    if (params && params.id) {
        currentOrchId = params.id;
        loadOrchestratorData(params.id);
    } else {
        console.error('No orchestrator ID provided');
        alert('错误：未指定编排器ID');
        window.goBackFromOrchestrator();
        return;
    }
    
    setupEditorInteractions();
}

function loadOrchestratorData(id) {
    // Ensure data is loaded (if refreshed on this page)
    if (!window.orchestratorData || window.orchestratorData.length === 0) {
        // Fallback: Try to generate mock data or load from storage
        // For now, we just generate a dummy one if missing to prevent crash
        window.orchestratorData = [{
            id: id,
            name: '未命名编排器',
            status: 'draft'
        }];
    }
    
    const orch = window.orchestratorData.find(o => o.id === id);
    if (orch) {
        const nameInput = document.getElementById('orch-editor-name');
        if (nameInput) nameInput.value = orch.name;
        updateSaveStatus('已同步');
    }
}

function setupEditorInteractions() {
    // Name Input Auto-save
    const nameInput = document.getElementById('orch-editor-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            isOrchDirty = true;
            updateSaveStatus('保存中...');
            
            // Debounce save
            clearTimeout(window.orchSaveTimer);
            window.orchSaveTimer = setTimeout(() => {
                saveOrchestratorName(nameInput.value);
            }, 1000);
        });
    }
    
    // Draggable Interactions (Visual Only)
    const draggables = document.querySelectorAll('.draggable-node');
    draggables.forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'node');
            e.dataTransfer.effectAllowed = 'copy';
            el.classList.add('opacity-50');
        });
        
        el.addEventListener('dragend', () => {
            el.classList.remove('opacity-50');
        });
    });
    
    const canvas = document.getElementById('orch-canvas');
    if (canvas) {
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvas.classList.add('bg-blue-50/50');
        });
        
        canvas.addEventListener('dragleave', () => {
            canvas.classList.remove('bg-blue-50/50');
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('bg-blue-50/50');
            alert('节点添加功能暂未开放');
        });
    }
}

function saveOrchestratorName(newName) {
    if (!currentOrchId) return;
    
    const orch = window.orchestratorData.find(o => o.id === currentOrchId);
    if (orch) {
        orch.name = newName;
        orch.updatedAt = new Date().toLocaleString();
        updateSaveStatus('已保存');
        isOrchDirty = false;
    }
}

function updateSaveStatus(status) {
    const el = document.getElementById('orch-save-status');
    if (el) el.textContent = status;
}

window.goBackFromOrchestrator = function() {
    if (isOrchDirty) {
        saveOrchestratorName(document.getElementById('orch-editor-name').value);
    }
    // Show "Saved" toast conceptually
    // alert('已自动保存更改');
    
    if (typeof window.switchView === 'function') {
        window.switchView('orchestrator');
    } else {
        window.location.hash = '#/orchestrator';
    }
}

window.publishOrchestrator = function() {
    const btn = document.querySelector('button[onclick="publishOrchestrator()"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 发布中...';
    
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 已发布';
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');
        
        // Update Data
        const orch = window.orchestratorData.find(o => o.id === currentOrchId);
        if (orch) {
            orch.status = 'active';
        }
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            btn.classList.remove('bg-green-600', 'hover:bg-green-700');
        }, 2000);
        
        alert('编排器已成功发布！');
    }, 1500);
}

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'orchestrator-editor') {
        window.initOrchestratorEditor(e.detail.params);
    }
});
