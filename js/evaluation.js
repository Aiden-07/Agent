// Evaluation Management Logic

let evaluationData = [];
let currentStep = 1;
let wizardConfig = {
    agent: null,
    dataset: null,
    weights: { 1: 40, 2: 30, 3: 15, 4: 15 }
};

const EVAL_NAMES = [
    '基础能力测试', '专业知识问答', '逻辑推理能力测试', '多轮对话一致性测试', 
    '代码生成质量评估', '文本摘要准确性', '情感分析准确率', '安全性与合规性测试'
];

function initEvaluationPage() {
    if (evaluationData.length === 0) {
        evaluationData = generateMockEvaluations(10);
    }
    renderEvaluationList();
}

function generateMockEvaluations(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        const id = window.generateId ? window.generateId('EVAL') : `EVAL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const name = EVAL_NAMES[i % EVAL_NAMES.length];
        const statusRand = Math.random();
        let status = 'completed';
        let progress = 100;
        let errorMsg = '';

        if (statusRand > 0.8) {
            status = 'pending';
            progress = 0;
        } else if (statusRand > 0.6) {
            status = 'running';
            progress = Math.floor(Math.random() * 90);
        } else if (statusRand > 0.55) {
            status = 'failed';
            progress = Math.floor(Math.random() * 80);
            errorMsg = 'API Connection Timeout';
        }
        
        data.push({
            id: id,
            name: name,
            agent: `Agent-${Math.floor(Math.random() * 5) + 1}`,
            status: status,
            progress: progress,
            errorMsg: errorMsg,
            creator: 'Admin',
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString(),
            completedAt: status === 'completed' ? new Date(Date.now() - Math.floor(Math.random() * 500000000)).toLocaleString() : '-'
        });
    }
    return data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderEvaluationList() {
    const tbody = document.getElementById('evaluation-list-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    evaluationData.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        
        let statusHtml = '';
        
        if (item.status === 'completed') {
            statusHtml = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">已完成</span>`;
        } else if (item.status === 'running') {
            statusHtml = `
                <div class="flex flex-col gap-1 w-24">
                    <div class="flex justify-between text-xs text-blue-600">
                        <span>进行中</span>
                        <span>${item.progress}%</span>
                    </div>
                    <div class="w-full bg-blue-100 rounded-full h-1.5">
                        <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${item.progress}%"></div>
                    </div>
                </div>`;
        } else if (item.status === 'failed') {
            statusHtml = `
                <div class="group relative">
                    <span class="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 cursor-help">已失败</span>
                    <div class="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                        原因: ${item.errorMsg || '未知错误'}
                    </div>
                </div>`;
        } else {
             statusHtml = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">排队中</span>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                        <i class="fa-solid fa-vial"></i>
                    </div>
                    <div class="font-medium text-gray-900">${item.name}</div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.agent}</td>
            <td class="px-6 py-4">
                ${statusHtml}
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">${item.creator}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.createdAt}</td>
            <td class="px-6 py-4 text-xs text-gray-500">${item.completedAt}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    ${item.status === 'completed' ? `
                    <button onclick="openEvalReport('${item.id}')" class="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="查看解析结果">
                        <i class="fa-solid fa-chart-pie"></i>
                    </button>` : ''}
                    <button class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="重新评测">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Report Logic
function openEvalReport(id) {
    const modal = document.getElementById('eval-report-modal');
    if (!modal) return;
    
    const task = evaluationData.find(t => t.id === id) || { name: '未知任务' };
    
    // Populate Header
    document.getElementById('report-title').textContent = `${task.name} - 测评报告`;
    const score = Math.floor(Math.random() * 15) + 85; // 85-99
    document.getElementById('report-score').textContent = `总分: ${score}`;
    
    // Populate Metrics
    const total = Math.floor(Math.random() * 30) + 20;
    const correct = Math.floor(total * (score / 100));
    const latency = (Math.random() * 1.5 + 0.5).toFixed(2);
    
    document.getElementById('metric-total').textContent = total;
    document.getElementById('metric-correct').textContent = correct;
    document.getElementById('metric-latency').textContent = latency + 's';
    document.getElementById('metric-errors').textContent = '0';
    
    // Populate Details
    const container = document.getElementById('report-details');
    container.innerHTML = '';
    
    for (let i = 1; i <= 3; i++) {
        container.innerHTML += `
            <div class="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div class="flex justify-between items-start mb-2">
                    <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Q${i}</span>
                    <span class="text-xs text-green-600 font-medium"><i class="fa-solid fa-check mr-1"></i>通过</span>
                </div>
                <p class="text-sm text-gray-800 font-medium mb-2">用户：如何配置系统的防火墙规则？</p>
                <div class="text-xs text-gray-600 bg-white p-3 rounded border border-gray-100">
                    <span class="font-semibold text-gray-400 mr-1">AI 回答：</span>
                    您可以进入系统设置 -> 安全中心 -> 防火墙配置页面进行规则添加。支持IP白名单、端口转发等设置...
                </div>
                <div class="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>准确性: 5.0</span>
                    <span>相关性: 4.8</span>
                    <span>流畅性: 5.0</span>
                </div>
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
}

function closeEvalReport() {
    const modal = document.getElementById('eval-report-modal');
    if (modal) modal.classList.add('hidden');
}

// Wizard Logic
// System Evaluators Configuration
const SYSTEM_EVALUATORS = [
    { id: 'SYS_EVAL_1', name: 'GPT-4 Evaluator', desc: 'OpenAI 官方推荐评测模型，准确度高，适合通用场景', icon: 'fa-brain', color: 'text-purple-600', bg: 'bg-purple-100' },
    { id: 'SYS_EVAL_2', name: 'Claude 3.5 Sonnet', desc: '擅长长文本逻辑分析与推理，适合复杂任务', icon: 'fa-robot', color: 'text-orange-600', bg: 'bg-orange-100' },
    { id: 'SYS_EVAL_3', name: 'Llama 3 70B', desc: '开源最强模型，响应速度快，成本低', icon: 'fa-bolt', color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 'SYS_EVAL_4', name: 'RAG 评测专家', desc: '专用于检索增强生成系统的准确性评测', icon: 'fa-search', color: 'text-green-600', bg: 'bg-green-100' },
    { id: 'SYS_EVAL_5', name: '代码审计专家', desc: '专注于代码生成质量、安全性与规范性评估', icon: 'fa-code', color: 'text-gray-600', bg: 'bg-gray-100' }
];

function openEvalWizard() {
    const modal = document.getElementById('eval-wizard-modal');
    if (modal) {
        modal.classList.remove('hidden');
        currentStep = 1;
        updateWizardUI();
        loadWizardAgents();
        loadSystemEvaluators();
    }
}

function loadSystemEvaluators() {
    const container = document.getElementById('system-evaluators-list');
    if (!container || container.children.length > 0) return;
    
    container.innerHTML = SYSTEM_EVALUATORS.map((evaluator, index) => `
        <label class="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all group">
            <input type="radio" name="eval-model" ${index === 0 ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500" onchange="selectEvaluator('${evaluator.name}')">
            <div class="ml-3 flex-1">
                <div class="flex items-center justify-between">
                    <div class="text-sm font-medium text-gray-900">${evaluator.name}</div>
                    <div class="w-6 h-6 rounded ${evaluator.bg} ${evaluator.color} flex items-center justify-center text-xs">
                        <i class="fa-solid ${evaluator.icon}"></i>
                    </div>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${evaluator.desc}</div>
            </div>
        </label>
    `).join('');
    
    // Default selection
    wizardConfig.evaluator = SYSTEM_EVALUATORS[0].name;
}

function selectEvaluator(name) {
    wizardConfig.evaluator = name;
}

function closeEvalWizard() {
    const modal = document.getElementById('eval-wizard-modal');
    if (modal) modal.classList.add('hidden');
}

function nextStep() {
    if (currentStep === 1 && !wizardConfig.agent) {
        alert('请选择一个智能体');
        return;
    }
    if (currentStep === 2 && !wizardConfig.dataset) {
        alert('请选择一个数据集');
        return;
    }
    if (currentStep === 3) {
        const total = Object.values(wizardConfig.weights).reduce((a, b) => a + parseInt(b), 0);
        if (total !== 100) {
            alert(`权重总和必须为 100%，当前为 ${total}%`);
            return;
        }
        updateConfirmationView();
    }
    if (currentStep === 4) {
        submitEvaluation();
        return;
    }
    
    currentStep++;
    updateWizardUI();
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
}

function updateWizardUI() {
    // Update Steps Indicator
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`step-ind-${i}`);
        const content = document.getElementById(`step-content-${i}`);
        
        if (i === currentStep) {
            el.className = 'flex-1 py-3 text-center text-sm font-medium text-blue-600 border-b-2 border-blue-600 transition-colors';
            content.classList.remove('hidden');
        } else if (i < currentStep) {
            el.className = 'flex-1 py-3 text-center text-sm font-medium text-gray-600 border-b-2 border-gray-200 transition-colors';
            content.classList.add('hidden');
        } else {
            el.className = 'flex-1 py-3 text-center text-sm font-medium text-gray-400 border-b-2 border-transparent transition-colors';
            content.classList.add('hidden');
        }
    }
    
    // Update Buttons
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    if (currentStep === 1) btnPrev.classList.add('hidden');
    else btnPrev.classList.remove('hidden');
    
    if (currentStep === 4) btnNext.textContent = '提交创建';
    else btnNext.textContent = '下一步';
}

function loadWizardAgents() {
    const container = document.getElementById('eval-agent-list');
    if (!container || container.children.length > 0) return; // Already loaded
    
    // Mock Agents
    const agents = [
        { id: 'A1', name: '客服助手 V1.0', type: '客服', time: '2023-10-15' },
        { id: 'A2', name: '代码审计员 Pro', type: '开发', time: '2023-11-02' },
        { id: 'A3', name: '销售话术机器人', type: '销售', time: '2023-09-20' },
        { id: 'A4', name: 'HR 招聘助手', type: '人力', time: '2023-10-05' },
        { id: 'A5', name: '数据分析师', type: '数据', time: '2023-11-10' },
        { id: 'A6', name: '文档编写助手', type: '办公', time: '2023-10-28' }
    ];
    
    container.innerHTML = agents.map(agent => `
        <div onclick="selectWizardAgent(this, '${agent.name}')" class="agent-card p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div>
                    <div class="font-medium text-sm text-gray-900">${agent.name}</div>
                    <div class="text-xs text-gray-500">${agent.type}</div>
                </div>
            </div>
            <div class="text-xs text-gray-400">更新于 ${agent.time}</div>
        </div>
    `).join('');
}

function selectWizardAgent(el, name) {
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
    el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
    wizardConfig.agent = name;
}

function selectDataset(el, type) {
    document.querySelectorAll('.dataset-card').forEach(c => c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
    el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
    
    const map = {
        'sales': { name: '销售客服标准问答库', count: 50 },
        'tech': { name: '技术支持常见问题集', count: 30 },
        'product': { name: '产品咨询场景库', count: 40 },
        'hr': { name: '人力资源面试题库', count: 25 }
    };
    wizardConfig.dataset = map[type];
}

function updateWeight(index, value) {
    // Validate value
    let val = parseInt(value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 100) val = 100;
    
    wizardConfig.weights[index] = val;
    
    // Sync Slider and Input
    const slider = document.getElementById(`weight-slider-${index}`);
    const input = document.getElementById(`weight-input-${index}`);
    
    if (slider) slider.value = val;
    if (input) input.value = val;
    
    // Update Total
    const total = Object.values(wizardConfig.weights).reduce((a, b) => a + parseInt(b), 0);
    const totalEl = document.getElementById('total-weight');
    totalEl.textContent = total + '%';
    
    if (total !== 100) totalEl.className = 'font-bold text-red-600';
    else totalEl.className = 'font-bold text-green-600';
}

function updateConfirmationView() {
    document.getElementById('confirm-agent-name').textContent = wizardConfig.agent;
    document.getElementById('confirm-dataset').textContent = wizardConfig.dataset.name;
    document.getElementById('confirm-sample-count').textContent = wizardConfig.dataset.count;
}

function submitEvaluation() {
    // Create new task
    const newTask = {
        id: `EVAL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: `评测任务-${new Date().getMonth()+1}${new Date().getDate()}-${Math.floor(Math.random()*100)}`,
        agent: wizardConfig.agent,
        status: 'pending', // 排队中
        progress: 0,
        creator: 'Product Manager',
        createdAt: new Date().toLocaleString(),
        completedAt: '-'
    };
    
    evaluationData.unshift(newTask);
    renderEvaluationList();
    closeEvalWizard();
    
    // Show Toast/Alert
    alert(`测评任务创建成功！\n任务ID: ${newTask.id}\n预计等待时间: 3-5分钟`);
    
    // Simulate progress
    setTimeout(() => {
        newTask.status = 'running';
        newTask.progress = 10;
        renderEvaluationList();
    }, 2000);
}

document.addEventListener('view-loaded', (e) => {
    if (e.detail.view === 'evaluation') {
        initEvaluationPage();
    }
});
