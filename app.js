// ====== KONFIG ======
const API_URL = 'https://script.google.com/macros/s/AKfycbyqp8Fr12wiiIB5cs_ngcqJjpmsuhfxXKUYlyzkbDFAjnAvYNb2zEsqLwQ-X9yBdPtS/exec';
// ====================

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------- Operator (persist) ---------- */
const operatorInput = $('#operator');
operatorInput.value = localStorage.getItem('operator') || '';
operatorInput.addEventListener('input', () => {
  localStorage.setItem('operator', operatorInput.value);
  $('#req-by').value = operatorInput.value;
});
$('#req-by').value = operatorInput.value;

/* ---------- Tabs ---------- */
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
    const firstInput = $('#tab-' + btn.dataset.tab).querySelector('.barcode-input');
    if (firstInput) firstInput.focus();
  });
});

/* ---------- API helpers ---------- */
async function apiGet(params) {
  const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function apiPost(params, body) {
  const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/* ---------- Alert helper ---------- */
function alertBox(prefix, msg, color) {
  const a = $('#' + prefix + '-alert');
  a.textContent = msg;
  a.className = 'alert ' + color;
  a.classList.remove('hidden');
}
function hideAlert(prefix) {
  $('#' + prefix + '-alert').classList.add('hidden');
}

/* ---------- Lookup handler untuk semua tab ---------- */
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
      const item = await apiGet({ action: 'lookupBarcode', barcode: bc });
      if (item.error) {
        state[prefix].barcode = '';
        $(`#${prefix}-info`)?.classList.add('hidden');
        alertBox(prefix, '❌ ' + item.error, 'red');
        return;
      }
      state[prefix].barcode = bc;
      if (prefix === 'req') {
        addReqItem(item);          // langsung masuk cart
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
  box.querySelector('[data-f="sku"]').textContent  = item.sku;
  box.querySelector('[data-f="dept"]').textContent = item.dept;
  box.querySelector('[data-f="desc"]').textContent = item.description;
  const ret = box.querySelector('[data-f="ret"]');
  if (ret) ret.textContent = item.returnable ? 'Ya' : 'Tidak';
  box.classList.remove('hidden');
}
function focusNext(prefix) {
  const map = { exp:'#exp-qty', soh:'#soh-qty', rtc:'#rtc-qty' };
  if (map[prefix]) $(map[prefix]).focus();
}

/* =========================================================
   CEK EXPIRED
   ========================================================= */
$('#exp-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.exp.barcode) return alertBox('exp', 'Scan barcode dulu!', 'red');
  const payload = {
    barcode: state.exp.barcode,
    qty: $('#exp-qty').value,
    exp_date: $('#exp-date').value,
    location: $('#exp-location').value,
    gondola_number: $('#exp-gondola').value,
    checked_by: localStorage.getItem('operator') || 'operator'
  };
  alertBox('exp', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action: 'saveExpiry' }, payload);
    if (out.error) return alertBox('exp', '❌ ' + out.error, 'red');
    alertBox('exp', '✅ Tersimpan (ID ' + out.id + ')', 'green');
    resetForm('exp');
  } catch (err) {
    alertBox('exp', '❌ ' + err.message, 'red');
  }
});

/* =========================================================
   SOH
   ========================================================= */
$('#soh-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.soh.barcode) return alertBox('soh', 'Scan barcode dulu!', 'red');
  const payload = {
    barcode: state.soh.barcode,
    qty_on_hand: $('#soh-qty').value,
    location: $('#soh-location').value,
    gondola_number: $('#soh-gondola').value,
    note: $('#soh-note').value,
    counted_by: localStorage.getItem('operator') || 'operator'
  };
  alertBox('soh', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action: 'saveSoh' }, payload);
    if (out.error) return alertBox('soh', '❌ ' + out.error, 'red');
    alertBox('soh', '✅ Tersimpan (ID ' + out.id + ')', 'green');
    resetForm('soh');
  } catch (err) {
    alertBox('soh', '❌ ' + err.message, 'red');
  }
});

/* =========================================================
   RTC
   ========================================================= */
$('#rtc-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.rtc.barcode) return alertBox('rtc', 'Scan barcode dulu!', 'red');
  const payload = {
    barcode: state.rtc.barcode,
    qty: $('#rtc-qty').value,
    reason: $('#rtc-reason').value,
    input_by: localStorage.getItem('operator') || 'operator'
  };
  alertBox('rtc', '⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action: 'saveRtc' }, payload);
    if (out.error) return alertBox('rtc', '❌ ' + out.error, 'red');
    alertBox('rtc', '✅ Tersimpan (ID ' + out.id + ')', 'green');
    resetForm('rtc');
  } catch (err) {
    alertBox('rtc', '❌ ' + err.message, 'red');
  }
});

/* =========================================================
   REQ ORDER
   ========================================================= */
const reqItems = [];   // {barcode, sku, description, qty, unit}

function addReqItem(item) {
  const exist = reqItems.find(x => x.barcode === item.barcode);
  if (exist) {
    exist.qty += 1;
  } else {
    reqItems.push({
      barcode: item.barcode, sku: item.sku,
      description: item.description, qty: 1, unit: 'PCS'
    });
  }
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
  tb.querySelectorAll('.req-qty').forEach(el => {
    el.addEventListener('input', e => {
      reqItems[e.target.dataset.idx].qty = Number(e.target.value);
    });
  });
  tb.querySelectorAll('.req-unit').forEach(el => {
    el.addEventListener('change', e => {
      reqItems[e.target.dataset.idx].unit = e.target.value;
    });
  });
  tb.querySelectorAll('.del').forEach(el => {
    el.addEventListener('click', e => {
      reqItems.splice(Number(e.target.dataset.del), 1);
      renderReqItems();
    });
  });
}

$('#req-submit').addEventListener('click', async () => {
  if (reqItems.length === 0) return alertBox('req', 'Belum ada item', 'red');
  const payload = {
    requested_by: localStorage.getItem('operator') || 'operator',
    dept: $('#req-dept').value,
    note: $('#req-note').value,
    items: reqItems
  };
  if (!payload.dept) return alertBox('req', 'Dept wajib diisi', 'red');
  alertBox('req', '⏳ Mengirim...', 'info');
  try {
    const out = await apiPost({ action: 'saveReqOrder' }, payload);
    if (out.error) return alertBox('req', '❌ ' + out.error, 'red');
    alertBox('req', '✅ Terkirim: ' + out.req_id, 'green');
    reqItems.length = 0;
    renderReqItems();
    $('#req-note').value = '';
  } catch (err) {
    alertBox('req', '❌ ' + err.message, 'red');
  }
});

/* ---------- Reset form ---------- */
function resetForm(prefix) {
  const form = $('#' + prefix + '-form');
  form.reset();
  $(`#${prefix}-info`)?.classList.add('hidden');
  state[prefix].barcode = '';
  $(`#${prefix}-barcode`).value = '';
  $(`#${prefix}-barcode`).focus();
}
