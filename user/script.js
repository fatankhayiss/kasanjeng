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

// ═══════════════════════════════════════════════════════════
// STATE — anggota didapat dari sesi yang diset di halaman utama
// ═══════════════════════════════════════════════════════════
let currentMemberId = sessionStorage.getItem('kas_member_id');
let pendingPaymentData = null; // { imageData, aiNote, aiVerdict }

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
// NAVIGASI
// ═══════════════════════════════════════════════════════════
function goHome() {
  sessionStorage.removeItem('kas_member_id');
  window.location.href = '../index.html';
}

// ═══════════════════════════════════════════════════════════
// MEMBER DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderMemberDashboard(member) {
  const db = loadDB();
  const mk = currentMonthKey();
  const payKey = `${member.id}_${mk}`;
  const pay = db.payments[payKey];
  const amount = db.settings.amount || 50000;

  // Nav
  const av = document.getElementById('nav-avatar');
  av.style.background = member.color;
  av.textContent = initials(member.name);
  document.getElementById('nav-name').textContent = member.name;
  document.getElementById('member-month-tag').textContent = monthLabel(mk);

  // Payment status
  const statusEl = document.getElementById('member-payment-status');
  statusEl.className = 'payment-status-big';
  const uploadSection = document.getElementById('upload-section');
  const submitBtn = document.getElementById('submit-btn');
  const waBtn = document.getElementById('btn-wa-confirm');

  if (!pay || pay.status === 'rejected' || pay.status === 'unpaid') {
    statusEl.classList.add('unpaid');
    statusEl.innerHTML = `<div class="status-icon">${pay?.status === 'rejected' ? '❌' : '⏳'}</div>
      <div><div class="status-info-title">${pay?.status === 'rejected' ? 'Pembayaran Ditolak' : 'Belum Bayar'}</div>
      <div class="status-info-sub">Tagihan: ${formatRupiah(amount)}</div></div>`;
    uploadSection.style.display = '';
    submitBtn.disabled = true;
    if (waBtn) waBtn.style.display = 'none';
  } else if (pay.status === 'pending') {
    statusEl.classList.add('pending');
    statusEl.innerHTML = `<div class="status-icon">🔍</div>
      <div><div class="status-info-title">Menunggu Verifikasi</div>
      <div class="status-info-sub">Bukti sedang diperiksa admin</div></div>`;
    uploadSection.style.display = 'none';
    if (waBtn) waBtn.style.display = 'block';
  } else {
    statusEl.classList.add('paid');
    statusEl.innerHTML = `<div class="status-icon">✅</div>
      <div><div class="status-info-title">Lunas!</div>
      <div class="status-info-sub">Dibayar ${pay.date}</div></div>`;
    uploadSection.style.display = 'none';
    if (waBtn) waBtn.style.display = 'block';
  }

  // Group progress replaced with personalized message
  document.querySelector('.progress-bar-wrap').style.display = 'none';
  document.getElementById('progress-pct').style.display = 'none';
  
  if (pay && pay.status === 'paid') {
    document.getElementById('progress-label-text').textContent = 'Kamu sudah bayar! Terimakasih 🎉';
    document.getElementById('progress-label-text').style.color = 'var(--green)';
    document.getElementById('progress-label-text').style.fontWeight = '600';
    document.getElementById('progress-label-text').style.fontSize = '14px';
  } else if (pay && pay.status === 'pending') {
    document.getElementById('progress-label-text').textContent = 'Bukti bayarmu sedang dicek Admin 🔍';
    document.getElementById('progress-label-text').style.color = 'var(--yellow)';
    document.getElementById('progress-label-text').style.fontWeight = '600';
    document.getElementById('progress-label-text').style.fontSize = '14px';
  } else {
    document.getElementById('progress-label-text').textContent = 'Kamu belum bayar! Bayar dulu ya 💸';
    document.getElementById('progress-label-text').style.color = 'var(--red)';
    document.getElementById('progress-label-text').style.fontWeight = '600';
    document.getElementById('progress-label-text').style.fontSize = '14px';
  }

  // QRIS
  const qrisWrap = document.getElementById('qris-display-wrap');
  if (db.settings.qrisImage) {
    qrisWrap.innerHTML = `<img src="${db.settings.qrisImage}" alt="QRIS" style="width:160px;height:160px;object-fit:contain;border-radius:10px;cursor:pointer;" onclick="openQrisModal()">`;
  } else {
    qrisWrap.innerHTML = `<span style="font-size:40px">📱</span><span style="font-size:11px;color:#999">QRIS belum diatur admin</span>`;
  }
  document.getElementById('qris-amount-display').textContent = formatRupiah(amount);
  document.getElementById('qris-label-name').textContent = db.settings.qrisName || '';

  // History
  renderMemberHistory(member);

  // Reset upload
  document.getElementById('upload-zone').style.display = 'block';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('bukti-preview').src = '';
  document.getElementById('bukti-file').value = '';
  document.getElementById('ai-result').style.display = 'none';
  pendingPaymentData = null;
  selectedFileToVerify = null;
}

function renderMemberHistory(member) {
  const db = loadDB();
  const histEl = document.getElementById('member-history');

  const allKeys = Object.keys(db.payments)
    .filter(k => k.startsWith(member.id + '_'))
    .sort((a,b) => b.localeCompare(a));

  if (!allKeys.length) {
    histEl.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📭</div><div class="empty-state-sub">Belum ada riwayat pembayaran</div></div>`;
    return;
  }

  histEl.innerHTML = allKeys.map(k => {
    const [, month] = k.split('_');
    const pay = db.payments[k];
    const statusMap = {
      paid: ['✅', 'chip-green', 'Lunas'],
      pending: ['🔍', 'chip-yellow', 'Menunggu'],
      rejected: ['❌', 'chip-red', 'Ditolak'],
      unpaid: ['⏳', 'chip-red', 'Belum Bayar']
    };
    const [icon, cls, label] = statusMap[pay.status] || statusMap.unpaid;
    return `
      <div class="history-item">
        <div>
          <div class="history-month">${monthLabel(month)}</div>
          <div class="history-date">${pay.date || ''}</div>
        </div>
        <div><span class="chip ${cls}">${icon} ${label}</span></div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// FILE UPLOAD + AI VERIFICATION
// ═══════════════════════════════════════════════════════════
let selectedFileToVerify = null;

function cancelUpload() {
  document.getElementById('upload-zone').style.display = 'block';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('bukti-file').value = '';
  selectedFileToVerify = null;
  pendingPaymentData = null;
}

function onFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  selectedFileToVerify = file;

  const reader = new FileReader();
  reader.onload = function(e) {
    // Show preview section
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('preview-section').style.display = 'block';
    
    document.getElementById('bukti-preview').src = e.target.result;

    // Show verify button, hide submit & result
    document.getElementById('btn-verify-ai').style.display = 'block';
    document.getElementById('ai-result').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function startAIVerification() {
  if (!selectedFileToVerify) return;
  const file = selectedFileToVerify;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const imageData = e.target.result;

    const aiResult = document.getElementById('ai-result');
    const aiText = document.getElementById('ai-result-text');
    const aiVerdict = document.getElementById('ai-verdict');
    const verifyBtn = document.getElementById('btn-verify-ai');
    const submitBtn = document.getElementById('submit-btn');

    aiResult.style.display = 'none';
    
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'AI Sedang Bekerja...';
    submitBtn.style.display = 'none';

    const db = loadDB();
    const groqKey = db.settings.groqKey;

    if (!groqKey) {
      aiText.textContent = 'API key Groq belum diatur. Bukti akan langsung dikirim ke admin untuk verifikasi manual.';
      aiVerdict.innerHTML = `<div class="ai-verdict verdict-unclear">⚠️ Perlu Verifikasi Manual</div>`;
      pendingPaymentData = { imageData, aiNote: 'Tanpa AI - verifikasi manual', aiVerdict: 'manual' };
      submitBtn.disabled = false;
      return;
    }

    let aiProgressInterval;
    
    // Show loading modal and simulate progress
    document.getElementById('modal-loading-ai').classList.add('open');
    const bar = document.getElementById('ai-progress-bar');
    const text = document.getElementById('ai-progress-text');
    let pct = 0;
    bar.style.width = '0%';
    text.textContent = 'Mengekstrak gambar...';
    
    aiProgressInterval = setInterval(() => {
      if (pct < 95) {
        pct += Math.random() * 15;
        if (pct > 95) pct = 95;
        bar.style.width = pct + '%';
        
        if (pct < 30) text.textContent = "Membaca teks dari struk...";
        else if (pct < 60) text.textContent = "Mengekstrak nominal transfer...";
        else if (pct < 85) text.textContent = "Memverifikasi tujuan penerima...";
        else text.textContent = "Sedikit lagi selesai...";
      }
    }, 400);

    // Compress image before sending to AI to avoid huge payloads and hanging requests
    const img = new Image();
    img.onload = async function() {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Output compressed base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        const amount = db.settings.amount || 50000;
        const qrisName = db.settings.qrisName || '';

        const prompt = `Kamu adalah sistem verifikasi pembayaran. Analisis gambar bukti pembayaran QRIS ini.
Periksa apakah ini adalah bukti pembayaran yang valid dengan detail:
- Apakah ini screenshot/foto bukti transfer atau pembayaran QRIS?
- Apakah ada nominal yang tertera? (nominal yang diharapkan: Rp${Number(amount).toLocaleString('id-ID')})
- Apakah status pembayaran tertulis berhasil/sukses?
${qrisName ? `- Nama penerima yang diharapkan mengandung: "${qrisName}"` : ''}

Jawab dalam format berikut:
VALID/TIDAK_VALID/TIDAK_JELAS
[Penjelasan singkat 1-2 kalimat dalam bahasa Indonesia]`;

        let activeVisionModel = "llama-3.2-11b-vision-preview";
        try {
          const mResp = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${groqKey}` } });
          if (mResp.ok) {
            const mJson = await mResp.json();
            const availableIds = mJson.data.map(m => m.id);
            const preferredVision = ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview", "qwen-vl-max"];
            let found = false;
            for (const pref of preferredVision) {
              if (availableIds.includes(pref)) {
                activeVisionModel = pref;
                found = true;
                break;
              }
            }
            if (!found) {
              const vModel = mJson.data.find(m => m.id.includes('vision') || m.id.includes('-vl-') || m.id.includes('qwen'));
              if (vModel) activeVisionModel = vModel.id;
            }
          }
        } catch (e) {
          console.warn("Gagal mengambil list model vision Groq:", e);
        }

        const resp = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: activeVisionModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: compressedBase64 } }
                ]
              }
            ]
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
        let textResp = data.choices?.[0]?.message?.content || '';
        
        // Some models output <think> blocks, we need to strip them to parse the final answer
        if (textResp.includes('</think>')) {
          textResp = textResp.split('</think>')[1].trim();
        }

        const lines = textResp.trim().split('\n');
        const verdict = lines[0].trim().toUpperCase();
        const explanation = lines.slice(1).join(' ').trim() || textResp;

        // Finish progress
        clearInterval(aiProgressInterval);
        bar.style.width = '100%';
        text.textContent = 'Selesai!';
        
        setTimeout(() => {
          document.getElementById('modal-loading-ai').classList.remove('open');
          
          document.getElementById('ai-result').style.display = 'block';

          let verdictHtml = '';
          let aiVerdictStr = 'unclear';
          let shortMessage = 'Menunggu pengecekan admin.';
          
          if (verdict.includes('VALID') && !verdict.includes('TIDAK')) {
            verdictHtml = `<div class="ai-verdict verdict-valid">✅ Bukti Valid</div>`;
            aiVerdictStr = 'valid';
            shortMessage = 'Data sesuai!';
          } else if (verdict.includes('TIDAK_VALID')) {
            verdictHtml = `<div class="ai-verdict verdict-invalid">❌ Bukti Tidak Valid</div>`;
            aiVerdictStr = 'invalid';
            shortMessage = 'data tidak terpenuhi kirim foto lain';
          } else {
            verdictHtml = `<div class="ai-verdict verdict-invalid">❌ Bukti Tidak Valid</div>`;
            aiVerdictStr = 'invalid';
            shortMessage = 'data tidak terpenuhi kirim foto lain';
          }
          
          document.getElementById('ai-result-text').textContent = shortMessage;
          document.getElementById('ai-verdict').innerHTML = verdictHtml;

          pendingPaymentData = { imageData: compressedBase64, aiNote: shortMessage, aiVerdict: aiVerdictStr };
          
          document.getElementById('btn-verify-ai').style.display = 'none';
          const submitBtn = document.getElementById('submit-btn');
          submitBtn.style.display = 'block';
          submitBtn.disabled = false; // MAKE SURE IT'S CLICKABLE
        }, 500);

      } catch (err) {
        clearInterval(aiProgressInterval);
        document.getElementById('modal-loading-ai').classList.remove('open');
        
        let availableModels = '';
        try {
          const mResp = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${groqKey}` } });
          const mJson = await mResp.json();
          const vModels = mJson.data.filter(m => m.id.toLowerCase().includes('vision') || m.id.toLowerCase().includes('vl') || m.id.toLowerCase().includes('qwen')).map(m => m.id);
          availableModels = vModels.join(', ');
        } catch(e) {}

        document.getElementById('ai-result').style.display = 'block';
        document.getElementById('ai-result-text').textContent = `Gagal AI: ${err.message}. Bukti dikirim untuk verifikasi manual.`;
        document.getElementById('ai-verdict').innerHTML = `<div class="ai-verdict verdict-unclear">⚠️ Verifikasi Manual</div>`;
        
        let finalImage = imageData;
        try { finalImage = compressedBase64; } catch(e) {}
        pendingPaymentData = { imageData: finalImage, aiNote: 'Error AI - verifikasi manual', aiVerdict: 'manual' };
        
        document.getElementById('btn-verify-ai').style.display = 'none';
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.style.display = 'block';
        submitBtn.disabled = false; // MAKE SURE IT'S CLICKABLE
      }
    };
    img.src = imageData;
  };
  reader.readAsDataURL(file);
}

function submitPayment() {
  if (!pendingPaymentData || !currentMemberId) return;

  const db = loadDB();
  const mk = currentMonthKey();
  const payKey = `${currentMemberId}_${mk}`;
  const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });

  db.payments[payKey] = {
    status: 'pending',
    date: now,
    imageData: pendingPaymentData.imageData,
    aiNote: pendingPaymentData.aiNote,
    aiVerdict: pendingPaymentData.aiVerdict
  };

  // Auto-approve if AI says valid
  if (pendingPaymentData.aiVerdict === 'valid') {
    db.payments[payKey].status = 'paid';
    showToast('✅ Pembayaran diverifikasi AI dan otomatis disetujui!', 'success');
  } else {
    showToast('📤 Bukti terkirim! Menunggu verifikasi admin.', 'info');
  }

  saveDB(db);

  const member = db.members.find(m => m.id === currentMemberId);
  if (member) renderMemberDashboard(member);
  pendingPaymentData = null;
}

function confirmToWA() {
  const msg = "tan gua udah bayar kas ke web!";
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ═══════════════════════════════════════════════════════════
// QRIS MODAL ACTIONS
// ═══════════════════════════════════════════════════════════
function openQrisModal() {
  const db = loadDB();
  if (!db.settings.qrisImage) return;
  document.getElementById('qris-full-img').src = db.settings.qrisImage;
  document.getElementById('qris-modal').classList.add('open');
}

function closeQrisModal() {
  document.getElementById('qris-modal').classList.remove('open');
}

function downloadQris() {
  const db = loadDB();
  if (!db.settings.qrisImage) return;
  
  const a = document.createElement('a');
  a.href = db.settings.qrisImage;
  a.download = 'QRIS_Kas_Bareng.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ═══════════════════════════════════════════════════════════
// INIT — pastikan ada sesi anggota yang valid, jika tidak balik ke home
// ═══════════════════════════════════════════════════════════
window.initApp = function() {
  const db = loadDB();
  const member = db.members.find(m => m.id === currentMemberId);
  if (!member) {
    window.location.href = '../index.html';
    return;
  }
  renderMemberDashboard(member);
};

window.onDBUpdate = function() {
  if (currentMemberId) {
    const db = loadDB();
    const member = db.members.find(m => m.id === currentMemberId);
    if (member) renderMemberDashboard(member);
  }
};
