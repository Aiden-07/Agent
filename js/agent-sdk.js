/**
 * Agent SDK - Frontend Integration Library
 * Version: 1.0.0 (Developer Preview)
 */

class AgentSDK {
    constructor(config = {}) {
        // Load position from local storage if available
        const savedPos = localStorage.getItem(`agent_sdk_pos_${config.agentId || 'default'}`);
        let initialPos = config.position || { bottom: '35px', right: '20px' };
        
        if (savedPos) {
            try {
                initialPos = JSON.parse(savedPos);
            } catch (e) { console.error('Failed to parse saved position', e); }
        } else {
            // Requirement: Move up 10-15px. Default was bottom: 20px.
            // Let's set default bottom to 35px if not provided.
            if (!config.position) {
                initialPos = { bottom: '35px', right: '20px' };
            }
        }

        this.config = {
            agentId: config.agentId || 'default-agent',
            name: config.name || '智能助手',
            avatar: config.avatar || 'fa-solid fa-robot',
            welcomeMsg: config.welcomeMsg || '你好！有什么可以帮你的吗？',
            primaryColor: config.primaryColor || '#2563EB', // blue-600
            position: initialPos,
            zIndex: config.zIndex || 9999
        };

        this.state = {
            isOpen: false,
            isDragging: false,
            hasInteracted: false,
            messages: [],
            dockSide: null // 'left', 'right', 'top', 'bottom' or null
        };

        // Removed localStorage persistence for widget closed state so it reappears on refresh
        // const isClosed = localStorage.getItem(`agent_sdk_closed_${this.config.agentId}`);
        // if (isClosed === 'true') { return; }

        this.init();
    }

    init() {
        this.injectStyles();
        this.createWidget();
        this.createChatWindow();
        this.bindEvents();
        
        // Add welcome message
        this.addMessage({ role: 'ai', text: this.config.welcomeMsg });
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .agent-sdk-widget {
                position: fixed;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background-color: ${this.config.primaryColor};
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                z-index: ${this.config.zIndex};
                transition: transform 0.3s ease, opacity 0.3s, right 0.3s ease, bottom 0.3s ease, left 0.3s ease, top 0.3s ease;
                user-select: none;
            }
            .agent-sdk-widget:hover {
                transform: scale(1.05);
            }
            .agent-sdk-widget:active {
                transform: scale(0.95);
            }
            .agent-sdk-widget.dragging {
                opacity: 0.8;
                transition: none;
            }
            .agent-sdk-widget.docked {
                opacity: 0.6;
            }
            .agent-sdk-widget.docked:hover {
                opacity: 1;
                transform: scale(1.05);
            }
            .agent-sdk-close-btn {
                position: absolute;
                top: -5px;
                right: -5px;
                width: 18px;
                height: 18px;
                background-color: #EF4444;
                color: white;
                border-radius: 50%;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .agent-sdk-widget:hover .agent-sdk-close-btn {
                opacity: 1;
            }
            
            .agent-sdk-chat-window {
                position: fixed;
                bottom: 95px; /* Offset based on new widget pos + margin */
                right: 20px;
                width: 400px;
                height: 500px;
                background-color: white;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                display: flex;
                flex-direction: column;
                z-index: ${this.config.zIndex};
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
                overflow: hidden;
                border: 1px solid #E5E7EB;
            }
            .agent-sdk-chat-window.open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .agent-sdk-chat-window {
                    width: 90%;
                    right: 5%;
                    bottom: 90px;
                    height: 60vh;
                }
            }
            
            /* Chat Styles */
            .agent-msg-container {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background-color: #F9FAFB;
            }
            .agent-msg {
                max-width: 80%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.5;
                word-wrap: break-word;
            }
            .agent-msg-ai {
                background-color: white;
                border: 1px solid #E5E7EB;
                border-top-left-radius: 2px;
                align-self: flex-start;
                color: #1F2937;
            }
            .agent-msg-user {
                background-color: ${this.config.primaryColor};
                color: white;
                border-top-right-radius: 2px;
                align-self: flex-end;
            }
            .agent-input-area {
                padding: 12px;
                background-color: white;
                border-top: 1px solid #E5E7EB;
                display: flex;
                gap: 8px;
            }
            .agent-input {
                flex: 1;
                border: 1px solid #E5E7EB;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }
            .agent-input:focus {
                border-color: ${this.config.primaryColor};
            }
            .agent-send-btn {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background-color: ${this.config.primaryColor};
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border: none;
                transition: opacity 0.2s;
            }
            .agent-send-btn:hover {
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }

    createWidget() {
        this.widget = document.createElement('div');
        this.widget.className = 'agent-sdk-widget';
        
        // Apply initial position
        if (this.config.position.bottom) this.widget.style.bottom = this.config.position.bottom;
        if (this.config.position.right) this.widget.style.right = this.config.position.right;
        if (this.config.position.left) this.widget.style.left = this.config.position.left;
        if (this.config.position.top) this.widget.style.top = this.config.position.top;
        
        this.widget.innerHTML = `
            <i class="${this.config.avatar}"></i>
            <div class="agent-sdk-close-btn" title="关闭助手">
                <i class="fa-solid fa-times"></i>
            </div>
        `;

        document.body.appendChild(this.widget);

        // Bind Dragging
        this.bindDrag();

        // Bind Close
        this.widget.querySelector('.agent-sdk-close-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening chat
            this.close();
        });

        // Bind Click to Open/Undock
        this.widget.addEventListener('click', () => {
            if (this.state.isDragging) return;

            if (this.state.dockSide) {
                this.undock();
            } else {
                this.toggleChat();
            }
        });
    }

    createChatWindow() {
        this.chatWindow = document.createElement('div');
        this.chatWindow.className = 'agent-sdk-chat-window';
        
        this.chatWindow.innerHTML = `
            <!-- Header -->
            <div style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; background: white;">
                <div style="display: flex; items-center; gap: 8px; font-weight: 500; color: #111827;">
                    <div style="width: 8px; height: 8px; background: #10B981; border-radius: 50%;"></div>
                    ${this.config.name}
                </div>
                <div style="display: flex; gap: 12px; color: #6B7280;">
                    <button id="agent-minimize-btn" style="cursor: pointer; hover: text-gray-900;"><i class="fa-solid fa-minus"></i></button>
                </div>
            </div>
            
            <!-- Messages -->
            <div class="agent-msg-container" id="agent-msg-container"></div>
            
            <!-- Input -->
            <div class="agent-input-area">
                <input type="text" class="agent-input" placeholder="输入消息..." id="agent-input">
                <button class="agent-send-btn" id="agent-send-btn">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        `;

        document.body.appendChild(this.chatWindow);

        // Bind Events
        this.chatWindow.querySelector('#agent-minimize-btn').addEventListener('click', () => this.toggleChat(false));
        
        const input = this.chatWindow.querySelector('#agent-input');
        const sendBtn = this.chatWindow.querySelector('#agent-send-btn');

        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.addMessage({ role: 'user', text });
                input.value = '';
                this.simulateResponse(text);
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    bindDrag() {
        let isDragging = false;
        let startX, startY;
        let initialRight, initialBottom; // Assuming we use right/bottom for positioning logic primarily
        // Note: mixed left/right usage can be tricky. We should normalize to one system or handle both.
        // For simplicity, let's convert everything to right/bottom during drag start.

        const handleStart = (e) => {
            if (e.target.closest('.agent-sdk-close-btn')) return;

            isDragging = true;
            this.widget.classList.add('dragging');
            this.widget.classList.remove('docked'); // Temporarily undock while dragging
            
            // Normalize position to computed pixels
            const rect = this.widget.getBoundingClientRect();
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            
            // Clear all positioning styles and set calculated right/bottom
            // This ensures we have a consistent coordinate system for dragging
            const computedRight = winWidth - rect.right;
            const computedBottom = winHeight - rect.bottom;
            
            this.widget.style.left = 'auto';
            this.widget.style.top = 'auto';
            this.widget.style.right = `${computedRight}px`;
            this.widget.style.bottom = `${computedBottom}px`;

            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            startX = clientX;
            startY = clientY;
            
            initialRight = computedRight;
            initialBottom = computedBottom;
            
            e.preventDefault();
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            const deltaX = startX - clientX; 
            const deltaY = startY - clientY;
            
            this.widget.style.right = `${initialRight + deltaX}px`;
            this.widget.style.bottom = `${initialBottom + deltaY}px`;
            
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                this.state.isDragging = true;
            }
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            this.widget.classList.remove('dragging');
            
            const rect = this.widget.getBoundingClientRect();
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            
            const currentRight = parseFloat(this.widget.style.right);
            const currentBottom = parseFloat(this.widget.style.bottom);
            const currentLeft = winWidth - currentRight - rect.width;
            const currentTop = winHeight - currentBottom - rect.height;
            
            const SNAP_THRESHOLD = 20; // Changed from 50 to 20 per requirement
            const MARGIN = 35; // Standard margin when NOT docked (e.g. bottom 35px)
            const DOCK_OFFSET = -25; // Hide 50% (width 50px / 2 = 25px)
            
            this.state.dockSide = null;

            // Determine snapping
            // Priority: Right/Left > Bottom/Top for sides usually, but requirement says "Support 4 sides"
            
            if (currentRight < SNAP_THRESHOLD) {
                // Dock Right
                this.widget.style.right = `${DOCK_OFFSET}px`;
                this.state.dockSide = 'right';
            } else if (currentLeft < SNAP_THRESHOLD) {
                // Dock Left
                this.widget.style.right = 'auto'; // Clear right
                this.widget.style.left = `${DOCK_OFFSET}px`;
                this.state.dockSide = 'left';
            } else if (currentBottom < SNAP_THRESHOLD) {
                // Dock Bottom
                this.widget.style.bottom = `${DOCK_OFFSET}px`;
                this.state.dockSide = 'bottom';
            } else if (currentTop < SNAP_THRESHOLD) {
                // Dock Top
                this.widget.style.bottom = 'auto'; // Clear bottom
                this.widget.style.top = `${DOCK_OFFSET}px`;
                this.state.dockSide = 'top';
            } else {
                // No snap - just bounds checking to keep on screen
                // Ensure at least 5px margin from edges if not docked
                if (currentRight < 5) this.widget.style.right = '5px';
                if (currentLeft < 5) { this.widget.style.right = 'auto'; this.widget.style.left = '5px'; }
                if (currentBottom < 5) this.widget.style.bottom = '5px';
                if (currentTop < 5) { this.widget.style.bottom = 'auto'; this.widget.style.top = '5px'; }
            }

            if (this.state.dockSide) {
                this.widget.classList.add('docked');
            } else {
                this.widget.classList.remove('docked');
            }

            // Save Position
            this.savePosition();

            setTimeout(() => {
                this.state.isDragging = false;
            }, 50);
        };

        this.widget.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);

        this.widget.addEventListener('touchstart', handleStart);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
    }

    savePosition() {
        const style = this.widget.style;
        const pos = {};
        if (style.bottom && style.bottom !== 'auto') pos.bottom = style.bottom;
        if (style.right && style.right !== 'auto') pos.right = style.right;
        if (style.left && style.left !== 'auto') pos.left = style.left;
        if (style.top && style.top !== 'auto') pos.top = style.top;
        
        localStorage.setItem(`agent_sdk_pos_${this.config.agentId}`, JSON.stringify(pos));
    }

    undock() {
        if (!this.state.dockSide) return;
        
        const MARGIN = 20; // When undocking, push it out a bit so it's fully visible
        
        if (this.state.dockSide === 'right') {
            this.widget.style.right = `${MARGIN}px`;
        } else if (this.state.dockSide === 'left') {
            this.widget.style.left = `${MARGIN}px`;
        } else if (this.state.dockSide === 'bottom') {
            this.widget.style.bottom = `${MARGIN}px`;
        } else if (this.state.dockSide === 'top') {
            this.widget.style.top = `${MARGIN}px`;
        }
        
        this.state.dockSide = null;
        this.widget.classList.remove('docked');
        this.savePosition();
    }

    close() {
        this.widget.style.display = 'none';
        this.chatWindow.classList.remove('open');
        // Removed localStorage persistence so widget reappears on refresh
    }

    show() {
        this.widget.style.display = 'flex';
        if (!this.widget.parentElement) {
            this.init();
        }
    }

    bindEvents() {
        // ... (Already handled in create methods or separate binders)
    }

    toggleChat(forceState = null) {
        const isOpen = forceState !== null ? forceState : !this.state.isOpen;
        this.state.isOpen = isOpen;
        
        if (isOpen) {
            this.chatWindow.classList.add('open');
        } else {
            this.chatWindow.classList.remove('open');
        }
    }

    addMessage(msg) {
        this.state.messages.push(msg);
        const container = this.chatWindow.querySelector('#agent-msg-container');
        const div = document.createElement('div');
        div.className = `agent-msg agent-msg-${msg.role}`;
        div.textContent = msg.text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    simulateResponse(userText) {
        const container = this.chatWindow.querySelector('#agent-msg-container');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'agent-msg agent-msg-ai';
        typingDiv.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 思考中...';
        typingDiv.id = 'agent-typing';
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);
            
            let responseText = `我收到了你的消息："${userText}"。这是一个模拟回复。`;
            if (userText.includes('你好')) responseText = '你好！我是你的智能业务助手。';
            if (userText.includes('订单')) responseText = '查询到您今日有 3 笔新订单，其中 1 笔待付款。';
            if (userText.includes('销售')) responseText = '今日销售额为 ¥ 124,592，较昨日增长 12.5%。';
            
            this.addMessage({ role: 'ai', text: responseText });
        }, 1000);
    }
}

// Expose to window
window.AgentSDK = AgentSDK;