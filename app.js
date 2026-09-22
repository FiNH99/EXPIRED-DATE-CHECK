// ============================================================
// KONFIGURASI — GANTI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyqp8Fr12wiiIB5cs_ngcqJjpmsuhfxXKUYlyzkbDFAjnAvYNb2zEsqLwQ-X9yBdPtS/exec';
// ============================================================

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------- Session ---------- */
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
  $$('.tab[data-role="manager"]').forEach(t => {
    t.style.display = session.role === 'manager' ? '' : 'none';
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
    a.className = 'alert red'; a
