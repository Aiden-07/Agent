// Knowledge Base Hit Testing Logic

let currentTestKbId = null;
let currentTestResults = [];

window.initKbTestingPage = function(params) {
    console.log('Initializing KB Testing...', params);
    if (params && params.id) {
        currentTestKbId = params.id;
        loadKbInfo(params.id);
    } else {
        alert('未指定知识库ID');
        window.history.back();
    }
}

function loadKbInfo(id) {
    let kbName = '未知知识库';
    if (window.knowledgeData) {
        const kb = window.knowledgeData.find(k => k.id === id);
        if (kb) kbName = kb.name;
    }
    document.getElementById('test-kb-name-display').textContent = kbName;
}

window.runHitTest = function() {
    const query = document.getElementById('test-query-input').value.trim();
    const threshold = parseFloat(document.getElementById('test-threshold').value);
    const topK = parseInt(document.getElementById('test-top-k').value);
    
    if (!query) {
        alert('请输入测试文本');
        return;
    }
    
    const btn = document.querySelector('button[onclick="runHitTest()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 测试中...';
    
    // Simulate API Call
    setTimeout(() => {
        const results = generateMockTestResults(query, topK, threshold);
        currentTestResults = results;
        renderTestResults(results);
        
        btn.disabled = false;
        btn.innerHTML = originalText;
        
        // Update Badge
        const badge = document.getElementById('result-count-badge');
        badge.textContent = `${results.length} 条`;
        badge.classList.remove('hidden');
        
        // Show Pagination if needed
        const pagination = document.getElementById('test-pagination');
        if (results.length > 0) {
            pagination.classList.remove('hidden');
            document.getElementById('total-results').textContent = results.length;
        } else {
            pagination.classList.add('hidden');
        }
        
    }, 600);
}

function generateMockTestResults(query, count, threshold) {
    const results = [];
    const docs = ['用户需求规格说明书_v2.pdf', 'API接口定义_v1.0.docx', '常见问题解答_Q3.md', '部署操作手册.pdf'];
    
    for (let i = 0; i < count; i++) {
        const score = (Math.random() * (1 - threshold) + threshold).toFixed(4);
        if (score < threshold) continue; // Should not happen with this logic but good for realism
        
        // Create a context snippet with highlighting
        const snippet = `...系统应支持高并发访问，${query.substring(0, 5)}<span class="bg-yellow-200 text-yellow-800 font-medium rounded px-0.5">${query.substring(5, 15) || query}</span>${query.substring(15) || '...'}的相关功能需要在下个版本中重点优化...`;
        
        results.push({
            id: `RES-${i}`,
            docName: docs[Math.floor(Math.random() * docs.length)],
            score: parseFloat(score),
            content: snippet,
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString()
        });
    }
    
    return results.sort((a, b) => b.score - a.score);
}

window.sortTestResults = function() {
    const sortType = document.getElementById('result-sort').value;
    
    if (sortType === 'score') {
        currentTestResults.sort((a, b) => b.score - a.score);
    } else {
        currentTestResults.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    
    renderTestResults(currentTestResults);
}

function renderTestResults(results) {
    const container = document.getElementById('test-results-container');
    container.innerHTML = '';
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400">
                <i class="fa-solid fa-file-circle-xmark text-4xl mb-4 text-gray-300"></i>
                <p>未找到满足条件的命中结果</p>
                <p class="text-xs mt-2">请尝试降低匹配阈值或修改测试文本</p>
            </div>
        `;
        return;
    }
    
    results.forEach((item, index) => {
        const scorePercent = (item.score * 100).toFixed(1);
        let scoreColor = 'bg-green-100 text-green-700';
        if (item.score < 0.6) scoreColor = 'bg-red-100 text-red-700';
        else if (item.score < 0.8) scoreColor = 'bg-yellow-100 text-yellow-700';
        
        const div = document.createElement('div');
        div.className = 'p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm hover:border-blue-300 transition-all';
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-500">#${index + 1}</span>
                    <div class="flex items-center gap-1 text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        <i class="fa-regular fa-file-lines"></i>
                        <span class="truncate max-w-[200px]" title="${item.docName}">${item.docName}</span>
                    </div>
                </div>
                <span class="${scoreColor} px-2 py-0.5 rounded text-xs font-bold font-mono">
                    ${scorePercent}%
                </span>
            </div>
            <div class="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100 font-mono text-xs">
                ${item.content}
            </div>
            <div class="mt-2 flex justify-between items-center">
                 <div class="text-xs text-gray-400">
                    更新于: ${item.updatedAt}
                </div>
                <button class="text-xs text-blue-500 hover:text-blue-700 hover:underline">查看原文</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'knowledge-testing') {
        window.initKbTestingPage(e.detail.params);
    }
});
