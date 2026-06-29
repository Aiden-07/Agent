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
        { id: 'agent-hr', name: '人事业务咨询', icon: 'fa-solid fa-user-tie', knowledge: ['KB-HR-001'] },
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
        messages: [],
        createdAt: Date.now()
      };
      this.state.conversations.set(agentId, [first]);
      this.state.activeConvId = first.id;
      return;
    }
    const convs = this.state.conversations.get(agentId) || [];
    if (!convs.length) {
      const first = { id: `conv-${agentId}-0`, title: '新对话', messages: [], createdAt: Date.now() };
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
      messages: [],
      createdAt: Date.now()
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

  _activeAgentHasKnowledge() {
    const activeAgent = this._getActiveAgent();
    const hasKnowledge = (agent) => {
      if (!agent) return false;
      const fields = [
        agent.knowledge,
        agent.knowledgeBase,
        agent.knowledgeBases,
        agent.knowledge_ids,
        agent.knowledgeIds
      ];
      return fields.some(value => Array.isArray(value) && value.length > 0);
    };
    if (hasKnowledge(activeAgent)) return true;

    if (typeof window.getAgentById === 'function' && activeAgent && activeAgent.id) {
      if (hasKnowledge(window.getAgentById(activeAgent.id))) return true;
    }

    if (Array.isArray(window.agentsData) && activeAgent) {
      const matched = window.agentsData.find(agent =>
        String(agent.id) === String(activeAgent.id) ||
        String(agent.name || '') === String(activeAgent.name || '')
      );
      if (hasKnowledge(matched)) return true;
    }

    return false;
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
        transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
      }
      .eas-window.eas-fullscreen {
        width: 100vw !important;
        height: 100vh !important;
        left: 0 !important;
        top: 0 !important;
        border-radius: 0;
        box-shadow: none;
        position: relative !important;
      }
      .eas-resize-handle {
        position: absolute;
        z-index: 100;
        user-select: none;
      }
      .eas-resize-t { top: -2px; left: 0; right: 0; height: 6px; cursor: ns-resize; }
      .eas-resize-b { bottom: -2px; left: 0; right: 0; height: 6px; cursor: ns-resize; }
      .eas-resize-l { left: -2px; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
      .eas-resize-r { right: -2px; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
      .eas-resize-tl { top: -2px; left: -2px; width: 12px; height: 12px; cursor: nwse-resize; }
      .eas-resize-tr { top: -2px; right: -2px; width: 12px; height: 12px; cursor: nesw-resize; }
      .eas-resize-bl { bottom: -2px; left: -2px; width: 12px; height: 12px; cursor: nesw-resize; }
      .eas-resize-br { bottom: -2px; right: -2px; width: 12px; height: 12px; cursor: nwse-resize; }
      .eas-window.eas-fullscreen .eas-resize-handle { display: none; }
      .eas-window.eas-resizing { transition: none !important; }
      
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
      .eas-history-meta{
        display:none;
        margin-top: 3px;
        font-size: 11px;
        line-height: 16px;
        color:#64748b;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      /* 选中态下显示 meta（创建时间 + 转人工） */
      .eas-history-item.active .eas-history-meta{ display:block; }
      .eas-history-meta .eas-meta-tag{
        display:inline-block;
        padding: 0 4px;
        border-radius: 3px;
        background:#fef3c7;
        color:#92400e;
        font-size: 10px;
        font-weight: 600;
        margin-left: 6px;
      }
      .eas-history-item.has-search-hit{
        align-items:flex-start;
      }
      .eas-history-item.has-search-hit .eas-history-meta{
        display:block;
      }
      .eas-history-highlight{
        color:#1d4ed8;
        background:#dbeafe;
        border-radius: 4px;
        padding: 0 2px;
        font-weight: 700;
      }

      /* 人工 badge（未选中态下固定在右侧） */
      .eas-history-badge{
        display:none;
        flex: 0 0 auto;
        font-size: 10px;
        font-weight: 700;
        color:#d97706;
        background:#fef3c7;
        padding: 2px 5px;
        border-radius: 4px;
        white-space:nowrap;
        line-height: 1.4;
        margin-left: auto;
        transition: opacity .12s ease;
      }
      .eas-history-item.has-transfer .eas-history-badge{ display:block; }
      .eas-history-item.active .eas-history-badge{ display:none !important; }
      .eas-history-item:hover .eas-history-badge{ opacity: 0; }

      /* 更多操作弹窗 */
      .eas-history-popup{
        display:none;
        position: fixed;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,.1);
        z-index: 11000;
        min-width: 130px;
        padding: 4px 0;
        animation: fadeInDown .15s ease-out forwards;
      }
      .eas-history-popup.show{ display:block; }
      .eas-history-popup-item{
        display:flex;
        align-items:center;
        gap: 8px;
        padding: 7px 12px;
        font-size: 12px;
        color:#334155;
        cursor:pointer;
        border: none;
        background: transparent;
        width: 100%;
        text-align: left;
        transition: background .1s ease;
      }
      .eas-history-popup-item:hover{ background:#f1f5f9; }
      .eas-history-popup-item.eas-popup-danger{ color:#ef4444; }
      .eas-history-popup-item.eas-popup-danger:hover{ background:#fef2f2; }

      /* 历史项容器需要 relative 定位 */
      .eas-history-item{ position: relative; }

      /* 右侧略浅同色系底：比左侧更浅 */
      .eas-right{ flex:1; min-width:0; display:flex; flex-direction:column; background:#f8fafc; position: relative; overflow: visible; }
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
        font-size: 13px; color:#9ca3af; font-weight: normal;
        display:flex; align-items:center; gap:10px;
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
        gap: 8px;
      }
      .eas-action-icon-btn {
        background: transparent;
        border: none;
        width: 28px;
        height: 28px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        cursor: pointer;
        transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        font-size: 14px;
        border-radius: 6px;
        flex: 0 0 auto;
      }
      .eas-action-icon-btn:hover {
        color: #0f172a;
        background: #eef2f7;
        transform: translateY(-1px);
      }
      .eas-action-icon-btn:active {
        transform: translateY(0);
      }
      .eas-ai-ref-right {
        display: flex;
        align-items: center;
      }
      .eas-ref-simple-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #64748b;
        text-decoration: none;
        transition: color 0.2s ease;
      }
      .eas-ref-simple-link:hover {
        color: #0f172a;
        text-decoration: underline;
      }

      /* 3. 相关问题推荐模块 */
      .eas-ai-suggest-module {
        margin-top: 16px;
        padding-top: 0px;
      }
      .eas-suggest-title {
        font-size: 13px;
        color: #9ca3af;
        margin-bottom: 10px;
        font-weight: normal;
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
      .eas-welcome-textarea-wrap{
        position: relative;
      }
      .eas-welcome-emoji-btn{
        position: absolute;
        left: 2px;
        bottom: 6px;
        z-index: 2;
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
        /* 为左右两侧按钮预留空间 */
        padding-right: 44px;
        padding-left: 40px;
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
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        max-height: 140px;
        overflow-y: auto;
        padding: 4px;
        padding-right: 8px;
      }
      .eas-welcome-files::-webkit-scrollbar {
        width: 6px;
      }
      .eas-welcome-files::-webkit-scrollbar-track {
        background: transparent;
      }
      .eas-welcome-files::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 10px;
      }
      .eas-file-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        min-width: 0;
      }
      .eas-file-card-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      .eas-file-card-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .eas-file-card-name {
        font-size: 13px;
        color: #1e293b;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .eas-file-card-meta {
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }
      .eas-file-card-close {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ef4444;
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 10px;
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 10;
      }
      .eas-file-card:hover .eas-file-card-close {
        opacity: 1;
      }
      .eas-file-card-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: #3b82f6;
        width: 0%;
        transition: width 0.3s ease;
        border-radius: 0 0 0 8px;
      }
      .eas-file-card.success .eas-file-card-progress {
        background: #10b981;
        opacity: 0;
        transition: opacity 0.5s ease 1s;
      }
      .eas-file-card.error {
        border-color: #fca5a5;
        background: #fef2f2;
      }
      .eas-file-card.error .eas-file-card-progress {
        background: #ef4444;
        width: 100% !important;
        opacity: 0.5;
      }
      .eas-file-card.error .eas-file-card-meta {
        color: #ef4444;
      }
      .eas-file-card-retry {
        position: absolute;
        top: 50%;
        right: 10px;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fee2e2;
        color: #ef4444;
        border: 1px solid #fca5a5;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 12px;
        z-index: 10;
        transition: all 0.2s;
      }
      .eas-file-card-retry:hover {
        background: #fecaca;
        color: #b91c1c;
      }
      .eas-file-card-retry i {
        pointer-events: none;
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
        border-top: none;
        /* 右侧对话区：底部输入栏去背景 */
        background: transparent;
        position: relative;
      }
      .eas-inputbar textarea{
        width: 100%;
        resize:none;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        /* 预留左右两侧按钮空间 */
        padding: 10px 52px 10px 52px;
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

      /* 表情按钮 */
      .eas-emoji-btn{
        position: absolute;
        left: 22px;
        bottom: 22px;
        width: 36px; height: 36px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: color .12s ease, background .12s ease, border-color .12s ease;
      }
      .eas-emoji-btn:hover{
        color: #64748b;
        background: #f1f5f9;
        border-color: #e2e8f0;
      }
      .eas-emoji-btn i{ font-size: 18px; }

      /* 表情选择器 —— fixed 定位避免被父容器 overflow:hidden 裁剪 */
      .eas-emoji-picker{
        position: fixed;
        width: 284px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(15,23,42,.14);
        z-index: 11000;
        overflow: hidden;
        display: none;
        flex-direction: column;
      }
      .eas-emoji-picker-categories{
        display: flex;
        gap: 2px;
        padding: 8px 8px 4px;
        border-bottom: 1px solid #f1f5f9;
        flex-shrink: 0;
      }
      .eas-emoji-picker-cat{
        width: 32px; height: 32px;
        border-radius: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: background .12s ease;
      }
      .eas-emoji-picker-cat:hover{ background: #f1f5f9; }
      .eas-emoji-picker-cat.active{ background: #eff6ff; }
      .eas-emoji-picker-grid{
        overflow-y: auto;
        max-height: 240px;
        padding: 8px;
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
      }
      .eas-emoji-picker-item{
        aspect-ratio: 1;
        border-radius: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: background .12s ease, transform .12s ease;
      }
      .eas-emoji-picker-item:hover{
        background: #f1f5f9;
        transform: scale(1.18);
      }
      .eas-emoji-picker-item:active{ transform: scale(.95); }
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
        <div class="eas-resize-handle eas-resize-t" data-dir="t"></div>
        <div class="eas-resize-handle eas-resize-b" data-dir="b"></div>
        <div class="eas-resize-handle eas-resize-l" data-dir="l"></div>
        <div class="eas-resize-handle eas-resize-r" data-dir="r"></div>
        <div class="eas-resize-handle eas-resize-tl" data-dir="tl"></div>
        <div class="eas-resize-handle eas-resize-tr" data-dir="tr"></div>
        <div class="eas-resize-handle eas-resize-bl" data-dir="bl"></div>
        <div class="eas-resize-handle eas-resize-br" data-dir="br"></div>
        <div class="eas-header">
          <div class="eas-header-left"></div>
          <div class="eas-header-actions">
            <button class="eas-hbtn" data-eas="openNewWindow" aria-label="在新窗口打开" title="在新窗口打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
            <button class="eas-hbtn" data-eas="fullscreen" aria-label="全屏"><i class="fa-solid fa-expand"></i></button>
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
            <div class="eas-chat" data-eas="chat"></div>
            <div class="eas-inputbar">
              <textarea data-eas="composer" placeholder="请输入输入您的提问..."></textarea>
              <button class="eas-emoji-btn" data-eas="emoji" type="button" aria-label="表情" title="插入表情">
                <i class="fa-regular fa-face-smile"></i>
              </button>
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
    const fsBtn = this.shell.querySelector('[data-eas="fullscreen"]');
    const windowEl = this.shell.querySelector('.eas-window');
    const toggleSidebarBtn = this.shell.querySelector('[data-eas="toggleSidebar"]');
    
    backdrop.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    
    if (fsBtn && windowEl) {
      fsBtn.addEventListener('click', () => {
        const isFull = windowEl.classList.toggle('eas-fullscreen');
        if (isFull) {
          fsBtn.setAttribute('aria-label', '缩小');
          fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
          fsBtn.setAttribute('aria-label', '全屏');
          fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
      });
    }

    // Open in new window button
    const newWinBtn = this.shell.querySelector('[data-eas="openNewWindow"]');
    if (newWinBtn) {
      newWinBtn.addEventListener('click', () => {
        this._openInNewWindow();
      });
    }

    // Window Resizing Logic
    const handles = this.shell.querySelectorAll('.eas-resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX = 0, startY = 0;
    let startWidth = 0, startHeight = 0;
    let startLeft = 0, startTop = 0;

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      const dir = currentHandle.getAttribute('data-dir');
      const minW = 600;
      const minH = 400;

      if (dir.includes('r')) {
        newWidth = Math.max(minW, startWidth + dx);
      }
      if (dir.includes('l')) {
        newWidth = Math.max(minW, startWidth - dx);
        newLeft = startLeft + startWidth - newWidth;
      }
      if (dir.includes('b')) {
        newHeight = Math.max(minH, startHeight + dy);
      }
      if (dir.includes('t')) {
        newHeight = Math.max(minH, startHeight - dy);
        newTop = startTop + startHeight - newHeight;
      }

      windowEl.style.width = newWidth + 'px';
      windowEl.style.height = newHeight + 'px';
      windowEl.style.left = newLeft + 'px';
      windowEl.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      windowEl.classList.remove('eas-resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (windowEl.classList.contains('eas-fullscreen')) return;
        e.preventDefault();
        e.stopPropagation();
        
        const rect = windowEl.getBoundingClientRect();
        // Switch from flex centering to absolute positioning on first drag
        if (windowEl.style.position !== 'absolute') {
          windowEl.style.position = 'absolute';
          windowEl.style.left = rect.left + 'px';
          windowEl.style.top = rect.top + 'px';
          windowEl.style.transform = 'none';
          windowEl.style.margin = '0';
          windowEl.style.width = rect.width + 'px';
          windowEl.style.height = rect.height + 'px';
        }

        isResizing = true;
        currentHandle = handle;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = parseFloat(windowEl.style.left) || rect.left;
        startTop = parseFloat(windowEl.style.top) || rect.top;

        windowEl.classList.add('eas-resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

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

    // Emoji picker — shared picker for both normal inputbar and welcome view
    this._initEmojiPicker();
  }

  _initEmojiPicker() {
    // Shared emoji data
    const EMOJI_DATA = [
      { cat: '表情', icon: '😊', items: ['😀','😃','😄','😁','😅','🤣','😂','🙂','😊','😇','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','😵','🤯','🥴','🥺','😢','😭','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺'] },
      { cat: '手势', icon: '👍', items: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👋','🤚','🖐️','✋','🖖','👏','🙌','🤝','🙏','✍️','💪','🦾','🦵','🦿','👈','👉','👆','👇','🖕','☝️','🤏','👐','🤲'] },
      { cat: '爱心', icon: '❤️', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'] },
      { cat: '物品', icon: '💡', items: ['💡','🔦','💻','🖥️','⌨️','🖱️','🖨️','📱','📞','☎️','📟','📺','📻','🎙️','🎚️','🎛️','⏰','🕰️','⌚','📡','🔋','🔌','💰','💎','💵','💴','💶','💷','💸','🪙','🏷️','🔖','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎'] },
      { cat: '符号', icon: '✅', items: ['✅','❌','❓','❗','‼️','⁉️','➕','➖','➗','✖️','♾️','💲','➰','➿','〰️','©️','®️','™️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔘','🔲','🔳','◼️','◻️','◾','◽','▪️','▫️'] },
      { cat: '办公', icon: '📊', items: ['📊','📈','📉','📋','📌','📎','🖇️','📏','📐','✂️','🗂️','📁','📂','🗄️','📅','📆','🗑️','🖼️','🏷️','📦','📭','📬','📫','📪','📩','📨','📧','✉️','📜','📃','📄','📑','🧾','💰','💳','💼','🛒','📢','📣','🔔','🔕','🎵','🎶'] },
    ];

    // Create shared picker element at shell level (fixed positioning avoids clipping)
    const picker = document.createElement('div');
    picker.className = 'eas-emoji-picker';
    picker.setAttribute('data-eas', 'sharedEmojiPicker');
    this.shell.appendChild(picker);

    let activeCat = 0;
    let currentTextarea = null;
    let currentBtn = null;

    const buildContent = (catIndex) => {
      let html = '<div class="eas-emoji-picker-categories">';
      EMOJI_DATA.forEach((c, i) => {
        html += `<button class="eas-emoji-picker-cat${i === catIndex ? ' active' : ''}" data-eas="emojiCat" data-index="${i}" title="${c.cat}">${c.icon}</button>`;
      });
      html += '</div>';
      html += '<div class="eas-emoji-picker-grid">';
      EMOJI_DATA[catIndex].items.forEach(e => {
        html += `<button class="eas-emoji-picker-item" data-eas="emojiItem" data-emoji="${e}">${e}</button>`;
      });
      html += '</div>';
      return html;
    };

    const render = (catIndex) => {
      picker.innerHTML = buildContent(catIndex);
      picker.querySelectorAll('[data-eas="emojiCat"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          activeCat = parseInt(btn.dataset.index);
          render(activeCat);
        });
      });
      picker.querySelectorAll('[data-eas="emojiItem"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentTextarea) {
            this._insertEmojiAtCursor(currentTextarea, btn.dataset.emoji);
            currentTextarea.focus();
          }
        });
      });
    };

    const positionPicker = (btn) => {
      const rect = btn.getBoundingClientRect();
      const pickerH = 300; // estimated max height
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Prefer above the button, fallback to below
      if (spaceAbove > pickerH + 8) {
        picker.style.bottom = 'auto';
        picker.style.top = (rect.top - pickerH - 8) + 'px';
      } else {
        picker.style.top = 'auto';
        picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      }
      // Align left edge with button, clamp to viewport
      let left = rect.left;
      if (left + 284 > window.innerWidth - 8) left = window.innerWidth - 284 - 8;
      if (left < 8) left = 8;
      picker.style.left = left + 'px';
    };

    const open = (btn, textarea) => {
      currentBtn = btn;
      currentTextarea = textarea;
      positionPicker(btn);
      picker.style.display = 'flex';
      render(activeCat);
    };

    const close = () => {
      picker.style.display = 'none';
      currentBtn = null;
    };

    const toggle = (btn, textarea) => {
      if (picker.style.display === 'flex' && currentBtn === btn) {
        close();
      } else {
        open(btn, textarea);
      }
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (picker.style.display === 'flex') {
        if (!picker.contains(e.target) && e.target !== currentBtn && (currentBtn && !currentBtn.contains(e.target))) {
          close();
        }
      }
    });

    // Reposition on scroll/resize
    window.addEventListener('scroll', () => {
      if (picker.style.display === 'flex' && currentBtn) positionPicker(currentBtn);
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (picker.style.display === 'flex' && currentBtn) positionPicker(currentBtn);
    }, { passive: true });

    // ---- Register normal inputbar emoji button ----
    const normalBtn = this.shell.querySelector('[data-eas="emoji"]');
    const normalComposer = this.shell.querySelector('[data-eas="composer"]');
    if (normalBtn && normalComposer) {
      normalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(normalBtn, normalComposer);
      });
    }

    // Expose so welcome view can register its emoji button later
    this._registerEmojiButton = (btn, textarea) => {
      if (!btn || !textarea) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(btn, textarea);
      });
    };
  }

  _insertEmojiAtCursor(textarea, emoji) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + emoji + after;
    // Set cursor position after inserted emoji
    const newPos = start + emoji.length;
    textarea.selectionStart = textarea.selectionEnd = newPos;
    // Trigger input event so send button state updates
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  _openInNewWindow() {
    // Build agent/session data in chat-preview.html compatible format
    const agentsForPreview = [];
    this.config.agents.forEach(cfgAgent => {
      const convs = this.state.conversations.get(cfgAgent.id) || [];
      const sessions = convs.map(conv => ({
        id: conv.id,
        title: conv.title || '新对话',
        lastActive: conv.createdAt ? new Date(conv.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
        messages: (conv.messages || []).map(m => ({
          role: m.role === 'ai' ? 'assistant' : m.role,
          content: m.text || (m.reply && typeof m.reply === 'object' ? (m.reply.summary || m.reply.text || JSON.stringify(m.reply)) : String(m.text || ''))
        }))
      }));

      // Default visual assignment
      const visuals = [
        { avatar: 'fa-robot', color: 'bg-blue-100 text-blue-600' },
        { avatar: 'fa-shield-halved', color: 'bg-purple-100 text-purple-600' },
        { avatar: 'fa-pen-nib', color: 'bg-green-100 text-green-600' },
        { avatar: 'fa-code', color: 'bg-amber-100 text-amber-600' },
        { avatar: 'fa-chart-line', color: 'bg-rose-100 text-rose-600' },
        { avatar: 'fa-globe', color: 'bg-cyan-100 text-cyan-600' },
      ];
      const visIdx = agentsForPreview.length % visuals.length;

      agentsForPreview.push({
        id: cfgAgent.id,
        name: cfgAgent.name,
        avatar: cfgAgent.icon ? cfgAgent.icon.replace('fa-solid ', '').replace('fa-regular ', '').replace('fa-brands ', '') : visuals[visIdx].avatar,
        color: visuals[visIdx].color,
        sessions
      });
    });

    // Save current state to localStorage for chat-preview.html to pick up
    const activeAgent = this._getActiveAgent();
    const activeConv = this._getActiveConversation();
    localStorage.setItem('agentsData', JSON.stringify(agentsForPreview));
    localStorage.setItem('vagent_chat_data', JSON.stringify(agentsForPreview));
    localStorage.setItem('vagent_chat_state', JSON.stringify({
      agentId: this.state.activeAgentId,
      sessionId: this.state.activeConvId
    }));

    // Open chat-preview.html in a new browser tab
    window.open('views/chat-preview.html', '_blank');
  }

  _restoreFabPosition() {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) {
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
    const pos = { right: baseRight, bottom: baseBottom, dock: null };
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

  _hasZhuanRenGong(conv) {
    if (!conv || !Array.isArray(conv.messages)) return false;
    // 检查用户消息中是否包含「转人工」字样
    return conv.messages.some(m => m && m.role === 'user' && String(m.text || '').includes('转人工'));
  }

  _renderHistory() {
    const list = this.shell.querySelector('[data-eas="historyList"]');
    if (!list) return;

    const activeAgent = this._getActiveAgent();
    const activeAgentIcon = activeAgent && activeAgent.icon ? activeAgent.icon : 'fa-regular fa-comment-dots';

    const q = this.state.historyQuery.trim().toLowerCase();
    const convs = this._getActiveConversations();
    const self = this;

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const renderHighlighted = (value) => {
      const text = String(value ?? '');
      if (!q) return escapeHtml(text);
      const lower = text.toLowerCase();
      const parts = [];
      let cursor = 0;
      let index = lower.indexOf(q, cursor);
      while (index !== -1) {
        parts.push(escapeHtml(text.slice(cursor, index)));
        parts.push(`<span class="eas-history-highlight">${escapeHtml(text.slice(index, index + q.length))}</span>`);
        cursor = index + q.length;
        index = lower.indexOf(q, cursor);
      }
      parts.push(escapeHtml(text.slice(cursor)));
      return parts.join('');
    };
    const getMessageText = (m) => {
      if (!m) return '';
      if (m.type === 'reply') {
        return m.reply && m.reply.content ? String(m.reply.content) : '';
      }
      if (m.type === 'trace') return '';
      return m.text ? String(m.text) : '';
    };
    const getSearchSnippet = (conv) => {
      if (!q) return '';
      const title = String(conv.title || '');
      if (title.toLowerCase().includes(q)) {
        return title;
      }
      const hit = (conv.messages || [])
        .map(getMessageText)
        .find(text => text.toLowerCase().includes(q));
      if (!hit) return '';

      const lower = hit.toLowerCase();
      const hitIndex = lower.indexOf(q);
      const start = Math.max(0, hitIndex - 12);
      const end = Math.min(hit.length, hitIndex + q.length + 24);
      return `${start > 0 ? '...' : ''}${hit.slice(start, end)}${end < hit.length ? '...' : ''}`;
    };
    const formatTime = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const filtered = !q ? convs : convs.filter(c => {
      if ((c.title || '').toLowerCase().includes(q)) return true;
      return (c.messages || []).some(m => getMessageText(m).toLowerCase().includes(q));
    });

    // 全局关闭所有弹窗
    const closeAllPopups = () => {
      list.querySelectorAll('.eas-history-popup.show').forEach(p => p.classList.remove('show'));
    };

    // 点击外部关闭弹窗
    const onClickOutside = (e) => {
      if (!e.target.closest('.eas-history-popup') && !e.target.closest('[data-action="more"]')) {
        closeAllPopups();
      }
    };
    document.removeEventListener('click', onClickOutside);
    document.addEventListener('click', onClickOutside);

    list.innerHTML = '';
    filtered.forEach(conv => {
      const item = document.createElement('div');

      const hasContent = (conv.messages && conv.messages.length > 0) || conv.title !== '新对话';
      const isActive = (conv.id === this.state.activeConvId) && hasContent;
      const hasTransfer = self._hasZhuanRenGong(conv);
      const searchSnippet = getSearchSnippet(conv);

      item.className = `eas-history-item ${isActive ? 'active' : ''} ${!hasContent ? 'is-new-conv' : ''} ${searchSnippet ? 'has-search-hit' : ''} ${hasTransfer ? 'has-transfer' : ''}`;

      const last = (conv.messages || []).slice(-1)[0];
      const lastPreview = last
        ? (last.type === 'reply'
          ? (last.reply && last.reply.content ? String(last.reply.content) : '思考中...')
          : (last.type === 'trace' ? '思考中...' : (last.text ? String(last.text) : '')))
        : '';
      const titleText = conv.title || '未命名会话';

      // 选中态：显示创建时间 + 转人工标签
      let metaHtml;
      if (isActive) {
        const timeStr = conv.createdAt ? formatTime(conv.createdAt) : '';
        const transferTag = hasTransfer ? ' <span class="eas-meta-tag">已转人工</span>' : '';
        metaHtml = `<div class="eas-history-meta" title="创建时间：${escapeHtml(timeStr)}">${escapeHtml(timeStr)}${transferTag}</div>`;
      } else {
        const metaText = searchSnippet || (lastPreview ? lastPreview.slice(0, 28) : '暂无消息');
        const metaTitle = searchSnippet || lastPreview || '暂无消息';
        metaHtml = `<div class="eas-history-meta" title="${escapeHtml(metaTitle)}">${renderHighlighted(metaText)}</div>`;
      }

      // 弹窗菜单
      const popupItems = [];
      if (hasTransfer) {
        popupItems.push(`<button type="button" class="eas-history-popup-item" data-action="view-doc"><i class="fa-regular fa-file-lines" style="width:14px;text-align:center;"></i> 查看单据</button>`);
      }
      popupItems.push(`<button type="button" class="eas-history-popup-item" data-action="rename"><i class="fa-regular fa-pen-to-square" style="width:14px;text-align:center;"></i> 重命名</button>`);
      popupItems.push(`<button type="button" class="eas-history-popup-item eas-popup-danger" data-action="delete"><i class="fa-regular fa-trash-can" style="width:14px;text-align:center;"></i> 删除</button>`);

      item.innerHTML = `
        <div class="eas-history-item-inner">
          <div class="eas-history-icon"><i class="${activeAgentIcon}"></i></div>
          <div class="eas-history-text" style="min-width:0; flex:1;">
            <div class="eas-history-title" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</div>
            ${metaHtml}
          </div>
          <span class="eas-history-badge">人工</span>
          <div class="eas-history-actions">
            <button type="button" class="eas-history-action" data-action="more" title="更多操作">
              <i class="fa-solid fa-ellipsis"></i>
            </button>
          </div>
        </div>
        <div class="eas-history-popup">
          ${popupItems.join('')}
        </div>
      `;

      // 更多操作按钮 → 切换弹窗
      const moreBtn = item.querySelector('[data-action="more"]');
      const popupEl = item.querySelector('.eas-history-popup');
      if (moreBtn && popupEl) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasShown = popupEl.classList.contains('show');
          closeAllPopups();
          if (!wasShown) {
            // 计算弹窗位置（fixed定位，基于按钮位置）
            const btnRect = moreBtn.getBoundingClientRect();
            popupEl.style.top = (btnRect.bottom + 4) + 'px';
            popupEl.style.right = (window.innerWidth - btnRect.right) + 'px';
            popupEl.classList.add('show');
          }
        });
      }

      // 弹窗内按钮事件
      item.querySelectorAll('.eas-history-popup-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeAllPopups();
          const action = btn.getAttribute('data-action');
          const agentId = self.state.activeAgentId;
          const convsAll = self.state.conversations.get(agentId) || [];
          const idx = convsAll.findIndex(c => c.id === conv.id);
          if (idx < 0) return;

          if (action === 'view-doc') {
            // 查看转人工单据
            alert(`查看单据：会话「${conv.title || '未命名'}」已转人工处理。`);
            return;
          }

          if (action === 'rename') {
            const next = prompt('请输入新的会话名称', conv.title || '');
            if (next == null) return;
            convsAll[idx].title = String(next).trim() || '未命名会话';
            self.state.conversations.set(agentId, convsAll);
            self._renderHistory();
            return;
          }

          if (action === 'delete') {
            const ok = confirm('确认删除该会话？');
            if (!ok) return;
            const removed = convsAll.splice(idx, 1);
            self.state.conversations.set(agentId, convsAll);

            if (removed[0] && removed[0].id === self.state.activeConvId) {
              if (!convsAll.length) self._createNewConversation({ agentId, title: '新对话' });
              else self.state.activeConvId = convsAll[0].id;
              self._render();
            } else {
              self._renderHistory();
            }
          }
        });
      });

      item.addEventListener('click', (e) => {
        // 如果点击的是弹窗内容，不触发选中
        if (e.target.closest('.eas-history-popup')) return;
        self.state.activeConvId = conv.id;
        self._renderHistory();
        self._renderChat();
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
            ${allowWelcomeFiles ? `<input type="file" data-eas="welcomeFileInput" style="display:none" multiple />` : ''}
            ${allowWelcomeFiles ? `<div class="eas-welcome-files" data-eas="welcomeFiles" style="display:none"></div>` : ''}
            <div class="eas-welcome-textarea-wrap">
              <textarea class="eas-welcome-textarea" data-eas="welcomeInput" placeholder="${welcomePlaceholder}"></textarea>
              <button class="eas-emoji-btn eas-welcome-emoji-btn" data-eas="welcomeEmoji" type="button" aria-label="表情" title="插入表情">
                <i class="fa-regular fa-face-smile"></i>
              </button>
            </div>
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
      const welcomeEmojiBtn = chat.querySelector('[data-eas="welcomeEmoji"]');

      // Register welcome emoji button with the shared picker
      if (welcomeEmojiBtn && inputEl && this._registerEmojiButton) {
        this._registerEmojiButton(welcomeEmojiBtn, inputEl);
      }

      let attachments = [];
      const updateWelcomeSendBtn = () => {
        const v = String(inputEl?.value || '').trim();
        const ok = !!v || attachments.some(a => a.status === 'success');
        if (sendBtn) sendBtn.disabled = !ok;
      };

      const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };
      const getExt = (name) => {
        if (!name) return 'FILE';
        const parts = name.split('.');
        return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
      };
      const getFileIcon = (ext) => {
        const e = ext.toLowerCase();
        if (['pdf'].includes(e)) return '<i class="fa-regular fa-file-pdf" style="color: #ef4444;"></i>';
        if (['doc', 'docx'].includes(e)) return '<i class="fa-regular fa-file-word" style="color: #3b82f6;"></i>';
        if (['xls', 'xlsx'].includes(e)) return '<i class="fa-regular fa-file-excel" style="color: #10b981;"></i>';
        if (['png', 'jpg', 'jpeg', 'gif'].includes(e)) return '<i class="fa-regular fa-file-image" style="color: #a855f7;"></i>';
        return '<i class="fa-regular fa-file-lines" style="color: #64748b;"></i>';
      };

      const renderFiles = () => {
        if (!filesWrap) return;
        filesWrap.innerHTML = '';
        if (!attachments.length) {
          filesWrap.style.display = 'none';
          updateWelcomeSendBtn();
          return;
        }
        filesWrap.style.display = 'grid';
        attachments.forEach(item => {
          const f = item.file;
          const ext = getExt(f.name);
          const icon = getFileIcon(ext);
          const size = formatSize(f.size);
          const isError = item.status === 'error';
          const isSuccess = item.status === 'success';
          
          const chip = document.createElement('div');
          chip.className = `eas-file-card ${isSuccess ? 'success' : ''} ${isError ? 'error' : ''}`;
          chip.id = `card-${item.id}`;
          
          let metaHtml = `<span>${ext}</span><span>${size}</span>`;
          if (isError) {
            metaHtml = `<span>上传失败</span><span>${size}</span>`;
          }

          chip.innerHTML = `
            <div class="eas-file-card-icon">${icon}</div>
            <div class="eas-file-card-info">
              <div class="eas-file-card-name" title="${f.name || '未命名文件'}">${f.name || '未命名文件'}</div>
              <div class="eas-file-card-meta">${metaHtml}</div>
            </div>
            ${isError ? `<button type="button" class="eas-file-card-retry" title="重新上传"><i class="fa-solid fa-rotate-right"></i></button>` : ''}
            <button type="button" class="eas-file-card-close"><i class="fa-solid fa-xmark"></i></button>
            <div class="eas-file-card-progress" id="prog-${item.id}" style="width: ${item.progress}%"></div>
          `;
          
          chip.querySelector('.eas-file-card-close').addEventListener('click', (e) => {
            e.stopPropagation();
            attachments = attachments.filter(a => a.id !== item.id);
            renderFiles();
          });

          if (isError) {
            const retryBtn = chip.querySelector('.eas-file-card-retry');
            if (retryBtn) {
              retryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                item.status = 'uploading';
                item.progress = 0;
                renderFiles();
                simulateUpload(item);
              });
            }
          }
          
          filesWrap.appendChild(chip);
        });
        updateWelcomeSendBtn();
      };

      const simulateUpload = (item) => {
        let p = 0;
        const interval = setInterval(() => {
          p += Math.random() * 20 + 10;
          if (p >= 100) {
            p = 100;
            clearInterval(interval);
            // 模拟 20% 的失败率
            item.status = Math.random() < 0.2 ? 'error' : 'success';
          }
          item.progress = p;
          
          const pBar = filesWrap.querySelector(`#prog-${item.id}`);
          if (pBar) {
            pBar.style.width = `${p}%`;
          }
          
          if (item.status === 'success') {
            const card = filesWrap.querySelector(`#card-${item.id}`);
            if (card) {
              card.classList.remove('error');
              card.classList.add('success');
            }
          } else if (item.status === 'error') {
            renderFiles(); // 重新渲染以显示失败状态和重试按钮
          }
        }, 200);
      };

      const addFiles = (list) => {
        const newItems = list.map(f => ({
          file: f,
          id: Math.random().toString(36).substring(2, 9),
          progress: 0,
          status: 'uploading'
        }));
        attachments.push(...newItems);
        renderFiles();
        
        newItems.forEach(item => simulateUpload(item));
      };

      const autoSize = () => {
        if (!inputEl) return;
        inputEl.style.height = 'auto';
        const next = Math.max(44, Math.min(inputEl.scrollHeight || 44, 180));
        inputEl.style.height = `${next}px`;
      };

      const send = () => {
        const v = String(inputEl.value || '').trim();
        const hasValidAttachments = attachments.some(a => a.status === 'success');
        if (!v && !hasValidAttachments) return;
        
        const auto = !!(autoEl && autoEl.checked);
        const lang = langEl ? String(langEl.value || 'auto') : 'auto';
        inputEl.value = '';
        autoSize();
        const prefix = [];
        const successAttachments = attachments.filter(a => a.status === 'success');
        if (successAttachments.length) prefix.push(`【已添加文件：${successAttachments.map(item => item.file.name).join('、')}】`);
        if (lang !== 'auto') prefix.push(`【语言：${lang}】`);
        if (!auto) prefix.push(`【自动识别：关闭】`);
        
        attachments = []; // Clear attachments after sending
        renderFiles();
        
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
            addFiles(list);
            fileInput.value = '';
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
            addFiles(list);
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
      const sourceRefs = this._getReplySources(reply);
      const sourceDocGroups = this._groupSourceRefsByDocument(sourceRefs);
      const content = document.createElement('div');
      content.className = 'eas-ai-content';
      content.textContent = reply.content;
      wrap.appendChild(content);

      // 1. 底部工具栏 (包含操作按钮和参考来源)
      const footerModule = document.createElement('div');
      footerModule.className = 'eas-ai-footer-module';
      footerModule.innerHTML = `
        <div class="eas-ai-actions-left">
          <button class="eas-action-icon-btn btn-copy" title="复制" aria-label="复制" onclick="event.preventDefault()"><i class="fa-solid fa-copy"></i></button>
          <button class="eas-action-icon-btn btn-regen" title="重新生成" aria-label="重新生成" onclick="event.preventDefault()"><i class="fa-solid fa-rotate-right"></i></button>
          <button class="eas-action-icon-btn btn-like" title="点赞" aria-label="点赞" onclick="event.preventDefault()"><i class="fa-solid fa-thumbs-up"></i></button>
          <button class="eas-action-icon-btn btn-dislike" title="点踩" aria-label="点踩" onclick="event.preventDefault()"><i class="fa-solid fa-thumbs-down"></i></button>
          ${sourceDocGroups.length ? `<a href="#" class="eas-ref-simple-link btn-ref" aria-label="引用来源" onclick="event.preventDefault()" style="margin-left: 4px;"><i class="fa-solid fa-book-open"></i><span>引用来源(${sourceDocGroups.length})</span></a>` : ''}
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
      if (btnRef) {
        btnRef.onclick = (e) => {
          e.preventDefault();
          this._showReferenceInline(wrap, suggestModule, sourceRefs);
        };
      }

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

      if (sourceRefs.length) {
        this._showReferenceInline(wrap, suggestModule, sourceRefs);
      }
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

  _getSourceRefUtils() {
    const fallback = {
      SUMMARY_LIMIT: 50,
      escapeHtml(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      getSourceSummary(content, limit = 50) {
        const max = Number.isFinite(Number(limit)) ? Number(limit) : 50;
        const text = String(content == null ? '' : content).replace(/\s+/g, ' ').trim();
        return text.length > max ? text.slice(0, max) + '\u2026' : text;
      },
      normalizeSourceRange(value) {
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
      normalizeSourceReference(source) {
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
      },
      fileIconClass(documentName) {
        const ext = String(documentName || '').split('.').pop().toLowerCase();
        if (ext === 'pdf') return 'fa-file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'fa-file-image';
        return 'fa-file-lines';
      }
    };
    return window.SourceReferenceUtils || fallback;
  }

  _getDemoSourceReferences() {
    return [
      {
        document_id: 'DOC-EXPENSE-001',
        document_name: '员工报销制度.pdf',
        chunk_id: 'chunk-expense-001',
        chunk_content: '差旅报销需在出差结束后 7 个工作日内提交报销申请，逾期需补充说明并由直属负责人确认后再进入财务审核。',
        source_range: [1024, 1156]
      },
      {
        document_id: 'DOC-EXPENSE-001',
        document_name: '员工报销制度.pdf',
        chunk_id: 'chunk-expense-002',
        chunk_content: '住宿费、交通费和市内通勤费用需分别上传有效票据，系统会按费用类型进入对应的审批节点。',
        source_range: [2048, 2160]
      },
      {
        document_id: 'DOC-ATTENDANCE-2026',
        document_name: '员工考勤与加班管理办法.docx',
        chunk_id: 'chunk-overtime-003',
        chunk_content: '工作日加班原则上优先安排调休，确需折算加班费时应以审批通过的加班申请和考勤记录作为依据。',
        source_range: [512, 638]
      }
    ];
  }

  _getReplySources(reply) {
    const data = reply && typeof reply === 'object' ? reply : {};
    const raw = [
      data.sources,
      data.citations,
      data.references,
      data.sourceReferences,
      data.referenceSources,
      data.citation_sources,
      data.reference_sources
    ].find(Array.isArray) || [];
    const utils = this._getSourceRefUtils();
    return raw
      .map(item => ({
        ...(item && typeof item === 'object' ? item : {}),
        ...utils.normalizeSourceReference(item)
      }))
      .filter(ref => ref.document_id && (ref.chunk_id || ref.source_range || ref.chunk_content));
  }

  _groupSourceRefsByDocument(sources) {
    const utils = this._getSourceRefUtils();
    const groups = [];
    const indexByDoc = new Map();
    (Array.isArray(sources) ? sources : []).forEach(source => {
      const ref = {
        ...(source && typeof source === 'object' ? source : {}),
        ...utils.normalizeSourceReference(source)
      };
      if (!ref.document_id) return;
      const key = ref.document_id;
      if (!indexByDoc.has(key)) {
        indexByDoc.set(key, groups.length);
        groups.push({
          document_id: ref.document_id,
          document_name: ref.document_name || ref.document_id,
          primary: ref,
          sources: []
        });
      }
      const group = groups[indexByDoc.get(key)];
      group.sources.push(ref);
      if (!group.document_name && ref.document_name) group.document_name = ref.document_name;
    });
    return groups;
  }

  _openSourceReference(source, allSources = []) {
    const utils = this._getSourceRefUtils();
    const ref = {
      ...(source && typeof source === 'object' ? source : {}),
      ...utils.normalizeSourceReference(source)
    };
    if (!ref.document_id) return;

    if (typeof window.openKnowledgeSourcePreview === 'function') {
      window.openKnowledgeSourcePreview(ref, allSources);
      return;
    }

    if (typeof window.openKnowledgeSource === 'function') {
      window.openKnowledgeSource(ref);
      return;
    }

    const params = new URLSearchParams();
    params.set('id', ref.document_id);
    params.set('document_id', ref.document_id);
    if (ref.document_name) params.set('document_name', ref.document_name);
    if (ref.chunk_id) params.set('chunk_id', ref.chunk_id);
    if (ref.chunk_content) params.set('chunk_content', ref.chunk_content);
    if (ref.source_range) params.set('source_range', JSON.stringify(ref.source_range));
    const base = window.location.pathname.includes('/views/') ? 'knowledge-detail.html' : 'views/knowledge-detail.html';
    window.open(`${base}?${params.toString()}`, '_blank');
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
    const sourceDocCount = this._groupSourceRefsByDocument(this._getReplySources(reply)).length;
    if (sourceDocCount) return `已完成思考，引用来源(${sourceDocCount})`;
    const refCount = Number.isFinite(reply.refCount) ? reply.refCount : 0;
    return refCount ? `已完成思考，参考 ${refCount} 篇资料` : '已完成思考';
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
      refCount: this._activeAgentHasKnowledge() ? 3 : 0,
      sources: this._activeAgentHasKnowledge() ? this._getDemoSourceReferences() : [],
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

  _showReferenceInline(container, referenceNode, sources) {
    // 如果已经存在则不再重复添加，或者你可以实现 toggle
    if (container.querySelector('.eas-ref-inline-box')) {
      container.querySelector('.eas-ref-inline-box').remove();
      return;
    }
    const sourceRefs = Array.isArray(sources) ? sources : [];
    const sourceDocGroups = this._groupSourceRefsByDocument(sourceRefs);
    if (!sourceDocGroups.length) return;
    const utils = this._getSourceRefUtils();

    const box = document.createElement('div');
    box.className = 'eas-ref-inline-box';
    box.style.cssText = `
      margin-top: 4px;
      margin-bottom: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      position: relative;
    `;

    box.innerHTML = `
      <div style="font-size: 13px; font-weight: 650; color: #334155; margin-bottom: 8px;">引用来源(${sourceDocGroups.length})</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${sourceDocGroups.map((group, index) => {
          const docName = group.document_name || group.document_id || '未命名文档';
          return `
            <button type="button" class="eas-ref-item" data-source-index="${index}" style="width: 100%; border: 1px solid #dbeafe; background: #fff; color: #2563eb; font-size: 13px; text-decoration: none; display: flex; align-items: flex-start; gap: 8px; text-align: left; border-radius: 8px; padding: 8px 10px; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;">
              <i class="fa-solid ${utils.fileIconClass(docName)}" style="color: #60a5fa; margin-top: 2px;"></i>
              <span style="min-width: 0; flex: 1; line-height: 18px;">
                <span style="font-weight: 650; color: #1d4ed8;">${index + 1}. 《${utils.escapeHtml(docName)}》</span>
              </span>
              <i class="fa-solid fa-arrow-up-right-from-square" style="color: #94a3b8; font-size: 11px; margin-top: 3px;"></i>
            </button>
          `;
        }).join('')}
      </div>
    `;

    box.querySelectorAll('.eas-ref-item').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#eff6ff';
        btn.style.borderColor = '#bfdbfe';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#fff';
        btn.style.borderColor = '#dbeafe';
      });
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.sourceIndex);
        const group = sourceDocGroups[index];
        this._openSourceReference(group && group.primary, sourceRefs);
      });
    });

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
