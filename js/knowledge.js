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

function initKnowledgePage() {
    if (knowledgeData.length === 0) {
        knowledgeData = generateMockKnowledge(10);
    }
    renderKnowledgeList();

    // Check for saved state and restore if applicable
    const savedView = localStorage.getItem('currentView');
    const savedKbId = localStorage.getItem('currentKbId');
    
    if (savedView === 'detail' && savedKbId) {
        showKbDetail(savedKbId);
        
        const savedDocId = localStorage.getItem('kbSelectedDocId');
        if (savedDocId) {
            selectDoc(savedDocId);
        }
    } else {
        // Ensure we are in list view if no state
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
            status: Math.random() > 0.1 ? 'synced' : 'syncing',
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
        
        const statusClass = item.status === 'synced' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600';
        const statusText = item.status === 'synced' ? '已同步' : '同步中';

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <i class="fa-solid fa-book"></i>
                    </div>
                    <div class="font-medium text-gray-900">${item.name}</div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">${item.tag}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.docCount}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.updatedAt}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.creator}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.permission}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="showKbDetail('${item.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="查看">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button onclick="window.switchView('knowledge-settings', { id: '${item.id}' })" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="设置">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                    <button onclick="window.switchView('knowledge-testing', { id: '${item.id}' })" class="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="命中测试">
                        <i class="fa-solid fa-bullseye"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.deleteKb('${item.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function submitCreateKb() {
    const nameEl = document.getElementById('create-kb-name');
    const descEl = document.getElementById('create-kb-desc');
    const parserEl = document.getElementById('create-kb-parser');
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
    
    // Create new KB
    const newKb = {
        id: window.generateId ? window.generateId('KB') : `KB-${Date.now()}`,
        name: name,
        description: desc,
        tag: '未分类',
        docCount: 0,
        status: 'synced',
        updatedAt: new Date().toLocaleString(),
        creator: 'Admin', // Current user
        permission: '私有',
        parser: parserEl.value,
        chunkSize: 500
    };
    
    knowledgeData.unshift(newKb);
    renderKnowledgeList();
    closeModal('create-kb-modal');
    
    // Clear Form
    nameEl.value = '';
    descEl.value = '';
    parserEl.value = 'general';
    
    // Redirect to detail view (document list)
    showKbDetail(newKb.id, 'list');
}

// Navigation & View Switching
function showKbDetail(kbId) {
    currentKbId = kbId;
    
    // Generate mock docs for this KB (if not already generated or if switching KBs)
    // In a real app, this would fetch from API
    // Generate more docs to test infinite scroll
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
                <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-gray-500">${doc.updatedAt}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openParseModal('${doc.id}')" class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="查看解析结果">
                    <i class="fa-solid fa-layer-group"></i>
                </button>
                <button onclick="selectDoc('${doc.id}')" class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="预览">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button onclick="event.stopPropagation(); window.prepareDeleteDoc('${doc.id}')" class="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="删除">
                    <i class="fa-solid fa-trash"></i>
                </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
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

// Expose functions to window for HTML onclick access
window.selectDoc = selectDoc;
window.showKbDetail = showKbDetail;

function selectDoc(docId) {
    console.log('selectDoc called with:', docId);
    selectedDocId = docId;
    renderDocTree(); // Re-render to update selection highlight
    
    // Find doc in mockDocs OR mockTreeData
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
            // Adapt tree node to doc format
            doc = {
                id: treeNode.id,
                name: treeNode.name,
                type: treeNode.fileType,
                size: `${(Math.random() * 5).toFixed(2)} MB`,
                status: 'indexed',
                updatedAt: new Date().toLocaleString()
            };
        }
    }
    
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

// --- Doc More Menu Logic ---
window.toggleDocMoreMenu = function(event) {
    event.stopPropagation();
    const menu = document.getElementById('doc-more-menu');
    if (menu) {
        menu.classList.toggle('hidden');
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
    }
});
