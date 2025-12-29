// Mock Parser Data
window.parserData = [
    {
        id: 'p1',
        name: 'PDF简历解析',
        sourceFormat: 'PDF / Text',
        targetSchema: 'CandidateProfile',
        successRate: '98.5%',
        status: 'ready',
        icon: 'fa-file-code',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600'
    },
    {
        id: 'p2',
        name: '发票OCR提取',
        sourceFormat: 'Image / PDF',
        targetSchema: 'InvoiceData',
        successRate: '92.0%',
        status: 'ready',
        icon: 'fa-file-invoice',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600'
    },
    {
        id: 'p3',
        name: '邮件意图分类',
        sourceFormat: 'Email Text',
        targetSchema: 'IntentLabel',
        successRate: '--',
        status: 'draft',
        icon: 'fa-envelope',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600'
    }
];

window.renderParserList = function() {
    const tbody = document.getElementById('parser-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.parserData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        const statusHtml = item.status === 'ready' 
            ? '<span class="px-2 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">Ready</span>'
            : '<span class="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Draft</span>';

        const successRateClass = item.successRate === '--' ? 'text-gray-400' 
            : (parseFloat(item.successRate) > 90 ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium');

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center">
                        <i class="fa-solid ${item.icon}"></i>
                    </div>
                    <span class="font-medium text-gray-900">${item.name}</span>
                </div>
            </td>
            <td class="px-6 py-4">${item.sourceFormat}</td>
            <td class="px-6 py-4 text-gray-500">${item.targetSchema}</td>
            <td class="px-6 py-4 ${successRateClass}">${item.successRate}</td>
            <td class="px-6 py-4">
                ${statusHtml}
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.openParserActions(event, '${item.id}')" class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.openParserActions = function(event, id) {
    const actions = [
        {
            label: '编辑',
            icon: 'fa-solid fa-pen',
            onClick: () => window.location.href = 'views/parser-edit.html?id=' + id
        },
        {
            label: '删除',
            icon: 'fa-solid fa-trash',
            className: 'text-red-600 hover:bg-red-50',
            iconClass: 'text-red-500',
            onClick: () => {
                if(confirm('确定要删除该解析规则吗？')) {
                    window.parserData = window.parserData.filter(p => p.id !== id);
                    window.renderParserList();
                }
            }
        }
    ];
    window.showActionMenu(event, actions);
};

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'parser') {
        const params = e.detail.params;
        const listView = document.getElementById('parser-list-view');
        const detailView = document.getElementById('parser-detail-view');
        
        if (params && params.id) {
            // Detail Mode
            if (listView) listView.classList.add('hidden');
            if (detailView) detailView.classList.remove('hidden');
            
            // Initialize Parse Data using exposed function from knowledge.js
            if (window.initParseData) {
                console.log('Initializing parser details for:', params.id);
                window.initParseData(params.id);
            } else {
                console.error('initParseData not found. Ensure knowledge.js is loaded.');
                // Fallback or retry logic could go here
                // For now, assume it's loaded as they are both in index.html
                if (detailView) detailView.innerHTML = '<div class="p-8 text-center text-red-500">无法加载解析详情：功能模块未就绪</div>';
            }
        } else {
            // List Mode
            if (listView) listView.classList.remove('hidden');
            if (detailView) detailView.classList.add('hidden');
            
            window.renderParserList();
        }
    }
});

// Auto-render if loaded directly (unlikely but safe)
if (document.getElementById('parser-list-body')) {
    window.renderParserList();
}
