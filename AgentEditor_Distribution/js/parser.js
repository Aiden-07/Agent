// Mock Parser Data
window.parserData = [
    {
        id: 'p1',
        name: 'PDF简历解析',
        description: '用于从PDF格式的简历中提取候选人关键信息，包括姓名、联系方式、工作经历等。',
        type: 'rule',
        version: '0.1.0',
        sourceFormat: 'PDF / Text',
        callCount: 1234,
        knowledgeBase: '知识库A',
        chunkStrategy: 'custom',
        chunkSeparator: '\\n\\n',
        chunkMaxLength: 500,
        chunkOverlap: 50,
        // Parsing Strategy Params
        parsingStrategy: 'deep',
        imageParsingStrategy: 'ocr',
        vlPrompt: '',
        // Default Strategy Params
        chunkDefaultMaxLength: 1000,
        // Parent-Child Strategy Params
        chunkParentMode: 'identifier',
        chunkParentIdentifier: '\\n\\n',
        chunkParentMaxLength: 1000,
        chunkChildIdentifier: '\\n',
        chunkChildMaxLength: 100,
        // Title Strategy Params
        chunkTitleMaxLength: 1500,
        chunkTitleLevels: ['h1', 'h2', 'h3'],
        // Retrieval Settings
        embeddingModel: 'Qwen3-Embedding-8B',
        retrievalThreshold: 0.01,
        retrievalTopK: 3,
        retrievalWeight: 0.5,
        rerankModel: 'Qwen3-Reranker-8B',
        icon: 'fa-file-code',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600'
    },
    {
        id: 'p2',
        name: '发票OCR提取',
        description: '识别增值税发票、行程单等财务票据的关键字段。',
        type: 'model',
        version: 'v0.1.0',
        sourceFormat: 'Image / PDF',
        callCount: 856,
        knowledgeBase: '财务文档库',
        chunkStrategy: 'default',
        // Retrieval Settings
        embeddingModel: 'Qwen3-Embedding-4B',
        retrievalThreshold: 0.02,
        retrievalTopK: 5,
        retrievalWeight: 0.6,
        rerankModel: 'Qwen3-Reranker-4B',
        icon: 'fa-file-invoice',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600'
    },
    {
        id: 'p3',
        name: '邮件意图分类',
        description: '分析客户邮件内容，自动归类为投诉、咨询、建议等意图。',
        type: 'model',
        version: '0.1.0',
        sourceFormat: 'Email Text',
        callCount: 42,
        knowledgeBase: '客户服务库',
        chunkStrategy: 'default',
        // Retrieval Settings
        embeddingModel: 'Qwen3-Embedding-0.6B',
        retrievalThreshold: 0.03,
        retrievalTopK: 3,
        retrievalWeight: 0.4,
        rerankModel: 'Qwen3-Reranker-0.6B',
        icon: 'fa-envelope',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600'
    }
];

window.renderParserRetrievalConfig = function() {
    const container = document.getElementById('parser-retrieval-config');
    if (!container) return;
    container.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">匹配度阈值</label>
            <div class="flex items-center gap-4">
                <input type="range" id="parser-retrieval-threshold" min="0" max="1" step="0.01" value="0.01"
                       oninput="document.getElementById('parser-retrieval-threshold-val').textContent = this.value"
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                <span id="parser-retrieval-threshold-val" class="text-sm text-gray-600 font-mono w-12 text-right">0.01</span>
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">返回结果数量 (Top K)</label>
            <div class="flex items-center gap-4">
                <input type="range" id="parser-retrieval-topk" min="1" max="10" step="1" value="3"
                       oninput="document.getElementById('parser-retrieval-topk-val').textContent = this.value"
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                <span id="parser-retrieval-topk-val" class="text-sm text-gray-600 font-mono w-12 text-right">3</span>
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">权重设置</label>
            <div class="flex items-center gap-4">
                <span class="text-xs text-gray-500 w-12 text-right">关键字</span>
                <input type="range" id="parser-retrieval-weight" min="0" max="1" step="0.1" value="0.5"
                       oninput="document.getElementById('parser-retrieval-weight-val').textContent = this.value"
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                <span class="text-xs text-gray-500 w-12">语义</span>
                <span id="parser-retrieval-weight-val" class="text-sm text-gray-600 font-mono w-12 text-right">0.5</span>
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Rerank 模型</label>
            <select id="parser-retrieval-rerank-model" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="Qwen3-Reranker-8B">Qwen3-Reranker-8B</option>
                <option value="Qwen3-Reranker-4B">Qwen3-Reranker-4B</option>
                <option value="Qwen3-Reranker-0.6B">Qwen3-Reranker-0.6B</option>
            </select>
        </div>
    `;
};

window.initParserSettings = function(id) {
    const parser = window.parserData.find(p => p.id === id);
    if (!parser) return;
    
    if (window.renderParserRetrievalConfig) window.renderParserRetrievalConfig();
    
    // Fill Basic Info
    const nameEl = document.getElementById('setting-name');
    if(nameEl) nameEl.value = parser.name;
    
    const descEl = document.getElementById('setting-description');
    if(descEl) descEl.value = parser.description || '';
    
    const typeEl = document.getElementById('setting-type');
    if(typeEl) typeEl.value = parser.type || 'rule';
    
    const verEl = document.getElementById('setting-version');
    if(verEl) verEl.value = parser.version || 'v1.0.0';
    
    // Fill Chunk Settings
    const strategy = parser.chunkStrategy || 'default';
    const radios = document.getElementsByName('chunk_strategy');
    for(let radio of radios) {
        if(radio.value === strategy) radio.checked = true;
    }
    
    // Helper to set identifier Select/Input
    const setIdentifierValue = (selectId, inputId, value) => {
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);
        if(!select || !input) return;
        const opts = Array.from(select.options).map(o => o.value).filter(v => v !== 'custom');
        if(opts.includes(value)) {
            select.value = value;
            input.classList.add('hidden');
        } else {
            select.value = 'custom';
            input.value = value;
            input.classList.remove('hidden');
        }
    };

    setIdentifierValue('setting-separator', 'setting-separator-input', parser.chunkSeparator || '\\n');
    
    const maxLenEl = document.getElementById('setting-max-length');
    if(maxLenEl) maxLenEl.value = parser.chunkMaxLength || 500;
    
    const overlapEl = document.getElementById('setting-overlap');
    if(overlapEl) overlapEl.value = parser.chunkOverlap || 50;

    // Default Strategy Params
    const defMax = document.getElementById('default-max-length');
    if(defMax) defMax.value = parser.chunkDefaultMaxLength || 1000;

    // Parent-Child Strategy Params
    const pcMode = parser.chunkParentMode || 'identifier';
    const pcRadios = document.getElementsByName('pc_parent_mode');
    for(let r of pcRadios) {
        if(r.value === pcMode) r.checked = true;
    }

    setIdentifierValue('pc-parent-identifier-select', 'pc-parent-identifier-input', parser.chunkParentIdentifier || '\\n\\n');

    const pcPMax = document.getElementById('pc-parent-max-length');
    if(pcPMax) pcPMax.value = parser.chunkParentMaxLength || 1000;

    setIdentifierValue('pc-child-identifier-select', 'pc-child-identifier-input', parser.chunkChildIdentifier || '\\n');

    const pcCMax = document.getElementById('pc-child-max-length');
    if(pcCMax) pcCMax.value = parser.chunkChildMaxLength || 100;
    
    if(window.toggleParentMode) window.toggleParentMode();
    if(window.validateChildLength) window.validateChildLength();

    // Title Strategy Params
    const tMax = document.getElementById('title-max-length');
    if(tMax) tMax.value = parser.chunkTitleMaxLength || 1500;
    
    const levels = parser.chunkTitleLevels || ['h1', 'h2', 'h3'];
    const levelSelect = document.getElementById('title-levels');
    if(levelSelect) {
        let levelVal = 3;
        if(levels && levels.length > 0) levelVal = levels.length;
        if(levelVal < 1) levelVal = 1;
        if(levelVal > 5) levelVal = 5;
        levelSelect.value = levelVal;
    }
    
    window.toggleChunkSettings();
    
    // Embedding Settings
    const embeddingModelSelect = document.getElementById('parser-embedding-model');
    if(embeddingModelSelect) embeddingModelSelect.value = parser.embeddingModel || 'Qwen3-Embedding-8B';
    
    // Retrieval Settings
    const threshold = document.getElementById('parser-retrieval-threshold');
    if(threshold) {
        threshold.value = parser.retrievalThreshold !== undefined ? parser.retrievalThreshold : 0.01;
        document.getElementById('parser-retrieval-threshold-val').textContent = threshold.value;
    }
    
    const topK = document.getElementById('parser-retrieval-topk');
    if(topK) {
        topK.value = parser.retrievalTopK !== undefined ? parser.retrievalTopK : 3;
        document.getElementById('parser-retrieval-topk-val').textContent = topK.value;
    }
    
    const weight = document.getElementById('parser-retrieval-weight');
    if(weight) {
        weight.value = parser.retrievalWeight !== undefined ? parser.retrievalWeight : 0.5;
        document.getElementById('parser-retrieval-weight-val').textContent = weight.value;
    }
    
    const rerankModel = document.getElementById('parser-retrieval-rerank-model');
    if(rerankModel) rerankModel.value = parser.rerankModel || 'Qwen3-Reranker-8B';
    
    // Set display name in header
    const nameDisplay = document.getElementById('setting-name-display');
    if(nameDisplay) nameDisplay.textContent = parser.name;

    // Initialize Parsing Strategies List
    if(window.renderParsingStrategies) {
        window.renderParsingStrategies();
    }

    // Initialize Preview Module
    if(window.initParserPreview) {
        window.initParserPreview(id);
    }
};

window.toggleChunkSettings = function() {
    const checkedRadio = document.querySelector('input[name="chunk_strategy"]:checked');
    if(!checkedRadio) return;
    
    const strategy = checkedRadio.value;
    
    const toggle = (id, show) => {
        const el = document.getElementById(id);
        if(el) {
            if(show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    };
    
    toggle('default-chunk-settings', strategy === 'default');
    toggle('custom-chunk-settings', strategy === 'custom');
    toggle('parent_child-chunk-settings', strategy === 'parent_child');
    toggle('title-chunk-settings', strategy === 'title');
};

window.toggleIdentifierInput = function(select, inputId) {
    const input = document.getElementById(inputId);
    if(!input) return;
    if(select.value === 'custom') {
        input.classList.remove('hidden');
    } else {
        input.classList.add('hidden');
    }
};

window.restoreDefaultChunkSettings = function() {
    const sepSelect = document.getElementById('setting-separator');
    const sepInput = document.getElementById('setting-separator-input');
    if(sepSelect) sepSelect.value = '\\n';
    if(sepInput) {
        sepInput.classList.add('hidden');
        sepInput.value = '';
    }
    
    const maxLenEl = document.getElementById('setting-max-length');
    if(maxLenEl) maxLenEl.value = 500;
    
    const overlapEl = document.getElementById('setting-overlap');
    if(overlapEl) overlapEl.value = 50;
};

window.toggleParentMode = function() {
    const checkedRadio = document.querySelector('input[name="pc_parent_mode"]:checked');
    if(!checkedRadio) return;
    
    const mode = checkedRadio.value;
    const paramsDiv = document.getElementById('pc-parent-params');
    
    if(paramsDiv) {
        if(mode === 'identifier') {
            paramsDiv.classList.remove('hidden');
            paramsDiv.classList.add('grid');
        } else {
            paramsDiv.classList.add('hidden');
            paramsDiv.classList.remove('grid');
        }
    }
    
    window.validateChildLength();
};

window.validateChildLength = function() {
    const parentModeRadio = document.querySelector('input[name="pc_parent_mode"]:checked');
    const parentMode = parentModeRadio ? parentModeRadio.value : 'identifier';
    
    const parentMaxEl = document.getElementById('pc-parent-max-length');
    const childMaxEl = document.getElementById('pc-child-max-length');
    const errorEl = document.getElementById('pc-child-error');
    
    if(!childMaxEl) return;
    
    let isValid = true;
    let errorMsg = '';
    
    const childVal = parseInt(childMaxEl.value) || 0;
    
    // Min constraint
    if(childVal < 50) {
        isValid = false;
        errorMsg = '子切片长度不能小于 50';
    }
    
    if(isValid) {
        let maxLimit = 6000;
        if(parentMode === 'identifier' && parentMaxEl) {
            maxLimit = parseInt(parentMaxEl.value) || 6000;
        }
        
        if(childVal > maxLimit) {
            isValid = false;
            errorMsg = `子切片长度不能超过父切片长度 (${maxLimit})`;
        }
    }
    
    if(errorEl) {
        if(!isValid) {
            errorEl.textContent = errorMsg;
            errorEl.classList.remove('hidden');
            childMaxEl.classList.add('border-red-500', 'focus:ring-red-500');
            childMaxEl.classList.remove('border-gray-300', 'focus:ring-blue-500');
        } else {
            errorEl.classList.add('hidden');
            childMaxEl.classList.remove('border-red-500', 'focus:ring-red-500');
            childMaxEl.classList.add('border-gray-300', 'focus:ring-blue-500');
        }
    }
    
    return isValid;
};

window.saveParserSettings = function() {
    if(confirm('确定要保存修改吗？')) {
        // Mock Save Logic - Update local data
        const hash = window.location.hash;
        if(hash.includes('id=')) {
            const id = hash.split('id=')[1];
            const parser = window.parserData.find(p => p.id === id);
            if(parser) {
                const nameEl = document.getElementById('setting-name');
                if(nameEl) {
                    parser.name = nameEl.value;
                    const nameDisplay = document.getElementById('setting-name-display');
                    if(nameDisplay) nameDisplay.textContent = parser.name;
                }
                
                const descEl = document.getElementById('setting-description');
                if(descEl) parser.description = descEl.value;

                // Save Parsing Strategies List
                const tbody = document.getElementById('parsing-strategy-body');
                if(tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    const strategies = [];
                    rows.forEach(row => {
                        const keywordInput = row.querySelector('input[type="text"]');
                        const engineSelect = row.querySelector('select');
                        if(keywordInput && engineSelect) {
                            strategies.push({
                                id: parseInt(row.dataset.id),
                                keyword: keywordInput.value,
                                engine: engineSelect.value
                            });
                        }
                    });
                    window.parsingStrategies = strategies;
                }

                const checkedRadio = document.querySelector('input[name="chunk_strategy"]:checked');
                if(checkedRadio) {
                    parser.chunkStrategy = checkedRadio.value;
                    
                    // Helper to get identifier value
                    const getIdentifierValue = (selectId, inputId, label) => {
                        const select = document.getElementById(selectId);
                        const input = document.getElementById(inputId);
                        let val = select ? select.value : '';
                        if(val === 'custom') {
                            val = input ? input.value : '';
                            if(!val) {
                                throw new Error(`${label}不能为空`);
                            }
                        }
                        return val;
                    };

                    // Save Default (Deprecated logic kept for compatibility if needed, but UI is gone)
                    // ...

                    try {
                        // Save Custom
                        if(parser.chunkStrategy === 'custom') {
                             const sepVal = getIdentifierValue('setting-separator', 'setting-separator-input', '切片标识符');
                             parser.chunkSeparator = sepVal;
                             
                             const maxLenEl = document.getElementById('setting-max-length');
                             if(maxLenEl) parser.chunkMaxLength = parseInt(maxLenEl.value);
                             
                             const overlapEl = document.getElementById('setting-overlap');
                             if(overlapEl) parser.chunkOverlap = parseInt(overlapEl.value);
                        }
                        
                        // Save Parent-Child
                        if(parser.chunkStrategy === 'parent_child') {
                            if(window.validateChildLength && !window.validateChildLength()) {
                                if(window.showToast) window.showToast('父子切片参数配置有误，请检查红色提示项', 'error');
                                else alert('父子切片参数配置有误，请检查红色提示项');
                                return;
                            }
    
                            const pcModeRadio = document.querySelector('input[name="pc_parent_mode"]:checked');
                            if(pcModeRadio) parser.chunkParentMode = pcModeRadio.value;
                            
                            if(parser.chunkParentMode === 'identifier') {
                                const pcPId = getIdentifierValue('pc-parent-identifier-select', 'pc-parent-identifier-input', '父切片标识符');
                                parser.chunkParentIdentifier = pcPId;
                            }
                            
                            const pcPMax = document.getElementById('pc-parent-max-length');
                            if(pcPMax) parser.chunkParentMaxLength = parseInt(pcPMax.value);
                            
                            const pcCId = getIdentifierValue('pc-child-identifier-select', 'pc-child-identifier-input', '子切片标识符');
                            parser.chunkChildIdentifier = pcCId;
                            
                            const pcCMax = document.getElementById('pc-child-max-length');
                            if(pcCMax) parser.chunkChildMaxLength = parseInt(pcCMax.value);
                        }
                    } catch(e) {
                        if(window.showToast) window.showToast(e.message, 'error');
                        else alert(e.message);
                        return;
                    }
                    
                    // Save Title
                    const tMax = document.getElementById('title-max-length');
                    if(tMax) parser.chunkTitleMaxLength = parseInt(tMax.value);
                    
                    const levelSelect = document.getElementById('title-levels');
                    if(levelSelect) {
                        const count = parseInt(levelSelect.value);
                        const levels = [];
                        for(let i=1; i<=count; i++) {
                            levels.push('h' + i);
                        }
                        parser.chunkTitleLevels = levels;
                    }
                    
                    // Removed deprecated params: chunkTitleIncludeSub, chunkTitleSensitivity
                }
                
                // Save Embedding Settings
                if(document.getElementById('parser-embedding-model')) {
                    parser.embeddingModel = document.getElementById('parser-embedding-model').value;
                }
                
                // Save Retrieval Settings
                const retrievalThreshold = document.getElementById('parser-retrieval-threshold');
                const retrievalTopK = document.getElementById('parser-retrieval-topk');
                const retrievalWeight = document.getElementById('parser-retrieval-weight');
                const rerankModel = document.getElementById('parser-retrieval-rerank-model');
                
                if(retrievalThreshold) parser.retrievalThreshold = parseFloat(retrievalThreshold.value);
                if(retrievalTopK) parser.retrievalTopK = parseInt(retrievalTopK.value);
                if(retrievalWeight) parser.retrievalWeight = parseFloat(retrievalWeight.value);
                if(rerankModel) parser.rerankModel = rerankModel.value;
            }
        }
        
        if(window.showToast) window.showToast('配置已保存', 'success');
        else alert('配置已保存');
    }
};

window.renderParserList = function() {
    const tbody = document.getElementById('parser-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.parserData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        const formattedCallCount = item.callCount.toLocaleString() + '次';

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
            <td class="px-6 py-4 text-gray-600 font-medium">${formattedCallCount}</td>
            <td class="px-6 py-4">
                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    ${item.knowledgeBase}
                </span>
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
            icon: 'fa-solid fa-cog',
            onClick: () => {
                // 跳转至解析器设置界面 (即带 ID 的详情页)
                window.location.hash = '#/parser?id=' + id;
            }
        },
        // {
        //     label: '删除',
        //     icon: 'fa-solid fa-trash',
        //     // 置灰显示，不可点击状态，覆盖默认的 hover 效果
        //     className: 'text-gray-300 cursor-not-allowed hover:bg-white',
        //     iconClass: 'text-gray-300',
        //     onClick: () => {
        //         // 不执行任何操作
        //     }
        // }
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
            
            // Initialize Parser Settings
            if (window.initParserSettings) {
                window.initParserSettings(params.id);
            } else {
                if (detailView) detailView.innerHTML = '<div class="p-8 text-center text-red-500">无法加载配置界面</div>';
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

// Mock Articles for Preview
window.mockArticles = [
    { 
        id: 'a1', 
        title: '文档1.pdf', 
        content: '这是一个PDF文档的示例内容，包含了很多关于技术实现的细节。\n第一章：引言\n本文档旨在介绍系统的核心架构...', 
        createdTime: '2023-10-01 14:30'
    },
    { 
        id: 'a2', 
        title: '报告2023.docx', 
        content: '2023年度工作报告\n\n一、年度总结\n本年度公司业绩稳步增长，特别是在人工智能领域取得了突破性进展。', 
        createdTime: '2023-12-15 09:15'
    },
    { 
        id: 'a3', 
        title: '测试数据.xlsx', 
        content: 'ID,Name,Value\n1,Item A,100\n2,Item B,200\n3,Item C,300\n数据表格内容通常需要特殊的解析策略来保持结构。', 
        createdTime: '2024-01-05 16:45'
    },
    { 
        id: 'a4', 
        title: '产品需求规格说明书_v2.0.md', 
        content: '# 产品需求\n\n## 1. 用户故事\n作为一名用户，我希望能够快速查找文档，以便提高工作效率。\n\n## 2. 功能列表\n- 文档上传\n- 文档解析\n- 全文检索', 
        createdTime: '2024-02-10 11:20'
    },
    { 
        id: 'a5', 
        title: 'API接口文档.json', 
        content: '{\n  "version": "1.0.0",\n  "endpoints": [\n    {\n      "path": "/api/v1/users",\n      "method": "GET",\n      "description": "获取用户列表"\n    }\n  ]\n}', 
        createdTime: '2024-03-01 10:00'
    }
];

window.parsingStrategies = [
    { id: 1, keyword: '产品说明书', engine: 'paddle_ocr' },
    { id: 2, keyword: '产品图纸', engine: 'vl_model' }
];

window.deleteParsingStrategy = function(id) {
    if(confirm('确定要删除这条解析策略吗？')) {
        window.parsingStrategies = window.parsingStrategies.filter(s => s.id !== id);
        window.renderParsingStrategies();
        if(window.showToast) window.showToast('解析策略已删除', 'success');
    }
};

window.renderParsingStrategies = function() {
    const tbody = document.getElementById('parsing-strategy-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    window.parsingStrategies.forEach(strategy => {
        const tr = document.createElement('tr');
        tr.dataset.id = strategy.id;
        tr.innerHTML = `
            <td class="px-4 py-3">
                <input type="text" value="${strategy.keyword}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </td>
            <td class="px-4 py-3">
                <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="paddle_ocr" ${strategy.engine === 'paddle_ocr' ? 'selected' : ''}>Paddle_OCR解析</option>
                    <option value="vl_model" ${strategy.engine === 'vl_model' ? 'selected' : ''}>VL大模型解析</option>
                    <option value="basic_ocr" ${strategy.engine === 'basic_ocr' ? 'selected' : ''}>基础OCR解析</option>
                </select>
            </td>
            <td class="px-4 py-3 text-right">
                <button onclick="window.deleteParsingStrategy(${strategy.id})" class="text-red-500 hover:text-red-700 transition-colors">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.initParserPreview = function(parserId) {
    const dataList = document.getElementById('article-list');
    if (!dataList) return;
    
    dataList.innerHTML = '';
    window.mockArticles.forEach(article => {
        const option = document.createElement('option');
        option.value = article.title; 
        option.dataset.id = article.id;
        dataList.appendChild(option);
    });

    // Reset UI
    const searchInput = document.getElementById('article-search');
    if(searchInput) searchInput.value = '';
    
    const placeholder = document.getElementById('preview-placeholder');
    if(placeholder) placeholder.classList.remove('hidden');
    
    const loading = document.getElementById('preview-loading');
    if(loading) loading.classList.add('hidden');
    
    const results = document.getElementById('preview-results');
    if(results) results.classList.add('hidden');
};

window.runPreview = function() {
    const input = document.getElementById('article-search');
    const title = input.value.trim();
    
    if (!title) {
        if(window.showToast) window.showToast('请先选择要预览的文档', 'warning');
        else alert('请先选择要预览的文档');
        return;
    }

    const article = window.mockArticles.find(a => a.title === title);
    if (!article) {
         if(window.showToast) window.showToast('未找到该文档，请从列表中选择', 'error');
         else alert('未找到该文档，请从列表中选择');
         return;
    }

    // Show Loading
    document.getElementById('preview-placeholder').classList.add('hidden');
    document.getElementById('preview-results').classList.add('hidden');
    document.getElementById('preview-loading').classList.remove('hidden');

    // Simulate Network Delay
    setTimeout(() => {
        document.getElementById('preview-loading').classList.add('hidden');
        document.getElementById('preview-results').classList.remove('hidden');
        
        window.renderPreviewResults(article);
    }, 800);
};

window.renderPreviewResults = function(article) {
    const container = document.getElementById('preview-results');
    container.innerHTML = '';

    // Get current chunk settings to simulate effect
    let maxLength = 500;
            
            const strategyRadio = document.querySelector('input[name="chunk_strategy"]:checked');
            const strategy = strategyRadio ? strategyRadio.value : 'default';

            if (strategy === 'default') {
                const el = document.getElementById('default-max-length');
                if(el) maxLength = parseInt(el.value) || 1000;
            } else if (strategy === 'custom') {
                const el = document.getElementById('setting-max-length');
                if(el) maxLength = parseInt(el.value) || 500;
            } else if (strategy === 'parent_child') {
                const el = document.getElementById('pc-parent-max');
                if(el) maxLength = parseInt(el.value) || 2000;
            } else if (strategy === 'title') {
                const el = document.getElementById('title-max-length');
                if(el) maxLength = parseInt(el.value) || 1500;
            }
    
    // Mock Chunking Logic (Simple Split for visual demo)
    // Repeat content to ensure we have enough text to split if maxLength is small
    let content = article.content;
    while(content.length < maxLength * 2) {
        content += '\n\n' + article.content;
    }

    const chunks = [];
    for (let i = 0; i < content.length; i += maxLength) {
        chunks.push(content.substring(i, Math.min(i + maxLength, content.length)));
    }

    // Render Chunks
    chunks.forEach((chunk, index) => {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors group animate-fade-in-up';
        div.style.animationDelay = `${index * 50}ms`;
        
        // Truncate abstract for display
        const abstract = chunk.length > 100 ? chunk.substring(0, 100) + '...' : chunk;

        div.innerHTML = `
            <div class="flex justify-between items-start mb-2 pb-2 border-b border-gray-100">
                <div>
                    <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mr-2">分段 #${index + 1}</span>
                    <span class="text-sm font-medium text-gray-800">${article.title}</span>
                </div>
                <span class="text-xs text-gray-400 flex items-center gap-1">
                    <i class="fa-regular fa-clock"></i> ${article.createdTime}
                </span>
            </div>
            
            <div class="space-y-2">
                <div class="flex items-center gap-2 text-xs text-gray-500">
                   <span class="bg-gray-100 px-1.5 rounded">内容摘要</span>
                   <span>${chunk.length} 字符</span>
                </div>
                <p class="text-sm text-gray-700 leading-relaxed break-all font-mono text-xs whitespace-pre-wrap">${abstract}</p>
            </div>
        `;
        container.appendChild(div);
    });
};
