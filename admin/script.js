// ═══════════════════════════════════════════════════════════
// DATA LAYER — Firebase (via firebase.js)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function monthKey(date) {
  return date.toISOString().slice(0, 7);
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
let verifyTarget = null; // { memberId, monthKey }

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
// NAVIGASI & MODAL
// ═══════════════════════════════════════════════════════════
function goHome() { window.location.href = '../index.html'; }

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this && el.id !== 'modal-admin-login') this.classList.remove('open');
  });
});

// ═══════════════════════════════════════════════════════════
// ADMIN LOGIN — wajib sebelum dashboard dirender
// ═══════════════════════════════════════════════════════════
function loginAdmin() {
  const db = loadDB();
  const pw = document.getElementById('admin-pw-input').value;
  if (pw !== db.settings.adminPassword) {
    showToast('Password admin salah!', 'error');
    document.getElementById('admin-pw-input').value = '';
    return;
  }
  closeModal('modal-admin-login');
  sessionStorage.setItem('kas_admin_logged', 'true');
  renderAdminDashboard();
}

// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderAdminDashboard() {
  const db = loadDB();
  const mk = currentMonthKey();

  // Stats
  const totalMembers = db.members.length;
  const paidCount = db.members.filter(m => db.payments[`${m.id}_${mk}`]?.status === 'paid').length;
  const pendingCount = db.members.filter(m => db.payments[`${m.id}_${mk}`]?.status === 'pending').length;
  const amount = db.settings.amount || 20000;
  const allTimePaidCount = Object.values(db.payments).filter(pay => pay.status === 'paid').length;
  const totalCollected = allTimePaidCount * amount;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card">
      <div class="stat-value text-green">${paidCount}</div>
      <div class="stat-label">✅ Sudah Bayar</div>
    </div>
    <div class="stat-card">
      <div class="stat-value text-yellow">${pendingCount}</div>
      <div class="stat-label">🔍 Menunggu</div>
    </div>
    <div class="stat-card">
      <div class="stat-value text-red">${totalMembers - paidCount - pendingCount}</div>
      <div class="stat-label">❌ Belum Bayar</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="font-size:18px;color:var(--accent2)">${formatRupiah(totalCollected)}</div>
      <div class="stat-label">💰 Terkumpul</div>
    </div>`;

  document.getElementById('admin-month-tag').textContent = monthLabel(mk);

  // Overview list
  const overviewEl = document.getElementById('admin-overview-list');
  overviewEl.innerHTML = db.members.map(m => {
    const payKey = `${m.id}_${mk}`;
    const pay = db.payments[payKey];
    const status = pay?.status || 'unpaid';
    const statusMap = {
      paid: ['chip-green', '✅ Lunas', `<button class="btn btn-sm btn-ghost" onclick="openVerify('${m.id}','${mk}')" style="margin-left:8px">Lihat</button>`],
      pending: ['chip-yellow', '🔍 Menunggu', `<button class="btn btn-sm btn-ghost" onclick="openVerify('${m.id}','${mk}')" style="margin-left:8px">Periksa</button>`],
      rejected: ['chip-red', '❌ Ditolak', ''],
      unpaid: ['chip-red', '⏳ Belum Bayar', '']
    };
    const [cls, label, action] = statusMap[status] || statusMap.unpaid;
    return `
      <div class="history-item" style="margin-bottom:8px; cursor:pointer;" onclick="openVerify('${m.id}','${mk}')">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="nav-avatar" style="background:${m.color};width:32px;height:32px;font-size:12px">${initials(m.name)}</div>
          <span class="font-bold">${m.name}</span>
        </div>
        <div style="display:flex;align-items:center">
          <span class="chip ${cls}">${label}</span>${action}
        </div>
      </div>`;
  }).join('') || `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-sub">Belum ada anggota</div></div>`;

  // Progress
  const pct = totalMembers ? Math.round(paidCount / totalMembers * 100) : 0;
  document.getElementById('admin-progress').style.width = pct + '%';
  document.getElementById('admin-progress-text').textContent = `${paidCount}/${totalMembers} sudah bayar`;
  document.getElementById('admin-progress-pct').textContent = pct + '%';

  // Members table
  renderMemberTable();

  // Settings
  document.getElementById('setting-amount').value = db.settings.amount || '';
  document.getElementById('setting-group-name').value = db.settings.groupName || '';
  document.getElementById('setting-qris-name').value = db.settings.qrisName || '';
  if (db.settings.qrisImage) {
    const prev = document.getElementById('qris-preview-admin');
    prev.src = db.settings.qrisImage;
    prev.style.display = 'block';
  }
  const groqStatus = document.getElementById('groq-status');
  groqStatus.textContent = db.settings.groqKey ? '✅ API key tersimpan' : '⚠️ Belum diatur';
}

function renderMemberTable() {
  const db = loadDB();
  const mk = currentMonthKey();
  const tbody = document.getElementById('admin-member-tbody');

  if (!db.members.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="padding:40px;text-align:center">Belum ada anggota</td></tr>`;
    return;
  }

  tbody.innerHTML = db.members.map(m => {
    const payKey = `${m.id}_${mk}`;
    const pay = db.payments[payKey];
    const status = pay?.status || 'unpaid';
    const statusMap = {
      paid: ['chip-green', '✅ Lunas'],
      pending: ['chip-yellow', '🔍 Menunggu'],
      rejected: ['chip-red', '❌ Ditolak'],
      unpaid: ['chip-red', '⏳ Belum Bayar']
    };
    const [cls, label] = statusMap[status] || statusMap.unpaid;
    const totalPaid = Object.keys(db.payments).filter(k => k.startsWith(m.id + '_') && db.payments[k].status === 'paid').length;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="nav-avatar" style="background:${m.color};width:32px;height:32px;font-size:12px">${initials(m.name)}</div>
            <span class="font-bold">${m.name}</span>
          </div>
        </td>
        <td><span class="chip ${cls}">${label}</span></td>
        <td class="text-mono">${totalPaid} bulan</td>
        <td>
          <div class="action-btns" style="gap: 4px;">
            ${status === 'paid' ? `<button class="btn btn-sm btn-ghost" title="Lihat Bukti" onclick="openVerify('${m.id}','${mk}')" style="padding:6px 10px;">👁️</button>` : ''}
            ${status === 'pending' ? `<button class="btn btn-sm btn-ghost" title="Periksa" onclick="openVerify('${m.id}','${mk}')" style="padding:6px 10px;">🔍</button>` : ''}
            ${status === 'paid' ? `<button class="btn btn-sm btn-ghost" title="Batalkan" onclick="togglePaid('${m.id}','${mk}',false)" style="padding:6px 10px;">↩️</button>` : ''}
            ${(status === 'unpaid' || status === 'rejected') ? `<button class="btn btn-sm btn-ghost" title="Tandai Lunas" onclick="togglePaid('${m.id}','${mk}',true)" style="padding:6px 10px;">✅</button>` : ''}
            <button class="btn btn-sm btn-ghost" title="Edit" onclick="editMember('${m.id}')" style="padding:6px 10px;">✏️</button>
            <button class="btn btn-sm btn-danger" title="Hapus" onclick="deleteMember('${m.id}')" style="padding:6px 10px;">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// VERIFY PAYMENT
// ═══════════════════════════════════════════════════════════
function openVerify(memberId, mk) {
  const db = loadDB();
  const member = db.members.find(m => m.id === memberId);
  const payKey = `${memberId}_${mk}`;
  const pay = db.payments[payKey];
  if (!pay) return;

  verifyTarget = { memberId, monthKey: mk };
  const isPaid = pay.status === 'paid';

  document.getElementById('verify-modal-title').textContent = isPaid ? 'Detail Pembayaran' : 'Verifikasi Pembayaran';
  
  let subText = `<b>${member?.name}</b> — ${monthLabel(mk)}<br>`;
  if (pay.date) subText += `<small style="color:var(--muted)">Tanggal: ${pay.date}</small><br>`;
  subText += `<small style="color:var(--muted)">AI: ${pay.aiNote || '-'}</small>`;
  document.getElementById('verify-modal-sub').innerHTML = subText;

  const img = document.getElementById('verify-modal-img');
  img.src = pay.imageData || '';
  img.style.display = pay.imageData ? 'block' : 'none';

  // Month select (allow changing which month to credit)
  const sel = document.getElementById('verify-month-select');
  const now = new Date();
  sel.innerHTML = [-2,-1,0].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const k = monthKey(d);
    return `<option value="${k}" ${k === mk ? 'selected' : ''}>${monthLabel(k)}</option>`;
  }).join('');

  document.getElementById('verify-month-group').style.display = isPaid ? 'none' : 'block';
  document.getElementById('verify-action-btns').style.display = isPaid ? 'none' : 'flex';

  openModal('modal-verify');
}

function approvePayment() {
  if (!verifyTarget) return;
  const db = loadDB();
  const payKey = `${verifyTarget.memberId}_${verifyTarget.monthKey}`;
  const selectedMonth = document.getElementById('verify-month-select').value;
  const newKey = `${verifyTarget.memberId}_${selectedMonth}`;

  const payData = db.payments[payKey] || {};
  db.payments[newKey] = { ...payData, status: 'paid', date: new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) };
  if (newKey !== payKey) delete db.payments[payKey];

  saveDB(db);
  closeModal('modal-verify');
  showToast('✅ Pembayaran disetujui!', 'success');
  renderAdminDashboard();
}

function rejectPayment() {
  if (!verifyTarget) return;
  const db = loadDB();
  const payKey = `${verifyTarget.memberId}_${verifyTarget.monthKey}`;
  if (db.payments[payKey]) db.payments[payKey].status = 'rejected';
  saveDB(db);
  closeModal('modal-verify');
  showToast('❌ Pembayaran ditolak', 'error');
  renderAdminDashboard();
}

function togglePaid(memberId, mk, paid) {
  const db = loadDB();
  const payKey = `${memberId}_${mk}`;
  if (paid) {
    db.payments[payKey] = { status: 'paid', date: new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}), aiNote: 'Manual admin' };
  } else {
    if (db.payments[payKey]) delete db.payments[payKey];
  }
  saveDB(db);
  renderAdminDashboard();
  showToast(paid ? '✅ Ditandai lunas' : '↩️ Dibatalkan', paid ? 'success' : 'info');
}

// ═══════════════════════════════════════════════════════════
// ADD / EDIT MEMBER
// ═══════════════════════════════════════════════════════════
function openAddMember() {
  document.getElementById('add-member-modal-title').textContent = 'Tambah Anggota';
  document.getElementById('add-member-modal-sub').textContent = 'Isi data anggota baru';
  document.getElementById('save-member-btn').textContent = 'Tambah';
  document.getElementById('new-member-name').value = '';
  document.getElementById('new-member-pw').value = '';
  document.getElementById('new-member-color').value = AVATAR_COLORS[0];
  document.getElementById('edit-member-id').value = '';
  openModal('modal-add-member');
}

function editMember(memberId) {
  const db = loadDB();
  const m = db.members.find(m => m.id === memberId);
  if (!m) return;

  document.getElementById('add-member-modal-title').textContent = 'Edit Anggota';
  document.getElementById('add-member-modal-sub').textContent = `Edit data untuk ${m.name}`;
  document.getElementById('save-member-btn').textContent = 'Simpan';
  document.getElementById('new-member-name').value = m.name;
  document.getElementById('new-member-pw').value = m.password;
  document.getElementById('new-member-color').value = m.color || AVATAR_COLORS[0];
  document.getElementById('edit-member-id').value = memberId;
  openModal('modal-add-member');
}

function saveMember() {
  const name = document.getElementById('new-member-name').value.trim();
  const pw = document.getElementById('new-member-pw').value;
  const color = document.getElementById('new-member-color').value;
  const editId = document.getElementById('edit-member-id').value;

  if (!name) { showToast('Nama tidak boleh kosong', 'error'); return; }
  if (!pw || pw.length < 4) { showToast('Password minimal 4 karakter', 'error'); return; }

  const db = loadDB();

  if (editId) {
    const idx = db.members.findIndex(m => m.id === editId);
    if (idx >= 0) {
      db.members[idx] = { ...db.members[idx], name, password: pw, color };
      showToast(`✅ Data ${name} diperbarui`, 'success');
    }
  } else {
    db.members.push({ id: uid(), name, password: pw, color });
    showToast(`✅ Anggota ${name} ditambahkan`, 'success');
  }

  saveDB(db);
  closeModal('modal-add-member');
  renderAdminDashboard();
}

function deleteMember(memberId) {
  const db = loadDB();
  const m = db.members.find(m => m.id === memberId);
  if (!m) return;
  if (!confirm(`Hapus anggota "${m.name}"? Data pembayarannya juga akan dihapus.`)) return;

  db.members = db.members.filter(m => m.id !== memberId);
  Object.keys(db.payments).filter(k => k.startsWith(memberId + '_')).forEach(k => delete db.payments[k]);

  saveDB(db);
  renderAdminDashboard();
  showToast(`🗑️ ${m.name} dihapus`, 'info');
}

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
function saveSetting(key, value) {
  const db = loadDB();
  if (key === 'amount') db.settings.amount = Number(value);
  else db.settings[key] = value;
  saveDB(db);

  if (key === 'groqKey') {
    document.getElementById('groq-status').textContent = value ? '✅ API key tersimpan' : '⚠️ Belum diatur';
  }
}

function openGroqModal() {
  const db = loadDB();
  document.getElementById('setting-groq-key-input').value = db.settings.groqKey || '';
  openModal('modal-groq-key');
}

function saveGroqKey() {
  const key = document.getElementById('setting-groq-key-input').value;
  saveSetting('groqKey', key);
  closeModal('modal-groq-key');
  showToast('✅ API Key berhasil disimpan', 'success');
}

function changeAdminPassword() {
  const newPw = document.getElementById('setting-admin-pw').value;
  if (!newPw || newPw.length < 4) { showToast('Password minimal 4 karakter', 'error'); return; }
  const db = loadDB();
  db.settings.adminPassword = newPw;
  saveDB(db);
  document.getElementById('setting-admin-pw').value = '';
  showToast('✅ Password admin diperbarui', 'success');
}

function uploadQRIS(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const db = loadDB();
    db.settings.qrisImage = e.target.result;
    saveDB(db);
    const prev = document.getElementById('qris-preview-admin');
    prev.src = e.target.result;
    prev.style.display = 'block';
    showToast('✅ QRIS berhasil diupload', 'success');
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => {
    b.classList.toggle('active', ['overview','members','settings'][i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
}

// ═══════════════════════════════════════════════════════════
// AI WHATSAPP REMINDER
// ═══════════════════════════════════════════════════════════
function openWAReminderModal() {
  const db = loadDB();
  if (!db.settings.groqKey) {
    showToast('⚠️ Silakan atur Groq API Key terlebih dahulu di tab Pengaturan', 'error');
    return;
  }
  
  document.getElementById('wa-reminder-content').innerHTML = `
    <div class="empty-state" style="padding:10px;">
      <button class="btn btn-primary" onclick="generateWAReminder()">Generate Teks Sekarang ✨</button>
    </div>
  `;
  openModal('modal-wa-reminder');
}

async function generateWAReminder() {
  const db = loadDB();
  const mk = currentMonthKey();
  
  const unpaidMembers = db.members.filter(m => {
    const pay = db.payments[`${m.id}_${mk}`];
    return !pay || pay.status === 'unpaid' || pay.status === 'rejected';
  });
  
  if (unpaidMembers.length === 0) {
    document.getElementById('wa-reminder-content').innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-title">Semua Lunas!</div>
        <div class="empty-state-sub">Tidak ada anggota yang perlu ditagih bulan ini.</div>
      </div>
    `;
    return;
  }
  
  const names = unpaidMembers.map(m => m.name).join(', ');
  const amount = formatRupiah(db.settings.amount || 20000);
  const month = monthLabel(mk);
  const groupName = db.settings.groupName || 'Kas Bareng';
  
  const prompt = `Buatkan pesan WhatsApp untuk menagih uang kas ke grup ${groupName}.
Bulan tagihan: ${month}
Nominal per orang: ${amount}
Daftar anak yang belum bayar: ${names}

Syarat pesan WAJIB:
- Buka chat dengan sapaan "Hai MANGKOK AYAM" atau "Halo MANGKOK AYAM" (WAJIB sebut MANGKOK AYAM).
- Gunakan nada menyindir yang lucu dan asik, contoh getaran nadanya: "katanya mau jalan-jalan, tapi ogah bayar kas yee sempak".
- Sebutkan nama-nama yang belum bayar dengan jelas.
- Ingatkan mereka untuk bayar dan upload bukti ke web.
- Jangan terlalu kaku, gunakan bahasa tongkrongan.
- Jangan berikan basa-basi pembuka seperti "Tentu, ini pesannya", langsung berikan isi pesannya saja.`;

  document.getElementById('wa-reminder-content').innerHTML = `
    <div style="text-align:center; padding:30px;">
      <div style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;margin-bottom:12px;"></div>
      <div style="font-size:13px; color:var(--muted);">Groq sedang merangkai kata...</div>
    </div>
  `;
  let activeModel = "llama-3.3-70b-versatile";
  try {
    const mResp = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${db.settings.groqKey}` } });
    if (mResp.ok) {
      const mJson = await mResp.json();
      const availableIds = mJson.data.map(m => m.id);
      const preferred = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"];
      
      let found = false;
      for (const pref of preferred) {
        if (availableIds.includes(pref)) {
          activeModel = pref;
          found = true;
          break;
        }
      }
      
      if (!found) {
        const textModels = mJson.data.filter(m => !m.id.includes('vision') && !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('-vl-'));
        if (textModels.length > 0) activeModel = textModels[0].id;
      }
    }
  } catch (e) {
    console.warn("Gagal mengambil list model Groq:", e);
  }

  try {
    const resp = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${db.settings.groqKey}`
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `HTTP ${resp.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errJson.error || errText;
      } catch(e) { errMsg = errText; }
      throw new Error(errMsg);
    }
    
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    document.getElementById('wa-reminder-content').innerHTML = `
      <div class="form-group" style="margin-top:10px;">
        <textarea id="wa-generated-text" style="width:100%; height:180px; background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px; color:var(--text); font-family:var(--sans); font-size:13px; resize:none;">${text.trim()}</textarea>
      </div>
      <div class="flex-row" style="margin-top:16px;">
        <button class="btn btn-ghost" onclick="generateWAReminder()">🔄 Buat Ulang</button>
        <button class="btn btn-primary" style="background: linear-gradient(135deg, #22c55e, #16a34a);" onclick="window.open('https://wa.me/?text=' + encodeURIComponent(document.getElementById('wa-generated-text').value), '_blank')">Teruskan ke WA 🚀</button>
      </div>
    `;
    
  } catch(err) {
    console.error("Groq Error:", err);
    document.getElementById('wa-reminder-content').innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Gagal Menghubungi Groq</div>
        <div class="empty-state-sub" style="color:var(--red); font-size:12px; margin-top:8px; word-break:break-word;">Error: ${err.message}</div>
        <div class="empty-state-sub" style="margin-top:8px;">Pastikan API key valid (tidak ada spasi) dan koneksi lancar.</div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="generateWAReminder()">Coba Lagi</button>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════
// INIT — paksa login dulu sebelum dashboard terlihat
// ═══════════════════════════════════════════════════════════
window.initApp = function() {
  openModal('modal-admin-login');
  setTimeout(() => document.getElementById('admin-pw-input').focus(), 100);
};

window.onDBUpdate = function() {
  if (sessionStorage.getItem('kas_admin_logged')) {
    renderAdminDashboard();
  }
};
