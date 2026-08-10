// ═══════════════════════════════════════════════════════════
// DATA LAYER — localStorage
// ═══════════════════════════════════════════════════════════
// Firebase real-time data will populate window.db

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function monthKey(date) {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${months[parseInt(m)-1]} ${y}`;
}

function currentMonthKey() { return monthKey(new Date()); }

function formatRupiah(n) {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function uid() { return Math.random().toString(36).slice(2,10); }

const AVATAR_COLORS = [
  'linear-gradient(135deg,#6c63ff,#a78bfa)',
  'linear-gradient(135deg,#22c55e,#4ade80)',
  'linear-gradient(135deg,#f87171,#fb923c)',
  'linear-gradient(135deg,#38bdf8,#818cf8)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#ec4899,#a78bfa)'
];

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let currentMemberId = null;

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: '💬' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ═══════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ═══════════════════════════════════════════════════════════
// HOME SCREEN — PILIH ANGGOTA
// ═══════════════════════════════════════════════════════════
function renderHome() {
  const db = typeof loadDB === 'function' ? loadDB() : null;
  if (!db) return; // Wait for Firebase data

  const mk = currentMonthKey();

  document.getElementById('current-month-label').textContent = monthLabel(mk).toUpperCase();
  document.title = db.settings.groupName || 'Kas Bareng';

  const grid = document.getElementById('member-grid');
  if (!db.members.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">Belum ada anggota</div>
        <div class="empty-state-sub">Masuk sebagai admin untuk tambah anggota</div>
      </div>`;
    return;
  }

  grid.innerHTML = db.members.map(m => {
    const payKey = `${m.id}_${mk}`;
    const pay = db.payments[payKey];
    const status = pay ? pay.status : 'unpaid';
    const statusMap = {
      paid: { label: 'Lunas', cls: 'status-paid', ind: 'paid-indicator' },
      pending: { label: 'Verifikasi', cls: 'status-pending', ind: 'unpaid-indicator' },
      rejected: { label: 'Ditolak', cls: 'status-unpaid', ind: 'unpaid-indicator' },
      unpaid: { label: 'Belum Bayar', cls: 'status-unpaid', ind: 'unpaid-indicator' }
    };
    const s = statusMap[status] || statusMap.unpaid;
    return `
      <button class="member-btn ${s.ind}" onclick="openMemberLogin('${m.id}')">
        <div class="member-avatar" style="background:${m.color}">${initials(m.name)}</div>
        <div class="member-name">${m.name}</div>
        <div class="member-status ${s.cls}">${s.label}</div>
      </button>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// MEMBER LOGIN — lalu diarahkan ke user/index.html
// ═══════════════════════════════════════════════════════════
function openMemberLogin(memberId) {
  const db = loadDB();
  const member = db.members.find(m => m.id === memberId);
  if (!member) return;

  currentMemberId = memberId;
  document.getElementById('login-modal-name').textContent = `Halo, ${member.name}! 👋`;
  document.getElementById('member-pw-input').value = '';
  openModal('modal-member-login');
  setTimeout(() => document.getElementById('member-pw-input').focus(), 100);
}

function loginMember() {
  const db = loadDB();
  const member = db.members.find(m => m.id === currentMemberId);
  const pw = document.getElementById('member-pw-input').value;

  if (!member) return;
  if (pw !== member.password) {
    showToast('Password salah!', 'error');
    document.getElementById('member-pw-input').value = '';
    return;
  }

  // Simpan sesi anggota lalu pindah ke halaman user
  sessionStorage.setItem('kas_member_id', member.id);
  window.location.href = 'user/index.html';
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
window.initApp = function() {
  renderHome();
};

window.onDBUpdate = function() {
  renderHome();
};

// Fallback jika firebase error/diblokir, load setelah 3 detik
setTimeout(() => {
  if (!document.getElementById('member-grid').innerHTML.trim()) {
    document.getElementById('current-month-label').textContent = 'KONEKSI DATABASE GAGAL';
  }
}, 3000);
