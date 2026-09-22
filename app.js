// ====== KONFIGURASI ======
const API_URL = 'https://script.google.com/macros/s/GANTI_DENGAN_DEPLOYMENT_ID/exec';
// =========================

const $ = id => document.getElementById(id);
let currentBarcode = '';

// --- GET simple request ---
async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// --- POST pakai text/plain supaya tidak kena preflight CORS ---
async function apiPost(params, body) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`, {
    method: 'POST',
    // HARUS text/plain, jangan application/json (biar simple request)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// --- Scanner (HID = keyboard + Enter) ---
$('barcode').addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const bc = e.target.value.trim();
  if (!bc) return;

  showAlert('⏳ Mencari...', 'info');
  try {
    const item = await apiGet({ action: 'lookupBarcode', barcode: bc });
    if (item.error) {
      $('info').classList.add('hidden');
      currentBarcode = '';
      return showAlert('❌ ' + item.error, 'red');
    }
    currentBarcode = bc;
    $('f-sku').textContent  = item.sku;
    $('f-desc').textContent = item.description;
    $('f-dept').textContent = item.dept;
    $('f-ret').textContent  = item.returnable ? 'Ya' : 'Tidak';
    $('info').classList.remove('hidden');
    showAlert('✅ Barang ditemukan. Isi qty & exp date.', 'green');
    $('qty').focus();
  } catch (err) {
    showAlert('❌ Gagal lookup: ' + err.message, 'red');
  }
});

// --- Submit ---
$('form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentBarcode) return showAlert('Scan barcode dulu!', 'red');

  const payload = {
    barcode: currentBarcode,
    qty: $('qty').value,
    exp_date: $('exp_date').value,
    location: $('location').value,
    gondola_number: $('gondola_number').value,
    checked_by: localStorage.getItem('operator') || 'operator'
  };

  showAlert('⏳ Menyimpan...', 'info');
  try {
    const out = await apiPost({ action: 'saveExpiry' }, payload);
    if (out.error) return showAlert('❌ ' + out.error, 'red');
    showAlert('✅ Tersimpan (ID ' + out.id + '). Scan berikutnya...', 'green');
    resetForm();
  } catch (err) {
    showAlert('❌ Gagal simpan: ' + err.message, 'red');
  }
});

function resetForm() {
  $('form').reset();
  $('info').classList.add('hidden');
  $('barcode').value = '';
  currentBarcode = '';
  $('barcode').focus();
}

function showAlert(msg, color) {
  const a = $('alert');
  a.textContent = msg;
  a.className = 'alert ' + color;
  a.classList.remove('hidden');
}
