// ===== teacher-library.js - 문제 라이브러리 & 붙여넣기 파서 =====

// ---- Question Library (Shared) ----
async function loadLibrary() {
    const list = document.getElementById('library-list');
    list.innerHTML = '<div class="loading-msg">불러오는 중...</div>';
    try {
        const sets = await getQuestionSets();
        if (sets.length === 0) {
            list.innerHTML = '<div class="empty-msg">아직 공유된 문제 세트가 없습니다.<br>첫 번째로 공유해보세요! 📚</div>';
            return;
        }
        list.innerHTML = '';
        sets.forEach(s => {
            const totalQ = (s.stages || []).reduce((sum, st) => sum + st.length, 0);
            const isMine = currentTeacherCode && s.teacherCode === currentTeacherCode;
            const card = document.createElement('div');
            card.className = 'library-card';
            card.innerHTML = `
                <div class="lib-card-top">
                    <span class="lib-badge">${s.grade || '?'}학년 ${s.subject || ''}</span>
                    <span class="lib-use-count">📥 ${s.useCount || 0}회 사용</span>
                </div>
                <h4 class="lib-title">${escapeHtml(s.title || '제목 없음')}</h4>
                <p class="lib-info">${(s.stages || []).length}단계 · ${totalQ}문제 · ${s.teacherName || '익명'} 선생님</p>
                <div class="lib-actions">
                    <button class="btn-lib-use" onclick="useQuestionSet('${s.id}')">📥 가져오기</button>
                    <button class="btn-lib-edit" onclick="editQuestionSet('${s.id}')">✏️ 수정(복사)</button>
                    ${isMine ? `<button class="btn-lib-delete" onclick="confirmDeleteSet('${s.id}','${escapeAttr(s.title||'')}')"'>🗑️ 삭제</button>` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    } catch(e) {
        list.innerHTML = '<div class="empty-msg">불러오기 실패. 인터넷 연결을 확인해주세요.</div>';
    }
}

async function loadMySets() {
    const list = document.getElementById('mysets-list');
    if (!currentTeacherCode) { list.innerHTML = '<div class="empty-msg">로그인이 필요합니다.</div>'; return; }
    list.innerHTML = '<div class="loading-msg">불러오는 중...</div>';
    try {
        const sets = await getQuestionSets();
        const mySets = sets.filter(s => s.teacherCode === currentTeacherCode);
        if (mySets.length === 0) {
            list.innerHTML = '<div class="empty-msg">저장된 문제 세트가 없습니다.<br>게임 만들기에서 💾 저장 버튼을 눌러보세요!</div>';
            return;
        }
        list.innerHTML = '';
        mySets.forEach(s => {
            const totalQ = (s.stages||[]).reduce((sum,st)=>sum+st.length,0);
            const card = document.createElement('div');
            card.className = 'library-card';
            card.innerHTML = `
                <div class="lib-card-top">
                    <span class="lib-badge">${s.grade||'?'}학년 ${s.subject||''}</span>
                    <span class="lib-use-count">${s.isPublic ? '🌐 공유중' : '🔒 비공개'}</span>
                </div>
                <h4 class="lib-title">${escapeHtml(s.title||'제목 없음')}</h4>
                <p class="lib-info">${(s.stages||[]).length}단계 · ${totalQ}문제</p>
                <div class="lib-actions">
                    <button class="btn-lib-use" onclick="useQuestionSet('${s.id}')">📥 게임에 적용</button>
                    <button class="btn-lib-edit" onclick="editQuestionSet('${s.id}')">✏️ 수정(복사)</button>
                    <button class="btn-lib-delete" onclick="confirmDeleteSet('${s.id}','${escapeAttr(s.title||'')}')">🗑️ 삭제</button>
                </div>`;
            list.appendChild(card);
        });
    } catch(e) {
        list.innerHTML = '<div class="empty-msg">불러오기 실패.</div>';
    }
}

async function useQuestionSet(setId) {
    const set = await getQuestionSet(setId);
    if (!set || !set.stages) { showToast('문제 세트를 불러올 수 없습니다'); return; }
    await incrementUseCount(setId);
    // Load into game creator
    document.getElementById('stages-container').innerHTML = '';
    stageCount = 0; questionIdCounter = 0;
    set.stages.forEach((questions, idx) => {
        stageCount++;
        const stageId = stageCount;
        const container = document.getElementById('stages-container');
        const card = document.createElement('div');
        card.className = 'stage-card'; card.id = `stage-${stageId}`;
        card.innerHTML = `<div class="stage-card-header"><h4>🏁 스테이지 ${idx+1}</h4><button class="btn-remove-stage" onclick="removeStage(${stageId})">✕</button></div><div id="questions-${stageId}" class="questions-list"></div><button class="btn-add-question" onclick="addQuestion(${stageId})">+ 문제 추가</button>`;
        container.appendChild(card);
        questions.forEach(q => fillQuestion(stageId, q));
    });
    switchHomeTab('create');
    document.getElementById('game-title').value = set.title || '';
    showToast(`✅ "${set.title}" 문제 세트를 불러왔습니다!`);
}

function fillQuestion(stageId, q) {
    questionIdCounter++;
    const qId = questionIdCounter;
    const qContainer = document.getElementById(`questions-${stageId}`);
    const item = document.createElement('div');
    item.className = 'question-item'; item.id = `q-${qId}`;
    
    const qType = q.type || 'multiple';
    const isMultiple = qType === 'multiple';
    const isOx = qType === 'ox';
    const isShort = qType === 'short';

    item.innerHTML = `
        <button class="btn-remove-q" onclick="this.parentElement.remove()">✕</button>
        <div class="form-group"><label>문제 유형</label>
            <select onchange="toggleQuestionType(${qId}, this.value)" id="qtype-${qId}">
                <option value="multiple" ${isMultiple?'selected':''}>객관식 (4지선다)</option>
                <option value="ox" ${isOx?'selected':''}>OX 퀴즈</option>
                <option value="short" ${isShort?'selected':''}>주관식 (단답형)</option>
            </select></div>
        <div class="form-group"><label>문제</label><input type="text" id="qtext-${qId}" value="${escapeAttr(q.text||'')}"></div>
        
        <div id="qchoices-${qId}" class="${isMultiple ? '' : 'hidden'}">
            <div class="form-group"><label>보기</label><div class="choices-edit">
                <input type="text" id="qc-${qId}-0" value="${escapeAttr((q.choices||[])[0]||'')}">
                <input type="text" id="qc-${qId}-1" value="${escapeAttr((q.choices||[])[1]||'')}">
                <input type="text" id="qc-${qId}-2" value="${escapeAttr((q.choices||[])[2]||'')}">
                <input type="text" id="qc-${qId}-3" value="${escapeAttr((q.choices||[])[3]||'')}">
            </div></div>
            <div class="correct-marker"><label>정답:</label><select id="qans-m-${qId}">
                <option value="0" ${q.answer===0?'selected':''}>①</option><option value="1" ${q.answer===1?'selected':''}>②</option>
                <option value="2" ${q.answer===2?'selected':''}>③</option><option value="3" ${q.answer===3?'selected':''}>④</option>
            </select></div>
        </div>

        <div id="qox-${qId}" class="${isOx ? '' : 'hidden'}">
            <div class="correct-marker">
                <label>정답:</label>
                <div class="ox-select">
                    <button type="button" class="btn-ox ${q.answer===0?'selected':''}" id="qox-o-${qId}" onclick="selectOX(${qId},'O')">⭕ O</button>
                    <button type="button" class="btn-ox ${q.answer===1?'selected':''}" id="qox-x-${qId}" onclick="selectOX(${qId},'X')">❌ X</button>
                </div>
                <input type="hidden" id="qans-ox-${qId}" value="${q.answer===1?'X':'O'}">
            </div>
        </div>

        <div id="qshort-${qId}" class="${isShort ? '' : 'hidden'}">
            <div class="form-group"><label>정답</label><input type="text" id="qans-s-${qId}" value="${escapeAttr((q.answers||[]).join(', '))}"></div>
        </div>`;
    qContainer.appendChild(item);
}

// ---- Save Question Set ----
function saveAsQuestionSet() {
    const stages = collectStages();
    if (!stages) return;
    document.getElementById('save-set-modal').classList.remove('hidden');
    document.getElementById('set-title').value = document.getElementById('game-title').value || '';
}
function closeSaveSetModal() { document.getElementById('save-set-modal').classList.add('hidden'); }

async function confirmSaveQuestionSet() {
    const stages = collectStages();
    if (!stages) return;
    const title = document.getElementById('set-title').value.trim() || '제목 없음';
    const grade = document.getElementById('set-grade').value;
    const subject = document.getElementById('set-subject').value;
    const isPublic = document.getElementById('set-public').checked;
    const teacher = currentTeacherCode ? await getTeacher(currentTeacherCode) : null;
    const data = {
        title, grade, subject, isPublic, stages,
        teacherCode: currentTeacherCode || '',
        teacherName: teacher ? teacher.name : '익명',
        useCount: 0
    };
    await saveQuestionSet(data);
    closeSaveSetModal();
    showToast(`✅ "${title}" 저장 완료! ${isPublic ? '다른 선생님도 사용 가능합니다.' : ''}`);
}

// ---- Edit (Copy & Edit) ----
async function editQuestionSet(setId) {
    const set = await getQuestionSet(setId);
    if (!set || !set.stages) { showToast('문제 세트를 불러올 수 없습니다'); return; }

    // Load into game creator
    document.getElementById('stages-container').innerHTML = '';
    stageCount = 0; questionIdCounter = 0;
    set.stages.forEach((questions, idx) => {
        stageCount++;
        const stageId = stageCount;
        const container = document.getElementById('stages-container');
        const card = document.createElement('div');
        card.className = 'stage-card'; card.id = `stage-${stageId}`;
        card.innerHTML = `<div class="stage-card-header"><h4>🏁 스테이지 ${idx+1}</h4><button class="btn-remove-stage" onclick="removeStage(${stageId})">✕</button></div><div id="questions-${stageId}" class="questions-list"></div><button class="btn-add-question" onclick="addQuestion(${stageId})">+ 문제 추가</button>`;
        container.appendChild(card);
        questions.forEach(q => fillQuestion(stageId, q));
    });

    switchHomeTab('create');
    document.getElementById('game-title').value = (set.title || '') + ' (수정)';
    showToast('📝 문제를 수정한 후 💾 저장 버튼을 누르면 내 이름으로 새로 저장됩니다!');
}

// ---- Delete ----
async function confirmDeleteSet(setId, title) {
    if (!confirm(`"${title}" 문제 세트를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;

    // Verify ownership
    const set = await getQuestionSet(setId);
    if (!set) { showToast('문제 세트를 찾을 수 없습니다'); return; }
    if (set.teacherCode !== currentTeacherCode) {
        showToast('⚠️ 본인이 만든 문제 세트만 삭제할 수 있습니다');
        return;
    }

    await deleteQuestionSet(setId);
    showToast('🗑️ 삭제되었습니다');
    // Refresh current tab
    loadMySets();
    loadLibrary();
}

// ---- Paste Import ----
let parsedStages = null;

function openPasteModal() {
    document.getElementById('paste-modal').classList.remove('hidden');
    document.getElementById('paste-textarea').value = '';
    document.getElementById('paste-preview').classList.add('hidden');
    document.getElementById('btn-apply-paste').disabled = true;
    parsedStages = null;
    const ta = document.getElementById('paste-textarea');
    ta.removeEventListener('input', onPasteInput);
    ta.addEventListener('input', onPasteInput);
    ta.focus();
}
function closePasteModal() { document.getElementById('paste-modal').classList.add('hidden'); }

function onPasteInput() {
    const text = document.getElementById('paste-textarea').value;
    if (text.trim().length < 5) { document.getElementById('paste-preview').classList.add('hidden'); document.getElementById('btn-apply-paste').disabled = true; parsedStages = null; return; }
    parsedStages = parseHwpText(text);
    showParsePreview(parsedStages);
}

function parseHwpText(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const stagePattern = /^[<＜〈【]?\s*(\d+)\s*단계\s*[>＞〉】]?\s*(.*)/;
    const skipPattern = /^(고고전진|퀴즈$|문제\s*,?\s*정답|^번$)/;
    const hasTabLines = lines.filter(l => l.includes('\t')).length;
    if (hasTabLines >= 2) return parseTabFormat(lines, stagePattern, skipPattern);
    return parseAlternatingFormat(lines, stagePattern, skipPattern);
}

function parseTabFormat(lines, sp, skip) {
    const stages = [];
    let cur = null;
    let lastQuestion = null;

    for (let line of lines) {
        // Stage marker
        let m = line.match(sp);
        if (m) {
            cur = { title: m[2].replace(/^[:\s]+/, '').trim() || `스테이지 ${stages.length + 1}`, questions: [] };
            stages.push(cur);
            lastQuestion = null;
            continue;
        }
        // Skip headers
        if (skip.test(line)) continue;

        // Default stage
        if (!cur) { cur = { title: '스테이지 1', questions: [] }; stages.push(cur); }

        if (line.includes('\t')) {
            // TAB이 있는 줄 = 새 문제 + 정답
            let parts = line.split('\t').map(x => x.trim()).filter(x => x);
            if (parts.length >= 2) {
                const qText = parts.slice(0, -1).join(' ').trim();
                const answer = parts[parts.length - 1].trim();
                if (qText.length >= 2 && qText !== answer) {
                    lastQuestion = { text: qText, answer: answer };
                    cur.questions.push(lastQuestion);
                }
            }
        } else {
            // TAB이 없는 줄 = 이전 문제의 이어지는 부분
            if (lastQuestion && line.length >= 2) {
                lastQuestion.text += ' ' + line;
            }
            // 만약 이전 문제가 없으면 무시 (헤더/제목일 수 있음)
        }
    }
    return stages.filter(s => s.questions.length > 0);
}

function parseAlternatingFormat(lines, sp, skip) {
    const stages = [];
    let cur = null;

    // 1단계: 스테이지와 내용 분리, 줄 합치기
    const items = []; // {type: 'stage'|'line', ...}
    for (let line of lines) {
        let m = line.match(sp);
        if (m) {
            items.push({ type: 'stage', title: m[2].replace(/^[:\s]+/, '').trim() || `스테이지 ${items.filter(x => x.type === 'stage').length + 1}` });
            continue;
        }
        if (skip.test(line) || line.length < 2) continue;
        items.push({ type: 'line', text: line });
    }

    // 2단계: 줄 합치기 - 이어지는 설명줄을 이전 줄에 병합
    // 규칙: -로 시작하는 줄 또는 앞 줄이 ?로 안 끝나는 긴 줄 뒤의 긴 줄 = 병합
    const merged = [];
    for (let item of items) {
        if (item.type === 'stage') { merged.push(item); continue; }
        const text = item.text;
        const prev = merged.length > 0 ? merged[merged.length - 1] : null;

        // 이전 줄에 병합해야 하는 경우
        if (prev && prev.type === 'line') {
            const startsWithDash = text.startsWith('-') || text.startsWith('–');
            const prevIsLong = prev.text.length > 15;
            const thisIsLong = text.length > 15;
            // -로 시작 = 이전 문제의 부연설명
            if (startsWithDash) { prev.text += ' ' + text; continue; }
            // 이전 줄과 현재 줄 모두 길면 = 같은 문제의 일부일 가능성
            if (prevIsLong && thisIsLong && !prev.text.match(/[?？]$/)) { prev.text += ' ' + text; continue; }
        }
        merged.push({ type: 'line', text: text });
    }

    // 3단계: 문제-정답 쌍 만들기 (긴 줄=문제, 짧은 줄=정답)
    const MAX_ANSWER_LEN = 20; // 정답은 보통 20자 이하
    cur = null;
    let pendingQuestion = null;

    for (let item of merged) {
        if (item.type === 'stage') {
            if (pendingQuestion) { cur.questions.push({ text: pendingQuestion, answer: '' }); pendingQuestion = null; }
            cur = { title: item.title, questions: [] };
            stages.push(cur);
            continue;
        }
        if (!cur) { cur = { title: '스테이지 1', questions: [] }; stages.push(cur); }

        const text = item.text;
        const isShort = text.length <= MAX_ANSWER_LEN;
        const isLong = text.length > MAX_ANSWER_LEN;

        if (pendingQuestion) {
            // 이전에 문제가 대기 중
            if (isShort) {
                // 짧은 줄 = 정답
                cur.questions.push({ text: pendingQuestion, answer: text });
                pendingQuestion = null;
            } else {
                // 긴 줄 = 이전 문제는 정답 없이 저장, 이 줄이 새 문제
                cur.questions.push({ text: pendingQuestion, answer: '' });
                pendingQuestion = text;
            }
        } else {
            if (isLong || text.match(/[?？]$/)) {
                // 긴 줄 또는 ?로 끝남 = 문제
                pendingQuestion = text;
            } else {
                // 짧은 줄인데 앞에 문제가 없으면 단독 문제로 처리
                cur.questions.push({ text: text, answer: '' });
            }
        }
    }
    // 마지막 대기 문제 처리
    if (pendingQuestion && cur) {
        cur.questions.push({ text: pendingQuestion, answer: '' });
    }

    return stages.filter(s => s.questions.length > 0);
}

function showParsePreview(stages) {
    const preview = document.getElementById('paste-preview');
    const content = document.getElementById('paste-preview-content');
    if (!stages || stages.length===0) { content.innerHTML = '<p style="color:#ff006e">문제를 인식하지 못했습니다.</p>'; preview.classList.remove('hidden'); document.getElementById('btn-apply-paste').disabled = true; return; }
    let totalQ = 0, html = '';
    stages.forEach((s,i) => {
        totalQ += s.questions.length;
        html += `<div class="preview-stage"><div class="preview-stage-title">🏁 스테이지 ${i+1}: ${escapeHtml(s.title)} <span class="preview-count">${s.questions.length}문제</span></div>`;
        s.questions.forEach(q => html += `<div class="preview-question"><span class="preview-q">${escapeHtml(q.text)}</span><span class="preview-a">${q.answer?escapeHtml(q.answer):'<em style="color:#ff006e">정답 없음</em>'}</span></div>`);
        html += '</div>';
    });
    content.innerHTML = `<p style="margin-bottom:12px;color:#00d4ff">✅ ${stages.length}개 스테이지, 총 ${totalQ}개 문제 인식</p>` + html;
    preview.classList.remove('hidden');
    document.getElementById('btn-apply-paste').disabled = false;
}

function applyParsedQuestions() {
    if (!parsedStages || parsedStages.length===0) return;
    document.getElementById('stages-container').innerHTML = '';
    stageCount = 0; questionIdCounter = 0;
    parsedStages.forEach((stage, idx) => {
        stageCount++; const stageId = stageCount;
        const container = document.getElementById('stages-container');
        const card = document.createElement('div');
        card.className = 'stage-card'; card.id = `stage-${stageId}`;
        card.innerHTML = `<div class="stage-card-header"><h4>🏁 스테이지 ${idx+1}: ${escapeHtml(stage.title)}</h4><button class="btn-remove-stage" onclick="removeStage(${stageId})">✕</button></div><div id="questions-${stageId}" class="questions-list"></div><button class="btn-add-question" onclick="addQuestion(${stageId})">+ 문제 추가</button>`;
        container.appendChild(card);
        stage.questions.forEach(q => {
            let type = 'short';
            let answerObj = { answers: q.answer ? [q.answer] : [] };
            
            // OX 문제 자동 감지
            if (q.answer) {
                const ans = q.answer.trim().toUpperCase();
                if (['O', 'X', '⭕', '❌', '정답: O', '정답: X', '정답 O', '정답 X', '정답:O', '정답:X'].includes(ans)) {
                    type = 'ox';
                    answerObj = { answer: (ans.includes('X') || ans.includes('❌')) ? 1 : 0 };
                }
            }
            
            fillQuestion(stageId, { type: type, text: q.text, ...answerObj });
        });
    });
    closePasteModal();
    showToast(`✅ ${parsedStages.length}개 스테이지 입력 완료!`);
}
