/**
 * Shared data table: colgroup widths, column drag-resize, sticky last column, refresh after tbody redraw.
 */
(function () {
    var MIN_COL = 56;
    var tables = new WeakMap();

    window.escapeHtml = function (s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /** Plain-text ellipsis cell + native tooltip. */
    window.setCellEllipsis = function (el, fullText) {
        if (!el) return;
        el.classList.add('dt-cell-ellipsis');
        var t = fullText == null ? '' : String(fullText);
        el.textContent = t;
        el.setAttribute('title', t);
    };

    function getHeaderCells(table) {
        var thead = table.querySelector('thead tr');
        if (!thead) return [];
        return Array.prototype.slice.call(thead.querySelectorAll('th'));
    }

    function ensureColgroup(table, colCount) {
        var colgroup = table.querySelector('colgroup');
        var cols;
        if (!colgroup) {
            colgroup = document.createElement('colgroup');
            table.insertBefore(colgroup, table.firstChild);
        }
        cols = colgroup.querySelectorAll('col');
        while (cols.length < colCount) {
            colgroup.appendChild(document.createElement('col'));
            cols = colgroup.querySelectorAll('col');
        }
        while (colgroup.querySelectorAll('col').length > colCount) {
            colgroup.removeChild(colgroup.lastElementChild);
        }
        return colgroup.querySelectorAll('col');
    }

    function loadStoredWidths(storageKey, n) {
        if (!storageKey) return null;
        try {
            var raw = localStorage.getItem(storageKey);
            if (!raw) return null;
            var arr = JSON.parse(raw);
            if (!Array.isArray(arr) || arr.length !== n) return null;
            return arr.map(function (x) {
                var w = parseInt(x, 10);
                return isNaN(w) ? MIN_COL : Math.max(MIN_COL, w);
            });
        } catch (e) {
            return null;
        }
    }

    function saveStoredWidths(storageKey, widths) {
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(widths));
        } catch (e) { /* ignore */ }
    }

    function applyWidths(cols, widths) {
        for (var i = 0; i < cols.length; i++) {
            cols[i].style.width = widths[i] + 'px';
        }
    }

    function defaultWidths(n, table) {
        var total = table.parentElement ? table.parentElement.clientWidth : 960;
        if (!total || total < 400) total = 960;
        var base = Math.max(MIN_COL, Math.floor((total - 120) / Math.max(1, n - 1)));
        var w = [];
        for (var i = 0; i < n; i++) {
            if (i === n - 1) w.push(Math.max(MIN_COL, 140));
            else w.push(base);
        }
        return w;
    }

    function resolveStickyIndex(n, options) {
        if (typeof options.stickyColumnIndex === 'number') {
            return Math.max(0, Math.min(n - 1, options.stickyColumnIndex));
        }
        if (options.stickyLast === false) return -1;
        return n - 1;
    }

    function applyStickyClasses(table, stickyIdx) {
        var ths = getHeaderCells(table);
        ths.forEach(function (th, i) {
            th.classList.toggle('dt-th-sticky-end', i === stickyIdx);
        });
        var rows = table.querySelectorAll('tbody tr');
        rows.forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length === 1 && tds[0].getAttribute('colspan')) return;
            tds.forEach(function (td, i) {
                td.classList.toggle('dt-td-sticky-end', i === stickyIdx);
            });
        });
    }

    function installResizers(table, state) {
        var ths = getHeaderCells(table);
        ths.forEach(function (th, i) {
            var existing = th.querySelector('.dt-col-resizer');
            if (existing) existing.remove();
            var handle = document.createElement('span');
            handle.className = 'dt-col-resizer';
            handle.setAttribute('data-col', String(i));
            handle.setAttribute('aria-hidden', 'true');
            th.appendChild(handle);
        });
    }

    function bindResizeOnce(table, state) {
        if (state.resizeBound) return;
        state.resizeBound = true;
        var thead = table.querySelector('thead');
        if (!thead) return;

        thead.addEventListener('pointerdown', function (e) {
            var h = e.target.closest('.dt-col-resizer');
            if (!h || !table.contains(h)) return;
            e.preventDefault();
            var colIndex = parseInt(h.getAttribute('data-col'), 10);
            if (isNaN(colIndex)) return;
            var cols = table.querySelectorAll('colgroup col');
            if (!cols[colIndex]) return;
            var startX = e.clientX;
            var startW = cols[colIndex].getBoundingClientRect().width;

            function onMove(ev) {
                var dw = ev.clientX - startX;
                var nw = Math.max(state.minColWidth, Math.floor(startW + dw));
                cols[colIndex].style.width = nw + 'px';
                var widths = [];
                for (var i = 0; i < cols.length; i++) {
                    widths.push(Math.max(state.minColWidth, Math.floor(cols[i].getBoundingClientRect().width)));
                }
                applyWidths(cols, widths);
                state.lastWidths = widths;
                saveStoredWidths(state.storageKey, widths);
            }
            function onUp() {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    }

    /**
     * @param {HTMLTableElement|string} tableOrSelector
     * @param {object} [options]
     * @param {boolean} [options.stickyLast=true]
     * @param {number} [options.stickyColumnIndex] 0-based; overrides sticky last when set with stickyLast false — use stickyColumnIndex alone: if set, use as sticky index; if stickyLast true and not set, use last column.
     * @param {string} [options.storageKey] localStorage key for column widths
     * @param {number} [options.minColWidth=56]
     */
    window.initDataTable = function (tableOrSelector, options) {
        options = options || {};
        var table = tableOrSelector;
        if (typeof table === 'string') table = document.querySelector(tableOrSelector);
        if (!table || table.tagName !== 'TABLE') return;

        var ths = getHeaderCells(table);
        var n = ths.length;
        if (!n) return;

        var minColWidth = options.minColWidth != null ? options.minColWidth : MIN_COL;
        var storageKey = options.storageKey || null;
        var stickyIdx = resolveStickyIndex(n, options);

        if (table.getAttribute('data-dt-init') === '1') {
            var prev = tables.get(table);
            var cols0 = table.querySelectorAll('colgroup col');
            var w0 = [];
            for (var j = 0; j < cols0.length; j++) {
                w0.push(Math.max(minColWidth, Math.floor(cols0[j].getBoundingClientRect().width)));
            }
            if (prev) {
                prev.lastWidths = w0.length ? w0 : prev.lastWidths;
                prev.stickyIdx = stickyIdx;
                prev.minColWidth = minColWidth;
                if (storageKey) prev.storageKey = storageKey;
            }
            applyStickyClasses(table, stickyIdx);
            installResizers(table, prev || {});
            return;
        }

        var cols = ensureColgroup(table, n);
        var stored = loadStoredWidths(storageKey, n);
        var widths = stored || defaultWidths(n, table);
        if (!stored) {
            applyWidths(cols, widths);
            saveStoredWidths(storageKey, widths);
        } else {
            applyWidths(cols, widths);
        }

        var state = tables.get(table) || {};
        state.minColWidth = minColWidth;
        state.storageKey = storageKey;
        state.stickyIdx = stickyIdx;
        state.lastWidths = widths;
        tables.set(table, state);

        table.classList.add('dt-table');
        installResizers(table, state);
        bindResizeOnce(table, state);
        applyStickyClasses(table, stickyIdx);
        table.setAttribute('data-dt-init', '1');
    };

    /**
     * Call after list render (or use requestAnimationFrame from renderers).
     * @param {string|HTMLTableElement} tableIdOrEl
     * @param {object} [options] passed to initDataTable on first run only
     */
    window.syncDataTable = function (tableIdOrEl, options) {
        requestAnimationFrame(function () {
            var t = tableIdOrEl;
            if (typeof t === 'string') t = document.getElementById(tableIdOrEl);
            if (!t || t.tagName !== 'TABLE') return;
            if (t.getAttribute('data-dt-init') === '1') {
                window.refreshDataTable(t);
            } else {
                window.initDataTable(t, options || {});
            }
        });
    };

    window.refreshDataTable = function (tableOrSelector) {
        var table = tableOrSelector;
        if (typeof table === 'string') table = document.querySelector(tableOrSelector);
        if (!table || table.tagName !== 'TABLE') return;
        var state = tables.get(table);
        if (!state) {
            window.initDataTable(table, {});
            return;
        }
        var ths = getHeaderCells(table);
        var n = ths.length;
        if (!n) return;
        var cols = ensureColgroup(table, n);
        if (state.lastWidths && state.lastWidths.length === n) {
            applyWidths(cols, state.lastWidths);
        }
        installResizers(table, state);
        applyStickyClasses(table, state.stickyIdx);
    };

})();
