// ============================================================
// KONFIGURASI — GANTI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyqp8Fr12wiiIB5cs_ngcqJjpmsuhfxXKUYlyzkbDFAjnAvYNb2zEsqLwQ-X9yBdPtS/exec';
// ============================================================

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------- Session user ---------- */
let session = null;
try { session = JSON.parse(localStorage.getItem('session') || 'null'); }
catch(e) { session = null; }

/* ---------- API helpers ---------- */
async function apiGet(params) {
  if (session?.token) params.token = session.token;
  const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function apiPost(params, body) {
  if (session?.token) params.token = session.token;
  const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/* ---------- Alert helpers ---------- */
function alertBox(prefix, msg, color) {
  const a = $('#' + prefix + '-alert');
  if (!a) return;
  a.textContent = msg;
  a.className = 'alert ' + color;
  a.classList.remove('hidden');
}
function hideAlert(prefix) {
  const a = $('#' + prefix + '-alert');
  if (a) a.classList.add('hidden');
}

/* ---------- Tanggal hari ini (YYYY-MM-DD) ---------- */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */
function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#login-user').focus();
}
function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#user-label').textContent = `${session.name || session.username} (${session.role})`;
  const MGR_ROLES = ['manager','gl','group leader','admin','supervisor'];
  $$('.tab[data-role="manager"]').forEach(t => {
    const r = String(session.role || '').toLowerCase();
    t.style.display = MGR_ROLES.indexOf(r) !== -1 ? '' : 'none';
  });
  $('#req-by').value = session.username;
}

$('#login-btn').addEventListener('click', doLogin);
$('#login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('#login-user').addEventListener('keydown', e => { if (e.key === 'Enter') $('#login-pass').focus(); });

async function doLogin() {
  const u = $('#login-user').value.trim();
  const p = $('#login-pass').value;
  const a = $('#login-alert');
  a.className = 'alert info'; a.textContent = '⏳ Memproses...'; a.classList.remove('hidden');
  try {
    const out = await apiGet({ action:'login', username:u, password:p });
    if (out.error) { a.className='alert red'; a.textContent='❌ '+out.error; return; }
    session = out;
    localStorage.setItem('session', JSON.stringify(session));
    $('#login-pass').value = '';
    showApp();
  } catch (err) {
    a.className = 'alert red'; a.textContent = '❌ ' + err.message;
  }
}

$('#logout-btn').addEventListener('click', async () => {
  try { await apiGet({ action:'logout' }); } catch(e){}
  localStorage.removeItem('session');
  session = null;
  showLogin();
});

/* ============================================================
   TABS
   ============================================================ */
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = $('#tab-' + btn.dataset.tab);
    panel.classList.add('active');
    const firstInput = panel.querySelector('.barcode-input');
    if (firstInput && !firstInput.disabled) firstInput.focus();
  });
});

/* ============================================================
   LOOKUP BARCODE
   ============================================================ */
const state = { exp:{}, soh:{}, rtc:{}, req:{} };

$$('.barcode-input').forEach(input => {
  input.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const bc = e.target.value.trim();
    if (!bc) return;
    const prefix = input.dataset.lookup;
    hideAlert(prefix);
    try {
      const item = await apiGet({ action:'lookupBarcode', barcode: bc });
      if (item.error) {
        state[prefix].barcode = '';
        const info = $(`#${prefix}-info`);
        if (info) info.classList.add('hidden');
        alertBox(prefix, '❌ ' + item.error, 'red');
        return;
      }
      state[prefix].barcode = bc;
      if (prefix === 'req') {
        addReqItem(item);
      } else {
        showInfo(prefix, item);
        alertBox(prefix, '✅ ' + item.description, 'green');
        focusNext(prefix);
      }
      input.value = '';
    } catch (err) {
      alertBox(prefix, '❌ ' + err.message, 'red');
    }
  });
});

function showInfo(prefix, item) {
  const box = $(`#${prefix}-info`);
  if (!box) return;
  const setText = (key, val) => {
    const el = box.querySelector(`[data-f="${key}"]`);
    if (el) el.textContent = val;
  };
  setText('barcode', item.barcode);
  setText('sku', item.sku);
  setText('dept', item.dept || '-');
  setText('desc', item.description);
  setText('ret', item.returnable ? 'Ya' : 'Tidak');
  box.classList.remove('hidden');
}
function focusNext(prefix) {
  const map = { exp:'#exp-qty', soh:'#soh-qty', rtc:'#rtc-qty' };
  if (map[prefix]) $(map[prefix]).focus();
}

/* ============================================================
   CEK EXPIRED — versi sesi
   ============================================================ */
const expSession = {
  check_date: '',
  location: '',
  gondola: '',
  items: []
};

function updateExpSessionUI() {
  const ready = expSession.check_date && expSession.location && expSession.gondola;
  const status = $('#session-status');
  const scanArea = $('#exp-scan-area');
  const barcode = $('#exp-barcode');
  const changeBtn = $('#exp-change-loc');

  if (ready) {
    status.textContent =
      `✅ ${expSession.check_date} · ${expSession.location.toUpperCase()} · Gondola ${expSession.gondola}`;
    status.className = 'session-status ready';
    scanArea.classList.remove('disabled');
    barcode.disabled = false;
    barcode.placeholder = 'Scan barcode di sini...';
    changeBtn.classList.remove('hidden');
    $('#exp-check-date').disabled = true;
    $('#exp-location').disabled = true;
    $('#exp-gondola').disabled = true;
    if (document.activeElement !== barcode) barcode.focus();
  } else {
    status.textContent = '⚠️ Isi Tanggal, Lokasi & No. Gondola dulu';
    status.className = 'session-status';
    scanArea.classList.add('disabled');
    barcode.disabled = true;
    barcode.value = '';
    barcode.placeholder = 'Isi sesi dulu...';
    changeBtn.classList.add('hidden');
    $('#exp-check-date').disabled = false;
    $('#exp-location').disabled = false;
    $('#exp-gondola').disabled = false;
    $('#exp-info').classList.add('hidden');
    state.exp.barcode = '';
  }
}

$('#exp-check-date').addEventListener('change', e => {
  expSession.check_date = e.target.value;
  updateExpSessionUI();
});

$('#exp-location').addEventListener('change', e => {
  expSession.location = e.target.value;
  updateExpSessionUI();
  if (expSession.location && !expSession.gondola) $('#exp-gondola').focus();
});

$('#exp-gondola').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 3);
  e.target.value = v;
  expSession.gondola = v;
  updateExpSessionUI();
});
$('#exp-gondola').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    updateExpSessionUI();
  }
});

$('#exp-change-loc').addEventListener('click', () => {
  if (expSession.items.length > 0) {
    const ok = confirm(
      `Sudah ada ${expSession.items.length} item tersimpan di sesi ini.\n` +
      `Yakin ganti sesi? Daftar item akan direset.`
    );
    if (!ok) return;
  }
  const today = todayISO();
  expSession.check_date = today;
  expSession.location = '';
  expSession.gondola = '';
  expSession.items = [];
  $('#exp-check-date').value = today;
  $('#exp-location').value = '';
  $('#exp-gondola').value = '';
  $('#exp-form').reset();
  $('#exp-info').classList.add('hidden');
  state.exp.barcode = '';
  renderExpSessionList();
  updateExpSessionUI();
  $('#exp-location').focus();
});

function renderExpSessionList() {
  const wrap = $('#exp-session-list');
  const tb = $('#exp-session-body');
  if (!tb) return;
  tb.innerHTML = '';
  if (expSession.items.length === 0) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  expSession.items.forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.check_date}</td>
      <td>${it.barcode}</td>
      <td>${it.description}</td>
      <td>${it.qty}</td>
      <td>${it.exp_date}</td>
      <td>${expSession.gondola}</td>
    `;
    tb.appendChild(tr);
  });
  $('#exp-session-count').textContent = expSession.items.length;
}

$('#exp-form').addEventListener('submit', async e => {
  e.preventDefault();

  if (!expSession.check_date || !expSession.location || !expSession.gondola) {
    return alertBox('exp', '⚠️ Isi Tanggal, Lokasi & No. Gondola dulu!', 'red');
  }
  if (!state.exp.barcode) {
    return alertBox('exp', 'Scan barcode dulu!', 'red');
  }

  const payload = {
    barcode: state.exp.barcode,
    qty: $('#exp-qty').value,
    exp_date: $('#exp-date').value,
    location: expSession.location,
    gondola_number: expSession.gondola,
    check_date: expSession.check_date,
    checked_by: session.username
  };

  alertBox('exp', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action: 'saveExpiry' }, payload);
    if (out.error) return alertBox('exp', '❌ ' + out.error, 'red');

    expSession.items.push({
      check_date: expSession.check_date,
      barcode: state.exp.barcode,
      sku: $('#exp-info [data-f="sku"]').textContent,
      description: $('#exp-info [data-f="desc"]').textContent,
      qty: payload.qty,
      exp_date: payload.exp_date
    });
    renderExpSessionList();

    alertBox('exp', '✅ Tersimpan. Lanjut scan barang berikutnya.', 'green');
    resetExpItemForm();
  } catch (err) {
    alertBox('exp', '❌ ' + err.message, 'red');
  }
});

function resetExpItemForm() {
  $('#exp-qty').value = '';
  $('#exp-date').value = '';
  $('#exp-info').classList.add('hidden');
  state.exp.barcode = '';
  const bc = $('#exp-barcode');
  bc.value = '';
  bc.focus();
}

/* ============================================================
   SOH
   ============================================================ */
$('#soh-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.soh.barcode) return alertBox('soh', 'Scan barcode dulu!', 'red');
  const payload = {
    barcode: state.soh.barcode,
    qty_on_hand: $('#soh-qty').value,
    location: $('#soh-location').value,
    gondola_number: $('#soh-gondola').value,
    note: $('#soh-note').value,
    counted_by: session.username
  };
  alertBox('soh', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action:'saveSoh' }, payload);
    if (out.error) return alertBox('soh', '❌ ' + out.error, 'red');
    alertBox('soh', '✅ Tersimpan (ID ' + out.id + ')', 'green');
    resetForm('soh');
  } catch (err) {
    alertBox('soh', '❌ ' + err.message, 'red');
  }
});

/* ============================================================
   RTC
   ============================================================ */
$('#rtc-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.rtc.barcode) return alertBox('rtc', 'Scan barcode dulu!', 'red');
  const payload = {
    barcode: state.rtc.barcode,
    qty: $('#rtc-qty').value,
    reason: $('#rtc-reason').value,
    input_by: session.username
  };
  alertBox('rtc', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action:'saveRtc' }, payload);
    if (out.error) return alertBox('rtc', '❌ ' + out.error, 'red');
    alertBox('rtc', '✅ Tersimpan (ID ' + out.id + ')', 'green');
    resetForm('rtc');
  } catch (err) {
    alertBox('rtc', '❌ ' + err.message, 'red');
  }
});

/* ============================================================
   REQ ORDER
   ============================================================ */
const reqItems = [];

function addReqItem(item) {
  const exist = reqItems.find(x => x.barcode === item.barcode);
  if (exist) exist.qty += 1;
  else reqItems.push({
    barcode: item.barcode, sku: item.sku,
    description: item.description, qty: 1, unit: 'PCS'
  });
  renderReqItems();
  alertBox('req', '➕ ' + item.description, 'green');
}

function renderReqItems() {
  const tb = $('#req-items');
  tb.innerHTML = '';
  reqItems.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.barcode}</td>
      <td>${it.sku}</td>
      <td>${it.description}</td>
      <td><input type="number" min="1" value="${it.qty}" data-idx="${idx}" class="req-qty"></td>
      <td>
        <select data-idx="${idx}" class="req-unit">
          ${['PCS','BOX','CTN','KG','LTR'].map(u =>
            `<option ${u===it.unit?'selected':''}>${u}</option>`).join('')}
        </select>
      </td>
      <td><button type="button" data-del="${idx}" class="del">✕</button></td>
    `;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('.req-qty').forEach(el =>
    el.addEventListener('input', e => {
      reqItems[e.target.dataset.idx].qty = Number(e.target.value);
    }));
  tb.querySelectorAll('.req-unit').forEach(el =>
    el.addEventListener('change', e => {
      reqItems[e.target.dataset.idx].unit = e.target.value;
    }));
  tb.querySelectorAll('.del').forEach(el =>
    el.addEventListener('click', e => {
      reqItems.splice(Number(e.target.dataset.del), 1);
      renderReqItems();
    }));
}

$('#req-submit').addEventListener('click', async () => {
  if (reqItems.length === 0) return alertBox('req', 'Belum ada item', 'red');
  const payload = {
    requested_by: session.username,
    dept: $('#req-dept').value,
    note: $('#req-note').value,
    items: reqItems
  };
  if (!payload.dept) return alertBox('req', 'Dept wajib diisi', 'red');
  alertBox('req', '⏳ Mengirim...', 'info');
  try {
    const out = await apiPost({ action:'saveReqOrder' }, payload);
    if (out.error) return alertBox('req', '❌ ' + out.error, 'red');
    alertBox('req', '✅ Terkirim: ' + out.req_id, 'green');
    reqItems.length = 0;
    renderReqItems();
    $('#req-note').value = '';
  } catch (err) {
    alertBox('req', '❌ ' + err.message, 'red');
  }
});

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard() {
  const days = $('#dash-days').value || 30;
  try {
    const out = await apiGet({ action:'dashboardExpiry', days });
    if (out.error) return;
    $('#dash-summary').innerHTML = `
      <div class="sum red">🔴 Expired: <b>${out.summary.expired}</b></div>
      <div class="sum yellow">🟡 ≤${out.days_window} hari: <b>${out.summary.soon}</b></div>
      <div class="sum">📦 Total: <b>${out.summary.total_checked}</b></div>`;
    fillRow('#dash-expired-table tbody', out.expired);
    fillRow('#dash-soon-table tbody', out.soon);
  } catch (err) {
    console.error(err);
  }
}
function fillRow(sel, list) {
  const tb = $(sel); tb.innerHTML = '';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.barcode}</td><td>${r.description}</td><td>${r.dept}</td>
      <td>${r.qty}</td><td>${r.exp_date}</td>
      <td class="${r.days_left < 0 ? 'red' : 'yellow'}">${r.days_left}</td>
      <td>${r.location}</td><td>${r.gondola_number || '-'}</td>`;
    tb.appendChild(tr);
  });
}
$('#dash-refresh').addEventListener('click', loadDashboard);
$('#dash-days').addEventListener('change', loadDashboard);
document.querySelector('.tab[data-tab="dash"]').addEventListener('click', loadDashboard);

/* ============================================================
   APPROVAL
   ============================================================ */
async function loadApprovals() {
  try {
    const out = await apiGet({ action:'listReqOrder', limit:100 });
    if (out.error) return;
    const tb = $('#approve-table tbody'); tb.innerHTML = '';
    out.rows.forEach(r => {
      const canAct = r.status === 'DRAFT';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.req_id}</td>
        <td>${r.timestamp ? new Date(r.timestamp).toLocaleString('id-ID') : '-'}</td>
        <td>${r.requested_by}</td><td>${r.dept}</td>
        <td>${r.total_items}</td>
        <td><span class="badge ${String(r.status).toLowerCase()}">${r.status}</span></td>
        <td>
          ${canAct ? `
            <button class="mini green" data-approve="${r.req_id}">Setujui</button>
            <button class="mini red" data-reject="${r.req_id}">Tolak</button>
          ` : '-'}
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-approve]').forEach(b =>
      b.addEventListener('click', () => setStatus(b.dataset.approve, 'APPROVED')));
    tb.querySelectorAll('[data-reject]').forEach(b =>
      b.addEventListener('click', () => {
        const reason = prompt('Alasan tolak?') || '';
        setStatus(b.dataset.reject, 'REJECTED', reason);
      }));
  } catch (err) {
    console.error(err);
  }
}
async function setStatus(reqId, status, reason) {
  const a = $('#approve-alert');
  a.className = 'alert info'; a.textContent = '⏳ Memproses...'; a.classList.remove('hidden');
  try {
    const out = await apiPost({ action:'updateReqStatus' }, {
      req_id: reqId, status, approved_by: session.username,
      reject_reason: reason || ''
    });
    if (out.error) { a.className='alert red'; a.textContent='❌ '+out.error; return; }
    a.className = 'alert green'; a.textContent = `✅ ${reqId} → ${status}`;
    loadApprovals();
  } catch (err) {
    a.className = 'alert red'; a.textContent = '❌ ' + err.message;
  }
}
document.querySelector('.tab[data-tab="approve"]')
  .addEventListener('click', loadApprovals);

/* ============================================================
   RESET FORM (SOH & RTC)
   ============================================================ */
function resetForm(prefix) {
  const form = $('#' + prefix + '-form');
  form.reset();
  const info = $(`#${prefix}-info`);
  if (info) info.classList.add('hidden');
  state[prefix].barcode = '';
  const bc = $(`#${prefix}-barcode`);
  if (bc) { bc.value = ''; bc.focus(); }
}

/* ============================================================
   INIT
   ============================================================ */
if (session?.token) showApp(); else showLogin();

// Auto-fill tanggal pengecekan = hari ini
(function initCheckDate() {
  const today = todayISO();
  $('#exp-check-date').value = today;
  expSession.check_date = today;
})();

updateExpSessionUI();
renderExpSessionList();
