// ======================= app.js =======================

/* ========= Theme toggle ========= */
const modeBtn = document.getElementById('modeToggle');
function syncModeIcon(){
  const i = modeBtn?.querySelector('i');
  const light = document.body.classList.contains('light');
  if (i && !document.documentElement.classList.contains('no-fa')) {
    i.className = light ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}
(function applySavedTheme(){
  const t = localStorage.getItem('levpayTheme');
  if (t === 'light') document.body.classList.add('light');
  syncModeIcon();
})();
modeBtn?.addEventListener('click', ()=>{
  document.body.classList.toggle('light');
  localStorage.setItem('levpayTheme', document.body.classList.contains('light') ? 'light' : 'dark');
  syncModeIcon();
});

/* ========= Typewriter ========= */
(function initTypewriter(){
  const h1 = document.querySelector('.hero h1');
  if(!h1) return;
  const chars = h1.textContent.trim().length;
  h1.style.setProperty('--chars', chars);
  setTimeout(()=> h1.classList.add('typewriter'), 400);
})();

/* ========= Toast ========= */
const toastEl = document.getElementById('toast');
function toast(msg){
  if(!toastEl) return;
  msg && (toastEl.textContent = msg);
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 1700);
}

/* ========= Nominal helpers ========= */
const inpNominal = document.getElementById('nominal');
const errNominal = document.getElementById('errNominal');
const inpNama = document.getElementById('nama');
const inpPesan = document.getElementById('pesan');

function parseDigits(str){ return parseInt(String(str||'').replace(/[^\d]/g,''),10) || 0; }
function setNominalMasked(n){ if(inpNominal) inpNominal.value = n ? n.toLocaleString('id-ID') : ''; }
function nominalNumber(){ return parseDigits(inpNominal?.value); }

inpNominal?.addEventListener('input', ()=>{
  const n = nominalNumber();
  setNominalMasked(n);
  if(!n){ errNominal.textContent = 'Nominal wajib diisi'; }
  else if(n < 1){ errNominal.textContent = 'Minimal Rp1'; }
  else { errNominal.textContent = ''; }
});

document.querySelectorAll('.preset-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    setNominalMasked(parseDigits(b.dataset.value));
    errNominal.textContent = '';
  });
});

/* Simpan/restore form */
window.addEventListener('DOMContentLoaded', ()=>{
  const saved = localStorage.getItem('levpayLast');
  if(saved){
    try{
      const {nama, nominal, pesan} = JSON.parse(saved);
      if (inpNama)  inpNama.value  = nama || '';
      if (inpPesan) inpPesan.value = pesan || '';
      setNominalMasked(nominal||0);
    }catch{}
  }
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const payBtn = document.getElementById('payBtn');
  const lbl = payBtn?.querySelector('.lbl');
  if(lbl) lbl.innerHTML = (document.documentElement.classList.contains('no-fa') ? '' : '<i class="fa-solid fa-qrcode"></i> ') + 'Buat QRIS';
  const sp = payBtn?.querySelector('.spin'); if(sp) sp.hidden = true;
});

document.getElementById('paymentForm')?.addEventListener('input', ()=>{
  localStorage.setItem('levpayLast', JSON.stringify({
    nama: inpNama?.value, nominal: nominalNumber(), pesan: inpPesan?.value
  }));
});

/* ========= Marquee Lirik ========= */
const LIRIK = [
  ["temanku semua pada jahat tante", 0.2],
  ["aku lagi susah mereka gak ada", 0.3],
  ["coba kalau lagi jayaa", 0.4],
  ["aku dipuja puja tante", 0.6],
  ["sudah terbiasa terjadi tante", 0.7],
  ["teman datang ketika lagi butuh saja", 0.4],
  ["coba kalau lagi susahhhh", 0.1],
  ["mereka semua menghilaaaaaangg", 1.2],
  ["<i class='fa-solid fa-music'></i>", 5.0]
];
function buildMarquee(){
  const track = document.getElementById('lirikTrack');
  if(!track) return;
  const chips = LIRIK.map(([text], i) =>
    `<span class="chip" style="animation-delay:${i * 0.2}s"><i class="fa-solid fa-music"></i>${text}</span>`
  ).join("");
  track.innerHTML = chips + chips;

  const totalTempo = LIRIK.reduce((s,[,d])=>s+d,0);
  const seconds = Math.max(25, totalTempo * 4);
  track.parentElement.style.setProperty("--speed", `${seconds}s`);

  track.style.opacity = "0";
  track.classList.remove("run");
  track.style.transform = "translateX(0)";
  setTimeout(()=>{
    void track.offsetWidth;
    track.style.transition="opacity .8s ease";
    track.style.opacity="1";
    track.classList.add("run","reveal");
  }, 4000);
}
document.addEventListener("DOMContentLoaded", buildMarquee);

/* ========= QR Modal ========= */
const qrModal = document.getElementById('qrModal');
const closeModalBtn = document.getElementById('closeModal');
let lastFocus = null;

function openQRModal(){
  lastFocus = document.activeElement;
  qrModal?.classList.add('active');
  qrModal?.setAttribute('aria-hidden','false');
}
function _closeQRModal(){
  qrModal?.classList.remove('active');
  qrModal?.setAttribute('aria-hidden','true');
  lastFocus && lastFocus.focus && lastFocus.focus();
}
function closeModal(){ setPayBtnLoading(false); stopPolling(); _closeQRModal(); }
closeModalBtn?.addEventListener('click', closeModal);
qrModal?.addEventListener('click', e=>{ if(e.target===qrModal) closeModal(); });

/* ====== ORKUT BACKEND INTEGRATION (ADD-ONLY) ====== */
/** Jika backend beda origin, isi base URL di sini.
 *  Kalau BARU di-deploy bareng (Vercel monorepo), biarin string kosong.
 */
const API_BASE = ''; // contoh jika beda: 'https://levpay-api.vercel.app'

async function createPayment({ amount, nama, note }){
  const r = await fetch(`${API_BASE}/api/qr/create`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({
      amount: Number(amount),
      meta: { nama, note }
    })
  });
  if(!r.ok) throw new Error('Gagal membuat QR');
  return r.json(); // {success, reference, amount, qr_image}
}
async function getStatus(reference, amount){
  const r = await fetch(`${API_BASE}/api/qr/status?reference=${encodeURIComponent(reference)}&amount=${Number(amount)}`);
  if(!r.ok) throw new Error('Gagal cek status');
  return r.json(); // {success, data:{status}}
}

/* ====== Builder + Polling ====== */
const builder = document.getElementById('builder');
const qrWrap = document.getElementById('qrWrap');
const p1 = document.getElementById('p1'), p2 = document.getElementById('p2'), p3 = document.getElementById('p3');
const builderMsg = document.getElementById('builderMsg');
const qrContainer = document.getElementById('qrContainer');
const qrMeta = document.getElementById('qrMeta');
let expTimer=null;

function startExpiry(s){
  if(expTimer) clearInterval(expTimer);
  const el = document.getElementById('expiry');
  const tick = ()=>{
    const mm=String(Math.floor(s/60)).padStart(2,'0');
    const ss=String(s%60).padStart(2,'0');
    el.textContent=`${mm}:${ss}`;
    if(s--<=0){ clearInterval(expTimer); el.textContent='00:00'; }
  };
  tick(); expTimer=setInterval(tick,1000);
}

let __poll=null;
function stopPolling(){ if(__poll){ clearInterval(__poll); __poll=null; } }
function setPaidUI(){
  const pill = document.querySelector('.pill');
  if (pill){ pill.className = 'pill paid'; pill.textContent = 'Status: PAID — Terima kasih!'; }
}
function setPendingUI(){
  const pill = document.querySelector('.pill');
  if (pill){ pill.className = 'pill pending'; pill.innerHTML = 'Status: Pending — <span id="expiry">05:00</span>'; }
}
function startPolling(reference, amount){
  stopPolling();
  setPendingUI();
  let elapsed=0, timeout=5*60;
  __poll = setInterval(async ()=>{
    try{
      const res = await getStatus(reference, amount);
      const status = res?.data?.status || 'PENDING';
      if(status==='PAID'){
        stopPolling();
        setPaidUI();
        toast('Pembayaran terverifikasi ✅');
        setTimeout(()=>closeModal(), 1100);
      }
    }catch(_){}
    elapsed += 3;
    if (elapsed>=timeout) stopPolling();
  }, 3000);
}

/* ==== GANTI runBuilder: pakai Orkut backend, TANPA menghapus UI ==== */
async function runBuilder(nama, nominal, note){
  if (!builder || !qrWrap) return;
  builder.hidden = false; qrWrap.hidden = true;
  p1.style.width='0'; p2.style.width='0'; p3.style.width='0';
  builderMsg.textContent='Mempersiapkan order';
  setTimeout(()=>{ p1.style.width='100%'; builderMsg.textContent='Menghubungkan gateway'; },400);
  setTimeout(()=>{ p2.style.width='100%'; builderMsg.textContent='Membangun QR dinamis'; },900);

  try{
    const resp = await createPayment({ amount: nominal, nama, note });
    if(!resp?.success) throw new Error(resp?.message || 'Create gagal');

    setTimeout(()=>{ p3.style.width='100%'; }, 200);

    const { reference, amount, qr_image } = resp;
    // tampilkan QR dari backend
    qrContainer.innerHTML = `<img src="${qr_image}" alt="QRIS" width="320" height="320" decoding="async" loading="eager">`;
    qrMeta.textContent = `Atas nama: ${nama} · Ref: ${reference} · Nominal: Rp ${Number(amount).toLocaleString('id-ID')}`;
    window.__levpayTx = { reference, amount };

    builder.hidden = true; qrWrap.hidden = false;
    startExpiry(5*60);
    startPolling(reference, amount);
  }catch(e){
    builderMsg.textContent='Gagal membuat QR. Coba lagi.';
    toast('Gagal membuat QR');
    setTimeout(()=>closeModal(), 1100);
  }
}

const payBtn = document.getElementById('payBtn');
function setPayBtnLoading(isLoading){
  if(!payBtn) return;
  payBtn.disabled = isLoading;
  const sp = payBtn.querySelector('.spin'); if(sp) sp.hidden = !isLoading;
}
document.getElementById('paymentForm')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const nama = inpNama?.value.trim();
  const pesan = inpPesan?.value.trim();
  const nominalVal = nominalNumber();
  if(!nama || nominalVal < 1){
    if(!nominalVal) errNominal.textContent='Nominal wajib diisi';
    else if(nominalVal < 1) errNominal.textContent='Minimal Rp1';
    toast('Lengkapi nama & nominal yang valid');
    return;
  }
  setPayBtnLoading(true);
  openQRModal();
  runBuilder(nama, nominalVal, pesan).finally(()=> setPayBtnLoading(false));
});
document.getElementById('copyAmount')?.addEventListener('click', ()=>{
  navigator.clipboard.writeText(String(nominalNumber())).then(()=>toast('Nominal disalin'));
});
document.getElementById('copyNote')?.addEventListener('click', ()=>{
  const v = inpPesan?.value || 'Pembayaran LevPay';
  navigator.clipboard.writeText(v).then(()=>toast('Keterangan disalin'));
});
document.getElementById('refresh')?.addEventListener('click', async ()=>{
  const tx = window.__levpayTx;
  if (!tx?.reference) return toast('Belum ada transaksi');
  try{
    const res = await getStatus(tx.reference, tx.amount);
    const st = res?.data?.status || 'PENDING';
    if(st==='PAID'){
      stopPolling();
      setPaidUI();
      toast('Pembayaran terverifikasi ✅');
      setTimeout(()=>closeModal(), 1100);
    }else{
      toast(`Status: ${st}`);
    }
  }catch(_){ toast('Gagal cek status'); }
});

/* ========= Firebase init (DIPERTAHANKAN) ========= */
const firebaseConfig = {
  apiKey: "AIzaSyA8-PyhrZkgd7Q434YLug2VezO8MsKCjOc",
  authDomain: "levpay-63157.firebaseapp.com",
  projectId: "levpay-63157",
  storageBucket: "levpay-63157.firebasestorage.app",
  messagingSenderId: "714029207691",
  appId: "1:714029207691:web:d6f454f8dbea4a62bac48e"
};
let db=null;
try{
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK belum dimuat.');
  } else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }
}catch(e){
  console.error('Firebase init error:', e);
}

/* ========= Wall (Firebase) (DIPERTAHANKAN) ========= */
const wallInput = document.getElementById('wallInput');
const wallSend  = document.getElementById('wallSend');
const wallErr   = document.getElementById('wallErr');
const wallList  = document.getElementById('wallList');

function fmtTime(ts){
  try{
    if(!ts) return '';
    if(typeof ts.toDate==='function') return ts.toDate().toLocaleString('id-ID');
    if(typeof ts.seconds==='number') return new Date(ts.seconds*1000).toLocaleString('id-ID');
  }catch(_){}
  return '';
}
const esc = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function liFromDoc(doc){
  const d = doc.data() || {};
  const li = document.createElement('li');
  li.innerHTML = `
    <i class="fa-solid fa-user-secret"></i>
    <div>
      <strong>Anonymous</strong>
      <div>${esc(d.text)}</div>
      <time>${fmtTime(d.ts)}</time>
    </div>`;
  return li;
}

if (db && wallList){
  db.collection('wall').orderBy('ts','desc').limit(50).onSnapshot(snap=>{
    wallList.innerHTML='';
    snap.forEach(doc=> wallList.appendChild(liFromDoc(doc)));
  }, err=>{
    console.error(err);
    if (wallErr) wallErr.textContent='Gagal memuat pesan.';
  });
}

wallSend?.addEventListener('click', async ()=>{
  const text = wallInput?.value.trim();
  if(!text){ wallErr.textContent='Pesan tidak boleh kosong'; return; }
  if(text.length>200){ wallErr.textContent='Maksimal 200 karakter'; return; }
  wallErr.textContent=''; wallSend.disabled=true;
  try{
    await db.collection('wall').add({
      text,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    wallInput.value='';
  }catch(e){
    console.error(e);
    wallErr.textContent='Gagal mengirim. Cek koneksi/rules.';
  }finally{
    wallSend.disabled=false;
  }
});

/* ===== FAB DIALS FINAL — toggle tap-to-show stays open until tapped again (DIPERTAHANKAN) ===== */
(function(){
  const dials = Array.from(document.querySelectorAll('.fab.dial'));

  function toggleDial(dial){
    const btn  = dial.querySelector('.fab-btn.main');
    const menu = dial.querySelector('.fab-menu');
    const isOpen = dial.classList.contains('open');

    if(isOpen){
      dial.classList.remove('open');
      btn.setAttribute('aria-expanded','false');
      menu.hidden = true;
    } else {
      dials.forEach(d=>{ d.classList.remove('open'); d.querySelector('.fab-menu')?.setAttribute('hidden',''); });
      dial.classList.add('open');
      btn.setAttribute('aria-expanded','true');
      menu.removeAttribute('hidden');
    }
  }

  dials.forEach(dial=>{
    const btn = dial.querySelector('.fab-btn.main');
    const menu = dial.querySelector('.fab-menu');
    if(menu) menu.setAttribute('hidden','');
    btn?.addEventListener('click', e=>{
      e.stopPropagation();
      toggleDial(dial);
    });

    dial.querySelectorAll('.fab-menu a').forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        window.open(a.href,'_blank','noopener');
        dial.classList.remove('open');
        a.closest('.fab-menu').setAttribute('hidden','');
      });
    });
  });

  document.addEventListener('click', (e)=>{
    if(!dials.some(d=>d.contains(e.target))){
      dials.forEach(d=>{
        d.classList.remove('open');
        d.querySelector('.fab-menu')?.setAttribute('hidden','');
      });
    }
  });
})();

/* ==== Modal Pesan Publik (DIPERTAHANKAN) ==== */
const wallModal = document.getElementById('wallModal');
const fabWall   = document.getElementById('fabWall');
const closeWall = document.getElementById('closeWall');

function openWallModal(){
  wallModal?.classList.add('active');
  wallModal?.setAttribute('aria-hidden','false');
  document.body.classList.add('body-hide-fabs');
}
function closeWallModal(){
  wallModal?.classList.remove('active');
  wallModal?.setAttribute('aria-hidden','true');
  document.body.classList.remove('body-hide-fabs');
}
fabWall?.addEventListener('click', (e)=>{ e.preventDefault(); openWallModal(); });
closeWall?.addEventListener('click', (e)=>{ e.preventDefault(); closeWallModal(); });
wallModal?.addEventListener('click', (e)=>{ if(e.target===wallModal) closeWallModal(); });

/* ===================== end app.js ===================== */