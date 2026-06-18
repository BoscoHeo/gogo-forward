// ===== storage.js - Firebase Realtime Database 기반 데이터 관리 =====

let db = null;
let dbReady = false;
const listeners = [];

// Initialize Firebase
function initFirebase() {
    try {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        dbReady = true;
        console.log('✅ Firebase connected');
    } catch (e) {
        console.error('Firebase init error:', e);
        showToast('⚠️ 서버 연결 실패. 로컬 모드로 동작합니다.');
    }
}

// ---- Game CRUD ----
function saveGame(code, data) {
    if (!dbReady) { localStorage.setItem('game_' + code, JSON.stringify(data)); return; }
    db.ref('games/' + code).set(data);
}

function getGame(code) {
    // For synchronous access, use cached data
    const cached = window._gameCache && window._gameCache[code];
    return cached || null;
}

// Async version
async function getGameAsync(code) {
    if (!dbReady) {
        const d = localStorage.getItem('game_' + code);
        return d ? JSON.parse(d) : null;
    }
    const snap = await db.ref('games/' + code).once('value');
    return snap.val();
}

function listenGame(code, callback) {
    if (!dbReady) return;
    db.ref('games/' + code).on('value', (snap) => {
        const data = snap.val();
        if (data) {
            if (!window._gameCache) window._gameCache = {};
            window._gameCache[code] = data;
            callback(data);
        }
    });
}

function updateGameField(code, path, value) {
    if (!dbReady) return;
    db.ref('games/' + code + '/' + path).set(value);
}

function updatePlayerData(code, playerId, data) {
    if (!dbReady) return;
    db.ref('games/' + code + '/players/' + playerId).update(data);
}

// ---- Teacher CRUD ----
async function saveTeacher(teacherCode, data) {
    if (!dbReady) { localStorage.setItem('teacher_' + teacherCode, JSON.stringify(data)); return; }
    await db.ref('teachers/' + teacherCode).set(data);
}

async function getTeacher(teacherCode) {
    if (!dbReady) {
        const d = localStorage.getItem('teacher_' + teacherCode);
        return d ? JSON.parse(d) : null;
    }
    const snap = await db.ref('teachers/' + teacherCode).once('value');
    return snap.val();
}

// ---- Question Sets (Shared Library) ----
async function saveQuestionSet(data) {
    if (!dbReady) return null;
    const ref = db.ref('questionSets').push();
    data.id = ref.key;
    data.createdAt = Date.now();
    await ref.set(data);
    return ref.key;
}

async function getQuestionSets(filters = {}) {
    if (!dbReady) return [];
    let ref = db.ref('questionSets').orderByChild('createdAt').limitToLast(50);
    const snap = await ref.once('value');
    const sets = [];
    snap.forEach(child => {
        sets.push(child.val());
    });
    sets.reverse(); // newest first

    // Client-side filtering
    if (filters.grade) {
        return sets.filter(s => s.grade === filters.grade);
    }
    if (filters.subject) {
        return sets.filter(s => s.subject === filters.subject);
    }
    return sets;
}

async function getQuestionSet(setId) {
    if (!dbReady) return null;
    const snap = await db.ref('questionSets/' + setId).once('value');
    return snap.val();
}

async function incrementUseCount(setId) {
    if (!dbReady) return;
    const ref = db.ref('questionSets/' + setId + '/useCount');
    ref.transaction(current => (current || 0) + 1);
}

async function deleteQuestionSet(setId) {
    if (!dbReady) return;
    await db.ref('questionSets/' + setId).remove();
}

// ---- Code Generation ----
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function generateTeacherCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'T';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// ---- Broadcast (for same-device tabs) ----
let broadcastChannel = null;
try {
    broadcastChannel = new BroadcastChannel('gogo-forward');
} catch(e) {}

function broadcast(type, data) {
    if (broadcastChannel) {
        broadcastChannel.postMessage({ type, ...data });
    }
}

function onBroadcast(callback) {
    listeners.push(callback);
    if (broadcastChannel) {
        broadcastChannel.onmessage = (e) => {
            listeners.forEach(cb => cb(e.data));
        };
    }
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});
