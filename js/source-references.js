(function () {
    const SUMMARY_LIMIT = 50;
    const PREVIEW_STYLE_ID = 'knowledge-source-preview-style';
    const PREVIEW_MODAL_ID = 'knowledge-source-preview-modal';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getSourceSummary(content, limit) {
        const max = Number.isFinite(Number(limit)) ? Number(limit) : SUMMARY_LIMIT;
        const text = String(content == null ? '' : content).replace(/\s+/g, ' ').trim();
        if (text.length <= max) return text;
        return text.slice(0, max) + '\u2026';
    }

    function normalizeSourceRange(value) {
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
        if (Array.isArray(range) && range.length >= 2) {
            const start = Number(range[0]);
            const end = Number(range[1]);
            if (Number.isFinite(start) && Number.isFinite(end)) {
                return [Math.max(0, start), Math.max(Math.max(0, start), end)];
            }
        }
        return null;
    }

    function normalizeSourceReference(source) {
        const input = source && typeof source === 'object' ? source : {};
        const documentId = input.document_id || input.documentId || input.docId || input.doc_id || input.id || '';
        const documentName = input.document_name || input.documentName || input.docName || input.doc_name || input.title || input.name || '';
        const chunkId = input.chunk_id || input.chunkId || input.slice_id || input.sliceId || input.block_id || input.blockId || '';
        const chunkContent = input.chunk_content || input.chunkContent || input.content || input.snippet || input.summary || '';
        const sourceRange = normalizeSourceRange(
            input.source_range || input.sourceRange || input.range ||
            (input.start_char != null || input.end_char != null ? [input.start_char, input.end_char] : null) ||
            (input.startChar != null || input.endChar != null ? [input.startChar, input.endChar] : null)
        );

        return {
            document_id: String(documentId),
            document_name: String(documentName),
            chunk_id: String(chunkId),
            chunk_content: String(chunkContent),
            source_range: sourceRange,
            kb_id: input.kb_id || input.kbId || input.knowledge_id || input.knowledgeId || ''
        };
    }

    function sourceRangeOverlaps(a, b) {
        const left = normalizeSourceRange(a);
        const right = normalizeSourceRange(b);
        if (!left || !right) return false;
        return left[0] < right[1] && right[0] < left[1];
    }

    function fileIconClass(documentName) {
        const ext = String(documentName || '').split('.').pop().toLowerCase();
        if (ext === 'pdf') return 'fa-file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel';
        if (['md', 'txt'].includes(ext)) return 'fa-file-lines';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'fa-file-image';
        return 'fa-file-lines';
    }

    function normalizePreviewSource(source) {
        const input = source && typeof source === 'object' ? source : {};
        const ref = normalizeSourceReference(input);
        return {
            ...ref,
            document_content: String(input.document_content || input.documentContent || input.full_content || input.fullContent || input.original_content || input.originalContent || ''),
            document_paragraphs: Array.isArray(input.document_paragraphs || input.documentParagraphs || input.paragraphs)
                ? (input.document_paragraphs || input.documentParagraphs || input.paragraphs)
                : null,
            deleted: !!(input.deleted || input.is_deleted || input.isDeleted || input.document_deleted || input.documentDeleted),
            load_failed: !!(input.load_failed || input.loadFailed || input.document_load_failed || input.documentLoadFailed),
            _raw: input
        };
    }

    function sameSourceReference(a, b) {
        if (!a || !b) return false;
        if (a.chunk_id && b.chunk_id && a.chunk_id === b.chunk_id) return true;
        if (a.source_range && b.source_range) {
            return a.source_range[0] === b.source_range[0] && a.source_range[1] === b.source_range[1];
        }
        return !!a.chunk_content && !!b.chunk_content && a.chunk_content === b.chunk_content;
    }

    function sameDocument(a, b) {
        return String(a && a.document_id || '') === String(b && b.document_id || '');
    }

    function sourceKey(ref) {
        return [
            ref.document_id,
            ref.chunk_id,
            ref.source_range ? ref.source_range.join(':') : '',
            ref.chunk_content
        ].join('|');
    }

    function buildHitCollection(source, sources) {
        const clicked = normalizePreviewSource(source);
        const all = (Array.isArray(sources) && sources.length ? sources : [source])
            .map(normalizePreviewSource)
            .filter(ref => ref.document_id && sameDocument(ref, clicked));

        if (clicked.document_id && !all.some(ref => sameSourceReference(ref, clicked))) {
            all.push(clicked);
        }

        const seen = new Set();
        const hits = all
            .filter(ref => {
                const key = sourceKey(ref);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => {
                const left = a.source_range ? a.source_range[0] : Number.MAX_SAFE_INTEGER;
                const right = b.source_range ? b.source_range[0] : Number.MAX_SAFE_INTEGER;
                return left - right;
            });

        let currentIndex = hits.findIndex(ref => sameSourceReference(ref, clicked));
        if (currentIndex < 0) currentIndex = 0;
        return { clicked, hits, currentIndex };
    }

    function makeRange(cursor, text) {
        const length = String(text || '').length;
        return [cursor, cursor + length];
    }

    function normalizeParagraphBlock(item, index, cursorRef) {
        const raw = item && typeof item === 'object' ? item : { text: item };
        const text = String(raw.text || raw.content || raw.chunk_content || raw.chunkContent || raw.paragraph || '');
        const sourceRange = normalizeSourceRange(raw.source_range || raw.sourceRange || raw.range) || makeRange(cursorRef.value, text);
        cursorRef.value = Math.max(cursorRef.value + text.length + 1, sourceRange[1] + 1);
        return {
            id: raw.id || raw.chunk_id || raw.chunkId || `paragraph-${index + 1}`,
            chunk_id: raw.chunk_id || raw.chunkId || '',
            text,
            source_range: sourceRange
        };
    }

    function splitDocumentContent(text) {
        return String(text || '')
            .split(/\n{2,}|\r?\n/)
            .map(part => part.trim())
            .filter(Boolean);
    }

    function getFallbackDocumentParagraphs(docRef) {
        const documentName = String(docRef.document_name || docRef.document_id || '');
        if (/员工报销制度|报销/.test(documentName)) {
            return [
                {
                    chunk_id: 'expense-preface',
                    source_range: [0, 178],
                    text: '一、总则：为规范公司费用报销管理，明确员工在差旅、办公、业务招待及项目执行过程中的费用申请、审批、报销和归档要求，保障费用支出真实、合规、可追溯，特制定本制度。'
                },
                {
                    chunk_id: 'expense-scope',
                    source_range: [179, 356],
                    text: '二、适用范围：本制度适用于公司全体正式员工、实习员工及经公司授权发生业务费用的外部协作人员。所有费用报销均应遵循预算先行、真实发生、及时提交、逐级审批的原则。'
                },
                {
                    chunk_id: 'expense-responsibility',
                    source_range: [357, 548],
                    text: '三、职责分工：申请人对报销事项的真实性和完整性负责；部门负责人负责确认费用发生的业务必要性；财务部门负责审核票据合规性、费用标准及预算占用情况；审计部门可根据需要进行抽查。'
                },
                {
                    chunk_id: 'expense-before-trip',
                    source_range: [549, 742],
                    text: '四、出差申请：员工出差前应在系统内提交出差申请，说明出差地点、时间、事由、预计费用和同行人员。未经审批的出差费用原则上不予报销，特殊紧急情况需在返程后补充审批说明。'
                },
                {
                    chunk_id: 'expense-ticket',
                    source_range: [743, 1018],
                    text: '五、票据要求：报销材料应包含真实有效的发票、行程单、支付凭证及必要的业务说明。票据抬头、税号、金额、日期和费用项目应与实际业务一致，纸质票据应保持清晰完整，电子票据需在系统中上传原件。'
                },
                {
                    chunk_id: 'chunk-expense-001',
                    source_range: [1024, 1156],
                    text: '六、差旅报销时限：差旅报销需在出差结束后 7 个工作日内提交报销申请，逾期需补充说明并由直属负责人确认后再进入财务审核。若因项目周期、客户结算或票据开具原因导致无法按期提交，申请人应在系统中登记延期原因。'
                },
                {
                    chunk_id: 'expense-approval',
                    source_range: [1157, 1422],
                    text: '七、审批流程：报销申请提交后，系统将根据费用类型、预算科目和金额自动匹配审批路径。常规费用由部门负责人审批后进入财务复核；超预算或超标准费用需追加业务负责人及分管领导审批。审批人应重点核对费用发生背景和附件完整性。'
                },
                {
                    chunk_id: 'expense-meal',
                    source_range: [1423, 1696],
                    text: '八、餐饮和业务招待：业务招待费用应事前说明招待对象、人数、事项及预计金额，报销时需上传发票、支付凭证和招待清单。无明确业务目的、超出审批标准或与工作无关的餐饮支出，不纳入报销范围。'
                },
                {
                    chunk_id: 'expense-transport',
                    source_range: [1697, 2038],
                    text: '九、交通费用：员工应优先选择经济合理的交通方式。因业务需要使用出租车、网约车或自驾车辆的，应在报销时说明行程起止地点和业务事项。跨城市交通应上传车票、机票行程单或其他有效凭证，并与出差申请保持一致。'
                },
                {
                    chunk_id: 'chunk-expense-002',
                    source_range: [2048, 2160],
                    text: '十、住宿及通勤凭证：住宿费、交通费和市内通勤费用需分别上传有效票据，系统会按费用类型进入对应的审批节点。住宿标准以公司差旅等级和目的地城市标准为准，超出标准部分需单独说明并经过审批。'
                },
                {
                    chunk_id: 'expense-finance-review',
                    source_range: [2161, 2412],
                    text: '十一、财务复核：财务人员应核对预算余额、发票真伪、费用归属和审批链路。发现材料缺失、金额不一致或说明不充分时，应退回申请人补充。退回后重新提交的报销单保留原审批记录，并记录补充说明。'
                },
                {
                    chunk_id: 'expense-payment',
                    source_range: [2413, 2638],
                    text: '十二、支付与归档：通过财务复核的报销单将在最近一个付款批次中支付。财务部门应按月归档报销单、审批记录和附件材料，保留期限按照公司档案管理制度执行，便于后续审计和追溯。'
                },
                {
                    chunk_id: 'expense-exception',
                    source_range: [2639, 2860],
                    text: '十三、异常处理：对于重复报销、虚假票据、拆分金额规避审批、与业务无关支出等情况，公司有权暂停报销、追回已支付费用，并根据员工手册和相关纪律规定进行处理。'
                }
            ];
        }

        if (/考勤|加班/.test(documentName)) {
            return [
                {
                    chunk_id: 'attendance-preface',
                    source_range: [0, 180],
                    text: '一、总则：为规范员工考勤、加班、调休和请假管理，保障业务连续性和员工合法权益，结合公司实际运营情况，制定本办法。'
                },
                {
                    chunk_id: 'attendance-worktime',
                    source_range: [181, 388],
                    text: '二、工作时间：公司实行标准工时制，员工应按照所在岗位和部门排班要求完成每日工作。因岗位性质需要执行弹性工时、综合工时或远程办公的，应由部门负责人提前确认。'
                },
                {
                    chunk_id: 'chunk-attendance-001',
                    source_range: [512, 638],
                    text: '三、加班申请：工作日延时工作或周末加班需提前提交加班申请，说明加班原因、预计时长和交付内容，经直属负责人审批后方可计入加班时长。紧急情况可事后补提，但需补充说明。'
                },
                {
                    chunk_id: 'attendance-rest',
                    source_range: [639, 870],
                    text: '四、调休规则：已审批的加班可在有效期内申请调休，调休应避开项目关键节点，并提前与团队确认工作交接。未按流程审批的加班不作为调休依据。'
                },
                {
                    chunk_id: 'attendance-record',
                    source_range: [871, 1100],
                    text: '五、考勤记录：员工应按要求完成签到、签退或工作状态登记。因外出拜访、会议、系统故障等原因无法正常打卡的，应及时提交补卡说明并上传相关证明。'
                }
            ];
        }

        const docName = docRef.document_name || docRef.document_id || '来源文档';
        return [
            {
                source_range: [0, 220],
                text: `${docName} 的正文包含制度背景、适用范围、审批流程、执行要求和异常处理等内容。系统会根据本次回答中的知识切片，在原文预览中定位并高亮对应内容。`
            },
            {
                source_range: [221, 460],
                text: '业务人员应在规定时间内提交材料，并保持审批记录与公司制度一致。审批人需要核对业务背景、材料完整性和费用或事项的合理性，确保信息可追溯。'
            },
            {
                source_range: [461, 720],
                text: '当同一文档存在多处引用位置时，预览弹窗顶部会展示位置序号。用户可以点击上一处或下一处，在同一篇文档内切换位置，高亮状态会同步更新。'
            }
        ];
    }

    function blockMatchesHit(block, hit) {
        if (!block || !hit) return false;
        if (hit.chunk_id && block.chunk_id && hit.chunk_id === block.chunk_id) return true;
        if (hit.source_range && sourceRangeOverlaps(block.source_range, hit.source_range)) return true;
        return !!hit.chunk_content && String(block.text || '').includes(hit.chunk_content);
    }

    function findMatchingBlockIndex(blocks, hit) {
        return blocks.findIndex(block => blockMatchesHit(block, hit));
    }

    function buildPreviewBlocks(docRef, hits) {
        const cursorRef = { value: 0 };
        let blocks = [];
        const paragraphSource = docRef.document_paragraphs ||
            hits.find(hit => hit.document_paragraphs)?.document_paragraphs ||
            null;
        const contentSource = docRef.document_content ||
            hits.find(hit => hit.document_content)?.document_content ||
            '';

        if (paragraphSource) {
            blocks = paragraphSource.map((item, index) => normalizeParagraphBlock(item, index, cursorRef));
        } else if (contentSource) {
            blocks = splitDocumentContent(contentSource).map((text, index) => normalizeParagraphBlock(text, index, cursorRef));
        } else {
            blocks = getFallbackDocumentParagraphs(docRef)
                .map((item, index) => normalizeParagraphBlock(item, index, cursorRef));
        }

        hits.forEach(hit => {
            if (findMatchingBlockIndex(blocks, hit) >= 0) return;
            const fallbackText = hit.chunk_content || `${hit.document_name || hit.document_id} 的命中内容`;
            blocks.push({
                id: hit.chunk_id || `hit-${blocks.length + 1}`,
                chunk_id: hit.chunk_id,
                text: fallbackText,
                source_range: hit.source_range || makeRange(cursorRef.value, fallbackText)
            });
            cursorRef.value = Math.max(cursorRef.value + fallbackText.length + 1, (hit.source_range && hit.source_range[1] + 1) || 0);
        });

        return blocks.sort((a, b) => {
            const left = a.source_range ? a.source_range[0] : Number.MAX_SAFE_INTEGER;
            const right = b.source_range ? b.source_range[0] : Number.MAX_SAFE_INTEGER;
            return left - right;
        });
    }

    function ensurePreviewStyles() {
        if (document.getElementById(PREVIEW_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = PREVIEW_STYLE_ID;
        style.textContent = `
            .ks-source-preview-overlay {
                position: fixed;
                inset: 0;
                z-index: 12000;
                background: rgba(15, 23, 42, 0.56);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 48px 24px;
            }
            .ks-source-preview-dialog {
                width: min(1120px, calc(100vw - 72px));
                height: min(760px, calc(100vh - 96px));
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
                border: 1px solid #dbe2ea;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .ks-source-preview-header {
                height: 52px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 0 16px 0 20px;
                border-bottom: 1px solid #e5e7eb;
                background: #f8fafc;
            }
            .ks-source-preview-title {
                min-width: 0;
                color: #1f2937;
                font-size: 15px;
                font-weight: 700;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .ks-source-preview-tools {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .ks-source-preview-counter {
                min-width: 118px;
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 10px;
                border: 1px solid #dbe2ea;
                border-radius: 6px;
                color: #334155;
                background: #fff;
                font-size: 13px;
                font-weight: 600;
            }
            .ks-source-preview-btn {
                width: 32px;
                height: 32px;
                border: 1px solid #dbe2ea;
                border-radius: 6px;
                background: #fff;
                color: #475569;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .ks-source-preview-btn:hover:not(:disabled) {
                background: #eff6ff;
                border-color: #bfdbfe;
                color: #1d4ed8;
            }
            .ks-source-preview-btn:focus-visible {
                outline: 2px solid #2563eb;
                outline-offset: 2px;
            }
            .ks-source-preview-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }
            .ks-source-preview-body {
                flex: 1;
                overflow-y: auto;
                padding: 28px 52px 48px;
                color: #1f2937;
                line-height: 1.9;
                background: #fff;
            }
            .ks-source-preview-block {
                border: 1px solid transparent;
                border-left: 4px solid transparent;
                border-radius: 6px;
                padding: 8px 12px;
                margin: 10px -12px;
                scroll-margin-top: 80px;
                transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
            }
            .ks-source-preview-block[data-active-hit="true"] {
                background: #fff1b8;
                border-color: #f59e0b;
                border-left-color: #f59e0b;
                box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
            }
            .ks-source-preview-empty {
                min-height: 320px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: #64748b;
                font-size: 14px;
            }
            @media (max-width: 768px) {
                .ks-source-preview-overlay { padding: 18px; }
                .ks-source-preview-dialog { width: 100%; height: calc(100vh - 36px); }
                .ks-source-preview-header { padding-left: 14px; }
                .ks-source-preview-counter { min-width: 104px; }
                .ks-source-preview-body { padding: 20px 20px 32px; }
            }
            @media (prefers-reduced-motion: reduce) {
                .ks-source-preview-block { transition: none; }
            }
        `;
        document.head.appendChild(style);
    }

    function renderSourcePreviewBody(modal, state) {
        const titleEl = modal.querySelector('[data-source-preview-title]');
        const counterEl = modal.querySelector('[data-source-preview-counter]');
        const prevBtn = modal.querySelector('[data-source-preview-prev]');
        const nextBtn = modal.querySelector('[data-source-preview-next]');
        const bodyEl = modal.querySelector('[data-source-preview-body]');
        const activeHit = state.hits[state.index];
        const docName = activeHit?.document_name || state.clicked.document_name || state.clicked.document_id || '来源文档';

        titleEl.textContent = `《${docName}》`;
        counterEl.textContent = `第 ${state.index + 1} 处 / 共 ${state.hits.length} 处`;
        prevBtn.disabled = state.index <= 0;
        nextBtn.disabled = state.index >= state.hits.length - 1;

        if (state.clicked.deleted) {
            bodyEl.innerHTML = '<div class="ks-source-preview-empty">来源文档已删除，无法查看</div>';
            return;
        }
        if (state.clicked.load_failed) {
            bodyEl.innerHTML = '<div class="ks-source-preview-empty">文档加载失败，请稍后重试</div>';
            return;
        }

        const blocks = buildPreviewBlocks(activeHit || state.clicked, state.hits);
        const activeBlockIndex = findMatchingBlockIndex(blocks, activeHit);
        bodyEl.innerHTML = `
            ${blocks.map((block, index) => {
                const isActive = index === activeBlockIndex;
                return `
                    <section class="ks-source-preview-block" data-source-preview-block="${index}" data-active-hit="${isActive ? 'true' : 'false'}" tabindex="-1">
                        <div>${escapeHtml(block.text)}</div>
                    </section>
                `;
            }).join('')}
        `;

        requestAnimationFrame(() => {
            const active = bodyEl.querySelector('[data-active-hit="true"]');
            if (active) {
                active.scrollIntoView({ block: 'center', behavior: 'smooth' });
                active.focus({ preventScroll: true });
            }
        });
    }

    function openKnowledgeSourcePreview(source, sources) {
        ensurePreviewStyles();
        const existing = document.getElementById(PREVIEW_MODAL_ID);
        if (existing) existing.remove();

        const collection = buildHitCollection(source, sources);
        const state = {
            clicked: collection.clicked,
            hits: collection.hits.length ? collection.hits : [collection.clicked],
            index: collection.currentIndex
        };

        const modal = document.createElement('div');
        modal.id = PREVIEW_MODAL_ID;
        modal.className = 'ks-source-preview-overlay';
        modal.innerHTML = `
            <div class="ks-source-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="ks-source-preview-title">
                <header class="ks-source-preview-header">
                    <div id="ks-source-preview-title" class="ks-source-preview-title" data-source-preview-title></div>
                    <div class="ks-source-preview-tools">
                        <span class="ks-source-preview-counter" data-source-preview-counter></span>
                        <button type="button" class="ks-source-preview-btn" data-source-preview-prev title="上一处" aria-label="上一处">
                            <span aria-hidden="true">↑</span>
                        </button>
                        <button type="button" class="ks-source-preview-btn" data-source-preview-next title="下一处" aria-label="下一处">
                            <span aria-hidden="true">↓</span>
                        </button>
                        <button type="button" class="ks-source-preview-btn" data-source-preview-close title="关闭" aria-label="关闭">
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                </header>
                <main class="ks-source-preview-body" data-source-preview-body></main>
            </div>
        `;

        const close = () => modal.remove();
        modal.querySelector('[data-source-preview-close]').addEventListener('click', close);
        modal.addEventListener('click', event => {
            if (event.target === modal) close();
        });
        const onKeydown = event => {
            if (!document.body.contains(modal)) {
                document.removeEventListener('keydown', onKeydown);
                return;
            }
            if (event.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKeydown);
        modal.querySelector('[data-source-preview-prev]').addEventListener('click', () => {
            if (state.index <= 0) return;
            state.index -= 1;
            renderSourcePreviewBody(modal, state);
        });
        modal.querySelector('[data-source-preview-next]').addEventListener('click', () => {
            if (state.index >= state.hits.length - 1) return;
            state.index += 1;
            renderSourcePreviewBody(modal, state);
        });

        document.body.appendChild(modal);
        renderSourcePreviewBody(modal, state);
    }

    window.SourceReferenceUtils = {
        SUMMARY_LIMIT,
        escapeHtml,
        getSourceSummary,
        normalizeSourceRange,
        normalizeSourceReference,
        sourceRangeOverlaps,
        fileIconClass,
        openKnowledgeSourcePreview
    };

    window.getKnowledgeCitationSummary = getSourceSummary;
    window.openKnowledgeSourcePreview = openKnowledgeSourcePreview;
})();
