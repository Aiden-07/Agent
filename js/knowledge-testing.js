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
    let kbName = '产品文档知识库';
    if (window.knowledgeData) {
        const kb = window.knowledgeData.find(k => k.id === id);
        if (kb) {
            kbName = kb.name;
            // Set default threshold from KB settings if available (default to 0.70)
            const defaultThreshold = kb.matchThreshold || 0.70;
            const thresholdInput = document.getElementById('test-threshold');
            if (thresholdInput) {
                thresholdInput.value = defaultThreshold;
                const valDisplay = document.getElementById('threshold-val');
                if (valDisplay) valDisplay.textContent = parseFloat(defaultThreshold).toFixed(2);
            }
        }
    }
    document.getElementById('test-kb-name-display').textContent = kbName;
}

window.runHitTest = function() {
    const query = document.getElementById('test-query-input').value.trim();
    const thresholdInput = document.getElementById('test-threshold');
    const threshold = parseFloat(thresholdInput.value);
    const topK = parseInt(document.getElementById('test-top-k').value);
    const weight = parseInt(document.getElementById('test-weight').value);
    const rerankModel = document.getElementById('rerank-model-select').value;
    
    if (!query) {
        alert('请输入测试文本');
        return;
    }

    if (isNaN(threshold) || threshold < 0.01 || threshold > 1.00) {
        alert('请输入有效的匹配阈值 (0.01 - 1.00)');
        return;
    }
    
    const btn = document.querySelector('button[onclick="runHitTest()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 测试中...';
    
    // Simulate API Call with new params
    console.log(`Running test with: Query="${query}", Threshold=${threshold}, TopK=${topK}, Weight=${weight}, Rerank=${rerankModel}`);

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
        
        // Removed Pagination Logic
        
    }, 600);
}

// Validate Threshold Input
window.validateThreshold = function(input) {
    let val = parseFloat(input.value);
    if (isNaN(val)) val = 0.70;
    if (val < 0.01) val = 0.01;
    if (val > 1.00) val = 1.00;
    input.value = val.toFixed(2);
    document.getElementById('threshold-val').textContent = val.toFixed(2);
}

window.viewDocParser = function(docId) {
    if (!docId) return;
    
    // Open in new tab using Hash Routing
    // This assumes the router handles hash changes on load (which it does)
    const url = `#/parser?id=${docId}`;
    window.open(url, '_blank');
}

function generateMockTestResults(query, count, threshold) {
    const results = [];
    
    // Try to use real mock docs from knowledge.js
    let availableDocs = [];
    if (window.getMockDocs) {
        availableDocs = window.getMockDocs();
    }
    
    // Fallback if no docs available
    if (availableDocs.length === 0) {
        const fallbackNames = ['用户需求规格说明书_v2.pdf', 'API接口定义_v1.0.docx', '常见问题解答_Q3.md', '部署操作手册.pdf'];
        availableDocs = fallbackNames.map((name, i) => ({
            id: `MOCK-RES-${i}`,
            name: name
        }));
    }
    
    for (let i = 0; i < count; i++) {
        // Ensure scores are above threshold for realism
        const score = (Math.random() * (1 - threshold) + threshold).toFixed(4);
        
        // Pick a random doc
        const doc = availableDocs[Math.floor(Math.random() * availableDocs.length)];
        
        // Generate random slice number
        const sliceSequence = Math.floor(Math.random() * 100) + 1;

        // Create a context snippet with highlighting
        // Make it look like a real slice content
        const prefix = "系统在高负载情况下表现稳定，但需要注意内存泄漏的风险。";
        const suffix = "建议定期进行压力测试，并监控服务器资源使用情况。对于数据库连接池的配置，应根据实际业务量进行调整。";
        const highlight = `<span class="bg-yellow-200 text-yellow-800 font-medium rounded px-0.5">${query || '关键信息'}</span>`;
        
        // Randomize position of query in snippet
        const snippet = Math.random() > 0.5 
            ? `${prefix}${highlight}${suffix}`
            : `${highlight}${prefix}${suffix}`;
        
        results.push({
            id: `RES-${i}`,
            docId: doc.id,
            docName: doc.name,
            score: parseFloat(score),
            content: snippet,
            sliceSequence: sliceSequence,
            updatedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString()
        });
    }
    
    // Sort descending by score
    return results.sort((a, b) => b.score - a.score);
}

window.sortTestResults = function() {
    // Deprecated sort control, but keeping logic if needed internally
    // Default is always score descending
    currentTestResults.sort((a, b) => b.score - a.score);
    renderTestResults(currentTestResults);
}

function renderTestResults(results) {
    const container = document.getElementById('test-results-container');
    container.innerHTML = '';
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                <i class="fa-solid fa-file-circle-xmark text-4xl mb-4 text-gray-300"></i>
                <p>未找到满足条件的命中结果</p>
                <p class="text-xs mt-2">请尝试降低匹配阈值或修改测试文本</p>
            </div>
        `;
        return;
    }

    // Header
    const headerHtml = `
        <div class="sticky top-0 z-10 grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-t-lg border border-gray-200 border-b-0 shadow-sm">
            <div class="col-span-1 text-center">序号</div>
            <div class="col-span-2">文档名称</div>
            <div class="col-span-7">切片信息</div>
            <div class="col-span-1 text-center">匹配度</div>
            <div class="col-span-1 text-center">操作</div>
        </div>
    `;

    // List Items
    let listHtml = '<div class="bg-white border border-gray-200 rounded-b-lg divide-y divide-gray-100">';
    
    results.forEach((item, index) => {
        const scorePercent = (item.score * 100).toFixed(1);
        let scoreColorClass = 'text-green-600 bg-green-50 border-green-100';
        if (item.score < 0.6) scoreColorClass = 'text-red-600 bg-red-50 border-red-100';
        else if (item.score < 0.8) scoreColorClass = 'text-yellow-600 bg-yellow-50 border-yellow-100';

        listHtml += `
            <div class="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-blue-50/30 transition-colors items-start group">
                <!-- Sequence -->
                <div class="col-span-1 text-center text-gray-500 font-medium pt-1">
                    ${index + 1}
                </div>
                
                <!-- Doc Name -->
                <div class="col-span-2 pt-1">
                    <div class="font-medium text-gray-800 text-sm truncate" title="${item.docName}">
                        <i class="fa-regular fa-file-lines mr-1.5 text-gray-400"></i>${item.docName}
                    </div>
                </div>
                
                <!-- Slice Info -->
                <div class="col-span-7">
                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                切片 #${item.sliceSequence}
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 leading-relaxed break-all bg-gray-50 p-2 rounded border border-gray-100">
                            ${item.content}
                        </p>
                    </div>
                </div>
                
                <!-- Score -->
                <div class="col-span-1 flex justify-center pt-1">
                    <div class="flex flex-col items-center">
                        <span class="px-2 py-1 rounded-md text-sm font-bold border ${scoreColorClass}">
                            ${item.score.toFixed(2)}
                        </span>
                    </div>
                </div>
                
                <!-- Action -->
                <div class="col-span-1 flex justify-center pt-1">
                    <button onclick="viewDocParser('${item.docId}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline flex items-center gap-1">
                        查看原文 <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    listHtml += '</div>';
    
    container.innerHTML = headerHtml + listHtml;
}
        


// Event Listener
document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'knowledge-testing') {
        window.initKbTestingPage(e.detail.params);
    }
});
