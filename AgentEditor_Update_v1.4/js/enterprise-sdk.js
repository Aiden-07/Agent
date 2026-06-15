/**
 * Enterprise Assistant SDK Window (Demo)
 * - Floating button opens a desktop-like assistant window
 * - Left: agent list + history list
 * - Right: chat area
 */
class EnterpriseAssistantSDK {
  constructor(config = {}) {
    this.config = {
      title: config.title || '企业智能助手',
      // 默认色系：参考截图风格（偏冷静蓝灰），避免红色系
      primaryColor: config.primaryColor || '#3b82f6', // blue-500
      zIndex: config.zIndex || 10050,
      storageKey: config.storageKey || `eas_sdk_pos_${(config.title || '企业智能助手').replace(/\s+/g, '_')}`,
      agents: Array.isArray(config.agents) && config.agents.length ? config.agents : [
        { id: 'agent-hr', name: '人事业务咨询', icon: 'fa-solid fa-user-tie' },
        { id: 'agent-trans', name: '翻译智能助手', icon: 'fa-solid fa-language' }
      ]
    };

    // 去掉调试/临时智能体（避免出现在左侧列表）
    this.config.agents = (this.config.agents || []).filter(a => !String(a && a.name || '').includes('调试'));

    this.state = {
      isOpen: false,
      activeAgentId: this.config.agents[0]?.id || null,
      conversations: new Map(), // agentId -> [{id, title, messages:[]}]
      activeConvId: null,
      historyQuery: '',
      sidebarCollapsed: false
    };

    // 左侧功能区收起/展开状态（持久化）
    try {
      const k = `${this.config.storageKey}_sidebarCollapsed`;
      this.state.sidebarCollapsed = JSON.parse(localStorage.getItem(k) || 'false');
    } catch (_) {}

    this._fabDrag = { dragging: false, moved: false };
    this._fabDock = null; // left/right/top/bottom/null

    this._ensureConversation();
    this._injectStylesOnce();
    this._mount();
    this._bindGlobalShortcuts();
    this._render();
  }

  // --- Public API ---
  open() {
    this.state.isOpen = true;
    this._renderVisibility();
    this._scrollToBottom();
  }

  close() {
    this.state.isOpen = false;
    this._renderVisibility();
  }

  toggle() {
    this.state.isOpen ? this.close() : this.open();
  }

  // --- Internals ---
  _ensureConversation() {
    const agentId = this.state.activeAgentId;
    if (!agentId) return;
    if (!this.state.conversations.has(agentId)) {
      const first = {
        id: `conv-${agentId}-0`,
        title: '今天气氛很好',
        messages: []
      };
      this.state.conversations.set(agentId, [first]);
      this.state.activeConvId = first.id;
      return;
    }
    const convs = this.state.conversations.get(agentId) || [];
    if (!convs.length) {
      const first = { id: `conv-${agentId}-0`, title: '新对话', messages: [] };
      this.state.conversations.set(agentId, [first]);
      this.state.activeConvId = first.id;
      return;
    }
    if (!this.state.activeConvId || !convs.some(c => c.id === this.state.activeConvId)) {
      this.state.activeConvId = convs[0].id;
    }
  }

  _createNewConversation({ agentId, title = '新对话' } = {}) {
    const aId = agentId || this.state.activeAgentId;
    if (!aId) return null;
    const convs = this.state.conversations.get(aId) || [];
    const conv = {
      id: `conv-${aId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      messages: []
    };
    convs.unshift(conv);
    this.state.conversations.set(aId, convs);
    this.state.activeConvId = conv.id;
    return conv;
  }

  _getActiveAgent() {
    const id = this.state.activeAgentId;
    return (this.config.agents || []).find(a => a && a.id === id) || null;
  }

  _injectStylesOnce() {
    if (document.getElementById('enterprise-assistant-sdk-style')) return;
    const style = document.createElement('style');
    style.id = 'enterprise-assistant-sdk-style';
    style.textContent = `
      .eas-fab{
        position: fixed;
        right: 22px;
        bottom: 22px;
        width: 56px;
        height: 56px;
        border-radius: 999px;
        background: radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 55%),
                    linear-gradient(135deg, ${this.config.primaryColor} 0%, #60a5fa 55%, #1d4ed8 100%);
        box-shadow: 0 14px 30px rgba(59, 130, 246, .28), 0 6px 14px rgba(0,0,0,.12);
        display:flex !important;
        align-items:center;
        justify-content:center;
        color:white;
        cursor: grab;
        z-index:${this.config.zIndex};
        opacity: 1 !important;
        visibility: visible !important;
        user-select:none;
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        border: none;
        outline: none;
      }
      /* 小屏适配（例如 14 寸低分辨率） */
      @media (max-width: 1024px){
        .eas-fab{ width: 48px; height: 48px; right: 14px; bottom: 14px; }
        .eas-fab i{ font-size: 20px; }
      }
      .eas-fab:hover{ transform: translateY(-2px) scale(1.02); filter:saturate(1.05); }
      .eas-fab:active{ transform: translateY(0) scale(.98); }
      .eas-fab.eas-dragging{ cursor: grabbing; transform: none !important; filter: none !important; }
      .eas-fab i{ font-size: 22px; }

      .eas-shell{
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index:${this.config.zIndex + 1};
      }
      .eas-backdrop{
        position:absolute; inset:0;
        background: rgba(15, 23, 42, .20);
        backdrop-filter: blur(4px);
      }
      .eas-window{
        position: relative;
        --eas-left-width: 280px;
        width: min(1120px, calc(100vw - 56px));
        height: min(680px, calc(100vh - 56px));
        box-sizing: border-box;
        padding-left: var(--eas-left-width);
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 28px 80px rgba(0,0,0,.28);
        overflow: hidden;
        display:flex;
        flex-direction: column;
      }
      .eas-header{
        height: 46px;
        display:flex;
        align-items:center;
        justify-content: space-between;
        padding: 0 12px 0 14px;
        background: #ffffff;
        color:#0f172a;
        font-weight: 600;
        letter-spacing:.2px;
        border-bottom: 1px solid #eef2f7;
      }
      .eas-header-left{
        display:flex; align-items:center; gap:10px;
        min-width: 0;
      }
      .eas-brand-dot{
        width: 22px; height: 22px; border-radius: 999px;
        display:flex; align-items:center; justify-content:center;
        background: #eff6ff;
        color: ${this.config.primaryColor};
        box-shadow: inset 0 0 0 1px #dbeafe;
      }
      .eas-title{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .eas-beat-badge{
        display:flex;
        align-items:center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-size: 11px;
        font-weight: 750;
        letter-spacing: .35px;
        flex: 0 0 auto;
      }
      .eas-beat-dot{
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: ${this.config.primaryColor};
        box-shadow: 0 0 0 0 rgba(59,130,246,.35);
        animation: easBeatPulse 1.15s ease-in-out infinite;
      }
      @keyframes easBeatPulse{
        0%, 100%{ transform: scale(1); opacity: .7; box-shadow: 0 0 0 0 rgba(59,130,246,.32); }
        45%{ transform: scale(1.25); opacity: 1; box-shadow: 0 0 0 8px rgba(59,130,246,0); }
      }
      @media (prefers-reduced-motion: reduce){
        .eas-beat-dot{ animation: none; }
      }
      .eas-header-actions{ display:flex; align-items:center; gap:6px; }
      .eas-hbtn{
        width: 30px; height: 30px;
        display:flex; align-items:center; justify-content:center;
        border-radius: 8px;
        color: #64748b;
        background: transparent;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        transition: transform .12s ease, background .12s ease;
      }
      .eas-hbtn:hover{ background: #f1f5f9; transform: translateY(-1px); }
      .eas-hbtn:active{ transform: translateY(0); }

      .eas-body{
        flex:1;
        min-height:0;
        display:flex;
        background:#f7f7f8;
      }
      .eas-left{
        width: 280px;
        /* 左侧稍深：与右侧对话区拉开色差 */
        background: #f1f5f9;
        border-right: 1px solid #e5e7eb;
        display:flex; flex-direction:column; min-height:0;
        transition: width .18s ease;
        padding-top: 0;
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 3;
        overflow: visible;
      }
      .eas-window.eas-sidebar-collapsed{ --eas-left-width: 0px; }
      .eas-left-topbar{
        display:block;
        padding: 10px 10px 8px 8px;
        min-height: 46px;
        flex: 0 0 auto;
      }
      .eas-sidebar-brand{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        margin-left: 0;
        min-width: 0;
        width: 100%;
      }
      /* 折叠按钮：放在左侧一览右上角，与品牌图标同一水平线 */
      .eas-sidebar-handle{
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid rgba(203,213,225,.85);
        background: rgba(255,255,255,.9);
        backdrop-filter: blur(6px);
        box-shadow: 0 10px 24px rgba(15,23,42,.12);
        display:flex;
        align-items:center;
        justify-content:center;
        cursor: pointer;
        color:#64748b;
        z-index: 20;
        flex: 0 0 auto;
        transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease, border-color .15s ease;
      }
      .eas-sidebar-handle:hover{
        background: rgba(255,255,255,.98);
        border-color: rgba(148,163,184,.9);
        color:#0f172a;
        box-shadow: 0 14px 30px rgba(15,23,42,.16);
      }
      .eas-sidebar-handle:active{ transform: scale(.98); }
      .eas-sidebar-handle svg{ width: 15px; height: 15px; display:block; }
      @media (max-width: 1024px){
        .eas-left-topbar{ padding: 8px 8px 8px 6px; min-height: 42px; }
        .eas-sidebar-handle{ width: 26px; height: 26px; }
      }
      .eas-left.eas-collapsed{
        width: 0;
        border-right: none;
        padding-top: 0;
      }
      .eas-left.eas-collapsed .eas-left-topbar{
        padding: 0;
        min-height: 0;
      }
      .eas-left.eas-collapsed .eas-sidebar-brand{
        position: absolute;
        right: -36px;
        top: 10px;
        width: auto;
      }
      .eas-left.eas-collapsed .eas-sidebar-handle{
        position: absolute;
        right: 0;
        top: 0;
      }
      .eas-left.eas-collapsed .eas-brand-container{
        display:none;
      }
      .eas-left.eas-collapsed .eas-left-topbar-title,
      .eas-left.eas-collapsed .eas-left-section-title,
      .eas-left.eas-collapsed .eas-left-section-title-row,
      .eas-left.eas-collapsed .eas-left-section-actions,
      .eas-left.eas-collapsed .eas-agent-list,
      .eas-left.eas-collapsed .eas-history-wrap{
        display:none;
      }
      .eas-left-section-title{
        font-size: 12px;
        color: #94a3b8;
        padding: 10px 12px 6px;
        font-weight: 600;
      }
      .eas-left-section-title-row{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 12px 6px;
      }
      .eas-left-section-actions{
        display:flex;
        align-items:center;
        gap: 6px;
      }
      .eas-icon-btn{
        width: 26px;
        height: 26px;
        border-radius: 8px;
        border: 1px solid #eef2f7;
        background: #fff;
        color:#94a3b8;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        transition: background .12s ease, color .12s ease, border-color .12s ease;
      }
      .eas-icon-btn:hover{
        background:#eef2f6;
        color:#64748b;
        border-color:#e2e8f0;
      }
      /* 历史对话「清空历史」按钮：去背景/去边框 */
      .eas-icon-btn[data-eas="clearHistory"]{
        background: transparent;
        border-color: transparent;
      }
      .eas-icon-btn[data-eas="clearHistory"]:hover{
        background: transparent;
        border-color: transparent;
        color:#475569;
      }
      .eas-agent-list{ padding: 8px 8px 8px; display:flex; flex-direction:column; gap:6px; }
      .eas-agent-item{
        display:flex; align-items:center; gap:10px;
        padding: 10px 10px;
        border-radius: 10px;
        cursor:pointer;
        border: 1px solid transparent;
        transition: background .12s ease, border-color .12s ease, transform .12s ease;
      }
      .eas-agent-item:hover{ background:#eef2f6; border-color:#e2e8f0; transform: translateY(-1px); }
      /* 选中态：与左侧同色系加深（比 hover 更深） */
      .eas-agent-item.active{ background: #e2e8f0; border-color: #cbd5e1; }
      .eas-agent-icon{
        width: 30px; height: 30px; border-radius: 10px;
        display:flex; align-items:center; justify-content:center;
        background:#f1f5f9; color:#0f172a;
      }
      .eas-agent-item.active .eas-agent-icon{ background: #e2e8f0; color: #0f172a; }
      .eas-agent-name{ font-size: 13px; font-weight: 600; color:#0f172a; }

      .eas-history-wrap{ padding: 0 12px 12px; min-height:0; display:flex; flex-direction:column; }
      .eas-history-search{
        display:flex; align-items:center; gap:8px;
        border: 1px solid #e5e7eb;
        background:#fff;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
        color:#475569;
      }
      .eas-history-search input{
        border: none; outline: none; flex:1; font-size: 12px;
      }
      .eas-history-list{
        margin-top: 10px;
        overflow:auto;
        min-height:0;
        display:flex;
        flex-direction:column;
        gap: 6px;
        padding-right: 4px;
      }
      .eas-history-item{
        display:flex; align-items:center; gap:10px;
        padding: 9px 10px;
        border-radius: 10px;
        cursor:pointer;
        border: 1px solid transparent;
        /* 历史列表：去掉背景（参考截图） */
        background: transparent;
        transition: background .12s ease, border-color .12s ease;
      }
      .eas-history-icon{
        width: 26px;
        height: 26px;
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        color:#94a3b8;
        display:flex;
        align-items:center;
        justify-content:center;
        flex: 0 0 auto;
        background: transparent;
      }
      .eas-history-item-inner{
        display:flex;
        align-items:center;
        gap: 10px;
        width: 100%;
        min-width: 0;
      }
      .eas-history-actions{
        margin-left: auto;
        display:flex;
        align-items:center;
        gap: 6px;
        opacity: 0;
        transition: opacity .12s ease;
        flex: 0 0 auto;
      }
      .eas-history-item:hover .eas-history-actions{ opacity: 1; }
      .eas-history-action{
        width: 24px;
        height: 24px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        color:#94a3b8;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .eas-history-action:hover{
        background:#eef2f6;
        color:#64748b;
        border-color:#e2e8f0;
      }
      .eas-history-item:hover{ background:#e5e7eb; border-color: transparent; }
      /* 选中态：与左侧同色系加深（比 hover 更深） */
      .eas-history-item.active{ background:#e2e8f0; border-color: transparent; }
      .eas-history-item.is-new-conv{ background: transparent !important; }
      .eas-history-item.is-new-conv:hover{ background: #e5e7eb !important; }
      .eas-history-title{ font-size: 12px; color:#0f172a; font-weight: 600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* 名称单行显示：隐藏摘要行 */
      .eas-history-meta{ display:none; }

      /* 右侧略浅同色系底：比左侧更浅 */
      .eas-right{ flex:1; min-width:0; display:flex; flex-direction:column; background:#f8fafc; position: relative; overflow: visible; }
      .eas-model-tag-wrap {
        display: flex;
        justify-content: center;
        padding-top: 12px;
        background: #f8fafc;
        flex-shrink: 0;
      }
      .eas-model-tag {
        background: rgba(241, 245, 249, 0.8);
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 4px 12px;
        font-size: 12px;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .eas-model-tag i {
        color: #eab308;
        font-size: 10px;
      }
      .eas-chat{
        flex:1; min-height:0;
        overflow:auto;
        padding: 18px 18px 8px;
        background:#f8fafc;
      }
      .eas-empty{
        height: 100%;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#0f172a;
      }
      .eas-empty-inner{
        width: min(560px, 92%);
        text-align:center;
        padding: 8px 10px 18px;
      }
      .eas-hello{ font-size: 26px; font-weight: 800; letter-spacing: .2px; }
      .eas-sub{ margin-top: 8px; font-size: 13px; color:#64748b; line-height: 1.6; }
      .eas-composer{
        margin-top: 16px;
        background:#fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 10px;
        display:flex; align-items:center; gap:10px;
        box-shadow: 0 10px 26px rgba(15,23,42,.06);
      }
      .eas-input{
        flex:1;
        border:none;
        outline:none;
        padding: 10px 10px;
        font-size: 13px;
      }
      .eas-send{
        width: 36px; height: 36px;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer;
        color:#64748b;
        background: #fff;
        transition: transform .12s ease, background .12s ease, color .12s ease;
      }
      .eas-send:hover{ background: #eff6ff; color: ${this.config.primaryColor}; transform: translateY(-1px); }
      .eas-send:active{ transform: translateY(0); }
      .eas-suggest{
        margin-top: 14px;
        text-align:left;
      }
      .eas-suggest-title{
        font-size: 12px; color:#94a3b8; font-weight: 700;
        display:flex; align-items:center; gap:10px;
      }
      .eas-suggest-title:after{
        content:'';
        height:1px; flex:1;
        background: linear-gradient(90deg, rgba(148,163,184,.45), rgba(148,163,184,0));
      }
      .eas-suggest-list{ margin-top: 10px; display:flex; flex-direction:column; gap:10px; }
      .eas-suggest-item{
        font-size: 13px; color:#0f172a;
        display:flex; gap:10px; align-items:flex-start;
        cursor:pointer;
      }
      .eas-suggest-dot{
        width: 8px; height: 8px; margin-top: 6px;
        border-radius: 999px;
        background: ${this.config.primaryColor};
        box-shadow: 0 0 0 3px rgba(59,130,246,.12);
      }
      .eas-msg{
        display:flex; margin: 10px 0;
      }
      .eas-msg.user{ justify-content:flex-end; }
      .eas-bubble{
        max-width: min(72%, 720px);
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.55;
        box-shadow: 0 10px 26px rgba(15,23,42,.06);
        border: 1px solid #e5e7eb;
        background: #fff;
        color:#0f172a;
      }
      .eas-msg.user .eas-bubble{
        background: #e5e7eb;
        color: #1f2937;
        border: none;
      }

      /* --- AI 知识库回复组件（无气泡） --- */
      .eas-ai-reply{
        max-width: 920px;
        width: 100%;
      }
      .eas-ai-meta{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        color: #999;
        font-size: 12px;
        line-height: 18px;
        cursor: pointer;
        user-select: none;
      }
      .eas-ai-meta:hover{ color:#777; }
      .eas-ai-meta-chevron{
        display:inline-block;
        transform: translateY(-0.5px);
        transition: transform .15s ease;
      }
      .eas-ai-meta[aria-expanded="true"] .eas-ai-meta-chevron{
        transform: translateY(-0.5px) rotate(90deg);
      }
      .eas-ai-nodes{
        margin-top: 10px;
        display:flex;
        flex-direction: column;
        gap: 12px;
      }

      /* --- 思考步骤列表：纵向连接线 + 多行文本（无卡片） --- */
      .eas-ai-step{
        display:flex;
        gap: 10px;
        align-items:flex-start;
      }
      .eas-ai-step-gutter{
        width: 18px;
        flex: 0 0 18px;
        position: relative;
        display:flex;
        justify-content: center;
      }
      .eas-ai-step-dot{
        width: 18px;
        height: 18px;
        display:flex;
        align-items:center;
        justify-content:center;
        margin-top: 2px; /* 与文字基线对齐的视觉微调 */
        color:#cbd5e1;
        user-select: none;
      }
      .eas-ai-step-dot i{ font-size: 14px; }
      .eas-ai-step-dot.loading{
        color: ${this.config.primaryColor};
      }
      .eas-ai-step-dot.done{ color:#22c55e; }
      /* 去红：失败/未触发使用琥珀色 */
      .eas-ai-step-dot.error{ color:#f59e0b; }
      .eas-ai-step-line{
        position:absolute;
        top: 22px;
        bottom: -12px;
        width: 1px;
        background: #e5e7eb;
      }
      .eas-ai-step-content{
        flex: 1;
        min-width: 0;
        font-size: 12px;
        line-height: 18px;
        color:#94a3b8; /* 更浅，避免抢正文注意力 */
      }
      .eas-ai-step-head{
        display:flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .eas-ai-step-name{
        font-weight: 700;
        color:#64748b;
      }
      .eas-ai-step-meta{
        margin-left: auto;
        display:flex;
        align-items:center;
        gap: 8px;
        color:#94a3b8;
        font-size: 12px;
        flex: 0 0 auto;
      }
      .eas-ai-step-status{
        display:flex;
        align-items:center;
        gap: 6px;
      }
      .eas-ai-step-status-icon{
        width: 16px;
        height: 16px;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .eas-ai-spin{ animation: easAiSpin 1s linear infinite; }
      @keyframes easAiSpin{ from{ transform: rotate(0deg);} to{ transform: rotate(360deg);} }
      .eas-ai-step-lines{
        margin-top: 4px;
        display:flex;
        flex-direction: column;
        gap: 4px;
        white-space: normal;
        word-break: break-word;
      }

      /* 状态 icon 颜色 */
      .eas-ai-step.running .eas-ai-step-status-icon{ color: ${this.config.primaryColor}; }
      .eas-ai-step.done .eas-ai-step-status-icon{ color: #22c55e; }
      .eas-ai-step.error .eas-ai-step-status-icon{ color: #f59e0b; }
      .eas-ai-step.skipped .eas-ai-step-status-icon{ color: #94a3b8; }

      /* 底部完成标记 */
      .eas-ai-complete{
        display:flex;
        gap: 10px;
        align-items:flex-start;
        margin-top: 2px;
      }
      .eas-ai-complete .eas-ai-step-content{
        color:#94a3b8;
        font-weight: 650;
        display:flex;
        align-items:center;
        gap: 6px;
      }
      .eas-ai-complete i{ color:#22c55e; }

      .eas-ai-content{
        margin-top: 8px;
        font-size: 14px;
        line-height: 22px;
        color:#333;
        white-space: normal;
        word-break: break-word;
      }

      /* 底部操作与参考合并栏 */
      .eas-ai-footer-module {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding-top: 8px;
      }
      .eas-ai-actions-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .eas-action-icon-btn {
        background: transparent;
        border: none;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
        cursor: pointer;
        transition: color 0.2s ease;
        font-size: 15px;
      }
      .eas-action-icon-btn:hover {
        color: #4b5563;
      }
      .eas-ai-ref-right {
        display: flex;
        align-items: center;
      }
      .eas-ref-simple-link {
        font-size: 13px;
        color: #9ca3af;
        text-decoration: none;
        transition: color 0.2s ease;
      }
      .eas-ref-simple-link:hover {
        color: #4b5563;
        text-decoration: underline;
      }

      /* 3. 相关问题推荐模块 */
      .eas-ai-suggest-module {
        margin-top: 16px;
        padding-top: 0px;
      }
      .eas-suggest-title {
        font-size: 13px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .eas-suggest-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
      }
      .eas-suggest-pill {
        background: transparent;
        border: none;
        padding: 4px 0;
        font-size: 13px;
        color: #4b5563;
        cursor: pointer;
        transition: color 0.2s ease;
        text-align: left;
        line-height: 1.55;
        max-width: 100%;
      }
      .eas-suggest-pill:hover {
        color: #2563eb;
        text-decoration: underline;
      }

      /* --- 欢迎页（选中智能体/新会话时展示） --- */
      .eas-welcome{
        height: 100%;
        display:flex;
        flex-direction: column;
        align-items:center;
        justify-content: center;
        gap: 22px;
        padding: 28px 18px;
      }
      .eas-welcome-hero{ 
        text-align: left;
        width: min(720px, 92%);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding-left: 12px;
      }
      .eas-welcome-badge{
        display: none;
      }
      .eas-welcome-title{
        font-size: 26px;
        font-weight: 800;
        color:#0f172a;
        letter-spacing: .2px;
      }
      .eas-welcome-sub{
        margin-top: 6px;
        font-size: 13px;
        color:#94a3b8;
      }
      .eas-welcome-card{
        width: min(640px, 92%);
        background:#fff;
        border: 1px solid #eef2f7;
        border-radius: 14px;
        padding: 14px 16px;
        color:#64748b;
        font-size: 12px;
        line-height: 1.6;
        box-shadow: 0 12px 30px rgba(15,23,42,.06);
        display:flex;
        justify-content: space-between;
        gap: 14px;
        align-items: center;
      }
      .eas-welcome-card-illu{
        width: 46px;
        height: 46px;
        border-radius: 999px;
        background: #eff6ff;
        display:flex;
        align-items:center;
        justify-content:center;
        color: ${this.config.primaryColor};
        flex: 0 0 auto;
      }
      .eas-welcome-input{
        width: min(720px, 92%);
        /* 右侧对话区：输入框容器去背景 */
        background: transparent;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: none;
        position: relative;
        margin-left: 0;
        margin-right: 0;
      }
      .eas-welcome-input.is-dragover{
        border-color: rgba(59,130,246,.45);
        box-shadow: 0 18px 40px rgba(15,23,42,.08), 0 0 0 4px rgba(59,130,246,.12);
      }
      .eas-welcome-textarea{
        width: 100%;
        border: none;
        outline: none;
        resize: none;
        font-size: 13px;
        line-height: 1.6;
        min-height: 44px;
        color:#0f172a;
        background: transparent;
        /* 为右下角发送按钮预留空间 */
        padding-right: 44px;
        padding-bottom: 28px;
      }
      .eas-welcome-toolbar{
        margin-top: 10px;
        padding-top: 10px;
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
      }
      .eas-welcome-tools-left{
        display:flex;
        align-items:center;
        gap: 10px;
        min-width: 0;
      }
      .eas-welcome-tool-btn{
        border: 1px solid #eef2f7;
        background:#fff;
        color:#64748b;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 10px;
        cursor:pointer;
        display:flex;
        align-items:center;
        gap: 8px;
      }
      .eas-welcome-tool-btn:hover{ background:#eef2f6; border-color:#e2e8f0; }
      .eas-welcome-toggle{
        display:flex;
        align-items:center;
        gap: 6px;
        font-size: 12px;
        color:#64748b;
        user-select:none;
      }
      .eas-welcome-toggle input{ accent-color: ${this.config.primaryColor}; }
      .eas-welcome-lang{
        border: 1px solid #eef2f7;
        background:#fff;
        color:#64748b;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 10px;
        outline:none;
      }
      .eas-welcome-send{
        /* 固定到输入框右下角 */
        position: absolute;
        right: 14px;
        bottom: 14px;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border:none;
        background: #d1d5db;
        color: #fff;
        cursor: not-allowed;
        display:flex;
        align-items:center;
        justify-content:center;
        flex: 0 0 auto;
        transition: transform .12s ease, filter .12s ease, background .12s ease;
      }
      .eas-welcome-send svg{ width: 18px; height: 18px; }
      .eas-welcome-send:not(:disabled){
        /* 可发送：黑色 */
        background: #0b0b0b;
        cursor: pointer;
      }
      .eas-welcome-send:not(:disabled):hover{ filter: brightness(1.06); transform: translateY(-1px); }
      .eas-welcome-send:not(:disabled):active{ transform: translateY(0); }
      .eas-welcome-files{
        margin-top: 8px;
        display:flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .eas-welcome-file{
        font-size: 12px;
        color:#64748b;
        border: 1px solid #eef2f7;
        background:#f8fafc;
        padding: 6px 10px;
        border-radius: 999px;
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .eas-welcome-chips{
        width: min(720px, 92%);
        margin: 0 auto;
        display:flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        justify-content:flex-start;
        padding-left: 12px;
      }
      .eas-welcome-try-title{
        width: min(720px, 92%);
        display:flex;
        align-items:center;
        gap: 10px;
        justify-content:flex-start;
        color:#94a3b8;
        font-size: 12px;
        font-weight: 700;
        padding-left: 12px;
      }
      .eas-welcome-try-title:before,
      .eas-welcome-try-title:after{
        content:'';
        height: 1px;
        flex: 1;
        background: linear-gradient(90deg, rgba(148,163,184,.45), rgba(148,163,184,0));
      }
      .eas-welcome-try-title:after{
        background: linear-gradient(270deg, rgba(148,163,184,.45), rgba(148,163,184,0));
      }
      .eas-welcome-chip{
        /* 预设问题：去掉边框 */
        border: 1px solid transparent;
        /* 预设问题：去背景 */
        background: transparent;
        color:#334155;
        font-size: 13px;
        padding: 10px 0;
        border-radius: 14px;
        cursor:pointer;
        display:flex;
        align-items:center;
        gap: 0;
        justify-content:flex-start;
        width: auto;
        text-align:left;
      }
      /* hover 不加底色，仅加深边框，保持“无背景” */
      .eas-welcome-chip:hover{ background: transparent; border-color: transparent; color:#0f172a; }
      .eas-inputbar{
        padding: 12px 14px;
        border-top: 1px solid #eef2f7;
        /* 右侧对话区：底部输入栏去背景 */
        background: transparent;
        position: relative;
      }
      .eas-inputbar textarea{
        width: 100%;
        resize:none;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        /* 预留右下角按钮空间 */
        padding: 10px 52px 10px 12px;
        font-size: 13px;
        outline:none;
        min-height: 42px;
        max-height: 120px;
        background: transparent;
      }
      .eas-inputbar textarea:focus{ border-color: rgba(59,130,246,.55); box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
      .eas-inputbar button{
        position: absolute;
        right: 22px;
        bottom: 22px;
        width: 36px; height: 36px;
        border-radius: 999px;
        border:none;
        cursor:not-allowed;
        background: #d1d5db;
        color:#fff;
        display:flex; align-items:center; justify-content:center;
        box-shadow: none;
        transition: transform .12s ease, filter .12s ease, background .12s ease;
      }
      .eas-inputbar button svg{ width: 18px; height: 18px; }
      .eas-inputbar button:not(:disabled){
        /* 可发送：黑色 */
        background: #0b0b0b;
        cursor: pointer;
      }
      .eas-inputbar button:not(:disabled):hover{ filter: brightness(1.06); transform: translateY(-1px); }
      .eas-inputbar button:not(:disabled):active{ transform: translateY(0); }
    `;
    document.head.appendChild(style);
  }

  _mount() {
    // Floating button
    this.fab = document.createElement('button');
    this.fab.type = 'button';
    this.fab.className = 'eas-fab';
    this.fab.setAttribute('title', '打开智能助手');
    this.fab.setAttribute('aria-label', '打开智能助手');
    this.fab.innerHTML = '<i class="fa-solid fa-headset"></i>';
    document.body.appendChild(this.fab);
    this._restoreFabPosition();
    this._bindFabDrag();
    // 小屏/缩放变化时，避免悬浮按钮被挤出屏幕
    window.addEventListener('resize', () => this._ensureFabVisible(), { passive: true });

    // Window shell
    this.shell = document.createElement('div');
    this.shell.className = 'eas-shell';
    this.shell.innerHTML = `
      <div class="eas-backdrop" data-eas="backdrop"></div>
      <div class="eas-window" role="dialog" aria-label="${this.config.title}">
        <div class="eas-header">
          <div class="eas-header-left"></div>
          <div class="eas-header-actions">
            <button class="eas-hbtn" data-eas="minimize" aria-label="最小化"><i class="fa-solid fa-down-left-and-up-right-to-center"></i></button>
            <button class="eas-hbtn" data-eas="close" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
        <div class="eas-body">
          <div class="eas-left">
            <div class="eas-left-topbar">
              <div class="eas-sidebar-brand">
                <div class="eas-brand-container" style="display:flex; align-items:center; gap:8px;">
                  <div class="eas-brand-dot"><i class="fa-solid fa-robot"></i></div>
                  <span class="eas-brand-text" style="font-size:15px; font-weight:700; color:#0f172a; letter-spacing:0.5px;">VAgent</span>
                </div>
                <button type="button" class="eas-sidebar-handle" data-eas="toggleSidebar" aria-label="收起侧边栏" title="收起侧边栏">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="eas-agent-list" data-eas="agentList"></div>
            <div class="eas-left-section-title-row">
              <div class="eas-left-section-title" style="padding:0;">历史对话</div>
              <div class="eas-left-section-actions">
                <button type="button" class="eas-icon-btn" data-eas="clearHistory" title="清空历史">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
            <div class="eas-history-wrap">
              <div class="eas-history-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input data-eas="historySearch" placeholder="搜索会话和消息" />
              </div>
              <div class="eas-history-list" data-eas="historyList"></div>
            </div>
          </div>
          <div class="eas-right">
            <div class="eas-model-tag-wrap">
              <div class="eas-model-tag">
                <i class="fa-solid fa-bolt"></i> 当前模型：GPT5-mini
              </div>
            </div>
            <div class="eas-chat" data-eas="chat"></div>
            <div class="eas-inputbar">
              <textarea data-eas="composer" placeholder="请输入输入您的提问..."></textarea>
              <button data-eas="send" type="button" aria-label="发送">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 19V5m0 0 7 7m-7-7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.shell);

    // Bind shell events
    const backdrop = this.shell.querySelector('[data-eas="backdrop"]');
    const closeBtn = this.shell.querySelector('[data-eas="close"]');
    const miniBtn = this.shell.querySelector('[data-eas="minimize"]');
    const toggleSidebarBtn = this.shell.querySelector('[data-eas="toggleSidebar"]');
    backdrop.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    miniBtn.addEventListener('click', () => this.close());
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._toggleSidebar();
      });
    }
    this._applySidebarState();

    const search = this.shell.querySelector('[data-eas="historySearch"]');
    search.addEventListener('input', (e) => {
      this.state.historyQuery = String(e.target.value || '');
      this._renderHistory();
    });

    const clearBtn = this.shell.querySelector('[data-eas="clearHistory"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = confirm('确认清空当前智能体的所有历史会话？');
        if (!ok) return;
        const agentId = this.state.activeAgentId;
        this.state.conversations.set(agentId, []);
        this._createNewConversation({ agentId, title: '新对话' });
        this.state.activeConvId = null;
        this._render();
      });
    }

    const composer = this.shell.querySelector('[data-eas="composer"]');
    const sendBtn = this.shell.querySelector('[data-eas="send"]');
    const updateSendBtn = () => {
      const has = String(composer.value || '').trim().length > 0;
      sendBtn.disabled = !has;
    };
    updateSendBtn();
    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendFromComposer();
        updateSendBtn();
      }
    });
    composer.addEventListener('input', updateSendBtn);
    sendBtn.addEventListener('click', () => {
      this._sendFromComposer();
      updateSendBtn();
    });
  }

  _restoreFabPosition() {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) {
        // 无保存位置：设置一个不与版本管理按钮重叠的默认位置
        this._applyDefaultFabPosition();
        return;
      }
      const pos = JSON.parse(raw);
      if (!pos || typeof pos !== 'object') return;
      this._applyFabPosition(pos);
      // 兼容不同屏幕尺寸：避免保存位置把按钮挤出可视区
      this._ensureFabVisible();
    } catch (_) {}
  }

  _applyDefaultFabPosition() {
    if (!this.fab) return;
    const baseRight = 22;
    const baseBottom = 22;
    let bottom = baseBottom;

    // 与版本管理悬浮按钮错位（避免默认重叠）
    const versionBtn = document.getElementById('version-mgmt-floating-btn');
    if (versionBtn) {
      const r = versionBtn.getBoundingClientRect();
      // 向上错开一个按钮高度 + 间距
      bottom = baseBottom + Math.max(56, Math.round(r.height || 56)) + 14;
    }

    const pos = { right: baseRight, bottom, dock: null };
    this._applyFabPosition(pos);
    this._ensureFabVisible();
    this._saveFabPosition(pos);
  }

  _saveFabPosition(pos) {
    try { localStorage.setItem(this.config.storageKey, JSON.stringify(pos)); } catch (_) {}
  }

  _applyFabPosition(pos) {
    if (!this.fab) return;
    const s = this.fab.style;
    // clear
    s.left = 'auto'; s.right = 'auto'; s.top = 'auto'; s.bottom = 'auto';
    // 先做一次简单归一化（避免负数/NaN）
    const safe = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    if (safe(pos.left) != null) s.left = `${pos.left}px`;
    if (safe(pos.right) != null) s.right = `${pos.right}px`;
    if (safe(pos.top) != null) s.top = `${pos.top}px`;
    if (safe(pos.bottom) != null) s.bottom = `${pos.bottom}px`;
    this._fabDock = pos.dock || null;
  }

  _ensureFabVisible() {
    if (!this.fab) return;
    // 让布局先生效后再取 rect
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    if (!w || !h) return;

    const rect = this.fab.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(0, w - rect.width - margin);
    const maxTop = Math.max(0, h - rect.height - margin);
    const nextLeft = Math.min(maxLeft, Math.max(margin, rect.left));
    const nextTop = Math.min(maxTop, Math.max(margin, rect.top));

    const moved = Math.round(nextLeft) !== Math.round(rect.left) || Math.round(nextTop) !== Math.round(rect.top);
    const outside = rect.right < 0 || rect.bottom < 0 || rect.left > w || rect.top > h;
    if (outside || moved) {
      // 用 left/top 强制拉回可视区
      this.fab.style.right = 'auto';
      this.fab.style.bottom = 'auto';
      this.fab.style.left = `${Math.round(nextLeft)}px`;
      this.fab.style.top = `${Math.round(nextTop)}px`;
      this._fabDock = null;
      this._saveFabPosition({ left: Math.round(nextLeft), top: Math.round(nextTop), dock: null });
    }
  }

  _bindFabDrag() {
    if (!this.fab) return;

    const SNAP = 40;   // 距离边缘多少像素触发吸附（增强吸附手感）
    const MARGIN = 0;  // 吸附后贴边（不留边距）

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const normalizeToLeftTop = () => {
      const rect = this.fab.getBoundingClientRect();
      const s = this.fab.style;
      s.right = 'auto';
      s.bottom = 'auto';
      s.left = `${rect.left}px`;
      s.top = `${rect.top}px`;
    };

    const onStart = (e) => {
      // 仅主按钮拖拽（避免触发滚动/选择）
      e.preventDefault();
      this._fabDrag.dragging = true;
      this._fabDrag.moved = false;
      this.fab.classList.add('eas-dragging');

      normalizeToLeftTop();
      const rect = this.fab.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      this._fabDrag.startX = clientX;
      this._fabDrag.startY = clientY;
      this._fabDrag.startLeft = rect.left;
      this._fabDrag.startTop = rect.top;

      // pointer capture
      if (typeof e.pointerId === 'number' && this.fab.setPointerCapture) {
        try { this.fab.setPointerCapture(e.pointerId); } catch (_) {}
      }

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onEnd, true);
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onEnd, true);
      window.addEventListener('touchmove', onMove, { capture: true, passive: false });
      window.addEventListener('touchend', onEnd, true);
    };

    const onMove = (e) => {
      if (!this._fabDrag.dragging) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const dx = clientX - this._fabDrag.startX;
      const dy = clientY - this._fabDrag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._fabDrag.moved = true;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const rect = this.fab.getBoundingClientRect();
      let nextLeft = clamp(this._fabDrag.startLeft + dx, 0, w - rect.width);
      let nextTop = clamp(this._fabDrag.startTop + dy, 0, h - rect.height);

      // 拖动过程中实时“磁吸”到最近边缘（用户感知更明显）
      const distLeft = nextLeft;
      const distRight = (w - rect.width) - nextLeft;
      const distTop = nextTop;
      const distBottom = (h - rect.height) - nextTop;
      const min = Math.min(distLeft, distRight, distTop, distBottom);
      if (min <= SNAP) {
        if (min === distLeft) nextLeft = MARGIN;
        else if (min === distRight) nextLeft = (w - rect.width) - MARGIN;
        else if (min === distTop) nextTop = MARGIN;
        else nextTop = (h - rect.height) - MARGIN;
      }

      this.fab.style.left = `${Math.round(nextLeft)}px`;
      this.fab.style.top = `${Math.round(nextTop)}px`;
      this._fabDock = null;
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (!this._fabDrag.dragging) return;
      this._fabDrag.dragging = false;
      this.fab.classList.remove('eas-dragging');

      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onEnd, true);
      window.removeEventListener('touchmove', onMove, true);
      window.removeEventListener('touchend', onEnd, true);

      // 吸附边缘
      const rect = this.fab.getBoundingClientRect();
      const w = window.innerWidth;
      const h = window.innerHeight;

      const distLeft = rect.left;
      const distRight = w - rect.right;
      const distTop = rect.top;
      const distBottom = h - rect.bottom;
      const min = Math.min(distLeft, distRight, distTop, distBottom);

      const s = this.fab.style;
      const pos = { dock: null };

      if (min <= SNAP) {
        if (min === distLeft) {
          s.left = `${MARGIN}px`; s.right = 'auto';
          pos.left = MARGIN; pos.top = Math.round(clamp(rect.top, 0, h - rect.height));
          this._fabDock = 'left';
        } else if (min === distRight) {
          s.right = `${MARGIN}px`; s.left = 'auto';
          pos.right = MARGIN; pos.top = Math.round(clamp(rect.top, 0, h - rect.height));
          this._fabDock = 'right';
        } else if (min === distTop) {
          s.top = `${MARGIN}px`; s.bottom = 'auto';
          pos.top = MARGIN; pos.left = Math.round(clamp(rect.left, 0, w - rect.width));
          this._fabDock = 'top';
        } else {
          s.bottom = `${MARGIN}px`; s.top = 'auto';
          pos.bottom = MARGIN; pos.left = Math.round(clamp(rect.left, 0, w - rect.width));
          this._fabDock = 'bottom';
        }
        pos.dock = this._fabDock;
      } else {
        // 不吸附，保存 left/top
        pos.left = Math.round(rect.left);
        pos.top = Math.round(rect.top);
        this._fabDock = null;
      }

      this._saveFabPosition(pos);
    };

    // click: 只有未发生拖动时才触发打开
    this.fab.addEventListener('click', () => {
      if (this._fabDrag.moved) return;
      this.toggle();
    });

    this.fab.addEventListener('pointerdown', onStart);
    this.fab.addEventListener('mousedown', onStart);
    this.fab.addEventListener('touchstart', onStart, { passive: false });
  }

  _bindGlobalShortcuts() {
    // ESC close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  _applySidebarState() {
    if (!this.shell) return;
    const win = this.shell.querySelector('.eas-window');
    const left = this.shell.querySelector('.eas-left');
    const btn = this.shell.querySelector('[data-eas="toggleSidebar"]');
    const right = this.shell.querySelector('.eas-right');
    if (!left || !btn || !right || !win) return;
    left.classList.toggle('eas-collapsed', !!this.state.sidebarCollapsed);
    right.classList.toggle('eas-left-collapsed', !!this.state.sidebarCollapsed);
    win.classList.toggle('eas-sidebar-collapsed', !!this.state.sidebarCollapsed);

    // icon（展开：左侧栏在左；收起：左侧栏隐藏）
    const iconOpen = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>`;
    const iconClosed = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>`;
    btn.innerHTML = this.state.sidebarCollapsed ? iconClosed : iconOpen;

    btn.setAttribute('aria-label', this.state.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏');
    btn.setAttribute('title', this.state.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏');
  }

  _toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    try {
      const k = `${this.config.storageKey}_sidebarCollapsed`;
      localStorage.setItem(k, JSON.stringify(!!this.state.sidebarCollapsed));
    } catch (_) {}
    this._applySidebarState();
  }

  _getActiveConversations() {
    const agentId = this.state.activeAgentId;
    return this.state.conversations.get(agentId) || [];
  }

  _getActiveConversation() {
    const convs = this._getActiveConversations();
    return convs.find(c => c.id === this.state.activeConvId) || convs[0] || null;
  }

  _render() {
    this._renderVisibility();
    this._renderAgents();
    this._renderHistory();
    this._renderChat();
  }

  _renderVisibility() {
    if (!this.shell) return;
    this.shell.style.display = this.state.isOpen ? 'flex' : 'none';
  }

  _renderAgents() {
    const list = this.shell.querySelector('[data-eas="agentList"]');
    if (!list) return;
    list.innerHTML = '';
    this.config.agents.forEach(agent => {
      const item = document.createElement('div');
      item.className = `eas-agent-item ${agent.id === this.state.activeAgentId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="eas-agent-icon"><i class="${agent.icon}"></i></div>
        <div class="eas-agent-name" title="${agent.name}">${agent.name}</div>
      `;
      item.addEventListener('click', () => {
        this.state.activeAgentId = agent.id;
        // 需求：每次选中智能体都打开新的欢迎页（新建会话，右侧显示欢迎态）
        this._createNewConversation({ agentId: agent.id, title: '新对话' });
        this.state.activeConvId = null; // 清空当前会话ID，使其不默认选中“新对话”
        this._render();
      });
      list.appendChild(item);
    });
  }

  _renderHistory() {
    const list = this.shell.querySelector('[data-eas="historyList"]');
    if (!list) return;

    const activeAgent = this._getActiveAgent();
    const activeAgentIcon = activeAgent && activeAgent.icon ? activeAgent.icon : 'fa-regular fa-comment-dots';

    const q = this.state.historyQuery.trim().toLowerCase();
    const convs = this._getActiveConversations();
    const filtered = !q ? convs : convs.filter(c => {
      if ((c.title || '').toLowerCase().includes(q)) return true;
      return (c.messages || []).some(m => String(m.text || '').toLowerCase().includes(q));
    });

    list.innerHTML = '';
    filtered.forEach(conv => {
      const item = document.createElement('div');
      
      // 判断是否需要高亮该会话：
      // 当 activeConvId 有值时，判断该 conv 是否等于 activeConvId，且不是刚初始化的新对话（有真实内容才高亮）
      const hasContent = (conv.messages && conv.messages.length > 0) || conv.title !== '新对话';
      const isActive = (conv.id === this.state.activeConvId) && hasContent;
      
      item.className = `eas-history-item ${isActive ? 'active' : ''} ${!hasContent ? 'is-new-conv' : ''}`;
      
      const last = (conv.messages || []).slice(-1)[0];
      const lastPreview = last
        ? (last.type === 'reply'
          ? (last.reply && last.reply.content ? String(last.reply.content) : '思考中...')
          : (last.type === 'trace' ? '思考中...' : (last.text ? String(last.text) : '')))
        : '';
      item.innerHTML = `
        <div class="eas-history-item-inner">
          <div class="eas-history-icon"><i class="${activeAgentIcon}"></i></div>
          <div class="eas-history-text" style="min-width:0; flex:1;">
            <div class="eas-history-title">${conv.title || '未命名会话'}</div>
            <div class="eas-history-meta">${lastPreview ? lastPreview.slice(0, 28) : '暂无消息'}</div>
          </div>
          <div class="eas-history-actions">
            <button type="button" class="eas-history-action" data-action="rename" title="重命名">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button type="button" class="eas-history-action" data-action="delete" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;

      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          const agentId = this.state.activeAgentId;
          const convsAll = this.state.conversations.get(agentId) || [];
          const idx = convsAll.findIndex(c => c.id === conv.id);
          if (idx < 0) return;

          if (action === 'rename') {
            const next = prompt('请输入新的会话名称', conv.title || '');
            if (next == null) return;
            convsAll[idx].title = String(next).trim() || '未命名会话';
            this.state.conversations.set(agentId, convsAll);
            this._renderHistory();
            return;
          }

          if (action === 'delete') {
            const ok = confirm('确认删除该会话？');
            if (!ok) return;
            const removed = convsAll.splice(idx, 1);
            this.state.conversations.set(agentId, convsAll);

            if (removed[0] && removed[0].id === this.state.activeConvId) {
              if (!convsAll.length) this._createNewConversation({ agentId, title: '新对话' });
              else this.state.activeConvId = convsAll[0].id;
              this._render();
            } else {
              this._renderHistory();
            }
          }
        });
      });
      item.addEventListener('click', () => {
        this.state.activeConvId = conv.id;
        this._renderChat();
      });
      list.appendChild(item);
    });
  }

  _renderChat() {
    const chat = this.shell.querySelector('[data-eas="chat"]');
    if (!chat) return;

    const conv = this._getActiveConversation();
    const msgs = conv?.messages || [];

    if (!msgs.length) {
      // 欢迎页：隐藏底部输入栏，仅展示「问候语 + 输入组件 + 推荐问题」
      const inputbar = this.shell.querySelector('.eas-inputbar');
      if (inputbar) inputbar.style.display = 'none';

      const agent = this._getActiveAgent();
      const agentName = agent ? agent.name : '智能体';
      const agentIcon = agent ? agent.icon : 'fa-solid fa-robot';
      const isHrAgent = !!(agent && (agent.id === 'agent-hr' || String(agent.name || '').includes('人事业务咨询')));
      // 需求：仅人事业务咨询首页去掉「文件上传 / 自动识别 / 语言选择」
      const showWelcomeTools = !isHrAgent;
      const allowWelcomeFiles = !isHrAgent;
      const welcomePlaceholder = allowWelcomeFiles
        ? '请在此输入您的提问，或拖拽文件到此处…'
        : '请在此输入您的提问…';

      chat.innerHTML = `
        <div class="eas-welcome">
          <div class="eas-welcome-hero">
            <div class="eas-welcome-badge"><i class="${agentIcon}"></i></div>
            <div class="eas-welcome-title">你好，超级管理员</div>
            <div class="eas-welcome-sub">当前智能体：${agentName} · 有什么可以帮您的吗？</div>
          </div>

          <div class="eas-welcome-input">
            <textarea class="eas-welcome-textarea" data-eas="welcomeInput" placeholder="${welcomePlaceholder}"></textarea>
            ${allowWelcomeFiles ? `<input type="file" data-eas="welcomeFileInput" style="display:none" multiple />` : ''}
            ${allowWelcomeFiles ? `<div class="eas-welcome-files" data-eas="welcomeFiles" style="display:none"></div>` : ''}
            <div class="eas-welcome-toolbar">
              ${showWelcomeTools ? `
                <div class="eas-welcome-tools-left">
                  <button class="eas-welcome-tool-btn" type="button" data-eas="welcomeUpload">
                    <i class="fa-regular fa-paperclip"></i><span>文件上传</span>
                  </button>
                  <label class="eas-welcome-toggle" title="自动识别（示例开关）">
                    <input type="checkbox" data-eas="welcomeAuto" checked />
                    <span>自动识别</span>
                  </label>
                  <select class="eas-welcome-lang" data-eas="welcomeLang" title="语言设置">
                    <option value="auto">自动</option>
                    <option value="zh">中文</option>
                    <option value="en">英文</option>
                  </select>
                </div>
              ` : `<div class="eas-welcome-tools-left" style="display:none"></div>`}
              <button class="eas-welcome-send" type="button" data-eas="welcomeSend" aria-label="发送">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 19V5m0 0 7 7m-7-7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="eas-welcome-try-title">试试这些</div>
          <div class="eas-welcome-chips">
            <button class="eas-welcome-chip" type="button" data-eas-q="工作日加班可以调休吗？"><span>工作日加班可以调休吗？</span></button>
            <button class="eas-welcome-chip" type="button" data-eas-q="福利积分不够可以使用现金支付吗？"><span>福利积分不够可以使用现金支付吗？</span></button>
            <button class="eas-welcome-chip" type="button" data-eas-q="重疾险疾病范围包括哪些？"><span>重疾险疾病范围包括哪些？</span></button>
          </div>
        </div>
      `;

      const inputEl = chat.querySelector('[data-eas="welcomeInput"]');
      const sendBtn = chat.querySelector('[data-eas="welcomeSend"]');
      const wrap = chat.querySelector('.eas-welcome-input');
      const fileBtn = chat.querySelector('[data-eas="welcomeUpload"]');
      const fileInput = chat.querySelector('[data-eas="welcomeFileInput"]');
      const filesWrap = chat.querySelector('[data-eas="welcomeFiles"]');
      const autoEl = chat.querySelector('[data-eas="welcomeAuto"]');
      const langEl = chat.querySelector('[data-eas="welcomeLang"]');

      const attachments = [];
      const updateWelcomeSendBtn = () => {
        const v = String(inputEl?.value || '').trim();
        const ok = !!v || attachments.length > 0;
        if (sendBtn) sendBtn.disabled = !ok;
      };
      const renderFiles = () => {
        if (!filesWrap) return;
        filesWrap.innerHTML = '';
        if (!attachments.length) {
          filesWrap.style.display = 'none';
          updateWelcomeSendBtn();
          return;
        }
        filesWrap.style.display = 'flex';
        attachments.forEach(f => {
          const chip = document.createElement('div');
          chip.className = 'eas-welcome-file';
          chip.textContent = f.name || '未命名文件';
          filesWrap.appendChild(chip);
        });
        updateWelcomeSendBtn();
      };

      const autoSize = () => {
        if (!inputEl) return;
        inputEl.style.height = 'auto';
        const next = Math.min(inputEl.scrollHeight, 180);
        inputEl.style.height = `${next}px`;
      };

      const send = () => {
        const v = String(inputEl.value || '').trim();
        if (!v && !attachments.length) return;
        const auto = !!(autoEl && autoEl.checked);
        const lang = langEl ? String(langEl.value || 'auto') : 'auto';
        inputEl.value = '';
        autoSize();
        renderFiles();
        const prefix = [];
        if (attachments.length) prefix.push(`【已添加文件：${attachments.map(f => f.name).join('、')}】`);
        if (lang !== 'auto') prefix.push(`【语言：${lang}】`);
        if (!auto) prefix.push(`【自动识别：关闭】`);
        const finalText = `${prefix.length ? prefix.join('') + '\n' : ''}${v}`.trim();
        this._appendMessage('user', v);
        // mock：将附加信息透传给 mockReply（便于后续对接）
        this._mockReply(finalText);
        updateWelcomeSendBtn();
      };
      sendBtn.addEventListener('click', send);
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      inputEl.addEventListener('input', () => { autoSize(); updateWelcomeSendBtn(); });
      autoSize();
      updateWelcomeSendBtn();

      if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          const list = Array.from(fileInput.files || []);
          if (list.length) {
            attachments.splice(0, attachments.length, ...list);
            renderFiles();
          }
        });
      }

      // 拖拽上传（示例：仅展示文件名）
      if (allowWelcomeFiles && wrap) {
        const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
        wrap.addEventListener('dragenter', (e) => { stop(e); wrap.classList.add('is-dragover'); });
        wrap.addEventListener('dragover', (e) => { stop(e); wrap.classList.add('is-dragover'); });
        wrap.addEventListener('dragleave', (e) => { stop(e); wrap.classList.remove('is-dragover'); });
        wrap.addEventListener('drop', (e) => {
          stop(e);
          wrap.classList.remove('is-dragover');
          const list = Array.from(e.dataTransfer?.files || []);
          if (list.length) {
            attachments.splice(0, attachments.length, ...list);
            renderFiles();
          }
        });
      }

      chat.querySelectorAll('[data-eas-q]').forEach(el => {
        el.addEventListener('click', () => {
          const q = el.getAttribute('data-eas-q') || '';
          this._appendMessage('user', q);
          this._mockReply(q);
        });
      });

      return;
    }

    // 非欢迎页：显示底部输入栏
    const inputbar = this.shell.querySelector('.eas-inputbar');
    if (inputbar) inputbar.style.display = 'flex';

    const prevScrollTop = chat.scrollTop;
    const wasAtBottom = (chat.scrollTop + chat.clientHeight) >= (chat.scrollHeight - 8);

    chat.innerHTML = '';
    msgs.forEach(m => {
      const row = document.createElement('div');
      row.className = `eas-msg ${m.role === 'user' ? 'user' : 'ai'}`;
      if (m.role !== 'user') {
        // AI：无气泡样式（按截图：meta + content）
        if (m.type === 'reply' && m.reply) {
          row.appendChild(this._renderAiReply(m));
        } else if (m.type === 'trace' && m.trace) {
          // 兼容旧数据
          row.appendChild(this._renderTraceBubble(m));
        } else {
          const content = document.createElement('div');
          content.className = 'eas-ai-content';
          content.textContent = m.text || '';
          row.appendChild(content);
        }
      } else {
        // User：保留气泡
        const bubble = document.createElement('div');
        bubble.className = 'eas-bubble';
        bubble.textContent = m.text;
        row.appendChild(bubble);
      }
      chat.appendChild(row);
    });

    if (wasAtBottom) this._scrollToBottom();
    else chat.scrollTop = prevScrollTop;
  }

  _renderAiReply(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'eas-ai-reply';

    const reply = msg.reply || {};
    const nodes = Array.isArray(reply.nodes) ? reply.nodes : [];
    const collapsed = reply.collapsed !== false; // default true

    const metaText = this._buildReplyMetaText(reply);

    const metaBtn = document.createElement('button');
    metaBtn.className = 'eas-ai-meta';
    metaBtn.type = 'button';
    metaBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    metaBtn.setAttribute('aria-label', '展开或折叠执行节点');

    const metaSpan = document.createElement('span');
    metaSpan.textContent = metaText;
    const chevron = document.createElement('span');
    chevron.className = 'eas-ai-meta-chevron';
    chevron.innerHTML = '&gt;';

    metaBtn.appendChild(metaSpan);
    metaBtn.appendChild(chevron);

    const toggle = () => {
      const curCollapsed = reply.collapsed !== false;
      reply.collapsed = !curCollapsed;
      this._renderChat();
    };
    metaBtn.addEventListener('click', toggle);
    metaBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    wrap.appendChild(metaBtn);

    if (!collapsed) {
      const panel = document.createElement('div');
      panel.className = 'eas-ai-nodes';
      const isComplete = nodes.length && nodes.every(nn => ['done', 'skipped', 'error'].includes(nn.status));
      nodes.forEach(n => {
        const step = document.createElement('div');
        step.className = `eas-ai-step ${n.status || ''}`;

        const gutter = document.createElement('div');
        gutter.className = 'eas-ai-step-gutter';

        const dot = document.createElement('div');
        dot.className = `eas-ai-step-dot ${this._mapStatusToDotClass(n.status)}`;
        const dotIcon = document.createElement('i');
        dotIcon.className = this._mapStatusToDotIconClass(n.status);
        dot.appendChild(dotIcon);

        gutter.appendChild(dot);

        // 连接线：除非是最后一个且没有完成标记需要连接
        const needLine = isComplete ? true : (n !== nodes[nodes.length - 1]);
        if (needLine) {
          const line = document.createElement('div');
          line.className = 'eas-ai-step-line';
          // 如果是最后一个节点但仍要连接到“已完成”，稍微缩短一点避免穿过勾选图标
          if (n === nodes[nodes.length - 1] && isComplete) line.style.bottom = '-6px';
          gutter.appendChild(line);
        }

        const content = document.createElement('div');
        content.className = 'eas-ai-step-content';

        const head = document.createElement('div');
        head.className = 'eas-ai-step-head';

        const name = document.createElement('span');
        name.className = 'eas-ai-step-name';
        name.textContent = n.name || '';

        const meta = document.createElement('div');
        meta.className = 'eas-ai-step-meta';

        const status = document.createElement('div');
        status.className = 'eas-ai-step-status';
        const statusText = document.createElement('span');
        statusText.textContent = this._traceStatusLabel(n.status);
        const statusIconWrap = document.createElement('span');
        statusIconWrap.className = 'eas-ai-step-status-icon';
        const statusIcon = document.createElement('i');
        statusIcon.className = this._mapStatusToIconClass(n.status);
        statusIconWrap.appendChild(statusIcon);
        status.appendChild(statusText);
        status.appendChild(statusIconWrap);

        const time = document.createElement('span');
        time.textContent = this._getNodeDurationText(n);

        meta.appendChild(status);
        if (time.textContent) meta.appendChild(time);

        head.appendChild(name);
        head.appendChild(meta);

        const lines = document.createElement('div');
        lines.className = 'eas-ai-step-lines';
        const first = n.desc ? String(n.desc) : '';
        if (first) {
          const l = document.createElement('div');
          l.textContent = first;
          lines.appendChild(l);
        }
        const detailText = (n.detail || n.detailText || '').trim();
        if (detailText) {
          String(detailText).split('\n').forEach(s => {
            const t = String(s).trim();
            if (!t) return;
            const l = document.createElement('div');
            l.textContent = t;
            lines.appendChild(l);
          });
        }

        content.appendChild(head);
        content.appendChild(lines);

        step.appendChild(gutter);
        step.appendChild(content);
        panel.appendChild(step);
      });

      // 底部完成标记
      if (isComplete) {
        const doneRow = document.createElement('div');
        doneRow.className = 'eas-ai-complete';

        const gutter = document.createElement('div');
        gutter.className = 'eas-ai-step-gutter';
        const dot = document.createElement('div');
        dot.className = 'eas-ai-step-dot done';
        const dotIcon = document.createElement('i');
        dotIcon.className = 'fa-solid fa-circle-check';
        dot.appendChild(dotIcon);
        gutter.appendChild(dot);

        const content = document.createElement('div');
        content.className = 'eas-ai-step-content';
        content.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>已完成</span>`;

        doneRow.appendChild(gutter);
        doneRow.appendChild(content);
        panel.appendChild(doneRow);
      }

      wrap.appendChild(panel);
    }

    if (reply.content) {
      const content = document.createElement('div');
      content.className = 'eas-ai-content';
      content.textContent = reply.content;
      wrap.appendChild(content);

      // 1. 底部工具栏 (包含操作按钮和参考来源)
      const footerModule = document.createElement('div');
      footerModule.className = 'eas-ai-footer-module';
      footerModule.innerHTML = `
        <div class="eas-ai-actions-left">
          <button class="eas-action-icon-btn btn-copy" title="复制" onclick="event.preventDefault()"><i class="fa-regular fa-copy"></i></button>
          <button class="eas-action-icon-btn btn-regen" title="重新生成" onclick="event.preventDefault()"><i class="fa-solid fa-rotate-right"></i></button>
          <button class="eas-action-icon-btn btn-like" title="点赞" onclick="event.preventDefault()"><i class="fa-regular fa-thumbs-up"></i></button>
          <button class="eas-action-icon-btn btn-dislike" title="点踩" onclick="event.preventDefault()"><i class="fa-regular fa-thumbs-down"></i></button>
          <a href="#" class="eas-ref-simple-link btn-ref" onclick="event.preventDefault()" style="margin-left: 4px;">参考 ${reply.refCount || 14} 篇资料</a>
        </div>
      `;
      wrap.appendChild(footerModule);

      // --- 绑定事件逻辑 ---
      const btnCopy = footerModule.querySelector('.btn-copy');
      const btnRegen = footerModule.querySelector('.btn-regen');
      const btnLike = footerModule.querySelector('.btn-like');
      const btnDislike = footerModule.querySelector('.btn-dislike');
      const btnRef = footerModule.querySelector('.btn-ref');

      // 1. 复制
      btnCopy.onclick = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(reply.content).then(() => {
          this._showToast('复制成功');
        });
      };

      // 2. 重新生成
      btnRegen.onclick = (e) => {
        e.preventDefault();
        const conv = this._getActiveConversation();
        if (!conv) return;
        const idx = conv.messages.indexOf(msg);
        if (idx > 0) {
          const prevUserMsg = conv.messages[idx - 1];
          if (prevUserMsg && prevUserMsg.role === 'user') {
            conv.messages.splice(idx, 1);
            this._renderChat();
            this._mockReply(prevUserMsg.text);
          }
        }
      };

      // 3. 点赞 / 点踩 (互斥)
      if (reply.liked) btnLike.style.color = this.config.primaryColor;
      if (reply.disliked) btnDislike.style.color = this.config.primaryColor;

      btnLike.onclick = (e) => {
        e.preventDefault();
        reply.liked = !reply.liked;
        if (reply.liked) reply.disliked = false;
        this._renderChat();
      };

      btnDislike.onclick = (e) => {
        e.preventDefault();
        if (!reply.disliked) {
          this._showDislikeInline(wrap, suggestModule, () => {
            reply.disliked = true;
            reply.liked = false;
            this._renderChat();
          });
        } else {
          reply.disliked = false;
          this._renderChat();
        }
      };

      // 4. 参考来源预览
      btnRef.onclick = (e) => {
        e.preventDefault();
        this._showReferenceInline(wrap, suggestModule, reply.refCount || 14);
      };

      // 2. 相关问题推荐模块
      const suggestModule = document.createElement('div');
      suggestModule.className = 'eas-ai-suggest-module';
      suggestModule.innerHTML = `
        <div class="eas-suggest-title">您可能想问</div>
        <div class="eas-suggest-list">
          <button class="eas-suggest-pill" onclick="event.preventDefault()">周末加班的有效加班时数如何计入倒休时数中？</button>
          <button class="eas-suggest-pill" onclick="event.preventDefault()">法定节日的有效加班时间在调休和倒休方面有哪些限制？</button>
          <button class="eas-suggest-pill" onclick="event.preventDefault()">工作日（非正式）6小时班次对每周累计工作时间有什么要求？</button>
        </div>
      `;
      wrap.appendChild(suggestModule);
    }

    return wrap;
  }

  // 兼容旧的 trace 消息：映射为新的 AI 回复组件渲染
  _renderTraceBubble(msg) {
    const trace = msg && msg.trace ? msg.trace : {};
    const mapped = {
      role: 'ai',
      type: 'reply',
      reply: {
        collapsed: trace && typeof trace.collapsed !== 'undefined' ? trace.collapsed : true,
        refCount: 23,
        nodes: Array.isArray(trace.nodes) ? trace.nodes : [],
        content: ''
      }
    };
    return this._renderAiReply(mapped);
  }

  _traceStatusLabel(status) {
    if (status === 'running') return '执行中';
    if (status === 'done') return '已完成';
    if (status === 'error') return '执行异常';
    if (status === 'skipped') return '未触发';
    return '等待中';
  }

  _mapNodeKeyToAvatarClass(key) {
    if (key === 'start') return 'k-start';
    if (key === 'kb') return 'k-kb';
    if (key === 'llm') return 'k-llm';
    if (key === 'flow') return 'k-flow';
    if (key === 'mcp') return 'k-mcp';
    if (key === 'api') return 'k-api';
    if (key === 'component') return 'k-component';
    if (key === 'plugin') return 'k-plugin';
    if (key === 'end') return 'k-end';
    return 'k-end';
  }

  _mapNodeKeyToIconClass(key) {
    // 使用 FontAwesome，尽量贴近截图语义
    if (key === 'start') return 'fa-solid fa-play';
    if (key === 'kb') return 'fa-solid fa-database';
    if (key === 'llm') return 'fa-solid fa-microchip';
    if (key === 'flow') return 'fa-solid fa-paper-plane';
    if (key === 'mcp') return 'fa-solid fa-plug';
    if (key === 'api') return 'fa-solid fa-code';
    if (key === 'component') return 'fa-solid fa-cubes';
    if (key === 'plugin') return 'fa-solid fa-puzzle-piece';
    if (key === 'end') return 'fa-solid fa-flag-checkered';
    return 'fa-solid fa-circle';
  }

  _mapStatusToIconClass(status) {
    if (status === 'running') return 'fa-solid fa-circle-notch eas-ai-spin';
    if (status === 'done') return 'fa-solid fa-circle-check';
    if (status === 'error') return 'fa-solid fa-circle-xmark';
    if (status === 'skipped') return 'fa-solid fa-circle-xmark';
    return 'fa-regular fa-circle';
  }

  _mapStatusToDotClass(status) {
    // 圆点三态：加载中 / 执行完成 / 执行失败（未触发也视为失败态）
    if (status === 'running' || status === 'pending') return 'loading';
    if (status === 'done') return 'done';
    if (status === 'error' || status === 'skipped') return 'error';
    return '';
  }

  _mapStatusToDotIconClass(status) {
    // 加载中：一直转圈；成功：绿色对号；失败：红色叉号
    if (status === 'running' || status === 'pending') return 'fa-solid fa-circle-notch eas-ai-spin';
    // 参考样式：使用圆形对号/叉号
    if (status === 'done') return 'fa-solid fa-circle-check';
    if (status === 'error' || status === 'skipped') return 'fa-solid fa-circle-xmark';
    return 'fa-regular fa-circle';
  }

  _formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  _getNodeDurationText(n) {
    const status = n && n.status;
    if (status === 'done' && Number.isFinite(n.durationMs)) return this._formatDuration(n.durationMs);
    if (status === 'running' && Number.isFinite(n.startedAt)) return this._formatDuration(Date.now() - n.startedAt);
    return '';
  }

  _buildReplyMetaText(reply) {
    const nodes = Array.isArray(reply.nodes) ? reply.nodes : [];
    const running = nodes.find(n => n.status === 'running');
    if (running) {
      // 进行中：一行提示当前节点
      return `正在思考：${running.name}（执行中）`;
    }
    // 完成态：按要求固定格式（资料数可后续从检索结果替换）
    const refCount = Number.isFinite(reply.refCount) ? reply.refCount : 23;
    return `已完成思考，参考 ${refCount} 篇资料`;
  }

  _sendFromComposer() {
    const composer = this.shell.querySelector('[data-eas="composer"]');
    const v = String(composer.value || '').trim();
    if (!v) return;
    composer.value = '';
    this._appendMessage('user', v);
    this._mockReply(v);
  }

  _appendMessage(role, text) {
    const conv = this._getActiveConversation();
    if (!conv) return;
    conv.messages.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, role, text });
    // Update title if first user message
    if (!conv.title || conv.title === '新对话' || conv.title === '今天气氛很好') {
      if (role === 'user') conv.title = String(text).slice(0, 12);
    }
    this._renderHistory();
    this._renderChat();
  }

  _appendReplyMessage(reply) {
    const conv = this._getActiveConversation();
    if (!conv) return null;
    const msg = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'ai',
      type: 'reply',
      reply: reply && typeof reply === 'object' ? reply : {}
    };
    conv.messages.push(msg);
    this._renderHistory();
    this._renderChat();
    return msg;
  }

  _mockReply(userText) {
    // 按 PRD：先展示“思考节点”，再输出结果（同一条 AI 回复块内）
    const t = String(userText || '');
    let reply = `已收到：${t}`;
    if (t.includes('加班')) reply = '一般情况下，工作日加班可申请调休，具体以公司制度为准。';
    if (t.includes('积分')) reply = '部分福利可支持现金补差，具体以福利平台规则为准。';
    if (t.includes('重疾险')) reply = '重疾险范围通常包含恶性肿瘤、急性心肌梗死等，具体请以条款为准。';

    const flowId = `flow_${Date.now()}`;
    const startAt = Date.now();

    const nodes = [
      {
        key: 'start',
        name: '开始',
        status: 'running',
        desc: '流程启动的起点，对应用户提问提交',
        detail: `用户提问已接收，流程ID：${flowId}`,
        startedAt: startAt
      },
      {
        key: 'kb',
        name: '知识库',
        status: 'pending',
        desc: 'AI 问答核心环节，正在检索相关业务知识',
        detail: '命中文档条数：3条，检索总耗时：0.8s'
      },
      {
        key: 'llm',
        name: '大模型',
        status: 'pending',
        desc: 'AI 回答生成的核心环节，正在生成回答',
        detail: '模型：Qwen-Plus，已生成token数：156'
      },
      {
        key: 'flow',
        name: '流程输出',
        status: 'pending',
        desc: '流程的终点，对应最终答复输出',
        detail: '正在整理最终输出...'
      },
      { key: 'mcp', name: 'MCP', status: 'pending', desc: '工具调用节点（未触发）' },
      { key: 'api', name: 'API', status: 'pending', desc: '接口调用节点（未触发）' },
      { key: 'component', name: '应用组件', status: 'pending', desc: '组件调用节点（未触发）' },
      { key: 'plugin', name: '插件', status: 'pending', desc: '插件调用节点（未触发）' },
      { key: 'end', name: '结束', status: 'pending', desc: '等待输出最终答复…' }
    ];

    const replyMsg = this._appendReplyMessage({
      collapsed: true,
      refCount: 23,
      nodes,
      content: ''
    });

    // 逐步模拟节点状态（可按需扩展为真实链路）
    const advance = (idx, delay) => {
      setTimeout(() => {
        const conv = this._getActiveConversation();
        const msg = conv?.messages?.find(x => x && x.id === replyMsg?.id);
        const rep = msg?.reply;
        if (!rep || !Array.isArray(rep.nodes)) return;
        const n = rep.nodes[idx];
        if (!n) return;

        // 完成上一个 running
        rep.nodes.forEach(nn => {
          if (nn.status === 'running') {
            nn.status = 'done';
            if (Number.isFinite(nn.startedAt) && !Number.isFinite(nn.durationMs)) {
              nn.durationMs = Date.now() - nn.startedAt;
            }
          }
        });

        // 开始当前
        n.status = 'running';
        n.startedAt = Date.now();
        this._renderChat();

        const finishDelay = idx === 2 ? 900 : 650; // 大模型稍慢一点
        setTimeout(() => {
          // 结束当前
          n.status = 'done';
          if (Number.isFinite(n.startedAt) && !Number.isFinite(n.durationMs)) {
            n.durationMs = Date.now() - n.startedAt;
          }

          // 下一个步骤
          const nextIdx = idx + 1;
          if (rep.nodes[nextIdx] && ['kb', 'llm', 'flow'].includes(rep.nodes[nextIdx].key)) {
            this._renderChat();
            advance(nextIdx, 120);
            return;
          }

          // flow 完成后：其余节点标记未触发，进入结束
          if (n.key === 'flow') {
            rep.nodes.forEach(nn => {
              if (['mcp', 'api', 'component', 'plugin'].includes(nn.key)) {
                nn.status = 'skipped';
                nn.desc = '未触发';
              }
            });
            const endNode = rep.nodes.find(nn => nn.key === 'end');
            if (endNode) {
              endNode.status = 'running';
              this._renderChat();
              setTimeout(() => {
                endNode.status = 'done';
                rep.content = reply;
                this._renderChat();
              }, 450);
              return;
            }
          }
        }, finishDelay);
      }, delay);
    };

    advance(0, 120);
  }

  _showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.75);
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 20000;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
    toast.offsetHeight; // trigger reflow
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  _showDislikeInline(container, referenceNode, onConfirm) {
    // 如果已经存在则不再重复添加
    if (container.querySelector('.eas-dislike-inline-box')) return;

    const box = document.createElement('div');
    box.className = 'eas-dislike-inline-box';
    box.style.cssText = `
      margin-top: 4px;
      margin-bottom: 12px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      font-family: ui-sans-serif, system-ui, sans-serif;
      position: relative;
    `;

    box.innerHTML = `
      <button class="eas-dislike-close" style="position: absolute; right: 12px; top: 12px; background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 4px; transition: color 0.2s;">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 16px; padding-right: 24px;">请选择点踩的原因（可多选）</div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;" id="eas-dislike-tags">
        <button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; color: #6b7280; cursor: pointer; transition: all 0.2s;">答非所问，完全跑偏</button>
        <button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; color: #6b7280; cursor: pointer; transition: all 0.2s;">回答太简略，关键信息缺失</button>
        <button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; color: #6b7280; cursor: pointer; transition: all 0.2s;">格式混乱 / 看不清</button>
        <button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; color: #6b7280; cursor: pointer; transition: all 0.2s;">信息过时，与现行制度不符</button>
      </div>
      <div style="position: relative; margin-bottom: 16px;">
        <textarea class="eas-dislike-textarea" placeholder="请输入宝贵建议..." style="width: 100%; height: 50px; background: #f9fafb; border: none; border-radius: 6px; padding: 12px; font-size: 13px; color: #374151; resize: none; outline: none; box-sizing: border-box; font-family: inherit;"></textarea>
        <div class="eas-dislike-counter" style="position: absolute; right: 12px; bottom: 8px; font-size: 12px; color: #9ca3af;">0/500</div>
      </div>
      <div style="display: flex; justify-content: flex-end;">
        <button id="eas-dislike-submit" style="padding: 6px 24px; border: none; background: #d1d5db; color: #fff; border-radius: 999px; cursor: not-allowed; font-size: 13px; transition: background 0.2s;">提交</button>
      </div>
    `;

    // 插入到 suggestModule 前面，这样就在 footer 和 suggest 之间了
    if (referenceNode && referenceNode.parentNode === container) {
      container.insertBefore(box, referenceNode);
    } else {
      container.appendChild(box);
    }
    
    this._scrollToBottom();

    const tags = box.querySelectorAll('#eas-dislike-tags button');
    const submitBtn = box.querySelector('#eas-dislike-submit');
    const textarea = box.querySelector('.eas-dislike-textarea');
    const counter = box.querySelector('.eas-dislike-counter');
    let hasSelected = false;

    const checkSubmitState = () => {
      hasSelected = Array.from(tags).some(b => b.dataset.active === 'true');
      if (hasSelected) {
        submitBtn.style.background = '#9ca3af'; // 深灰色
        submitBtn.style.cursor = 'pointer';
      } else {
        submitBtn.style.background = '#d1d5db'; // 浅灰色
        submitBtn.style.cursor = 'not-allowed';
      }
    };

    textarea.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length > 500) {
        e.target.value = val.substring(0, 500);
      }
      counter.textContent = `${e.target.value.length}/500`;
    });

    tags.forEach(btn => {
      btn.onclick = () => {
        const isActive = btn.dataset.active === 'true';
        if (isActive) {
          btn.dataset.active = 'false';
          btn.style.background = '#fff';
          btn.style.borderColor = '#e5e7eb';
          btn.style.color = '#6b7280';
        } else {
          btn.dataset.active = 'true';
          btn.style.background = '#f3f4f6';
          btn.style.borderColor = '#d1d5db';
          btn.style.color = '#374151';
        }
        checkSubmitState();
      };
      
      btn.onmouseenter = () => {
        if (btn.dataset.active !== 'true') btn.style.background = '#f9fafb';
      };
      btn.onmouseleave = () => {
        if (btn.dataset.active !== 'true') btn.style.background = '#fff';
      };
    });

    box.querySelector('.eas-dislike-close').onclick = () => {
      box.remove();
    };

    box.querySelector('.eas-dislike-close').onmouseenter = (e) => e.target.style.color = '#4b5563';
    box.querySelector('.eas-dislike-close').onmouseleave = (e) => e.target.style.color = '#9ca3af';

    submitBtn.onclick = () => {
      if (!hasSelected) return;
      box.remove();
      this._showToast('反馈已提交，感谢您的建议');
      if (onConfirm) onConfirm();
    };
  }

  _showDislikeModal(onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 20001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      width: 400px;
      max-width: 90vw;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    modal.innerHTML = `
      <div style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px;">点踩原因反馈</div>
      <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap;" id="eas-dislike-tags">
        <button style="border: 1px solid #e5e7eb; background: #f9fafb; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #4b5563; cursor: pointer;">回答不准确</button>
        <button style="border: 1px solid #e5e7eb; background: #f9fafb; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #4b5563; cursor: pointer;">内容不完整</button>
        <button style="border: 1px solid #e5e7eb; background: #f9fafb; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #4b5563; cursor: pointer;">语气不友好</button>
        <button style="border: 1px solid #e5e7eb; background: #f9fafb; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #4b5563; cursor: pointer;">逻辑不连贯</button>
      </div>
      <textarea placeholder="其他补充原因..." style="width: 100%; height: 80px; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 13px; resize: none; outline: none; margin-bottom: 20px; box-sizing: border-box;"></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button id="eas-dislike-cancel" style="padding: 8px 16px; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 6px; cursor: pointer; font-size: 14px;">取消</button>
        <button id="eas-dislike-submit" style="padding: 8px 16px; border: none; background: ${this.config.primaryColor}; color: #fff; border-radius: 6px; cursor: pointer; font-size: 14px;">提交反馈</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const tags = modal.querySelectorAll('#eas-dislike-tags button');
    tags.forEach(btn => {
      btn.onclick = () => {
        const isActive = btn.style.background === 'rgb(239, 246, 255)'; // checking if active
        if (isActive) {
          btn.style.background = '#f9fafb';
          btn.style.borderColor = '#e5e7eb';
          btn.style.color = '#4b5563';
        } else {
          btn.style.background = '#eff6ff';
          btn.style.borderColor = '#bfdbfe';
          btn.style.color = '#1d4ed8';
        }
      };
    });

    modal.querySelector('#eas-dislike-cancel').onclick = () => overlay.remove();
    modal.querySelector('#eas-dislike-submit').onclick = () => {
      overlay.remove();
      this._showToast('反馈已提交，感谢您的建议');
      if (onConfirm) onConfirm();
    };
  }

  _showReferenceInline(container, referenceNode, refCount) {
    // 如果已经存在则不再重复添加，或者你可以实现 toggle
    if (container.querySelector('.eas-ref-inline-box')) {
      container.querySelector('.eas-ref-inline-box').remove();
      return;
    }

    const box = document.createElement('div');
    box.className = 'eas-ref-inline-box';
    box.style.cssText = `
      margin-top: 4px;
      margin-bottom: 12px;
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      position: relative;
    `;

    box.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <a href="#" class="eas-ref-item" style="color: #3b82f6; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-file-word" style="color: #60a5fa;"></i>
          <span style="text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;" onmouseenter="this.style.textDecorationColor='#3b82f6'" onmouseleave="this.style.textDecorationColor='transparent'">1. 好朋友考勤管理规定_v3_202506.docx</span>
        </a>
        <a href="#" class="eas-ref-item" style="color: #3b82f6; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-file-word" style="color: #60a5fa;"></i>
          <span style="text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;" onmouseenter="this.style.textDecorationColor='#3b82f6'" onmouseleave="this.style.textDecorationColor='transparent'">2. 好丽友食品有限公司员工手册_2022.docx</span>
        </a>
        <a href="#" class="eas-ref-item" style="color: #3b82f6; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-file-pdf" style="color: #f87171;"></i>
          <span style="text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;" onmouseenter="this.style.textDecorationColor='#3b82f6'" onmouseleave="this.style.textDecorationColor='transparent'">3. 员工假期管理办法_2023.pdf</span>
        </a>
      </div>
    `;

    // 插入到 suggestModule 前面，这样就在 footer 和 suggest 之间了
    if (referenceNode && referenceNode.parentNode === container) {
      container.insertBefore(box, referenceNode);
    } else {
      container.appendChild(box);
    }
    
    this._scrollToBottom();
  }

  _scrollToBottom() {
    const chat = this.shell?.querySelector('[data-eas="chat"]');
    if (!chat) return;
    chat.scrollTop = chat.scrollHeight;
  }
}

window.EnterpriseAssistantSDK = EnterpriseAssistantSDK;

// Auto init (safe)
document.addEventListener('DOMContentLoaded', () => {
  if (window.enterpriseAssistantSDK) {
    // 若页面已存在旧实例（热更新/重复注入），则同步清理调试智能体并重绘
    try {
      const sdk = window.enterpriseAssistantSDK;
      if (sdk && sdk.config && Array.isArray(sdk.config.agents)) {
        sdk.config.agents = sdk.config.agents.filter(a => !String(a && a.name || '').includes('调试'));
        if (!sdk.config.agents.some(a => a && a.id === sdk.state?.activeAgentId)) {
          if (sdk.state) sdk.state.activeAgentId = sdk.config.agents[0]?.id || null;
        }
        if (typeof sdk._ensureConversation === 'function') sdk._ensureConversation();
        if (typeof sdk._render === 'function') sdk._render();
      }
    } catch (_) {}
    return;
  }
  try {
    window.enterpriseAssistantSDK = new EnterpriseAssistantSDK();
  } catch (e) {
    console.error('[EnterpriseAssistantSDK] init failed:', e);
  }
});
