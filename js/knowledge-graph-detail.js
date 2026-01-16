// Mock Data for Knowledge Graph Documents
let kgDetailData = [];

// Initialize Knowledge Graph Detail Page
window.initKnowledgeGraphDetail = function(params) {
    const kgId = params && params.id ? params.id : null;
    console.log('Initializing KG Detail for ID:', kgId);

    // Generate Mock Data if empty
    if (kgDetailData.length === 0) {
        generateMockKgDetailData();
    }

    // Populate Filters
    populateKbFilter();

    // Render List
    renderKgDetailList();
};

function generateMockKgDetailData() {
    const kbs = ['公司规章制度库', '产品技术文档库', '客户服务知识库', '财务报销指引', '市场调研报告库'];
    const types = ['PDF', 'DOCX', 'TXT', 'MD', 'XLSX'];
    const statuses = ['building', 'success', 'failed'];
    const docNames = [
        '2024年第一季度财务报表', '员工入职培训手册', '产品技术架构说明书_V2.0', '客户满意度调查报告_2023',
        '服务器运维操作规范', '差旅报销管理制度', '市场竞争分析报告_Q1', 'API接口文档_v1.5',
        '知识图谱构建指南', '企业文化宣传手册'
    ];

    // Generated 20 items as requested
    kgDetailData = Array.from({ length: 20 }, (_, i) => {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const importDate = new Date();
        importDate.setDate(importDate.getDate() - Math.floor(Math.random() * 60)); // Past 60 days
        importDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        
        let buildDate = null;
        if (status === 'success' || status === 'failed') {
            buildDate = new Date(importDate);
            buildDate.setMinutes(buildDate.getMinutes() + Math.floor(Math.random() * 120)); // Build takes up to 2 hours
        }

        const docNameBase = docNames[i % docNames.length];
        const type = types[Math.floor(Math.random() * types.length)];

        return {
            id: i + 1,
            name: `${docNameBase}_${Math.random().toString(36).substring(7).toUpperCase()}.${type.toLowerCase()}`,
            kbName: kbs[Math.floor(Math.random() * kbs.length)],
            size: Math.floor(Math.random() * 1024 * 1024 * 50) + 1024, // 1KB - 50MB
            type: type,
            status: status,
            importTime: formatDate(importDate),
            buildTime: buildDate ? formatDate(buildDate) : '-'
        };
    });

    // Sort by Import Time Descending
    kgDetailData.sort((a, b) => new Date(b.importTime) - new Date(a.importTime));
}

function populateKbFilter() {
    const filterSelect = document.getElementById('kg-detail-filter-kb');
    if (!filterSelect) return;

    // Clear existing options except first
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }

    // Get unique KBs
    const kbs = [...new Set(kgDetailData.map(item => item.kbName))];
    
    kbs.forEach(kb => {
        const option = document.createElement('option');
        option.value = kb;
        option.textContent = kb;
        filterSelect.appendChild(option);
    });
}

function renderKgDetailList(data = kgDetailData) {
    const tbody = document.getElementById('kg-detail-list-body');
    const loading = document.getElementById('kg-detail-loading');
    const empty = document.getElementById('kg-detail-empty');

    if (!tbody) return;

    // Reset State
    tbody.innerHTML = '';
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    // Simulate Network Delay (Fast response < 200ms as requested)
    setTimeout(() => {
        loading.classList.add('hidden');

        if (data.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        // Render Rows
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 h-10'; // h-10 ~ 40px
            
            // Status Badge Logic
            let statusBadge = '';
            switch(item.status) {
                case 'building':
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <i class="fa-solid fa-spinner fa-spin mr-1"></i>构建中
                    </span>`;
                    break;
                case 'success':
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <i class="fa-solid fa-check mr-1"></i>构建成功
                    </span>`;
                    break;
                case 'failed':
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <i class="fa-solid fa-times mr-1"></i>构建失败
                    </span>`;
                    break;
            }

            row.innerHTML = `
                <td class="px-6 py-2 text-gray-500 whitespace-nowrap">${index + 1}</td>
                <td class="px-6 py-2">
                    <div class="font-medium text-gray-900 cursor-pointer hover:text-blue-600 truncate" onclick="viewDocDetail(${item.id})" title="${item.name}">
                        ${item.name}
                    </div>
                </td>
                <td class="px-6 py-2 text-gray-600 whitespace-nowrap truncate max-w-[120px]" title="${item.kbName}">${item.kbName}</td>
                <td class="px-6 py-2 text-gray-500 whitespace-nowrap">${formatSize(item.size)}</td>
                <td class="px-6 py-2 text-gray-500 uppercase whitespace-nowrap">${item.type}</td>
                <td class="px-6 py-2 whitespace-nowrap">${statusBadge}</td>
                <td class="px-6 py-2 text-gray-500 text-xs whitespace-nowrap">${item.importTime}</td>
                <td class="px-6 py-2 text-gray-500 text-xs whitespace-nowrap">${item.buildTime}</td>
                <td class="px-6 py-2 text-center whitespace-nowrap">
                     <button onclick="showDocActions(event, ${item.id})" class="text-gray-400 hover:text-blue-600 transition-colors p-1.5 rounded-full hover:bg-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

    }, 150); // < 200ms response
}

// Filter Function
window.filterKgDetailList = function() {
    const searchInput = document.getElementById('kg-detail-search');
    const kbFilter = document.getElementById('kg-detail-filter-kb');
    const statusFilter = document.getElementById('kg-detail-filter-status');

    const searchValue = searchInput ? searchInput.value.toLowerCase() : '';
    const kbValue = kbFilter ? kbFilter.value : '';
    const statusValue = statusFilter ? statusFilter.value : '';

    const filteredData = kgDetailData.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchValue);
        const matchKb = kbValue === '' || item.kbName === kbValue;
        const matchStatus = statusValue === '' || item.status === statusValue;
        return matchName && matchKb && matchStatus;
    });

    renderKgDetailList(filteredData);
};

// Action Handlers
window.showDocActions = function(event, id) {
    const actions = [
        {
            label: '查看详情',
            icon: 'fa-regular fa-eye',
            onClick: () => viewDocDetail(id)
        },
        {
            label: '重新构建',
            icon: 'fa-solid fa-rotate',
            onClick: () => rebuildDoc(id)
        },
        {
            label: '移除文档',
            icon: 'fa-regular fa-trash-can',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-400',
            onClick: () => removeDoc(id)
        }
    ];
    showActionMenu(event, actions);
};

window.viewDocDetail = function(id) {
    showToast(`查看文档 ID: ${id} (功能开发中)`, 'success');
};

window.rebuildDoc = function(id) {
    showToast(`正在重新构建文档 ID: ${id}...`, 'success');
    // Simulate rebuild status change
    const doc = kgDetailData.find(d => d.id === id);
    if (doc) {
        doc.status = 'building';
        renderKgDetailList();
        
        setTimeout(() => {
            doc.status = 'success';
            doc.buildTime = formatDate(new Date());
            renderKgDetailList();
            showToast(`文档 ID: ${id} 构建完成`, 'success');
        }, 2000);
    }
};

window.removeDoc = function(id) {
    if(confirm('确定要移除该文档吗？')) {
        kgDetailData = kgDetailData.filter(d => d.id !== id);
        renderKgDetailList();
        showToast('文档已移除', 'success');
    }
};
