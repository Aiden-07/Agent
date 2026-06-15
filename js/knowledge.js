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
const SOURCE_REF_SESSION_KEY = 'kb_pending_source_reference_v1';

// Doc Filters
let docFileTypeFilter = 'all';      // all | doc | sheet | image | text
let docIndexStatusFilter = 'all';   // all | unparsed | parsing | success | failed | retry

const DOC_FILETYPE_EXTS = {
    doc: ['doc', 'docx', 'ppt', 'pptx', 'pdf'],
    sheet: ['xlsx', 'xls'],
    image: ['png', 'jpg', 'jpeg', 'bmp'],
    text: ['md', 'txt']
};

function getSourceRefUtils() {
    const fallback = {
        SUMMARY_LIMIT: 50,
        escapeHtml: (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'),
        getSourceSummary: (content, limit = 50) => {
            const text = String(content == null ? '' : content).replace(/\s+/g, ' ').trim();
            return text.length > limit ? text.slice(0, limit) + '\u2026' : text;
        },
        normalizeSourceRange: (value) => {
            let range = value;
            if (typeof range === 'string') {
                const text = range.trim();
                if (!text) return null;
                try {
                    range = JSON.parse(text);
                } catch (_) {
                    range = text.split(',').map(part => part.trim());
                }
            }
            if (range && typeof range === 'object' && !Array.isArray(range)) {
                range = [
                    range.start_char ?? range.startChar ?? range.start,
                    range.end_char ?? range.endChar ?? range.end
                ];
            }
            if (!Array.isArray(range) || range.length < 2) return null;
            const start = Number(range[0]);
            const end = Number(range[1]);
            if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
            return [Math.max(0, start), Math.max(Math.max(0, start), end)];
        },
        sourceRangeOverlaps: (a, b) => {
            const left = fallback.normalizeSourceRange(a);
            const right = fallback.normalizeSourceRange(b);
            return !!left && !!right && left[0] < right[1] && right[0] < left[1];
        },
        normalizeSourceReference: (source) => {
            const input = source && typeof source === 'object' ? source : {};
            return {
                document_id: String(input.document_id || input.documentId || input.docId || input.doc_id || input.id || ''),
                document_name: String(input.document_name || input.documentName || input.docName || input.doc_name || input.title || input.name || ''),
                chunk_id: String(input.chunk_id || input.chunkId || input.slice_id || input.sliceId || input.block_id || input.blockId || ''),
                chunk_content: String(input.chunk_content || input.chunkContent || input.content || input.snippet || input.summary || ''),
                source_range: fallback.normalizeSourceRange(
                    input.source_range || input.sourceRange || input.range ||
                    (input.start_char != null || input.end_char != null ? [input.start_char, input.end_char] : null) ||
                    (input.startChar != null || input.endChar != null ? [input.startChar, input.endChar] : null)
                ),
                kb_id: input.kb_id || input.kbId || input.knowledge_id || input.knowledgeId || ''
            };
        }
    };
    return window.SourceReferenceUtils || fallback;
}

function normalizeKnowledgeSource(source) {
    return getSourceRefUtils().normalizeSourceReference(source);
}

function readPendingKnowledgeSource(params) {
    let urlSource = null;
    if (params && (params.document_id || params.documentId || params.docId || params.chunk_id || params.chunkId || params.source_range || params.sourceRange)) {
        urlSource = normalizeKnowledgeSource(params);
    }

    let storedSource = null;
    try {
        const raw = sessionStorage.getItem(SOURCE_REF_SESSION_KEY);
        if (raw) {
            sessionStorage.removeItem(SOURCE_REF_SESSION_KEY);
            storedSource = normalizeKnowledgeSource(JSON.parse(raw));
        }
    } catch (_) {}

    if (urlSource && storedSource) {
        return normalizeKnowledgeSource({
            ...storedSource,
            ...urlSource,
            chunk_content: urlSource.chunk_content || storedSource.chunk_content,
            source_range: urlSource.source_range || storedSource.source_range
        });
    }

    return urlSource || storedSource;
}

function buildKnowledgeSourceRouteParams(ref) {
    const params = { source: '1' };
    if (ref.kb_id) params.id = ref.kb_id;
    params.document_id = ref.document_id;
    if (ref.document_name) params.document_name = ref.document_name;
    if (ref.chunk_id) params.chunk_id = ref.chunk_id;
    if (ref.chunk_content) params.chunk_content = ref.chunk_content;
    if (ref.source_range) params.source_range = JSON.stringify(ref.source_range);
    return params;
}

function replaceKnowledgeSourceRoute(ref, kbId) {
    if (!ref || !ref.document_id || typeof window.history?.replaceState !== 'function') return;
    const routeRef = normalizeKnowledgeSource({ ...ref, kb_id: ref.kb_id || kbId || '' });
    const query = new URLSearchParams(buildKnowledgeSourceRouteParams(routeRef)).toString();
    const nextHash = `#/knowledge?${query}`;
    if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
    }
}

window.openKnowledgeSource = function(source) {
    const ref = normalizeKnowledgeSource(source);
    if (!ref.document_id) return;

    try {
        sessionStorage.setItem(SOURCE_REF_SESSION_KEY, JSON.stringify(ref));
        localStorage.setItem('kbCurrentTab', 'knowledge');
        localStorage.setItem('kbSelectedDocId', ref.document_id);
        if (ref.kb_id) {
            localStorage.setItem('currentView', 'detail');
            localStorage.setItem('currentKbId', ref.kb_id);
        }
    } catch (_) {}

    const params = buildKnowledgeSourceRouteParams(ref);
    if (typeof window.switchView === 'function') {
        window.switchView('knowledge', params);
    } else {
        const query = new URLSearchParams(params).toString();
        window.location.hash = `#/knowledge?${query}`;
    }
};

function getDocExt(fileName) {
    const n = String(fileName || '').trim().toLowerCase();
    const i = n.lastIndexOf('.');
    if (i < 0) return '';
    return n.slice(i + 1);
}

function normalizeDocStatus(status) {
    const s = String(status || '').toLowerCase();
    // 兼容旧字段
    if (s === 'indexed') return 'success';
    if (s === 'indexing') return 'parsing';
    if (s === 'error') return 'failed';
    // 新字段
    if (['unparsed', 'parsing', 'success', 'failed', 'retry'].includes(s)) return s;
    return 'unparsed';
}

function docMatchesFileType(doc) {
    if (docFileTypeFilter === 'all') return true;
    const exts = DOC_FILETYPE_EXTS[docFileTypeFilter] || [];
    const ext = getDocExt(doc && doc.name);
    return exts.includes(ext);
}

function docMatchesIndexStatus(doc) {
    if (docIndexStatusFilter === 'all') return true;
    const st = normalizeDocStatus(doc && doc.status);
    return st === docIndexStatusFilter;
}

function getFilteredDocs() {
    const q = String(docSearchQuery || '').trim().toLowerCase();
    return (mockDocs || []).filter(doc => {
        if (!doc) return false;
        const nameOk = !q || String(doc.name || '').toLowerCase().includes(q);
        if (!nameOk) return false;
        if (!docMatchesFileType(doc)) return false;
        if (!docMatchesIndexStatus(doc)) return false;
        return true;
    });
}

function setDocFileTypeFilter(v) {
    docFileTypeFilter = String(v || 'all');
    docDisplayLimit = 20;
    renderDocList();
}
window.setDocFileTypeFilter = setDocFileTypeFilter;

function setDocIndexStatusFilter(v) {
    docIndexStatusFilter = String(v || 'all');
    docDisplayLimit = 20;
    renderDocList();
}
window.setDocIndexStatusFilter = setDocIndexStatusFilter;

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
let isUploadOnlyMode = false;
let createKbSliceMode = 'parent';
let createKbConfigTab = 'form';
const CREATE_KB_PREVIEW_FALLBACK = '这是一个用于切片预览的示例文档内容。你可以在这里看到不同的切片策略如何影响文本的分段方式。例如，按段落分割会以自然段落为边界，而按固定字符数分割则会严格根据长度进行切片。通过合理设置切片大小和重叠，可以在保证检索效果的同时，平衡索引规模与性能。';

function syncKnowledgeDataToSharedStore({ persist = false } = {}) {
    if (window.VAgentKnowledgeStore) {
        knowledgeData = persist
            ? window.VAgentKnowledgeStore.saveKnowledgeBases(knowledgeData)
            : window.VAgentKnowledgeStore.normalizeKnowledgeBases(knowledgeData);
    }
    window.knowledgeData = knowledgeData;
    return knowledgeData;
}

function loadKnowledgeDataFromSharedStore() {
    if (!window.VAgentKnowledgeStore) return [];
    return window.VAgentKnowledgeStore.loadKnowledgeBases();
}

function initKnowledgePage(params) {
    const pendingSourceRef = readPendingKnowledgeSource(params);
    const tbody = document.getElementById('knowledge-list-body');
    
    // Initialize strategy selection groups for step 2
    if (typeof initSelectionGroups === 'function') {
        initSelectionGroups();
    }
    
    // Show loading state immediately
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center text-gray-500">
                        <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-3 text-blue-500"></i>
                        <span class="text-sm">正在加载知识库列表...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    // Simulate async data loading with delay
    setTimeout(() => {
        try {
            if (knowledgeData.length === 0) {
                const storedKnowledgeBases = loadKnowledgeDataFromSharedStore();
                if (storedKnowledgeBases.length) {
                    knowledgeData = storedKnowledgeBases;
                } else {
                    knowledgeData = generateMockKnowledge(10);
                    syncKnowledgeDataToSharedStore({ persist: true });
                }
            } else {
                syncKnowledgeDataToSharedStore();
            }
            renderKnowledgeList();

            if (pendingSourceRef && pendingSourceRef.document_id) {
                const targetKbId = pendingSourceRef.kb_id || localStorage.getItem('currentKbId') || currentKbId || (knowledgeData[0] && knowledgeData[0].id);
                if (targetKbId) {
                    replaceKnowledgeSourceRoute(pendingSourceRef, targetKbId);
                    showKbDetail(targetKbId, { sourceRef: pendingSourceRef });
                    return;
                }
            }
            
            // Ensure batch mode is reset when entering the module
            if (typeof exitBatchOperationMode === 'function') {
                exitBatchOperationMode();
            } else {
                // Fallback if function not ready (though it should be hoisted/avail)
                try {
                    const defaultActions = document.getElementById('doc-toolbar-default-actions');
                    const batchActions = document.getElementById('doc-toolbar-batch-actions');
                    if (defaultActions) {
                        defaultActions.classList.remove('hidden', 'pointer-events-none', 'opacity-0');
                        defaultActions.classList.add('opacity-100');
                    }
                    if (batchActions) {
                        batchActions.classList.add('hidden', 'pointer-events-none', 'opacity-0');
                        batchActions.classList.remove('opacity-100');
                    }
                } catch(e) {}
            }

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
                // If we are just initializing the list, make sure we are in list view
                // backToKbList might toggle visibility, so calling it ensures correct state
                if (typeof backToKbList === 'function') {
                    backToKbList();
                }
            }
        } catch (error) {
            console.error('Error initializing knowledge page:', error);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-12 text-center text-red-500">
                            <div class="flex flex-col items-center justify-center">
                                <i class="fa-solid fa-triangle-exclamation text-2xl mb-3"></i>
                                <span class="text-sm mb-2">加载失败</span>
                                <span class="text-xs text-gray-400">${error.message || '未知错误'}</span>
                                <button onclick="initKnowledgePage()" class="mt-4 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs">
                                    重试
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }, 500); // 500ms delay for smooth transition
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
    // Try load from local storage
    try {
        const saved = localStorage.getItem('mockDocs_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // 兼容/修复：支持将特定演示文档改为 PNG（用于图片策略演示）
                try {
                    parsed.forEach(d => {
                        if (!d) return;
                        if (d.id === 'DOC-E8C7CY8ED') {
                            d.name = (d.name || '性能测试报告.png').replace(/\.[^.]+$/, '.png');
                            d.type = 'PNG';
                        }
                    });
                    localStorage.setItem('mockDocs_v2', JSON.stringify(parsed));
                } catch (_) {}
                // 兼容：升级索引状态枚举
                try {
                    parsed.forEach(d => {
                        if (!d) return;
                        d.status = normalizeDocStatus(d.status);
                    });
                    localStorage.setItem('mockDocs_v2', JSON.stringify(parsed));
                } catch (_) {}
                return parsed;
            }
        }
    } catch (e) {}

    const docs = [];
    for (let i = 0; i < count; i++) {
        const type = DOC_TYPES[Math.floor(Math.random() * DOC_TYPES.length)];
        const statusRand = Math.random();
        const status = statusRand < 0.18 ? 'unparsed'
            : statusRand < 0.30 ? 'parsing'
            : statusRand < 0.86 ? 'success'
            : statusRand < 0.93 ? 'failed'
            : 'retry';

        docs.push({
            id: `DOC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            name: `${DOC_NAMES[Math.floor(Math.random() * DOC_NAMES.length)]}_v${Math.floor(Math.random() * 5) + 1}.${type.toLowerCase()}`,
            type: type,
            size: `${(Math.random() * 10).toFixed(2)} MB`,
            status,
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            lastParsedSuccessTime: new Date(Date.now() - Math.floor(Math.random() * 500000000)).toLocaleString(),
            sliceStrategy: '未设置',
            rank: RANKS[Math.floor(Math.random() * RANKS.length)],
            responsibility: RESPONSIBILITIES[Math.floor(Math.random() * RESPONSIBILITIES.length)],
            content: `This is the mock content for document...`,
            parserName: '未设置', // Default to Not Set for testing
            sliceSettingName: '未设置'
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
    const esc = window.escapeHtml || function (s) { return String(s == null ? '' : s); };
    knowledgeData.forEach((item, index) => {
        const isKbEnabled = item.enabled !== false && item.isEnabled !== false && String(item.status || '').toLowerCase() !== 'disabled';
        const tr = document.createElement('tr');
        tr.className = `hover:bg-gray-50 transition-colors ${isKbEnabled ? '' : 'bg-orange-50/30'}`;
        
        tr.innerHTML = `
            <td class="px-6 py-4 min-w-0">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid fa-book"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="font-medium text-gray-900 cursor-pointer hover:text-blue-600 min-w-0 dt-cell-ellipsis" title="${esc(item.name)}" onclick="showKbDetail('${item.id}')">${esc(item.name)}</div>
                        ${isKbEnabled ? '' : '<div class="mt-1 inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>已停用</div>'}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 min-w-0 whitespace-nowrap"><span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs dt-cell-ellipsis inline-block max-w-full" title="${esc(item.tag)}">${esc(item.tag)}</span></td>
            <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">${item.docCount}</td>
            <td class="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">${esc(String(item.updatedAt).replace(/\s+/g, ' '))}</td>
            <td class="px-6 py-4 text-sm text-gray-600 min-w-0"><span class="dt-cell-ellipsis" title="${esc(item.creator)}">${esc(item.creator)}</span></td>
            
            <td class="px-6 py-4 text-right min-w-[120px] action-td">
            </td>
        `;
        tbody.appendChild(tr);

        // Add inline actions
        const actionsTd = tr.querySelector('.action-td');
        const actions = [
            {
                label: '编辑',
                onClick: () => window.switchView('knowledge-settings', { id: item.id })
            },
            {
                label: '命中测试',
                onClick: () => window.switchView('knowledge-testing', { id: item.id })
            },
            {
                label: '配置权限',
                onClick: () => {
                    if (window.navigateToPermissionConfig) {
                        window.navigateToPermissionConfig(item.id, 'knowledge_base', item.name);
                    } else {
                        console.error('navigateToPermissionConfig is not defined');
                    }
                }
            },
            {
                label: isKbEnabled ? '停用' : '启用',
                onClick: () => window.toggleKbEnable(item.id, !isKbEnabled)
            },
            {
                label: '删除',
                className: 'text-red-600 hover:text-red-800',
                onClick: () => window.deleteKb(item.id)
            }
        ];
        if (window.createInlineActions) {
            actionsTd.appendChild(window.createInlineActions(actions));
        }
    });
    if (window.syncDataTable) window.syncDataTable('knowledge-data-table', { storageKey: 'dt-colwidths-knowledge' });
}

window.toggleKbEnable = function(id, isEnabled) {
    knowledgeData = knowledgeData.map(item => {
        if (item.id !== id) return item;
        return {
            ...item,
            enabled: !!isEnabled,
            isEnabled: !!isEnabled,
            status: isEnabled ? 'active' : 'disabled',
            updatedAt: new Date().toLocaleString()
        };
    });
    syncKnowledgeDataToSharedStore({ persist: true });
    renderKnowledgeList();
    if (window.showToast) {
        window.showToast(`知识库已${isEnabled ? '启用' : '停用'}`, 'success');
    }
};



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

    const similarityThresholdInput = document.getElementById('create-kb-similarity-threshold');
    const similarityThresholdSlider = document.getElementById('create-kb-similarity-threshold-slider');
    if (similarityThresholdInput && similarityThresholdSlider) {
        const value = typeof saved.similarityThreshold === 'number' ? saved.similarityThreshold : 0.7;
        similarityThresholdInput.value = value;
        similarityThresholdSlider.value = value;
        bindLinkedNumberAndSlider('create-kb-similarity-threshold', 'create-kb-similarity-threshold-slider', 'similarityThreshold');
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
                        相似度阈值
                        <i class="fa-regular fa-circle-question text-gray-400 ml-1" title="用于过滤检索结果的相似度阈值，值越高结果越精准。"></i>
                    </label>
                    <span class="text-[11px] text-gray-500">当前值: <span id="create-kb-similarity-threshold-display" class="font-mono">0.7</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <input id="create-kb-similarity-threshold" type="number" min="0" max="1" step="0.01" value="0.7" class="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-right">
                    <input id="create-kb-similarity-threshold-slider" type="range" min="0" max="1" step="0.01" value="0.7" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                </div>
            </div>
            <div class="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-medium text-gray-700">
                        最终召回 Top N
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
    const similarityThresholdInputDisplay = document.getElementById('create-kb-similarity-threshold');
    const similarityThresholdDisplay = document.getElementById('create-kb-similarity-threshold-display');
    if (similarityThresholdInputDisplay && similarityThresholdDisplay) {
        similarityThresholdDisplay.textContent = parseFloat(similarityThresholdInputDisplay.value).toFixed(2);
        similarityThresholdInputDisplay.addEventListener('input', function() {
            similarityThresholdDisplay.textContent = parseFloat(this.value || '0').toFixed(2);
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
        // sliceSizeEl.oninput = function() {
        //     updateCreateKbSlicePreview();
        // };
    }
    if (sliceOverlapEl) {
        // sliceOverlapEl.oninput = function() {
        //     updateCreateKbSlicePreview();
        // };
    }
    // Note: TopK and Score usually don't affect slice preview, but we can add listeners if needed.
    // For now, we just ensure they exist and can be read.

    const preprocessSpacesEl = document.getElementById('create-kb-preprocess-spaces');
    const preprocessSensitiveEl = document.getElementById('create-kb-preprocess-sensitive');

    if (preprocessSpacesEl) {
        // preprocessSpacesEl.onchange = function() {
        //     updateCreateKbSlicePreview();
        // };
    }
    if (preprocessSensitiveEl) {
        // preprocessSensitiveEl.onchange = function() {
        //     updateCreateKbSlicePreview();
        // };
    }


    const previewFileSelect = document.getElementById('create-kb-preview-file');
    if (previewFileSelect) {
        previewFileSelect.onchange = function() {
            selectCreateKbPreviewFile(this.value);
        };
    }

    const specialTypes = ['word', 'pdf', 'excel', 'ppt', 'image', 'text', 'invoice'];
    specialTypes.forEach(function(type) {
        const el = document.getElementById('create-kb-special-type-' + type);
        if (el) {
            el.onmouseenter = function() {
                setCreateKbSpecialType(type);
            };
            el.onclick = function() {
                if (window.selectCreateKbSpecialType) {
                    window.selectCreateKbSpecialType(type);
                }
            };
        }
    });

    // updateCreateKbSpecialPreview('word');
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
        container.innerHTML = '<div class="px-3 py-6 text-xs text-gray-400 text-center">暂无文件，请先上传</div>';
        updateCreateKbPreviewFileOptions();
        return;
    }

    container.innerHTML = '';
    
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
}

function getCreateKbSliceSource() {
    if (createKbSliceSource) return createKbSliceSource;
    return CREATE_KB_PREVIEW_FALLBACK;
}

let createKbPreviewSlices = [];

function loadOriginalFileContent() {
    let parserSelect, contentEl;
    if (createKbStep === 3) {
        parserSelect = document.getElementById('create-kb-preview-file');
        contentEl = document.getElementById('original-view-content-step3');
    } else {
        parserSelect = document.getElementById('parser-preview-file-select');
        contentEl = document.getElementById('original-view-content');
    }

    if (!contentEl) return;

    if (createKbStep === 3) {
        // Step 3: Use the same source as slice preview
        const source = getCreateKbSliceSource();
        contentEl.textContent = source;
        return;
    }

    if (!parserSelect) return;

    if (lastParsedParagraphs && createKbStep !== 3) {
        contentEl.innerHTML = '';
        lastParsedParagraphs.forEach((text, index) => {
             const span = document.createElement('div');
             span.id = `original-para-${index}`;
             span.className = 'mb-4 p-2 rounded transition-all duration-300 border border-transparent hover:bg-gray-100 cursor-pointer'; 
             span.textContent = text;
             span.onclick = () => highlightParser(index);
             contentEl.appendChild(span);
        });
        return;
    }

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

function updateCreateKbSlicePreview() {
    const previewEl = document.getElementById('create-kb-slice-preview');
    const sizeEl = document.getElementById('create-kb-slice-size');
    const overlapEl = document.getElementById('create-kb-slice-overlap');
    if (!previewEl || !sizeEl || !overlapEl) return;

    const strategy = 'paragraph';
    const size = Math.max(50, Number(sizeEl.value) || 500);
    const overlap = Math.max(0, Number(overlapEl.value) || 0);
    let text = getCreateKbSliceSource();
    const originalText = text;

    // Apply preprocessing rules
    const preprocessSpacesEl = document.getElementById('create-kb-preprocess-spaces');
    const preprocessSensitiveEl = document.getElementById('create-kb-preprocess-sensitive');

    if (preprocessSpacesEl && preprocessSpacesEl.checked) {
        text = text.replace(/[\s\t\n]+/g, ' ');
    }

    if (preprocessSensitiveEl && preprocessSensitiveEl.checked) {
        text = text.replace(/https?:\/\/[^\s]+/g, '');
        text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    }

    let slices = [];
    if (strategy === 'paragraph') {
        const regex = /\n\s*\n|。/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const content = text.substring(lastIndex, match.index + match[0].length).trim();
            if (content) {
                slices.push({
                    content: content,
                    start: lastIndex,
                    end: match.index + match[0].length
                });
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            const content = text.substring(lastIndex).trim();
            if (content) {
                slices.push({
                    content: content,
                    start: lastIndex,
                    end: text.length
                });
            }
        }
    } else if (strategy === 'length') {
        let start = 0;
        while (start < text.length && slices.length < 50) {
            const end = Math.min(text.length, start + size);
            slices.push({
                content: text.slice(start, end),
                start: start,
                end: end
            });
            if (end >= text.length) break;
            start = end - overlap;
            if (start < 0) start = 0;
        }
    } else if (strategy === 'title') {
        const regex = /^#{1,3}\s+.+$/gm;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                const content = text.substring(lastIndex, match.index).trim();
                if (content) {
                    slices.push({
                        content: content,
                        start: lastIndex,
                        end: match.index
                    });
                }
            }
            lastIndex = match.index;
            // Find next title or end
            const nextMatch = regex.exec(text);
            const end = nextMatch ? nextMatch.index : text.length;
            const content = text.substring(lastIndex, end).trim();
            if (content) {
                slices.push({
                    content: content,
                    start: lastIndex,
                    end: end
                });
            }
            lastIndex = end;
            if (!nextMatch) break;
            regex.lastIndex = end; // Reset for next iteration
        }
    }

    if (!slices.length) {
        slices = [{
            content: text,
            start: 0,
            end: text.length
        }];
    }
    
    createKbPreviewSlices = slices;
    renderCreateKbPreviewSlices();
}

let currentActiveSliceIdx = -1;
let exceptionSliceIndices = [];
let currentExceptionNavIdx = -1;

function renderCreateKbPreviewSlices() {
    const previewEl = document.getElementById('create-kb-slice-preview');
    const countEl = document.getElementById('create-kb-slice-count');
    const exceptionNav = document.getElementById('create-kb-exception-nav');
    const exceptionCountEl = document.getElementById('create-kb-exception-count');
    
    if (countEl) countEl.textContent = `共 ${createKbPreviewSlices.length} 个切片`;
    if (!previewEl) return;

    previewEl.innerHTML = '';
    exceptionSliceIndices = [];
    
    // Identify exceptions (simulation)
    createKbPreviewSlices.forEach((sliceObj, idx) => {
        const slice = typeof sliceObj === 'string' ? sliceObj : sliceObj.content;
        // Criteria: too short (< 20), too long (> 1000), or contains specific words
        if (slice.length < 20 || slice.length > 1000 || slice.includes('例如')) {
            exceptionSliceIndices.push(idx);
        }
    });

    // Update exception UI
    if (exceptionNav && exceptionCountEl) {
        if (exceptionSliceIndices.length > 0) {
            exceptionNav.classList.remove('hidden');
            exceptionNav.classList.add('flex');
            exceptionCountEl.textContent = exceptionSliceIndices.length;
        } else {
            exceptionNav.classList.add('hidden');
            exceptionNav.classList.remove('flex');
        }
    }
    
    // Performance: Virtual scrolling/Lazy rendering for 10k+ slices
    const renderLimit = 100;
    const slicesToRender = createKbPreviewSlices.slice(0, renderLimit);

    slicesToRender.forEach((sliceObj, idx) => {
        const slice = typeof sliceObj === 'string' ? sliceObj : sliceObj.content;
        const isException = exceptionSliceIndices.includes(idx);

        const block = document.createElement('div');
        block.className = `border rounded-md bg-white px-3 py-2 group cursor-pointer transition-all duration-200 ${
            currentActiveSliceIdx === idx ? 'ring-2 ring-blue-500 border-transparent shadow-sm' : 
            isException ? 'border-red-200 bg-red-50/30 hover:border-red-300' : 'border-gray-200 hover:border-blue-300'
        }`;
        block.id = `slice-item-${idx}`;
        block.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('select')) return;
            selectAndSyncSlice(idx);
        };
        
        // View Mode
        const viewMode = `
            <div id="slice-view-${idx}">
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] ${isException ? 'text-red-600 font-bold' : 'text-gray-500 font-medium'}">切片 #${idx + 1}</span>
                        <span class="text-[11px] text-gray-400">${slice.length} 字符</span>
                        ${isException ? '<span class="text-[10px] bg-red-100 text-red-600 px-1 rounded">异常</span>' : ''}
                        <select onchange="switchSliceModel(${idx}, this.value)" class="ml-2 text-[9px] border border-gray-200 rounded px-1 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                            <option value="MinerU" ${(!sliceObj.model || sliceObj.model === 'MinerU') ? 'selected' : ''}>MinerU</option>
                            <option value="Paddle-vl" ${sliceObj.model === 'Paddle-vl' ? 'selected' : ''}>Paddle-vl</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="editCreateKbSlice(${idx})" class="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                            <i class="fa-solid fa-pen-to-square text-[10px]"></i>
                        </button>
                        <button onclick="splitCreateKbSlice(${idx})" class="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                            <i class="fa-solid fa-scissors text-[10px]"></i>
                        </button>
                        ${idx < createKbPreviewSlices.length - 1 ? `
                        <button onclick="mergeCreateKbSlice(${idx})" class="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                            <i class="fa-solid fa-link text-[10px]"></i>
                        </button>` : ''}
                        <button onclick="deleteCreateKbSlice(${idx})" class="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                    </div>
                </div>
                <div class="text-[11px] text-gray-700 whitespace-pre-line break-words line-clamp-3 group-hover:line-clamp-none transition-all">${slice}</div>
            </div>
        `;
        
        // Edit Mode
        const editMode = `
            <div id="slice-edit-${idx}" class="hidden space-y-2">
                 <div class="flex items-center justify-between mb-1">
                    <span class="text-[11px] text-blue-600 font-medium">编辑切片 #${idx + 1}</span>
                </div>
                <textarea id="slice-input-${idx}" 
                    class="w-full text-[11px] text-gray-700 border border-blue-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                    oninput="debounceSyncSlice(${idx}, this.value)">${slice}</textarea>
                <div class="flex justify-end gap-2">
                    <button onclick="cancelEditCreateKbSlice(${idx})" class="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button onclick="saveCreateKbSlice(${idx})" class="px-2 py-1 text-[10px] text-white bg-blue-600 hover:bg-blue-700 rounded">保存</button>
                </div>
            </div>
        `;
        
        const mid = Math.floor(slice.length / 2);
        const firstHalf = slice.slice(0, mid);
        const secondHalf = slice.slice(mid);
        
        const splitMode = `
            <div id="slice-split-${idx}" class="hidden space-y-2">
                 <div class="flex items-center justify-between mb-1">
                    <span class="text-[11px] text-blue-600 font-medium">拆分切片 #${idx + 1}</span>
                </div>
                <div class="grid grid-cols-1 gap-2">
                    <textarea id="slice-split-1-${idx}" class="w-full text-[11px] text-gray-700 border border-blue-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]">${firstHalf}</textarea>
                    <textarea id="slice-split-2-${idx}" class="w-full text-[11px] text-gray-700 border border-blue-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]">${secondHalf}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="cancelSplitCreateKbSlice(${idx})" class="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button onclick="confirmSplitCreateKbSlice(${idx})" class="px-2 py-1 text-[10px] text-white bg-blue-600 hover:bg-blue-700 rounded">确认拆分</button>
                </div>
            </div>
        `;

        block.innerHTML = viewMode + editMode + splitMode;
        previewEl.appendChild(block);
    });

    if (createKbPreviewSlices.length > renderLimit) {
        const moreHint = document.createElement('div');
        moreHint.className = 'text-center py-4 text-[10px] text-gray-400 italic';
        moreHint.textContent = `还有 ${createKbPreviewSlices.length - renderLimit} 个切片未显示，支持懒加载滚动预览...`;
        previewEl.appendChild(moreHint);
    }
}

let syncDebounceTimer = null;

function debounceSyncSlice(idx, newValue) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
        syncSliceToOriginal(idx, newValue);
    }, 250); // < 300ms requirement
}

function syncSliceToOriginal(idx, newValue) {
    const sliceObj = createKbPreviewSlices[idx];
    if (!sliceObj || typeof sliceObj === 'string') return;

    // Real-time synchronization of text
    const oldContent = sliceObj.content;
    sliceObj.content = newValue;

    // Optional: Implement conflict detection/merging if needed
    // For local editing, we just update the source
    if (!createKbSliceSource) {
        createKbSliceSource = CREATE_KB_PREVIEW_FALLBACK;
    }

    const before = createKbSliceSource.substring(0, sliceObj.start);
    const after = createKbSliceSource.substring(sliceObj.end);
    
    // Update global source
    createKbSliceSource = before + newValue + after;
        
    // Update subsequent slice offsets
    const diff = newValue.length - oldContent.length;
    sliceObj.end += diff;
    for (let i = idx + 1; i < createKbPreviewSlices.length; i++) {
        createKbPreviewSlices[i].start += diff;
        createKbPreviewSlices[i].end += diff;
    }

    // Refresh original view content to maintain consistency
    if (isViewingOriginal && createKbStep === 3) {
        const contentEl = document.getElementById('original-view-content-step3');
        if (contentEl) contentEl.textContent = createKbSliceSource;
    }
}

function selectAndSyncSlice(idx) {
    currentActiveSliceIdx = idx;
    const sliceObj = createKbPreviewSlices[idx];
    if (!sliceObj) return;

    // 1. Highlight in preview area
    renderCreateKbPreviewSlices();
    
    // 2. Open Original View if hidden
    if (!isViewingOriginal) {
        toggleOriginalView(true);
    }

    // 3. Scroll and highlight in original text area
    setTimeout(() => {
        const originalContentEl = document.getElementById('original-view-content-step3');
        const wrapperEl = document.getElementById('original-view-content-wrapper-step3');
        if (!originalContentEl || !wrapperEl) return;

        const text = originalContentEl.textContent;
        const start = sliceObj.start;
        const end = sliceObj.end;

        // Create a temporary highlight span
        const before = text.substring(0, start);
        const match = text.substring(start, end);
        const after = text.substring(end);

        originalContentEl.innerHTML = `${before}<span id="current-slice-highlight" class="bg-blue-100 text-blue-800 rounded px-0.5 font-bold transition-all duration-300" style="background-color: rgba(59, 130, 246, 0.2);">${match}</span>${after}`;

        const highlightEl = document.getElementById('current-slice-highlight');
        if (highlightEl) {
            highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Auto-remove highlight after 2s
            setTimeout(() => {
                highlightEl.classList.remove('bg-blue-100', 'text-blue-800', 'font-bold');
                highlightEl.style.backgroundColor = 'transparent';
            }, 2000);
        }
    }, 300); // Wait for panel transition
}

// Keyboard shortcuts for slice navigation
document.addEventListener('keydown', (e) => {
    if (createKbStep !== 3) return;
    
    // Ctrl + Left/Right
    if (e.ctrlKey) {
        if (e.key === 'ArrowRight') {
            if (currentActiveSliceIdx < createKbPreviewSlices.length - 1) {
                selectAndSyncSlice(currentActiveSliceIdx + 1);
            }
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            if (currentActiveSliceIdx > 0) {
                selectAndSyncSlice(currentActiveSliceIdx - 1);
            }
            e.preventDefault();
        }
    }
});

function deleteCreateKbSlice(idx) {
    if (confirm('确定要删除这个切片吗？')) {
        createKbPreviewSlices.splice(idx, 1);
        renderCreateKbPreviewSlices();
    }
}

function switchSliceModel(idx, model) {
    const sliceObj = createKbPreviewSlices[idx];
    if (sliceObj && typeof sliceObj === 'object') {
        sliceObj.model = model;
        renderCreateKbPreviewSlices();
        console.log(`[Parser] Slice #${idx + 1} switched to model: ${model}`);
    }
}

function editCreateKbSlice(idx) {
    document.getElementById(`slice-view-${idx}`).classList.add('hidden');
    document.getElementById(`slice-edit-${idx}`).classList.remove('hidden');
    document.getElementById(`slice-split-${idx}`).classList.add('hidden');
}

function cancelEditCreateKbSlice(idx) {
    document.getElementById(`slice-view-${idx}`).classList.remove('hidden');
    document.getElementById(`slice-edit-${idx}`).classList.add('hidden');
}

function saveCreateKbSlice(idx) {
    const input = document.getElementById(`slice-input-${idx}`);
    if (input) {
        const newValue = input.value;
        const sliceObj = createKbPreviewSlices[idx];
        
        if (typeof sliceObj === 'object') {
            syncSliceToOriginal(idx, newValue);
        } else {
            createKbPreviewSlices[idx] = newValue;
        }
        
        renderCreateKbPreviewSlices();
    }
}

function splitCreateKbSlice(idx) {
    document.getElementById(`slice-view-${idx}`).classList.add('hidden');
    document.getElementById(`slice-edit-${idx}`).classList.add('hidden');
    document.getElementById(`slice-split-${idx}`).classList.remove('hidden');
}

function cancelSplitCreateKbSlice(idx) {
    document.getElementById(`slice-view-${idx}`).classList.remove('hidden');
    document.getElementById(`slice-split-${idx}`).classList.add('hidden');
}

function confirmSplitCreateKbSlice(idx) {
    const p1 = document.getElementById(`slice-split-1-${idx}`).value;
    const p2 = document.getElementById(`slice-split-2-${idx}`).value;
    
    if (!p1 && !p2) return;
    
    const sliceObj = createKbPreviewSlices[idx];
    const isObj = typeof sliceObj === 'object';
    
    if (p1 && p2) {
        if (isObj) {
            const mid = sliceObj.start + p1.length;
            const newSlices = [
                { content: p1, start: sliceObj.start, end: mid },
                { content: p2, start: mid, end: sliceObj.end }
            ];
            createKbPreviewSlices.splice(idx, 1, ...newSlices);
        } else {
            createKbPreviewSlices.splice(idx, 1, p1, p2);
        }
    } else if (p1) {
        if (isObj) sliceObj.content = p1;
        else createKbPreviewSlices[idx] = p1;
    } else if (p2) {
        if (isObj) sliceObj.content = p2;
        else createKbPreviewSlices[idx] = p2;
    }
    
    renderCreateKbPreviewSlices();
}

function mergeCreateKbSlice(idx) {
    if (idx >= createKbPreviewSlices.length - 1) return;
    
    const current = createKbPreviewSlices[idx];
    const next = createKbPreviewSlices[idx + 1];
    
    const isObj = typeof current === 'object';
    
    if (isObj) {
        const mergedContent = current.content + '\n' + next.content;
        const mergedSlice = {
            content: mergedContent,
            start: current.start,
            end: next.end
        };
        createKbPreviewSlices.splice(idx, 2, mergedSlice);
    } else {
        createKbPreviewSlices.splice(idx, 2, current + '\n' + next);
    }
    renderCreateKbPreviewSlices();
}

// Expose functions to window
window.editCreateKbSlice = editCreateKbSlice;
window.cancelEditCreateKbSlice = cancelEditCreateKbSlice;
window.saveCreateKbSlice = saveCreateKbSlice;
window.splitCreateKbSlice = splitCreateKbSlice;
window.cancelSplitCreateKbSlice = cancelSplitCreateKbSlice;
window.confirmSplitCreateKbSlice = confirmSplitCreateKbSlice;
window.mergeCreateKbSlice = mergeCreateKbSlice;

function updateCreateKbConfigPreview() {
    const select = document.getElementById('create-kb-preview-file');
    if (!select) return;
    const index = select.value;
    
    // Check if index is valid (empty string is common for default/placeholder)
    if (!index && index !== '0' && index !== 0) return;
    
    const file = createKbFiles[index];
    if (!file) return;
    
    // Determine type for special preview hint
    let type = 'text';
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) type = 'pdf';
    else if (name.endsWith('.docx') || name.endsWith('.doc')) type = 'word';
    else if (name.endsWith('.pptx') || name.endsWith('.ppt')) type = 'ppt';
    else if ((file.file && file.file.type && file.file.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp)$/.test(name)) type = 'image';
    
    updateCreateKbSpecialPreview(type);
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
    const startTime = performance.now();
    try {
        // 1. Reset State: Ensure clean slate for Step 1
        resetCreateKbForm();
        
        isUploadOnlyMode = false;
        setupParserInteractions();
        
        // Removed: Logic to hide list view (now using modal overlay)
        // const listView = document.getElementById('kb-list-view');
        // const detailView = document.getElementById('kb-detail-view');
        const createPage = document.getElementById('kb-create-page');
        
        // 7. Error Handling: Check for critical elements
        if (!createPage) {
            throw new Error('Create KB page container not found');
        }

        // 2. Show Modal
        createPage.classList.remove('hidden');
        
        // 7. Disable Background Scroll
        document.body.style.overflow = 'hidden';
        
        // 6. Accessibility: Focus on first input
        const firstInput = document.getElementById('create-kb-name');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 50);
        }
        
        // 6. Accessibility: Add ESC key listener
        document.addEventListener('keydown', handleCreateKbEsc);

        // 8. Performance Check
        const endTime = performance.now();
        if (endTime - startTime > 200) {
            console.warn(`openCreateKbPage took ${endTime - startTime}ms`);
        }
        
    } catch (error) {
        console.error('Error opening Create KB page:', error);
        if (window.showToast) {
            window.showToast('系统错误：无法打开创建页面', 'error');
        } else {
            alert('系统错误：无法打开创建页面');
        }
    }
}

function handleCreateKbEsc(e) {
    if (e.key === 'Escape') {
        const createPage = document.getElementById('kb-create-page');
        if (createPage && !createPage.classList.contains('hidden')) {
            // Check if there are any other modals open on top (e.g., delete confirmation)
            // Ideally we should check z-index or stack, but for now simple check:
            const deleteDocModal = document.getElementById('delete-doc-modal');
            const deleteKbModal = document.getElementById('delete-kb-modal');
            const parseModal = document.getElementById('parse-result-modal');
            
            if ((deleteDocModal && !deleteDocModal.classList.contains('hidden')) ||
                (deleteKbModal && !deleteKbModal.classList.contains('hidden')) ||
                (parseModal && !parseModal.classList.contains('hidden'))) {
                return; // Let those modals handle their own ESC
            }
            
            cancelCreateKb();
        }
    }
}

function closeCreateKbPage() {
    // const listView = document.getElementById('kb-list-view');
    const createPage = document.getElementById('kb-create-page');
    
    if (createPage) createPage.classList.add('hidden');
    // if (listView) listView.classList.remove('hidden');

    // Ensure we return to a valid view (KB List)
    const listView = document.getElementById('kb-list-view');
    const knowledgeView = document.getElementById('knowledge-view-tab');
    
    // If we were in list view before (which we usually are when creating KB), show it.
    // If we opened it from somewhere else, we might need logic.
    // Assuming Create KB is a modal on top of KB List.
    if (listView) {
        listView.classList.remove('hidden');
        renderKnowledgeList(); // Refresh data
    }
    
    // Restore Background Scroll
    document.body.style.overflow = '';
    
    // Remove ESC listener
    document.removeEventListener('keydown', handleCreateKbEsc);
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

    // Handle container layout for Step 3 split view
    const stepsContainer = document.getElementById('kb-create-steps-container');
    if (stepsContainer) {
        if (createKbStep === 3) {
            stepsContainer.classList.remove('overflow-y-auto');
            stepsContainer.classList.add('overflow-hidden', 'flex', 'flex-col');
        } else {
            stepsContainer.classList.add('overflow-y-auto');
            stepsContainer.classList.remove('overflow-hidden', 'flex', 'flex-col');
        }
    }

    // Initialize height sync when entering step 3
    if (createKbStep === 3) {
        setTimeout(() => {
            if (window.initCreateKbHeightSync) window.initCreateKbHeightSync();
            initStep3LinkedScroll();
        }, 50);
    }

    const s1 = document.getElementById('kb-create-stepper-1');
    const s2 = document.getElementById('kb-create-stepper-2');
    const s3 = document.getElementById('kb-create-stepper-3');
    const applyStepperState = (btn, index) => {
        if (!btn) return;
        
        // Define base classes
        const btnBase = "flex items-center gap-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200";
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
                let displayIndex = index;
                if (isUploadOnlyMode) {
                    if (index === 2) displayIndex = 1;
                    if (index === 3) displayIndex = 2;
                }
                circle.textContent = String(displayIndex);
            }
        }
    };
    applyStepperState(s1, 1);
    applyStepperState(s2, 2);
    applyStepperState(s3, 3);

    const sep1 = document.getElementById('kb-create-separator-1');
    if (s1) s1.classList.toggle('hidden', isUploadOnlyMode);
    if (sep1) sep1.classList.toggle('hidden', isUploadOnlyMode);

    const backTitle = document.querySelector('#kb-create-page .flex.items-center.gap-2 span.text-sm.font-medium');
    if (backTitle) {
        backTitle.textContent = isUploadOnlyMode ? '上传文档' : '新建知识库';
    }

    const prevBtn = document.getElementById('kb-create-prev');
    const nextBtn = document.getElementById('kb-create-next');
    if (prevBtn) {
        const isFirstStep = isUploadOnlyMode ? createKbStep === 2 : createKbStep === 1;
        prevBtn.disabled = isFirstStep;
        prevBtn.classList.toggle('opacity-40', isFirstStep);
        prevBtn.classList.toggle('cursor-not-allowed', isFirstStep);
    }
    if (nextBtn) {
        nextBtn.textContent = '确定';
    }
}

function nextCreateKbStep() {
    // If in Step 1 (Basic Info), validate and submit directly
    if (createKbStep === 1) {
        if (!validateCreateKbBasic()) return;
        submitCreateKb();
        return;
    }
    
    // For other steps (Upload/Settings - currently not reachable for new KB creation flow), 
    // keep original logic or handle accordingly if needed in future
    // ...
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
    isUploadOnlyMode = false;
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
    const specialTypes = ['chapter', 'excel', 'ppt', 'image', 'text', 'invoice'];
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

function selectPptSubType(subType) {
    const defaultBtn = document.getElementById('ppt-sub-type-default');
    const processBtn = document.getElementById('ppt-sub-type-process');
    
    if (subType === 'default') {
        if (defaultBtn) defaultBtn.className = 'px-3 py-1.5 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium transition-colors';
        if (processBtn) processBtn.className = 'px-3 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-colors';
    } else {
        if (processBtn) processBtn.className = 'px-3 py-1.5 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium transition-colors';
        if (defaultBtn) defaultBtn.className = 'px-3 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-colors';
    }
}
window.selectPptSubType = selectPptSubType;

function selectImageSubType(subType) {
    const ocrBtn = document.getElementById('image-sub-type-ocr');
    const visionBtn = document.getElementById('image-sub-type-vision');
    
    if (subType === 'ocr') {
        if (ocrBtn) ocrBtn.className = 'px-3 py-1.5 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium transition-colors';
        if (visionBtn) visionBtn.className = 'px-3 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-colors';
        // Render visualization for OCR
        renderSliceVisualization('image', 'ocr');
    } else {
        if (visionBtn) visionBtn.className = 'px-3 py-1.5 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium transition-colors';
        if (ocrBtn) ocrBtn.className = 'px-3 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-colors';
        // Render visualization for Vision
        renderSliceVisualization('image', 'vision');
    }
}
window.selectImageSubType = selectImageSubType;

function updateCreateKbSpecialPreview(type) {
    const hintEl = document.getElementById('create-kb-special-hint');
    const excelHeaderEl = document.getElementById('create-kb-special-excel-header');
    const pptOptionsEl = document.getElementById('create-kb-special-ppt-options');
    const imageOptionsEl = document.getElementById('create-kb-special-image-options');
    
    if (excelHeaderEl) {
        if (type === 'excel') {
            excelHeaderEl.classList.remove('hidden');
        } else {
            excelHeaderEl.classList.add('hidden');
        }
    }

    if (pptOptionsEl) {
        if (type === 'ppt') {
            pptOptionsEl.classList.remove('hidden');
        } else {
            pptOptionsEl.classList.add('hidden');
        }
    }

    if (imageOptionsEl) {
        if (type === 'image') {
            imageOptionsEl.classList.remove('hidden');
            // Select default sub-type (OCR) when showing options if none selected
            // But we don't track state here, just styling.
            // Let's ensure OCR is default visually if not set
            const ocrBtn = document.getElementById('image-sub-type-ocr');
            const visionBtn = document.getElementById('image-sub-type-vision');
            if (ocrBtn && visionBtn && !ocrBtn.className.includes('bg-blue-50') && !visionBtn.className.includes('bg-blue-50')) {
                 selectImageSubType('ocr');
            }
        } else {
            imageOptionsEl.classList.add('hidden');
        }
    }
    
    if (!hintEl) return;
    
    if (!type) {
        hintEl.classList.add('hidden');
        return;
    }
    
    hintEl.classList.remove('hidden');
    let hint = '';
    if (type === 'chapter') {
        hint = '适用于按照章节结构对文档进行切分处理的场景，例如合同文档、员工手册等类型的文件。';
    } else if (type === 'pdf') {
        hint = '适用于 PDF 文档，通常结合页面结构、标题层级与段落进行切分，必要时使用 OCR 结果补全文本。';
    } else if (type === 'excel') {
        hint = '表格型数据支持xlsx、xls文件。将文件中每一行数据加上表头作为一个切片，默认第一行为表头。';
    } else if (type === 'text') {
        hint = '针对纯文本，按换行与空行进行分段，适合日志与记录类内容。';
    } else if (type === 'ppt') {
        hint = '演示型数据，支持ppt、pptx、pdf格式文件，会将文件按页面解析，每页幻灯片的内容将单独存储在一个切片中';
    } else if (type === 'image') {
        hint = '自动提取文字和图片内容作为描述，每张图片将单独存储在一个切片中';
    } else if (type === 'invoice') {
        hint = '针对发票类结构化票据，按字段区域与行项目进行切分。';
    } else {
        hint = '将根据不同文件类型应用对应的专用切片策略。';
    }
    hintEl.textContent = hint;
}

function handleReSlice() {
    const previewContainer = document.getElementById('create-kb-slice-preview');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-blue-500">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i>
            <p class="text-sm">正在重新切片...</p>
        </div>
    `;
    
    // Simulate delay and refresh preview
    setTimeout(() => {
        updateCreateKbSlicePreview();
        // Trigger file selection change to refresh content if a file is selected
        const fileSelect = document.getElementById('create-kb-preview-file');
        if (fileSelect && fileSelect.onchange) {
             fileSelect.onchange();
        } else {
            // If no onchange or not selected, just render default
             renderSliceVisualization(getMockSliceData('chapter'), 'chapter'); 
        }
    }, 1000);
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
    syncKnowledgeDataToSharedStore({ persist: true });
    
    // Show success message
    const nextBtn = document.getElementById('kb-create-next');
    if (nextBtn) {
        const originalText = nextBtn.textContent;
        nextBtn.textContent = '保存成功';
        nextBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        nextBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        
        setTimeout(() => {
            renderKnowledgeList();
            resetCreateKbForm();
            closeCreateKbPage();
            showKbDetail(newKb.id, 'list');
            
            // Reset button style (though page is closed, good for cleanup)
            nextBtn.textContent = originalText;
            nextBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            nextBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }, 500);
    } else {
        renderKnowledgeList();
        resetCreateKbForm();
        closeCreateKbPage();
        showKbDetail(newKb.id, 'list');
    }
}

// Navigation & View Switching
function showKbDetail(kbId, options = {}) {
    options = options || {};
    if (typeof options === 'string') {
        options = { tab: options };
    }
    const sourceRef = options && options.sourceRef ? normalizeKnowledgeSource(options.sourceRef) : null;
    const isSameKb = currentKbId === kbId;
    currentKbId = kbId;
    
    // Check if we need to restore state
    let restoreState = savedKbListState;
    if (!restoreState) {
        try {
            const stored = localStorage.getItem('restoreKbListState');
            if (stored) {
                restoreState = JSON.parse(stored);
                localStorage.removeItem('restoreKbListState');
            }
        } catch (e) {}
    }
    
    // Generate mock docs for this KB (if not already generated or if switching KBs)
    if (!isSameKb || mockDocs.length === 0) {
        mockDocs = generateMockDocs(Math.floor(Math.random() * 40) + 30);
        mockTreeData = generateMockTree();
        // Reset display limit and search only if switching KBs
        docDisplayLimit = 20;
        isLoadingMoreDocs = false;
        docSearchQuery = '';
        treeSearchQuery = '';
    }
    if (sourceRef && sourceRef.document_id) {
        ensureDocForSource(sourceRef);
    }
    
    const searchInput = document.getElementById('doc-search-input');
    
    // Restore state if available and matching KB
    if (restoreState && restoreState.kbId === kbId) {
        if (restoreState.searchQuery) {
            docSearchQuery = restoreState.searchQuery;
        }
        if (searchInput) searchInput.value = docSearchQuery;
    } else if (!isSameKb) {
        if (searchInput) searchInput.value = '';
    }

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
    const savedTab = sourceRef && sourceRef.document_id
        ? 'knowledge'
        : (options.tab || localStorage.getItem('kbCurrentTab') || 'list');
    switchKbTab(savedTab);
    
    // Render content
    renderDocList();
    renderDocTree();
    if (sourceRef && sourceRef.document_id) {
        setTimeout(() => selectDoc(sourceRef.document_id, sourceRef), 0);
    }
    
    // Setup Scroll Listener
    const scrollContainer = document.getElementById('doc-list-scroll-container');
    if (scrollContainer) {
        scrollContainer.onscroll = () => {
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50) {
                loadMoreDocs();
            }
        };
        
        // Restore scroll position
        if (restoreState && restoreState.kbId === kbId && restoreState.scrollTop) {
            setTimeout(() => {
                scrollContainer.scrollTop = restoreState.scrollTop;
            }, 0);
        }
    }
    
    // Reset saved state
    if (restoreState) {
        savedKbListState = null;
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

    if (typeof closeBatchSliceSettingsPage === 'function') {
        const page = document.getElementById('batch-slice-settings-page');
        if (page && !page.classList.contains('hidden')) {
            closeBatchSliceSettingsPage();
        }
    }
    
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
let selectedDocIds = new Set();

let isBatchOperationMode = false;
const BATCH_OP_MODE_KEY = 'kb_batch_operation_mode';
const BATCH_OP_SELECTION_KEY = 'kb_batch_operation_selected_doc_ids';

// 批量切片配置：同类型文件选择锁
// 规则：勾选第一个文件后，只允许继续勾选相同数据类型（文本文档/表格/图片）
window.batchSliceLockedType = null; // 'text' | 'table' | 'image' | null

window.getBatchDataTypeFromDoc = function(doc) {
    // 统一按“数据类型 div 对应文件格式”进行分组：
    // - 表格：.xls/.xlsx/.csv 或 doc.type=Excel
    // - 图片：.png/.jpg/.jpeg/.bmp/.gif/.webp 或 doc.type=PNG/Image
    // - 其余：文本文档（.doc/.docx/.ppt/.pptx/.md/.txt/.pdf 等）
    if (!doc) return 'text';
    const t = String(doc.type || doc.fileType || '').toLowerCase();
    if (['excel', 'xls', 'xlsx', 'csv', 'table'].includes(t)) return 'table';
    if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'image'].includes(t)) return 'image';
    // 用文件名后缀兜底
    const name = String(doc.name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (['xls', 'xlsx', 'csv', 'excel'].includes(ext)) return 'table';
    if (['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'].includes(ext)) return 'image';
    return 'text';
};

function persistBatchOperationState() {
    try {
        localStorage.setItem(BATCH_OP_MODE_KEY, isBatchOperationMode ? '1' : '0');
        localStorage.setItem(BATCH_OP_SELECTION_KEY, JSON.stringify(Array.from(selectedDocIds)));
    } catch (_) {
    }
}

function setElVisibleWithFade(el, visible) {
    if (!el) return;

    const timerKey = 'fadeHideTimer';
    if (el.dataset && el.dataset[timerKey]) {
        const existing = Number(el.dataset[timerKey]);
        if (existing) clearTimeout(existing);
        delete el.dataset[timerKey];
    }

    if (visible) {
        el.classList.remove('hidden');
        el.classList.remove('pointer-events-none');
        el.classList.remove('opacity-0');
        el.classList.add('opacity-100');
        return;
    }

    el.classList.add('pointer-events-none');
    el.classList.remove('opacity-100');
    el.classList.add('opacity-0');
    const t = setTimeout(() => {
        el.classList.add('hidden');
    }, 180);
    if (el.dataset) el.dataset[timerKey] = String(t);
}

function applyBatchOperationModeUI() {
    const defaultActions = document.getElementById('doc-toolbar-default-actions');
    const batchActions = document.getElementById('doc-toolbar-batch-actions');
    const selectHeader = document.getElementById('doc-select-col-header');

    if (isBatchOperationMode) {
        setElVisibleWithFade(defaultActions, false);
        setElVisibleWithFade(batchActions, true);
        if (selectHeader) selectHeader.classList.remove('hidden');
    } else {
        setElVisibleWithFade(batchActions, false);
        setElVisibleWithFade(defaultActions, true);
        if (selectHeader) selectHeader.classList.add('hidden');
    }
}

function enterBatchOperationMode() {
    isBatchOperationMode = true;
    applyBatchOperationModeUI();
    persistBatchOperationState();
    renderDocList();
}
window.enterBatchOperationMode = enterBatchOperationMode;

function exitBatchOperationMode() {
    isBatchOperationMode = false;
    selectedDocIds.clear();
    window.batchParserTargetDocIds = [];
    window.batchSliceTargetDocIds = [];
    const selectAll = document.getElementById('select-all-docs');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    applyBatchOperationModeUI();
    persistBatchOperationState();
    renderDocList();
}
window.exitBatchOperationMode = exitBatchOperationMode;

function restoreBatchOperationState() {
    let shouldEnable = false;
    let savedIds = [];
    try {
        shouldEnable = localStorage.getItem(BATCH_OP_MODE_KEY) === '1';
        const raw = localStorage.getItem(BATCH_OP_SELECTION_KEY);
        savedIds = raw ? JSON.parse(raw) : [];
    } catch (_) {
        shouldEnable = false;
        savedIds = [];
    }

    isBatchOperationMode = !!shouldEnable;
    selectedDocIds = new Set(Array.isArray(savedIds) ? savedIds : []);
    applyBatchOperationModeUI();
}

function toggleAllDocs(checkbox) {
    const isChecked = checkbox.checked;
    const query = (window.docSearchQuery || '').toLowerCase();
    const docs = mockDocs.filter(doc => doc.name.toLowerCase().includes(query));
    
    if (isChecked) {
        // 勾选全选时：若已锁定类型，仅选择同类型；若未锁定，则以当前列表第一条的类型作为锁定类型
        let lockType = window.batchSliceLockedType;
        if (!lockType && docs.length > 0) {
            lockType = window.getBatchDataTypeFromDoc(docs[0]);
            window.batchSliceLockedType = lockType;
        }
        docs.forEach(doc => {
            if (!lockType || window.getBatchDataTypeFromDoc(doc) === lockType) {
                selectedDocIds.add(doc.id);
            }
        });
    } else {
        selectedDocIds.clear();
        window.batchSliceLockedType = null;
    }
    persistBatchOperationState();
    renderDocList();
}

function toggleDocSelection(id) {
    const doc = Array.isArray(mockDocs) ? mockDocs.find(d => d && d.id === id) : null;
    const docType = window.getBatchDataTypeFromDoc(doc);

    if (selectedDocIds.has(id)) {
        selectedDocIds.delete(id);
        if (selectedDocIds.size === 0) window.batchSliceLockedType = null;
    } else {
        // 第一次勾选时锁定类型；后续仅允许同类型
        if (!window.batchSliceLockedType) {
            window.batchSliceLockedType = docType;
        } else if (window.batchSliceLockedType !== docType) {
            if (window.showToast) window.showToast('批量切片配置仅支持选择同一数据类型文件', 'error');
            return;
        }
        selectedDocIds.add(id);
    }
    persistBatchOperationState();
    renderDocList();
}

function setBatchSliceTargetsFromSelection() {
    try {
        window.batchSliceTargetDocIds = Array.from(selectedDocIds)
    } catch (_) {
        window.batchSliceTargetDocIds = []
    }
}
window.setBatchSliceTargetsFromSelection = setBatchSliceTargetsFromSelection;

function setBatchParserTargetsFromSelection() {
    try {
        window.batchParserTargetDocIds = Array.from(selectedDocIds)
    } catch (_) {
        window.batchParserTargetDocIds = []
    }
}
window.setBatchParserTargetsFromSelection = setBatchParserTargetsFromSelection;



function renderDocList() {
    const tbody = document.getElementById('doc-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Filter
    let filteredDocs = getFilteredDocs();
    
    // Update Select All Checkbox State
    const selectAllCheckbox = document.getElementById('select-all-docs');
    if (selectAllCheckbox) {
        const allSelected = filteredDocs.length > 0 && filteredDocs.every(doc => selectedDocIds.has(doc.id));
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = !allSelected && filteredDocs.some(doc => selectedDocIds.has(doc.id));
    }

    // Handle Version Column Visibility
    const thVersion = document.getElementById('kb-th-version');
    const isVersionEnabledGlobal = localStorage.getItem('kb_version_enabled') !== '0';
    if (thVersion) {
        if (isVersionEnabledGlobal) {
            thVersion.classList.remove('hidden');
        } else {
            thVersion.classList.add('hidden');
        }
    }

    // Update Total Count
    const countEl = document.getElementById('doc-total-count');
    if (countEl) countEl.textContent = `共 ${filteredDocs.length} 个文档`;

    // Infinite Scroll Slice
    const visibleDocs = filteredDocs.slice(0, docDisplayLimit);
    
    if (visibleDocs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="px-6 py-8 text-center text-gray-500">暂无文档</td></tr>';
        if (window.syncDataTable) window.syncDataTable('kb-doc-data-table', { storageKey: 'dt-colwidths-kb-docs' });
        return;
    }
    
    visibleDocs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.dataset.docId = doc.id;
        tr.className = 'hover:bg-gray-50 transition-colors group';
        if (selectedDocIds.has(doc.id)) {
            tr.classList.add('bg-blue-50/50');
        }

        const sliceCellState = doc && doc.strategyCellState && doc.strategyCellState.slice ? doc.strategyCellState.slice : null;
        const parserCellState = doc && doc.strategyCellState && doc.strategyCellState.parser ? doc.strategyCellState.parser : null;

        const sliceSettingText = doc && doc.sliceSettingName ? doc.sliceSettingName : '未设置';
        const parserNameText = doc && doc.parserName ? doc.parserName : '未设置';

        const sliceBtnTitle = sliceCellState && sliceCellState.tooltip 
            ? sliceCellState.tooltip 
            : (sliceSettingText && sliceSettingText.length > 8 ? sliceSettingText : '打开切片设置');
        const parserBtnTitle = parserCellState && parserCellState.tooltip 
            ? parserCellState.tooltip 
            : (parserNameText && parserNameText.length > 8 ? parserNameText : '打开解析器设置');

        const sliceBtnClass = sliceCellState && sliceCellState.abnormal
            ? 'text-red-600 border border-red-500 rounded px-2 py-0.5 max-w-[120px] truncate block text-left'
            : 'text-[#999] font-normal hover:text-blue-600 hover:underline max-w-[120px] truncate block text-left';
        const parserBtnClass = parserCellState && parserCellState.abnormal
            ? 'text-red-600 border border-red-500 rounded px-2 py-0.5 max-w-[120px] truncate block text-left'
            : 'text-[#999] font-normal hover:text-blue-600 hover:underline max-w-[120px] truncate block text-left';
        
        const normalizedStatus = normalizeDocStatus(doc.status);
        let statusClass = 'bg-gray-100 text-gray-600';
        let statusText = '未解析';
        if (normalizedStatus === 'unparsed') {
            statusClass = 'bg-gray-100 text-gray-600';
            statusText = '未解析';
        } else if (normalizedStatus === 'parsing') {
            statusClass = 'bg-blue-100 text-blue-700';
            statusText = '解析中';
        } else if (normalizedStatus === 'success') {
            statusClass = 'bg-green-100 text-green-700';
            statusText = '解析成功';
        } else if (normalizedStatus === 'failed') {
            statusClass = 'bg-red-100 text-red-700';
            statusText = '解析失败';
        } else if (normalizedStatus === 'retry') {
            statusClass = 'bg-amber-100 text-amber-700';
            statusText = '待重新解析';
        } else {
            statusClass = 'bg-gray-100 text-gray-600';
            statusText = '未解析';
        }
        
        // Check Version Setting
        const isVersionEnabled = localStorage.getItem('kb_version_enabled') !== '0';
        const versionColClass = isVersionEnabled ? '' : 'hidden';

        const rawType = doc && doc.type ? String(doc.type) : '';
        const displayType = rawType === 'Text' ? 'txt'
            : rawType === 'Markdown' ? 'md'
            : rawType === 'Excel' ? 'xls'
            : rawType;

        let iconClass = 'fa-file';
        let iconColor = 'text-gray-400';
        if (rawType === 'PDF') { iconClass = 'fa-file-pdf'; iconColor = 'text-red-500'; }
        else if (rawType === 'Word') { iconClass = 'fa-file-word'; iconColor = 'text-blue-500'; }
        else if (rawType === 'Excel' || rawType === 'xls') { iconClass = 'fa-file-excel'; iconColor = 'text-green-500'; }
        else if (rawType === 'Markdown' || rawType === 'md') { iconClass = 'fa-file-code'; iconColor = 'text-purple-500'; }
        else if (rawType === 'Text' || rawType === 'txt') { iconClass = 'fa-file-lines'; iconColor = 'text-gray-500'; }
        else if (rawType === 'PNG' || rawType === 'Image') { iconClass = 'fa-file-image'; iconColor = 'text-amber-500'; }

        const isChecked = selectedDocIds.has(doc.id) ? 'checked' : '';
        const selectColHiddenClass = isBatchOperationMode ? '' : 'hidden';
        const batchLockType = window.batchSliceLockedType;
        const docBatchType = window.getBatchDataTypeFromDoc(doc);
        const isLockedOut = isBatchOperationMode && batchLockType && docBatchType !== batchLockType;
        const rowLockedClass = isLockedOut ? 'opacity-50 pointer-events-none' : '';

        tr.innerHTML = `
            <td class="px-6 py-4 ${selectColHiddenClass} ${rowLockedClass}">
                <input type="checkbox" onclick="toggleDocSelection('${doc.id}')" ${isChecked} ${isLockedOut ? 'disabled' : ''} class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isLockedOut ? 'cursor-not-allowed' : ''}">
            </td>
            <td class="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onclick="openParseModal('${doc.id}')" title="查看解析结果">
                <div class="flex items-center gap-3">
                    <i class="fa-regular ${iconClass} ${iconColor} text-lg"></i>
                    <span class="font-medium text-blue-600 hover:underline">${doc.name}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-gray-500">${doc.size}</td>
            <td class="px-6 py-4 text-gray-500">${displayType}</td>
            <td class="px-6 py-4 text-gray-500 ${versionColClass}">
                <span class="cursor-pointer text-blue-500 hover:underline" onclick="event.stopPropagation(); window.openKbVersionManager('${doc.id}', '${doc.name}')" title="点击查看版本历史">
                    ${doc.version || 'V1.0.0'}
                </span>
            </td>
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
            <td class="px-6 py-4 text-gray-500">${doc.lastParsedSuccessTime || '-'}</td>
            <td class="px-6 py-4">
                <label class="relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
                    <input type="checkbox" class="sr-only peer" checked onchange="toggleDocEnable('${doc.id}', this.checked)">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </td>
            <td class="px-6 py-4 text-gray-500">
                <button type="button" class="${sliceBtnClass} transition-colors" onclick="event.stopPropagation(); window.openStrategyConfig('${doc.id}');" aria-label="打开切片设置" title="${sliceBtnTitle}">
                    ${sliceSettingText}
                </button>
            </td>
            <td class="px-6 py-4 text-gray-500">
                <button type="button" class="${parserBtnClass} transition-colors" onclick="event.stopPropagation(); window.openStrategyConfig('${doc.id}');" aria-label="打开解析器设置" title="${parserBtnTitle}">
                    ${parserNameText}
                </button>
            </td>
            <td class="px-6 py-4 space-x-3 min-w-[140px]">
                <button onclick="event.stopPropagation(); window.submitParse('${doc.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                    提交索引
                </button>
                <button onclick="event.stopPropagation(); window.prepareDeleteDoc('${doc.id}')" class="text-red-500 hover:text-red-700 text-sm font-medium transition-colors">
                    删除
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof window.applyDocRowHighlightFromStorage === 'function') {
        setTimeout(() => window.applyDocRowHighlightFromStorage(), 0);
    }
    if (window.syncDataTable) window.syncDataTable('kb-doc-data-table', { storageKey: 'dt-colwidths-kb-docs' });
}

window.toggleDocEnable = function(id, isEnabled) {
    if (window.showToast) {
        window.showToast(`文档已${isEnabled ? '启用' : '停用'}`, 'success');
    }
};

function prepareBatchDelete() {
    const targetIds = (function () {
        if (typeof selectedDocIds !== 'undefined' && selectedDocIds && selectedDocIds.size > 0) {
            return Array.from(selectedDocIds);
        }
        return [];
    })();

    if (targetIds.length === 0) return;

    if (confirm(`确定要删除选中的 ${targetIds.length} 个文档吗？此操作不可恢复。`)) {
        // Perform deletion
        mockDocs = mockDocs.filter(doc => !selectedDocIds.has(doc.id));
        
        // Save to localStorage
        try {
            localStorage.setItem('mockDocs_v2', JSON.stringify(mockDocs));
        } catch (e) {
            console.error('Failed to save mockDocs to localStorage', e);
        }

        // Clear selection
        selectedDocIds.clear();
        
        // Refresh list
        renderDocList();
        
        // Exit batch mode if no docs left or just to reset
        if (mockDocs.length === 0) {
            exitBatchOperationMode();
        } else {
            // Update UI selection state
            const selectAllCheckbox = document.getElementById('select-all-docs');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
        
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fade-in-down';
        toast.innerHTML = '<i class="fa-solid fa-check-circle"></i><span>删除成功</span>';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 2000);
    }
}
window.prepareBatchDelete = prepareBatchDelete;

function openDocActions(event, id) {
    window.showActionMenu(event, [
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
    let filteredDocs = getFilteredDocs();
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

function toggleAdvancedConfig() {
    const content = document.getElementById('advanced-config-content');
    const arrow = document.getElementById('advanced-config-arrow');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.classList.add('rotate-90');
    } else {
        content.classList.add('hidden');
        arrow.classList.remove('rotate-90');
    }
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

function navigateExceptionSlice(direction) {
    if (exceptionSliceIndices.length === 0) return;

    if (direction === 'next') {
        currentExceptionNavIdx = (currentExceptionNavIdx + 1) % exceptionSliceIndices.length;
    } else {
        currentExceptionNavIdx = (currentExceptionNavIdx - 1 + exceptionSliceIndices.length) % exceptionSliceIndices.length;
    }

    const targetIdx = exceptionSliceIndices[currentExceptionNavIdx];
    const targetEl = document.getElementById(`slice-item-${targetIdx}`);
    const container = document.getElementById('create-kb-slice-preview');

    if (targetEl && container) {
        // Highlight active slice
        selectAndSyncSlice(targetIdx);

        // Smooth scroll to the target slice
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Brief flash effect
        targetEl.classList.add('ring-4', 'ring-red-400');
        setTimeout(() => {
            targetEl.classList.remove('ring-4', 'ring-red-400');
        }, 1000);
    }
}

// Expose functions to window for HTML onclick access
window.initKnowledgePage = initKnowledgePage;
window.renderKnowledgeList = renderKnowledgeList;
window.openCreateKbPage = openCreateKbPage;
window.closeCreateKbPage = closeCreateKbPage;
window.cancelCreateKb = cancelCreateKb;
window.setCreateKbStep = setCreateKbStep;
window.prevCreateKbStep = prevCreateKbStep;
window.nextCreateKbStep = nextCreateKbStep;
window.backToKbList = backToKbList;
window.updateCreateKbSlicePreview = updateCreateKbSlicePreview;
window.navigateExceptionSlice = navigateExceptionSlice;
window.switchSliceModel = switchSliceModel;
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
                updatedAt: new Date().toLocaleString(),
                parserName: treeNode.parserName || '未设置', // Default parser if missing
                sliceSettingName: treeNode.sliceSettingName || '未设置' // Default slice setting if missing
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

function getDocPreviewParagraphs(doc) {
    if (Array.isArray(doc && doc.previewBlocks) && doc.previewBlocks.length) return doc.previewBlocks;
    if (Array.isArray(doc && doc.sourceBlocks) && doc.sourceBlocks.length) return doc.sourceBlocks;
    if (Array.isArray(doc && doc.chunks) && doc.chunks.length) return doc.chunks;

    const docName = doc && doc.name ? doc.name : 'Document';
    const content = doc && doc.content && String(doc.content).trim() && String(doc.content).trim() !== 'This is the mock content for document...'
        ? String(doc.content).trim()
        : '';
    const paragraphs = content
        ? content.split(/\n{2,}/).filter(Boolean)
        : [
            `${docName} contains policy background, applicable scope, processing requirements, and operational notes used by knowledge retrieval.`,
            `Business users should submit required material within the configured time window and keep approval records aligned with company policy.`,
            `The system stores each retrieved chunk with document_id, chunk_id, chunk_content, and source_range so the preview page can locate the original text.`,
            `When the same document is cited by multiple chunks, each citation remains an independent source item and opens the matching block separately.`
        ];

    return paragraphs.map((text, index) => ({
        chunk_id: `chunk-${index + 1}`,
        chunk_content: text
    }));
}

function normalizeDocPreviewBlocks(doc) {
    const utils = getSourceRefUtils();
    const blocks = getDocPreviewParagraphs(doc);
    let cursor = 0;

    return blocks.map((block, index) => {
        const text = String(block.chunk_content || block.content || block.text || block || '');
        const explicitRange = utils.normalizeSourceRange(block.source_range || block.sourceRange || block.range);
        const range = explicitRange || [cursor, cursor + text.length];
        cursor = Math.max(cursor + text.length + 1, range[1] + 1);

        return {
            chunk_id: String(block.chunk_id || block.chunkId || block.id || `chunk-${index + 1}`),
            chunk_content: text,
            source_range: range
        };
    });
}

function ensureSourceDocTreeNode(doc) {
    if (!doc || !doc.id) return;

    const hasNode = (nodes) => {
        return (nodes || []).some(node => {
            if (!node) return false;
            if (node.id === doc.id) return true;
            return Array.isArray(node.children) && hasNode(node.children);
        });
    };
    if (hasNode(mockTreeData)) return;

    let sourceCategory = (mockTreeData || []).find(node => node && node.id === 'CATEGORY-SOURCE-REFS');
    if (!sourceCategory) {
        sourceCategory = {
            id: 'CATEGORY-SOURCE-REFS',
            name: '引用来源',
            type: 'category',
            children: [],
            expanded: true,
            isCategory: true,
            fileTypeCategory: '引用来源'
        };
        mockTreeData.unshift(sourceCategory);
    }

    sourceCategory.children.unshift({
        id: doc.id,
        name: doc.name || doc.id,
        type: 'file',
        fileType: doc.type || 'Text',
        parentId: sourceCategory.id,
        expanded: false
    });
}

function ensureDocForSource(source) {
    const ref = normalizeKnowledgeSource(source);
    if (!ref.document_id) return null;

    let doc = mockDocs.find(d => d && d.id === ref.document_id);
    if (!doc) {
        doc = {
            id: ref.document_id,
            name: ref.document_name || ref.document_id,
            type: getDocExt(ref.document_name || '') === 'pdf' ? 'PDF' : 'Text',
            size: '1.2 MB',
            status: 'success',
            updatedAt: new Date().toLocaleString(),
            lastParsedSuccessTime: new Date().toLocaleString(),
            rank: '-',
            responsibility: '-',
            parserName: 'Default parser',
            sliceSettingName: 'Default slice',
            sourceBlocks: []
        };
        mockDocs.unshift(doc);
    }

    if (ref.document_name) doc.name = ref.document_name;
    const blocks = normalizeDocPreviewBlocks(doc);
    const utils = getSourceRefUtils();
    const hasSourceBlock = blocks.some(block => {
        if (ref.chunk_id && block.chunk_id === ref.chunk_id) return true;
        return ref.source_range && utils.sourceRangeOverlaps(block.source_range, ref.source_range);
    });

    if (!hasSourceBlock) {
        const range = ref.source_range || [1024, 1024 + String(ref.chunk_content || '').length];
        const sourceBlock = {
            chunk_id: ref.chunk_id || `chunk-${blocks.length + 1}`,
            chunk_content: ref.chunk_content || `Source content for ${doc.name || doc.id}`,
            source_range: range
        };
        const intro = blocks.length ? blocks[0] : null;
        const tail = blocks.length > 1 ? blocks.slice(1, 3) : [];
        doc.sourceBlocks = [intro, sourceBlock].concat(tail).filter(Boolean);
    }

    ensureSourceDocTreeNode(doc);
    return doc;
}

function renderDocPreviewContent(contentEl, doc) {
    const utils = getSourceRefUtils();
    const blocks = normalizeDocPreviewBlocks(doc);

    contentEl.innerHTML = `
        <div class="prose max-w-none">
            <h3 class="text-xl font-bold mb-4">${utils.escapeHtml(doc.name)}</h3>
            <div class="p-4 bg-gray-50 rounded-lg border border-gray-100 mb-6">
                <p class="text-sm text-gray-500">Document ID: ${utils.escapeHtml(doc.id)}</p>
                <p class="text-sm text-gray-500">Type: ${utils.escapeHtml(doc.type)}</p>
                <p class="text-sm text-gray-500">Status: ${utils.escapeHtml(doc.status)}</p>
            </div>
            <div class="text-gray-700 leading-relaxed space-y-4">
                ${blocks.map((block, index) => `
                    <section
                        id="doc-preview-block-${index}"
                        data-doc-preview-block="true"
                        data-chunk-id="${utils.escapeHtml(block.chunk_id)}"
                        data-source-start="${block.source_range ? block.source_range[0] : ''}"
                        data-source-end="${block.source_range ? block.source_range[1] : ''}"
                        tabindex="-1"
                        class="rounded-lg border border-transparent px-3 py-2 -mx-3 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <div class="mb-1 flex items-center gap-2 text-[11px] text-gray-400">
                            <span class="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5">
                                <i class="fa-solid fa-layer-group"></i>
                                ${utils.escapeHtml(block.chunk_id)}
                            </span>
                            ${block.source_range ? `<span>[${block.source_range[0]}, ${block.source_range[1]}]</span>` : ''}
                        </div>
                        <p>${utils.escapeHtml(block.chunk_content)}</p>
                    </section>
                `).join('')}
            </div>
        </div>
    `;
}

function findDocPreviewTarget(contentEl, source) {
    const utils = getSourceRefUtils();
    const ref = normalizeKnowledgeSource(source);
    const blocks = Array.from(contentEl.querySelectorAll('[data-doc-preview-block="true"]'));

    if (ref.chunk_id) {
        const byChunk = blocks.find(block => block.dataset.chunkId === ref.chunk_id);
        if (byChunk) return byChunk;
    }

    if (ref.source_range) {
        const byRange = blocks.find(block => {
            const start = Number(block.dataset.sourceStart);
            const end = Number(block.dataset.sourceEnd);
            return utils.sourceRangeOverlaps([start, end], ref.source_range);
        });
        if (byRange) return byRange;
    }

    return null;
}

function applyDocPreviewSourceLocation(source) {
    const contentEl = document.getElementById('doc-preview-content');
    if (!contentEl || !source) return;

    contentEl.querySelectorAll('[data-doc-preview-block="true"]').forEach(block => {
        block.classList.remove('bg-yellow-50', 'border-yellow-300', 'ring-2', 'ring-yellow-200', 'shadow-sm');
        block.style.background = '';
        block.style.borderColor = '';
        block.style.boxShadow = '';
        block.style.borderLeft = '';
        block.style.scrollMarginTop = '';
        block.removeAttribute('data-active-source');
    });

    const target = findDocPreviewTarget(contentEl, source);
    if (!target) return;

    target.dataset.activeSource = 'true';
    target.classList.add('bg-yellow-50', 'border-yellow-300', 'ring-2', 'ring-yellow-200', 'shadow-sm');
    target.style.background = '#fff7cc';
    target.style.borderColor = '#f59e0b';
    target.style.borderLeft = '4px solid #f59e0b';
    target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.18), 0 12px 28px rgba(15, 23, 42, 0.08)';
    target.style.scrollMarginTop = '96px';

    const containerTop = contentEl.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const nextTop = contentEl.scrollTop + (targetTop - containerTop) - Math.max(48, contentEl.clientHeight * 0.28);
    contentEl.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    target.focus({ preventScroll: true });
}
window.applyDocPreviewSourceLocation = applyDocPreviewSourceLocation;

function selectDoc(docId, source) {
    console.log('selectDoc called with:', docId);
    const sourceRef = source ? normalizeKnowledgeSource(source) : null;
    if (sourceRef && sourceRef.document_id) {
        ensureDocForSource(sourceRef);
        docId = sourceRef.document_id;
    }
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
        renderDocPreviewContent(contentEl, doc);
    }

    if (sourceRef) {
        setTimeout(() => applyDocPreviewSourceLocation(sourceRef), 80);
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
    syncKnowledgeDataToSharedStore({ persist: true });
    renderKnowledgeList();
    
    closeDeleteKbModal();
    if (window.showToast) {
        window.showToast('知识库已删除', 'success');
    } else {
        alert('知识库已删除');
    }
}

window.submitParse = function(docId) {
    console.log('submitParse called with:', docId);
    if (window.showToast) {
        window.showToast('已提交索引', 'success');
    } else {
        alert('已提交索引');
    }
    // Update doc status to "indexing" (索引中)
    const doc = mockDocs.find(d => d.id === docId);
    if (doc) {
        doc.status = 'indexing';
        renderDocList();
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

// Define missing highlightOriginalText function
function highlightOriginalText(encodedContent) {
    const content = decodeURIComponent(encodedContent);
    const originalContainer = document.getElementById('parse-original-content');
    if (!originalContainer) return;

    // First remove all existing marks
    clearOriginalHighlights();

    // Get current HTML
    let html = originalContainer.innerHTML;

    // Function to safely extract text and build a flexible regex
    // 1. Remove all tags from content to get pure text we want to match
    const pureText = content.replace(/<[^>]*>?/gm, '').trim();
    if (!pureText) return;

    // 2. Escape special regex characters
    let escapedContent = pureText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 3. Replace whitespaces and newlines with a flexible pattern that ignores HTML tags and spaces
    escapedContent = escapedContent.replace(/\s+/g, '(?:\\s|<[^>]+>)+');

    try {
        const regex = new RegExp(`(${escapedContent})`, 'i');

        if (regex.test(html)) {
            // Replace the matched text with a marked version
            html = html.replace(regex, '<mark class="bg-yellow-200 text-gray-900 rounded px-1 transition-all duration-300" id="current-highlight">$1</mark>');
            originalContainer.innerHTML = html;

            // Scroll to highlighted element
            setTimeout(() => {
                const mark = document.getElementById('current-highlight');
                if (mark) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Optional: add a temporary pulse effect
                    mark.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
                    setTimeout(() => {
                        mark.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2');
                    }, 1500);
                }
            }, 100);
        } else {
            console.warn('Could not find text in original content:', pureText);
        }
    } catch (e) {
        console.error('Error highlighting text:', e);
    }
}
window.highlightOriginalText = highlightOriginalText;

// Helper to remove all highlights
function clearOriginalHighlights() {
    const originalContainer = document.getElementById('parse-original-content');
    if (!originalContainer) return;
    let html = originalContainer.innerHTML;
    // Non-greedy match to replace mark tags, keeping inner content
    html = html.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/g, '$1');
    originalContainer.innerHTML = html;
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
    clearOriginalHighlights();
    
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
        { 
            id: 1, 
            content: "Q: 无法连接到公司VPN怎么办？\nA: 1. 请检查您的网络连接是否正常，确保本地网络畅通。您可以尝试访问外部网站来验证网络状态。如果网络不稳定，请先解决本地网络连接问题。\n2. 确认VPN客户端已更新至最新版本，旧版本可能存在兼容性问题。请访问IT部门内网主页下载最新的客户端安装包，并按照安装指南进行更新。\n3. 尝试重新启动VPN客户端，并检查是否选择了正确的服务器节点。有时客户端进程可能会卡死，重启软件通常能解决此类临时故障。\n4. 如果问题持续，请检查防火墙设置是否拦截了VPN连接。部分安全软件可能会误判VPN流量，建议暂时关闭防火墙进行测试。\n<br><img src='https://picsum.photos/1200/800?random=1' alt='VPN连接错误示例' class='my-2 rounded-lg w-full object-cover shadow-sm' loading='lazy'>\n5. 若以上方法均无效，请联系IT支持部门，电话：8888-8888。", 
            selected: false, 
            editing: false,
            ocrText: "VPN Error 809: The network connection between your computer and the VPN server could not be established because the remote server is not responding. This could be because one of the network devices (e.g., firewalls, NAT, routers, etc.) between your computer and the remote server is not configured to allow VPN connections. Please contact your Administrator or your service provider to determine which device may be causing the problem.",
            imageUnderstanding: "图片展示了一个典型的 Windows VPN 连接错误对话框。错误代码为 809，提示远程服务器未响应，可能原因是网络设备（如防火墙、NAT或路由器）的配置阻止了VPN连接，建议联系管理员排查网络设备设置。"
        },
        { 
            id: 2, 
            content: "Q: 如何申请新设备的软件授权？\nA: 所有软件授权申请需通过OA系统提交，不支持口头或邮件申请。具体操作流程如下：登录OA系统 -> 点击‘资产管理’模块 -> 选择‘软件授权申请’ -> 填写详细申请单 -> 提交至部门经理审批 -> 最终由IT部处理。通常处理时间为1-2个工作日，紧急需求请在备注中说明。\n\n**常用软件授权类型对比：**\n<table class='w-full text-sm text-left border-collapse my-2'><thead><tr class='border-b-2 border-gray-800'><th class='py-2'>软件类型</th><th class='py-2'>适用范围</th><th class='py-2'>审批层级</th></tr></thead><tbody><tr class='border-b border-gray-300'><td class='py-2'>通用办公</td><td class='py-2'>全员</td><td class='py-2'>部门经理</td></tr><tr class='border-b border-gray-300'><td class='py-2'>专业设计</td><td class='py-2'>设计部/市场部</td><td class='py-2'>部门总监</td></tr><tr class='border-b-2 border-gray-800'><td class='py-2'>开发工具</td><td class='py-2'>研发部</td><td class='py-2'>CTO</td></tr></tbody></table>", 
            selected: false, 
            editing: false,
            overlapContext: "重叠：5. 若以上方法均无效，请联系IT支持部门，电话：8888-8888。"
        },
        { 
            id: 3, 
            content: "Q: 打印机显示“缺纸”但纸盒已满？\nA: 这通常是由于传感器故障或纸张放置不当引起的常见问题。请按照以下步骤排查：\n1. 取出纸张，将纸张扇形抖动整理，防止静电吸附，然后重新平整放入纸盒。\n2. 检查纸盒侧面的宽度和长度卡扣是否卡紧纸张，过松或过紧都会导致进纸异常。\n3. 尝试重启打印机，让传感器重新复位检测。\n\n**实际案例：**\n**背景：** 财务部HP打印机频繁报错缺纸。\n**实施：** IT人员检查发现纸张受潮且卡扣未对齐。更换新纸并调整卡扣后恢复正常。\n**效果：** 故障彻底排除，打印效率提升。", 
            selected: false, 
            editing: false,
            overlapContext: "重叠：常用软件授权类型对比表格"
        },
        { 
            id: 4, 
            content: "Q: 邮箱密码忘记了如何找回？\nA: 建议优先使用自助服务找回密码。请访问公司SSO门户页面（sso.company.com），点击登录框下方的“忘记密码”链接。系统将引导您通过预留的手机号码接收验证码进行重置。请注意，新密码必须包含大小写字母和数字，且长度不少于8位。\n<br><img src='https://picsum.photos/1200/800?random=2' alt='密码重置流程' class='my-2 rounded-lg w-full object-cover shadow-sm' loading='lazy'>\n如果您的手机号已更换无法接收验证码，请携带本人工牌到IT服务台（A座1楼）现场办理密码重置业务。", 
            selected: false, 
            editing: false,
            overlapContext: "重叠：故障彻底排除，打印效率提升。",
            imageUnderstanding: "图片展示了 SSO 密码重置的三个步骤：1. 身份验证（输入工号和验证码）；2. 接收手机短信验证码；3. 设置新密码。界面设计简洁，步骤进度条高亮显示当前处于第二步。"
        }
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
        div.className = `bg-white p-4 rounded-lg shadow-sm border border-dashed border-gray-300 hover:border-blue-300 relative group mb-2 ${index < currentParseChunks.length - 1 ? 'border-b-dashed border-b-gray-300' : ''}`;
        
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
            // Check if there is an image in the content
            const hasImage = chunk.content.includes('<img');
            
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex flex-col gap-1.5 w-full">
                        <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <span class="font-mono">#${index + 1}</span>
                            <span>关键字:</span>
                            <div class="flex gap-1 flex-wrap">
                                <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-600">VPN</span>
                                <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-600">网络连接</span>
                                <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-600">客户端</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 ml-4">
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
                ${chunk.overlapContext ? `
                <div class="mb-2 p-2 bg-indigo-50/60 rounded border border-indigo-100 flex items-start gap-2 w-full">
                    <div class="text-xs text-indigo-900/80 leading-relaxed w-full">${chunk.overlapContext}</div>
                </div>
                ` : ''}

                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-blue-50/50 rounded transition-colors chunk-content-container mb-3" onclick="highlightOriginalText(this.getAttribute('data-content'))" data-content="${encodeURIComponent(chunk.content)}">${chunk.content}</div>

                <div class="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
                    <div>${chunk.content.replace(/<[^>]*>?/gm, '').length} 字符</div>
                    <div class="flex items-center gap-3">
                        <span class="flex items-center gap-1" title="引用"><i class="fa-solid fa-quote-right text-gray-300"></i> 12</span>
                        <span class="flex items-center gap-1" title="点赞"><i class="fa-regular fa-thumbs-up text-gray-300"></i> 4</span>
                        <span class="flex items-center gap-1" title="点踩"><i class="fa-regular fa-thumbs-down text-gray-300"></i> 0</span>
                    </div>
                </div>
            `;
            
            // Note: In a real implementation, you would parse the HTML string in chunk.content, 
            // extract the <img> tag, and insert the buttons immediately after it.
            // For this mock demo, we'll manipulate the DOM after rendering.
        }
        
        container.appendChild(div);

        if (!chunk.editing && chunk.content.includes('<img')) {
            const contentContainer = div.querySelector('.chunk-content-container');
            if (contentContainer) {
                const imgElement = contentContainer.querySelector('img');
                if (imgElement) {
                    // Create a wrapper for image and its related buttons/panels
                    const wrapper = document.createElement('div');
                    wrapper.className = 'bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 mt-3 mb-1 flex flex-col gap-2.5';
                    
                    // Replace img with wrapper in the DOM
                    imgElement.parentNode.insertBefore(wrapper, imgElement);
                    
                    // Clean up img classes and move it into the wrapper
                    imgElement.classList.remove('my-2', 'mt-2', 'mb-1');
                    imgElement.classList.add('m-0');
                    wrapper.appendChild(imgElement);
                    
                    let ocrBtn = '';
                    let ocrPanel = '';
                    let undBtn = '';
                    let undPanel = '';
                    
                    const hasBoth = chunk.ocrText && chunk.imageUnderstanding;
                    const ocrActive = !!chunk.ocrText;
                    const undActive = !chunk.ocrText && !!chunk.imageUnderstanding;
                    
                    let defaultModelOptions = '';
                    if (ocrActive) {
                        defaultModelOptions = `
                            <option value="tesseract">Tesseract OCR</option>
                            <option value="paddle">PaddleOCR</option>
                            <option value="easy">EasyOCR</option>
                        `;
                    } else if (undActive) {
                        defaultModelOptions = `
                            <option value="minigpt4">MiniGPT-4</option>
                            <option value="qwen">Qwen-VL</option>
                            <option value="gpt4v">OpenAI GPT-4V</option>
                        `;
                    }
                    
                    if (chunk.ocrText) {
                        const activeClasses = ocrActive ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200';
                        ocrBtn = `<button id="ocr-btn-${index}" type="button" class="text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 shadow-sm ${activeClasses}" onclick="event.stopPropagation(); switchImagePanel(${index}, 'ocr')"><i class="fa-solid fa-file-image"></i>图片OCR</button>`;
                        const hiddenClass = ocrActive ? '' : 'hidden';
                        ocrPanel = `<div id="ocr-panel-${index}" class="w-full p-3 bg-white rounded border border-slate-200 text-xs text-slate-600 italic leading-relaxed shadow-inner ${hiddenClass}" onclick="event.stopPropagation();">${chunk.ocrText}</div>`;
                    }
                    
                    if (chunk.imageUnderstanding) {
                        const activeClasses = undActive ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200';
                        undBtn = `<button id="und-btn-${index}" type="button" class="text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 shadow-sm ${activeClasses}" onclick="event.stopPropagation(); switchImagePanel(${index}, 'und')"><i class="fa-solid fa-lightbulb"></i>图片理解</button>`;
                        const hiddenClass = undActive ? '' : 'hidden';
                        undPanel = `<div id="und-panel-${index}" class="w-full p-3 bg-blue-50/50 rounded border border-blue-100 text-xs text-slate-700 leading-relaxed shadow-inner ${hiddenClass}" onclick="event.stopPropagation();">${chunk.imageUnderstanding}</div>`;
                    }

                    const buttonsHTML = `
                    <div class="flex flex-col gap-2 w-full">
                        <div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-2">
                                ${ocrBtn}
                                ${undBtn}
                            </div>
                            <div class="flex items-center gap-2">
                                <select id="model-select-${index}" class="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-white text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100/50 transition-all shadow-sm cursor-pointer hover:border-slate-300" onclick="event.stopPropagation();">
                                    ${defaultModelOptions}
                                </select>
                                <button type="button" class="group text-xs rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 text-left leading-[1px] pl-2" style="width: 90px; height: 31px;" onclick="event.stopPropagation(); regenerateImagePanel(${index})">
                                    <i class="fa-solid fa-rotate-right group-hover:rotate-180 transition-transform duration-500"></i>重新生成
                                </button>
                            </div>
                        </div>
                        ${ocrPanel}
                        ${undPanel}
                    </div>
                    `;
                    // Append buttons into wrapper
                    wrapper.insertAdjacentHTML('beforeend', buttonsHTML);
                }
            }
        }

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

window.switchImagePanel = function(index, type) {
    const ocrPanel = document.getElementById(`ocr-panel-${index}`);
    const undPanel = document.getElementById(`und-panel-${index}`);
    const ocrBtn = document.getElementById(`ocr-btn-${index}`);
    const undBtn = document.getElementById(`und-btn-${index}`);
    const modelSelect = document.getElementById(`model-select-${index}`);

    if (type === 'ocr') {
        if (ocrPanel) ocrPanel.classList.remove('hidden');
        if (undPanel) undPanel.classList.add('hidden');
        if (ocrBtn) {
            ocrBtn.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-200');
            ocrBtn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
        }
        if (undBtn) {
            undBtn.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
            undBtn.classList.remove('bg-blue-50', 'text-blue-600', 'border-blue-200');
        }
        if (modelSelect) {
            modelSelect.innerHTML = `
                <option value="tesseract">Tesseract OCR</option>
                <option value="paddle">PaddleOCR</option>
                <option value="easy">EasyOCR</option>
            `;
        }
    } else if (type === 'und') {
        if (undPanel) undPanel.classList.remove('hidden');
        if (ocrPanel) ocrPanel.classList.add('hidden');
        if (undBtn) {
            undBtn.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-200');
            undBtn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
        }
        if (ocrBtn) {
            ocrBtn.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
            ocrBtn.classList.remove('bg-blue-50', 'text-blue-600', 'border-blue-200');
        }
        if (modelSelect) {
            modelSelect.innerHTML = `
                <option value="minigpt4">MiniGPT-4</option>
                <option value="qwen">Qwen-VL</option>
                <option value="gpt4v">OpenAI GPT-4V</option>
            `;
        }
    }
};

window.regenerateImagePanel = function(index) {
    const ocrPanel = document.getElementById(`ocr-panel-${index}`);
    const undPanel = document.getElementById(`und-panel-${index}`);
    const modelSelect = document.getElementById(`model-select-${index}`);
    
    // Determine which panel is currently active
    const activeType = (ocrPanel && !ocrPanel.classList.contains('hidden')) ? 'ocr' : 'und';
    const activePanel = activeType === 'ocr' ? ocrPanel : undPanel;
    
    if (!activePanel || !modelSelect) return;
    
    const modelName = modelSelect.options[modelSelect.selectedIndex].text;
    const originalHtml = activePanel.innerHTML;
    
    // Show loading state
    activePanel.innerHTML = `<div class="flex items-center gap-2 text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i> 正在使用 ${modelName} 重新生成...</div>`;
    
    // Mock regeneration process
    setTimeout(() => {
        activePanel.innerHTML = originalHtml;
    }, 1200);
};

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
        if (expandBtn) {
            expandBtn.innerHTML = '<i class="fa-solid fa-compress-alt"></i>';
        }
    } else {
        panel.classList.add('hidden');
        if (expandBtn) {
            expandBtn.innerHTML = '<i class="fa-solid fa-expand-alt"></i>';
        }
    }
}

// 解析结果页：左右栏拖动分割线
const PARSE_SPLIT_LEFT_WIDTH_KEY = 'kb_parse_result_left_width_px';
let __parseSplitBound = false;
let __parseSplitState = null;

// NOTE: 必须在脚本加载后立即存在（因为 HTML 使用了 onpointerdown/onmousedown 直接调用）
window.startParseSplitDrag = function(e) {
    const modal = document.getElementById('parse-result-modal');
    const container = document.getElementById('parse-split-container');
    const left = document.getElementById('parse-original-panel');
    const splitter = document.getElementById('parse-splitter');
    if (!modal || !container || !left || !splitter) return;
    if (modal.classList.contains('hidden')) return;

    // 初始化一次（用于恢复宽度、兼容老入口）
    if (typeof window.initParseResultSplitPane === 'function') {
        window.initParseResultSplitPane();
    }

    e.preventDefault();
    e.stopPropagation();

    splitter.dataset.dragging = '1';
    document.body.classList.add('select-none');
    try { document.body.style.cursor = 'col-resize'; } catch (_) {}

    __parseSplitState = { modal, container, left, splitter };

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const onMove = (ev) => {
        if (!__parseSplitState || !__parseSplitState.splitter?.dataset?.dragging) return;
        const rect = __parseSplitState.container.getBoundingClientRect();
        const minLeft = 280;
        const maxLeft = rect.width - 360;
        const next = clamp(ev.clientX - rect.left, minLeft, maxLeft);
        __parseSplitState.left.style.width = `${Math.round(next)}px`;
        try { localStorage.setItem(PARSE_SPLIT_LEFT_WIDTH_KEY, String(Math.round(next))); } catch (_) {}
    };

    const onUp = () => {
        if (!__parseSplitState) return;
        delete __parseSplitState.splitter.dataset.dragging;
        document.body.classList.remove('select-none');
        try { document.body.style.cursor = ''; } catch (_) {}
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        __parseSplitState = null;
    };

    // pointer capture（如可用）
    if (typeof e.pointerId === 'number' && splitter.setPointerCapture) {
        try { splitter.setPointerCapture(e.pointerId); } catch (_) {}
    }

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
};

window.initParseResultSplitPane = function() {
    if (__parseSplitBound) return;
    const container = document.getElementById('parse-split-container');
    const left = document.getElementById('parse-original-panel');
    const splitter = document.getElementById('parse-splitter');
    const modal = document.getElementById('parse-result-modal');
    if (!container || !left || !splitter || !modal) return;
    __parseSplitBound = true;

    // Restore saved width
    try {
        const saved = Number(localStorage.getItem(PARSE_SPLIT_LEFT_WIDTH_KEY));
        if (!isNaN(saved) && saved > 120) left.style.width = `${saved}px`;
    } catch (_) {}

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const onPointerMove = (e) => {
        if (!splitter.dataset.dragging) return;
        const rect = container.getBoundingClientRect();
        const minLeft = 280;
        const maxLeft = rect.width - 360;
        const next = clamp(e.clientX - rect.left, minLeft, maxLeft);
        left.style.width = `${Math.round(next)}px`;
        try { localStorage.setItem(PARSE_SPLIT_LEFT_WIDTH_KEY, String(Math.round(next))); } catch (_) {}
    };

    const stopDrag = () => {
        if (!splitter.dataset.dragging) return;
        delete splitter.dataset.dragging;
        document.body.classList.remove('select-none');
        try { document.body.style.cursor = ''; } catch (_) {}
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', stopDrag, true);
        window.removeEventListener('mousemove', onPointerMove, true);
        window.removeEventListener('mouseup', stopDrag, true);
    };

    // 兼容：若页面没有 inline handler，也可通过事件绑定触发
    splitter.addEventListener('pointerdown', window.startParseSplitDrag);
    splitter.addEventListener('mousedown', window.startParseSplitDrag);
};

// --- Knowledge View Split Pane + Fullscreen ---
const KB_KNOWLEDGE_LEFT_WIDTH_KEY = 'kb_knowledge_view_left_width_px';
let __kbDocPreviewFullscreen = false;
let __bodyOverflowBeforeFullscreen = '';

window.initKnowledgeViewSplitPane = function() {
    const container = document.getElementById('knowledge-view-tab');
    const left = document.getElementById('kb-knowledge-left-pane');
    const splitter = document.getElementById('kb-knowledge-splitter');
    if (!container || !left || !splitter) return;

    // Restore
    try {
        const saved = Number(localStorage.getItem(KB_KNOWLEDGE_LEFT_WIDTH_KEY));
        if (!isNaN(saved) && saved > 120) left.style.width = `${saved}px`;
    } catch (_) {}

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const onPointerMove = (e) => {
        if (!splitter.dataset.dragging) return;
        const rect = container.getBoundingClientRect();
        const minLeft = 180;
        const maxLeft = rect.width - 320;
        const next = clamp(e.clientX - rect.left, minLeft, maxLeft);
        left.style.width = `${Math.round(next)}px`;
        try { localStorage.setItem(KB_KNOWLEDGE_LEFT_WIDTH_KEY, String(Math.round(next))); } catch (_) {}
    };

    const stopDrag = () => {
        if (!splitter.dataset.dragging) return;
        delete splitter.dataset.dragging;
        document.body.classList.remove('select-none');
        window.removeEventListener('pointermove', onPointerMove, true);
        window.removeEventListener('pointerup', stopDrag, true);
    };

    splitter.addEventListener('pointerdown', (e) => {
        if (__kbDocPreviewFullscreen) return;
        e.preventDefault();
        splitter.dataset.dragging = '1';
        document.body.classList.add('select-none');
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', stopDrag, true);
    });

    splitter.addEventListener('dblclick', () => {
        if (__kbDocPreviewFullscreen) return;
        left.style.width = '18%';
        try { localStorage.removeItem(KB_KNOWLEDGE_LEFT_WIDTH_KEY); } catch (_) {}
    });
};

window.toggleDocPreviewFullscreen = function(force) {
    const right = document.getElementById('kb-knowledge-right-pane');
    const left = document.getElementById('kb-knowledge-left-pane');
    const splitter = document.getElementById('kb-knowledge-splitter');
    const btn = document.getElementById('btn-doc-preview-fullscreen');
    if (!right || !btn) return;

    const next = typeof force === 'boolean' ? force : !__kbDocPreviewFullscreen;
    __kbDocPreviewFullscreen = next;

    if (next) {
        try {
            __bodyOverflowBeforeFullscreen = document.body.style.overflow || '';
            document.body.style.overflow = 'hidden';
        } catch (_) {}

        if (left) left.classList.add('hidden');
        if (splitter) splitter.classList.add('hidden');
        right.classList.add('fixed', 'inset-0', 'z-[90]');
        btn.innerHTML = '<i class="fa-solid fa-compress-alt"></i>';
    } else {
        try { document.body.style.overflow = __bodyOverflowBeforeFullscreen; } catch (_) {}
        if (left) left.classList.remove('hidden');
        if (splitter) splitter.classList.remove('hidden');
        right.classList.remove('fixed', 'inset-0', 'z-[90]');
        btn.innerHTML = '<i class="fa-solid fa-expand-alt"></i>';
    }
};

window.closeDocPreviewFullscreen = function() {
    window.toggleDocPreviewFullscreen(false);
};

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
    if (['md', 'markdown', 'txt'].includes(ext)) return 'Markdown';
    return 'Text';
}

let docUploadStep = 1;
let docUploadSliceMode = 'length';

let docUploadWizardIsOpen = false;
let docUploadWizardSnapshot = null;

function captureDocUploadWizardSnapshot() {
    const snapshot = {
        hash: window.location.hash,
        bodyOverflowHidden: document.body.classList.contains('overflow-hidden'),
        openerId: null,
        scrollTops: {}
    };

    try {
        const active = document.activeElement;
        if (active && active.id) snapshot.openerId = active.id;
    } catch (_) {}

    try {
        const ev = window.event;
        const opener = ev && ev.currentTarget && ev.currentTarget.id ? ev.currentTarget : null;
        if (opener && opener.id) snapshot.openerId = opener.id;
    } catch (_) {}

    const ids = ['main-content-area', 'doc-list-scroll-container', 'create-kb-settings-column'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && typeof el.scrollTop === 'number') snapshot.scrollTops[id] = el.scrollTop;
    });

    return snapshot;
}

function restoreDocUploadWizardSnapshot(snapshot) {
    if (!snapshot) return;

    try {
        if (!snapshot.bodyOverflowHidden) document.body.classList.remove('overflow-hidden');
    } catch (_) {}

    const scrollTops = snapshot.scrollTops || {};
    Object.keys(scrollTops).forEach(id => {
        const el = document.getElementById(id);
        if (el && typeof scrollTops[id] === 'number') {
            el.scrollTop = scrollTops[id];
        }
    });

    if (snapshot.openerId) {
        const opener = document.getElementById(snapshot.openerId);
        if (opener && typeof opener.focus === 'function') {
            setTimeout(() => opener.focus(), 0);
        }
    }
}

function handleDocUploadWizardKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeDocUploadWizard();
    }
}

function ensureDocUploadWizardPopstateListener() {
    if (window.__docUploadWizardPopstateBound) return;
    window.__docUploadWizardPopstateBound = true;
    window.addEventListener('popstate', (e) => {
        if (!docUploadWizardIsOpen) return;
        if (e && e.state && e.state.__modal === 'doc-upload-wizard') return;
        closeDocUploadWizard({ fromPopState: true });
    });
}

function openDocUploadWizard() {
    const modal = document.getElementById('doc-upload-wizard');
    if (!modal) return;

    ensureDocUploadWizardPopstateListener();

    if (!docUploadWizardIsOpen) {
        docUploadWizardSnapshot = captureDocUploadWizardSnapshot();
    }

    docUploadWizardIsOpen = true;
    docUploadStep = 1;
    docUploadSliceMode = 'length';

    modal.classList.remove('hidden');
    
    // Animate In
    const panel = document.getElementById('doc-upload-wizard-panel');
    if (panel) {
        // Reset state
        panel.classList.add('opacity-0', 'scale-95');
        panel.classList.remove('opacity-100', 'scale-100');
        
        // Trigger animation
        requestAnimationFrame(() => {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        });
    }

    document.body.classList.add('overflow-hidden');
    updateDocUploadStep();
    setDocUploadSliceMode(docUploadSliceMode, false);

    document.addEventListener('keydown', handleDocUploadWizardKeydown);

    try {
        const st = history.state || {};
        if (!st.__modal) {
            history.pushState({ ...st, __modal: 'doc-upload-wizard' }, '', window.location.href);
        }
    } catch (_) {}
}

function closeDocUploadWizard(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const fromPopState = !!opts.fromPopState;

    if (docUploadWizardIsOpen && !fromPopState) {
        try {
            const st = history.state;
            if (st && st.__modal === 'doc-upload-wizard') {
                history.back();
                return;
            }
        } catch (_) {}
    }

    const modal = document.getElementById('doc-upload-wizard');
    const panel = document.getElementById('doc-upload-wizard-panel');

    const finishClose = () => {
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        if (document.documentElement) document.documentElement.classList.remove('overflow-hidden');
        document.removeEventListener('keydown', handleDocUploadWizardKeydown);

        docUploadWizardIsOpen = false;
        restoreDocUploadWizardSnapshot(docUploadWizardSnapshot);
        docUploadWizardSnapshot = null;
    };

    if (modal && !modal.classList.contains('hidden') && panel) {
        // Animate Out
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
        setTimeout(finishClose, 200); // Match duration-300 or slightly less
    } else {
        finishClose();
    }
}

function updateDocUploadStep() {
    const step1 = document.getElementById('doc-upload-step-1');
    const step2 = document.getElementById('doc-upload-step-2');
    const nextBtn = document.getElementById('doc-upload-next');
    const saveTplBtn = document.getElementById('btn-save-wizard-template');
    const skipBtn = document.getElementById('doc-upload-skip');
    const step1Indicator = document.getElementById('step-1-indicator');
    const step2Indicator = document.getElementById('step-2-indicator');
    const localPanel = document.getElementById('doc-upload-local-panel');

    if (step1 && step2) {
        if (docUploadStep === 1) {
            // 步骤1：索引设置（对应 step2 面板）
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        } else {
            // 步骤2：选择数据（对应 step1 面板）
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
        }
    }

    if (nextBtn) {
        if (docUploadStep === 1) {
            nextBtn.textContent = '下一步';
            // 索引设置页可保存为模板
            if (saveTplBtn) saveTplBtn.classList.remove('hidden');
        } else {
            nextBtn.textContent = '完成';
            if (saveTplBtn) saveTplBtn.classList.add('hidden');
        }
    }

    // 仅步骤1隐藏“跳过”
    if (skipBtn) {
        skipBtn.classList.toggle('hidden', docUploadStep === 1);
    }

    if (step1Indicator && step2Indicator) {
        const indicator1Circle = step1Indicator.querySelector('div');
        const indicator2Circle = step2Indicator.querySelector('div');
        
        if (docUploadStep === 1) {
            step1Indicator.classList.remove('opacity-40');
            step2Indicator.classList.add('opacity-40');
            
            if (indicator1Circle) {
                indicator1Circle.className = 'flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold shadow-sm ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all';
            }
            if (indicator2Circle) {
                indicator2Circle.className = 'flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-500 text-sm font-bold';
            }
        } else {
            step1Indicator.classList.add('opacity-40');
            step2Indicator.classList.remove('opacity-40');
            
            if (indicator1Circle) {
                indicator1Circle.className = 'flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-500 text-sm font-bold';
            }
            if (indicator2Circle) {
                indicator2Circle.className = 'flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold shadow-sm ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all';
            }
        }
    }

    if (localPanel) {
        localPanel.classList.remove('hidden');
    }
}

function nextDocUploadStep() {
    if (docUploadStep === 1) {
        // Form Validation for Step 1
        const uploadArea = document.getElementById('doc-upload-area');
        // Simple mock validation - check if a file is virtually "uploaded" by checking a class or we just allow it
        // To be safe and interactive, let's just proceed for now as it's mock UI
        
        docUploadStep = 2;
        updateDocUploadStep();
    } else {
        // Handle Step 2 Completion
        closeDocUploadWizard();
        if (window.showToast) {
            window.showToast('文档上传完成', 'success');
        }
        // Optionally refresh knowledge base list
    }
}

function initDocUploadWizard() {
    const nextBtn = document.getElementById('doc-upload-next');
    const modal = document.getElementById('doc-upload-wizard');

    if (nextBtn) nextBtn.onclick = nextDocUploadStep;

    if (modal && !modal.dataset.boundCloseHandlers) {
        modal.dataset.boundCloseHandlers = 'true';
        const overlay = modal.firstElementChild;
        const panel = modal.children && modal.children.length > 1 ? modal.children[1] : null;
        if (overlay) {
            overlay.addEventListener('click', () => closeDocUploadWizard());
        }
        if (panel) {
            panel.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    setDocUploadSliceMode(docUploadSliceMode || 'length', false);
    initDocUploadInteractions();
}

let uploadedFilesList = [];

function initDocUploadInteractions() {
    const dropzone = document.getElementById('doc-upload-dropzone');
    const fileInput = document.getElementById('doc-upload-input');
    
    if (!dropzone || !fileInput) return;
    
    // Prevent duplicate binding
    if (dropzone.dataset.boundUpload === 'true') return;
    dropzone.dataset.boundUpload = 'true';

    // Drag and Drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropzone.classList.add('border-blue-500', 'bg-blue-50/50');
    }

    function unhighlight(e) {
        dropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
    }

    dropzone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
        // Reset value so same file can be selected again if needed
        this.value = '';
    });
}

function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    const validExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.md', '.txt', '.csv'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    let hasInvalid = false;
    
    Array.from(files).forEach(file => {
        // Validate Extension
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            hasInvalid = true;
            if (window.showToast) window.showToast(`文件格式不支持: ${file.name}`, 'error');
            return;
        }
        
        // Validate Size
        if (file.size > maxSize) {
            hasInvalid = true;
            if (window.showToast) window.showToast(`文件大小超过限制(50MB): ${file.name}`, 'error');
            return;
        }
        
        // Add to our list
        const fileObj = {
            id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            status: 'uploading', // waiting, uploading, success, error
            progress: 0,
            file: file
        };
        
        uploadedFilesList.push(fileObj);
        renderUploadList();
        simulateUpload(fileObj.id);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function renderUploadList() {
    const listContainer = document.getElementById('doc-upload-list');
    if (!listContainer) return;
    
    if (uploadedFilesList.length === 0) {
        listContainer.classList.add('hidden');
        listContainer.innerHTML = '';
        return;
    }
    
    listContainer.classList.remove('hidden');
    listContainer.innerHTML = '';
    
    uploadedFilesList.forEach(fileObj => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm';
        item.id = `upload-item-${fileObj.id}`;
        
        let statusIcon = '';
        let actionBtn = '';
        let progressColor = 'bg-blue-500';
        
        if (fileObj.status === 'uploading' || fileObj.status === 'waiting') {
            statusIcon = '<i class="fa-solid fa-spinner fa-spin text-blue-500"></i>';
            actionBtn = `<button onclick="removeUploadFile('${fileObj.id}')" class="text-gray-400 hover:text-red-500 transition-colors"><i class="fa-solid fa-times"></i></button>`;
        } else if (fileObj.status === 'success') {
            statusIcon = '<i class="fa-solid fa-check-circle text-green-500"></i>';
            actionBtn = `
                <div class="flex items-center gap-2">
                    <button onclick="previewUploadFile('${fileObj.id}')" class="text-gray-400 hover:text-blue-500 transition-colors" title="预览"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="removeUploadFile('${fileObj.id}')" class="text-gray-400 hover:text-red-500 transition-colors" title="删除"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            progressColor = 'bg-green-500';
        } else if (fileObj.status === 'error') {
            statusIcon = '<i class="fa-solid fa-circle-exclamation text-red-500"></i>';
            actionBtn = `
                <div class="flex items-center gap-2">
                    <button onclick="retryUploadFile('${fileObj.id}')" class="text-gray-400 hover:text-blue-500 transition-colors" title="重试"><i class="fa-solid fa-rotate-right"></i></button>
                    <button onclick="removeUploadFile('${fileObj.id}')" class="text-gray-400 hover:text-red-500 transition-colors" title="删除"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            progressColor = 'bg-red-500';
        }
        
        item.innerHTML = `
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-8 h-8 shrink-0 bg-white rounded shadow-sm flex items-center justify-center text-gray-500">
                    <i class="fa-regular fa-file-lines text-lg"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between mb-1">
                        <span class="font-medium text-gray-700 truncate pr-4">${fileObj.name}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="text-xs text-gray-500">${formatBytes(fileObj.size)}</span>
                            ${statusIcon}
                        </div>
                    </div>
                    <!-- Progress Bar -->
                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                        <div class="${progressColor} h-1.5 rounded-full transition-all duration-300" style="width: ${fileObj.progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="ml-4 shrink-0 flex items-center">
                ${actionBtn}
            </div>
        `;
        
        listContainer.appendChild(item);
    });
}

function simulateUpload(id) {
    const fileObj = uploadedFilesList.find(f => f.id === id);
    if (!fileObj) return;
    
    fileObj.status = 'uploading';
    fileObj.progress = 0;
    
    const interval = setInterval(() => {
        if (fileObj.status !== 'uploading') {
            clearInterval(interval);
            return;
        }
        
        fileObj.progress += Math.floor(Math.random() * 20) + 5;
        
        if (fileObj.progress >= 100) {
            fileObj.progress = 100;
            // Randomly fail sometimes to show error state, but mostly succeed
            if (Math.random() > 0.9) {
                fileObj.status = 'error';
                if (window.showToast) window.showToast(`${fileObj.name} 上传失败`, 'error');
            } else {
                fileObj.status = 'success';
            }
            clearInterval(interval);
        }
        
        renderUploadList();
    }, 300);
}

window.removeUploadFile = function(id) {
    uploadedFilesList = uploadedFilesList.filter(f => f.id !== id);
    renderUploadList();
};

window.retryUploadFile = function(id) {
    simulateUpload(id);
};

window.previewUploadFile = function(id) {
    const fileObj = uploadedFilesList.find(f => f.id === id);
    if (fileObj && window.showToast) {
        window.showToast(`预览文件: ${fileObj.name}`, 'info');
    }
};

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
    // Legacy support, replaced by unified logic in handleSliceStrategyKey/selectSliceStrategy if needed
    // But keeping it to avoid breaking other dependencies if any.
    docUploadSliceMode = mode;
}

window.selectSliceStrategy = function(strategy) {
    // Only 'general' is supported in the UI currently, but we keep it extensible
    const radioIcon = document.getElementById('doc-upload-radio-general');
    if (radioIcon) {
        if (strategy === 'general') {
            radioIcon.className = 'fa-solid fa-circle-check text-blue-600 transition-colors';
        }
    }
};

window.handleSliceStrategyKey = function(event, strategy) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.selectSliceStrategy(strategy);
    }
};

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
        initKnowledgePage(e.detail.params);
        initDocUploadWizard();
        initCreateKbForm();
    }
});

// Parser UI Logic
function setupParserInteractions() {
    const fastOpt = document.getElementById('parser-option-fast');
    const deepOpt = document.getElementById('parser-option-deep');
    const deepSub = document.getElementById('deep-parse-sub-options');

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

function handleViewOriginal() {
    toggleOriginalView();
}

function toggleOriginalView(forceState) {
    let configPanel, originalPanel, btnText, btnIcon, parserSelect;

    if (createKbStep === 3) {
        configPanel = document.getElementById('create-kb-settings-column');
        originalPanel = document.getElementById('create-kb-original-panel-step3');
        btnText = document.getElementById('view-source-preview-text');
        btnIcon = document.querySelector('#btn-view-source-preview i');
        parserSelect = document.getElementById('create-kb-preview-file');
    } else {
        // Step 2 no longer has Original View side-by-side
        return;
    }
    
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
}

function zoomOriginalView(direction) {
    let content, zoomText;
    if (createKbStep === 3) {
        content = document.getElementById('original-view-content-step3');
        zoomText = document.getElementById('original-view-zoom-level-step3');
    } else {
        return;
    }
    
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
    let content, zoomText;
    if (createKbStep === 3) {
        content = document.getElementById('original-view-content-step3');
        zoomText = document.getElementById('original-view-zoom-level-step3');
    } else {
        return;
    }
    
    if (content) content.style.transform = 'scale(1)';
    if (zoomText) zoomText.textContent = '100%';
}

// Update setupParserInteractions to handle file change in original view
const originalSetupParserInteractions = setupParserInteractions;
setupParserInteractions = function() {
    originalSetupParserInteractions();
    initOriginalViewState();
};

// Removed handleInnovativeParse, renderParserPreview, highlightOriginal, highlightParser, toggleCorrection, saveCorrection, cancelCorrection functions as they are no longer needed.

// Dynamic Height Sync for Knowledge Base Creation Step 3
let kbHeightObserver = null;

function initCreateKbHeightSync() {
    const settingsCol = document.getElementById('create-kb-settings-column');
    const previewEl = document.getElementById('create-kb-slice-preview');
    
    if (!settingsCol || !previewEl) {
        if (kbHeightObserver) {
            kbHeightObserver.disconnect();
            kbHeightObserver = null;
        }
        return;
    }
    
    // Add transition for smooth effect
    previewEl.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    const updateHeight = () => {
        if (settingsCol.offsetParent === null) return; // Hidden
        
        const settingsRect = settingsCol.getBoundingClientRect();
        const previewRect = previewEl.getBoundingClientRect();
        
        // Calculate target height based on visual alignment
        // We want the bottom of previewEl to match the bottom of settingsCol
        let targetHeight = settingsRect.bottom - previewRect.top;
        
        // Ensure minimum height (h-64 = 256px)
        const minHeight = 256; 
        targetHeight = Math.max(minHeight, targetHeight);
        
        previewEl.style.height = targetHeight + 'px';
    };

    // Clean up existing observer
    if (kbHeightObserver) {
        kbHeightObserver.disconnect();
    }
    
    // Create new observer
    kbHeightObserver = new ResizeObserver((entries) => {
        window.requestAnimationFrame(() => {
            updateHeight();
        });
    });
    
    kbHeightObserver.observe(settingsCol);
    
    // Initial call
    updateHeight();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initCreateKbHeightSync);

// Export for unit testing
window.initCreateKbHeightSync = initCreateKbHeightSync;

// Unit Test Verification Function
window.testKbHeightSync = function() {
    console.group('Height Sync Test');
    const settingsCol = document.getElementById('create-kb-settings-column');
    const previewEl = document.getElementById('create-kb-slice-preview');
    
    if (!settingsCol || !previewEl) {
        console.error('Elements not found');
        console.groupEnd();
        return false;
    }
    
    // Test 1: Initial Sync
    initCreateKbHeightSync();
    console.log('Initial Sync triggered');
    
    // Wait for transition/update
    setTimeout(() => {
        const h1 = previewEl.offsetHeight;
        console.log('Height after sync:', h1);
        
        // Test 2: Modify content height
        const testDiv = document.createElement('div');
        testDiv.style.height = '100px';
        testDiv.textContent = 'Test Height Expansion';
        settingsCol.appendChild(testDiv);
        console.log('Added 100px content to settings');
        
        setTimeout(() => {
            const h2 = previewEl.offsetHeight;
            console.log('Height after expansion:', h2);
            
            const diff = h2 - h1;
            const success = Math.abs(diff - 100) < 20; // Allow some margin for padding/layout
            console.log('Test Result:', success ? 'PASS' : 'FAIL', 'Diff:', diff);
            
            // Cleanup
            settingsCol.removeChild(testDiv);
            console.groupEnd();
        }, 500); // Wait for transition
    }, 100);
};

// Slice Strategy Selection Logic
let currentSliceStrategy = 'general';

function saveBatchSliceSettings() {
    if (typeof handleReSlice === 'function') {
        handleReSlice();
    }

    // Double check parser configuration
    if (!validateParserConfigured()) {
        return;
    }

    const btn = document.getElementById('btn-save-batch-slice');
    const iconSuccess = document.getElementById('icon-save-success');
    const iconLoading = document.getElementById('icon-save-loading');
    const textSpan = document.getElementById('text-save-batch-slice');
    
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        if (iconLoading) iconLoading.classList.remove('hidden');
        if (textSpan) textSpan.textContent = '保存中...';
    }

    const targetIds = (function () {
        if (Array.isArray(window.batchSliceTargetDocIds) && window.batchSliceTargetDocIds.length > 0) {
            return window.batchSliceTargetDocIds;
        }
        if (typeof selectedDocIds !== 'undefined' && selectedDocIds && selectedDocIds.size > 0) {
            return Array.from(selectedDocIds);
        }
        return [];
    })();

    setTimeout(() => {
        if (Array.isArray(mockDocs) && targetIds.length > 0) {
            renderDocList();
        }

        if (btn) {
            if (iconLoading) iconLoading.classList.add('hidden');
            if (iconSuccess) iconSuccess.classList.remove('hidden');
            if (textSpan) textSpan.textContent = '保存成功';
            
            setTimeout(() => {
                closeBatchSliceSettingsPage();
                // Reset button state
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
                if (iconSuccess) iconSuccess.classList.add('hidden');
                if (textSpan) textSpan.textContent = '保存并返回列表';
            }, 500);
        } else {
             closeBatchSliceSettingsPage();
        }
    }, 600);
}
window.saveBatchSliceSettings = saveBatchSliceSettings;

function validateBatchAction() {
    if (typeof selectedDocIds === 'undefined' || !selectedDocIds || selectedDocIds.size === 0) {
        // Show toast or alert
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fade-in-down';
        toast.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i><span>请先选择文件</span>';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 2000);
        return false;
    }
    return true;
}
window.validateBatchAction = validateBatchAction;

function validateParserConfigured() {
    const targetIds = (function () {
        if (typeof selectedDocIds !== 'undefined' && selectedDocIds && selectedDocIds.size > 0) {
            return Array.from(selectedDocIds);
        }
        return [];
    })();

    if (targetIds.length === 0) return true; // Handled by validateBatchAction

    let allConfigured = true;
    if (Array.isArray(mockDocs)) {
        const idSet = new Set(targetIds);
        for (const doc of mockDocs) {
            if (idSet.has(doc.id)) {
                // Check if parser is configured. Assuming 'parserName' or similar field.
                // In mock data, let's assume if it's "未配置" or null/undefined, it's invalid.
                // Looking at renderDocList, parser column usually shows doc.parserName or "通用解析器".
                // If it is strictly required, let's check if we have a valid parser.
                // For now, let's assume we need to check if parser is set.
                // In previous turns, we didn't see explicit parser field in mockDocs structure, but we can infer.
                // Let's assume valid parser is needed.
                if (!doc.parserName || doc.parserName === '未设置' || doc.parserName === '待配置') {
                     allConfigured = false;
                     break;
                }
            }
        }
    }

    if (!allConfigured) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fade-in-down';
        toast.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>请先选择解析器</span>';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 2000);
        
        // Removed auto-open modal behavior as per latest user request
        return false;
    }
    return true;
}
window.validateParserConfigured = validateParserConfigured;

function selectSliceStrategy(strategy) {
    if (currentSliceStrategy === strategy) return;
    
    currentSliceStrategy = strategy;
    updateSliceStrategyUI();

    // Restore general config visibility if switching to general
    if (strategy === 'general') {
        currentSpecialType = null;
        updateCreateKbSpecialPreview(null);
        const generalConfigEl = document.getElementById('create-kb-slice-config-container');
        const excelHintEl = document.getElementById('create-kb-excel-hint-container');
        if (generalConfigEl) generalConfigEl.classList.remove('hidden');
        if (excelHintEl) excelHintEl.classList.add('hidden');
        
        // Reset special types styles
        const specialTypes = ['pdf', 'excel', 'ppt', 'image', 'text', 'invoice'];
        specialTypes.forEach(function(type) {
            const el = document.getElementById('create-kb-special-type-' + type);
            if (el) {
                el.classList.remove('border-blue-500', 'bg-blue-50');
            }
        });

        // Hide special options
        const specialOptionsEl = document.getElementById('create-kb-special-options');
        if (specialOptionsEl) {
            specialOptionsEl.classList.add('opacity-0', 'max-h-0');
            specialOptionsEl.classList.remove('opacity-100', 'max-h-[100px]');
        }

        // Clear visualization
        const root = document.getElementById('slice-viz-root');
        if (root) root.innerHTML = '';
    }
}

function selectCreateKbSpecialType(type) {
    currentSpecialType = type;
    // Check if Special Strategy is active, if not, do nothing or prompt
    // According to user requirement: "Only selected div (Special Slice)... buttons can be selected"
    // But usually clicking a button should auto-select the parent radio.
    // However, user said: "When closing div... selected are cancelled".
    // Let's assume if I click the button, I WANT special strategy. 
    // BUT user says "Only selected div... can be selected". 
    // This implies disabled state.
    
    // If we are in general mode, we should switch to special mode first?
    // "1: Only selected div... can be selected" -> implies buttons are disabled if div not selected.
    
    if (currentSliceStrategy !== 'special') {
        selectSliceStrategy('special');
    }
    
    // 2. Update UI for specific type
    const generalConfigEl = document.getElementById('create-kb-slice-config-container');
    const excelHintEl = document.getElementById('create-kb-excel-hint-container');
    
    if (generalConfigEl) generalConfigEl.classList.remove('hidden');
    if (excelHintEl) excelHintEl.classList.add('hidden');
    
    // 3. Persist the selection (update styles)
    setCreateKbSpecialType(type);

    // Show special options with animation
    const specialOptionsEl = document.getElementById('create-kb-special-options');
    if (specialOptionsEl) {
        // Use requestAnimationFrame to ensure transition works if it was just inserted or unhidden
        requestAnimationFrame(() => {
            specialOptionsEl.classList.remove('opacity-0', 'max-h-0');
            specialOptionsEl.classList.add('opacity-100', 'max-h-[100px]');
        });
    }

    // 4. Render interactive visualization
    renderSliceVisualization(type);
}
window.selectCreateKbSpecialType = selectCreateKbSpecialType;

/**
 * Interactive Document Slicing Visualization
 * @param {string} type - File type (word, pdf, etc.)
 * @param {string} subType - Optional sub-type for specific variations (e.g. image 'ocr' vs 'vision')
 */
function renderSliceVisualization(type, subType) {
    const root = document.getElementById('slice-viz-root');
    if (!root) return;

    // Inject custom animations if not present
    if (!document.getElementById('viz-animations')) {
        const style = document.createElement('style');
        style.id = 'viz-animations';
        style.textContent = `
            @keyframes scan-y {
                0% { top: 0; opacity: 0.5; }
                50% { top: 95%; opacity: 0.8; }
                100% { top: 0; opacity: 0.5; }
            }
            .animate-scan-y {
                animation: scan-y 3s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    const startTime = performance.now();

    const getTemplates = (type) => {
        const templates = {
            'chapter': {
                left: `
                    <div class="paper-doc">
                        <div class="paper-module border-2 border-blue-100 p-4 mb-4 text-center">
                            <div class="font-bold text-lg mb-2">2026 年度技术趋势报告</div>
                            <div class="text-xs text-gray-400">PDF COVER PAGE</div>
                        </div>
                        <div class="paper-module border-b border-gray-200 pb-2">
                            <div class="font-semibold text-sm">目录 (Contents)</div>
                            <div class="flex justify-between text-xs mt-1"><span>1. 行业概览</span><span>P1</span></div>
                            <div class="flex justify-between text-xs mt-1"><span>2. 核心技术解析</span><span>P5</span></div>
                        </div>
                        <div class="paper-module mt-4">
                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <div class="paper-content-line"></div>
                                    <div class="paper-content-line"></div>
                                </div>
                                <div class="w-16 h-12 bg-blue-50 border border-blue-100 flex items-center justify-center text-[8px] text-blue-400">图表 1.1</div>
                            </div>
                        </div>
                    </div>
                `,
                right: [
                    { title: '切片 1', content: '【封面+标题】2026 年度技术趋势报告。本报告深入分析了未来五年的关键技术演进路径，涵盖了从量子计算到生物感知的多维领域...' },
                    { title: '切片 2', content: '【目录】1. 行业概览 (P1)；2. 核心技术解析 (P5)。目录结构清晰展示了报告的逻辑框架，为后续的深度检索提供了层级索引...' },
                    { title: '切片 3', content: '【正文+图表】核心技术解析部分详细阐述了分布式计算的新架构。如图表 1.1 所示，吞吐量提升了 40%，同时延迟降低了 25%...' }
                ]
            },
            'excel': {
                left: `
                    <div class="paper-doc overflow-x-auto">
                        <table class="viz-table">
                            <thead>
                                <tr><th>姓名</th><th>部门</th><th>入职日期</th><th>岗位</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>张三</td><td>技术部</td><td>2024-01-15</td><td>高级架构师</td></tr>
                                <tr><td>李四</td><td>产品部</td><td>2024-03-20</td><td>产品经理</td></tr>
                                <tr><td>王五</td><td>市场部</td><td>2024-05-10</td><td>运营总监</td></tr>
                            </tbody>
                        </table>
                    </div>
                `,
                right: [
                    { title: '切片 1', content: '【表头+第1行】\n姓名：张三\n部门：技术部\n入职日期：2024-01-05\n岗位：高级架构师' },
                    { title: '切片 2', content: '【表头+第2行】\n姓名：李四\n部门：产品部\n入职日期：2024-03-20\n岗位：产品经理' }
                ]
            },
            'ppt': {
                left: `
                    <div class="paper-doc">
                        <div class="ppt-grid">
                            <div class="ppt-slide border-blue-400 shadow-sm"><div class="ppt-slide-title"></div><div class="ppt-slide-content"><div class="ppt-slide-line"></div></div><div class="text-[8px] text-center mt-auto">P1: 封面</div></div>
                            <div class="ppt-slide"><div class="ppt-slide-title" style="width:30%"></div><div class="ppt-slide-content"><div class="ppt-slide-line" style="width:50%"></div><div class="ppt-slide-line" style="width:50%"></div></div><div class="text-[8px] text-center mt-auto">P2: 目录</div></div>
                            <div class="ppt-slide"><div class="ppt-slide-title"></div><div class="ppt-slide-content"><div class="ppt-slide-line"></div><div class="ppt-slide-line"></div><div class="ppt-slide-line"></div></div><div class="text-[8px] text-center mt-auto">P3: 内容</div></div>
                            <div class="ppt-slide"><div class="ppt-slide-title" style="width:40%; background:#7f8c8d"></div><div class="ppt-slide-content"><div class="ppt-slide-line" style="width:60%"></div></div><div class="text-[8px] text-center mt-auto">P4: 结论</div></div>
                        </div>
                    </div>
                `,
                right: [
                    { title: '切片 1', content: '【封面页】演示文稿标题：2026 企业数字化转型战略。演讲人：首席技术官。该切片捕获了演示文稿的核心主题与演讲背景...' },
                    { title: '切片 2', content: '【目录页】1. 现状分析；2. 目标愿景；3. 执行方案；4. 预期收益。该切片提供了演示文稿的全局逻辑路线图...' },
                    { title: '切片 3', content: '【内容页】现状分析部分指出，目前 70% 的业务流程已实现自动化，但数据孤岛问题依然显著。下一步重点在于构建统一数据湖...' }
                ]
            },
            'image': {
                left: subType === 'vision' ? `
                    <div class="paper-doc h-full flex flex-col">
                        <!-- 图片预览区 -->
                        <div class="relative flex-1 bg-gray-900 rounded-lg overflow-hidden mb-3 group shadow-inner">
                            <!-- 模拟图片背景 -->
                            <div class="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-gray-600">
                                <img src="https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=A%20close-up%20photo%20of%20a%20modern%20office%20desk%2C%20featuring%20an%20open%20silver%20laptop%20and%20a%20steaming%20cup%20of%20coffee%2C%20with%20a%20soft%20blurred%20background%2C%20warm%20and%20gentle%20lighting%2C%20creating%20a%20focused%20and%20comfortable%20working%20atmosphere&image_size=landscape_16_9" 
                                     alt="现代办公桌特写，银色笔记本电脑和冒着热气的咖啡，背景虚化，光线柔和" 
                                     class="w-full h-full object-cover opacity-80" 
                                     loading="lazy">
                            </div>
                            
                            <!-- 模拟物体检测框 1 -->
                            <div class="absolute top-1/4 left-1/4 w-1/3 h-1/2 border-2 border-green-400 bg-green-400/10 hover:bg-green-400/20 transition-colors cursor-help group/box1">
                                <span class="absolute -top-6 left-0 bg-green-400 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/box1:opacity-100 transition-opacity whitespace-nowrap">Laptop (99%)</span>
                            </div>
                            <!-- 模拟物体检测框 2 -->
                            <div class="absolute bottom-1/4 right-1/4 w-1/4 h-1/4 border-2 border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 transition-colors cursor-help group/box2">
                                <span class="absolute -top-6 left-0 bg-yellow-400 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/box2:opacity-100 transition-opacity whitespace-nowrap">Coffee (92%)</span>
                            </div>

                            <!-- 底部工具栏 -->
                            <div class="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span class="text-[10px] text-white/80 font-mono">office_scene.jpg</span>
                                <div class="flex gap-2">
                                    <button class="text-white hover:text-blue-400 transition-colors"><i class="fa-solid fa-crop-simple"></i></button>
                                    <button class="text-white hover:text-blue-400 transition-colors"><i class="fa-solid fa-share-nodes"></i></button>
                                </div>
                            </div>
                        </div>

                        <!-- 分析结果区 -->
                        <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                                <div class="text-xs font-bold text-gray-800"><i class="fa-solid fa-wand-magic-sparkles text-purple-500 mr-1"></i>场景描述</div>
                                <span class="text-[10px] text-green-600 bg-green-50 px-1.5 rounded border border-green-100">置信度: 0.98</span>
                            </div>
                            <p class="text-[11px] text-gray-600 leading-relaxed overflow-y-auto">
                                一张现代办公桌的特写照片，桌上放着一台打开的银色笔记本电脑和一杯冒着热气的咖啡，背景模糊，光线柔和，营造出专注工作的氛围。
                            </p>
                        </div>
                    </div>
                ` : `
                    <div class="paper-doc h-full flex flex-col" style="min-height: 220px;">
                        <div class="flex-1 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-colors cursor-pointer mb-3">
                            <!-- 模拟已上传图片 (合同扫描件) -->
                            <div class="absolute inset-2 bg-white shadow-sm flex flex-col pointer-events-none overflow-hidden">
                                <!-- 纸张纹理/背景 -->
                                <div class="flex-1 p-4 relative bg-[#fdfdfd] flex flex-col justify-center items-center" style="font-family: 'Times New Roman', serif;">
                                    <div class="text-[12px] leading-relaxed text-gray-900 font-mono font-bold whitespace-pre-wrap text-left">合同编号: HT-20240209-001
甲方: 未来科技有限公司
乙方: 创新数字服务中心
签署日期: 2024-02-09</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                right: subType === 'vision' ? [
                    { title: '智能分析结果', content: '【场景描述】一张现代办公桌的特写照片，桌上放着一台打开的银色笔记本电脑和一杯冒着热气的咖啡，背景模糊，光线柔和，营造出专注工作的氛围。' }
                ] : [
                    { title: '提取内容', content: '【关键字段】<br>合同编号: HT-20240209-001<br>甲方: 未来科技有限公司<br>乙方: 创新数字服务中心<br>签署日期: 2024-02-09<br><br>【正文内容】<br>根据《中华人民共和国民法典》及相关法律法规规定，甲乙双方本着平等自愿、互惠互利的原则，就数字化转型项目达成如下协议...' }
                ]
            },
            'text': {
                left: `
                    <div class="paper-doc">
                        <div class="text-xs text-gray-700 font-mono">
                            <p class="mb-4">这是纯文本的第一段内容。通常用于记录日志或者简单的笔记信息。段落之间通过两个换行符进行分隔，这是最基础的切分规则。</p>
                            <p>这是纯文本的第二段内容。解析器会识别出段落边界，并将其转换为独立的语义切片，以便于后续的高效检索和分析。</p>
                        </div>
                    </div>
                `,
                right: [
                    { title: '切片 1', content: '【第一段】这是纯文本的第一段内容。通常用于记录日志或者简单的笔记信息。段落之间通过两个换行符进行分隔，这是最基础的切分规则...' },
                    { title: '切片 2', content: '【第二段】这是纯文本的第二段内容。解析器会识别出段落边界，并将其转换为独立的语义切片，以便于后续的高效检索和分析...' }
                ]
            },
            'invoice': {
                left: `
                    <div class="paper-doc">
                        <div class="viz-image-mock" style="padding: 10px; border: 1px solid #ccc;">
                            <div class="text-center font-bold text-sm border-b pb-1 mb-2">电子增值税普通发票</div>
                            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div class="viz-image-block"><div class="viz-image-label">OCR: HEADER</div><div class="text-[8px]">抬头: 北京某科技有限公司</div></div>
                                <div class="viz-image-block"><div class="viz-image-label">OCR: DATE</div><div class="text-[8px]">日期: 2026-01-30</div></div>
                                <div class="viz-image-block col-span-2"><div class="viz-image-label">OCR: ITEMS</div><div class="text-[8px]">云服务器租赁费 - 1200.00元</div></div>
                                <div class="viz-image-block"><div class="viz-image-label">OCR: AMOUNT</div><div class="text-[8px]">合计: 1200.00</div></div>
                                <div class="viz-image-block"><div class="viz-image-label">OCR: VENDOR</div><div class="text-[8px]">销售方: 某云计算公司</div></div>
                            </div>
                        </div>
                    </div>
                `,
                right: [
                    { title: '切片 1', content: '【发票抬头+日期】发票名称：电子增值税普通发票；抬头：北京某科技有限公司；开票日期：2026-01-30。提取了票据的核心主体信息...' },
                    { title: '切片 2', content: '【商品明细】项目名称：云服务器租赁费；金额：1200.00 元。该切片捕获了具体的消费明细和单项金额，支持精准的费用审计检索...' },
                    { title: '切片 3', content: '【金额+开票方】合计金额：1200.00；销售方：某云计算公司。整合了最终支付数据与责任方信息，完成了票据的结构化解析...' }
                ]
            }
        };
        return templates[type] || templates['chapter'];
    };

    const renderContent = () => {
        const config = getTemplates(type);
        
        // Add Excel toggle buttons if type is excel
        let extraHtml = '';
        if (type === 'excel') {
            extraHtml = `
                <div class="absolute top-3 right-3 flex gap-1 bg-white p-0.5 rounded-lg border border-gray-100 shadow-sm z-10">
                    <button onclick="switchExcelViz(1)" class="px-2 py-1 text-[10px] rounded-md text-blue-600 bg-blue-50 font-medium transition-colors" id="excel-viz-btn-1">示例1</button>
                    <button onclick="switchExcelViz(2)" class="px-2 py-1 text-[10px] rounded-md text-gray-500 hover:bg-gray-50 transition-colors" id="excel-viz-btn-2">示例2</button>
                </div>
            `;
        }

        const rightHtml = config.right.map(card => `
            <div class="slice-card">
                <div class="slice-card-header">${card.title}</div>
                <div class="slice-card-body">${card.content}</div>
            </div>
        `).join('');

        root.innerHTML = `
            <div class="slice-viz-container relative">
                ${extraHtml}
                ${config.left}
                
                <svg class="slice-viz-arrow" width="100" height="40" viewBox="0 0 100 40">
                    <defs>
                        <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#3498db;stop-opacity:0.2" />
                            <stop offset="100%" style="stop-color:#3498db;stop-opacity:0.8" />
                        </linearGradient>
                    </defs>
                    <path d="M0 20 L80 20 M70 10 L85 20 L70 30" fill="none" stroke="url(#arrowGrad)" stroke-width="3" stroke-linecap="round" />
                </svg>

                <div class="slice-cards">
                    ${rightHtml}
                </div>
            </div>
        `;

        requestAnimationFrame(() => {
            const container = root.querySelector('.slice-viz-container');
            if (container) {
                container.classList.add('animate-viz-in');
            }
            const endTime = performance.now();
            console.log(`Visualization [${type}] rendered in ${(endTime - startTime).toFixed(2)}ms`);
        });
    };

    renderContent();
}
window.renderSliceVisualization = renderSliceVisualization;

window.switchExcelViz = function(id) {
    const root = document.getElementById('slice-viz-root');
    const tableContainer = root.querySelector('.paper-doc');
    const sliceCardsContainer = root.querySelector('.slice-cards');
    const btn1 = document.getElementById('excel-viz-btn-1');
    const btn2 = document.getElementById('excel-viz-btn-2');

    if (!btn1 || !btn2 || !tableContainer || !sliceCardsContainer) return;

    if (id === 1) {
        // Update buttons
        btn1.className = 'px-2 py-1 text-[10px] rounded-md text-blue-600 bg-blue-50 font-medium transition-colors';
        btn2.className = 'px-2 py-1 text-[10px] rounded-md text-gray-500 hover:bg-gray-50 transition-colors';
        // Update content
        tableContainer.innerHTML = `
            <table class="viz-table">
                <thead>
                    <tr><th>姓名</th><th>部门</th><th>入职日期</th><th>岗位</th></tr>
                </thead>
                <tbody>
                    <tr><td>张三</td><td>技术部</td><td>2024-01-15</td><td>高级架构师</td></tr>
                    <tr><td>李四</td><td>产品部</td><td>2024-03-20</td><td>产品经理</td></tr>
                    <tr><td>王五</td><td>市场部</td><td>2024-05-10</td><td>运营总监</td></tr>
                </tbody>
            </table>
        `;
        // Update slice cards
        sliceCardsContainer.innerHTML = `
            <div class="slice-card">
                <div class="slice-card-header">切片 1</div>
                <div class="slice-card-body">【表头+第1行】
姓名：张三
部门：技术部
入职日期：2024-01-05
岗位：高级架构师</div>
            </div>
            <div class="slice-card">
                <div class="slice-card-header">切片 2</div>
                <div class="slice-card-body">【表头+第2行】
姓名：李四
部门：产品部
入职日期：2024-03-20
岗位：产品经理</div>
            </div>
        `;
    } else {
        // Update buttons
        btn1.className = 'px-2 py-1 text-[10px] rounded-md text-gray-500 hover:bg-gray-50 transition-colors';
        btn2.className = 'px-2 py-1 text-[10px] rounded-md text-blue-600 bg-blue-50 font-medium transition-colors';
        // Update content
        tableContainer.innerHTML = `
             <table class="viz-table">
                <thead>
                    <tr><th>部门</th><th>姓名</th><th>入职日期</th><th>岗位</th></tr>
                </thead>
                <tbody>
                    <tr><td rowspan="2" class="align-middle bg-blue-50/50 font-medium text-blue-600">技术部</td><td>张三</td><td>2024-01-15</td><td>高级架构师</td></tr>
                    <tr><td>李四</td><td>2024-03-20</td><td>产品经理</td></tr>
                    <tr><td>市场部</td><td>王五</td><td>2024-05-10</td><td>运营总监</td></tr>
                </tbody>
            </table>
        `;
        // Update slice cards
        sliceCardsContainer.innerHTML = `
            <div class="slice-card">
                <div class="slice-card-header">切片 1</div>
                <div class="slice-card-body">【表头+第1行】
姓名：张三
部门：技术部
入职日期：2024-01-05
岗位：高级架构师</div>
            </div>
            <div class="slice-card">
                <div class="slice-card-header">切片 2</div>
                <div class="slice-card-body">【表头+第2行】
姓名：李四
部门：技术部
入职日期：2024-03-20
岗位：产品经理</div>
            </div>
        `;
    }
}

function updateSliceStrategyUI() {
    const generalIcon = document.getElementById('radio-icon-general');
    const specialIcon = document.getElementById('radio-icon-special');
    
    // Get parent containers for aria attributes
    const generalContainer = generalIcon ? generalIcon.parentElement : null;
    const specialContainer = specialIcon ? specialIcon.parentElement : null;
    
    const specialTypes = ['word', 'pdf', 'excel', 'ppt', 'image', 'text', 'invoice'];

    if (currentSliceStrategy === 'general') {
        if (generalIcon) {
            generalIcon.className = 'fa-solid fa-circle-check text-blue-600 transition-colors';
        }
        if (specialIcon) {
            specialIcon.className = 'fa-regular fa-circle text-gray-400 transition-colors';
        }
        if (generalContainer) generalContainer.setAttribute('aria-checked', 'true');
        if (specialContainer) specialContainer.setAttribute('aria-checked', 'false');
        
        // Disable special type buttons
        specialTypes.forEach(function(type) {
            const el = document.getElementById('create-kb-special-type-' + type);
            if (el) {
                el.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
            }
        });
        
    } else {
        if (generalIcon) {
            generalIcon.className = 'fa-regular fa-circle text-gray-400 transition-colors';
        }
        if (specialIcon) {
            specialIcon.className = 'fa-solid fa-circle-check text-blue-600 transition-colors';
        }
        if (generalContainer) generalContainer.setAttribute('aria-checked', 'false');
        if (specialContainer) specialContainer.setAttribute('aria-checked', 'true');
        
        // Enable special type buttons
        specialTypes.forEach(function(type) {
            const el = document.getElementById('create-kb-special-type-' + type);
            if (el) {
                el.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
            }
        });
    }
}

function handleSliceStrategyKey(event, strategy) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectSliceStrategy(strategy);
    }
}

// Expose for testing
window.selectSliceStrategy = selectSliceStrategy;
window.handleSliceStrategyKey = handleSliceStrategyKey;

// Unit Test for Slice Strategy Selection
window.testSliceStrategySelection = function() {
    console.group('Slice Strategy Selection Test');
    
    const generalIcon = document.getElementById('radio-icon-general');
    const specialIcon = document.getElementById('radio-icon-special');
    
    if (!generalIcon || !specialIcon) {
        console.error('Icons not found');
        console.groupEnd();
        return false;
    }
    
    // Test 1: Initial State (Should be General)
    // Note: JS state might be reset if page reloads, so we assume initial is 'general'
    // Force reset for test
    selectSliceStrategy('general');
    console.log('Reset to General');
    
    if (currentSliceStrategy !== 'general') console.error('FAIL: Initial state not general');
    else console.log('PASS: Initial state is general');
    
    if (!generalIcon.classList.contains('fa-circle-check')) console.error('FAIL: General icon incorrect');
    else console.log('PASS: General icon is checked');
    
    // Test 2: Switch to Special
    selectSliceStrategy('special');
    console.log('Switched to Special');
    
    if (currentSliceStrategy !== 'special') console.error('FAIL: State not updated to special');
    else console.log('PASS: State updated to special');
    
    if (!specialIcon.classList.contains('fa-circle-check')) console.error('FAIL: Special icon incorrect');
    else console.log('PASS: Special icon is checked');
    
    if (generalIcon.classList.contains('fa-circle-check')) console.error('FAIL: General icon still checked');
    else console.log('PASS: General icon unchecked');
    
    // Test 3: Keyboard Interaction
    console.log('Testing Keyboard (Enter on General)');
    handleSliceStrategyKey({ key: 'Enter', preventDefault: () => {} }, 'general');
    
    if (currentSliceStrategy !== 'general') console.error('FAIL: Keyboard interaction failed');
    else console.log('PASS: Keyboard interaction success');
    
    console.groupEnd();
};

function resetCreateKbSliceConfig() {
    const delimiterEl = document.getElementById('create-kb-slice-delimiter');
    const delimiterSelectEl = document.getElementById('create-kb-slice-delimiter-select');
    const sizeEl = document.getElementById('create-kb-slice-size');
    const overlapEl = document.getElementById('create-kb-slice-overlap');
    const preprocessSpacesEl = document.getElementById('create-kb-preprocess-spaces');
    const preprocessSensitiveEl = document.getElementById('create-kb-preprocess-sensitive');
    const preprocessFilenameEl = document.getElementById('create-kb-preprocess-filename');
    const preprocessTitleEl = document.getElementById('create-kb-preprocess-title');
    const specialFilenameEl = document.getElementById('create-kb-special-filename');
    const specialTitleEl = document.getElementById('create-kb-special-title');

    if (delimiterEl) delimiterEl.value = '\n\n';
    if (delimiterSelectEl) delimiterSelectEl.value = '\n\n';
    if (sizeEl) sizeEl.value = 1024;
    if (overlapEl) overlapEl.value = 50;
    if (preprocessSpacesEl) preprocessSpacesEl.checked = false;
    if (preprocessSensitiveEl) preprocessSensitiveEl.checked = false;
    if (preprocessFilenameEl) preprocessFilenameEl.checked = false;
    if (preprocessTitleEl) preprocessTitleEl.checked = false;
    if (specialFilenameEl) specialFilenameEl.checked = false;
    if (specialTitleEl) specialTitleEl.checked = false;
    
    // updateCreateKbSlicePreview(); // Do NOT auto-preview on reset as per implicit requirement to disable auto-preview interaction
}
window.resetCreateKbSliceConfig = resetCreateKbSliceConfig;

/**
 * Initialize linked scrolling between settings and preview in Step 3
 */
function initStep3LinkedScroll() {
    const leftCol = document.getElementById('create-kb-settings-column');
    const rightCol = document.getElementById('create-kb-slice-preview');
    
    if (!leftCol || !rightCol) {
        if (leftCol) leftCol.onscroll = null;
        return;
    }

    let isScrollingLeft = false;
    let isScrollingRight = false;

    const syncScroll = (source, target, flagSetter, otherFlag) => {
        if (otherFlag.value) return;
        flagSetter(true);
        
        const scrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
        target.scrollTop = scrollPercentage * (target.scrollHeight - target.clientHeight);
        
        // Also sync horizontal if needed, though usually not desired for split view
        // const scrollPercentageX = source.scrollLeft / (source.scrollWidth - source.clientWidth);
        // target.scrollLeft = scrollPercentageX * (target.scrollWidth - target.clientWidth);

        setTimeout(() => flagSetter(false), 50);
    };

    const leftFlag = { value: false };
    const rightFlag = { value: false };

    leftCol.onscroll = () => {
        if (rightFlag.value) return;
        leftFlag.value = true;
        const pct = leftCol.scrollTop / (leftCol.scrollHeight - leftCol.clientHeight);
        rightCol.scrollTop = pct * (rightCol.scrollHeight - rightCol.clientHeight);
        setTimeout(() => leftFlag.value = false, 50);
    };

    rightCol.onscroll = () => {
        if (leftFlag.value) return;
        rightFlag.value = true;
        const pct = rightCol.scrollTop / (rightCol.scrollHeight - rightCol.clientHeight);
        leftCol.scrollTop = pct * (leftCol.scrollHeight - leftCol.clientHeight);
        setTimeout(() => rightFlag.value = false, 50);
    };
}

/**
 * Implement dynamic positioning function to align buttons.
 * Moves the mover horizontally to the right until its left edge aligns with the target's right edge.
 * Includes animation, collision detection, and accuracy verification.
 */
window.alignButtonsDynamic = function(moverId, targetId) {
    const mover = document.getElementById(moverId);
    const target = document.getElementById(targetId);

    if (!mover || !target) {
        return;
    }

    // 1. Calculate current positions
    const moverRect = mover.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    // 2. Determine exact horizontal distance required
    // Target position: mover.left = target.right
    const desiredLeft = targetRect.right;
    const currentLeft = moverRect.left;
    const distance = desiredLeft - currentLeft;

    // Handle edge case: already in desired position
    if (Math.abs(distance) < 1) {
        console.log('alignButtonsDynamic: Already aligned within 1px tolerance.');
        return;
    }

    // 3. Collision Detection & Boundary Handling
    // If moving right would cause overflow or overlap in a way that's not intended
    // Here we ensure the elements remain visually touching without gap.
    
    // 4. Animate movement smoothly over 400ms (300-500ms range)
    const duration = 400;
    const startTime = performance.now();
    
    // Use transform for performance and smoothness
    mover.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    
    // Calculate current transform if any
    const style = window.getComputedStyle(mover);
    const matrix = new WebKitCSSMatrix(style.transform);
    const currentTranslateX = matrix.m41;
    
    mover.style.transform = `translateX(${currentTranslateX + distance}px)`;

    // 5. Verify final positioning accuracy within 1 pixel tolerance
    setTimeout(() => {
        const finalMoverRect = mover.getBoundingClientRect();
        const finalTargetRect = target.getBoundingClientRect();
        const finalGap = Math.abs(finalMoverRect.left - finalTargetRect.right);
        
        console.log(`[VERIFY] Final gap between ${moverId} and ${targetId}: ${finalGap.toFixed(2)}px`);
        
        if (finalGap <= 1) {
            console.log('[VERIFY] Positioning accuracy verified: SUCCESS');
            mover.setAttribute('data-aligned', 'true');
        } else {
            console.warn('[VERIFY] Positioning accuracy verified: FAIL', finalGap);
            // Optional: Correct if needed
            const correction = finalTargetRect.right - finalMoverRect.left;
            mover.style.transform = `translateX(${currentTranslateX + distance + correction}px)`;
        }
    }, duration + 50);
};

// Auto-trigger for the specific buttons if they are found
window.triggerButtonAlignment = function() {
    alignButtonsDynamic('btn-view-source-preview', 'btn-re-slice-preview');
};

function openBatchSliceSettingsPageSingle(docId) {
    window.openStrategyConfig(docId);
}
window.openBatchSliceSettingsPageSingle = openBatchSliceSettingsPageSingle;

// Strategy Config Logic
let strategyConfigDocId = null;
let savedKbListState = null;

const STRATEGY_CELL_PLACEHOLDERS = new Set(['未设置', 'undefined', 'null', '-', '请选择']);

function getStrategyOperatorName() {
    try {
        if (window.currentUser && typeof window.currentUser === 'object') {
            const name = window.currentUser.name || window.currentUser.username;
            if (typeof name === 'string' && name.trim()) return name.trim();
        }
    } catch (_) {}

    try {
        const candidates = ['username', 'user', 'currentUserName', 'operatorName'];
        for (const key of candidates) {
            const v = localStorage.getItem(key);
            if (typeof v === 'string' && v.trim()) return v.trim();
        }
    } catch (_) {}

    return 'unknown';
}

function isValidStrategyText(v) {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s) return false;
    if (STRATEGY_CELL_PLACEHOLDERS.has(s)) return false;
    return true;
}

function getStrategyDefaultLabel() {
    const contentTemplate = document.getElementById('content-template');
    const isTemplateTabActive = contentTemplate && !contentTemplate.classList.contains('hidden');

    if (isTemplateTabActive) {
        const tplId = window.selectedTemplateId;
        if (tplId && window.TEMPLATE_DATA) {
            const lists = ['general', 'custom', 'customized'];
            for (const k of lists) {
                const arr = window.TEMPLATE_DATA[k];
                if (!Array.isArray(arr)) continue;
                const tpl = arr.find(t => t && t.id === tplId);
                if (tpl && typeof tpl.name === 'string' && tpl.name.trim()) return tpl.name.trim();
            }
        }
        return '模板名称';
    }

    const map = {
        text: '文本文档数据',
        table: '表格数据',
        image: '图片数据',
        markdown: 'Markdown文件上传'
    };
    const type = window.currentStrategyType;
    return map[type] || '对应数据类型';
}

function cssEscapeValue(v) {
    try {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(v);
    } catch (_) {}
    return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function persistMockDocsSafely() {
    try {
        localStorage.setItem('mockDocs_v2', JSON.stringify(mockDocs));
    } catch (e) {
        console.error('Failed to save mockDocs_v2', e);
    }
}

function setDocRowHighlight(docId) {
    try {
        localStorage.setItem('docRowHighlight', JSON.stringify({ docId, until: Date.now() + 1000 }));
    } catch (_) {}
}

window.applyDocRowHighlightFromStorage = function() {
    const tbody = document.getElementById('doc-list-body');
    if (!tbody) return;
    let payload = null;
    try {
        const raw = localStorage.getItem('docRowHighlight');
        if (!raw) return;
        payload = JSON.parse(raw);
    } catch (_) {
        return;
    }

    if (!payload || !payload.docId || typeof payload.until !== 'number') return;
    if (Date.now() > payload.until) {
        try { localStorage.removeItem('docRowHighlight'); } catch (_) {}
        return;
    }

    const tr = tbody.querySelector(`tr[data-doc-id="${payload.docId}"]`);
    if (!tr) return;

    tr.classList.add('bg-yellow-50');
    setTimeout(() => {
        tr.classList.remove('bg-yellow-50');
    }, 1000);

    try { localStorage.removeItem('docRowHighlight'); } catch (_) {}
};

function appendStrategyAuditLog(entry) {
    const key = 'strategyConfigAuditLogs';
    try {
        const existing = localStorage.getItem(key);
        const logs = existing ? JSON.parse(existing) : [];
        const next = Array.isArray(logs) ? logs : [];
        next.unshift(entry);
        if (next.length > 200) next.length = 200;
        localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
        console.error('Failed to append strategy audit log', e);
    }
}

function validateWriteBackPayload(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, message: '数据格式不正确' };
    const label = payload.label;
    const value = payload.value;
    if (typeof label !== 'string' || typeof value !== 'string') return { ok: false, message: '数据类型不正确' };
    if (label.length > 50) return { ok: false, message: '文本长度超过 50 字符' };
    if (value.length > 50) return { ok: false, message: '值长度超过 50 字符' };
    return { ok: true };
}

function getStrategyOptionMeta(type, group, value) {
    const config = STRATEGY_CONFIG && STRATEGY_CONFIG[type];
    const list = config && config[group];
    if (!Array.isArray(list)) return null;
    return list.find(opt => opt && opt.value === value) || null;
}

function validateDocBusinessConsistency(doc) {
    const cfg = doc && doc.strategyConfig ? doc.strategyConfig : null;
    if (!cfg) return { ok: true };
    const type = cfg.type;
    const parsingValue = cfg.parsing && typeof cfg.parsing === 'object' ? cfg.parsing.value : null;
    const chunkingValue = cfg.chunking && typeof cfg.chunking === 'object' ? cfg.chunking.value : null;

    if (type === 'table') {
        if (chunkingValue && chunkingValue !== 'default') {
            return { ok: false, message: '表格数据不支持切片策略配置' };
        }
        if (parsingValue && parsingValue.startsWith('headerRow:')) {
            return { ok: true };
        }
    }

    if (type === 'image') {
        if (chunkingValue && !['whole', 'default'].includes(chunkingValue)) {
            return { ok: false, message: '图片数据仅支持整文件切片' };
        }
    }

    if (parsingValue === 'vlm' && chunkingValue === 'chapter') {
        return { ok: false, message: '图片理解与按章节切片不兼容' };
    }

    return { ok: true };
}

function ensureDocCellValue(doc, field) {
    const defaultLabel = getStrategyDefaultLabel();
    const now = new Date().toISOString();

    if (field === 'parser') {
        // 解析策略现在允许为空：不再做异常默认填充
        if (isValidStrategyText(doc.parserName)) return;
        doc.parserName = '未设置';
        doc.strategyCellState = doc.strategyCellState || {};
        doc.strategyCellState.parser = { abnormal: false };
        doc.strategyConfig = doc.strategyConfig || {};
        doc.strategyConfig.parsing = null;
        return;
    }

    if (field === 'slice') {
        if (isValidStrategyText(doc.sliceSettingName)) return;
        doc.sliceSettingName = defaultLabel;
        doc.strategyCellState = doc.strategyCellState || {};
        doc.strategyCellState.slice = {
            abnormal: true,
            tooltip: `异常填充：缺失切片设置，已使用默认值「${defaultLabel}」`
        };
        doc.strategyConfig = doc.strategyConfig || {};
        doc.strategyConfig.chunking = { value: defaultLabel, label: defaultLabel, meta: { source: 'default' } };

        appendStrategyAuditLog({
            ts: now,
            user: getStrategyOperatorName(),
            docId: doc.id,
            missingField: 'slice',
            defaultValue: defaultLabel
        });
    }
}

function showStrategyConflictModal(params) {
    const { title, message, onConfirm, onCancel } = params || {};
    let modal = document.getElementById('strategy-conflict-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'strategy-conflict-modal';
        modal.className = 'fixed inset-0 z-50 hidden';
        modal.innerHTML = `
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm"></div>
            <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div class="sm:flex sm:items-start">
                                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <i class="fa-solid fa-triangle-exclamation text-yellow-600"></i>
                                </div>
                                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                                    <h3 class="text-base font-semibold leading-6 text-gray-900" id="strategy-conflict-title"></h3>
                                    <div class="mt-2">
                                        <p class="text-sm text-gray-600" id="strategy-conflict-message"></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button type="button" id="strategy-conflict-confirm" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto transition-all active:scale-95">继续应用</button>
                            <button type="button" id="strategy-conflict-cancel" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-all active:scale-95">取消</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#strategy-conflict-title');
    const msgEl = modal.querySelector('#strategy-conflict-message');
    const btnConfirm = modal.querySelector('#strategy-conflict-confirm');
    const btnCancel = modal.querySelector('#strategy-conflict-cancel');

    if (titleEl) titleEl.textContent = title || '检测到配置冲突';
    if (msgEl) msgEl.textContent = message || '当前组合可能不符合业务约束，是否仍要继续？';

    const close = () => modal.classList.add('hidden');

    if (btnConfirm) {
        btnConfirm.onclick = () => {
            close();
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
    if (btnCancel) {
        btnCancel.onclick = () => {
            close();
            if (typeof onCancel === 'function') onCancel();
        };
    }

    modal.classList.remove('hidden');
}

function applyStrategyWriteBackToDoc(params) {
    const { field, value, label, meta, allowConflict } = params || {};
    const docId = strategyConfigDocId;
    if (!docId) {
        if (window.showToast) window.showToast('未找到当前文档上下文，无法回填', 'error');
        return;
    }

    const doc = Array.isArray(mockDocs) ? mockDocs.find(d => d && d.id === docId) : null;
    if (!doc) {
        if (window.showToast) window.showToast('未找到对应文档，无法回填', 'error');
        return;
    }

    const snapshot = {
        parserName: doc.parserName,
        sliceSettingName: doc.sliceSettingName,
        strategyConfig: doc.strategyConfig ? JSON.parse(JSON.stringify(doc.strategyConfig)) : null,
        strategyCellState: doc.strategyCellState ? JSON.parse(JSON.stringify(doc.strategyCellState)) : null
    };

    let next = { value, label, meta };

    if (!isValidStrategyText(next.value) || !isValidStrategyText(next.label)) {
        const fallback = getStrategyDefaultLabel();
        next = { value: fallback, label: fallback, meta: { source: 'default' } };
        if (field === 'parser') {
            doc.strategyCellState = doc.strategyCellState || {};
            doc.strategyCellState.parser = {
                abnormal: true,
                tooltip: `异常填充：缺失解析器设置，已使用默认值「${fallback}」`
            };
            appendStrategyAuditLog({
                ts: new Date().toISOString(),
                user: getStrategyOperatorName(),
                docId: doc.id,
                missingField: 'parser',
                defaultValue: fallback
            });
        } else if (field === 'slice') {
            doc.strategyCellState = doc.strategyCellState || {};
            doc.strategyCellState.slice = {
                abnormal: true,
                tooltip: `异常填充：缺失切片设置，已使用默认值「${fallback}」`
            };
            appendStrategyAuditLog({
                ts: new Date().toISOString(),
                user: getStrategyOperatorName(),
                docId: doc.id,
                missingField: 'slice',
                defaultValue: fallback
            });
        }
    } else {
        if (field === 'parser' && doc.strategyCellState && doc.strategyCellState.parser && doc.strategyCellState.parser.abnormal) {
            doc.strategyCellState.parser = { abnormal: false };
        }
        if (field === 'slice' && doc.strategyCellState && doc.strategyCellState.slice && doc.strategyCellState.slice.abnormal) {
            doc.strategyCellState.slice = { abnormal: false };
        }
    }

    const payloadCheck = validateWriteBackPayload(next);
    if (!payloadCheck.ok) {
        if (window.showToast) window.showToast(payloadCheck.message || '回填数据校验失败', 'error');
        doc.parserName = snapshot.parserName;
        doc.sliceSettingName = snapshot.sliceSettingName;
        doc.strategyConfig = snapshot.strategyConfig;
        doc.strategyCellState = snapshot.strategyCellState;
        return;
    }

    doc.strategyConfig = doc.strategyConfig || {};
    doc.strategyConfig.type = window.currentStrategyType || doc.strategyConfig.type || null;

    if (field === 'parser') {
        doc.parserName = next.label;
        doc.strategyConfig.parsing = next;
    }
    if (field === 'slice') {
        doc.sliceSettingName = next.label;
        doc.strategyConfig.chunking = next;
    }

    ensureDocCellValue(doc, 'parser');
    ensureDocCellValue(doc, 'slice');

    if (!allowConflict) {
        const consistency = validateDocBusinessConsistency(doc);
        if (!consistency.ok) {
            doc.parserName = snapshot.parserName;
            doc.sliceSettingName = snapshot.sliceSettingName;
            doc.strategyConfig = snapshot.strategyConfig;
            doc.strategyCellState = snapshot.strategyCellState;

            showStrategyConflictModal({
                title: '配置冲突确认',
                message: `${consistency.message}。已回滚本次修改，是否仍要继续应用？`,
                onConfirm: () => {
                    applyStrategyWriteBackToDoc({ field, value: next.value, label: next.label, meta: next.meta, allowConflict: true });
                }
            });
            return;
        }
    }

    persistMockDocsSafely();
    setDocRowHighlight(doc.id);
    if (typeof renderDocList === 'function') renderDocList();
}

function clearStrategyWriteBackToDoc(field) {
    const docId = strategyConfigDocId;
    if (!docId) return;
    const doc = Array.isArray(mockDocs) ? mockDocs.find(d => d && d.id === docId) : null;
    if (!doc) return;

    doc.strategyConfig = doc.strategyConfig || {};
    doc.strategyConfig.type = window.currentStrategyType || doc.strategyConfig.type || null;
    doc.strategyCellState = doc.strategyCellState || {};

    if (field === 'parser') {
        doc.parserName = '未设置';
        doc.strategyConfig.parsing = null;
        doc.strategyCellState.parser = { abnormal: false };
    }

    persistMockDocsSafely();
    setDocRowHighlight(doc.id);
    if (typeof renderDocList === 'function') renderDocList();
}

window.openStrategyConfig = function(id) {
    // 批量切片配置入口（批量操作工具栏按钮会传空）
    if (!id) {
        if (typeof validateBatchAction === 'function' && !validateBatchAction()) return;

        // 若尚未锁定类型，但已有选择，则以第一条选择为锁定类型
        if (!window.batchSliceLockedType && selectedDocIds && selectedDocIds.size > 0) {
            const firstId = Array.from(selectedDocIds)[0];
            const firstDoc = Array.isArray(mockDocs) ? mockDocs.find(d => d && d.id === firstId) : null;
            window.batchSliceLockedType = window.getBatchDataTypeFromDoc(firstDoc);
        }

        // 二次校验：已选文件必须同类型
        if (selectedDocIds && selectedDocIds.size > 0 && window.batchSliceLockedType) {
            const lock = window.batchSliceLockedType;
            const bad = Array.from(selectedDocIds).some(docId => {
                const d = Array.isArray(mockDocs) ? mockDocs.find(x => x && x.id === docId) : null;
                return window.getBatchDataTypeFromDoc(d) !== lock;
            });
            if (bad) {
                if (window.showToast) window.showToast('批量切片配置仅支持选择同一数据类型文件', 'error');
                return;
            }
        }

        if (typeof window.openBatchSliceSettingsPage === 'function') {
            window.openBatchSliceSettingsPage();
        } else if (window.showToast) {
            window.showToast('批量切片页面未加载，请刷新重试', 'error');
        }
        return;
    }

    strategyConfigDocId = id;
    
    // Save list state
    const scrollContainer = document.getElementById('doc-list-scroll-container');
    const searchInput = document.getElementById('doc-search-input');
    
    savedKbListState = {
        scrollTop: scrollContainer ? scrollContainer.scrollTop : 0,
        searchQuery: searchInput ? searchInput.value : '',
        kbId: currentKbId,
        view: 'detail' 
    };
    
    switchView('knowledge-strategy-config');
};

window.initStrategyConfigPage = function(params) {
    // 默认 tab 已在 HTML 中设置，这里补充：根据“当前文档文件类型”限制可选的数据类型卡片
    try {
        // 模板编辑模式：不限制（模板可以配置任意类型）
        if (window.currentEditingTemplateId) {
            window.applyStrategyTypeAvailability(['text', 'table', 'image', 'markdown'], { autoSelect: false });
            return;
        }

        const docId = strategyConfigDocId;
        const docsStore = Array.isArray(mockDocs) ? mockDocs : (window.KNOWLEDGE_DOCS || []);
        const doc = docsStore && docId ? docsStore.find(d => d && d.id === docId) : null;
        const inferred = window.inferStrategyTypeFromDoc(doc);
        const allowed = [inferred];

        // 先禁用不可选项；再自动选中（如果当前未选或不匹配）
        window.applyStrategyTypeAvailability(allowed, { autoSelect: false });

        const preferred = (doc && doc.strategyConfig && doc.strategyConfig.type && allowed.includes(doc.strategyConfig.type))
            ? doc.strategyConfig.type
            : inferred;
        window.selectStrategyType(preferred);
    } catch (e) {
        console.warn('initStrategyConfigPage availability guard failed:', e);
    }
};

window.switchStrategyTab = function(tabName) {
    const tabFile = document.getElementById('tab-file-type');
    const tabTemplate = document.getElementById('tab-template');
    const contentFile = document.getElementById('content-file-type');
    const contentTemplate = document.getElementById('content-template');
    
    if (!tabFile || !tabTemplate || !contentFile || !contentTemplate) return;
    
    // Segmented Control Style Classes
    const activeClasses = ['bg-white', 'shadow-sm', 'text-gray-900', 'font-semibold', 'ring-1', 'ring-black/5'];
    const inactiveClasses = ['text-gray-500', 'hover:text-gray-900', 'font-medium', 'hover:bg-gray-200/50'];
    
    // Helper to switch classes
    const updateTabClasses = (activeTab, inactiveTab) => {
        // Add active classes to active tab, remove inactive
        activeTab.classList.add(...activeClasses);
        activeTab.classList.remove(...inactiveClasses);
        
        // Add inactive classes to inactive tab, remove active
        inactiveTab.classList.add(...inactiveClasses);
        inactiveTab.classList.remove(...activeClasses);
    };
    
    if (tabName === 'file-type') {
        updateTabClasses(tabFile, tabTemplate);
        
        contentFile.classList.remove('hidden');
        contentFile.classList.add('animate-fade-in');
        contentTemplate.classList.add('hidden');
        contentTemplate.classList.remove('animate-fade-in');
    } else {
        updateTabClasses(tabTemplate, tabFile);
        
        contentTemplate.classList.remove('hidden');
        contentTemplate.classList.add('animate-fade-in');
        contentFile.classList.add('hidden');
        contentFile.classList.remove('animate-fade-in');
        
        // Initialize Templates if not loaded
        if (typeof initTemplateTab === 'function' && !window.isTemplatesLoaded) {
            initTemplateTab();
        }
    }
};

window.goBackToKnowledgeList = function() {
    switchView('knowledge');
    
    // We can set a flag to restore state
    if (savedKbListState) {
        localStorage.setItem('restoreKbListState', JSON.stringify(savedKbListState));
        // Reset local variable just in case
        savedKbListState = null;
    }
};

// --- Strategy Config Implementation ---

const STRATEGY_CONFIG = {
    text: {
        parsing: [
            { id: 'ocr', label: '图片文字识别 (OCR)', desc: '提取图片中的文本内容', icon: 'fa-font', value: 'ocr' },
            { id: 'vlm', label: '图片理解 (VLM)', desc: '理解图片场景与语义信息', icon: 'fa-image', value: 'vlm' }
        ],
        chunking: [
            { id: 'custom', label: '自定义切片', desc: '按字符数、分隔符等规则切分', icon: 'fa-scissors', value: 'custom' },
            { id: 'chapter', label: '按章节切片', desc: '按照文档的章节结构进行切分', icon: 'fa-bookmark', value: 'chapter' },
            { id: 'page', label: '按页切片', desc: '每一页作为一个独立切片', icon: 'fa-copy', value: 'page' },
            { id: 'whole', label: '整文件切片', desc: '整个文件内容作为一个切片', icon: 'fa-file', value: 'whole' }
        ],
        enhancement: [
            { id: 'qa-file', label: '问题生成（文件）', icon: 'fa-circle-question' },
            { id: 'qa-chunk', label: '问题生成（切片）', icon: 'fa-circle-question' },
            { id: 'kw-file', label: '关键字生成（文件）', icon: 'fa-tags' },
            { id: 'kw-chunk', label: '关键字生成（切片）', icon: 'fa-tags' },
            { id: 'sum-file', label: '摘要生成（文件）', icon: 'fa-file-lines' },
            { id: 'sum-chunk', label: '摘要生成（切片）', icon: 'fa-file-lines' }
        ]
    },
    table: {
        parsing: [], 
        chunking: [],
        enhancement: [
            { id: 'qa-file', label: '问题生成（文件）', icon: 'fa-circle-question' },
            { id: 'qa-chunk', label: '问题生成（切片）', icon: 'fa-circle-question' },
            { id: 'kw-file', label: '关键字生成（文件）', icon: 'fa-tags' },
            { id: 'kw-chunk', label: '关键字生成（切片）', icon: 'fa-tags' },
            { id: 'sum-file', label: '摘要生成（文件）', icon: 'fa-file-lines' },
            { id: 'sum-chunk', label: '摘要生成（切片）', icon: 'fa-file-lines' }
        ]
    },
    image: {
        parsing: [
            { id: 'ocr', label: '图片文字识别 (OCR)', desc: '提取图片中的文本内容', icon: 'fa-font', value: 'ocr' },
            { id: 'vlm', label: '图片理解 (VLM)', desc: '理解图片场景与语义信息', icon: 'fa-image', value: 'vlm' }
        ],
        chunking: [],
        enhancement: [
            { id: 'qa-file', label: '问题生成（文件）', icon: 'fa-circle-question' },
            { id: 'qa-chunk', label: '问题生成（切片）', icon: 'fa-circle-question' },
            { id: 'kw-file', label: '关键字生成（文件）', icon: 'fa-tags' },
            { id: 'kw-chunk', label: '关键字生成（切片）', icon: 'fa-tags' },
            { id: 'sum-file', label: '摘要生成（文件）', icon: 'fa-file-lines' },
            { id: 'sum-chunk', label: '摘要生成（切片）', icon: 'fa-file-lines' }
        ]
    }
};

// Markdown 文件上传：文件处理策略参考“文本文档数据”
// 仅在 Markdown 模式下移除“按页切片”，其余切片策略保持一致
// 注意：不能直接引用 STRATEGY_CONFIG.text（避免互相影响），需要做浅拷贝
STRATEGY_CONFIG.markdown = Object.assign({}, STRATEGY_CONFIG.text, {
    parsing: (STRATEGY_CONFIG.text.parsing || []).map(x => Object.assign({}, x)),
    enhancement: (STRATEGY_CONFIG.text.enhancement || []).map(x => Object.assign({}, x)),
    chunking: (STRATEGY_CONFIG.text.chunking || [])
        .filter(x => x && x.value !== 'page')
        .map(x => Object.assign({}, x))
});

window.getCustomChunkConfigHTML = function(prefix) {
    return `
<div id="${prefix}-custom-chunk-config" class="col-span-1 md:col-span-3 bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-3 mt-4 animate-fade-in">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div id="${prefix}-config-group-delimiter">
            <label class="block text-xs text-gray-600 mb-1">分段标识符</label>
            <div class="relative">
                <input id="${prefix}-slice-delimiter" type="text" placeholder="例如 \\n\\n" value="" class="w-full border border-gray-200 rounded-lg text-sm pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <select id="${prefix}-slice-delimiter-select" onchange="document.getElementById('${prefix}-slice-delimiter').value = this.value" class="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer z-10">
                    <option value="\\n\\n">段落（\\n\\n）</option>
                    <option value="\\n">换行（\\n）</option>
                    <option value="。">中文句号（。）</option>
                    <option value="，">中文逗号（，）</option>
                    <option value="？">中文问号（？）</option>
                    <option value="！">中文感叹号（！）</option>
                    <option value="；">中文分号（；）</option>
                    <option value=".">英文句号（.）</option>
                    <option value=",">英文逗号（,）</option>
                    <option value="?">英文问号（?）</option>
                    <option value="!">英文感叹号（!）</option>
                    <option value=";">英文分号（;）</option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-gray-500 pointer-events-none">
                    <i class="fa-solid fa-chevron-down text-xs"></i>
                </div>
            </div>
        </div>
        <div id="${prefix}-config-group-size">
            <label class="block text-xs text-gray-600 mb-1">分段最大长度</label>
            <input id="${prefix}-slice-size" type="number" min="100" max="4000" step="100" value="1024" class="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        </div>
        <div id="${prefix}-config-group-overlap">
            <label class="block text-xs text-gray-600 mb-1">切片重叠长度</label>
            <input id="${prefix}-slice-overlap" type="number" min="0" max="500" step="50" value="50" class="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        </div>
        <div id="${prefix}-config-group-title-level" class="hidden">
            <label class="block text-xs text-gray-600 mb-1">标题级数</label>
            <input id="${prefix}-slice-title-level" type="number" min="1" max="3" step="1" value="1" class="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        </div>
    </div>
    
    <div>
        <label class="block text-xs text-gray-600 mb-1">文本预处理规则</label>
        <div class="space-y-2 pt-1">
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-spaces" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300" checked="">
                <label for="${prefix}-preprocess-spaces" class="text-xs text-gray-600">替换掉连续的空格、换行符和制表符</label>
            </div>
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-sensitive" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="${prefix}-preprocess-sensitive" class="text-xs text-gray-600">删除所有 URL 和电子邮件地址</label>
            </div>
        </div>
        <label class="block text-xs text-gray-600 mb-1 mt-3">关联信息</label>
        <div class="space-y-2 pt-1">
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-filename" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300" checked="">
                <label for="${prefix}-preprocess-filename" class="text-xs text-gray-600">关联文件名</label>
            </div>
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-title" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="${prefix}-preprocess-title" class="text-xs text-gray-600">关联标题及子标题</label>
            </div>
        </div>
    </div>
</div>
    `;
};

// 仅“文本预处理规则 + 关联信息”配置块（用于按页/整文件切片时展示在卡片下方）
window.getTextPreprocessConfigHTML = function(prefix) {
    return `
<div id="${prefix}-preprocess-extra-config" class="col-span-1 md:col-span-3 bg-gray-50 border border-gray-100 rounded-lg p-4 mt-4 animate-fade-in">
    <div>
        <label class="block text-xs text-gray-600 mb-1">文本预处理规则</label>
        <div class="space-y-2 pt-1">
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-spaces" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300" checked="">
                <label for="${prefix}-preprocess-spaces" class="text-xs text-gray-600">替换掉连续的空格、换行符和制表符</label>
            </div>
            <div class="flex items-center gap-2">
                <input id="${prefix}-preprocess-sensitive" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="${prefix}-preprocess-sensitive" class="text-xs text-gray-600">删除所有 URL 和电子邮件地址</label>
            </div>
        </div>
        <label class="block text-xs text-gray-600 mb-1 mt-3">关联信息</label>
        <div class="space-y-2 pt-1">
            <div class="flex items-center gap-2" id="${prefix}-preprocess-filename-row">
                <input id="${prefix}-preprocess-filename" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300" checked="">
                <label for="${prefix}-preprocess-filename" class="text-xs text-gray-600">关联文件名</label>
            </div>
            <div class="flex items-center gap-2" id="${prefix}-preprocess-title-row">
                <input id="${prefix}-preprocess-title" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="${prefix}-preprocess-title" class="text-xs text-gray-600">关联标题及子标题</label>
            </div>
        </div>
    </div>
</div>
    `;
};

window.currentStrategyType = null;

// 根据文件名推断数据类型（严格按文件格式映射）：
// - 文本文档数据：.doc、.docx、.ppt、.pptx、.pdf （统一归为 text）
// - 表格数据：.xlsx、.xls （table）
// - 图片数据：.png、.jpg、.jpeg、.bmp （image）
// - 纯文本 / Markdown 数据：.md、.txt （markdown）
window.inferStrategyTypeFromFilename = function(filename) {
    const name = (filename || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    if (['xls', 'xlsx'].includes(ext)) return 'table';
    if (['png', 'jpg', 'jpeg', 'bmp'].includes(ext)) return 'image';
    if (['md', 'txt'].includes(ext)) return 'markdown';
    // 其余（doc/docx/ppt/pptx/pdf...）均归为文本文档数据
    return 'text';
};

// 从 doc 推断数据类型：优先按文件名扩展名；必要时用 fileType 兜底
window.inferStrategyTypeFromDoc = function(doc) {
    if (!doc) return 'text';
    const name = doc.name || '';
    const byName = window.inferStrategyTypeFromFilename(name);
    if (byName) return byName;

    // 若 name 缺失或无扩展名，则使用 fileType 做保守兜底
    const ft = String(doc.fileType || doc.type || '').toLowerCase();
    if (ft === 'excel') return 'table';
    if (ft === 'markdown') return 'markdown';
    // PDF/Word/Text 统一归为文本文档数据（text）
    return 'text';
};

// 根据允许的数据类型，控制“选择数据类型”卡片是否可点击
window.applyStrategyTypeAvailability = function(allowedTypes, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const shouldAutoSelect = opts.autoSelect !== false;
    const types = ['text', 'table', 'image', 'markdown'];
    const allow = Array.isArray(allowedTypes) && allowedTypes.length ? allowedTypes : types;

    types.forEach(t => {
        const el = document.getElementById(`type-card-${t}`);
        if (!el) return;
        const enabled = allow.includes(t);
        el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        el.classList.toggle('opacity-50', !enabled);
        el.classList.toggle('cursor-not-allowed', !enabled);
        el.classList.toggle('pointer-events-none', !enabled);
    });

    if (shouldAutoSelect) {
        const current = window.currentStrategyType;
        if (!current || !allow.includes(current)) {
            const next = allow[0];
            if (next) window.selectStrategyType(next);
        }
    }
};

window.selectStrategyType = function(type) {
    // 若卡片被禁用（由文件类型限制），则不允许选择
    const card = document.getElementById(`type-card-${type}`);
    if (card && card.getAttribute('aria-disabled') === 'true') {
        if (window.showToast) window.showToast('当前文件类型不支持该数据类型配置', 'error');
        return;
    }

    window.currentStrategyType = type;
    
    // Update Sidebar Selection
    const types = ['text', 'table', 'image', 'markdown'];
    types.forEach(t => {
        const el = document.getElementById(`type-card-${t}`);
        if (!el) return;
        
        if (t === type) {
            el.classList.add('border-blue-600', 'bg-blue-50');
            el.classList.remove('border-transparent', 'hover:bg-gray-50');
            // Icon
            const iconContainer = el.querySelector('.w-8');
            if (iconContainer) {
                iconContainer.classList.add('bg-blue-100', 'text-blue-600');
                iconContainer.classList.remove('bg-gray-100', 'text-gray-500');
            }
        } else {
            el.classList.remove('border-blue-600', 'bg-blue-50');
            el.classList.add('border-transparent', 'hover:bg-gray-50');
             // Icon
            const iconContainer = el.querySelector('.w-8');
            if (iconContainer) {
                iconContainer.classList.remove('bg-blue-100', 'text-blue-600');
                iconContainer.classList.add('bg-gray-100', 'text-gray-500');
            }
        }
    });

    // Update Parsing Title/Icon
    const parsingTitle = document.getElementById('parsing-title');
    const parsingIcon = document.getElementById('parsing-icon');
    if (parsingTitle && parsingIcon) {
        if (type === 'table') {
            parsingTitle.innerText = '表头设置';
            parsingIcon.className = 'fa-solid fa-table-columns text-sm';
            parsingTitle.setAttribute('aria-label', '表头设置');
        } else {
            parsingTitle.innerText = '解析策略';
            parsingIcon.className = 'fa-solid fa-microchip text-sm';
            parsingTitle.setAttribute('aria-label', '解析策略');
        }
    }

    // Show Strategy Section
    const strategySection = document.getElementById('strategy-settings-container');
    if (strategySection) {
        strategySection.classList.remove('hidden');
    }

    // Update Content Area
    renderStrategyContent(type);
    
    // Trigger config change
    if (typeof window.handleConfigChange === 'function') {
        window.handleConfigChange();
    }
};

function renderStrategyContent(type) {
    const config = STRATEGY_CONFIG[type];
    if (!config) return;

    // 统一的“说明浮窗”(点击图标) 逻辑：页面任意位置仅允许打开一个
    if (!window.__infoPopoverBound) {
        window.__infoPopoverBound = true;
        window.closeAllInfoPopovers = function() {
            document.querySelectorAll('[data-popover-panel]').forEach(p => p.classList.add('hidden'));
            document.querySelectorAll('[data-popover-btn]').forEach(b => b.setAttribute('aria-expanded', 'false'));
        };
        window.toggleInfoPopover = function(btn) {
            const panel = btn?.parentElement?.querySelector('[data-popover-panel]');
            if (!panel) return;
            const willOpen = panel.classList.contains('hidden');
            window.closeAllInfoPopovers();
            if (willOpen) {
                panel.classList.remove('hidden');
                btn.setAttribute('aria-expanded', 'true');
            }
        };
        document.addEventListener('click', () => window.closeAllInfoPopovers());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.closeAllInfoPopovers();
        });
    }

    const chunkingTipMap = {
        custom: {
            desc: '优先按照标识符（如换行符、段落分隔符、特殊标记）分段；当某一个分段超过设定的最大长度后，在该分段内进行二次强制分段；每段单独成片，前后会设置重叠字符（如 50 字符），保证上下文连贯。',
            scene: '绝大多数通用文档、无固定章节 / 分页规则的文本，是最灵活、最常用的通用方案。'
        },
        chapter: {
            desc: '优先识别文档的章节结构（如标题层级、目录标记、章节分隔符），按章节边界进行分段；单个章节内容不超过最大长度时，直接作为一个切片；若超过最大长度，则在章节内进行二次分段，段间保留重叠字符。',
            scene: '结构化强的文档（如书籍、论文、手册、政策文件），需要保留章节语义完整性。'
        },
        page: {
            desc: '以文档的物理页边界为核心依据，每一页作为一个独立切片；若单页内容超过最大长度，在页内进行二次分段；不同页的切片间可设置页首 / 页尾的重叠字符，避免页间语义断裂。',
            scene: 'PDF/PPT 等带明确分页的文档，需要按页级粒度管理。'
        },
        whole: {
            desc: '不进行任何主动切分，将整个文件的所有内容合并为一个完整的切片；不做分段、不设重叠，完整保留文件原始结构与上下文。',
            scene: '内容短、语义高度关联的文档（如短文、单页说明、小型协议），无需拆分的场景。'
        }
    };

    const renderChunkingTipInline = (value) => {
        const info = chunkingTipMap[value];
        if (!info) return '';
        return `
            <span class="relative inline-flex items-center ml-1.5 align-middle group/strategyTip" onclick="event.stopPropagation();">
                <i class="fa-solid fa-circle-info text-[11px] text-gray-400 hover:text-blue-600 transition-colors"></i>
                <span class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[380px] opacity-0 translate-y-1 scale-[0.98] transition-all duration-150 group-hover/strategyTip:opacity-100 group-hover/strategyTip:translate-y-0 group-hover/strategyTip:scale-100 z-[9999]">
                    <div class="absolute -top-1 right-5 w-3 h-3 rotate-45 bg-slate-900/95 border border-white/10"></div>
                    <div class="relative rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl p-4">
                        <div class="flex items-start gap-2">
                            <div class="mt-0.5 text-sky-300">
                                <i class="fa-solid fa-lightbulb"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-sm font-semibold text-white">策略说明</div>
                                <div class="mt-1 text-xs leading-relaxed text-slate-200">${info.desc}</div>
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-white/10">
                            <div class="text-xs font-semibold text-slate-100">适用场景</div>
                            <div class="mt-1 text-xs leading-relaxed text-slate-200">${info.scene}</div>
                        </div>
                    </div>
                </span>
            </span>
        `;
    };

    // Parsing Section
    const parsingSection = document.getElementById('section-parsing');
    const parsingOptions = document.getElementById('parsing-options');
    
    if (type === 'table') {
        parsingSection.classList.remove('hidden');
        parsingOptions.innerHTML = `
            <div class="flex flex-col gap-2 w-full max-w-sm">
                <div class="relative">
                    <input type="number" id="header-row-input" min="1" max="50" value="1" 
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="请输入行号" oninput="validateHeaderRow(this)" aria-describedby="header-row-hint header-row-error">
                    <div id="header-row-error" class="text-xs text-red-500 mt-1 hidden" role="alert">
                        <i class="fa-solid fa-circle-exclamation mr-1"></i><span>请输入 1-50 之间的整数</span>
                    </div>
                </div>
                <p id="header-row-hint" class="text-xs text-gray-500">请输入作为表头的行号，默认为第 1 行</p>
            </div>
        `;
    } else if (config.parsing && config.parsing.length > 0) {
        parsingSection.classList.remove('hidden');
        parsingOptions.outerHTML = `<div id="parsing-options" class="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="解析策略">` + 
            config.parsing.map(opt => `
            <div role="radio" aria-checked="${opt.checked ? 'true' : 'false'}" tabindex="${opt.checked ? '0' : '-1'}" data-value="${opt.value}" data-group="parsing-strategy" class="strategy-card relative flex h-full items-center justify-between cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:border-blue-500 transition-all ${opt.checked ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200'}">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${opt.checked ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-500'} flex items-center justify-center transition-colors duration-200">
                        <i class="fa-solid ${opt.icon}"></i>
                    </div>
                    <span class="flex flex-col text-left">
                        <span class="text-sm font-medium text-gray-900">${opt.label}</span>
                        <span class="text-xs text-gray-500 mt-0.5">${opt.desc}</span>
                    </span>
                </div>
                <div class="ml-3 flex items-center h-5">
                    <input type="radio" name="parsing-strategy" value="${opt.value}" class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none" ${opt.checked ? 'checked' : ''} tabindex="-1">
                </div>
            </div>
        `).join('') + `</div>`;
    } else {
        parsingSection.classList.add('hidden');
    }

    // Chunking Section
    const chunkingSection = document.getElementById('section-chunking');
    let chunkingOptions = document.getElementById('chunking-options');
    
    if (config.chunking && config.chunking.length > 0) {
        chunkingSection.classList.remove('hidden');
        const chunkingHTML = `<div id="chunking-options" class="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="切片策略">` + 
            config.chunking.map(opt => `
            <div role="radio" aria-checked="${opt.checked ? 'true' : 'false'}" tabindex="${opt.checked ? '0' : '-1'}" data-value="${opt.value}" data-group="chunking-strategy" class="strategy-card relative flex h-full items-center justify-between cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:border-blue-500 transition-all ${opt.checked ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200'}">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${opt.checked ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-500'} flex items-center justify-center transition-colors duration-200">
                        <i class="fa-solid ${opt.icon}"></i>
                    </div>
                    <span class="flex flex-col text-left">
                        <span class="text-sm font-medium text-gray-900 inline-flex items-center">
                            ${opt.label}
                            ${renderChunkingTipInline(opt.value)}
                        </span>
                        <span class="text-xs text-gray-500 mt-0.5">${opt.desc}</span>
                    </span>
                </div>
                <div class="ml-3 flex items-center h-5 relative">
                    <input type="radio" name="chunking-strategy" value="${opt.value}" class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none" ${opt.checked ? 'checked' : ''} tabindex="-1">
                </div>
            </div>
        `).join('') + `</div>`;
        
        chunkingOptions.outerHTML = chunkingHTML;
        chunkingOptions = document.getElementById('chunking-options'); // re-acquire reference
        

        // Check if custom or chapter is selected by default and inject
        const customOrChapterSelected = config.chunking.find(c => (c.value === 'custom' || c.value === 'chapter') && c.checked);
        if (customOrChapterSelected) {
             chunkingOptions.insertAdjacentHTML('beforeend', window.getCustomChunkConfigHTML('strategy'));
             
             // Handle initial state for chapter strategy
             if (customOrChapterSelected.value === 'chapter') {
                 setTimeout(() => {
                     const titleCheckbox = document.getElementById('strategy-preprocess-title');
                     if (titleCheckbox) {
                         titleCheckbox.checked = true;
                         titleCheckbox.disabled = true;
                         titleCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                     }
                     const filenameCheckbox = document.getElementById('strategy-preprocess-filename');
                     if (filenameCheckbox) {
                         filenameCheckbox.checked = true;
                         filenameCheckbox.disabled = true;
                         filenameCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                     }
                 }, 0);
             }
        }
        
        // Re-initialize selection groups for dynamically injected content
        initSelectionGroups();
    } else {
        chunkingSection.classList.add('hidden');
    }

    // Enhancement Section (Always visible per requirements, but items might be same)
    const enhancementContainer = document.getElementById('enhancement-options');
    if (enhancementContainer && config.enhancement) {
        const enhancementTipMap = {
            // 现在“问题生成”即“问句生成”
            qa_pure: {
                title: '问题生成',
                desc: '基于每个切片内容，生成多个符合用户自然提问习惯的问句（口语化表达），问题需覆盖该切片的核心语义范围，且不超出原文信息。',
                effect: '通过构造“用户可能的提问方式”，将切片内容扩展为多种表达形式，在向量化时参与 embedding，提升与用户 Query 的语义匹配概率。',
                scene: [
                    '用户提问方式多样（口语化强，如人事咨询）',
                    '文档为制度/规范类（表达正式，与用户语言差异大）',
                    '检索存在“搜不到”的问题（Recall 低）'
                ]
            },
            keywords: {
                title: '关键字生成',
                desc: '基于每个切片内容，提取核心词汇、专业术语、关键实体等关键信息，并按语义重要性进行筛选，用于强化该切片的语义表达。',
                effect: '将关键词作为高权重语义信号，与原文共同参与 embedding，使模型在相似度计算时更容易捕捉核心概念，从而提升匹配效率。',
                scene: [
                    '文档中存在大量专业术语（如人事、财务、法务）',
                    '用户 Query 以“关键词”为主（如：年假 天数 结转）',
                    '需要提升检索速度与命中稳定性'
                ]
            },
            summary: {
                title: '摘要生成',
                desc: '基于每个切片内容，提炼出简洁、完整的核心语义表达（通常为 1~2 句），用于概括该切片的关键信息。',
                effect: '通过压缩原始内容中的冗余信息，提升语义密度，使 embedding 更聚焦核心语义，从而提高检索匹配的准确性与稳定性。',
                scene: [
                    '原文较长或包含大量解释性内容（如制度文档、PDF）',
                    '单个切片信息密度低（重点被稀释）',
                    '检索命中不稳定（有时命中，有时不命中）'
                ]
            }
        };

        // 提示浮窗改为“全局 fixed tooltip”，避免被父容器 overflow-hidden 裁剪
        window.__enhancementTipMap = enhancementTipMap;
        if (!window.__ehGlobalTipBound) {
            window.__ehGlobalTipBound = true;

            const ensureTipEl = () => {
                let el = document.getElementById('global-enhancement-tip');
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'global-enhancement-tip';
                    // 用 style 强制 fixed + 超高层级，避免被任何 section/容器裁剪或层级覆盖
                    el.className = '';
                    el.style.position = 'fixed';
                    el.style.left = '0px';
                    el.style.top = '0px';
                    el.style.zIndex = '2147483647';
                    el.style.display = 'none';
                    el.innerHTML = `
                        <div class="pointer-events-none w-[420px]">
                            <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900/95 border border-white/10"></div>
                            <div class="relative rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl p-4 max-h-80 overflow-auto">
                                <div data-eh-tip-title class="text-sm font-semibold text-white">说明</div>
                                <div data-eh-tip-desc class="mt-1 text-xs leading-relaxed text-slate-200"></div>
                                <div class="mt-3 pt-3 border-t border-white/10">
                                    <div class="text-xs font-semibold text-slate-100">作用</div>
                                    <div data-eh-tip-effect class="mt-1 text-xs leading-relaxed text-slate-200"></div>
                                </div>
                                <div class="mt-3 pt-3 border-t border-white/10">
                                    <div class="text-xs font-semibold text-slate-100">适用场景</div>
                                    <div data-eh-tip-scene class="mt-1"></div>
                                </div>
                            </div>
                        </div>
                    `;
                    (document.documentElement || document.body).appendChild(el);
                }
                return el;
            };

            const fillTip = (el, info) => {
                el.querySelector('[data-eh-tip-desc]').textContent = info?.desc || '';
                el.querySelector('[data-eh-tip-effect]').textContent = info?.effect || '—';
                const sceneWrap = el.querySelector('[data-eh-tip-scene]');
                const scenes = Array.isArray(info?.scene) ? info.scene : [];
                if (scenes.length) {
                    sceneWrap.innerHTML = `<ul class="space-y-1 text-xs leading-relaxed text-slate-200 list-disc list-inside">${scenes.map(s => `<li>${s}</li>`).join('')}</ul>`;
                } else {
                    sceneWrap.innerHTML = `<div class="text-xs leading-relaxed text-slate-200">—</div>`;
                }
            };

            const positionTip = (el, rect) => {
                const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
                const tipW = 420;
                const margin = 16;
                let left = rect.left + rect.width / 2;
                left = Math.max(margin + tipW / 2, Math.min(vw - margin - tipW / 2, left));
                const top = rect.bottom + 10;
                el.style.transform = `translate(-50%, 0)`;
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            };

            let hideTimer = null;
            const show = (triggerEl) => {
                const key = triggerEl.getAttribute('data-eh-tip');
                const info = window.__enhancementTipMap?.[key];
                if (!info) return;
                const tipEl = ensureTipEl();
                if (hideTimer) window.clearTimeout(hideTimer);
                fillTip(tipEl, info);
                positionTip(tipEl, triggerEl.getBoundingClientRect());
                tipEl.style.display = 'block';
            };
            const hide = () => {
                const tipEl = document.getElementById('global-enhancement-tip');
                if (!tipEl) return;
                tipEl.style.display = 'none';
            };

            document.addEventListener('mouseover', (e) => {
                const t = e.target?.closest?.('[data-eh-tip]');
                if (t) show(t);
            });
            document.addEventListener('mouseout', (e) => {
                const t = e.target?.closest?.('[data-eh-tip]');
                if (t) {
                    if (hideTimer) window.clearTimeout(hideTimer);
                    hideTimer = window.setTimeout(hide, 80);
                }
            });
            window.addEventListener('scroll', () => hide(), true);
            window.addEventListener('resize', () => hide());
        }

        const renderEnhancementTipIcon = (key) => {
            return `
                <i data-eh-tip="${key}" class="fa-solid fa-circle-info ml-1.5 text-[11px] text-gray-400 hover:text-purple-600 transition-colors"></i>
            `;
        };

        // 简化：仅保留母选项（去掉“基于文件生成”等子选项，不展开），并为每个标题增加说明 icon
        enhancementContainer.innerHTML = `
            <div class="enhancement-group border border-gray-200 rounded-lg bg-white overflow-hidden transition-all duration-200 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                <label class="relative flex items-center justify-between cursor-pointer p-4 group" tabindex="0" role="checkbox" aria-checked="false" onkeydown="handleEnhancementKeydown(event, this)">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:bg-purple-100 transition-colors">
                            <i class="fa-solid fa-circle-question"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-gray-900 inline-flex items-center">问题生成${renderEnhancementTipIcon('qa_pure')}</span>
                    </div>
                    <div class="ml-3 flex items-center h-5">
                        <input id="enhance-qa-chunk" type="checkbox" name="enhancement" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            onchange="const l=this.closest('label'); l.classList.toggle('bg-purple-50', this.checked); l.setAttribute('aria-checked', this.checked?'true':'false');">
                    </div>
                </label>
            </div>

            <div class="enhancement-group border border-gray-200 rounded-lg bg-white overflow-hidden transition-all duration-200 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                <label class="relative flex items-center justify-between cursor-pointer p-4 group" tabindex="0" role="checkbox" aria-checked="false" onkeydown="handleEnhancementKeydown(event, this)">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:bg-purple-100 transition-colors">
                            <i class="fa-solid fa-tags"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-gray-900 inline-flex items-center">关键字生成${renderEnhancementTipIcon('keywords')}</span>
                    </div>
                    <div class="ml-3 flex items-center h-5">
                        <input id="enhance-kw-chunk" type="checkbox" name="enhancement" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            onchange="const l=this.closest('label'); l.classList.toggle('bg-purple-50', this.checked); l.setAttribute('aria-checked', this.checked?'true':'false');">
                    </div>
                </label>
            </div>

            <div class="enhancement-group border border-gray-200 rounded-lg bg-white overflow-hidden transition-all duration-200 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                <label class="relative flex items-center justify-between cursor-pointer p-4 group" tabindex="0" role="checkbox" aria-checked="false" onkeydown="handleEnhancementKeydown(event, this)">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:bg-purple-100 transition-colors">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-gray-900 inline-flex items-center">摘要生成${renderEnhancementTipIcon('summary')}</span>
                    </div>
                    <div class="ml-3 flex items-center h-5">
                        <input id="enhance-sum-chunk" type="checkbox" name="enhancement" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            onchange="const l=this.closest('label'); l.classList.toggle('bg-purple-50', this.checked); l.setAttribute('aria-checked', this.checked?'true':'false');">
                    </div>
                </label>
            </div>
        `;
    }
}

window.validateHeaderRow = function(input) {
    const val = Number(input.value);
    const errorEl = document.getElementById('header-row-error');
    const confirmBtn = document.querySelector('button[onclick="window.saveStrategyConfig()"]');
    
    // Check if empty, not integer, or out of range
    let isValid = true;
    if (input.value.trim() === '' || isNaN(val) || !Number.isInteger(val) || val < 1 || val > 50) {
        isValid = false;
    }

    if (!isValid) {
        if (errorEl) errorEl.classList.remove('hidden');
        input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.remove('border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500');
        if(confirmBtn) confirmBtn.disabled = true;
        // Mock preview update for invalid state (optional)
    } else {
        if (errorEl) errorEl.classList.add('hidden');
        input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.add('border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500');
        if(confirmBtn) confirmBtn.disabled = false;
        
        // Update Preview Area (Mock Implementation)
        // Since there is no actual preview area DOM, we log this action.
        console.log(`Preview updated: Row ${val} is now highlighted as header.`);
        
        // If there were a preview table, we would do something like:
        // const rows = document.querySelectorAll('#preview-table tr');
        // rows.forEach((r, i) => {
        //    if (i === val - 1) r.classList.add('bg-gray-200', 'font-bold');
        //    else r.classList.remove('bg-gray-200', 'font-bold');
        // });
    }
};

window.updateCheckboxSelection = function(label) {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
        label.classList.remove('border-gray-200');
        label.classList.add('border-blue-600', 'ring-1', 'ring-blue-600', 'bg-blue-50');
    } else {
        label.classList.remove('border-blue-600', 'ring-1', 'ring-blue-600', 'bg-blue-50');
        label.classList.add('border-gray-200');
    }
};

window.toggleEnhancementGroup = function(parentCheckbox) {
    const group = parentCheckbox.closest('.enhancement-group');
    const childrenContainer = group.querySelector('.children-container');
    const childCheckboxes = group.querySelectorAll('.child-checkbox');
    const parentLabel = group.querySelector('label');

    const isChecked = parentCheckbox.checked;
    
    // Update parent style
    if (isChecked) {
        parentLabel.classList.add('bg-purple-50');
        parentLabel.setAttribute('aria-checked', 'true');
    } else {
        parentLabel.classList.remove('bg-purple-50');
        parentLabel.setAttribute('aria-checked', 'false');
    }

    // Toggle children visibility
    if (isChecked || parentCheckbox.indeterminate) {
        childrenContainer.classList.remove('grid-rows-[0fr]', 'opacity-0');
        childrenContainer.classList.add('grid-rows-[1fr]', 'opacity-100');
    } else {
        childrenContainer.classList.remove('grid-rows-[1fr]', 'opacity-100');
        childrenContainer.classList.add('grid-rows-[0fr]', 'opacity-0');
    }

    // Update children checkboxes
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

    // Update child style
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
        
        // Auto collapse if all children are unchecked
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

window.handleEnhancementKeydown = function(event, label) {
    if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            // Trigger change event manually
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
        }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const allLabels = Array.from(document.querySelectorAll('.enhancement-group label'));
        const currentIndex = allLabels.indexOf(label);
        let nextIndex;
        
        if (event.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % allLabels.length;
        } else {
            nextIndex = (currentIndex - 1 + allLabels.length) % allLabels.length;
        }
        
        allLabels[nextIndex].focus();
    }
};

window.updateRadioSelection = function(label) {
    // Ensure we have the container or global group
    const radio = label.querySelector('input[type="radio"]');
    if (!radio) return;
    
    const name = radio.name;
    const allRadios = document.querySelectorAll(`input[name="${name}"]`);
    
    allRadios.forEach(r => {
        const lbl = r.closest('label');
        if (lbl) {
            if (r.checked) {
                lbl.classList.remove('border-gray-200');
                lbl.classList.add('border-blue-600', 'ring-1', 'ring-blue-600');
                
                // Handle Custom Config Toggle (Specific to Chunking)
                if (r.name === 'chunking-strategy') {
                    const chunkingContainer = document.getElementById('chunking-options');
                    let customConfig = document.getElementById('strategy-custom-chunk-config');
                    let preprocessExtra = document.getElementById('strategy-preprocess-extra-config');
                    
                    if (r.value === 'custom' || r.value === 'chapter') {
                        if (preprocessExtra) preprocessExtra.remove();
                        if (!customConfig && chunkingContainer) {
                            chunkingContainer.insertAdjacentHTML('beforeend', window.getCustomChunkConfigHTML('strategy'));
                            customConfig = document.getElementById('strategy-custom-chunk-config'); // Get reference
                        }
                        
                        // Toggle Title Level Visibility
                        const titleLevelGroup = document.getElementById('strategy-config-group-title-level');
                        if (titleLevelGroup) {
                            if (r.value === 'custom') {
                                titleLevelGroup.classList.add('hidden');
                            } else {
                                titleLevelGroup.classList.remove('hidden');
                            }
                        }
                        
                        // "按章节切片" 默认选中并禁用“关联标题及子标题”与“关联文件名”
                        const titleCheckbox = document.getElementById('strategy-preprocess-title');
                        const filenameCheckbox = document.getElementById('strategy-preprocess-filename');
                        if (titleCheckbox) {
                            if (r.value === 'chapter') {
                                titleCheckbox.checked = true;
                                titleCheckbox.disabled = true;
                                titleCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                            } else {
                                titleCheckbox.disabled = false;
                                titleCheckbox.parentElement.classList.remove('opacity-60', 'cursor-not-allowed');
                            }
                        }
                        if (filenameCheckbox) {
                            if (r.value === 'chapter') {
                                filenameCheckbox.checked = true;
                                filenameCheckbox.disabled = true;
                                filenameCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                            } else {
                                filenameCheckbox.disabled = false;
                                filenameCheckbox.parentElement.classList.remove('opacity-60', 'cursor-not-allowed');
                            }
                        }
                    } else {
                        if (customConfig) {
                            customConfig.remove();
                        }
                        // “按页切片 / 整文件切片”下展示：文本预处理规则 + 关联信息
                        if (r.value === 'page' || r.value === 'whole') {
                            if (!preprocessExtra && chunkingContainer) {
                                chunkingContainer.insertAdjacentHTML('beforeend', window.getTextPreprocessConfigHTML('strategy'));
                                preprocessExtra = document.getElementById('strategy-preprocess-extra-config');
                            }

                            // 仅“整文件切片”删除“关联标题及子标题”（按页切片需要恢复显示）
                            const titleRow = preprocessExtra ? preprocessExtra.querySelector('#strategy-preprocess-title-row') : null;
                            const filenameRow = preprocessExtra ? preprocessExtra.querySelector('#strategy-preprocess-filename-row') : null;
                            if (r.value === 'whole') {
                                if (titleRow) titleRow.remove();
                            } else {
                                if (!titleRow && filenameRow) {
                                    filenameRow.insertAdjacentHTML('afterend', `
            <div class="flex items-center gap-2" id="strategy-preprocess-title-row">
                <input id="strategy-preprocess-title" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="strategy-preprocess-title" class="text-xs text-gray-600">关联标题及子标题</label>
            </div>
                                    `.trim());
                                }
                            }
                        } else {
                            if (preprocessExtra) preprocessExtra.remove();
                        }
                    }
                }
            } else {
                lbl.classList.remove('border-blue-600', 'ring-1', 'ring-blue-600');
                lbl.classList.add('border-gray-200');
            }
        }
    });
};

window.cancelStrategyConfig = function() {
    if (confirm('确定要取消配置吗？未保存的更改将丢失。')) {
        goBackToKnowledgeList();
    }
};

// 进入“模板修改”模式时隐藏策略配置页的【确认】按钮
window.updateStrategyConfigConfirmVisibility = function() {
    const btn = document.getElementById('btn-confirm-strategy-config') || document.querySelector('button[onclick="window.saveStrategyConfig()"]');
    if (!btn) return;
    if (window.currentEditingTemplateId) btn.classList.add('hidden');
    else btn.classList.remove('hidden');
};

window.saveStrategyConfig = function() {
    // Collect data
    const type = window.currentStrategyType;
    let parsing = document.querySelector('input[name="parsing-strategy"]:checked')?.value;
    
    if (type === 'table') {
        const headerRowInput = document.getElementById('header-row-input');
        if (headerRowInput) {
            // Validate one last time
             const val = Number(headerRowInput.value);
             if (isNaN(val) || val < 1 || val > 50) {
                 if(window.showToast) window.showToast('请输入有效的表头行号(1-50)', 'error');
                 return;
             }
            parsing = { headerRow: val };
        }
    }

    const chunking = document.querySelector('input[name="chunking-strategy"]:checked')?.value;
    // 切片策略必填：当页面存在切片策略选项时必须选择
    const chunkRadios = document.querySelectorAll('input[name="chunking-strategy"]');
    if (chunkRadios && chunkRadios.length > 0 && !chunking) {
        if (window.showToast) window.showToast('请选择切片策略', 'error');
        return;
    }
    const enhancements = Array.from(document.querySelectorAll('input[name="enhancement"]:checked')).map(el => el.id.replace('enhance-', ''));

    // Validate (Simple check)
    if (!type) {
        if(window.showToast) window.showToast('请选择数据类型', 'error');
        return;
    }
    
    // Simulate API call
    const btn = event.currentTarget; // Get button reference
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 保存中...';

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if(window.showToast) window.showToast('策略配置已保存', 'success');
        
        // Go back to file list
        goBackToKnowledgeList(); 
    }, 1000);
};

window.saveTemplateConfig = function() {
    // Template logic (placeholder)
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 保存中...';

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if(window.showToast) window.showToast('模版配置已保存', 'success');
        
        // Go back to file list
        goBackToKnowledgeList();
    }, 1000);
};

// Initialize default view
window.initStrategyConfigContent = function() {
    const doc = Array.isArray(mockDocs) && strategyConfigDocId ? mockDocs.find(d => d && d.id === strategyConfigDocId) : null;
    let type = doc && doc.strategyConfig && doc.strategyConfig.type ? doc.strategyConfig.type : null;
    if (!type && doc && typeof doc.type === 'string') {
        type = doc.type === 'Excel' ? 'table' : 'text';
    }
    selectStrategyType(type || 'text');

    setTimeout(() => {
        const currentDoc = Array.isArray(mockDocs) && strategyConfigDocId ? mockDocs.find(d => d && d.id === strategyConfigDocId) : null;
        const cfg = currentDoc && currentDoc.strategyConfig ? currentDoc.strategyConfig : null;
        if (!cfg) return;

        if (cfg.parsing && typeof cfg.parsing === 'object') {
            const v = cfg.parsing.value;
            if (typeof v === 'string' && v.startsWith('headerRow:') && window.currentStrategyType === 'table') {
                const m = v.match(/headerRow:(\d+)/);
                const headerRow = m ? Number(m[1]) : null;
                const input = document.getElementById('header-row-input');
                if (input && headerRow) input.value = String(headerRow);
            } else if (typeof v === 'string') {
                const input = document.querySelector(`input[name="parsing-strategy"][value="${cssEscapeValue(v)}"]`);
                if (input) {
                    input.checked = true;
                    const card = input.closest('.strategy-card') || input.closest('label');
                    if (card) {
                        if (card.classList.contains('strategy-card')) {
                            const group = card.closest('[role="radiogroup"]');
                            if (group) {
                                const allItems = Array.from(group.querySelectorAll('[role="radio"]'));
                                handleItemSelect(group, card, allItems, false, true);
                            }
                        } else {
                            window.updateRadioSelection(card);
                        }
                    }
                }
            }
        }

        if (cfg.chunking && typeof cfg.chunking === 'object') {
            const v = cfg.chunking.value;
            if (typeof v === 'string') {
                const input = document.querySelector(`input[name="chunking-strategy"][value="${cssEscapeValue(v)}"]`);
                if (input) {
                    input.checked = true;
                    const card = input.closest('.strategy-card') || input.closest('label');
                    if (card) {
                        if (card.classList.contains('strategy-card')) {
                            const group = card.closest('[role="radiogroup"]');
                            if (group) {
                                const allItems = Array.from(group.querySelectorAll('[role="radio"]'));
                                handleItemSelect(group, card, allItems, false, true);
                            }
                        } else {
                            window.updateRadioSelection(card);
                        }
                    }
                }
            }
        }

        if (Array.isArray(cfg.enhancements)) {
            cfg.enhancements.forEach(id => {
                const el = document.getElementById(`enhance-${id}`);
                if (el) {
                    el.checked = true;
                    const lbl = el.closest('label');
                    if (lbl && typeof window.updateCheckboxSelection === 'function') window.updateCheckboxSelection(lbl);
                }
            });
        }
    }, 0);
};

// --- Template Tab Implementation ---

window.isTemplatesLoaded = false;
window.TEMPLATE_DATA = {
    general: [
        { id: 't1', name: '论文', icon: 'fa-book' },
        { id: 't2', name: '合同', icon: 'fa-file-contract' }
    ],
    custom: [
        { id: 'c1', name: '名称1', icon: 'fa-file-lines' },
        { id: 'c2', name: '名称2', icon: 'fa-file-lines' }
    ],
    customized: [
        { id: 'z1', name: '工艺图文档', icon: 'fa-compass-drafting' }
    ]
};

window.initTemplateTab = function() {
    // Show skeleton loading state
    renderTemplateLoading();
    
    // Simulate API Fetch
    setTimeout(() => {
        window.isTemplatesLoaded = true;
        renderTemplateColumns();
    }, 800);
};

window.renderTemplateLoading = function() {
    const ids = [
        'template-list-general',
        'template-list-custom',
        'template-list-customized',
        'modal-template-list-general',
        'modal-template-list-custom',
        'modal-template-list-customized'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = Array(3).fill(0).map(() => `
                <div class="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white animate-pulse">
                    <div class="w-8 h-8 rounded-lg bg-gray-200"></div>
                    <div class="h-4 bg-gray-200 rounded w-24"></div>
                </div>
            `).join('');
        }
    });
};

window.renderTemplateColumns = function() {
    // Main page containers
    renderTemplateList('general', window.TEMPLATE_DATA.general, false, 'template-list-general', '');
    renderTemplateList('custom', window.TEMPLATE_DATA.custom, true, 'template-list-custom', '');
    renderTemplateList('customized', window.TEMPLATE_DATA.customized, false, 'template-list-customized', '');

    // Wizard modal containers
    renderTemplateList('general', window.TEMPLATE_DATA.general, false, 'modal-template-list-general', 'modal-');
    renderTemplateList('custom', window.TEMPLATE_DATA.custom, true, 'modal-template-list-custom', 'modal-');
    renderTemplateList('customized', window.TEMPLATE_DATA.customized, false, 'modal-template-list-customized', 'modal-');
};

window.renderTemplateList = function(type, items, deletable = false, containerElId = null, idPrefix = '') {
    const container = document.getElementById(containerElId || `template-list-${type}`);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 min-h-[100px] col-span-full border border-gray-100 rounded-lg bg-white/50 border-dashed">
                <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                    <i class="fa-regular fa-folder-open text-lg"></i>
                </div>
                <span class="text-xs">暂无模板</span>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div 
            class="template-card relative group cursor-pointer outline-none rounded-xl" 
            role="button" 
            tabindex="0" 
            aria-selected="${window.selectedTemplateId === item.id}"
            data-id="${item.id}"
            onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleTemplateClick('${item.id}', '${type}'); }"
            onclick="handleTemplateClick('${item.id}', '${type}')">
            
            <div class="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 h-full ${window.selectedTemplateId === item.id ? 'border-blue-600 ring-2 ring-blue-600 bg-blue-50' : 'hover:border-blue-300 hover:bg-blue-50/30'}">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${window.selectedTemplateId === item.id ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}">
                    <i class="fa-solid ${item.icon} text-lg"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 id="${idPrefix}title-${item.id}" class="text-sm font-bold text-gray-900 truncate group-hover:text-blue-700 transition-colors">${item.name}</h4>
                </div>
                
                ${deletable ? `
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button id="${idPrefix}btn-edit-${item.id}" onclick="event.stopPropagation(); toggleEditTemplate('${item.id}', '${idPrefix}')" class="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="编辑名称">
                        <i class="fa-regular fa-pen-to-square text-sm"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.editTemplateConfig('${item.id}', '${idPrefix}')" class="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all" title="编辑配置">
                        <i class="fa-solid fa-sliders text-sm"></i>
                    </button>
                    <button onclick="event.stopPropagation(); handleDeleteTemplate('${item.id}')" class="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="删除模板">
                        <i class="fa-regular fa-trash-can text-sm"></i>
                    </button>
                </div>
                ` : ''}
                
                <!-- Selection Indicator -->
                <div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 transition-opacity duration-200 ${window.selectedTemplateId === item.id ? 'opacity-100' : 'opacity-0'}"></div>
            </div>
        </div>
    `).join('');
};

window.editingTemplateMeta = null;

window.toggleEditTemplate = function(id, idPrefix = '') {
    const titleEl = document.getElementById(`${idPrefix}title-${id}`);
    const btnEl = document.getElementById(`${idPrefix}btn-edit-${id}`);
    if (!titleEl || !btnEl) return;
    const iconEl = btnEl.querySelector('i');
    
    const isSameContext = window.editingTemplateMeta && window.editingTemplateMeta.id === id && window.editingTemplateMeta.idPrefix === idPrefix;
    
    if (isSameContext) {
        // Save
        const newName = titleEl.innerText.trim();
        if (newName) {
            // Simulate API Call
            const template = window.TEMPLATE_DATA.custom.find(t => t.id === id);
            if (template) {
                template.name = newName;
                if(window.showToast) window.showToast('模板名称已更新', 'success');
            }
            
            // Exit Edit Mode
            titleEl.contentEditable = "false";
            titleEl.classList.remove('ring-1', 'ring-blue-500', 'px-1', 'bg-white', 'cursor-text');
            iconEl.className = 'fa-regular fa-pen-to-square text-sm';
            btnEl.title = '编辑名称';
            btnEl.classList.remove('text-green-600', 'bg-green-50');
            window.editingTemplateMeta = null;
        } else {
             if(window.showToast) window.showToast('模板名称不能为空', 'error');
             titleEl.focus();
        }
    } else {
        // Enter Edit Mode
        // Reset any other editing
        if (window.editingTemplateMeta) {
             // Cancel previous edit for simplicity
             const prevMeta = window.editingTemplateMeta;
             const prevTitle = document.getElementById(`${prevMeta.idPrefix}title-${prevMeta.id}`);
             const prevBtn = document.getElementById(`${prevMeta.idPrefix}btn-edit-${prevMeta.id}`);
             if(prevTitle && prevBtn) {
                 prevTitle.contentEditable = "false";
                 prevTitle.innerText = window.TEMPLATE_DATA.custom.find(t => t.id === prevMeta.id)?.name || prevTitle.innerText; // Revert
                 prevTitle.classList.remove('ring-1', 'ring-blue-500', 'px-1', 'bg-white', 'cursor-text');
                 prevBtn.querySelector('i').className = 'fa-regular fa-pen-to-square text-sm';
                 prevBtn.classList.remove('text-green-600', 'bg-green-50');
             }
        }
        
        window.editingTemplateMeta = { id, idPrefix };
        titleEl.contentEditable = "true";
        titleEl.classList.add('ring-1', 'ring-blue-500', 'rounded', 'px-1', 'bg-white', 'cursor-text');
        titleEl.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Change Icon to Save
        iconEl.className = 'fa-solid fa-check text-sm';
        btnEl.title = '保存修改';
        btnEl.classList.add('text-green-600', 'bg-green-50');
        
        // Add listeners for Enter/Esc
        titleEl.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                toggleEditTemplate(id, idPrefix); // Trigger Save
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Cancel (revert to original name and exit edit mode)
                titleEl.innerText = window.TEMPLATE_DATA.custom.find(t => t.id === id)?.name || '';
                toggleEditTemplate(id, idPrefix);
            }
            e.stopPropagation(); // Prevent card selection
        };
        titleEl.onclick = function(e) { e.stopPropagation(); }
    }
};

window.handleTemplateRename = null; // Remove old function

window.editTemplateConfig = function(id, idPrefix) {
    const template = window.TEMPLATE_DATA.custom.find(t => t.id === id);
    if (!template) return;
    
    // Switch to config panel
    window.currentEditingTemplateId = id;
    window.updateStrategyConfigConfirmVisibility();
    
    // Jump to config page (Strategy Tab)
    if (typeof switchStrategyTab === 'function') {
        switchStrategyTab('file-type');
    }
    
    // If in wizard, switch its mode too
    if (typeof switchConfigMode === 'function') {
        switchConfigMode('fileType');
    }
    
    // Set UI to indicate we are editing a template
    if(window.showToast) window.showToast(`正在编辑模板: ${template.name}`, 'info');
    
    // Backfill configuration
    if (template.config) {
        // Mock backfill process
        const config = template.config;
        if (config.type) {
            handleDataTypeChange(config.type);
        }
        
        // Wait for type change to apply DOM updates
        setTimeout(() => {
            const selectOption = (name, value) => {
                const input = document.querySelector(`input[name="${name}"][value="${value}"]`) || document.querySelector(`input[name="${name.replace('Strategy', '-strategy')}"][value="${value}"]`);
                if (input) {
                    input.checked = true;
                    if (input.closest('.strategy-card')) {
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    return true;
                }
                
                const divGroup = name === 'parseStrategy' ? 'parsing-strategy' : (name === 'sliceStrategy' ? 'chunking-strategy' : name);
                const div = document.querySelector(`div[data-group="${divGroup}"][data-value="${value}"]`);
                if (div) {
                    // Simulate click to trigger handleItemSelect which handles visual updates and events
                    div.click();
                    return true;
                }
                return false;
            };

            if (config.parsing) {
                selectOption('parseStrategy', config.parsing);
            }
            if (config.chunking) {
                const chunkInput = document.querySelector(`input[name="sliceStrategy"][value="${config.chunking}"]`) || document.querySelector(`input[name="chunking-strategy"][value="${config.chunking}"]`);
                if (chunkInput) {
                    chunkInput.checked = true;
                    if (chunkInput.closest('.strategy-card')) {
                        chunkInput.dispatchEvent(new Event('change', { bubbles: true }));
                        if (typeof handleSliceStrategyChange === 'function') {
                            handleSliceStrategyChange(chunkInput);
                        }
                    }
                } else {
                    const selected = selectOption('sliceStrategy', config.chunking);
                    if (selected && typeof handleSliceStrategyChange === 'function') {
                        handleSliceStrategyChange(config.chunking);
                    }
                }
            }
            if (config.enhancements && Array.isArray(config.enhancements)) {
                // Clear all first
                document.querySelectorAll('input[name="enhancement"]').forEach(cb => {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
                // Check saved ones
                config.enhancements.forEach(enh => {
                    const cb = document.getElementById(`enhance-${enh}`);
                    if (cb) {
                        cb.checked = true;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
            
            // Change "保存至模版" / "应用" button text/behavior to "保存修改"
            const saveBtn = document.getElementById('btn-save-as-template');
            if (saveBtn) {
                // The text node is inside the button, maybe after an <i> tag
                saveBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> 保存模板修改';
                saveBtn.onclick = function(e) {
                    if (e) e.preventDefault();
                    if (saveBtn.disabled) return; // Prevent click if disabled
                    window.saveTemplateModifications(id);
                };
            }
            const batchBtn = document.getElementById('btn-save-batch-slice');
            if (batchBtn) {
                const span = batchBtn.querySelector('span');
                if (span) span.innerText = '保存模板修改';
                batchBtn.onclick = function(e) {
                    if (e) e.preventDefault();
                    if (batchBtn.disabled) return; // Prevent click if disabled
                    window.saveTemplateModifications(id);
                };
            }
            
            // Add a floating bar or modal to choose sync strategy when saving
            // (Will implement later in saveTemplateModifications)
        }, 300);
    }
};

window.saveTemplateModifications = function(id) {
    // Open sync strategy modal
    openTemplateSyncModal(id);
};

window.openTemplateSyncModal = function(id) {
    const template = window.TEMPLATE_DATA.custom.find(t => t.id === id);
    if (!template) return;

    // Collect Current Configuration from UI
    const type = window.currentStrategyType;
    
    // Support both input[type="radio"] and div[role="radio"]
    const getStrategyValue = (name) => {
        const input = document.querySelector(`input[name="${name}"]:checked`);
        if (input) return input.value;
        const div = document.querySelector(`div[data-group="${name}"][aria-checked="true"]`);
        if (div) return div.getAttribute('data-value');
        return undefined;
    };

    let parsing = getStrategyValue('parsing-strategy') || getStrategyValue('parseStrategy');
    if (type === 'table') {
        const headerRowInput = document.getElementById('header-row-input');
        if (headerRowInput) parsing = { headerRow: headerRowInput.value };
    }
    const chunking = getStrategyValue('chunking-strategy') || getStrategyValue('sliceStrategy');
    const enhancements = Array.from(document.querySelectorAll('input[name="enhancement"]:checked')).map(el => el.id.replace('enhance-', '')).filter(Boolean);
    
    // 8) Validate params before proceeding
    if (!chunking && type !== 'image') {
        if(window.showToast) window.showToast('参数验证失败：请选择切片策略', 'error');
        return;
    }
    
    const newConfig = { type, parsing, chunking, enhancements };
    const oldConfig = template.config || {};
    
    // Generate Diff text
    const typeMap = { text: '纯文本', table: '表格', image: '图片' };
    const parseMap = { ocr: '图片文字识别 (OCR)', vlm: '图片理解 (VLM)' };
    const chunkMap = { custom: '自定义切片', chapter: '按章节切片', page: '按页切片', whole: '整文件切片' };
    const enhMap = {
        'qa-file': '基于文件生成问题', 'qa-chunk': '基于切片生成问题',
        'kw-file': '基于文件生成关键字', 'kw-chunk': '基于切片生成关键字',
        'sum-file': '基于文件生成摘要', 'sum-chunk': '基于切片生成摘要'
    };

    const getTypeName = (val) => typeMap[val] || val || '无';
    const getParseName = (val) => {
        if (!val) return '无';
        if (typeof val === 'object' && val.headerRow) return `表头第${val.headerRow}行`;
        return parseMap[val] || val;
    };
    const getChunkName = (val) => chunkMap[val] || val || '无';
    const getEnhNames = (arr) => {
        if (!arr || arr.length === 0) return '无';
        return arr.filter(Boolean).map(e => enhMap[e] || e).join('、');
    };

    const diffLines = [];
    if (oldConfig.type !== newConfig.type) {
        diffLines.push(`类型: ${getTypeName(oldConfig.type)} -> ${getTypeName(newConfig.type)}`);
    }
    if (JSON.stringify(oldConfig.parsing) !== JSON.stringify(newConfig.parsing)) {
        diffLines.push(`解析策略: ${getParseName(oldConfig.parsing)} -> ${getParseName(newConfig.parsing)}`);
    }
    if (oldConfig.chunking !== newConfig.chunking) {
        diffLines.push(`切片策略: ${getChunkName(oldConfig.chunking)} -> ${getChunkName(newConfig.chunking)}`);
    }
    const oldEnhStr = getEnhNames(oldConfig.enhancements);
    const newEnhStr = getEnhNames(newConfig.enhancements);
    if (oldEnhStr !== newEnhStr) {
        diffLines.push(`知识增强: [${oldEnhStr}] -> [${newEnhStr}]`);
    }
    
    const diffContainer = document.getElementById('template-diff-container');
    if (diffLines.length === 0) {
        diffContainer.innerHTML = '<span class="text-gray-500">未检测到任何参数修改。</span>';
    } else {
        diffContainer.innerHTML = diffLines.map(line => `<div class="text-blue-700">${line}</div>`).join('');
    }

    // Store for saving
    window.currentSyncTemplateData = {
        id,
        newConfig,
        oldConfig
    };

    // Find affected files (Mock)
    const docsToSearch = window.KNOWLEDGE_DOCS || (typeof mockDocs !== 'undefined' ? mockDocs : []);
    let affectedDocs = docsToSearch.filter(doc => 
        (doc.parserName === template.name || doc.sliceSettingName === template.name)
    );

    // Provide mock data if no affected docs found for demonstration
    if (affectedDocs.length === 0) {
        affectedDocs = [
            { id: 'mock-doc-1', name: `项目说明文档_${template.name}_v1.pdf` },
            { id: 'mock-doc-2', name: `产品需求分析_${template.name}_v2.docx` },
            { id: 'mock-doc-3', name: `技术架构设计_${template.name}.txt` }
        ];
    }
    window.currentSyncTemplateData.affectedDocs = affectedDocs;

    const listContainer = document.getElementById('affected-files-list');
    if (affectedDocs.length === 0) {
        listContainer.innerHTML = '<div class="text-gray-500 text-center py-2 text-xs">没有找到绑定该模板的文档</div>';
    } else {
        listContainer.innerHTML = affectedDocs.map(doc => `
            <label class="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors border border-transparent hover:border-gray-200">
                <input type="checkbox" value="${doc.id}" class="sync-file-cb w-4 h-4 text-blue-600 rounded focus:ring-blue-500" checked>
                <i class="fa-regular fa-file-lines text-gray-400"></i>
                <span class="text-sm text-gray-700 flex-1 truncate">${doc.name}</span>
                <span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">绑定</span>
            </label>
        `).join('');
    }

    // Reset UI
    document.querySelector('input[name="syncStrategy"][value="auto"]').checked = true;
    toggleSyncStrategy();
    document.getElementById('template-sync-error').classList.add('hidden');
    document.getElementById('template-sync-modal').classList.remove('hidden');
};

window.closeTemplateSyncModal = function() {
    document.getElementById('template-sync-modal').classList.add('hidden');
    window.currentSyncTemplateData = null;
};

window.toggleSyncStrategy = function() {
    const isSelective = document.querySelector('input[name="syncStrategy"][value="selective"]').checked;
    const section = document.getElementById('affected-files-section');
    const autoRadio = document.querySelector('input[name="syncStrategy"][value="auto"]').closest('label');
    const selRadio = document.querySelector('input[name="syncStrategy"][value="selective"]').closest('label');
    
    if (isSelective) {
        section.classList.remove('hidden');
        selRadio.classList.add('border-blue-200', 'bg-blue-50/50');
        selRadio.classList.remove('border-gray-200');
        autoRadio.classList.remove('border-blue-200', 'bg-blue-50/50');
        autoRadio.classList.add('border-gray-200');
    } else {
        section.classList.add('hidden');
        autoRadio.classList.add('border-blue-200', 'bg-blue-50/50');
        autoRadio.classList.remove('border-gray-200');
        selRadio.classList.remove('border-blue-200', 'bg-blue-50/50');
        selRadio.classList.add('border-gray-200');
    }
};

window.toggleAllSyncFiles = function(checkbox) {
    document.querySelectorAll('.sync-file-cb').forEach(cb => {
        cb.checked = checkbox.checked;
    });
};

window.confirmSaveTemplateSync = function() {
    const data = window.currentSyncTemplateData;
    if (!data) return;

    const btn = document.getElementById('btn-confirm-template-sync');
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 处理中...';
    btn.disabled = true;

    // Simulate API Transaction
    setTimeout(() => {
        try {
            // 1. Transactional mock: start
            const oldTemplate = window.TEMPLATE_DATA.custom.find(t => t.id === data.id);
            if (!oldTemplate) throw new Error("Template not found");

            // 4. Sync Files
            const isAuto = document.querySelector('input[name="syncStrategy"][value="auto"]').checked;
            let updatedCount = 0;

            const docsStore = window.KNOWLEDGE_DOCS || (typeof mockDocs !== 'undefined' ? mockDocs : []);

            // 仅当“选择性同步模式”时才自动新建模板；自动同步模式则覆盖更新原模板
            let newName = null;
            if (!isAuto) {
                // 2. 生成新模板名称：继承原模板名称 + 1.0/2.0/3.0...
                const getBaseTemplateName = (name) => {
                    const n = (name || '').trim();
                    return n.replace(/\s+\d+\.0$/, '').trim();
                };
                const baseName = getBaseTemplateName(oldTemplate.name);
                const versionRegex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s+(\\d+)\\.0$`);
                let maxVer = 0;
                (window.TEMPLATE_DATA.custom || []).forEach(t => {
                    const tn = (t?.name || '').trim();
                    if (tn === baseName) return;
                    const m = tn.match(versionRegex);
                    if (m && m[1]) maxVer = Math.max(maxVer, Number(m[1]) || 0);
                });
                const nextVer = maxVer + 1;
                newName = `${baseName} ${nextVer}.0`;

                // 3. 新建模板（不覆盖原模板）
                const newId = 'c' + Date.now();
                const newTemplate = {
                    id: newId,
                    name: newName,
                    icon: oldTemplate.icon || 'fa-file-lines',
                    config: data.newConfig,
                    history: [
                        {
                            timestamp: new Date().toISOString(),
                            baseTemplateId: oldTemplate.id,
                            baseTemplateName: oldTemplate.name,
                            oldConfig: JSON.parse(JSON.stringify(oldTemplate.config || {})),
                            newConfig: JSON.parse(JSON.stringify(data.newConfig))
                        }
                    ]
                };
                window.TEMPLATE_DATA.custom.unshift(newTemplate);

                // 选择性同步：仅把选中文档从旧模板名切换到新模板名
                const checkedIds = Array.from(document.querySelectorAll('.sync-file-cb:checked')).map(cb => cb.value);
                checkedIds.forEach(docId => {
                    const doc = (docsStore || []).find(d => d.id === docId);
                    if (!doc) return;
                    if (doc.parserName === oldTemplate.name) doc.parserName = newName;
                    if (doc.sliceSettingName === oldTemplate.name) doc.sliceSettingName = newName;
                    updatedCount++;
                });
            } else {
                // 自动同步：覆盖更新原模板配置（保留模板名不变）
                if (!oldTemplate.history) oldTemplate.history = [];
                oldTemplate.history.push({
                    timestamp: new Date().toISOString(),
                    oldConfig: JSON.parse(JSON.stringify(oldTemplate.config || {})),
                    newConfig: JSON.parse(JSON.stringify(data.newConfig))
                });
                oldTemplate.config = data.newConfig;

                // 统计影响数量（名称不变，无需改动 doc 中的绑定名）
                (data.affectedDocs || []).forEach(d => {
                    const doc = (docsStore || []).find(x => x.id === d.id);
                    if (doc) updatedCount++;
                });
            }

            // 5. Logging
            if (newName) {
                console.log(`[LOG] 基于模板「${oldTemplate.name}」生成新模板「${newName}」. 影响文件数: ${updatedCount}`);
            } else {
                console.log(`[LOG] 模板「${oldTemplate.name}」配置已覆盖更新. 影响文件数: ${updatedCount}`);
            }

            // Success
            if (newName) {
                if(window.showToast) window.showToast(`已生成新模板「${newName}」，并同步更新 ${updatedCount} 个文件`, 'success');
            } else {
                if(window.showToast) window.showToast(`保存成功，已同步更新 ${updatedCount} 个文件`, 'success');
            }
            
            // Reset button & Go back
            const batchBtn = document.getElementById('btn-save-batch-slice');
            if (batchBtn) {
                const span = batchBtn.querySelector('span');
                if (span) span.innerText = '保存并返回'; 
                batchBtn.onclick = typeof saveBatchSliceSettings !== 'undefined' ? saveBatchSliceSettings : null;
            }
            const asTplBtn = document.getElementById('btn-save-as-template');
            if (asTplBtn) {
                asTplBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> 确认并保存至模版';
                asTplBtn.onclick = function() { window.openSaveTemplateModal(); };
            }
            window.currentEditingTemplateId = null;
            window.updateStrategyConfigConfirmVisibility();

            closeTemplateSyncModal();
            // Re-render templates after creating new one
            if (typeof window.renderTemplateColumns === 'function') {
                window.renderTemplateColumns();
            }
            if (typeof window.switchStrategyTab === 'function') {
                window.switchStrategyTab('template');
            }
        } catch (e) {
            // Rollback & Error Handle
            console.error("Transaction Failed: ", e);
            const errorEl = document.getElementById('template-sync-error');
            const errorMsg = document.getElementById('template-sync-error-msg');
            errorMsg.innerText = "保存失败，数据已回滚: " + e.message;
            errorEl.classList.remove('hidden');
        } finally {
            btn.innerHTML = originalBtnContent;
            btn.disabled = false;
        }
    }, 800);
};

window.handleDeleteTemplate = function(id) {
    // 自定义二次确认弹窗（包含绑定文件列表）
    window.openDeleteTemplateModal(id);
};

window.openDeleteTemplateModal = function(id) {
    const template = (window.TEMPLATE_DATA?.custom || []).find(t => t.id === id);
    if (!template) return;

    window.__pendingDeleteTemplateId = id;

    let modal = document.getElementById('delete-template-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'delete-template-modal';
        modal.className = 'fixed inset-0 z-[200] hidden';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"></div>
            <div class="absolute inset-0 flex items-center justify-center p-4">
                <div class="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-triangle-exclamation text-red-500"></i>
                            <h3 class="text-lg font-bold text-gray-900">删除模板</h3>
                        </div>
                        <button type="button" onclick="window.closeDeleteTemplateModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="text-sm text-gray-800 leading-relaxed" id="delete-template-warning"></div>
                        <div class="border border-gray-200 rounded-lg overflow-hidden">
                            <div class="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                                <div class="text-xs font-medium text-gray-700">绑定该模板的文件列表</div>
                                <div class="text-xs text-gray-500" id="delete-template-doc-count"></div>
                            </div>
                            <div class="max-h-56 overflow-y-auto p-2 space-y-1" id="delete-template-doc-list"></div>
                        </div>
                        <div class="text-xs text-gray-500">提示：确认删除后，将对绑定文件执行“解绑”（移除模板索引）。</div>
                    </div>
                    <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button type="button" onclick="window.closeDeleteTemplateModal()" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
                        <button type="button" onclick="window.confirmDeleteTemplate()" class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                            <i class="fa-regular fa-trash-can"></i>
                            确认删除
                        </button>
                    </div>
                </div>
            </div>
        `;
        (document.body || document.documentElement).appendChild(modal);

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target === modal.firstElementChild) {
                window.closeDeleteTemplateModal();
            }
        });
    }

    const warning = document.getElementById('delete-template-warning');
    if (warning) {
        warning.innerHTML = `
            确定要删除该模板吗？此操作无法撤销，删除后绑定该模板的文件<span class="font-semibold text-red-600 bg-red-50 px-1 rounded">索引将被统一移除</span>，请谨慎操作。<br/>
            <span class="text-gray-900 font-semibold">模板：</span><span class="font-semibold text-gray-900">${template.name}</span>
        `;
    }

    const docsStore = window.KNOWLEDGE_DOCS || (typeof mockDocs !== 'undefined' ? mockDocs : []);
    let boundDocs = (docsStore || []).filter(doc => doc && (doc.parserName === template.name || doc.sliceSettingName === template.name));
    if (boundDocs.length === 0) {
        // 默认展示示例文件（避免空态）
        boundDocs = [
            { id: 'mock-doc-1', name: `员工手册_${template.name}_v1.pdf`, __mock: true },
            { id: 'mock-doc-2', name: `制度规范_${template.name}_v2.docx`, __mock: true },
            { id: 'mock-doc-3', name: `FAQ_${template.name}.txt`, __mock: true }
        ];
    }

    const countEl = document.getElementById('delete-template-doc-count');
    if (countEl) countEl.innerText = `${boundDocs.length} 个文件`;

    const listEl = document.getElementById('delete-template-doc-list');
    if (listEl) {
        listEl.innerHTML = boundDocs.map(doc => `
            <div class="flex items-center gap-2 p-2 rounded hover:bg-white transition-colors border border-transparent hover:border-gray-200">
                <i class="fa-regular fa-file-lines text-gray-400"></i>
                <span class="text-sm text-gray-700 flex-1 truncate">${doc.name || doc.title || doc.id}</span>
                <span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">绑定</span>
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
};

window.closeDeleteTemplateModal = function() {
    const modal = document.getElementById('delete-template-modal');
    if (modal) modal.classList.add('hidden');
    window.__pendingDeleteTemplateId = null;
};

window.confirmDeleteTemplate = function() {
    const id = window.__pendingDeleteTemplateId;
    if (!id) return;
    const template = (window.TEMPLATE_DATA?.custom || []).find(t => t.id === id);
    if (!template) {
        window.closeDeleteTemplateModal();
        return;
    }

    // 1) 删除模板
    window.TEMPLATE_DATA.custom = (window.TEMPLATE_DATA.custom || []).filter(t => t.id !== id);

    // 2) 解绑：移除绑定文件的模板索引
    const docsStore = window.KNOWLEDGE_DOCS || (typeof mockDocs !== 'undefined' ? mockDocs : []);
    let affected = 0;
    (docsStore || []).forEach(doc => {
        if (!doc) return;
        if (doc.parserName === template.name) {
            doc.parserName = '未设置';
            affected++;
        }
        if (doc.sliceSettingName === template.name) {
            doc.sliceSettingName = '未设置';
            affected++;
        }
    });

    // 3) 刷新列表
    if (typeof window.renderTemplateColumns === 'function') {
        window.renderTemplateColumns();
    }
    if (window.showToast) window.showToast(`模板删除成功，已移除 ${affected} 条绑定索引`, 'success');

    window.closeDeleteTemplateModal();
};

// --- Save as Template Logic ---

window.openSaveTemplateModal = function() {
    const modal = document.getElementById('save-template-modal');
    const input = document.getElementById('template-name-input');
    const errorMsg = document.getElementById('template-name-error');
    
    // Auto-generate name
    const typeMap = { 'text': '文本文档', 'table': '表格数据', 'image': '图片数据' };
    const typeName = typeMap[window.currentStrategyType] || '未知类型';
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    input.value = `${typeName}_${timestamp}`;
    
    // Reset validation
    errorMsg.classList.add('hidden');
    input.classList.remove('ring-red-500', 'focus:ring-red-500');
    
    modal.classList.remove('hidden');
    input.focus();
};

window.closeSaveTemplateModal = function() {
    document.getElementById('save-template-modal').classList.add('hidden');
};

window.confirmSaveTemplate = function() {
    const input = document.getElementById('template-name-input');
    const errorMsg = document.getElementById('template-name-error');
    const btn = document.getElementById('btn-confirm-save-template');
    const name = input.value.trim();
    
    // Validation
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/g;
    if (name.length === 0 || name.length > 50 || specialCharRegex.test(name)) {
        errorMsg.classList.remove('hidden');
        input.classList.add('ring-red-500', 'focus:ring-red-500');
        return;
    }
    
    // Collect Configuration
    const type = window.currentStrategyType;
    let parsing = document.querySelector('input[name="parsing-strategy"]:checked')?.value;
    if (type === 'table') {
        const headerRowInput = document.getElementById('header-row-input');
        if (headerRowInput) parsing = { headerRow: headerRowInput.value };
    }
    const chunking = document.querySelector('input[name="chunking-strategy"]:checked')?.value;
    // 切片策略必填：当页面存在切片策略选项时必须选择
    const chunkRadios = document.querySelectorAll('input[name="chunking-strategy"]');
    if (chunkRadios && chunkRadios.length > 0 && !chunking) {
        if (window.showToast) window.showToast('请选择切片策略', 'error');
        return;
    }
    const enhancements = Array.from(document.querySelectorAll('input[name="enhancement"]:checked')).map(el => el.id.replace('enhance-', ''));
    
    const config = { type, parsing, chunking, enhancements };
    
    // Simulate Saving
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 保存中...';
    
    setTimeout(() => {
        // Success
        const newId = 'c' + (Date.now());
        const newTemplate = { 
            id: newId, 
            name: name, 
            icon: 'fa-file-lines',
            config: config
        };
        
        window.TEMPLATE_DATA.custom.unshift(newTemplate); // Add to beginning
        // Re-render both main page + wizard modal lists
        window.renderTemplateColumns();
        
        if(window.showToast) window.showToast('模板保存成功', 'success');
        
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        window.closeSaveTemplateModal();
        
        // Switch to template tab
        if (typeof window.switchStrategyTab === 'function') {
            window.switchStrategyTab('template');
        }
    }, 1000);
};

// Monitor changes to enable "Save as Template" button
window.handleConfigChange = function() {
    const btn = document.getElementById('btn-save-as-template');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('text-gray-400', 'cursor-not-allowed');
        btn.classList.add('text-gray-700', 'cursor-pointer', 'active:scale-95');
    }
};

// Add listener for custom selection changes from accessible groups
document.addEventListener('selectionChange', function(e) {
    window.handleConfigChange();
    
    const { group, value, item } = e.detail;
    if (group === 'parsing-options' || item.getAttribute('data-group') === 'parsing-strategy') {
        if (!value) {
            clearStrategyWriteBackToDoc('parser');
            return;
        }
        const labelText = item.querySelector('.text-sm.font-medium')?.innerText || '';
        const type = window.currentStrategyType;
        const meta = getStrategyOptionMeta(type, 'parsing', value);
        applyStrategyWriteBackToDoc({ field: 'parser', value, label: (labelText || '').trim(), meta });
    }
    
    if (group === 'chunking-options' || item.getAttribute('data-group') === 'chunking-strategy') {
        const labelText = item.querySelector('.text-sm.font-medium')?.innerText || '';
        const type = window.currentStrategyType;
        const meta = getStrategyOptionMeta(type, 'chunking', value);
        applyStrategyWriteBackToDoc({ field: 'slice', value, label: (labelText || '').trim(), meta });
    }
});

// Add listeners to inputs
document.addEventListener('change', function(e) {
    if (e.target.matches('input[name="parsing-strategy"], input[name="chunking-strategy"], input[name="enhancement"], #header-row-input, [id^="strategy-slice-"], [id^="strategy-preprocess-"]')) {
        window.handleConfigChange();
    }

    if (e.target && e.target.matches && e.target.matches('input[name="parsing-strategy"]')) {
        const input = e.target;
        if (!input.checked) return;
        const value = input.value;
        const labelEl = input.closest('label');
        const labelText = labelEl ? (labelEl.querySelector('span.text-sm.font-medium')?.innerText || labelEl.innerText) : '';
        const type = window.currentStrategyType;
        const meta = getStrategyOptionMeta(type, 'parsing', value);
        applyStrategyWriteBackToDoc({ field: 'parser', value, label: (labelText || '').trim(), meta });
    }

    if (e.target && e.target.matches && e.target.matches('input[name="chunking-strategy"]')) {
        const input = e.target;
        const value = input.value;
        const labelEl = input.closest('label');
        const labelText = labelEl ? (labelEl.querySelector('span.text-sm.font-medium')?.innerText || labelEl.innerText) : '';
        const type = window.currentStrategyType;
        const meta = getStrategyOptionMeta(type, 'chunking', value);
        applyStrategyWriteBackToDoc({ field: 'slice', value, label: (labelText || '').trim(), meta });
    }

    if (e.target && e.target.id === 'header-row-input' && window.currentStrategyType === 'table') {
        const input = e.target;
        const val = Number(input.value);
        if (!isNaN(val) && Number.isInteger(val) && val >= 1 && val <= 50) {
            applyStrategyWriteBackToDoc({
                field: 'parser',
                value: `headerRow:${val}`,
                label: `表头第${val}行`,
                meta: { headerRow: val }
            });
        }
    }

    if (e.target && e.target.matches && e.target.matches('input[name="enhancement"]')) {
        const docId = strategyConfigDocId;
        const doc = Array.isArray(mockDocs) && docId ? mockDocs.find(d => d && d.id === docId) : null;
        if (doc) {
            const enhancements = Array.from(document.querySelectorAll('input[name="enhancement"]:checked')).map(el => {
                const id = el.id || '';
                return id.startsWith('enhance-') ? id.replace('enhance-', '') : id;
            }).filter(Boolean);
            doc.strategyConfig = doc.strategyConfig || {};
            doc.strategyConfig.type = window.currentStrategyType || doc.strategyConfig.type || null;
            doc.strategyConfig.enhancements = enhancements;
            persistMockDocsSafely();
        }
    }
});
document.addEventListener('input', function(e) {
    if (e.target.matches('#header-row-input, [id^="strategy-slice-"], [id^="strategy-preprocess-"]')) {
        window.handleConfigChange();
    }
});

window.handleAddTemplate = function() {
    if(window.showToast) window.showToast('正在跳转至新建页面...', 'info');
    
    // Switch back to "File Type" tab
    switchStrategyTab('file-type');
    
    // Optional: Reset selections or prepare "New Template" state
    // selectStrategyType('text'); // Ensure a type is selected
};

window.selectedTemplateId = null;

window.handleTemplateClick = function(id, type) {
    if (type === 'customized') {
        if(window.showToast) window.showToast('进入工艺图文档专属预览流程', 'info');
        return;
    } 
    
    // Update State
    window.selectedTemplateId = id;
    
    // Trigger Callback (Simulated)
    if (typeof window.onTemplateSelect === 'function') {
        window.onTemplateSelect({ element: document.querySelector(`[data-id="${id}"]`), selected: true });
    }
    
    // Update UI (Efficient DOM Update)
    const allCards = document.querySelectorAll('.template-card');
    allCards.forEach(card => {
        const isSelected = card.getAttribute('data-id') === id;
        const innerDiv = card.firstElementChild;
        const iconDiv = innerDiv.querySelector('div');
        const indicator = innerDiv.querySelector('.absolute');
        
        // Update ARIA
        card.setAttribute('aria-selected', isSelected);
        
        // Update Classes
        if (isSelected) {
            innerDiv.classList.remove('hover:border-blue-300', 'hover:bg-blue-50/30');
            innerDiv.classList.add('border-blue-600', 'ring-2', 'ring-blue-600', 'bg-blue-50');
            
            iconDiv.classList.remove('bg-blue-50', 'group-hover:bg-blue-100');
            iconDiv.classList.add('bg-blue-100');
            
            if(indicator) indicator.classList.remove('opacity-0');
            if(indicator) indicator.classList.add('opacity-100');
        } else {
            innerDiv.classList.add('hover:border-blue-300', 'hover:bg-blue-50/30');
            innerDiv.classList.remove('border-blue-600', 'ring-2', 'ring-blue-600', 'bg-blue-50');
            
            iconDiv.classList.add('bg-blue-50', 'group-hover:bg-blue-100');
            iconDiv.classList.remove('bg-blue-100');
            
            if(indicator) indicator.classList.add('opacity-0');
            if(indicator) indicator.classList.remove('opacity-100');
        }
    });

    if(window.showToast) window.showToast(`已选用模板: ${id}`, 'success');

    try {
        const lists = ['general', 'custom', 'customized'];
        let tpl = null;
        for (const k of lists) {
            const arr = window.TEMPLATE_DATA && window.TEMPLATE_DATA[k];
            if (!Array.isArray(arr)) continue;
            tpl = arr.find(t => t && t.id === id) || null;
            if (tpl) break;
        }
        const tplName = tpl && typeof tpl.name === 'string' ? tpl.name.trim() : '';
        if (tplName) {
            applyStrategyWriteBackToDoc({ field: 'parser', value: tplName, label: tplName, meta: tpl && tpl.config ? { templateId: id, config: tpl.config } : { templateId: id } });
            applyStrategyWriteBackToDoc({ field: 'slice', value: tplName, label: tplName, meta: tpl && tpl.config ? { templateId: id, config: tpl.config } : { templateId: id } });
        }
    } catch (_) {}
};

// Hook into existing init
const originalInitStrategyConfigPage = window.initStrategyConfigPage;
window.initStrategyConfigPage = function(params) {
    if (originalInitStrategyConfigPage) originalInitStrategyConfigPage(params);
    // Initialize the content
    setTimeout(window.initStrategyConfigContent, 100);
};

window.addEventListener('hashchange', () => {
    if (typeof docUploadWizardIsOpen !== 'undefined' && docUploadWizardIsOpen) {
        closeDocUploadWizard({ fromPopState: true });
    }
});


// --- Step 2 Strategy Config Logic ---
window.switchConfigMode = function(mode) {
    const fileTypeBtn = document.getElementById('mode-btn-fileType');
    const templateBtn = document.getElementById('mode-btn-template');
    const fileTypePanel = document.getElementById('config-panel-fileType');
    const templatePanel = document.getElementById('config-panel-template');

    if (mode === 'fileType') {
        if(fileTypeBtn) fileTypeBtn.className = 'px-4 py-1.5 text-sm font-medium rounded-md bg-white text-gray-900 shadow-sm transition-all';
        if(templateBtn) templateBtn.className = 'px-4 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 transition-all';
        if(fileTypePanel) fileTypePanel.classList.remove('hidden');
        if(templatePanel) templatePanel.classList.add('hidden');
    } else {
        if(templateBtn) templateBtn.className = 'px-4 py-1.5 text-sm font-medium rounded-md bg-white text-gray-900 shadow-sm transition-all';
        if(fileTypeBtn) fileTypeBtn.className = 'px-4 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 transition-all';
        if(templatePanel) templatePanel.classList.remove('hidden');
        if(fileTypePanel) fileTypePanel.classList.add('hidden');

        // Ensure template list inside the wizard modal is initialized immediately.
        // Only trigger when the modal template containers exist (keeps unit tests stable).
        const modalListGeneral = document.getElementById('modal-template-list-general');
        if (modalListGeneral && typeof window.initTemplateTab === 'function' && !window.isTemplatesLoaded) {
            window.initTemplateTab();
        }
    }
};

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

    const overlay = document.getElementById('strategy-loading-overlay');
    const tableHeaderSettings = document.getElementById('table-header-settings');
    const knowledgeEnhance = document.getElementById('knowledge-enhance-container');
    const sliceStrategyGroup = document.getElementById('slice-strategy-container');
    const parseStrategyGroup = document.getElementById('parse-strategy-container'); // Need to add id in HTML or find it
    
    // Simulate loading configuration for the specific data type
    if(overlay) overlay.classList.remove('hidden');
    
    setTimeout(() => {
        if(overlay) overlay.classList.add('hidden');
        
        // Auto-select defaults based on data type for demo purposes
        if (typeValue === 'table') {
            const el = document.querySelector('input[name="parseStrategy"][value="table"]');
            if(el) el.checked = true;
            if (tableHeaderSettings) tableHeaderSettings.classList.remove('hidden');
            if (knowledgeEnhance) knowledgeEnhance.classList.remove('hidden');
            if (sliceStrategyGroup) sliceStrategyGroup.classList.add('hidden');
            if (parseStrategyGroup) parseStrategyGroup.classList.add('hidden');
        } else if (typeValue === 'image') {
            const el = document.querySelector('input[name="parseStrategy"][value="ocr"]');
            if(el) el.checked = true;
            if (tableHeaderSettings) tableHeaderSettings.classList.add('hidden');
            if (knowledgeEnhance) knowledgeEnhance.classList.add('hidden');
            if (sliceStrategyGroup) sliceStrategyGroup.classList.add('hidden');
            if (parseStrategyGroup) parseStrategyGroup.classList.remove('hidden');
        } else {
            const el = document.querySelector('input[name="parseStrategy"][value="ocr"]');
            if(el) el.checked = true;
            if (tableHeaderSettings) tableHeaderSettings.classList.add('hidden');
            if (knowledgeEnhance) knowledgeEnhance.classList.remove('hidden');
            if (sliceStrategyGroup) sliceStrategyGroup.classList.remove('hidden');
            if (parseStrategyGroup) parseStrategyGroup.classList.remove('hidden');
        }
    }, 200); // Wait time for simulated loading
};

window.handleSliceStrategyChange = function(input) {
    const value = typeof input === 'string' ? input : input.value;
    const customPanel = document.getElementById('slice-params-custom');
    const chapterPanel = document.getElementById('slice-params-chapter');
    const emptyPanel = document.getElementById('slice-params-empty');
    
    // Simulate loading/animation state
    const parentPanel = document.getElementById('slice-params-panel');
    if (parentPanel) parentPanel.style.opacity = '0.5';
    
    // Simulate fetching latest config from server
    setTimeout(() => {
        if (parentPanel) parentPanel.style.opacity = '1';
        
        // Mock server response
        const serverConfig = {
            custom: { delimiter: '\\n\\n', size: 1000, overlap: 100 },
            chapter: { level: 'h2' }
        };

        const titleLevelGroup = document.getElementById('doc-upload-config-group-title-level');

        if (value === 'custom' || value === 'chapter') {
            if (parentPanel) parentPanel.classList.remove('hidden');
            if (emptyPanel) emptyPanel.classList.add('hidden');
            if (customPanel) customPanel.classList.remove('hidden');
            
            if (value === 'custom') {
                if (chapterPanel) chapterPanel.classList.add('hidden');
                if (titleLevelGroup) titleLevelGroup.classList.add('hidden');
                
                // Backfill params
                const delimiterInput = document.getElementById('doc-upload-slice-delimiter');
                const sizeInput = document.getElementById('doc-upload-slice-size');
                const overlapInput = document.getElementById('doc-upload-slice-overlap');
                if(delimiterInput) delimiterInput.value = serverConfig.custom.delimiter;
                if(sizeInput) sizeInput.value = serverConfig.custom.size;
                if(overlapInput) overlapInput.value = serverConfig.custom.overlap;
                const sliceLengthDisplay = document.getElementById('slice-length-display');
                if (sliceLengthDisplay) sliceLengthDisplay.textContent = serverConfig.custom.size;
                if(window.showToast) window.showToast('已回填服务端最新切片配置', 'success');
            } else if (value === 'chapter') {
                if (chapterPanel) chapterPanel.classList.remove('hidden');
                if (titleLevelGroup) titleLevelGroup.classList.remove('hidden');
                
                // Backfill params
                const levelInput = document.getElementById('doc-upload-slice-chapter-level') || document.getElementById('doc-upload-slice-title-level');
                if(levelInput) levelInput.value = serverConfig.chapter.level;
                if(window.showToast) window.showToast('已回填服务端最新章节配置', 'success');
            }
        } else {
            if (parentPanel) parentPanel.classList.add('hidden');
            if (customPanel) customPanel.classList.add('hidden');
            if (chapterPanel) chapterPanel.classList.add('hidden');
            if (emptyPanel) emptyPanel.classList.remove('hidden');
        }
    }, 200);
};

window.toggleEnhanceOptions = function(isChecked) {
    const optionsPanel = document.getElementById('enhance-options');
    if(!optionsPanel) return;
    if (isChecked) {
        optionsPanel.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        optionsPanel.classList.add('opacity-50', 'pointer-events-none');
        // Uncheck all when disabled
        optionsPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
};

// --- Template Mode Logic ---

window.applyTemplate = function(name) {
    // Mock confirmation dialog before applying template
    if (confirm(`即将应用模板：【${name}】\n该操作会覆盖当前的策略配置，是否继续？`)) {
        if (window.showToast) window.showToast(`成功应用模板：${name}`, 'success');
        // Logic to update underlying form values would go here
    }
};

window.handleSchemaUpload = function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const resultDiv = document.getElementById('schema-validation-result');
    if(!resultDiv) return;
    resultDiv.classList.remove('hidden');
    resultDiv.className = 'rounded-lg p-3 text-sm mt-3 bg-blue-50 text-blue-600';
    resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> 正在校验 Schema...';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        setTimeout(() => {
            try {
                // Only JSON is easily parseable in browser without external libs for this demo
                if (file.name.endsWith('.json')) {
                    JSON.parse(e.target.result);
                    resultDiv.className = 'rounded-lg p-3 text-sm mt-3 bg-green-50 text-green-700 border border-green-200';
                    resultDiv.innerHTML = '<i class="fa-solid fa-check-circle mr-2"></i> Schema 校验通过，格式合规。';
                } else {
                    // Mock YAML success
                    resultDiv.className = 'rounded-lg p-3 text-sm mt-3 bg-green-50 text-green-700 border border-green-200';
                    resultDiv.innerHTML = '<i class="fa-solid fa-check-circle mr-2"></i> YAML 校验通过。';
                }
            } catch (error) {
                // Mock Error detection
                resultDiv.className = 'rounded-lg p-3 text-sm mt-3 bg-red-50 text-red-700 border border-red-200';
                resultDiv.innerHTML = `
                    <div class="flex items-start gap-2">
                        <i class="fa-solid fa-circle-xmark mt-0.5"></i>
                        <div>
                            <div class="font-bold mb-1">校验失败</div>
                            <div class="text-xs font-mono bg-red-100/50 p-2 rounded">${error.message}</div>
                            <div class="text-xs mt-1 text-red-500">请检查第 1 行附近，确保符合 JSON 标准规范。</div>
                        </div>
                    </div>
                `;
            }
            input.value = ''; // Reset input
        }, 600);
    };
    reader.readAsText(file);
};

// Initialize Accessible Selection Groups (Supports Single and Multi-select)
function initSelectionGroups() {
    const groups = document.querySelectorAll('[role="radiogroup"], [role="group"][aria-multiselectable="true"]');
    groups.forEach(group => {
        const isMultiSelect = group.getAttribute('aria-multiselectable') === 'true';
        const itemRole = isMultiSelect ? 'checkbox' : 'radio';
        const items = Array.from(group.querySelectorAll(`[role="${itemRole}"]`));
        const groupName = group.id;
        const isOptionalSingleSelect = !isMultiSelect && (groupName === 'parsing-options' || groupName === 'parse-strategy-group');

        // Persisted state
        let persistedValue = null;
        if (groupName === 'slice-strategy-group') {
            persistedValue = localStorage.getItem('defaultSliceStrategy');
        } else if (groupName === 'parse-strategy-group') {
            persistedValue = localStorage.getItem('defaultParseStrategy');
        }

        let defaultItems = [];
        items.forEach((item, index) => {
            const val = item.getAttribute('data-value');
            if (persistedValue && val === persistedValue) {
                defaultItems.push(item);
            } else if (!persistedValue && item.getAttribute('aria-checked') === 'true') {
                defaultItems.push(item);
            }

            // Mouse and Touch Events
            const handleInteract = (e) => {
                e.preventDefault();
                handleItemSelect(group, item, items, isMultiSelect);
            };
            item.addEventListener('click', handleInteract);
            item.addEventListener('touchstart', handleInteract, { passive: false });

            // Keyboard Events
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemSelect(group, item, items, isMultiSelect);
                } else if (!isMultiSelect) {
                    // Arrow key navigation for single select (radiogroup)
                    let nextIndex = index;
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        nextIndex = (index + 1) % items.length;
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        nextIndex = (index - 1 + items.length) % items.length;
                    }
                    if (nextIndex !== index) {
                        handleItemSelect(group, items[nextIndex], items, isMultiSelect);
                    }
                }
            });
        });

        if (defaultItems.length > 0) {
            defaultItems.forEach(item => handleItemSelect(group, item, items, isMultiSelect, true));
        } else if (items.length > 0 && !isMultiSelect) {
            // 单选组：默认选中第一个（必填），但解析策略允许“不选中”
            if (isOptionalSingleSelect) {
                items.forEach(item => updateItemVisuals(item, false));
                items[0].setAttribute('tabindex', '0');
            } else {
                handleItemSelect(group, items[0], items, isMultiSelect, true);
            }
        }
    });
}

let isProcessingSelection = false;

function handleItemSelect(group, selectedItem, allItems, isMultiSelect, isInit = false) {
    if (!isInit && isProcessingSelection) return; // Debounce to prevent rapid clicks
    
    const isCurrentlyChecked = selectedItem.getAttribute('aria-checked') === 'true';
    const isOptionalSingleSelect = !isMultiSelect && (group.id === 'parsing-options' || group.id === 'parse-strategy-group');
    if (!isMultiSelect && isCurrentlyChecked && !isInit && !isOptionalSingleSelect) return; // 必填单选组禁止取消选中
    
    if (!isInit) {
        isProcessingSelection = true;
    }
    
    const targetState = isMultiSelect ? !isCurrentlyChecked : (isCurrentlyChecked ? false : true);

    // Use requestAnimationFrame to ensure synchronous DOM update in same cycle
    requestAnimationFrame(() => {
        if (!isMultiSelect) {
            // Uncheck all others
            allItems.forEach(item => {
                if (item !== selectedItem) updateItemVisuals(item, false);
            });
        }

        updateItemVisuals(selectedItem, targetState);

        // 单选组允许“全不选”时，确保仍有一个可聚焦元素（roving tabindex）
        if (!isMultiSelect && isOptionalSingleSelect) {
            const anyChecked = allItems.some(item => item.getAttribute('aria-checked') === 'true');
            if (!anyChecked) {
                allItems.forEach(item => item.setAttribute('tabindex', '-1'));
                selectedItem.setAttribute('tabindex', '0');
            }
        }

        // Data binding and Custom Event Callback
        const selectedValues = allItems
            .filter(item => item.getAttribute('aria-checked') === 'true')
            .map(item => item.getAttribute('data-value'));

        const event = new CustomEvent('selectionChange', {
            bubbles: true,
            detail: {
                group: group.id,
                value: isMultiSelect ? selectedValues : (selectedValues[0] ?? null),
                item: selectedItem
            }
        });
        group.dispatchEvent(event);

        if (!isInit) {
            selectedItem.focus();
            
            const input = selectedItem.querySelector('input[type="radio"], input[type="checkbox"]');
            if (input) {
                if (input.name === 'chunking-strategy' || input.name === 'sliceStrategy') {
                    localStorage.setItem('defaultSliceStrategy', input.value);
                    if (typeof handleSliceStrategyChange === 'function') {
                        handleSliceStrategyChange(input.value);
                    }
                } else if (input.name === 'parsing-strategy' || input.name === 'parseStrategy') {
                    if (input.checked) localStorage.setItem('defaultParseStrategy', input.value);
                    else localStorage.removeItem('defaultParseStrategy');
                }
                
                // Trigger native change event to trigger handleConfigChange
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                // If there's no input element (e.g. dynamically generated cards with role="radio"),
                // trigger handleConfigChange directly.
                if (typeof window.handleConfigChange === 'function') {
                    window.handleConfigChange();
                }
            }
            
            // Release debounce lock after transition (e.g. 200ms)
            setTimeout(() => {
                isProcessingSelection = false;
            }, 200);
        }
    });
}

function updateItemVisuals(item, isSelected) {
    item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    item.setAttribute('tabindex', isSelected ? '0' : '-1');
    
    const input = item.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input) input.checked = isSelected;

    if (isSelected) {
        item.classList.add('border-blue-600', 'ring-1', 'ring-blue-600', 'bg-blue-50');
        item.classList.remove('border-gray-200');
        
        // Icon container updates
        const iconContainer = item.querySelector('.w-8.h-8.rounded-full');
        if (iconContainer) {
            iconContainer.classList.add('bg-blue-50', 'text-blue-500');
            iconContainer.classList.remove('bg-gray-50', 'text-gray-500');
            
            // Toggle regular/solid font-awesome icon
            const icon = iconContainer.querySelector('i');
            if (icon) {
                if (icon.classList.contains('fa-regular')) {
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    icon.setAttribute('data-icon-swapped', 'true');
                } else if (icon.classList.contains('fa-image')) {
                    // special case for image icon which has a regular version but might start as solid
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    icon.setAttribute('data-icon-swapped', 'true');
                }
            }
        }
    } else {
        item.classList.remove('border-blue-600', 'ring-1', 'ring-blue-600', 'bg-blue-50');
        item.classList.add('border-gray-200');
        
        // Icon container updates
        const iconContainer = item.querySelector('.w-8.h-8.rounded-full');
        if (iconContainer) {
            iconContainer.classList.remove('bg-blue-50', 'text-blue-500');
            iconContainer.classList.add('bg-gray-50', 'text-gray-500');
            
            // Revert solid to regular if it was swapped
            const icon = iconContainer.querySelector('i');
            if (icon && (icon.getAttribute('data-icon-swapped') === 'true' || icon.classList.contains('fa-image'))) {
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-regular');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSelectionGroups();
    if (typeof window.initKnowledgeViewSplitPane === 'function') {
        window.initKnowledgeViewSplitPane();
    }
    if (typeof window.initParseResultSplitPane === 'function') {
        window.initParseResultSplitPane();
    }

    // ESC 退出知识预览全屏
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (typeof window.closeDocPreviewFullscreen === 'function') {
            window.closeDocPreviewFullscreen();
        }
    });

    // Handle chunking strategy selection changes to show/hide custom config
    document.body.addEventListener('selectionChange', (e) => {
        if (e.detail && e.detail.group === 'chunking-options') {
            const selectedValue = e.detail.value;
            const chunkingContainer = document.getElementById('chunking-options');
            let customConfig = document.getElementById('strategy-custom-chunk-config');
            let preprocessExtra = document.getElementById('strategy-preprocess-extra-config');
            
            if (selectedValue === 'custom' || selectedValue === 'chapter') {
                if (preprocessExtra) preprocessExtra.remove();
                if (!customConfig && chunkingContainer) {
                    chunkingContainer.insertAdjacentHTML('beforeend', window.getCustomChunkConfigHTML('strategy'));
                    customConfig = document.getElementById('strategy-custom-chunk-config');
                }
                
                const titleLevelGroup = document.getElementById('strategy-config-group-title-level');
                if (titleLevelGroup) {
                    if (selectedValue === 'custom') {
                        titleLevelGroup.classList.add('hidden');
                    } else {
                        titleLevelGroup.classList.remove('hidden');
                    }
                }

                // “分段标识符”仅在自定义切片时展示；按章节切片时隐藏
                const delimiterGroup = document.getElementById('strategy-config-group-delimiter');
                if (delimiterGroup) {
                    if (selectedValue === 'chapter') delimiterGroup.classList.add('hidden');
                    else delimiterGroup.classList.remove('hidden');
                }

                // 排序：按章节切片时，“标题级数”显示在第一位
                const sizeGroup = document.getElementById('strategy-config-group-size');
                const overlapGroup = document.getElementById('strategy-config-group-overlap');
                const setOrder = (el, order) => {
                    if (!el) return;
                    el.style.order = String(order);
                };
                setOrder(delimiterGroup, selectedValue === 'chapter' ? 4 : 1);
                setOrder(titleLevelGroup, selectedValue === 'chapter' ? 1 : 4);
                setOrder(sizeGroup, 2);
                setOrder(overlapGroup, 3);
                
                // "按章节切片" 默认选中并禁用“关联标题及子标题”与“关联文件名”
                const titleCheckbox = document.getElementById('strategy-preprocess-title');
                const filenameCheckbox = document.getElementById('strategy-preprocess-filename');
                if (titleCheckbox) {
                    if (selectedValue === 'chapter') {
                        titleCheckbox.checked = true;
                        titleCheckbox.disabled = true;
                        titleCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                    } else {
                        titleCheckbox.disabled = false;
                        titleCheckbox.parentElement.classList.remove('opacity-60', 'cursor-not-allowed');
                    }
                }
                if (filenameCheckbox) {
                    if (selectedValue === 'chapter') {
                        filenameCheckbox.checked = true;
                        filenameCheckbox.disabled = true;
                        filenameCheckbox.parentElement.classList.add('opacity-60', 'cursor-not-allowed');
                    } else {
                        filenameCheckbox.disabled = false;
                        filenameCheckbox.parentElement.classList.remove('opacity-60', 'cursor-not-allowed');
                    }
                }
            } else if (selectedValue === 'page' || selectedValue === 'whole') {
                if (customConfig) customConfig.remove();
                if (!preprocessExtra && chunkingContainer) {
                    chunkingContainer.insertAdjacentHTML('beforeend', window.getTextPreprocessConfigHTML('strategy'));
                    preprocessExtra = document.getElementById('strategy-preprocess-extra-config');
                }
                // 仅“整文件切片”删除“关联标题及子标题”（按页切片需要恢复显示）
                const titleRow = preprocessExtra ? preprocessExtra.querySelector('#strategy-preprocess-title-row') : null;
                const filenameRow = preprocessExtra ? preprocessExtra.querySelector('#strategy-preprocess-filename-row') : null;
                if (selectedValue === 'whole') {
                    if (titleRow) titleRow.remove();
                } else {
                    if (!titleRow && filenameRow) {
                        filenameRow.insertAdjacentHTML('afterend', `
            <div class="flex items-center gap-2" id="strategy-preprocess-title-row">
                <input id="strategy-preprocess-title" type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 border-gray-300">
                <label for="strategy-preprocess-title" class="text-xs text-gray-600">关联标题及子标题</label>
            </div>
                        `.trim());
                    }
                }
            } else {
                if (customConfig) {
                    customConfig.remove();
                }
                if (preprocessExtra) {
                    preprocessExtra.remove();
                }
            }
        }
    });
});
// --- Knowledge Base Version Management ---
let currentKbIdForVersion = null;
let currentKbNameForVersion = null;
let currentKbVersionPage = 1;
const KB_VERSION_PAGE_SIZE = 10;

const kbVersionsStore = {};

function openKbVersionManager(id, name) {
    currentKbIdForVersion = id;
    currentKbNameForVersion = name;
    currentKbVersionPage = 1;
    
    if (!kbVersionsStore[id]) {
        // Initialize with 15 mock versions as requested
        const mockVersions = [];
        for (let i = 15; i >= 1; i--) {
            mockVersions.push({
                id: "v1.0." + i,
                version: "V1.0." + i,
                remarks: i === 1 ? "初始创建版本" : `系统自动保存的第 ${i} 次快照`,
                createdAt: new Date(Date.now() - (15 - i) * 86400000).toLocaleString(),
                creator: "当前用户"
            });
        }
        kbVersionsStore[id] = mockVersions;
    }
    
    renderKbVersionList();
    
    const modal = document.getElementById("kb-version-mgmt-modal");
    if (modal) {
        modal.classList.remove("hidden");
    }
}
window.openKbVersionManager = openKbVersionManager;

function closeKbVersionManager() {
    const modal = document.getElementById("kb-version-mgmt-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
    currentKbIdForVersion = null;
    currentKbNameForVersion = null;
}
window.closeKbVersionManager = closeKbVersionManager;

function renderKbVersionList() {
    const allVersions = kbVersionsStore[currentKbIdForVersion] || [];
    const emptyEl = document.getElementById("kb-version-empty");
    const listContainer = document.getElementById("kb-version-list-container");
    const tbody = document.getElementById("kb-version-tbody");
    
    if (allVersions.length === 0) {
        emptyEl.classList.remove("hidden");
        listContainer.classList.add("hidden");
    } else {
        emptyEl.classList.add("hidden");
        listContainer.classList.remove("hidden");
        
        // Calculate Pagination
        const totalItems = allVersions.length;
        const totalPages = Math.ceil(totalItems / KB_VERSION_PAGE_SIZE);
        
        // Safety check bounds
        if (currentKbVersionPage > totalPages) currentKbVersionPage = totalPages;
        if (currentKbVersionPage < 1) currentKbVersionPage = 1;
        
        const startIndex = (currentKbVersionPage - 1) * KB_VERSION_PAGE_SIZE;
        const endIndex = startIndex + KB_VERSION_PAGE_SIZE;
        const currentVersions = allVersions.slice(startIndex, endIndex);
        
        const latestVersionId = allVersions.length > 0 ? allVersions[0].id : null;
        
        tbody.innerHTML = "";
        currentVersions.forEach(v => {
            const isLatest = v.id === latestVersionId;
            const tr = document.createElement("tr");
            tr.className = "hover:bg-gray-50 transition-colors";
            tr.innerHTML = `
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" class="version-compare-checkbox rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" value="${v.id}" onchange="handleVersionCompareCheck(this)">
                </td>
                <td class="px-6 py-4 font-medium text-gray-900">${v.version}</td>
                <td class="px-6 py-4">
                    <div class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded transition-colors group/edit" onclick="window.editKbVersionRemark(this, '${v.id}')" title="点击编辑备注">
                        <span class="text-gray-600 max-w-[200px] truncate inline-block align-bottom" title="${v.remarks}">${v.remarks}</span>
                        <i class="fa-solid fa-pen text-xs text-gray-300 ml-1 opacity-0 group-hover/edit:opacity-100"></i>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-500">${v.createdAt}</td>
                <td class="px-6 py-4 text-gray-600">${v.creator}</td>
                <td class="px-6 py-4 text-right">
                    ${isLatest ? 
                        `<button disabled class="text-gray-400 font-medium mr-3 cursor-not-allowed" title="已经是最新版本">回滚</button>` : 
                        `<button onclick="openRollbackKbVersionModal('${v.id}')" class="text-blue-600 hover:text-blue-800 font-medium mr-3">回滚</button>`
                    }
                    <button onclick="deleteKbVersion('${v.id}')" class="text-red-600 hover:text-red-800 font-medium">删除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Reset compare button state on render
        const btnCompare = document.getElementById('btn-compare-versions');
        if (btnCompare) {
            btnCompare.disabled = true;
            btnCompare.classList.replace('bg-blue-600', 'bg-gray-100');
            btnCompare.classList.replace('text-white', 'text-gray-400');
            btnCompare.classList.add('pointer-events-none');
        }
        
        // Render Pagination UI
        const infoEl = document.getElementById('kb-version-pagination-info');
        const controlsEl = document.getElementById('kb-version-pagination-controls');
        
        if (infoEl) {
            infoEl.textContent = `共 ${totalItems} 条，当前第 ${currentKbVersionPage}/${totalPages} 页`;
        }
        
        if (controlsEl) {
            controlsEl.innerHTML = `
                <button onclick="changeKbVersionPage(${currentKbVersionPage - 1})" class="px-2 py-1 rounded text-sm ${currentKbVersionPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}" ${currentKbVersionPage === 1 ? 'disabled' : ''}>上一页</button>
                <button onclick="changeKbVersionPage(${currentKbVersionPage + 1})" class="px-2 py-1 rounded text-sm ${currentKbVersionPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}" ${currentKbVersionPage === totalPages ? 'disabled' : ''}>下一页</button>
            `;
        }
    }
}

window.changeKbVersionPage = function(newPage) {
    currentKbVersionPage = newPage;
    renderKbVersionList();
};

window.editKbVersionRemark = function(element, versionId) {
    const span = element.querySelector('span');
    const currentValue = span.innerText;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-gray-800';
    
    const saveValue = () => {
        const newValue = input.value.trim() || currentValue;
        
        // Update data store
        if (kbVersionsStore[currentKbIdForVersion]) {
            const versionObj = kbVersionsStore[currentKbIdForVersion].find(v => v.id === versionId);
            if (versionObj) {
                versionObj.remarks = newValue;
            }
        }
        
        // Update DOM
        span.innerText = newValue;
        span.title = newValue;
        element.replaceChild(span, input);
        element.appendChild(element.querySelector('i')); // Add icon back
        
        if (window.showToast && newValue !== currentValue) {
            window.showToast('备注已更新', 'success');
        }
    };
    
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveValue();
        if (e.key === 'Escape') {
            input.value = currentValue;
            saveValue();
        }
    });
    
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();
};

window.handleVersionCompareCheck = function(checkbox) {
    const checkboxes = document.querySelectorAll('.version-compare-checkbox');
    const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
    const btn = document.getElementById('btn-compare-versions');
    
    // Max 2 selections
    if (checkedBoxes.length > 2) {
        checkbox.checked = false;
        if (window.showToast) window.showToast('最多只能选择两个版本进行对比', 'warning');
        return;
    }
    
    if (checkedBoxes.length === 2) {
        btn.disabled = false;
        btn.classList.replace('bg-gray-100', 'bg-blue-600');
        btn.classList.replace('text-gray-400', 'text-white');
        btn.classList.replace('hover:bg-gray-200', 'hover:bg-blue-700');
        btn.classList.remove('pointer-events-none');
    } else {
        btn.disabled = true;
        btn.classList.replace('bg-blue-600', 'bg-gray-100');
        btn.classList.replace('text-white', 'text-gray-400');
        btn.classList.replace('hover:bg-blue-700', 'hover:bg-gray-200');
        btn.classList.add('pointer-events-none');
    }
};

let compareLeftVersionId = null;
let compareRightVersionId = null;

window.openVersionCompareModal = function() {
    const checkedBoxes = Array.from(document.querySelectorAll('.version-compare-checkbox:checked'));
    if (checkedBoxes.length !== 2) return;
    
    compareLeftVersionId = checkedBoxes[0].value;
    compareRightVersionId = checkedBoxes[1].value;
    
    // Sort so older is on the left
    const versions = kbVersionsStore[currentKbIdForVersion] || [];
    const v1Index = versions.findIndex(v => v.id === compareLeftVersionId);
    const v2Index = versions.findIndex(v => v.id === compareRightVersionId);
    
    if (v1Index < v2Index) { // v1Index is smaller = newer version, swap them
        [compareLeftVersionId, compareRightVersionId] = [compareRightVersionId, compareLeftVersionId];
    }
    
    populateCompareSelects();
    renderComparePanels();
    
    const modal = document.getElementById('kb-version-compare-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeVersionCompareModal = function() {
    const modal = document.getElementById('kb-version-compare-modal');
    if (modal) modal.classList.add('hidden');
    
    // Exit fullscreen if active
    const container = document.getElementById('kb-version-compare-container');
    if (container && container.classList.contains('w-full')) {
        toggleCompareFullscreen();
    }
};

window.populateCompareSelects = function() {
    const versions = kbVersionsStore[currentKbIdForVersion] || [];
    const leftSelect = document.getElementById('compare-left-select');
    const rightSelect = document.getElementById('compare-right-select');
    
    leftSelect.innerHTML = '';
    rightSelect.innerHTML = '';
    
    versions.forEach(v => {
        const optionL = document.createElement('option');
        optionL.value = v.id;
        optionL.text = `${v.version} (${v.createdAt})`;
        if (v.id === compareLeftVersionId) optionL.selected = true;
        leftSelect.appendChild(optionL);
        
        const optionR = document.createElement('option');
        optionR.value = v.id;
        optionR.text = `${v.version} (${v.createdAt})`;
        if (v.id === compareRightVersionId) optionR.selected = true;
        rightSelect.appendChild(optionR);
    });
};

window.renderComparePanels = function() {
    const versions = kbVersionsStore[currentKbIdForVersion] || [];
    const latestVersionId = versions.length > 0 ? versions[0].id : null;
    
    compareLeftVersionId = document.getElementById('compare-left-select').value;
    compareRightVersionId = document.getElementById('compare-right-select').value;
    
    const leftVer = versions.find(v => v.id === compareLeftVersionId);
    const rightVer = versions.find(v => v.id === compareRightVersionId);
    
    const leftContent = document.getElementById('compare-left-content');
    const rightContent = document.getElementById('compare-right-content');
    
    // Disable rollback buttons if they are the latest version
    const leftBtn = document.getElementById('compare-rollback-left');
    if (leftBtn) {
        if (compareLeftVersionId === latestVersionId) {
            leftBtn.disabled = true;
            leftBtn.className = "text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded font-medium border border-gray-200 shadow-sm cursor-not-allowed";
            leftBtn.title = "已经是最新版本";
        } else {
            leftBtn.disabled = false;
            leftBtn.className = "text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition-colors border border-blue-200 shadow-sm";
            leftBtn.title = "";
        }
    }
    
    const rightBtn = document.getElementById('compare-rollback-right');
    if (rightBtn) {
        if (compareRightVersionId === latestVersionId) {
            rightBtn.disabled = true;
            rightBtn.className = "text-xs px-3 py-1.5 bg-gray-100 text-gray-400 rounded font-medium border border-gray-200 shadow-sm cursor-not-allowed";
            rightBtn.title = "已经是最新版本";
        } else {
            rightBtn.disabled = false;
            rightBtn.className = "text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition-colors border border-blue-200 shadow-sm";
            rightBtn.title = "";
        }
    }
    
    // Generate some mock differences based on version id
    leftContent.innerHTML = generateMockFileContent(leftVer);
    rightContent.innerHTML = generateMockFileContent(rightVer);
};

function generateMockFileContent(versionObj) {
    if (!versionObj) return "暂无内容";
    return `[版本标识: ${versionObj.version}]
[创建时间: ${versionObj.createdAt}]
[备注信息: ${versionObj.remarks}]

=== 文件正文内容 ===

这是一家科技公司的性能测试报告。
经过详细分析，我们发现系统的吞吐量在并发达到 1000 时出现瓶颈。

【更新详情】
1. 优化了数据库查询索引，提升了约 20% 的读取速度。
2. 修复了内存泄漏问题（主要集中在数据解析模块）。
3. ${versionObj.id.includes('v1.0.0') ? '初始内容待进一步验证。' : '根据专家反馈，调整了并发测试的参数模型。'}

【总结】
当前系统稳定性评级为：${versionObj.id.includes('v1.0.0') ? 'B级（良）' : 'A级（优）'}。
后续建议持续监控服务器内存指标。`;
}

window.toggleCompareFullscreen = function() {
    const container = document.getElementById('kb-version-compare-container');
    const icon = document.querySelector('#btn-compare-fullscreen i');
    const rightPane = document.getElementById('main-content-area'); // The right main view area
    const sidebar = document.querySelector('.w-64.bg-gray-50.border-r'); // Assuming standard sidebar structure
    
    // First, verify we are in a structure that has a sidebar
    if (sidebar && rightPane) {
        if (!container.classList.contains('fixed-in-pane')) {
            // Setup container to be absolute inside the main content pane
            // Enter pane-fullscreen
            
            // First we need to move the modal into the main content area if it isn't already
            if (container.parentElement.id !== 'main-content-area') {
                // To avoid breaking the modal overlay structure, we just style it
                // Instead of moving DOM nodes which can cause event issues, we'll use CSS
            }
            
            // Make the container fill the right pane
            container.classList.add('fixed-in-pane');
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.bottom = '0';
            container.style.right = '0';
            // Calculate left offset based on sidebar width (w-64 is 16rem = 256px)
            container.style.left = '256px'; 
            
            container.classList.replace('w-11/12', 'w-auto');
            container.classList.replace('h-[90vh]', 'h-full');
            container.classList.remove('rounded-xl', 'm-4');
            icon.classList.replace('fa-expand', 'fa-compress');
        } else {
            // Exit pane-fullscreen
            container.classList.remove('fixed-in-pane');
            container.style.position = 'relative';
            container.style.top = 'auto';
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = 'auto';
            
            container.classList.replace('w-auto', 'w-11/12');
            container.classList.replace('h-full', 'h-[90vh]');
            container.classList.add('rounded-xl', 'm-4');
            icon.classList.replace('fa-compress', 'fa-expand');
        }
    } else {
        // Fallback to original full-screen behavior if sidebar layout isn't found
        if (container.classList.contains('w-11/12')) {
            // Enter Fullscreen
            container.classList.replace('w-11/12', 'w-full');
            container.classList.replace('h-[90vh]', 'h-full');
            container.classList.remove('rounded-xl', 'm-4');
            icon.classList.replace('fa-expand', 'fa-compress');
        } else {
            // Exit Fullscreen
            container.classList.replace('w-full', 'w-11/12');
            container.classList.replace('h-full', 'h-[90vh]');
            container.classList.add('rounded-xl', 'm-4');
            icon.classList.replace('fa-compress', 'fa-expand');
        }
    }
};

window.rollbackFromCompare = function(side) {
    const versionId = side === 'left' ? compareLeftVersionId : compareRightVersionId;
    closeVersionCompareModal();
    openRollbackKbVersionModal(versionId);
};

function openCreateKbVersionModal() {
    document.getElementById("kb-version-desc-input").value = "";
    const modal = document.getElementById("kb-version-create-modal");
    if (modal) modal.classList.remove("hidden");
}
window.openCreateKbVersionModal = openCreateKbVersionModal;

function closeCreateKbVersionModal() {
    const modal = document.getElementById("kb-version-create-modal");
    if (modal) modal.classList.add("hidden");
}
window.closeCreateKbVersionModal = closeCreateKbVersionModal;

function confirmCreateKbVersion() {
    const desc = document.getElementById("kb-version-desc-input").value.trim();
    if (!desc) {
        if (window.showToast) window.showToast("请输入版本描述", "error");
        return;
    }
    
    if (!kbVersionsStore[currentKbIdForVersion]) {
        kbVersionsStore[currentKbIdForVersion] = [];
    }
    
    const versions = kbVersionsStore[currentKbIdForVersion];
    let nextVersion = "V1.0.0";
    if (versions.length > 0) {
        const lastVer = versions[0].version;
        const parts = lastVer.replace("V", "").split(".");
        if (parts.length === 3) {
            parts[2] = parseInt(parts[2]) + 1;
            nextVersion = "V" + parts.join(".");
        } else {
            nextVersion = "V1.0." + versions.length;
        }
    }
    
    const newVer = {
        id: "v_" + Date.now(),
        version: nextVersion,
        remarks: desc,
        createdAt: new Date().toLocaleString(),
        creator: "当前用户"
    };
    
    versions.unshift(newVer);
    
    if (window.showToast) window.showToast("新建版本成功", "success");
    closeCreateKbVersionModal();
    renderKbVersionList();
    
    // Update the list view specifically
    const trs = document.querySelectorAll('#knowledge-list-body tr');
    trs.forEach(tr => {
        if (tr.innerHTML.includes(currentKbIdForVersion)) {
            const versionSpan = tr.querySelector('.text-\\[10px\\].text-blue-500');
            if (versionSpan) {
                versionSpan.textContent = '当前版本: ' + nextVersion;
            }
        }
    });
}
window.confirmCreateKbVersion = confirmCreateKbVersion;

let pendingRollbackVersionId = null;

function openRollbackKbVersionModal(versionId) {
    pendingRollbackVersionId = versionId;
    const modal = document.getElementById("kb-version-rollback-modal");
    if (modal) modal.classList.remove("hidden");
}
window.openRollbackKbVersionModal = openRollbackKbVersionModal;

function closeRollbackKbVersionModal() {
    pendingRollbackVersionId = null;
    const modal = document.getElementById("kb-version-rollback-modal");
    if (modal) modal.classList.add("hidden");
}
window.closeRollbackKbVersionModal = closeRollbackKbVersionModal;

function confirmRollbackKbVersion() {
    if (!pendingRollbackVersionId) return;
    
    if (window.showToast) window.showToast("回滚成功", "success");
    
    closeRollbackKbVersionModal();
}
window.confirmRollbackKbVersion = confirmRollbackKbVersion;

let pendingDeleteVersionId = null;

function deleteKbVersion(versionId) {
    pendingDeleteVersionId = versionId;
    const modal = document.getElementById("kb-version-delete-modal");
    if (modal) modal.classList.remove("hidden");
}
window.deleteKbVersion = deleteKbVersion;

function closeDeleteKbVersionModal() {
    pendingDeleteVersionId = null;
    const modal = document.getElementById("kb-version-delete-modal");
    if (modal) modal.classList.add("hidden");
}
window.closeDeleteKbVersionModal = closeDeleteKbVersionModal;

function confirmDeleteKbVersion() {
    if (!pendingDeleteVersionId) return;
    
    if (kbVersionsStore[currentKbIdForVersion]) {
        kbVersionsStore[currentKbIdForVersion] = kbVersionsStore[currentKbIdForVersion].filter(v => v.id !== pendingDeleteVersionId);
        renderKbVersionList();
        if (window.showToast) window.showToast("版本已删除", "success");
    }
    
    closeDeleteKbVersionModal();
}
window.confirmDeleteKbVersion = confirmDeleteKbVersion;
