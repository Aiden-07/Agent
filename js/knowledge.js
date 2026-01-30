// Knowledge Base Management Logic

let knowledgeData = [];
let mockDocs = []; // Store current KB's docs
let mockTreeData = []; // Store tree structure
let currentKbId = null;
let currentTab = 'list'; // 'list' or 'knowledge'
let selectedDocId = null;
let docDisplayLimit = 20;
let isLoadingMoreDocs = false;
let docSearchQuery = '';
let treeSearchQuery = '';

// Parse Result State
let currentParseChunks = [];
let parseHistory = [];
let parseHistoryIndex = -1;
let parseIsDirty = false;
let parseOriginalText = '';

const KB_NAMES = [
    '产品文档库', '技术规范', '员工手册', '市场分析报告', '客户案例库', 
    '竞品分析', 'API接口文档', '运维操作手册', '销售话术', '法律法规库'
];
const TAGS = ['通用', '技术', '销售', '内部', '公开'];
const PERMISSIONS = ['私有', '团队可见', '公开'];

const DOC_TYPES = ['PDF', 'Word', 'Markdown', 'Text', 'Excel'];
const DOC_NAMES = [
    '用户需求规格说明书', '系统架构设计', 'API接口定义', '数据库设计文档', 
    '部署操作手册', '测试用例清单', '常见问题解答', '版本更新日志', 
    '安全审计报告', '性能测试报告'
];

const RANKS = ['总监', '经理', '助理'];
const RESPONSIBILITIES = ['工厂长', 'Team长', '本部长'];

let createKbStep = 1;
let createKbCompletedStep = 1;
let createKbFiles = [];
const createKbMaxStep = 3;
let createKbSliceSource = '';
let createKbUploading = false;
let createKbSliceMode = 'parent';
let createKbConfigTab = 'form';
const CREATE_KB_PREVIEW_FALLBACK = '这是一个用于切片预览的示例文档内容。你可以在这里看到不同的切片策略如何影响文本的分段方式。例如，按段落分割会以自然段落为边界，而按固定字符数分割则会严格根据长度进行切片。通过合理设置切片大小和重叠，可以在保证检索效果的同时，平衡索引规模与性能。';

function initKnowledgePage() {
    if (knowledgeData.length === 0) {
        knowledgeData = generateMockKnowledge(10);
    }
    renderKnowledgeList();

    const savedCreateStateRaw = localStorage.getItem('kbCreateState');
    const savedView = localStorage.getItem('currentView');
    const savedKbId = localStorage.getItem('currentKbId');
    if (savedCreateStateRaw) {
        try {
            const savedCreateState = JSON.parse(savedCreateStateRaw);
            if (savedCreateState && savedCreateState.active) {
                const listView = document.getElementById('kb-list-view');
                const detailView = document.getElementById('kb-detail-view');
                const createPage = document.getElementById('kb-create-page');
                if (listView) listView.classList.add('hidden');
                if (detailView) detailView.classList.add('hidden');
                if (createPage) createPage.classList.remove('hidden');
                createKbStep = savedCreateState.step || 1;
                createKbCompletedStep = savedCreateState.completedStep || createKbStep;
                updateCreateKbStep();
                return;
            }
        } catch (e) {}
    }

    if (savedView === 'detail' && savedKbId) {
        showKbDetail(savedKbId);
        const savedDocId = localStorage.getItem('kbSelectedDocId');
        if (savedDocId) {
            selectDoc(savedDocId);
        }
    } else {
        backToKbList();
    }
}

function generateMockKnowledge(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        const id = window.generateId ? window.generateId('KB') : `KB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const name = KB_NAMES[i % KB_NAMES.length];
        
        data.push({
            id: id,
            name: name,
            tag: TAGS[Math.floor(Math.random() * TAGS.length)],
            docCount: Math.floor(Math.random() * 500) + 10,
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            creator: 'Admin',
            permission: PERMISSIONS[Math.floor(Math.random() * PERMISSIONS.length)]
        });
    }
    return data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function generateMockDocs(count) {
    const docs = [];
    for (let i = 0; i < count; i++) {
        const type = DOC_TYPES[Math.floor(Math.random() * DOC_TYPES.length)];
        docs.push({
            id: `DOC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            name: `${DOC_NAMES[Math.floor(Math.random() * DOC_NAMES.length)]}_v${Math.floor(Math.random() * 5) + 1}.${type.toLowerCase()}`,
            type: type,
            size: `${(Math.random() * 10).toFixed(2)} MB`,
            status: Math.random() > 0.1 ? 'indexed' : 'indexing',
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            rank: RANKS[Math.floor(Math.random() * RANKS.length)],
            responsibility: RESPONSIBILITIES[Math.floor(Math.random() * RESPONSIBILITIES.length)],
            content: `This is the mock content for document...` 
        });
    }
    return docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function generateMockTree() {
    const docTypes = ['Word 文档', 'PDF 文件', 'Excel 表格', 'Markdown 笔记', '纯文本'];
    const tree = [];
    
    docTypes.forEach((typeCategory, index) => {
        const children = [];
        // Generate 3-6 files per category
        const fileCount = Math.floor(Math.random() * 4) + 3;
        for(let i=0; i<fileCount; i++) {
             const fileTypeMap = {
                 'Word 文档': 'Word',
                 'PDF 文件': 'PDF',
                 'Excel 表格': 'Excel',
                 'Markdown 笔记': 'Markdown',
                 '纯文本': 'Text'
             };
             const type = fileTypeMap[typeCategory];
             
             children.push({
                id: `FILE-${index}-${i}`,
                name: `${DOC_NAMES[Math.floor(Math.random() * DOC_NAMES.length)]}_v${i+1}`,
                type: 'file',
                fileType: type,
                parentId: `CATEGORY-${index}`,
                expanded: false
             });
        }

        tree.push({
            id: `CATEGORY-${index}`,
            name: typeCategory,
            type: 'category', // Changed from folder to category
            children: children,
            expanded: true,
            isCategory: true,
            fileTypeCategory: typeCategory // Store original category name for icon mapping
        });
    });
    
    return tree;
}

function renderKnowledgeList() {
    const tbody = document.getElementById('knowledge-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    knowledgeData.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <i class="fa-solid fa-book"></i>
                    </div>
                    <div class="font-medium text-gray-900 cursor-pointer hover:text-blue-600" onclick="showKbDetail('${item.id}')">${item.name}</div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">${item.tag}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.docCount}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.updatedAt}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.creator}</td>
            
            <td class="px-6 py-4 text-right">
                <button onclick="window.openKnowledgeActions(event, '${item.id}')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openKnowledgeActions = function(event, id) {
    window.showActionMenu(event, [
        {
            label: '配置权限',
            icon: 'fa-solid fa-user-shield',
            onClick: () => {
                const item = knowledgeData.find(k => k.id === id);
                if(item) {
                     if (window.navigateToPermissionConfig) {
                        window.navigateToPermissionConfig(id, 'knowledge_base', item.name);
                    } else {
                        console.error('navigateToPermissionConfig is not defined');
                    }
                }
            }
        },
        {
            label: '查看',
            icon: 'fa-solid fa-eye',
            onClick: () => showKbDetail(id)
        },
        {
            label: '设置',
            icon: 'fa-solid fa-gear',
            onClick: () => window.switchView('knowledge-settings', { id: id })
        },
        {
            label: '命中测试',
            icon: 'fa-solid fa-bullseye',
            iconClass: 'text-green-500',
            onClick: () => window.switchView('knowledge-testing', { id: id })
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => window.deleteKb(id)
        }
    ]);
}

function renderCreateKbRetrievalModeLegacy() {
    const wrapper = document.getElementById('create-kb-retrieval-mode-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-xs text-gray-600 mb-1">检索模式</label>
                <select id="create-kb-retrieval-mode" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm">
                    <option value="">请选择检索模式</option>
                    <option value="vector">向量检索</option>
                    <option value="fulltext">全文检索</option>
                    <option value="hybrid">混合检索</option>
                </select>
            </div>
        </div>
    `;
}



const CREATE_KB_RETRIEVAL_STORAGE_KEY = 'createKbRetrievalSettings';

function loadCreateKbRetrievalSettings() {
    try {
        const raw = localStorage.getItem(CREATE_KB_RETRIEVAL_STORAGE_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') return data;
        return {};
    } catch (e) {
        return {};
    }
}

function saveCreateKbRetrievalSetting(key, value) {
    try {
        const data = loadCreateKbRetrievalSettings() || {};
        data[key] = value;
        localStorage.setItem(CREATE_KB_RETRIEVAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
}

function bindLinkedNumberAndSlider(numberId, sliderId, storageKey) {
    const numberEl = document.getElementById(numberId);
    const sliderEl = document.getElementById(sliderId);
    if (!numberEl || !sliderEl) return;
    const numberMin = numberEl.min !== '' ? parseFloat(numberEl.min) : null;
    const numberMax = numberEl.max !== '' ? parseFloat(numberEl.max) : null;
    const sliderMin = sliderEl.min !== '' ? parseFloat(sliderEl.min) : null;
    const sliderMax = sliderEl.max !== '' ? parseFloat(sliderEl.max) : null;
    const min = numberMin !== null ? numberMin : sliderMin !== null ? sliderMin : 0;
    const max = numberMax !== null ? numberMax : sliderMax !== null ? sliderMax : 100;
    const step = numberEl.step !== '' ? parseFloat(numberEl.step) : sliderEl.step !== '' ? parseFloat(sliderEl.step) : 1;
    const stepDecimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 0;
    function normalize(val) {
        let num = parseFloat(val);
        if (isNaN(num)) num = min;
        if (num < min) num = min;
        if (num > max) num = max;
        num = Math.round(num / step) * step;
        return parseFloat(num.toFixed(stepDecimals));
    }
    function updateFromNumber() {
        const normalized = normalize(numberEl.value);
        numberEl.value = normalized;
        sliderEl.value = normalized;
        if (storageKey) {
            saveCreateKbRetrievalSetting(storageKey, normalized);
        }
    }
    function updateFromSlider() {
        const val = normalize(sliderEl.value);
        sliderEl.value = val;
        numberEl.value = val;
        if (storageKey) {
            saveCreateKbRetrievalSetting(storageKey, val);
        }
    }
    numberEl.addEventListener('input', updateFromNumber);
    sliderEl.addEventListener('input', updateFromSlider);
}

function setupCreateKbRetrievalControls() {
    const saved = loadCreateKbRetrievalSettings() || {};
    const rerankEl = document.getElementById('create-kb-rerank-model');
    if (rerankEl) {
        const savedModel = saved.rerankModel;
        if (savedModel && Array.prototype.some.call(rerankEl.options, function(opt) { return opt.value === savedModel; })) {
            rerankEl.value = savedModel;
        }
        if (!rerankEl.value && rerankEl.options.length > 0) {
            rerankEl.value = rerankEl.options[0].value;
        }
        rerankEl.onchange = function() {
            saveCreateKbRetrievalSetting('rerankModel', this.value);
        };
    }
    const weightInput = document.getElementById('create-kb-hybrid-weight');
    const weightSlider = document.getElementById('create-kb-hybrid-weight-slider');
    if (weightInput && weightSlider) {
        let value = typeof saved.weight === 'number' ? saved.weight : 0.5;
        if (value > 1) {
            value = value / 100;
        }
        weightInput.value = value;
        weightSlider.value = value;
        bindLinkedNumberAndSlider('create-kb-hybrid-weight', 'create-kb-hybrid-weight-slider', 'weight');
    }
    const initialTokInput = document.getElementById('create-kb-initial-tok');
    const initialTokSlider = document.getElementById('create-kb-initial-tok-slider');
    if (initialTokInput && initialTokSlider) {
        const value = typeof saved.initialTok === 'number' ? saved.initialTok : 25;
        initialTokInput.value = value;
        initialTokSlider.value = value;
        bindLinkedNumberAndSlider('create-kb-initial-tok', 'create-kb-initial-tok-slider', 'initialTok');
    }

    const finalTokInput = document.getElementById('create-kb-final-tok');
    const finalTokSlider = document.getElementById('create-kb-final-tok-slider');
    if (finalTokInput && finalTokSlider) {
        const value = typeof saved.finalTok === 'number' ? saved.finalTok : 10;
        finalTokInput.value = value;
        finalTokSlider.value = value;
        bindLinkedNumberAndSlider('create-kb-final-tok', 'create-kb-final-tok-slider', 'finalTok');
    }
}

function renderCreateKbRetrievalConfig() {
    const container = document.getElementById('create-kb-retrieval-config');
    if (!container) return;
    container.innerHTML = '';
    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
                <label class="block text-xs font-medium text-gray-700 mb-1">
                    Rerank 模型
                    <i class="fa-regular fa-circle-question text-gray-400 ml-1" title="用于对初步检索结果重新排序的模型，推荐选择大模型以获得更精准的排序效果。"></i>
                </label>
                <select id="create-kb-rerank-model" name="retrieval_rerank_model" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm">
                    <option value="bge-reranker-large">BAAI/bge-reranker-large (推荐)</option>
                    <option value="bge-reranker-base">BAAI/bge-reranker-base</option>
                    <option value="mce-embedding">MCE Embedding Model</option>
                    <option value="roberta-base">RoBERTa Base</option>
                </select>
            </div>
            <div class="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-medium text-gray-700">
                        权重设置
                        <i class="fa-regular fa-circle-question text-gray-400 ml-1" title="控制关键字检索与向量检索的综合占比，靠左更偏向关键字，靠右更偏向语义向量。"></i>
                    </label>
                    <span class="text-[11px] text-gray-500">当前值: <span id="create-kb-weight-display" class="font-mono">0.5</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="w-24">
                        <input id="create-kb-hybrid-weight" name="retrieval_hybrid_weight" type="number" min="0" max="1" step="0.1" value="0.5" class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-right">
                    </div>
                    <div class="flex-1">
                        <input id="create-kb-hybrid-weight-slider" type="range" min="0" max="1" step="0.1" value="0.5" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                        <div class="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                            <span>关键字检索</span>
                            <span>向量检索</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-medium text-gray-700">
                        初步检索 Tok
                        <i class="fa-regular fa-circle-question text-gray-400 ml-1" title="用于从索引中召回的初始候选数量，值越大召回越全，但性能开销越高。建议在 10-30 之间调整。"></i>
                    </label>
                    <span class="text-[11px] text-gray-500">当前值: <span id="create-kb-initial-tok-display" class="font-mono">25</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <input id="create-kb-initial-tok" type="number" min="0" max="50" step="1" value="25" class="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-right">
                    <input id="create-kb-initial-tok-slider" type="range" min="0" max="50" step="1" value="25" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                </div>
            </div>
            <div class="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-medium text-gray-700">
                        最终召回 Tok
                        <i class="fa-regular fa-circle-question text-gray-400 ml-1" title="最终返回给大模型用于回答的问题片段数量，通常应小于初步检索 Tok，以控制上下文长度。"></i>
                    </label>
                    <span class="text-[11px] text-gray-500">当前值: <span id="create-kb-final-tok-display" class="font-mono">10</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <input id="create-kb-final-tok" type="number" min="1" max="20" step="1" value="10" class="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-right">
                    <input id="create-kb-final-tok-slider" type="range" min="1" max="20" step="1" value="10" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                </div>
            </div>
        </div>
    `;
    setupCreateKbRetrievalControls();
    const weightInputDisplay = document.getElementById('create-kb-hybrid-weight');
    const weightDisplay = document.getElementById('create-kb-weight-display');
    if (weightInputDisplay && weightDisplay) {
        weightDisplay.textContent = parseFloat(weightInputDisplay.value).toFixed(1);
        weightInputDisplay.addEventListener('input', function() {
            weightDisplay.textContent = parseFloat(this.value || '0').toFixed(1);
        });
    }
    const initialTokInputDisplay = document.getElementById('create-kb-initial-tok');
    const initialTokDisplay = document.getElementById('create-kb-initial-tok-display');
    if (initialTokInputDisplay && initialTokDisplay) {
        initialTokDisplay.textContent = initialTokInputDisplay.value;
        initialTokInputDisplay.addEventListener('input', function() {
            initialTokDisplay.textContent = this.value;
        });
    }
    const finalTokInputDisplay = document.getElementById('create-kb-final-tok');
    const finalTokDisplay = document.getElementById('create-kb-final-tok-display');
    if (finalTokInputDisplay && finalTokDisplay) {
        finalTokDisplay.textContent = finalTokInputDisplay.value;
        finalTokInputDisplay.addEventListener('input', function() {
            finalTokDisplay.textContent = this.value;
        });
    }
}

function initCreateKbForm() {
    renderCreateKbRetrievalConfig();

    const dropzone = document.getElementById('create-kb-upload-dropzone');
    const fileInput = document.getElementById('create-kb-upload-input');
    if (dropzone && fileInput) {
        dropzone.onclick = () => fileInput.click();
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-blue-400', 'bg-blue-50');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-blue-400', 'bg-blue-50');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-blue-400', 'bg-blue-50');
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length) {
                addCreateKbFiles(files);
            }
        });
        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) {
                addCreateKbFiles(files);
                fileInput.value = '';
            }
        };
    }

    const sliceSizeEl = document.getElementById('create-kb-slice-size');
    const sliceOverlapEl = document.getElementById('create-kb-slice-overlap');
    if (sliceSizeEl) {
        sliceSizeEl.oninput = function() {
            updateCreateKbSlicePreview();
        };
    }
    if (sliceOverlapEl) {
        sliceOverlapEl.oninput = function() {
            updateCreateKbSlicePreview();
        };
    }

    const previewFileSelect = document.getElementById('create-kb-preview-file');
    if (previewFileSelect) {
        previewFileSelect.onchange = function() {
            selectCreateKbPreviewFile(this.value);
        };
    }

    const specialTypes = ['word', 'pdf', 'text', 'ppt', 'image', 'invoice'];
    specialTypes.forEach(function(type) {
        const el = document.getElementById('create-kb-special-type-' + type);
        if (el) {
            el.onmouseenter = function() {
                setCreateKbSpecialType(type);
            };
        }
    });

    updateCreateKbSpecialPreview('word');
}

function addCreateKbFiles(files) {
    const list = [];
    files.forEach(file => {
        const item = {
            name: file.name,
            size: file.size,
            status: 'ready',
            file: file,
            ts: Date.now()
        };
        list.push(item);
        if (!createKbSliceSource && (file.type.startsWith('text/') || file.name.endsWith('.txt'))) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = String(e.target.result || '');
                item.preview = text.slice(0, 4000);
                createKbSliceSource = item.preview;
                updateCreateKbSlicePreview();
                updateCreateKbConfigPreview();
            };
            reader.readAsText(file);
        }
    });
    createKbFiles = createKbFiles.concat(list);
    renderCreateKbFileList();
    updateCreateKbPreviewFileOptions();

    // Automatically start upload for newly added files
    startCreateKbUpload();
}

function renderCreateKbFileList() {
    const container = document.getElementById('create-kb-file-list');
    const countEl = document.getElementById('create-kb-upload-count');
    if (!container) return;
    if (countEl) countEl.textContent = `${createKbFiles.length} 个文件`;

    if (!createKbFiles.length) {
        container.innerHTML = '<div class="px-3 py-4 text-xs text-gray-400 text-center">暂无文件，请先上传</div>';
        updateCreateKbPreviewFileOptions();
        
        const previewBtn = document.getElementById('btn-parse-preview');
        if (previewBtn) previewBtn.disabled = true;
        return;
    }

    container.innerHTML = '';
    
    // Check if any file is uploaded successfully to enable preview button
    const hasUploadedFiles = createKbFiles.some(f => f.status === 'success');
    const previewBtn = document.getElementById('btn-parse-preview');
    if (previewBtn) {
        previewBtn.disabled = !hasUploadedFiles;
    }

    createKbFiles.forEach((file, index) => {
        const row = document.createElement('div');
        row.className = 'px-3 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors';
        const sizeKB = file.size / 1024;
        const sizeText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB.toFixed(1)} KB`;
        let statusClass = 'bg-gray-100 text-gray-600';
        let statusText = '待上传';
        if (file.status === 'uploading') {
        statusClass = 'bg-blue-100 text-blue-700';
        statusText = '上传中';
    } else if (file.status === 'success') {
        statusClass = 'bg-green-100 text-green-700';
        statusText = '上传完成';
    } else if (file.status === 'error') {
            statusClass = 'bg-red-100 text-red-700';
            statusText = '失败';
        }
        row.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <i class="fa-regular fa-file-lines text-gray-400 text-sm"></i>
                    <span class="text-sm text-gray-800 truncate" title="${file.name}">${file.name}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">${sizeText}</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClass}">${statusText}</span>
            <button type="button" class="text-gray-400 hover:text-red-500 text-xs" data-index="${index}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        const deleteBtn = row.querySelector('button[data-index]');
        deleteBtn.onclick = () => {
            createKbFiles.splice(index, 1);
            renderCreateKbFileList();
            updateCreateKbSlicePreview();
        };
        container.appendChild(row);
    });
    updateCreateKbPreviewFileOptions();
}

function updateCreateKbPreviewFileOptions() {
    const select = document.getElementById('create-kb-preview-file');
    const parserSelect = document.getElementById('parser-preview-file-select');
    
    // Update original select if exists
    if (select) {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = createKbFiles.length ? '选择预览文件' : '暂无可预览文件';
        select.appendChild(placeholder);
        createKbFiles.forEach(function(file, index) {
            const opt = document.createElement('option');
            opt.value = String(index);
            opt.textContent = file.name;
            select.appendChild(opt);
        });
    }

    // Update new parser select if exists
    if (parserSelect) {
        while (parserSelect.firstChild) {
            parserSelect.removeChild(parserSelect.firstChild);
        }
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = createKbFiles.length ? '选择预览文件' : '暂无可预览文件';
        parserSelect.appendChild(placeholder);
        
        // Sort by timestamp descending for the parser select
        const sortedFiles = createKbFiles.map((f, i) => ({ file: f, index: i }))
            .sort((a, b) => (b.file.ts || 0) - (a.file.ts || 0));

        sortedFiles.forEach(function(item) {
            const opt = document.createElement('option');
            opt.value = String(item.index);
            opt.textContent = item.file.name;
            parserSelect.appendChild(opt);
        });
    }
}

function getCreateKbSliceSource() {
    if (createKbSliceSource) return createKbSliceSource;
    return CREATE_KB_PREVIEW_FALLBACK;
}

function updateCreateKbSlicePreview() {
    const previewEl = document.getElementById('create-kb-slice-preview');
    const countEl = document.getElementById('create-kb-slice-count');
    const sizeEl = document.getElementById('create-kb-slice-size');
    const overlapEl = document.getElementById('create-kb-slice-overlap');
    if (!previewEl || !sizeEl || !overlapEl) return;

    const strategy = 'paragraph';
    const size = Math.max(50, Number(sizeEl.value) || 500);
    const overlap = Math.max(0, Number(overlapEl.value) || 0);
    const text = getCreateKbSliceSource();

    let slices = [];
    if (strategy === 'paragraph') {
        const parts = text.split(/\n\s*\n|。/).map(t => t.trim()).filter(Boolean);
        slices = parts;
    } else if (strategy === 'length') {
        let start = 0;
        while (start < text.length && slices.length < 50) {
            const end = Math.min(text.length, start + size);
            slices.push(text.slice(start, end));
            if (end >= text.length) break;
            start = end - overlap;
            if (start < 0) start = 0;
        }
    } else if (strategy === 'title') {
        const lines = text.split('\n');
        let current = [];
        lines.forEach(line => {
            if (/^#{1,3}\s+/.test(line) && current.length) {
                slices.push(current.join('\n'));
                current = [line];
            } else {
                current.push(line);
            }
        });
        if (current.length) slices.push(current.join('\n'));
    }

    if (!slices.length) slices = [text];

    if (countEl) countEl.textContent = `共 ${slices.length} 个切片`;
    previewEl.innerHTML = '';
    slices.slice(0, 30).forEach((slice, idx) => {
        const block = document.createElement('div');
        block.className = 'border border-gray-200 rounded-md bg-white px-3 py-2';
        block.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] text-gray-500">切片 #${idx + 1}</span>
            </div>
            <div class="text-[11px] text-gray-700 whitespace-pre-line break-words">${slice}</div>
        `;
        previewEl.appendChild(block);
    });
}

function selectCreateKbPreviewFile(index) {
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= createKbFiles.length) {
        createKbSliceSource = '';
        updateCreateKbSlicePreview();
        updateCreateKbConfigPreview();
        return;
    }
    const item = createKbFiles[idx];
    if (item.preview) {
        createKbSliceSource = item.preview;
        updateCreateKbSlicePreview();
        updateCreateKbConfigPreview();
        return;
    }
    if (item.file && (item.file.type && item.file.type.startsWith('text/') || item.name.endsWith('.txt'))) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = String(e.target.result || '');
            item.preview = text.slice(0, 4000);
            createKbSliceSource = item.preview;
            updateCreateKbSlicePreview();
            updateCreateKbConfigPreview();
        };
        reader.readAsText(item.file);
    } else {
        createKbSliceSource = '';
        updateCreateKbSlicePreview();
        updateCreateKbConfigPreview();
    }
}

function openCreateKbPage() {
    setupParserInteractions();
    const listView = document.getElementById('kb-list-view');
    const detailView = document.getElementById('kb-detail-view');
    const createPage = document.getElementById('kb-create-page');
    if (listView) listView.classList.add('hidden');
    if (detailView) detailView.classList.add('hidden');
    if (createPage) createPage.classList.remove('hidden');
    createKbStep = 1;
    createKbCompletedStep = 1;
    updateCreateKbStep();
}

function closeCreateKbPage() {
    const listView = document.getElementById('kb-list-view');
    const createPage = document.getElementById('kb-create-page');
    if (createPage) createPage.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');
}

function cancelCreateKb() {
    resetCreateKbForm();
    closeCreateKbPage();
}

function setCreateKbStep(step) {
    const target = Math.min(Math.max(1, step), createKbMaxStep);
    createKbStep = target;
    if (createKbStep > createKbCompletedStep) {
        createKbCompletedStep = createKbStep;
    }
    updateCreateKbStep();
}

function prevCreateKbStep() {
    if (createKbStep <= 1) return;
    createKbStep -= 1;
    updateCreateKbStep();
}

function nextCreateKbStep() {
    if (createKbStep === 1) {
        if (!validateCreateKbBasic()) return;
    } else if (createKbStep === 2) {
        if (!createKbFiles.length) {
            if (window.showToast) {
                window.showToast('请至少上传一个文件', 'warning');
            } else {
                alert('请至少上传一个文件');
            }
            return;
        }
        const hasPending = createKbFiles.some(function(f) {
            return f.status === 'ready' || f.status === 'error' || f.status === 'uploading';
        });
        if (hasPending) {
            startCreateKbUpload(function() {
                updateCreateKbSlicePreview();
                updateCreateKbConfigPreview();
                if (createKbStep < createKbMaxStep) {
                    createKbStep += 1;
                    if (createKbStep > createKbCompletedStep) {
                        createKbCompletedStep = createKbStep;
                    }
                    updateCreateKbStep();
                }
            });
            return;
        }
        updateCreateKbSlicePreview();
        updateCreateKbConfigPreview();
    } else if (createKbStep === 3) {
        if (!confirmCreateKbSummary()) return;
        submitCreateKb();
        return;
    }

    if (createKbStep < createKbMaxStep) {
        createKbStep += 1;
        if (createKbStep > createKbCompletedStep) {
            createKbCompletedStep = createKbStep;
        }
        updateCreateKbStep();
    }
}

function updateCreateKbStep() {
    const step1 = document.getElementById('kb-create-step-1');
    const step2 = document.getElementById('kb-create-step-2');
    const step3 = document.getElementById('kb-create-step-3');
    if (step1) step1.classList.toggle('hidden', createKbStep !== 1);
    if (step2) step2.classList.toggle('hidden', createKbStep !== 2);
    if (step3) step3.classList.toggle('hidden', createKbStep !== 3);

    const s1 = document.getElementById('kb-create-stepper-1');
    const s2 = document.getElementById('kb-create-stepper-2');
    const s3 = document.getElementById('kb-create-stepper-3');
    const applyStepperState = (btn, index) => {
        if (!btn) return;
        
        // Define base classes
        const btnBase = "flex items-center gap-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200";
        const circleBase = "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200";
        const titleBase = "transition-colors duration-200";
        const descBase = "text-[11px] transition-colors duration-200";

        // Select elements safely
        const circle = btn.querySelector('div.w-7');
        const textContainer = btn.lastElementChild;
        const title = textContainer ? textContainer.firstElementChild : null;
        const desc = textContainer ? textContainer.lastElementChild : null;
        
        const active = createKbStep === index;
        const completed = index < createKbStep;

        // Apply classes
        if (active) {
            btn.className = `${btnBase} text-blue-600`;
            if (circle) circle.className = `${circleBase} bg-blue-600 text-white`;
            if (title) title.className = `${titleBase} text-gray-700`;
            if (desc) desc.className = `${descBase} text-blue-400`;
        } else if (completed) {
            btn.className = `${btnBase} text-green-600`;
            if (circle) circle.className = `${circleBase} bg-green-500 text-white`;
            if (title) title.className = `${titleBase} text-green-600`;
            if (desc) desc.className = `${descBase} text-green-500`;
        } else {
            btn.className = `${btnBase} text-gray-400`;
            if (circle) circle.className = `${circleBase} bg-gray-100 text-gray-500`;
            if (title) title.className = `${titleBase}`; // Inherit text color
            if (desc) desc.className = `${descBase} text-gray-400`;
        }

        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
        const status = active ? 'in_progress' : completed ? 'completed' : 'not_started';
        btn.setAttribute('data-step-status', status);

        if (circle) {
            circle.innerHTML = '';
            if (completed) {
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-check text-[10px]';
                circle.appendChild(icon);
            } else {
                circle.textContent = String(index);
            }
        }
    };
    applyStepperState(s1, 1);
    applyStepperState(s2, 2);
    applyStepperState(s3, 3);

    const prevBtn = document.getElementById('kb-create-prev');
    const nextBtn = document.getElementById('kb-create-next');
    if (prevBtn) {
        prevBtn.disabled = createKbStep === 1;
        prevBtn.classList.toggle('opacity-40', createKbStep === 1);
        prevBtn.classList.toggle('cursor-not-allowed', createKbStep === 1);
    }
    if (nextBtn) {
        if (createKbStep === createKbMaxStep) {
            nextBtn.textContent = '提交';
        } else if (createKbStep === 1) {
            nextBtn.textContent = '下一步：上传文件';
        } else {
            nextBtn.textContent = '下一步：索引设置';
        }
    }
}

function startCreateKbUpload(onDone) {
    const readyFiles = createKbFiles.filter(f => f.status === 'ready' || f.status === 'error');
    
    if (readyFiles.length === 0) {
        const isUploading = createKbFiles.some(f => f.status === 'uploading');
        if (isUploading && typeof onDone === 'function') {
            // Wait for current upload to finish
            setTimeout(function() {
                startCreateKbUpload(onDone);
            }, 100);
            return;
        }
        if (typeof onDone === 'function') onDone();
        return;
    }

    createKbUploading = true;
    readyFiles.forEach(function(file) {
        file.status = 'uploading';
    });
    renderCreateKbFileList();

    setTimeout(function() {
        readyFiles.forEach(function(file) {
            if (file.status === 'uploading') {
                file.status = 'success';
            }
        });
        
        // Check if all files are finished
        const stillUploading = createKbFiles.some(f => f.status === 'uploading' || f.status === 'ready');
        if (!stillUploading) {
            createKbUploading = false;
        }
        
        renderCreateKbFileList();
        if (typeof onDone === 'function') onDone();
    }, 1000);
}

function resetCreateKbForm() {
    const nameEl = document.getElementById('create-kb-name');
    const descEl = document.getElementById('create-kb-desc');
    const parserEl = document.getElementById('create-kb-parser');
    const nameErrorEl = document.getElementById('create-kb-name-error');
    const descErrorEl = document.getElementById('create-kb-desc-error');
    if (nameEl) nameEl.value = '';
    if (descEl) descEl.value = '';
    if (parserEl) parserEl.value = 'embedding-2';
    if (nameErrorEl) nameErrorEl.classList.add('hidden');
    if (descErrorEl) descErrorEl.classList.add('hidden');
    renderCreateKbRetrievalConfig();
    createKbFiles = [];
    createKbSliceSource = '';
    renderCreateKbFileList();
    updateCreateKbSlicePreview();
    createKbStep = 1;
    createKbCompletedStep = 1;
    updateCreateKbStep();
}

function setCreateKbSpecialType(type) {
    const specialTypes = ['word', 'pdf', 'text', 'ppt', 'image', 'invoice'];
    specialTypes.forEach(function(t) {
        const el = document.getElementById('create-kb-special-type-' + t);
        if (!el) return;
        el.classList.remove('border-blue-500', 'bg-blue-50');
        el.classList.add('border-gray-200', 'bg-white');
        if (t === type) {
            el.classList.add('border-blue-500', 'bg-blue-50');
        }
    });
    updateCreateKbSpecialPreview(type);
}

function updateCreateKbSpecialPreview(type) {
    const hintEl = document.getElementById('create-kb-special-hint');
    if (!hintEl) return;
    let hint = '';
    if (type === 'word') {
        hint = '针对 Word 文档，按标题和段落结构进行切片，保留样式与层级。';
    } else if (type === 'pdf') {
        hint = '针对 PDF 文档，处理多列布局与分页符，自动合并跨页段落。';
    } else if (type === 'text') {
        hint = '针对纯文本，按换行与空行进行分段，适合日志与记录类内容。';
    } else if (type === 'ppt') {
        hint = '针对 PPT，将每一页或每个要点作为独立切片，保留层级。';
    } else if (type === 'image') {
        hint = '针对图片，结合 OCR 结果按文本块切片，可用于海报与截图。';
    } else if (type === 'invoice') {
        hint = '针对发票类结构化票据，按字段区域与行项目进行切分。';
    } else {
        hint = '将根据不同文件类型应用对应的专用切片策略。';
    }
    hintEl.textContent = hint;
}

function validateCreateKbBasic() {
    const nameEl = document.getElementById('create-kb-name');
    const descEl = document.getElementById('create-kb-desc');
    const nameErrorEl = document.getElementById('create-kb-name-error');
    const descErrorEl = document.getElementById('create-kb-desc-error');
    if (!nameEl || !descEl || !nameErrorEl || !descErrorEl) return false;
    let isValid = true;
    nameErrorEl.classList.add('hidden');
    descErrorEl.classList.add('hidden');
    nameEl.classList.remove('border-red-500');
    descEl.classList.remove('border-red-500');
    if (!nameEl.value.trim()) {
        nameErrorEl.classList.remove('hidden');
        nameEl.classList.add('border-red-500');
        isValid = false;
    }
    if (!descEl.value.trim()) {
        descErrorEl.classList.remove('hidden');
        descEl.classList.add('border-red-500');
        isValid = false;
    }
    return isValid;
}

function confirmCreateKbSummary() {
    const name = document.getElementById('create-kb-name')?.value || '';
    const rerankModel = document.getElementById('create-kb-rerank-model')?.value || '默认';
    const hybridWeight = document.getElementById('create-kb-hybrid-weight')?.value || '未设置';
    const initialTok = document.getElementById('create-kb-initial-tok')?.value || '未设置';
    const finalTok = document.getElementById('create-kb-final-tok')?.value || '未设置';
    const filesCount = createKbFiles.length;
    const summary = [
        `知识库名称：${name}`,
        `Rerank 模型：${rerankModel || '未设置'}`,
        `权重设置：${hybridWeight}`,
        `初步检索 Tok：${initialTok}`,
        `最终召回 Tok：${finalTok}`,
        `上传文件数：${filesCount}`
    ].join('\n');
    return confirm(`请确认以下配置：\n\n${summary}\n\n确认提交并构建索引吗？`);
}

function submitCreateKb() {
    const nameEl = document.getElementById('create-kb-name');
    const descEl = document.getElementById('create-kb-desc');
    const parserEl = document.getElementById('create-kb-parser');
    const rerankModelEl = document.getElementById('create-kb-rerank-model');
    const hybridWeightEl = document.getElementById('create-kb-hybrid-weight');
    const initialTokEl = document.getElementById('create-kb-initial-tok');
    const finalTokEl = document.getElementById('create-kb-final-tok');
    const nameErrorEl = document.getElementById('create-kb-name-error');
    const descErrorEl = document.getElementById('create-kb-desc-error');
    
    let isValid = true;

    // Reset Errors
    nameErrorEl.classList.add('hidden');
    descErrorEl.classList.add('hidden');
    nameEl.classList.remove('border-red-500');
    descEl.classList.remove('border-red-500');

    const name = nameEl.value.trim();
    const desc = descEl.value.trim();

    if (!name) {
        nameErrorEl.classList.remove('hidden');
        nameEl.classList.add('border-red-500');
        isValid = false;
    }
    
    if (!desc) {
        descErrorEl.classList.remove('hidden');
        descEl.classList.add('border-red-500');
        isValid = false;
    }
    
    if (!isValid) return;
    
    const newKb = {
        id: window.generateId ? window.generateId('KB') : `KB-${Date.now()}`,
        name: name,
        description: desc,
        tag: '未分类',
        docCount: 0,
        updatedAt: new Date().toLocaleString(),
        creator: 'Admin',
        permission: '私有',
        parser: parserEl.value,
        chunkSize: 500,
        retrievalMode: null,
        retrievalRerankModel: rerankModelEl ? rerankModelEl.value || null : null,
        retrievalScoreThreshold: 0.7,
        retrievalHybridWeight: hybridWeightEl && hybridWeightEl.value ? Number(hybridWeightEl.value) : null,
        retrievalInitialTok: initialTokEl && initialTokEl.value ? Number(initialTokEl.value) : null,
        retrievalFinalTok: finalTokEl && finalTokEl.value ? Number(finalTokEl.value) : null
    };
    
    knowledgeData.unshift(newKb);
    renderKnowledgeList();
    resetCreateKbForm();
    closeCreateKbPage();
    showKbDetail(newKb.id, 'list');
}

// Navigation & View Switching
function showKbDetail(kbId) {
    currentKbId = kbId;
    
    // Generate mock docs for this KB (if not already generated or if switching KBs)
    // In a real app, this would fetch from API
    // Generate more docs to test infinite scroll
    // Force regeneration to apply new mock data schema (rank/responsibility)
    mockDocs = generateMockDocs(Math.floor(Math.random() * 40) + 30);
    mockTreeData = generateMockTree();
    
    // Reset display limit and search
    docDisplayLimit = 20;
    isLoadingMoreDocs = false;
    docSearchQuery = '';
    treeSearchQuery = '';
    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) searchInput.value = '';

    // Update UI
    const listView = document.getElementById('kb-list-view');
    const detailView = document.getElementById('kb-detail-view');
    
    if (listView) listView.classList.add('hidden');
    if (detailView) detailView.classList.remove('hidden');
    
    // Set title (find KB name)
    const kb = knowledgeData.find(k => k.id === kbId);
    if (kb) {
        const titleEl = document.getElementById('kb-detail-title');
        if (titleEl) titleEl.textContent = kb.name;
    }
    
    // Restore tab state or default to list
    const savedTab = localStorage.getItem('kbCurrentTab') || 'list';
    switchKbTab(savedTab);
    
    // Render content
    renderDocList();
    renderDocTree();
    
    // Setup Scroll Listener
    const scrollContainer = document.getElementById('doc-list-scroll-container');
    if (scrollContainer) {
        scrollContainer.onscroll = () => {
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50) {
                loadMoreDocs();
            }
        };
    }
    
    // Save state
    localStorage.setItem('currentView', 'detail');
    localStorage.setItem('currentKbId', kbId);
}

function backToKbList() {
    const listView = document.getElementById('kb-list-view');
    const detailView = document.getElementById('kb-detail-view');
    
    if (detailView) detailView.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');
    
    currentKbId = null;
    selectedDocId = null;
    localStorage.removeItem('currentView');
    localStorage.removeItem('currentKbId');
    localStorage.removeItem('kbSelectedDocId');
}

function switchKbTab(tabName) {
    currentTab = tabName;
    
    const listTabBtn = document.getElementById('tab-kb-list');
    const knowledgeTabBtn = document.getElementById('tab-kb-knowledge');
    const listContent = document.getElementById('doc-list-tab');
    const knowledgeContent = document.getElementById('knowledge-view-tab');
    
    if (!listTabBtn || !knowledgeTabBtn || !listContent || !knowledgeContent) return;

    if (tabName === 'list') {
        // Activate List Tab
        listTabBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        listTabBtn.classList.add('text-blue-600', 'bg-white', 'shadow-sm');
        
        knowledgeTabBtn.classList.remove('text-blue-600', 'bg-white', 'shadow-sm');
        knowledgeTabBtn.classList.add('text-gray-500', 'hover:text-gray-700');
        
        listContent.classList.remove('hidden');
        knowledgeContent.classList.add('hidden');
    } else {
        // Activate Knowledge Tab
        knowledgeTabBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        knowledgeTabBtn.classList.add('text-blue-600', 'bg-white', 'shadow-sm');
        
        listTabBtn.classList.remove('text-blue-600', 'bg-white', 'shadow-sm');
        listTabBtn.classList.add('text-gray-500', 'hover:text-gray-700');
        
        knowledgeContent.classList.remove('hidden');
        listContent.classList.add('hidden');
    }
    
    localStorage.setItem('kbCurrentTab', tabName);
}

function changeDocPage(delta) {
    // Deprecated but kept for compatibility if needed, now using infinite scroll
}

// Rendering Functions
function renderDocList() {
    const tbody = document.getElementById('doc-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Filter
    let filteredDocs = mockDocs.filter(doc => doc.name.toLowerCase().includes(docSearchQuery.toLowerCase()));
    
    // Update Total Count
    const countEl = document.getElementById('doc-total-count');
    if (countEl) countEl.textContent = `共 ${filteredDocs.length} 个文档`;

    // Infinite Scroll Slice
    const visibleDocs = filteredDocs.slice(0, docDisplayLimit);
    
    if (visibleDocs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">暂无文档</td></tr>';
        return;
    }
    
    visibleDocs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors group';
        
        let statusClass = 'bg-gray-100 text-gray-600';
        let statusText = '未知';
        if (doc.status === 'indexed') {
            statusClass = 'bg-green-100 text-green-700';
            statusText = '已索引';
        } else if (doc.status === 'indexing') {
            statusClass = 'bg-blue-100 text-blue-700';
            statusText = '索引中';
        } else if (doc.status === 'error') {
            statusClass = 'bg-red-100 text-red-700';
            statusText = '失败';
        }
        
        let iconClass = 'fa-file';
        let iconColor = 'text-gray-400';
        if (doc.type === 'PDF') { iconClass = 'fa-file-pdf'; iconColor = 'text-red-500'; }
        else if (doc.type === 'Word') { iconClass = 'fa-file-word'; iconColor = 'text-blue-500'; }
        else if (doc.type === 'Excel') { iconClass = 'fa-file-excel'; iconColor = 'text-green-500'; }
        else if (doc.type === 'Markdown') { iconClass = 'fa-file-code'; iconColor = 'text-purple-500'; }
        else if (doc.type === 'Text') { iconClass = 'fa-file-lines'; iconColor = 'text-gray-500'; }

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <i class="fa-regular ${iconClass} ${iconColor} text-lg"></i>
                    <span class="font-medium text-gray-900">${doc.name}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-gray-500">${doc.size}</td>
            <td class="px-6 py-4 text-gray-500">${doc.type}</td>
            <td class="px-6 py-4">
                <div class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded transition-colors group/edit" onclick="window.editDocField(this, '${doc.id}', 'rank')" title="点击编辑">
                    <span>${doc.rank || '-'}</span>
                    <i class="fa-solid fa-pen text-xs text-gray-300 ml-1 opacity-0 group-hover/edit:opacity-100"></i>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded transition-colors group/edit" onclick="window.editDocField(this, '${doc.id}', 'responsibility')" title="点击编辑">
                    <span>${doc.responsibility || '-'}</span>
                    <i class="fa-solid fa-pen text-xs text-gray-300 ml-1 opacity-0 group-hover/edit:opacity-100"></i>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-gray-500">${doc.updatedAt}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.openDocActions(event, '${doc.id}')" class="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openDocActions = function(event, id) {
    window.showActionMenu(event, [
        {
            label: '查看解析结果',
            icon: 'fa-solid fa-layer-group',
            onClick: () => openParseModal(id)
        },
        {
            label: '预览',
            icon: 'fa-solid fa-eye',
            onClick: () => selectDoc(id)
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => window.prepareDeleteDoc(id)
        }
    ]);
}

function loadMoreDocs() {
    if (isLoadingMoreDocs) return;
    
    // Check if we have more docs to load
    let filteredDocs = mockDocs.filter(doc => doc.name.toLowerCase().includes(docSearchQuery.toLowerCase()));
    if (docDisplayLimit >= filteredDocs.length) return;
    
    isLoadingMoreDocs = true;
    const loader = document.getElementById('doc-list-loading');
    if (loader) loader.classList.remove('hidden');
    
    // Simulate network delay
    setTimeout(() => {
        docDisplayLimit += 20;
        renderDocList();
        isLoadingMoreDocs = false;
        if (loader) loader.classList.add('hidden');
    }, 800);
}

function searchDocs(query) {
    docSearchQuery = query;
    docDisplayLimit = 20; // Reset visible count on search
    renderDocList();
}

function renderDocTree() {
    const container = document.getElementById('doc-tree-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    function buildTreeHtml(nodes, level = 0) {
        let html = '';
        nodes.forEach(node => {
            // Search Filtering
            let isMatch = true;
            let hasMatchingChild = false;
            
            if (treeSearchQuery) {
                const nameMatch = node.name.toLowerCase().includes(treeSearchQuery);
                if (node.type === 'folder' && node.children) {
                    // Check if any descendant matches
                    const checkChildren = (children) => {
                        return children.some(c => {
                            if (c.name.toLowerCase().includes(treeSearchQuery)) return true;
                            if (c.children) return checkChildren(c.children);
                            return false;
                        });
                    };
                    hasMatchingChild = checkChildren(node.children);
                }
                
                if (!nameMatch && !hasMatchingChild) {
                    isMatch = false;
                }
            }
            
            if (!isMatch) return;

            // Indentation & Font Size
            const paddingLeft = level * 16 + 8;
            const fontSizeClass = level === 0 ? 'text-sm' : 'text-xs'; // Top level slightly larger
            
            if (node.type === 'category' || node.type === 'folder') {
                const isExpanded = node.expanded || (treeSearchQuery && hasMatchingChild);
                
                // Icons based on Category
                let iconClass = 'fa-folder';
                let iconColor = 'text-yellow-500';
                let chevronClass = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
                
                if (node.isCategory) {
                    // Use type-specific icons for top level categories
                    if (node.fileTypeCategory === 'Word 文档') { iconClass = 'fa-file-word'; iconColor = 'text-blue-600'; }
                    else if (node.fileTypeCategory === 'PDF 文件') { iconClass = 'fa-file-pdf'; iconColor = 'text-red-600'; }
                    else if (node.fileTypeCategory === 'Excel 表格') { iconClass = 'fa-file-excel'; iconColor = 'text-green-600'; }
                    else if (node.fileTypeCategory === 'Markdown 笔记') { iconClass = 'fa-file-code'; iconColor = 'text-purple-600'; }
                    else { iconClass = 'fa-file-lines'; iconColor = 'text-gray-600'; }
                }

                html += `
                    <div class="select-none">
                        <div class="p-2 rounded-md cursor-pointer flex items-center gap-2 ${fontSizeClass} hover:bg-gray-100 transition-colors text-gray-700" 
                             style="padding-left: ${paddingLeft}px"
                             onclick="toggleFolder('${node.id}')">
                            <i class="fa-solid ${chevronClass} text-[10px] text-gray-400 w-3 flex-shrink-0"></i>
                            <i class="fa-regular ${iconClass} ${iconColor} text-sm flex-shrink-0"></i>
                            <span class="truncate font-medium">${node.name}</span>
                        </div>
                        <div class="${isExpanded ? '' : 'hidden'}">
                            ${node.children ? buildTreeHtml(node.children, level + 1) : ''}
                        </div>
                    </div>
                `;
            } else {
                // File
                let iconClass = 'fa-file';
                let iconColor = 'text-gray-400';
                
                if (node.fileType === 'PDF') { iconClass = 'fa-file-pdf'; iconColor = 'text-red-500'; }
                else if (node.fileType === 'Word') { iconClass = 'fa-file-word'; iconColor = 'text-blue-500'; }
                else if (node.fileType === 'Excel') { iconClass = 'fa-file-excel'; iconColor = 'text-green-500'; }
                else if (node.fileType === 'Markdown') { iconClass = 'fa-file-code'; iconColor = 'text-purple-500'; }
                
                const isSelected = selectedDocId === node.id;
                const bgClass = isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100';
                const fontClass = isSelected ? 'font-medium' : '';
                
                html += `
                    <div class="p-2 rounded-md cursor-pointer flex items-center gap-2 ${fontSizeClass} transition-colors ${bgClass}"
                         style="padding-left: ${paddingLeft + 20}px"
                         onclick="selectDoc('${node.id}')">
                        <i class="fa-regular ${iconClass} ${isSelected ? 'text-blue-600' : iconColor} text-sm flex-shrink-0"></i>
                        <span class="truncate ${fontClass}">${node.name}</span>
                    </div>
                `;
            }
        });
        return html;
    }
    
    container.innerHTML = buildTreeHtml(mockTreeData);
}

function toggleFolder(folderId) {
    const findAndToggle = (nodes) => {
        for (let node of nodes) {
            if (node.id === folderId) {
                node.expanded = !node.expanded;
                return true;
            }
            if (node.children) {
                if (findAndToggle(node.children)) return true;
            }
        }
        return false;
    };
    
    findAndToggle(mockTreeData);
    renderDocTree();
}

function searchTreeDocs(query) {
    treeSearchQuery = query.toLowerCase();
    renderDocTree();
}

window.editDocField = function(el, docId, field) {
    const doc = mockDocs.find(d => d.id === docId);
    if (!doc) return;

    const currentText = doc[field] || '';
    let input;

    if (field === 'rank') {
        input = document.createElement('select');
        input.className = 'w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none bg-white min-w-[80px]';
        RANKS.forEach(r => {
            const option = document.createElement('option');
            option.value = r;
            option.textContent = r;
            if (r === currentText) option.selected = true;
            input.appendChild(option);
        });
    } else if (field === 'responsibility') {
        input = document.createElement('select');
        input.className = 'w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none bg-white min-w-[100px]';
        RESPONSIBILITIES.forEach(r => {
            const option = document.createElement('option');
            option.value = r;
            option.textContent = r;
            if (r === currentText) option.selected = true;
            input.appendChild(option);
        });
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'w-full px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none';
    }

    // Replace content
    el.innerHTML = '';
    el.onclick = null; // Disable click while editing
    el.appendChild(input);
    input.focus();

    const save = () => {
        const newVal = input.value.trim();
        doc[field] = newVal;
        
        // Restore view
        el.innerHTML = `
            <span>${newVal || '-'}</span>
            <i class="fa-solid fa-pen text-xs text-gray-300 ml-1 opacity-0 group-hover/edit:opacity-100"></i>
        `;
        // Re-bind click
        el.onclick = () => window.editDocField(el, docId, field);
    };

    input.onblur = save;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    };
    input.onclick = (e) => e.stopPropagation();
};

// Expose functions to window for HTML onclick access
window.selectDoc = selectDoc;
window.showKbDetail = showKbDetail;
window.getMockDocs = () => mockDocs;
window.getDocById = function(docId) {
    let doc = mockDocs.find(d => d.id === docId);
    if (!doc) {
        // Search in tree
        const findInTree = (nodes) => {
            for (let node of nodes) {
                if (node.id === docId) return node;
                if (node.children) {
                    const found = findInTree(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        const treeNode = findInTree(mockTreeData);
        if (treeNode) {
            doc = {
                id: treeNode.id,
                name: treeNode.name,
                type: treeNode.fileType || 'Text', // Fallback type
                size: '1.2 MB', // Mock size
                status: 'indexed',
                updatedAt: new Date().toLocaleString()
            };
        }
    }
    return doc;
};

// Expose Parse Logic
window.initParseData = initParseData;
window.renderParseChunks = renderParseChunks;
window.updateParseUI = updateParseUI;
window.undoParseAction = undoParseAction;
window.redoParseAction = redoParseAction;
window.toggleOriginalPanel = toggleOriginalPanel;
window.saveParseResult = saveParseResult;
window.startEditChunk = startEditChunk;
window.saveEditChunk = saveEditChunk;
window.cancelEditChunk = cancelEditChunk;
window.splitChunkMode = splitChunkMode;
window.executeSplit = executeSplit;
window.mergeAdjacent = mergeAdjacent;
window.insertChunkAbove = insertChunkAbove;
window.deleteChunk = deleteChunk;

function selectDoc(docId) {
    console.log('selectDoc called with:', docId);
    selectedDocId = docId;
    renderDocTree(); // Re-render to update selection highlight
    
    // Find doc using the exposed helper
    let doc = window.getDocById(docId);
    
    if (!doc) return;
    
    // Show Parse Button (Deprecated, logic moved to UI click handler)
    // But kept here for safety if logic changes back
    const btnViewParse = document.getElementById('btn-view-parse');
    if (btnViewParse) {
        btnViewParse.classList.remove('hidden');
        btnViewParse.onclick = () => openParseModal(docId);
    }
    
    const titleEl = document.getElementById('doc-preview-title');
    const metaEl = document.getElementById('doc-preview-meta');
    const contentEl = document.getElementById('doc-preview-content');
    const actionsNormal = document.getElementById('doc-actions-normal');
    const actionsEditing = document.getElementById('doc-actions-editing');
    
    if (titleEl) titleEl.textContent = doc.name;
    if (metaEl) {
        metaEl.innerHTML = `
            <span><i class="fa-regular fa-clock mr-1"></i>${doc.updatedAt}</span>
            <span class="ml-4"><i class="fa-regular fa-file mr-1"></i>${doc.size}</span>
        `;
    }
    
    // Show actions
    if (actionsNormal) actionsNormal.classList.remove('hidden');
    if (actionsEditing) actionsEditing.classList.add('hidden');
    
    // Reset content editability
    if (contentEl) {
        contentEl.contentEditable = 'false';
        contentEl.classList.remove('border', 'border-blue-300', 'rounded-lg', 'p-4', 'bg-white');
        
        contentEl.innerHTML = `
            <div class="prose max-w-none">
                <h3 class="text-xl font-bold mb-4">${doc.name}</h3>
                <div class="p-4 bg-gray-50 rounded-lg border border-gray-100 mb-6">
                    <p class="text-sm text-gray-500">Document ID: ${doc.id}</p>
                    <p class="text-sm text-gray-500">Type: ${doc.type}</p>
                    <p class="text-sm text-gray-500">Status: ${doc.status}</p>
                </div>
                <div class="text-gray-700 leading-relaxed space-y-4">
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                    
                    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                    
                    <h4 class="text-lg font-semibold mt-6 mb-2">1. Introduction</h4>
                    <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
                    
                    <h4 class="text-lg font-semibold mt-6 mb-2">2. Methodology</h4>
                    <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
                    
                    <ul class="list-disc pl-5 space-y-1">
                        <li>Feature A implementation details</li>
                        <li>Security protocols and compliance</li>
                        <li>Performance optimization metrics</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    localStorage.setItem('kbSelectedDocId', docId);
}

// --- Document Actions ---

window.toggleDocEditMode = function(isEditing) {
    const actionsNormal = document.getElementById('doc-actions-normal');
    const actionsEditing = document.getElementById('doc-actions-editing');
    const contentEl = document.getElementById('doc-preview-content');
    
    if (isEditing) {
        if (actionsNormal) actionsNormal.classList.add('hidden');
        if (actionsEditing) actionsEditing.classList.remove('hidden');
        
        if (contentEl) {
            contentEl.contentEditable = 'true';
            contentEl.classList.add('outline-none', 'ring-2', 'ring-blue-100', 'rounded-lg');
            contentEl.focus();
        }
    } else {
        // Cancel Edit
        if (actionsNormal) actionsNormal.classList.remove('hidden');
        if (actionsEditing) actionsEditing.classList.add('hidden');
        
        if (contentEl) {
            contentEl.contentEditable = 'false';
            contentEl.classList.remove('outline-none', 'ring-2', 'ring-blue-100', 'rounded-lg');
            // Ideally revert content here
            selectDoc(selectedDocId); // Re-render original
        }
    }
}

window.saveDocContent = function() {
    const contentEl = document.getElementById('doc-preview-content');
    // In real app, save contentEl.innerHTML to backend
    
    // Exit edit mode
    toggleDocEditMode(false);
    alert('文档内容已保存');
}

window.reparseCurrentDoc = function() {
    if (!selectedDocId) return;
    
    const btn = document.querySelector('button[onclick="reparseCurrentDoc()"]');
    const originalHtml = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 解析中...';
    
    // Simulate API
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        alert('文档重新解析完成');
    }, 1500);
}

window.deleteCurrentDoc = function() {
    if (!selectedDocId) return;
    document.getElementById('delete-doc-modal').classList.remove('hidden');
}

window.closeDeleteDocModal = function() {
    document.getElementById('delete-doc-modal').classList.add('hidden');
}

window.confirmDeleteDoc = function() {
    if (!selectedDocId) return;
    
    // 1. Log Operation
    console.log(`[AUDIT] User deleted document ${selectedDocId} at ${new Date().toISOString()}`);
    
    // 2. Remove from data (Mock)
    mockDocs = mockDocs.filter(d => d.id !== selectedDocId);
    
    // Also remove from tree
    const removeNode = (nodes) => {
        const idx = nodes.findIndex(n => n.id === selectedDocId);
        if (idx !== -1) {
            nodes.splice(idx, 1);
            return true;
        }
        for (let node of nodes) {
            if (node.children) {
                if (removeNode(node.children)) return true;
            }
        }
        return false;
    };
    removeNode(mockTreeData);
    
    // 3. Reset UI
    selectedDocId = null;
    renderDocList();
    renderDocTree();
    
    // Reset Preview Pane
    const titleEl = document.getElementById('doc-preview-title');
    const metaEl = document.getElementById('doc-preview-meta');
    const contentEl = document.getElementById('doc-preview-content');
    const actionsNormal = document.getElementById('doc-actions-normal');
    
    if (titleEl) titleEl.textContent = '请选择文档';
    if (metaEl) metaEl.textContent = '';
    if (actionsNormal) actionsNormal.classList.add('hidden');
    
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fa-regular fa-file-lines text-4xl mb-4"></i>
                <p>在左侧选择文档以查看内容</p>
            </div>
        `;
    }
    
    closeDeleteDocModal();
    alert('文档已删除');
}

// --- KB Delete Logic ---
let kbToDeleteId = null;

window.deleteKb = function(id) {
    kbToDeleteId = id;
    const modal = document.getElementById('delete-kb-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        // Fallback if modal doesn't exist yet (though we will add it)
        if (confirm('确认删除该知识库吗？')) {
            kbToDeleteId = id;
            confirmDeleteKb();
        }
    }
}

window.closeDeleteKbModal = function() {
    const modal = document.getElementById('delete-kb-modal');
    if (modal) modal.classList.add('hidden');
    kbToDeleteId = null;
}

window.confirmDeleteKb = function() {
    if (!kbToDeleteId) return;
    
    // Remove from data
    knowledgeData = knowledgeData.filter(k => k.id !== kbToDeleteId);
    renderKnowledgeList();
    
    closeDeleteKbModal();
    if (window.showToast) {
        window.showToast('知识库已删除', 'success');
    } else {
        alert('知识库已删除');
    }
}

window.prepareDeleteDoc = function(docId) {
    console.log('prepareDeleteDoc called with:', docId);
    selectedDocId = docId;
    const modal = document.getElementById('delete-doc-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        if (confirm('确认删除该文档吗？')) {
            confirmDeleteDoc();
        }
    }
}

// Parse Result Logic
function openParseModal(docId) {
    const modal = document.getElementById('parse-result-modal');
    if (!modal) return;
    
    // Init Data
    initParseData(docId);
    
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Prevent background scroll
    
    // Reset History
    parseHistory = [];
    parseHistoryIndex = -1;
    pushHistory(); // Initial state
    
    parseIsDirty = false;
    updateParseUI();
    
    // Bind shortcuts
    document.addEventListener('keydown', handleParseShortcuts);
}

function closeParseModal() {
    if (parseIsDirty) {
        if (!confirm('有未保存的修改，确定要关闭吗？')) return;
    }
    
    const modal = document.getElementById('parse-result-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.removeEventListener('keydown', handleParseShortcuts);
}

function handleParseShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoParseAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redoParseAction();
    }
}

function initParseData(docId) {
    // Mock Data Generation
    const doc = mockDocs.find(d => d.id === docId);
    const titleEl = document.getElementById('parse-modal-title');
    
    // Generate realistic doc name if not found or generic
    let docName = doc ? doc.name : 'IT运维常见问题解答_20241001.pdf';
    if (!doc || doc.name === 'Unknown Doc' || doc.name.startsWith('用户需求') || doc.name.includes('v1')) {
         docName = `IT运维知识库_常见问题汇总_v${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2, '0')}.pdf`;
    }
    
    if (titleEl) titleEl.textContent = `解析结果: ${docName}`;
    
    // Mock Original Text (Chinese IT FAQ)
    parseOriginalText = `Q: 无法连接到公司VPN怎么办？
A: 1. 请检查您的网络连接是否正常，确保本地网络畅通。
2. 确认VPN客户端已更新至最新版本，旧版本可能存在兼容性问题。
3. 尝试重新启动VPN客户端，并检查是否选择了正确的服务器节点。
4. 如果问题持续，请检查防火墙设置是否拦截了VPN连接。
<img src='https://picsum.photos/1200/800?random=1' alt='VPN连接错误示例' class='my-4 rounded-lg w-full object-cover shadow-sm' loading="lazy">
5. 若以上方法均无效，请联系IT支持部门，电话：8888-8888。

Q: 如何申请新设备的软件授权？
A: 所有软件授权申请需通过OA系统提交。流程如下：登录OA -> 资产管理 -> 软件授权申请 -> 填写申请单 -> 部门经理审批 -> IT部处理。通常处理时间为1-2个工作日。请务必在申请单中详细说明软件用途及所需版本。

Q: 打印机显示“缺纸”但纸盒已满？
A: 这可能是传感器故障或纸张放置不当。请尝试：1. 取出纸张，抖动整理后重新放入。2. 检查纸盒侧面的卡扣是否卡紧。3. 重启打印机。如果问题依旧，可能是进纸轮磨损，需联系维修人员更换。

Q: 邮箱密码忘记了如何找回？
A: 请访问公司SSO门户页面，点击“忘记密码”，通过手机验证码进行重置。如果手机号已更换，请携带工牌到IT服务台现场办理。
<img src='https://picsum.photos/1200/800?random=2' alt='密码重置流程' class='my-4 rounded-lg w-full object-cover shadow-sm' loading="lazy">`;

    const contentEl = document.getElementById('parse-original-content');
    if (contentEl) contentEl.innerHTML = `<p>${parseOriginalText.replace(/\n/g, '<br>')}</p>`;
    
    // Mock Chunks
    currentParseChunks = [
        { id: 1, content: "Q: 无法连接到公司VPN怎么办？\nA: 1. 请检查您的网络连接是否正常，确保本地网络畅通。您可以尝试访问外部网站来验证网络状态。如果网络不稳定，请先解决本地网络连接问题。\n2. 确认VPN客户端已更新至最新版本，旧版本可能存在兼容性问题。请访问IT部门内网主页下载最新的客户端安装包，并按照安装指南进行更新。\n3. 尝试重新启动VPN客户端，并检查是否选择了正确的服务器节点。有时客户端进程可能会卡死，重启软件通常能解决此类临时故障。\n4. 如果问题持续，请检查防火墙设置是否拦截了VPN连接。部分安全软件可能会误判VPN流量，建议暂时关闭防火墙进行测试。\n<br><img src='https://picsum.photos/1200/800?random=1' alt='VPN连接错误示例' class='my-2 rounded-lg w-full object-cover shadow-sm' loading='lazy'>\n5. 若以上方法均无效，请联系IT支持部门，电话：8888-8888。", selected: false, editing: false },
        { id: 2, content: "Q: 如何申请新设备的软件授权？\nA: 所有软件授权申请需通过OA系统提交，不支持口头或邮件申请。具体操作流程如下：登录OA系统 -> 点击‘资产管理’模块 -> 选择‘软件授权申请’ -> 填写详细申请单 -> 提交至部门经理审批 -> 最终由IT部处理。通常处理时间为1-2个工作日，紧急需求请在备注中说明。\n\n**常用软件授权类型对比：**\n<table class='w-full text-sm text-left border-collapse my-2'><thead><tr class='border-b-2 border-gray-800'><th class='py-2'>软件类型</th><th class='py-2'>适用范围</th><th class='py-2'>审批层级</th></tr></thead><tbody><tr class='border-b border-gray-300'><td class='py-2'>通用办公</td><td class='py-2'>全员</td><td class='py-2'>部门经理</td></tr><tr class='border-b border-gray-300'><td class='py-2'>专业设计</td><td class='py-2'>设计部/市场部</td><td class='py-2'>部门总监</td></tr><tr class='border-b-2 border-gray-800'><td class='py-2'>开发工具</td><td class='py-2'>研发部</td><td class='py-2'>CTO</td></tr></tbody></table>", selected: false, editing: false },
        { id: 3, content: "Q: 打印机显示“缺纸”但纸盒已满？\nA: 这通常是由于传感器故障或纸张放置不当引起的常见问题。请按照以下步骤排查：\n1. 取出纸张，将纸张扇形抖动整理，防止静电吸附，然后重新平整放入纸盒。\n2. 检查纸盒侧面的宽度和长度卡扣是否卡紧纸张，过松或过紧都会导致进纸异常。\n3. 尝试重启打印机，让传感器重新复位检测。\n\n**实际案例：**\n**背景：** 财务部HP打印机频繁报错缺纸。\n**实施：** IT人员检查发现纸张受潮且卡扣未对齐。更换新纸并调整卡扣后恢复正常。\n**效果：** 故障彻底排除，打印效率提升。", selected: false, editing: false },
        { id: 4, content: "Q: 邮箱密码忘记了如何找回？\nA: 建议优先使用自助服务找回密码。请访问公司SSO门户页面（sso.company.com），点击登录框下方的“忘记密码”链接。系统将引导您通过预留的手机号码接收验证码进行重置。请注意，新密码必须包含大小写字母和数字，且长度不少于8位。\n<br><img src='https://picsum.photos/1200/800?random=2' alt='密码重置流程' class='my-2 rounded-lg w-full object-cover shadow-sm' loading='lazy'>\n如果您的手机号已更换无法接收验证码，请携带本人工牌到IT服务台（A座1楼）现场办理密码重置业务。", selected: false, editing: false }
    ];
    
    renderParseChunks();
}

function renderParseChunks() {
    const container = document.getElementById('parse-chunks-container');
    const countEl = document.getElementById('parse-chunk-count');
    if (!container) return;
    
    if (countEl) countEl.textContent = `${currentParseChunks.length} 个切片`;
    
    container.innerHTML = '';
    
    currentParseChunks.forEach((chunk, index) => {
        const div = document.createElement('div');
        // Spacing adjusted to 8px (mb-2), bottom border added
        div.className = `bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 relative group mb-2 ${index < currentParseChunks.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`;
        
        if (chunk.editing) {
            if (chunk.isSplitting) {
                div.innerHTML = `
                    <div class="relative">
                        <div class="text-xs text-purple-600 font-medium mb-2 flex items-center gap-1">
                            <i class="fa-solid fa-scissors"></i>
                            <span>拆分模式：请将光标置于需要拆分的位置，然后点击下方按钮</span>
                        </div>
                        <textarea id="chunk-edit-${index}" class="w-full p-2 border border-purple-300 rounded-md text-sm mb-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-purple-50/30" rows="4">${chunk.content}</textarea>
                        <div class="flex justify-end gap-2">
                            <button onclick="cancelEditChunk(${index})" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 transition-colors">取消</button>
                            <button onclick="executeSplit(${index})" class="px-3 py-1.5 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors shadow-sm flex items-center gap-1">
                                <i class="fa-solid fa-scissors"></i> 在此拆分
                            </button>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <textarea id="chunk-edit-${index}" class="w-full p-2 border border-gray-300 rounded-md text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows="4">${chunk.content}</textarea>
                    <div class="flex justify-end gap-2">
                        <button onclick="cancelEditChunk(${index})" class="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200">取消</button>
                        <button onclick="saveEditChunk(${index})" class="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded">确认</button>
                    </div>
                `;
            }
        } else {
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400 font-mono">#${index + 1}</span>
                    </div>
                    <div class="flex items-center gap-2">
                         <button onclick="insertChunkAbove(${index})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-gray-400 hover:text-[#1890ff] transition-colors border border-transparent hover:border-blue-100" title="向上添加">
                             <i class="fa-solid fa-arrow-up text-sm"></i>
                         </button>
                         <button onclick="splitChunkMode(${index})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors border border-transparent hover:border-purple-100" title="拆分">
                            <i class="fa-solid fa-scissors text-sm"></i>
                        </button>
                        <button onclick="startEditChunk(${index})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-gray-400 hover:text-[#1890ff] transition-colors border border-transparent hover:border-blue-100" title="编辑">
                            <i class="fa-solid fa-pen text-sm"></i>
                        </button>
                        <button onclick="deleteChunk(${index})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors border border-transparent hover:border-red-100" title="删除">
                            <i class="fa-solid fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-text" onclick="startEditChunk(${index})">${chunk.content}</div>
            `;
        }
        
        container.appendChild(div);

        // Add Merge Button (if not last)
        if (index < currentParseChunks.length - 1) {
            const mergeContainer = document.createElement('div');
            // Adjusted margin to account for new spacing
            mergeContainer.className = 'flex justify-center -my-4 z-10 relative opacity-0 hover:opacity-100 transition-opacity duration-200 h-6 pointer-events-none hover:pointer-events-auto';
            mergeContainer.innerHTML = `
                <button onclick="mergeAdjacent(${index})" class="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 text-xs px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1 transform hover:scale-105 transition-all pointer-events-auto">
                    <i class="fa-solid fa-plus-circle"></i> 合并
                </button>
            `;
            container.appendChild(mergeContainer);
        }
    });
    
    updateParseUI();
}

function toggleChunkSelection(index) {
    // Deprecated
}

function updateParseUI() {
    // Update Undo/Redo
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = parseHistoryIndex <= 0;
    if (redoBtn) redoBtn.disabled = parseHistoryIndex >= parseHistory.length - 1;
    
    // Update Save Indicator
    const unsavedInd = document.getElementById('parse-unsaved-indicator');
    if (unsavedInd) {
        if (parseIsDirty) unsavedInd.classList.remove('hidden');
        else unsavedInd.classList.add('hidden');
    }
}

function pushHistory() {
    // Remove any redo history
    if (parseHistoryIndex < parseHistory.length - 1) {
        parseHistory = parseHistory.slice(0, parseHistoryIndex + 1);
    }
    
    // Deep copy
    parseHistory.push(JSON.parse(JSON.stringify(currentParseChunks)));
    parseHistoryIndex++;
    
    updateParseUI();
}

function undoParseAction() {
    if (parseHistoryIndex > 0) {
        parseHistoryIndex--;
        currentParseChunks = JSON.parse(JSON.stringify(parseHistory[parseHistoryIndex]));
        renderParseChunks();
        parseIsDirty = true; 
        updateParseUI();
    }
}

function redoParseAction() {
    if (parseHistoryIndex < parseHistory.length - 1) {
        parseHistoryIndex++;
        currentParseChunks = JSON.parse(JSON.stringify(parseHistory[parseHistoryIndex]));
        renderParseChunks();
        updateParseUI();
    }
}

function mergeAdjacent(index) {
    if (index >= currentParseChunks.length - 1) return;
    
    const chunk1 = currentParseChunks[index];
    const chunk2 = currentParseChunks[index + 1];
    
    const mergedContent = chunk1.content + '\n\n' + chunk2.content;
    
    const newChunk = {
        id: chunk1.id,
        content: mergedContent,
        selected: false,
        editing: false
    };
    
    // Replace two chunks with one
    currentParseChunks.splice(index, 2, newChunk);
    
    parseIsDirty = true;
    pushHistory();
    renderParseChunks();
}

function insertChunkAbove(index) {
    const newChunk = {
        id: Date.now(),
        content: '点击此处编辑新切片内容...',
        selected: false,
        editing: true // Auto enter edit mode
    };
    
    currentParseChunks.splice(index, 0, newChunk);
    
    parseIsDirty = true;
    pushHistory();
    renderParseChunks();
    
    // Focus new chunk
    setTimeout(() => {
        const textarea = document.getElementById(`chunk-edit-${index}`);
        if (textarea) {
            textarea.focus();
            textarea.select();
        }
    }, 50);
}

function mergeSelectedChunks() {
   // Deprecated
}

function deleteChunk(index) {
    if (!confirm('确定要删除这个切片吗？')) return;
    currentParseChunks.splice(index, 1);
    parseIsDirty = true;
    pushHistory();
    renderParseChunks();
}

function startEditChunk(index) {
    currentParseChunks.forEach(c => c.editing = false); // Close others
    currentParseChunks[index].editing = true;
    renderParseChunks();
    
    // Focus
    setTimeout(() => {
        const textarea = document.getElementById(`chunk-edit-${index}`);
        if (textarea) {
            textarea.focus();
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }, 50);
}

function cancelEditChunk(index) {
    currentParseChunks[index].editing = false;
    renderParseChunks();
}

function saveEditChunk(index) {
    const textarea = document.getElementById(`chunk-edit-${index}`);
    if (textarea) {
        currentParseChunks[index].content = textarea.value;
        currentParseChunks[index].editing = false;
        parseIsDirty = true;
        pushHistory();
        renderParseChunks();
    }
}

function splitChunkMode(index) {
    currentParseChunks.forEach(c => {
        c.editing = false;
        c.isSplitting = false;
    });
    currentParseChunks[index].editing = true;
    currentParseChunks[index].isSplitting = true;
    
    renderParseChunks();
    
    // Focus
    setTimeout(() => {
        const textarea = document.getElementById(`chunk-edit-${index}`);
        if (textarea) {
            textarea.focus();
            // Position cursor at the end
            const len = textarea.value.length;
            textarea.setSelectionRange(len, len);
        }
    }, 50);
}

function executeSplit(index) {
    const textarea = document.getElementById(`chunk-edit-${index}`);
    if (!textarea) return;
    
    const cursor = textarea.selectionStart;
    const text = textarea.value;
    
    if (cursor === 0 || cursor === text.length) {
        alert('请将光标放在文本中间以进行拆分');
        textarea.focus();
        return;
    }
    
    // Check for too small split
    if (cursor < 5 || (text.length - cursor) < 5) {
        if (!confirm('拆分后的内容非常短，确定要继续拆分吗？')) {
            textarea.focus();
            return;
        }
    }
    
    const part1 = text.substring(0, cursor);
    const part2 = text.substring(cursor);
    
    const chunk1 = { 
        id: Date.now(), 
        content: part1, 
        selected: false, 
        editing: false,
        isSplitting: false
    };
    const chunk2 = { 
        id: Date.now() + 1, 
        content: part2, 
        selected: false, 
        editing: false,
        isSplitting: false
    };
    
    currentParseChunks.splice(index, 1, chunk1, chunk2);
    
    parseIsDirty = true;
    pushHistory();
    renderParseChunks();
}

function saveParseResult() {
    const saveBtn = document.querySelector('button[onclick="saveParseResult()"]');
    const status = document.getElementById('parse-save-status');
    
    if (saveBtn) saveBtn.disabled = true;
    if (status) status.classList.remove('hidden');
    
    // Mock Save
    setTimeout(() => {
        parseIsDirty = false;
        updateParseUI();
        if (saveBtn) saveBtn.disabled = false;
        if (status) status.classList.add('hidden');
        
        // Show toast
        alert('保存成功！');
    }, 1000);
}

function toggleOriginalPanel() {
    const panel = document.getElementById('parse-original-panel');
    const expandBtn = document.getElementById('btn-expand-chunks');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        if (expandBtn) expandBtn.classList.add('hidden');
    } else {
        panel.classList.add('hidden');
        if (expandBtn) expandBtn.classList.remove('hidden');
    }
}

// --- Tree Upload Logic ---
function triggerDocUpload() {
    const input = document.getElementById('tree-upload-input');
    if (input) input.click();
}

function handleTreeUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    // Validation
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'md', 'txt', 'jpg', 'png'];
    
    for (let file of input.files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
            alert(`不支持的文件类型: ${file.name}`);
            input.value = '';
            return;
        }
        if (file.size > MAX_SIZE) {
            alert(`文件过大 (超过50MB): ${file.name}`);
            input.value = '';
            return;
        }
    }
    
    const btn = document.getElementById('btn-tree-upload');
    const progressContainer = document.getElementById('tree-upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentText = document.getElementById('upload-percent');
    const statusText = document.getElementById('upload-status-text');
    
    // Disable button
    if (btn) {
        btn.disabled = true;
        btn.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
        btn.classList.remove('bg-white', 'hover:bg-gray-50', 'hover:border-gray-300', 'text-[#333333]');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>准备中...</span>';
    }
    
    // Show progress
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    // Simulate Upload
    let progress = 0;
    const totalFiles = input.files.length;
    statusText.textContent = `正在上传 ${totalFiles} 个文件...`;
    
    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress > 100) progress = 100;
        
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (percentText) percentText.textContent = `${progress}%`;
        
        if (progress === 100) {
            clearInterval(interval);
            statusText.textContent = '处理中...';
            
            setTimeout(() => {
                // Reset UI
                if (progressContainer) progressContainer.classList.add('hidden');
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
                    btn.classList.add('bg-white', 'hover:bg-gray-50', 'hover:border-gray-300', 'text-[#333333]');
                    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-gray-500 group-hover:-translate-y-0.5 transition-transform"></i> <span>上传文档</span>';
                }
                
                // Add Mock Files to Tree
                const newFiles = Array.from(input.files).map((file, index) => ({
                    id: `UPLOAD-${Date.now()}-${index}`,
                    name: file.name,
                    type: 'file',
                    fileType: getFileType(file.name),
                    parentId: 'CATEGORY-0', // Default to first category
                    expanded: false
                }));
                
                // Add to mockTreeData's first category for demo
                if (mockTreeData.length > 0 && mockTreeData[0].children) {
                    mockTreeData[0].children.push(...newFiles);
                    mockTreeData[0].expanded = true; // Ensure expanded to show new files
                }
                
                renderDocTree();
                alert(`成功上传 ${totalFiles} 个文档`);
                
                // Clear input
                input.value = '';
            }, 800);
        }
    }, 200);
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'Word';
    if (['xls', 'xlsx'].includes(ext)) return 'Excel';
    if (['md', 'markdown'].includes(ext)) return 'Markdown';
    return 'Text';
}

let docUploadStep = 1;
let docUploadSliceMode = 'length';

function openDocUploadWizard() {
    docUploadStep = 1;
    const modal = document.getElementById('doc-upload-wizard');
    if (modal) modal.classList.remove('hidden');
    updateDocUploadStep();
}

function closeDocUploadWizard() {
    const modal = document.getElementById('doc-upload-wizard');
    if (modal) modal.classList.add('hidden');
}

function updateDocUploadStep() {
    const step1 = document.getElementById('doc-upload-step-1');
    const step2 = document.getElementById('doc-upload-step-2');
    const prevBtn = document.getElementById('doc-upload-prev');
    const nextBtn = document.getElementById('doc-upload-next');
    const step1Indicator = document.getElementById('step-1-indicator');
    const step2Indicator = document.getElementById('step-2-indicator');
    const sourceSelect = document.getElementById('doc-upload-source');
    const localPanel = document.getElementById('doc-upload-local-panel');
    const kbPanel = document.getElementById('doc-upload-kb-panel');

    if (step1 && step2) {
        if (docUploadStep === 1) {
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
        } else {
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        }
    }

    if (prevBtn && nextBtn) {
        if (docUploadStep === 1) {
            prevBtn.disabled = true;
            nextBtn.textContent = '下一步';
        } else {
            prevBtn.disabled = false;
            nextBtn.textContent = '完成';
        }
    }

    if (step1Indicator && step2Indicator) {
        if (docUploadStep === 1) {
            step1Indicator.classList.remove('opacity-40');
            step2Indicator.classList.add('opacity-40');
        } else {
            step1Indicator.classList.add('opacity-40');
            step2Indicator.classList.remove('opacity-40');
        }
    }

    if (sourceSelect && localPanel && kbPanel) {
        const value = sourceSelect.value;
        if (value === 'kb') {
            localPanel.classList.add('hidden');
            kbPanel.classList.remove('hidden');
        } else {
            localPanel.classList.remove('hidden');
            kbPanel.classList.add('hidden');
        }
    }
}

function nextDocUploadStep() {
    if (docUploadStep === 1) {
        docUploadStep = 2;
        updateDocUploadStep();
    } else {
        closeDocUploadWizard();
    }
}

function prevDocUploadStep() {
    if (docUploadStep === 2) {
        docUploadStep = 1;
        updateDocUploadStep();
    }
}

function initDocUploadWizard() {
    const nextBtn = document.getElementById('doc-upload-next');
    const prevBtn = document.getElementById('doc-upload-prev');
    const sourceSelect = document.getElementById('doc-upload-source');

    if (nextBtn) nextBtn.onclick = nextDocUploadStep;
    if (prevBtn) prevBtn.onclick = prevDocUploadStep;
    if (sourceSelect) sourceSelect.onchange = updateDocUploadStep;

    setDocUploadSliceMode(docUploadSliceMode || 'length', false);
}

function updateDocUploadSliceParams(mode, animate) {
    const container = document.getElementById('doc-upload-length-params');
    if (!container) return;

    const labels = container.querySelectorAll('label');
    if (labels.length < 2) return;

    const blocks = container.children;
    if (!blocks || blocks.length < 2) return;

    const chunkSizeInput = document.getElementById('doc-upload-chunk-size');
    const symbolSelect = document.getElementById('doc-upload-symbol-select');

    const firstLabel = labels[0];
    const secondLabel = labels[1];
    const firstBlock = blocks[0];
    const secondBlock = blocks[1];

    const applyTexts = () => {
        if (mode === 'length') {
            firstLabel.textContent = '分段大小';
            secondLabel.textContent = '重叠大小';
        } else if (mode === 'title') {
            firstLabel.textContent = '分段大小';
            secondLabel.textContent = '标题级数';
        } else if (mode === 'symbol') {
            firstLabel.textContent = '符号选择';
            secondLabel.textContent = '分段大小';
        } else {
            firstLabel.textContent = '分片大小';
            secondLabel.textContent = '重叠大小';
        }

        if (mode === 'page') {
            secondBlock.classList.add('hidden');
        } else {
            secondBlock.classList.remove('hidden');
        }

        if (chunkSizeInput && symbolSelect) {
            if (mode === 'symbol') {
                chunkSizeInput.classList.add('hidden');
                symbolSelect.classList.remove('hidden');
            } else {
                chunkSizeInput.classList.remove('hidden');
                symbolSelect.classList.add('hidden');
            }
        }
    };

    if (!animate) {
        applyTexts();
        return;
    }

    container.classList.remove('opacity-100', 'translate-y-0');
    container.classList.add('opacity-0', 'translate-y-1');

    setTimeout(() => {
        applyTexts();
        container.classList.remove('opacity-0', 'translate-y-1');
        container.classList.add('opacity-100', 'translate-y-0');
    }, 150);
}

function setDocUploadSliceMode(mode, animate = true) {
    docUploadSliceMode = mode;
    const lengthTab = document.getElementById('slice-tab-length');
    const pageTab = document.getElementById('slice-tab-page');
    const titleTab = document.getElementById('slice-tab-title');
    const symbolTab = document.getElementById('slice-tab-symbol');

    const tabs = [
        { el: lengthTab, key: 'length' },
        { el: pageTab, key: 'page' },
        { el: titleTab, key: 'title' },
        { el: symbolTab, key: 'symbol' }
    ];

    tabs.forEach(tab => {
        if (!tab.el) return;
        tab.el.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600', 'font-medium');
        tab.el.classList.remove('border-gray-200', 'text-gray-600');
        tab.el.classList.add('border-gray-200', 'text-gray-600');

        if (tab.key === mode) {
            tab.el.classList.remove('border-gray-200', 'text-gray-600');
            tab.el.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600', 'font-medium');
        }
    });

    updateDocUploadSliceParams(mode, animate);
}

// --- Doc More Menu Logic ---
window.toggleDocMoreMenu = function(event) {
    event.stopPropagation();
    const menu = document.getElementById('doc-more-menu');
    if (menu) {
    }
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('doc-more-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'knowledge') {
        initKnowledgePage();
        initDocUploadWizard();
        initCreateKbForm();
    }
});

// Parser UI Logic
function setupParserInteractions() {
    const fastOpt = document.getElementById('parser-option-fast');
    const deepOpt = document.getElementById('parser-option-deep');
    const deepSub = document.getElementById('deep-parse-sub-options');
    const parseBtn = document.getElementById('btn-innovative-parse');
    const fileSelect = document.getElementById('parser-preview-file-select');

    if (fastOpt && deepOpt) {
        fastOpt.onchange = function() {
            if (this.checked) {
                deepOpt.checked = false;
                if (deepSub) deepSub.classList.add('hidden');
            }
        };
        deepOpt.onchange = function() {
            if (this.checked) {
                fastOpt.checked = false;
                if (deepSub) deepSub.classList.remove('hidden');
            } else {
                if (deepSub) deepSub.classList.add('hidden');
            }
        };
    }

    if (parseBtn) {
        parseBtn.onclick = handleInnovativeParse;
    }

    const previewBtn = document.getElementById('btn-parse-preview');
    if (previewBtn) {
        previewBtn.onclick = function() {
            // If no file is selected in the preview select, select the first successful one
            const fileSelect = document.getElementById('parser-preview-file-select');
            if (fileSelect && !fileSelect.value) {
                const firstSuccessIndex = createKbFiles.findIndex(f => f.status === 'success');
                if (firstSuccessIndex !== -1) {
                    fileSelect.value = String(firstSuccessIndex);
                }
            }
            handleInnovativeParse();
        };
    }
    
    if (fileSelect) {
        fileSelect.onchange = function() {
             const contentEl = document.getElementById('parser-preview-content');
             if(contentEl) {
                 contentEl.innerHTML = `
                    <div class="h-full flex flex-col items-center justify-center text-gray-400">
                        <i class="fa-regular fa-file-image text-4xl mb-3 opacity-30"></i>
                        <p class="text-sm">点击“解析预览”查看结果</p>
                    </div>`;
             }
        }
    }
}

// Original View State
let isViewingOriginal = false;
let originalZoomLevel = 100;

function initOriginalViewState() {
    const saved = localStorage.getItem('kbViewingOriginal');
    if (saved === 'true') {
        toggleOriginalView(true);
    }
}

function toggleOriginalView(forceState) {
    const configPanel = document.getElementById('create-kb-config-panel');
    const originalPanel = document.getElementById('create-kb-original-panel');
    const btnText = document.getElementById('view-original-text');
    const btnIcon = document.querySelector('#btn-view-original i');
    const parserSelect = document.getElementById('parser-preview-file-select');
    
    const startTime = performance.now();
    
    if (forceState !== undefined) {
        isViewingOriginal = forceState;
    } else {
        isViewingOriginal = !isViewingOriginal;
    }

    if (isViewingOriginal) {
        // Switch to Original View
        if (configPanel) {
            configPanel.classList.add('opacity-0');
            setTimeout(() => configPanel.classList.add('hidden'), 200);
        }
        if (originalPanel) {
            originalPanel.classList.remove('hidden');
            setTimeout(() => originalPanel.classList.add('opacity-100'), 10);
        }
        if (btnText) btnText.textContent = '关闭原文';
        if (btnIcon) {
            btnIcon.classList.remove('fa-eye');
            btnIcon.classList.add('fa-eye-slash');
        }
        
        // Load content if file selected
        loadOriginalFileContent();
    } else {
        // Switch back to Config Panel
        if (originalPanel) {
            originalPanel.classList.remove('opacity-100');
            setTimeout(() => originalPanel.classList.add('hidden'), 200);
        }
        if (configPanel) {
            configPanel.classList.remove('hidden');
            setTimeout(() => configPanel.classList.remove('opacity-0'), 10);
        }
        if (btnText) btnText.textContent = '查看原文';
        if (btnIcon) {
            btnIcon.classList.remove('fa-eye-slash');
            btnIcon.classList.add('fa-eye');
        }
    }

    localStorage.setItem('kbViewingOriginal', isViewingOriginal);
    
    // Log performance for verification
    const duration = performance.now() - startTime;
    console.log(`[PERF] toggleOriginalView took ${duration.toFixed(2)}ms`);
}

function loadOriginalFileContent() {
    const parserSelect = document.getElementById('parser-preview-file-select');
    const contentEl = document.getElementById('original-view-content');
    if (!parserSelect || !contentEl) return;

    const fileIndex = parserSelect.value;
    if (fileIndex === "" || !createKbFiles[fileIndex]) {
        contentEl.textContent = '请先在右侧选择一个已上传的文件进行预览。';
        return;
    }

    const fileItem = createKbFiles[fileIndex];
    if (fileItem.file) {
        // Support text-based files for now
        if (fileItem.file.type.startsWith('text/') || fileItem.name.endsWith('.txt') || fileItem.name.endsWith('.md')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                contentEl.textContent = e.target.result;
            };
            reader.readAsText(fileItem.file);
        } else {
            contentEl.textContent = `暂不支持直接预览 ${fileItem.name} 的原始二进制内容。`;
        }
    }
}

function zoomOriginalView(direction) {
    const content = document.getElementById('original-view-content');
    const zoomText = document.getElementById('original-view-zoom-level');
    if (!content || !zoomText) return;

    if (direction === 'in' && originalZoomLevel < 200) {
        originalZoomLevel += 10;
    } else if (direction === 'out' && originalZoomLevel > 50) {
        originalZoomLevel -= 10;
    }

    content.style.transform = `scale(${originalZoomLevel / 100})`;
    zoomText.textContent = `${originalZoomLevel}%`;
}

function resetOriginalView() {
    originalZoomLevel = 100;
    const content = document.getElementById('original-view-content');
    const zoomText = document.getElementById('original-view-zoom-level');
    if (content) content.style.transform = 'scale(1)';
    if (zoomText) zoomText.textContent = '100%';
}

// Update setupParserInteractions to handle file change in original view
const originalSetupParserInteractions = setupParserInteractions;
setupParserInteractions = function() {
    originalSetupParserInteractions();
    const fileSelect = document.getElementById('parser-preview-file-select');
    if (fileSelect) {
        const originalOnChange = fileSelect.onchange;
        fileSelect.onchange = function() {
            if (originalOnChange) originalOnChange.call(this);
            if (isViewingOriginal) {
                loadOriginalFileContent();
            }
        };
    }
    initOriginalViewState();
};

function handleInnovativeParse() {
    const fileSelect = document.getElementById('parser-preview-file-select');
    const contentEl = document.getElementById('parser-preview-content');
    if (!fileSelect || !contentEl) return;
    
    if (!fileSelect.value && fileSelect.value !== "0") { // Check if empty or not selected (0 is valid index)
         // Note: createKbFiles indexes are strings in options
        if(!createKbFiles.length) {
            alert('请先上传文件');
            return;
        }
        // If has files but none selected, select first
        if(createKbFiles.length > 0 && !fileSelect.value) {
            fileSelect.value = "0";
        }
    }

    // Loading state
    contentEl.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-blue-500">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i>
            <p class="text-sm">正在进行创新解析...</p>
        </div>
    `;

    // Simulate delay
    setTimeout(() => {
        const mockContent = [
            "这是文档的第一段内容，经过智能解析提取。用户可以对这段内容进行校对和修正。",
            "这里是第二段，可能包含一些专业术语或复杂格式。深度解析模型尝试保留了原始语义。",
            "第三段内容展示了系统的容错能力。即使源文档有些模糊，我们依然能提取出核心信息。",
            "最后一段，您可以点击右侧的纠正按钮来修改任何识别错误。"
        ];
        renderParserPreview(mockContent);
    }, 1500);
}

function renderParserPreview(paragraphs) {
    const contentEl = document.getElementById('parser-preview-content');
    if (!contentEl) return;
    
    contentEl.innerHTML = '';
    
    paragraphs.forEach((text, index) => {
        const id = `para-${index}`;
        const div = document.createElement('div');
        div.className = 'group relative p-4 bg-gray-50 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50/30 transition-all';
        div.innerHTML = `
            <div id="${id}-view" class="text-sm text-gray-700 leading-relaxed pr-8">${text}</div>
            <textarea id="${id}-edit" class="hidden w-full p-2 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2" rows="3">${text}</textarea>
            
            <div id="${id}-actions" class="hidden flex justify-end gap-2 mt-2">
                <button onclick="cancelCorrection('${id}', '${text}')" class="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded">取消</button>
                <button onclick="saveCorrection('${id}')" class="px-2 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded">保存</button>
            </div>

            <button onclick="toggleCorrection('${id}')" class="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="纠正">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>
        `;
        contentEl.appendChild(div);
    });
}

function toggleCorrection(id) {
    const view = document.getElementById(`${id}-view`);
    const edit = document.getElementById(`${id}-edit`);
    const actions = document.getElementById(`${id}-actions`);
    
    if (view && edit && actions) {
        view.classList.add('hidden');
        edit.classList.remove('hidden');
        actions.classList.remove('hidden');
        edit.focus();
    }
}

function saveCorrection(id) {
    const view = document.getElementById(`${id}-view`);
    const edit = document.getElementById(`${id}-edit`);
    const actions = document.getElementById(`${id}-actions`);
    
    if (view && edit && actions) {
        view.textContent = edit.value;
        view.classList.remove('hidden');
        edit.classList.add('hidden');
        actions.classList.add('hidden');
        
        // Update cancel button
        const cancelBtn = actions.querySelector('button[onclick^="cancelCorrection"]');
        if(cancelBtn) {
            // Simple escape for single quotes
            const safeText = edit.value.replace(/'/g, "\\'"); 
            cancelBtn.setAttribute('onclick', `cancelCorrection('${id}', '${safeText}')`);
        }
    }
}

function cancelCorrection(id, originalText) {
    const view = document.getElementById(`${id}-view`);
    const edit = document.getElementById(`${id}-edit`);
    const actions = document.getElementById(`${id}-actions`);
    
    if (view && edit && actions) {
        edit.value = originalText;
        view.classList.remove('hidden');
        edit.classList.add('hidden');
        actions.classList.add('hidden');
    }
}
