// ===== student.js - 학생 게임 참여 로직 (Firebase) =====

let myPlayerId = null;
let myGameCode = null;
let myCurrentStage = 1;
let myWrongCount = 0;
let selectedChoice = -1;
let selectedTeam = null;
let studentTimerInterval = null;
let currentGameData = null;
let myStageCorrectCount = 0;
let myBonusPoints = 0;
let myBonusCorrectCount = 0;
let myConsecutiveWrong = 0;
let myStageAskedQuestions = []; // 현재 스테이지에서 출제된 문제 추적
let myGlobalAskedQuestions = []; // 게임 전체에서 한 번이라도 출제된 문제 추적
let answerHistory = []; // { stage, questionText, studentAnswer, correctAnswer, correct }

// 정답 형태 힌트 생성 - 특수 구조가 있는 답만 (예: "행정부 -> 국회" → "○○○ -> ○○")
function generateAnswerHint(answers) {
    if (!answers || answers.length === 0) return '';
    const answer = answers[0];
    if (!answer || answer.length < 2) return '';

    // 특수 구조가 있는 경우에만 힌트 제공
    const hasStructure = /->|→|,|、|\(|\)|·|\/|&|\+/.test(answer)
        || (answer.includes(' ') && answer.split(' ').filter(w => w.length > 0).length >= 3);
    if (!hasStructure) return '';

    // 글자를 ○로 치환, 특수문자/공백/숫자/기호는 유지
    let hint = '';
    for (let ch of answer) {
        if (/[가-힣a-zA-Z]/.test(ch)) {
            hint += '○';
        } else {
            hint += ch;
        }
    }
    return hint;
}

async function joinGame() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    const name = document.getElementById('join-name').value.trim();
    if (!code || code.length < 4) { showToast('게임 코드를 입력해주세요'); return; }
    if (!name) { showToast('이름을 입력해주세요'); return; }

    const game = await getGameAsync(code);
    if (!game) { showToast('존재하지 않는 게임 코드입니다'); return; }
    if (game.status === 'finished') { showToast('이미 종료된 게임입니다'); return; }

    if (game.teamMode) {
        // 팀 버튼 동적 생성
        const teams = game.teams || [{ id:'0', name:'A팀', emoji:'🔴' }, { id:'1', name:'B팀', emoji:'🔵' }];
        const btnArea = document.getElementById('team-select-buttons');
        if (btnArea && btnArea.children.length === 0) {
            btnArea.innerHTML = teams.map(t =>
                `<button class="btn-team" id="tbtn-${t.id}" onclick="selectTeam('${t.id}','${t.emoji} ${t.name}')">${t.emoji} ${t.name}</button>`
            ).join('');
        }
        if (!selectedTeam) {
            document.getElementById('team-select-area').classList.remove('hidden');
            showToast('팀을 선택해주세요');
            return;
        }
    }

    myGameCode = code;
    myPlayerId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);
    myCurrentStage = 1;
    myWrongCount = 0;
    myStageCorrectCount = 0;
    myBonusPoints = 0;
    myBonusCorrectCount = 0;
    myConsecutiveWrong = 0;
    myStageAskedQuestions = [];
    myGlobalAskedQuestions = [];

    const playerData = {
        name, team: selectedTeam || '', currentStage: 1,
        wrongCount: 0, bonusPoints: 0, joinedAt: Date.now(), clearedAt: null
    };
    updatePlayerData(code, myPlayerId, playerData);

    document.getElementById('waiting-name').textContent = name;
    document.getElementById('waiting-team').textContent = selectedTeamLabel || '';
    showPage('page-student-waiting');

    // Listen for game state changes
    listenGame(code, (game) => {
        if (!game || !game.players || !game.players[myPlayerId]) {
            alert('방에서 내보내졌거나 게임이 종료되었습니다.');
            location.reload();
            return;
        }
        
        currentGameData = game;
        if (game.status === 'playing') {
            showPage('page-student-game');
            startStudentGame(game);
        } else if (game.status === 'finished') {
            showStudentComplete(game);
        }
    });
}

let selectedTeamLabel = '';
function selectTeam(teamId, label) {
    selectedTeam = teamId;
    selectedTeamLabel = label || teamId;
    document.querySelectorAll('.btn-team').forEach(b => b.classList.remove('selected'));
    const btn = document.getElementById('tbtn-' + teamId);
    if (btn) btn.classList.add('selected');
}

let gameStarted = false;
function startStudentGame(game) {
    if (gameStarted) return;
    gameStarted = true;
    currentGameData = game;
    const totalStages = game.stages.length;
    document.getElementById('stage-total-label').textContent = `/ ${totalStages}`;
    buildStageMap(totalStages);
    loadStageQuestion(game);
    startStudentTimer(game);
}

function buildStageMap(total) {
    const map = document.getElementById('stage-map');
    map.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        if (i > 1) {
            const conn = document.createElement('div');
            conn.className = 'stage-connector' + (i < myCurrentStage ? ' cleared' : '');
            conn.id = `conn-${i}`;
            map.appendChild(conn);
        }
        const node = document.createElement('div');
        node.className = 'stage-node' + (i === myCurrentStage ? ' active' : i < myCurrentStage ? ' cleared' : '');
        node.id = `node-${i}`;
        node.textContent = i;
        map.appendChild(node);
    }
}

function updateStageMap() {
    if (!currentGameData) return;
    const total = currentGameData.stages.length;
    for (let i = 1; i <= total; i++) {
        const node = document.getElementById(`node-${i}`);
        if (!node) continue;
        node.className = 'stage-node' + (i === myCurrentStage ? ' active' : i < myCurrentStage ? ' cleared' : '');
        if (i > 1) {
            const conn = document.getElementById(`conn-${i}`);
            if (conn) conn.className = 'stage-connector' + (i <= myCurrentStage ? ' cleared' : '');
        }
    }
}

function getUniqueRandomQuestion(questions) {
    if (!questions || questions.length === 0) return null;
    
    // 출제되지 않은 문제들만 필터링
    let pool = questions.filter(q => !myStageAskedQuestions.includes(q.text));
    
    // 만약 모든 문제가 다 한 번씩 나왔다면 (풀이 고갈) 풀 초기화
    if (pool.length === 0) {
        myStageAskedQuestions = [];
        pool = questions;
    }
    
    // 풀이 1개면 그거 반환
    if (pool.length === 1) {
        myStageAskedQuestions.push(pool[0].text);
        return pool[0];
    }
    
    // 풀이 여러 개면 이전 직전 문제와 안 겹치게 뽑기 (만약 풀에 있는게 모두 이전 문제랑 다르면 그냥 뽑음)
    let q;
    let attempts = 0;
    do {
        q = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
    } while (q.text === window._lastQuestionText && attempts < 10);
    
    myStageAskedQuestions.push(q.text);
    return q;
}

function loadStageQuestion(game) {
    if (!game) game = currentGameData;
    if (!game) return;
    const total = game.stages.length;
    
    let q;
    if (myCurrentStage > total) {
        document.getElementById('current-stage-label').textContent = `🔥 보너스 모드`;
        document.getElementById('stage-total-label').textContent = `(+${myBonusPoints}점)`;
        const allQuestions = game.stages.flatMap(s => s);
        
        // 1. 가급적 OX 문제 피하기
        let nonOx = allQuestions.filter(qst => qst.type !== 'ox');
        let basePool = nonOx.length > 0 ? nonOx : allQuestions;
        
        // 2. 가급적 정규 라운드에서 안 만났던 문제 우선
        let unseen = basePool.filter(qst => !myGlobalAskedQuestions.includes(qst.text));
        let targetPool = unseen.length > 0 ? unseen : basePool;
        
        q = getUniqueRandomQuestion(targetPool);
    } else {
        const stageQuestions = game.stages[myCurrentStage - 1];
        q = getUniqueRandomQuestion(stageQuestions);
        document.getElementById('current-stage-label').textContent = `스테이지 ${myCurrentStage}`;
        document.getElementById('stage-total-label').textContent = `(${myStageCorrectCount}/3)`;
    }
    
    // 출제 기록 전체 추적
    if (!myGlobalAskedQuestions.includes(q.text)) {
        myGlobalAskedQuestions.push(q.text);
    }
    
    window._lastQuestionText = q.text;
    document.getElementById('q-text').textContent = q.text;
    selectedChoice = -1;

    if (q.type === 'multiple' || q.type === 'ox') {
        const isOX = q.type === 'ox';
        document.getElementById('q-type-badge').textContent = isOX ? 'OX 퀴즈' : '객관식';
        document.getElementById('choices-area').classList.remove('hidden');
        document.getElementById('short-answer-area').classList.add('hidden');
        const btns = document.querySelectorAll('.choice-btn');
        btns.forEach((btn, i) => {
            if (isOX && i >= 2) {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
                btn.textContent = q.choices[i];
                btn.className = 'choice-btn' + (isOX ? ' ox-btn' : '');
                btn.disabled = false;
            }
        });
        window._currentQ = q;
    } else {
        document.getElementById('q-type-badge').textContent = '주관식';
        document.getElementById('choices-area').classList.add('hidden');
        document.getElementById('short-answer-area').classList.remove('hidden');
        const inputEl = document.getElementById('short-answer-input');
        inputEl.value = '';
        // 정답 형태 힌트 생성
        const hint = generateAnswerHint(q.answers);
        inputEl.placeholder = hint ? `힌트: ${hint}` : '정답을 입력하세요';
        inputEl.focus();
        window._currentQ = q;
    }
    document.getElementById('btn-submit-answer').disabled = false;
}

function selectChoice(idx) {
    selectedChoice = idx;
    document.querySelectorAll('.choice-btn').forEach((b, i) => {
        b.className = 'choice-btn' + (i === idx ? ' selected' : '');
    });
}

function submitAnswer() {
    const q = window._currentQ;
    if (!q) return;

    document.getElementById('btn-submit-answer').disabled = true;

    if (q.type === 'multiple' || q.type === 'ox') {
        if (selectedChoice === -1) { showToast('답을 선택해주세요'); document.getElementById('btn-submit-answer').disabled = false; return; }
        const correct = selectedChoice === q.answer;
        const studentAns = q.choices ? q.choices[selectedChoice] : String(selectedChoice);
        const correctAns = q.choices ? q.choices[q.answer] : String(q.answer);
        recordHistory(q, studentAns, correctAns, correct);
        showFeedback(correct);
    } else {
        const input = document.getElementById('short-answer-input').value.trim();
        if (!input) { showToast('답을 입력해주세요'); document.getElementById('btn-submit-answer').disabled = false; return; }

        // 1차: 유연 채점 (오타/조사/키워드)
        const localCorrect = q.answers.some(a => fuzzyMatch(input, a));
        if (localCorrect) {
            recordHistory(q, input, q.answers[0], true);
            showFeedback(true);
            return;
        }

        // 2차: AI 채점 시도 (API 키가 있고 게임 중인 경우)
        const longestAnswer = q.answers.reduce((a, b) => a.length > b.length ? a : b, '');
        const hasApiKey = !!localStorage.getItem('gemini_api_key');
        if (myGameCode && dbReady && hasApiKey) {
            window._pendingHistory = { q, studentAnswer: input, correctAnswer: longestAnswer };
            requestAiGrading(q.text, longestAnswer, input);
            return;
        }

        // API 키 없으면 오답 처리
        recordHistory(q, input, q.answers[0], false);
        showFeedback(false);
    }
}

function requestAiGrading(question, correctAnswer, studentAnswer) {
    const gradeId = myPlayerId + '_' + Date.now();
    // Firebase에 채점 요청 올리기
    db.ref('games/' + myGameCode + '/pendingGrades/' + gradeId).set({
        question, correctAnswer, studentAnswer, timestamp: Date.now()
    });

    // 채점 결과 대기 (최대 8초)
    showToast('🤖 AI 채점 중...');
    const resultRef = db.ref('games/' + myGameCode + '/gradeResults/' + gradeId);
    let resolved = false;
    const timeout = setTimeout(() => {
        if (!resolved) {
            resolved = true;
            resultRef.off();
            // 타임아웃: 기본 채점으로 처리 (오답)
            showFeedback(false);
        }
    }, 8000);

    resultRef.on('value', (snap) => {
        const result = snap.val();
        if (result && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            resultRef.off();
            resultRef.remove();
            // AI 선채점 이력 기록
            if (window._pendingHistory) {
                const ph = window._pendingHistory;
                recordHistory(ph.q, ph.studentAnswer, ph.correctAnswer, result.correct);
                window._pendingHistory = null;
            }
            showFeedback(result.correct);
        }
    });
}

// ---- 유연한 채점 시스템 ----
function fuzzyMatch(input, answer) {
    // 1. 정규화: 소문자, 공백 제거
    const norm = s => s.toLowerCase().replace(/\s/g, '');
    if (norm(input) === norm(answer)) return true;

    // 2. 조사 제거 후 비교
    const stripParticles = s => s.replace(/[은는이가을를의와과에서로부터도만까지보다처럼같이]$/g, '').replace(/[은는이가을를의와과에서]$/g, '');
    const ni = norm(stripParticles(input));
    const na = norm(stripParticles(answer));
    if (ni === na) return true;

    // 3. 짧은 답(5자 이하): 편집거리 1 허용
    if (na.length <= 5) {
        if (editDistance(ni, na) <= 1) return true;
    }

    // 4. 중간 답(6~15자): 편집거리 2 허용
    if (na.length > 5 && na.length <= 15) {
        if (editDistance(ni, na) <= 2) return true;
    }

    // 5. 긴 답(15자 초과): 핵심 키워드 포함 여부 (70% 이상)
    if (answer.length > 15) {
        const keywords = extractKeywords(answer);
        if (keywords.length > 0) {
            const inputLower = input.toLowerCase();
            const matched = keywords.filter(kw => inputLower.includes(kw));
            if (matched.length / keywords.length >= 0.7) return true;
        }
    }

    // 6. 입력이 정답을 포함하거나 정답이 입력을 포함
    if (ni.length >= 2 && na.length >= 2) {
        if (ni.includes(na) || na.includes(ni)) return true;
    }

    return false;
}

// 편집거리 (Levenshtein Distance)
function editDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i-1] === a[j-1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost);
        }
    }
    return matrix[b.length][a.length];
}

// 핵심 키워드 추출 (2글자 이상 명사 추출)
function extractKeywords(text) {
    const stopWords = ['하는','하다','하여','위해','위한','것이다','있는','없는','있도록','수','것','할','이루게','한다','한','된다','않도록','대한','대해','통해','따라'];
    const words = text.replace(/[.,!?()]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    return words.filter(w => !stopWords.includes(w)).map(w => w.toLowerCase());
}

function recordHistory(q, studentAnswer, correctAnswer, correct) {
    answerHistory.push({
        stage: myCurrentStage,
        questionText: q.text,
        studentAnswer,
        correctAnswer,
        correct
    });
}

function showFeedback(correct) {
    const overlay = document.getElementById('feedback-overlay');
    const content = document.getElementById('feedback-content');
    overlay.classList.remove('hidden');

    const totalStages = currentGameData ? currentGameData.stages.length : 0;
    const isBonusMode = myCurrentStage > totalStages;

    if (correct) {
        if (isBonusMode) {
            myBonusCorrectCount++;
            if (myBonusCorrectCount >= 3) {
                myBonusCorrectCount = 0;
                myBonusPoints++;
                content.className = 'feedback-content fb-correct';
                content.innerHTML = '<div class="fb-icon">🔥</div><div class="fb-text">보너스 득점!</div><div class="fb-sub">+1점 획득!</div>';
            } else {
                content.className = 'feedback-content fb-correct';
                content.innerHTML = `<div class="fb-icon">🎉</div><div class="fb-text">정답!</div><div class="fb-sub">보너스 진행도: ${myBonusCorrectCount}/3</div>`;
            }
        } else {
            myStageCorrectCount++;
            if (myStageCorrectCount >= 3) {
                myStageCorrectCount = 0;
                myCurrentStage++;
                myStageAskedQuestions = [];
                content.className = 'feedback-content fb-correct';
                content.innerHTML = '<div class="fb-icon">🎉</div><div class="fb-text">정답!</div><div class="fb-sub">다음 스테이지로!</div>';
            } else {
                content.className = 'feedback-content fb-correct';
                content.innerHTML = `<div class="fb-icon">🎉</div><div class="fb-text">정답!</div><div class="fb-sub">진행도: ${myStageCorrectCount}/3</div>`;
            }
        }
        updatePlayerData(myGameCode, myPlayerId, { currentStage: myCurrentStage, bonusPoints: myBonusPoints });
    } else {
        myWrongCount++;
        myConsecutiveWrong++;
        content.className = 'feedback-content fb-wrong';
        
        if (myConsecutiveWrong >= 2) {
            myConsecutiveWrong = 0;
            if (isBonusMode) {
                myBonusCorrectCount = 0;
                content.innerHTML = '<div class="fb-icon">😢</div><div class="fb-text">오답! (2회 누적)</div><div class="fb-sub">보너스 득점 진행도가 초기화됩니다!</div>';
            } else if (myCurrentStage > 1) {
                myCurrentStage--;
                myStageCorrectCount = 0;
                myBonusCorrectCount = 0;
                myStageAskedQuestions = [];
                content.innerHTML = '<div class="fb-icon">😢</div><div class="fb-text">오답! (2회 누적)</div><div class="fb-sub">1단계 뒤로 강등...</div>';
            } else {
                myStageCorrectCount = 0;
                content.innerHTML = '<div class="fb-icon">😢</div><div class="fb-text">오답! (2회 누적)</div><div class="fb-sub">여기가 첫 단계입니다</div>';
            }
        } else {
            content.innerHTML = '<div class="fb-icon">⚠️</div><div class="fb-text">오답!</div><div class="fb-sub">한 번 더 틀리면 강등됩니다!</div>';
        }
        updatePlayerData(myGameCode, myPlayerId, { currentStage: myCurrentStage, wrongCount: myWrongCount, bonusPoints: myBonusPoints });
    }

    setTimeout(() => {
        overlay.classList.add('hidden');
        updateStageMap();
        if (currentGameData) loadStageQuestion(currentGameData);
    }, 1500);
}

function startStudentTimer(game) {
    if (studentTimerInterval) clearInterval(studentTimerInterval);
    const timerEl = document.getElementById('student-timer');
    studentTimerInterval = setInterval(() => {
        const g = currentGameData || game;
        if (!g || !g.startedAt) return;
        const remaining = Math.max(0, g.timer - Math.floor((Date.now() - g.startedAt) / 1000));
        const m = Math.floor(remaining / 60), s = remaining % 60;
        timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        timerEl.className = 'game-timer' + (remaining < 30 ? ' danger' : remaining < 60 ? ' warning' : '');
        if (remaining <= 0) { clearInterval(studentTimerInterval); showStudentComplete(g); }
    }, 500);
}

function showStudentComplete(game) {
    if (studentTimerInterval) clearInterval(studentTimerInterval);
    showPage('page-student-complete');
    const total = game ? game.stages.length : 0;
    const cleared = myCurrentStage > total;
    const el = document.getElementById('complete-content');

    // 기본 결과
    const pts = Math.min(myCurrentStage - 1, total) + myBonusPoints;
    const resultHtml = cleared
        ? `<div class="trophy">🔥</div><h2>보너스 모드 종료!</h2><p class="clear-time">최종 점수: ${pts}점</p><p class="clear-stats">오답 수: ${myWrongCount}</p>`
        : `<div class="trophy">⏰</div><h2>시간 종료!</h2><p class="clear-time">스테이지 ${myCurrentStage-1}/${total} 도달</p><p class="clear-stats">오답 수: ${myWrongCount}</p>`;

    if (cleared && !currentGameData?.players?.[myPlayerId]?.clearedAt) {
        updatePlayerData(myGameCode, myPlayerId, { clearedAt: Date.now() });
    }

    // 봅습 이력 (answerHistory가 있을 경우)
    let reviewHtml = '';
    if (answerHistory.length > 0) {
        const rows = answerHistory.map((h, i) => {
            const icon = h.correct ? '✅' : '❌';
            const wrongRow = !h.correct
                ? `<div class="review-correct">정답: <strong>${escSafe(h.correctAnswer)}</strong></div>` : '';
            return `<div class="review-item ${h.correct ? 'review-ok' : 'review-ng'}">
                <div class="review-header">${icon} <span class="review-stage">스테이지 ${h.stage}</span></div>
                <div class="review-q">${escSafe(h.questionText)}</div>
                <div class="review-my">내 답: <strong>${escSafe(h.studentAnswer)}</strong></div>
                ${wrongRow}
            </div>`;
        }).join('');
        reviewHtml = `
            <div class="review-section">
                <h3>📝 답안 복습</h3>
                <div class="review-list">${rows}</div>
            </div>`;
    }

    el.innerHTML = resultHtml + reviewHtml;
}

function escSafe(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
