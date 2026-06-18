// ===== app.js - 메인 앱 로직 =====

// ---- Page Navigation ----
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
}

// ---- Toast Notification ----
function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ---- Particle Effects ----
const particleCanvas = document.getElementById('particle-canvas');
const pCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
let particles = [];
let particleAnimId = null;

function resizeCanvas() {
    if (!particleCanvas) return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnParticles(color, count = 50) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 3 + Math.random() * 5,
            color: color,
            life: 1,
            decay: 0.01 + Math.random() * 0.02
        });
    }
    if (!particleAnimId) animateParticles();
}

function animateParticles() {
    if (!pCtx) return;
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= p.decay;
        pCtx.globalAlpha = p.life;
        pCtx.fillStyle = p.color;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
    });
    pCtx.globalAlpha = 1;
    if (particles.length > 0) {
        particleAnimId = requestAnimationFrame(animateParticles);
    } else {
        particleAnimId = null;
    }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    // Add initial stages for teacher
    if (document.getElementById('stages-container')) {
        addStage();
        addStage();
        addStage();
    }
});

// ---- Help Modal ----
function openHelp(tab) {
    document.getElementById('help-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    switchHelpTab(tab || 'teacher');
}
function closeHelp() {
    document.getElementById('help-modal').style.display = 'none';
    document.body.style.overflow = '';
}
function switchHelpTab(tab) {
    const isTeacher = tab === 'teacher';
    document.getElementById('help-teacher').style.display = isTeacher ? 'block' : 'none';
    document.getElementById('help-student').style.display = isTeacher ? 'none' : 'block';
    document.getElementById('help-tab-teacher').style.cssText = isTeacher
        ? 'flex:1;padding:16px;background:rgba(123,97,255,.2);border:none;color:#a78bfa;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;'
        : 'flex:1;padding:16px;background:none;border:none;color:#666;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
    document.getElementById('help-tab-student').style.cssText = isTeacher
        ? 'flex:1;padding:16px;background:none;border:none;color:#666;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;'
        : 'flex:1;padding:16px;background:rgba(123,97,255,.2);border:none;color:#a78bfa;font-size:15px;font-weight:700;cursor:pointer;font-family:"Noto Sans KR",sans-serif;';
}
// 모달 바깥 클릭 시 닫기
document.addEventListener('click', (e) => {
    const modal = document.getElementById('help-modal');
    if (modal && e.target === modal) closeHelp();
});
