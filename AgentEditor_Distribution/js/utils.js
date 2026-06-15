// Global Utilities

// Sidebar Toggle Logic
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;
    
    sidebar.classList.toggle('sidebar-collapsed');
    
    // Save state
    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (!sidebar || !overlay) return;
    
    const isClosed = sidebar.classList.contains('-translate-x-full');
    
    if (isClosed) {
        // Open
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        // Small delay to allow display block to apply before animating opacity
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
        });
    } else {
        // Close
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300); // match transition duration
    }
}

// Initialize Sidebar State
function initSidebarState() {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;
    
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
    }
}

// Call init on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    initSidebarState();
});

// Toggle Submenu (if needed for other menus, though currently flat)
function toggleSubmenu(id) {
    const submenu = document.getElementById(id);
    const arrow = document.getElementById(id + '-arrow');
    
    if (submenu && arrow) {
        if (submenu.classList.contains('hidden')) {
            submenu.classList.remove('hidden');
            arrow.classList.add('rotate-180');
        } else {
            submenu.classList.add('hidden');
            arrow.classList.remove('rotate-180');
        }
    }
}

// Modal Logic
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.warn(`Modal with ID ${modalId} not found.`);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Helper to generate irregular ID
function generateId(prefix = 'ID') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous chars
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${result}`;
}

window.generateId = generateId;

// Close modal on outside click
window.onclick = function(event) {
    // Only close if it's a modal overlay (identified by fixed positioning AND has an ID ending in 'modal' or similar convention)
    // Better yet, check if it's visible and is a modal
    if (event.target.classList.contains('fixed') && 
        (event.target.id.includes('modal') || event.target.classList.contains('modal-overlay'))) {
        event.target.classList.add('hidden');
    }
}

// Toast Notification
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-y-[-100%] opacity-0 z-50 flex items-center gap-3 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    
    // Icon based on type
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    
    toast.innerHTML = `
        ${icon}
        <span class="font-medium text-sm">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-100%]', 'opacity-0');
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-[-100%]', 'opacity-0');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

window.showToast = showToast;

// --- Context Menu / Action Menu Logic ---

let currentActionMenu = null;

window.showActionMenu = function(event, items) {
    event.stopPropagation();
    
    // Remove existing menu if any
    if (currentActionMenu) {
        currentActionMenu.remove();
        currentActionMenu = null;
    }
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Create Menu
    const menu = document.createElement('div');
    menu.className = 'fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-100 py-1 w-36 animate-fade-in-up transform origin-top-right';
    
    items.forEach(item => {
        const btn = document.createElement('button');
        // Mobile-friendly: larger touch target (py-3)
        btn.className = `w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors ${item.className || 'text-gray-700 hover:bg-gray-50'}`;
        btn.innerHTML = `
            <i class="${item.icon} w-5 text-center ${item.iconClass || 'text-gray-400'}"></i>
            <span>${item.label}</span>
        `;
        btn.onclick = (e) => {
            e.stopPropagation();
            closeActionMenu();
            item.onClick();
        };
        menu.appendChild(btn);
    });
    
    document.body.appendChild(menu);
    currentActionMenu = menu;
    
    // Positioning
    const menuWidth = 144; // w-36
    const menuHeight = menu.offsetHeight;
    
    // Default: Align top-right of menu to bottom-right of button
    let left = rect.right - menuWidth;
    let top = rect.bottom + 4;
    let transformOrigin = 'origin-top-right';
    
    // Horizontal adjustment (Mobile safety)
    if (left < 4) {
        left = 4; // Pin to left edge if overflow left
        transformOrigin = transformOrigin.replace('right', 'left');
    } else if (left + menuWidth > window.innerWidth - 4) {
        left = window.innerWidth - menuWidth - 4; // Pin to right edge if overflow right
    }

    // Vertical adjustment
    if (top + menuHeight > window.innerHeight - 4) {
        // Not enough space below, flip to top
        top = rect.top - menuHeight - 4;
        transformOrigin = transformOrigin.replace('top', 'bottom');
        
        // If animation was fade-in-up (which moves up), when flipping to top, 
        // we might want fade-in-down (moves down) or just rely on origin.
        // Actually fade-in-up moves from lower to upper position. 
        // If we are above, we want it to appear from bottom (button).
        // Let's just update origin, CSS animation usually just scales/fades.
        // But if using `animate-fade-in-up`, it translates Y.
        menu.classList.remove('animate-fade-in-up');
        menu.classList.add('animate-fade-in-down'); // Assume we have this or similar
    }

    menu.classList.remove('origin-top-right');
    menu.classList.add(transformOrigin);
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    
    // Click outside to close
    requestAnimationFrame(() => {
        document.addEventListener('click', closeActionMenu);
    });
}

function closeActionMenu() {
    if (currentActionMenu) {
        currentActionMenu.remove();
        currentActionMenu = null;
    }
    document.removeEventListener('click', closeActionMenu);
}

window.closeActionMenu = closeActionMenu;

// --- Inline Action Group Logic ---
window.createInlineActions = function(actions) {
    const container = document.createElement('div');
    container.className = 'flex items-center justify-end gap-3';
    
    const visibleActions = actions.slice(0, 2);
    const hiddenActions = actions.slice(2);
    
    visibleActions.forEach(act => {
        const btn = document.createElement('button');
        btn.className = 'text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors ' + (act.className || '');
        btn.textContent = act.label;
        btn.onclick = (e) => { e.stopPropagation(); act.onClick(); };
        container.appendChild(btn);
    });
    
    if (hiddenActions.length > 0) {
        const moreWrapper = document.createElement('div');
        moreWrapper.className = 'relative inline-block text-left';
        
        const moreBtn = document.createElement('button');
        moreBtn.className = 'text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 transition-colors';
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.innerHTML = `
            <span class="more-text">更多 (+${hiddenActions.length})</span>
        `;
        
        const expandList = document.createElement('div');
        // Use absolute positioning by default. We will use fixed positioning dynamically if needed.
        expandList.className = 'absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 z-[9999]';
        expandList.style.maxHeight = '0px';
        expandList.style.opacity = '0';
        expandList.style.pointerEvents = 'none';
        
        const listInner = document.createElement('div');
        listInner.className = 'py-1 flex flex-col';
        
        hiddenActions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100 ' + (act.className || '');
            btn.textContent = act.label;
            btn.setAttribute('tabindex', '-1');
            btn.onclick = (e) => { e.stopPropagation(); toggle(); act.onClick(); };
            listInner.appendChild(btn);
        });
        
        expandList.appendChild(listInner);
        moreWrapper.appendChild(expandList);
        
        let expanded = false;
        
        const updatePosition = () => {
            if (!expanded) return;
            // On very small screens, to avoid being clipped by overflow-x-auto, we can use fixed positioning
            if (window.innerWidth <= 640) {
                expandList.style.position = 'fixed';
                const rect = moreBtn.getBoundingClientRect();
                expandList.style.top = rect.bottom + 'px';
                expandList.style.left = (rect.right - 128) + 'px';
                expandList.style.right = 'auto';
            } else {
                expandList.style.position = 'absolute';
                expandList.style.top = '100%';
                expandList.style.left = 'auto';
                expandList.style.right = '0';
            }
        };

        const toggle = () => {
            expanded = !expanded;
            moreBtn.setAttribute('aria-expanded', expanded.toString());
            const textSpan = moreBtn.querySelector('.more-text');
            
            if (expanded) {
                textSpan.textContent = '收起';
                updatePosition();
                expandList.style.maxHeight = listInner.scrollHeight + 'px';
                expandList.style.opacity = '1';
                expandList.style.pointerEvents = 'auto';
                
                const firstBtn = listInner.querySelector('button');
                if (firstBtn) {
                    setTimeout(() => firstBtn.focus(), 300); // Wait for animation
                }
                Array.from(listInner.querySelectorAll('button')).forEach(b => b.setAttribute('tabindex', '0'));
                window.addEventListener('resize', updatePosition);
                window.addEventListener('scroll', updatePosition, true);
            } else {
                textSpan.textContent = `更多 (+${hiddenActions.length})`;
                expandList.style.maxHeight = '0px';
                expandList.style.opacity = '0';
                expandList.style.pointerEvents = 'none';
                
                Array.from(listInner.querySelectorAll('button')).forEach(b => b.setAttribute('tabindex', '-1'));
                moreBtn.focus();
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            }
        };
        
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            toggle();
        };

        // Keyboard navigation
        listInner.addEventListener('keydown', (e) => {
            const buttons = Array.from(listInner.querySelectorAll('button'));
            const index = buttons.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = buttons[index + 1] || buttons[0];
                next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = buttons[index - 1] || buttons[buttons.length - 1];
                prev.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                toggle();
            }
        });
        
        moreWrapper.addEventListener('keydown', (e) => {
            if (!expanded && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
                if (document.activeElement === moreBtn) {
                    e.preventDefault();
                    toggle();
                }
            }
        });
        
        document.addEventListener('click', (e) => {
            if (expanded && !moreWrapper.contains(e.target)) {
                toggle();
            }
        });
        
        moreWrapper.appendChild(moreBtn);
        moreWrapper.appendChild(expandList);
        container.appendChild(moreWrapper);
    }
    
    return container;
};

// Formatting Utilities
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    if (!date) return '-';
    if (typeof date === 'string') date = new Date(date);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

window.formatSize = formatSize;
window.formatDate = formatDate;
