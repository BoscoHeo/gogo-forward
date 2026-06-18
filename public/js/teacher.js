// ===== teacher.js - 교사 로그인, 문제 관리, 게임 대시보드 =====

let currentGameCode = null;
let currentTeacherCode = null;
let gameTimerInterval = null;
let stageCount = 0;
let questionIdCounter = 0;
let currentTeamCount = 2;
const TEAM_EMOJIS = ['🔴','🔵','🟢','🟡','🟠','🟣'];
const TEAM_DEFAULT_NAMES = ['1모둥','2모둥','3모둥','4모둥','5모둥','6모둥'];

// ---- Teacher Login/Register ----
function switchLoginTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-existing').classList.add('hidden');
    document.getElementById('tab-new').classList.add('hidden');
    document.getElementById('teacher-code-result').classList.add('hidden');
    if (tab === 'existing') {
        document.getElementById('tab-existing').classList.remove('hidden');
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else {
        document.getElementById('tab-new').classList.remove('hidden');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

async function teacherLogin() {
    const code = document.getElementById('teacher-code-input').value.trim().toUpperCase();
    if (code.length < 4) { showToast('교사 코드를 입력해주세요'); return; }
    const teacher = await getTeacher(code);
    if (!teacher) { showToast('등록되지 않은 코드입니다'); return; }
    currentTeacherCode = code;
    localStorage.setItem('teacherCode', code);
    document.getElementById('teacher-home-title').textContent = `👩‍🏫 ${teacher.name} 선생님`;
    document.getElementById('teacher-badge').textContent = code;
    showPage('page-teacher-home');
    addStage(); addStage();
}

async function teacherRegister() {
    const name = document.getElementById('teacher-name-input').value.trim();
    if (!name) { showToast('이름을 입력해주세요'); return; }
    const school = document.getElementById('teacher-school-input').value.trim();
    const code = generateTeacherCode();
    await saveTeacher(code, { name, school, createdAt: Date.now(), questionSets: {} });
    currentTeacherCode = code;
    localStorage.setItem('teacherCode', code);

    document.getElementById('tab-new').classList.add('hidden');
    document.getElementById('teacher-code-result').classList.remove('hidden');
    document.getElementById('my-teacher-code').textContent = code;
}

function goToTeacherHome() {
    showPage('page-teacher-home');
    document.getElementById('teacher-badge').textContent = currentTeacherCode;
    addStage(); addStage();
}

// ---- Home Tabs ----
function switchHomeTab(tab) {
    document.querySelectorAll('.home-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.home-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('home-tab-' + tab).classList.add('active');
    document.getElementById('home-content-' + tab).classList.remove('hidden');
    if (tab === 'library') loadLibrary();
    if (tab === 'mysets') loadMySets();
}

// ---- Stage & Question Management ----
function addStage() {
    stageCount++;
    const stageId = stageCount;
    const container = document.getElementById('stages-container');
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.id = `stage-${stageId}`;
    card.innerHTML = `
        <div class="stage-card-header">
            <h4>🏁 스테이지 ${stageId}</h4>
            <button class="btn-remove-stage" onclick="removeStage(${stageId})">✕</button>
        </div>
        <div id="questions-${stageId}" class="questions-list"></div>
        <button class="btn-add-question" onclick="addQuestion(${stageId})">+ 문제 추가</button>
    `;
    container.appendChild(card);
    addQuestion(stageId);
}

function removeStage(stageId) {
    const el = document.getElementById(`stage-${stageId}`);
    if (el) el.remove();
    renumberStages();
}

function renumberStages() {
    document.querySelectorAll('.stage-card').forEach((card, i) => {
        card.querySelector('h4').textContent = `🏁 스테이지 ${i + 1}`;
    });
}

function addQuestion(stageId) {
    questionIdCounter++;
    const qId = questionIdCounter;
    const container = document.getElementById(`questions-${stageId}`);
    const item = document.createElement('div');
    item.className = 'question-item';
    item.id = `q-${qId}`;
    item.innerHTML = `
        <button class="btn-remove-q" onclick="this.parentElement.remove()">✕</button>
        <div class="form-group">
            <label>문제 유형</label>
            <select onchange="toggleQuestionType(${qId}, this.value)" id="qtype-${qId}">
                <option value="multiple">객관식 (4지선다)</option>
                <option value="ox">OX 퀴즈</option>
                <option value="short">주관식 (단답형)</option>
            </select>
        </div>
        <div class="form-group">
            <label>문제</label>
            <input type="text" id="qtext-${qId}" placeholder="문제를 입력하세요">
        </div>
        <div id="qchoices-${qId}">
            <div class="form-group">
                <label>보기</label>
                <div class="choices-edit">
                    <input type="text" id="qc-${qId}-0" placeholder="① 보기1">
                    <input type="text" id="qc-${qId}-1" placeholder="② 보기2">
                    <input type="text" id="qc-${qId}-2" placeholder="③ 보기3">
                    <input type="text" id="qc-${qId}-3" placeholder="④ 보기4">
                </div>
            </div>
            <div class="correct-marker">
                <label>정답:</label>
                <select id="qans-m-${qId}">
                    <option value="0">①</option><option value="1">②</option>
                    <option value="2">③</option><option value="3">④</option>
                </select>
            </div>
        </div>
        <div id="qox-${qId}" class="hidden">
            <div class="correct-marker">
                <label>정답:</label>
                <div class="ox-select">
                    <button type="button" class="btn-ox selected" id="qox-o-${qId}" onclick="selectOX(${qId},'O')">⭕ O</button>
                    <button type="button" class="btn-ox" id="qox-x-${qId}" onclick="selectOX(${qId},'X')">❌ X</button>
                </div>
                <input type="hidden" id="qans-ox-${qId}" value="O">
            </div>
        </div>
        <div id="qshort-${qId}" class="hidden">
            <div class="form-group">
                <label>정답 (쉼표로 복수 정답 구분)</label>
                <input type="text" id="qans-s-${qId}" placeholder="정답1, 정답2">
            </div>
        </div>
    `;
    container.appendChild(item);
}

function selectOX(qId, val) {
    document.getElementById(`qans-ox-${qId}`).value = val;
    document.getElementById(`qox-o-${qId}`).className = 'btn-ox' + (val === 'O' ? ' selected' : '');
    document.getElementById(`qox-x-${qId}`).className = 'btn-ox' + (val === 'X' ? ' selected' : '');
}

function toggleQuestionType(qId, type) {
    const choices = document.getElementById(`qchoices-${qId}`);
    const short = document.getElementById(`qshort-${qId}`);
    const ox = document.getElementById(`qox-${qId}`);
    choices.classList.add('hidden');
    short.classList.add('hidden');
    ox.classList.add('hidden');
    if (type === 'multiple') choices.classList.remove('hidden');
    else if (type === 'ox') ox.classList.remove('hidden');
    else short.classList.remove('hidden');
}

// ---- Collect Stages Data ----
function collectStages() {
    const stageCards = document.querySelectorAll('.stage-card');
    if (stageCards.length < 2) { showToast('스테이지를 최소 2개 이상 만들어주세요!'); return null; }
    const stages = [];
    let valid = true;
    stageCards.forEach(card => {
        const questions = [];
        card.querySelectorAll('.question-item').forEach(qItem => {
            const qId = qItem.id.replace('q-', '');
            const type = document.getElementById(`qtype-${qId}`).value;
            const text = document.getElementById(`qtext-${qId}`).value.trim();
            if (!text) { valid = false; return; }
            if (type === 'multiple') {
                const choices = [];
                for (let i = 0; i < 4; i++) {
                    const c = document.getElementById(`qc-${qId}-${i}`).value.trim();
                    if (!c) { valid = false; return; }
                    choices.push(c);
                }
                questions.push({ type: 'multiple', text, choices, answer: parseInt(document.getElementById(`qans-m-${qId}`).value) });
            } else if (type === 'ox') {
                const oxVal = document.getElementById(`qans-ox-${qId}`).value;
                questions.push({ type: 'ox', text, choices: ['⭕ O', '❌ X'], answer: oxVal === 'O' ? 0 : 1 });
            } else {
                const answerRaw = document.getElementById(`qans-s-${qId}`).value.trim();
                if (!answerRaw) { valid = false; return; }
                questions.push({ type: 'short', text, answers: answerRaw.split(',').map(a => a.trim().toLowerCase()).filter(a => a) });
            }
        });
        if (questions.length === 0) valid = false;
        stages.push(questions);
    });
    if (!valid) { showToast('모든 문제와 보기를 빠짐없이 입력해주세요!'); return null; }
    return stages;
}

// ---- Team Setup ----
function toggleTeamSetup() {
    const on = document.getElementById('team-mode').checked;
    document.getElementById('team-setup-area').style.display = on ? 'block' : 'none';
    if (on) setTeamCount(currentTeamCount);
}

function setTeamCount(n) {
    currentTeamCount = n;
    // 선택 버튼 하이라이트
    [2,3,4,5,6].forEach(i => {
        const btn = document.getElementById('tc-' + i);
        if (btn) btn.className = 'btn-team-count' + (i === n ? ' active' : '');
    });
    // 팀 이름 입력 레이아웃 갱신
    const area = document.getElementById('team-names-area');
    if (!area) return;
    area.innerHTML = '';
    for (let i = 0; i < n; i++) {
        const existing = area.querySelector(`#tname-${i}`);
        const val = existing ? existing.value : TEAM_DEFAULT_NAMES[i];
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;';
        wrapper.innerHTML = `<span style="font-size:18px;">${TEAM_EMOJIS[i]}</span><input id="tname-${i}" type="text" value="${val}" maxlength="8" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#e8e8f0;font-size:14px;">`;
        area.appendChild(wrapper);
    }
}

function getTeamConfig() {
    if (!document.getElementById('team-mode').checked) return null;
    const teams = [];
    for (let i = 0; i < currentTeamCount; i++) {
        const inp = document.getElementById('tname-' + i);
        teams.push({ id: String(i), name: inp ? inp.value.trim() || TEAM_DEFAULT_NAMES[i] : TEAM_DEFAULT_NAMES[i], emoji: TEAM_EMOJIS[i] });
    }
    return teams;
}

// ---- Create Game ----
function createGame() {
    const stages = collectStages();
    if (!stages) return;
    const title = document.getElementById('game-title').value.trim() || '고고전진!';
    const timer = parseInt(document.getElementById('game-timer').value) || 10;
    const teamMode = document.getElementById('team-mode').checked;
    const teams = getTeamConfig(); // null if not team mode
    const code = generateCode();
    const gameData = {
        code, title, timer: timer * 60, teamMode, teams: teams || [], stages,
        players: {}, status: 'waiting', startedAt: null,
        createdAt: Date.now(), teacherCode: currentTeacherCode || ''
    };
    saveGame(code, gameData);
    currentGameCode = code;
    document.getElementById('dash-game-code').textContent = code;
    document.getElementById('game-code-big').textContent = code;
    if (teamMode) document.getElementById('team-scores').classList.remove('hidden');
    showPage('page-teacher-dashboard');
    startDashboardPolling();
}

// ---- Dashboard ----
function startDashboardPolling() {
    if (currentGameCode && dbReady) {
        listenGame(currentGameCode, (game) => { renderDashboard(game); });
    }
}

function renderDashboard(game) {
    if (!game) return;
    const players = Object.values(game.players || {});
    const totalStages = game.stages.length;
    const teams = game.teams || [];
    document.getElementById('dash-players').textContent = players.length + '명';

    const grid = document.getElementById('players-grid');
    grid.innerHTML = '';
    players.forEach((p, pidx) => {
        const cleared = p.currentStage > totalStages;
        const teamObj = teams.find(t => t.id === p.team);
        const teamColor = teamObj ? teamObj.emoji : '';
        let cls = 'player-card' + (cleared ? ' cleared' : '');
        const card = document.createElement('div');
        card.className = cls;
        card.style.borderLeft = teamObj ? `3px solid rgba(255,255,255,.3)` : '';

        // 팀 배정 드롭다운 (team mode 시)
        let teamSelector = '';
        if (game.teamMode && teams.length > 0) {
            const opts = teams.map(t =>
                `<option value="${t.id}" ${p.team === t.id ? 'selected' : ''}>${t.emoji} ${t.name}</option>`
            ).join('');
            const playerId = Object.keys(game.players || {}).find(k => game.players[k] === p)
                          || Object.entries(game.players || {}).find(([,v])=>v.name===p.name)?.[0] || '';
            teamSelector = `<select class="team-assign-select" onchange="assignTeam('${playerId}', this.value)"><option value="">- 미배정 -</option>${opts}</select>`;
        }

        card.innerHTML = `
            <div class="player-name">${teamColor ? teamColor + ' ' : ''}${escapeHtml(p.name)}</div>
            <div class="player-stage ${cleared ? 'cleared' : ''}">${cleared ? `🔥 보너스 (+${p.bonusPoints || 0}점)` : `스테이지 ${p.currentStage}/${totalStages}`}</div>
            ${teamSelector}`;
        grid.appendChild(card);
    });

    // 팀 점수판
    if (game.teamMode && teams.length > 0) {
        const scoreEl = document.getElementById('team-scores');
        scoreEl.classList.remove('hidden');
        scoreEl.innerHTML = teams.map(t => {
            const score = players.filter(p => p.team === t.id)
                .reduce((sum, p) => sum + Math.min(p.currentStage - 1, totalStages) + (p.bonusPoints || 0), 0);
            const count = players.filter(p => p.team === t.id).length;
            return `<div class="team-score-card"><div class="team-score-name">${t.emoji} ${escapeHtml(t.name)}</div><div class="team-score-val">${score}점</div><div class="team-score-count">${count}명</div></div>`;
        }).join('');
    }

    if (game.status === 'playing' && game.startedAt) {
        const remaining = Math.max(0, game.timer - Math.floor((Date.now() - game.startedAt) / 1000));
        const m = Math.floor(remaining / 60), s = remaining % 60;
        document.getElementById('dash-timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (remaining <= 0) endGame();
    }
}

function assignTeam(playerId, teamId) {
    if (!currentGameCode || !playerId) return;
    updatePlayerData(currentGameCode, playerId, { team: teamId });
}

function startGame() {
    if (!currentGameCode) return;
    getGameAsync(currentGameCode).then(game => {
        if (!game) return;
        if (Object.keys(game.players || {}).length === 0) { showToast('참여한 학생이 없습니다!'); return; }
        updateGameField(currentGameCode, 'status', 'playing');
        updateGameField(currentGameCode, 'startedAt', Date.now());
        document.getElementById('share-area').classList.add('hidden');
        document.getElementById('game-progress').classList.remove('hidden');
        document.getElementById('btn-end-game').classList.remove('hidden');
        // AI 채점 리스너 시작 (API 키가 있는 경우에만)
        startAiGradingListener();
    });
}

function endGame() {
    if (!currentGameCode) return;
    updateGameField(currentGameCode, 'status', 'finished');
    getGameAsync(currentGameCode).then(game => { if (game) showResults(game); });
}

function showResults(game) {
    const players = Object.values(game.players || {});
    const totalStages = game.stages.length;
    const teams = game.teams || [];
    document.getElementById('game-progress').classList.add('hidden');
    document.getElementById('btn-end-game').classList.add('hidden');
    document.getElementById('game-results').classList.remove('hidden');
    let html = '';
    
    if (game.teamMode && teams.length > 0) {
        let bestTeam = null;
        let bestScore = -1;
        let isTie = false;
        
        const teamScores = teams.map(t => {
            const score = players.filter(p => p.team === t.id).reduce((sum, p) => sum + Math.min(p.currentStage - 1, totalStages) + (p.bonusPoints || 0), 0);
            if (score > bestScore) { bestScore = score; bestTeam = t; isTie = false; }
            else if (score === bestScore) { isTie = true; }
            return { ...t, score };
        });
        
        const w = isTie ? '무승부! 🤝' : `${bestTeam.emoji} ${bestTeam.name} 승리! 🎉`;
        html += `<div style="text-align:center;font-size:28px;font-weight:800;margin-bottom:20px;color:#ffd700">${w}</div>`;
        html += `<div style="display:flex;justify-content:center;gap:12px;margin-bottom:20px;">`;
        teamScores.forEach(ts => {
            html += `<div style="background:rgba(255,255,255,.1);padding:10px 16px;border-radius:12px;">${ts.emoji} ${ts.name}: <strong>${ts.score}점</strong></div>`;
        });
        html += `</div>`;
    }
    
    const sorted = [...players].sort((a,b)=>
        ((b.currentStage - 1) + (b.bonusPoints || 0)) - ((a.currentStage - 1) + (a.bonusPoints || 0)) || 
        (a.clearedAt||Infinity)-(b.clearedAt||Infinity)
    );
    html += `<table class="results-table"><thead><tr><th>순위</th><th>이름</th>${game.teamMode?'<th>팀</th>':''}<th>진행 / 점수</th><th>오답</th></tr></thead><tbody>`;
    sorted.forEach((p,i) => {
        const c = p.currentStage > totalStages;
        const pts = Math.min(p.currentStage-1, totalStages) + (p.bonusPoints || 0);
        const teamObj = teams.find(t => t.id === p.team);
        const teamStr = teamObj ? teamObj.emoji : '';
        html += `<tr${c?' class="result-winner"':''}><td>${i+1}</td><td>${escapeHtml(p.name)}</td>${game.teamMode?`<td>${teamStr}</td>`:''}<td>${c?`🔥 ${pts}점`:`${Math.max(0,p.currentStage-1)}/${totalStages}`}</td><td>${p.wrongCount||0}</td></tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('results-content').innerHTML = html;
}

function confirmLeave() {
    if (currentGameCode && confirm('게임을 종료하고 나가시겠습니까?')) {
        updateGameField(currentGameCode, 'status', 'finished');
        currentGameCode = null;
    }
    showPage('page-teacher-home');
}

function copyGameCode() {
    if (!currentGameCode) return;
    navigator.clipboard.writeText(currentGameCode).then(() => showToast('게임 코드 복사됨!')).catch(() => showToast(currentGameCode));
}

function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function escapeAttr(t) { return t.replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---- API Key Management (localStorage only) ----
function saveApiKey() {
    const el = document.getElementById('ai-api-key');
    if (!el) return;
    const key = el.value.trim();
    if (!key) { showToast('API 키를 입력해주세요'); return; }
    localStorage.setItem('gemini_api_key', key);
    el.value = '';
    updateApiKeyStatus();
    showToast('✅ API 키가 이 PC에 저장되었습니다!');
}

function clearApiKey() {
    localStorage.removeItem('gemini_api_key');
    updateApiKeyStatus();
    showToast('🗑️ API 키가 삭제되었습니다');
}

function updateApiKeyStatus() {
    const savedDisplay = document.getElementById('api-key-saved-display');
    const inputArea = document.getElementById('api-key-input-area');
    const statusEl = document.getElementById('api-key-status');

    const hasKey = !!localStorage.getItem('gemini_api_key');

    if (savedDisplay && inputArea) {
        if (hasKey) {
            const key = localStorage.getItem('gemini_api_key');
            const masked = key.substring(0, 4) + '●●●●●●●●' + key.substring(key.length - 4);
            savedDisplay.innerHTML = `✅ API 키 저장됨: <strong>${masked}</strong> <button onclick="clearApiKey()" style="margin-left:12px;padding:4px 12px;border-radius:8px;border:1px solid rgba(255,0,80,.3);background:rgba(255,0,80,.1);color:#ff006e;font-size:12px;cursor:pointer;">삭제</button>`;
            savedDisplay.style.display = 'block';
            inputArea.style.display = 'none';
        } else {
            savedDisplay.style.display = 'none';
            inputArea.style.display = 'flex';
        }
    }
    if (statusEl) {
        statusEl.textContent = hasKey
            ? '🤖 AI 채점 활성화됨 — 게임 시작 시 자동 작동'
            : '🔒 API 키는 이 PC에만 저장됩니다 (서버 전송 없음)';
        statusEl.style.color = hasKey ? '#00d4ff' : '#888';
    }
}

// Page load: restore API key status
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateApiKeyStatus, 500);
});

// ---- AI Grading (Teacher Dashboard as grading server) ----
function startAiGradingListener() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey || !currentGameCode || !dbReady) return;

    console.log('🤖 AI 채점 리스너 시작');
    db.ref('games/' + currentGameCode + '/pendingGrades').on('child_added', async (snap) => {
        const req = snap.val();
        if (!req || req.graded) return;

        try {
            const result = await callGeminiGrade(apiKey, req.question, req.correctAnswer, req.studentAnswer);
            // Write result back
            db.ref('games/' + currentGameCode + '/gradeResults/' + snap.key).set({
                correct: result.correct,
                timestamp: Date.now()
            });
            // Remove pending
            snap.ref.remove();
        } catch (e) {
            console.error('AI grading error:', e);
            // Fallback: mark as needs manual check
            db.ref('games/' + currentGameCode + '/gradeResults/' + snap.key).set({
                correct: false,
                fallback: true,
                timestamp: Date.now()
            });
            snap.ref.remove();
        }
    });
}

async function callGeminiGrade(apiKey, question, correctAnswer, studentAnswer) {
    const prompt = `당신은 초등학교 시험 채점 도우미입니다.
아래 문제의 정답과 학생 답안을 비교하여 정답 여부를 판단해주세요.
의미가 같거나 핵심 내용이 동일하면 정답으로 처리합니다.

문제: ${question}
정답: ${correctAnswer}
학생 답안: ${studentAnswer}

JSON으로만 응답하세요: {"correct": true} 또는 {"correct": false}`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 20 }
        })
    });

    if (!resp.ok) throw new Error('API error: ' + resp.status);
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Parse JSON from response
    const match = text.match(/\{[^}]*"correct"\s*:\s*(true|false)[^}]*\}/);
    if (match) return JSON.parse(match[0]);
    return { correct: text.toLowerCase().includes('true') };
}
