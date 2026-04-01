// nav-v2.js — Design System v2 Navigation — La Larme d'Argent
// Injecte topbar + sidebar sur toutes les pages via DOM injection
// Topbar: logo centré, nom campagne gauche, gear droit
// Sidebar: band 72px → 288px au hover, pictos SVG

const NAV_ITEMS = [
  { href: 'personnages.html',    label: 'Aventuriers', picto: 'aventuriers' },
  { href: 'pnjs.html',         label: 'PNJs',        picto: 'pnj' },
  { href: 'monstres.html',     label: 'Monstres',    picto: 'monstres' },
  { href: 'magasin.html',      label: 'Magasins',    picto: 'magasin' },
  { href: 'relations.html',    label: 'Relations',   picto: 'relations' },
  { sep: true },
  { href: 'quetes.html',       label: 'Quêtes',      picto: 'quetes' },
  { href: 'rapports.html',     label: 'Rapports',    picto: 'rapport' },
  { sep: true },
  { href: 'lore.html',         label: 'Lore',        picto: 'lore' },
  { href: 'codex.html',        label: 'Codex',       picto: 'codex' },
  { href: 'carte.html',        label: 'Carte',       picto: 'maps' },
  { href: 'lieux.html',        label: 'Lieux',       picto: 'lieux' },
  { href: 'timeline.html',     label: 'Chronologie', picto: 'chronologie' },
  { sep: true },
  { href: 'regles.html',       label: 'Règles',      picto: 'regles' },
  { href: 'combat-v2.html',    label: 'Combat',      picto: 'combats', mjOnly: true },
  { sep: true },
  { href: 'des.html',          label: 'Dés',         picto: 'des' },
];

const SETTINGS_KEY = 'sw_settings';

function _getCampaignId() {
  if (typeof getCampaignId === 'function') return getCampaignId();
  return localStorage.getItem('sw_campaign') || 'larmes';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function genRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return [group(), group(), group(), group()].join('-');
}

async function loadAuthData() {
  try {
    if (typeof window.electronAPI !== 'undefined') {
      const data = await window.electronAPI.readFile('auth.json');
      if (data) return data;
    }
  } catch (e) {}
  try { const s = localStorage.getItem('sw_auth_v1'); if (s) return JSON.parse(s); } catch (e) {}
  return null;
}

async function saveAuthData(data) {
  if (typeof window.electronAPI !== 'undefined') {
    try { await window.electronAPI.writeFile('auth.json', data); } catch (e) {}
  }
  localStorage.setItem('sw_auth_v1', JSON.stringify(data));
}

// ── PARAMÈTRES CAMPAGNE ──────────────────────────────────────────────────────
function getNavSettings() {
  try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return {};
}

async function fetchAndApplySettings() {
  try {
    const r = await fetch('data/' + _getCampaignId() + '/settings.json?_=' + Date.now());
    if (!r.ok) return;
    const s = await r.json();
    const _ex = getNavSettings();
    if (!s.nav_visible && _ex.nav_visible) s.nav_visible = _ex.nav_visible;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    _applySidebarVis(s);
  } catch (e) {}
}

// ── MODE MJ ──────────────────────────────────────────────────────────────────
function getMJMode() {
  // Web mode: require active MJ session (set when password modal succeeds)
  if (typeof window.electronAPI === 'undefined') {
    if (!sessionStorage.getItem('sw_mj_session')) return false;
  }
  return localStorage.getItem('sw_mj_mode') === 'true';
}

function setMJMode(val) {
  localStorage.setItem('sw_mj_mode', val ? 'true' : 'false');
  applyMJMode(val);
  _applySidebarVis();
  document.dispatchEvent(new CustomEvent('mjmodechange', { detail: { isMJ: val } }));
  document.dispatchEvent(new CustomEvent('larme-mj-change', { detail: { isMJ: val } }));
}

function applyMJMode(isMJ) {
  document.body.classList.toggle('mj-active', isMJ);
  const toggleEl = document.getElementById('toggle-mj');
  if (toggleEl) toggleEl.classList.toggle('on', isMJ);
}

function showMJPasswordModal() {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.id = 'mj-pwd-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `
      <div style="background:var(--surface,#393939);border:1.5px solid var(--border-mid,#555);border-radius:12px;padding:24px 28px;min-width:280px;max-width:340px;font-family:var(--font-body,'Noto Serif',serif);color:var(--text,#ECE9E0);">
        <div style="font-family:var(--font-ui,'Manrope',sans-serif);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px;color:var(--text-muted,#9E9C9A);">Mode MJ</div>
        <input id="mj-pwd-inp" type="password" placeholder="Mot de passe" autocomplete="current-password"
          style="width:100%;padding:8px 12px;background:var(--bg,#2D2D2D);border:1.5px solid var(--border-soft,#484848);border-radius:6px;color:var(--text,#ECE9E0);font-family:inherit;font-size:.9rem;outline:none;margin-bottom:8px;">
        <div id="mj-pwd-err" style="font-size:.72rem;color:#c55;font-style:italic;min-height:1.2em;margin-bottom:12px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="mj-pwd-cancel" style="padding:6px 16px;background:transparent;border:1px solid var(--border-soft,#484848);border-radius:6px;color:var(--text-muted,#9E9C9A);font-family:inherit;cursor:pointer;">Annuler</button>
          <button id="mj-pwd-ok" style="padding:6px 16px;background:var(--crimson-dim,#4a3035);border:1px solid var(--crimson-bd,#6b3038);border-radius:6px;color:#ffcccc;font-family:inherit;cursor:pointer;font-weight:600;">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const inp = document.getElementById('mj-pwd-inp');
    const err = document.getElementById('mj-pwd-err');
    function close(result) { ov.remove(); resolve(result); }
    async function trySubmit() {
      const auth = await loadAuthData();
      if (!auth || !auth.passwordHash || await sha256hex(inp.value) === auth.passwordHash) {
        // Mode web : flag de session so getMJMode() persiste entre les pages du meme onglet
        if (typeof window.electronAPI === 'undefined') {
          sessionStorage.setItem('sw_mj_session', '1');
        }
        close(true);
      }
      else { err.textContent = 'Mot de passe incorrect.'; inp.value = ''; inp.focus(); }
    }
    document.getElementById('mj-pwd-ok').onclick = trySubmit;
    document.getElementById('mj-pwd-cancel').onclick = () => close(false);
    ov.addEventListener('click', e => { if (e.target === ov) close(false); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') trySubmit(); if (e.key === 'Escape') close(false); });
    inp.focus();
  });
}

async function toggleMJTo(wantMJ) {
  const current = getMJMode();
  if (wantMJ === current) return;
  if (wantMJ) {
    const ok = await showMJPasswordModal();
    if (!ok) return;
    setMJMode(true);
  } else {
    setMJMode(false);
  }
}

function toggleMJ() { toggleMJTo(!getMJMode()); }

// ── VISIBILITÉ SIDEBAR (admin) ────────────────────────────────────────────────
function _applySidebarVis(cfg) {
  const nv = ((cfg && cfg.nav_visible) || getNavSettings().nav_visible) || {};
  const isMJ = getMJMode();
  document.querySelectorAll('.nav-item[href]').forEach(link => {
    const href = link.getAttribute('href');
    const key = href.replace('.html', '');
    const item = NAV_ITEMS.find(it => it.href === href);
    if (item && item.mjOnly) return;
    if (!isMJ && nv[key] === false) {
      link.classList.add('mj-only');
    } else {
      link.classList.remove('mj-only');
    }
  });
  document.querySelectorAll('.mod-card[href]').forEach(card => {
    const href = card.getAttribute('href');
    const key = href.replace('.html', '');
    const item = NAV_ITEMS.find(it => it.href === href);
    if (item && item.mjOnly) return;
    card.style.display = (!isMJ && nv[key] === false) ? 'none' : '';
  });
}

// ── INJECTION NAV (topbar + sidebar) ─────────────────────────────────────────
function injectNav() {
  if (document.querySelector('.topbar')) return; // déjà injecté

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const cfg = getNavSettings();

  // ── Topbar ──────────────────────────────────────────────────────────────────
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="btn-burger" id="btn-burger" title="Navigation" aria-label="Navigation">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="3" y1="7" x2="21" y2="7"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="17" x2="21" y2="17"/>
        </svg>
      </button>
    </div>
    <div class="topbar-center">
      <a href="index.html" class="topbar-logo-mask" title="Accueil" aria-label="Accueil"></a>
    </div>
    <div class="topbar-right">
      <div class="settings-wrap">
        <button class="btn-settings" id="btn-settings-gear" title="Paramètres" aria-label="Paramètres">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <div class="settings-menu" id="settings-menu">
          <div class="settings-item" id="settings-mj-row">
            <span>Mode MJ</span>
            <div class="toggle" id="toggle-mj"></div>
          </div>
          ${typeof window.electronAPI === 'undefined' ? '<a class="settings-item" href="admin.html">Administration</a>' : ''}
          <div class="settings-item" id="settings-change-camp">
            <span>Changer de campagne</span>
          </div>
        </div>
      </div>
    </div>`;

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const navHtml = NAV_ITEMS.map(item => {
    if (item.sep) return '';
    const isActive = currentPage === item.href ? ' active' : '';
    const mjOnly = item.mjOnly ? ' mj-only' : '';
    return `<a href="${escHtml(item.href)}" class="nav-item${isActive}${mjOnly}" title="${escHtml(item.label)}">
      <div class="nav-icon-area">
        <div class="nav-icon-pill">
          <span class="nav-ico" style="width:22px;height:22px;mask-image:url(assets/pictos/${item.picto}.svg);-webkit-mask-image:url(assets/pictos/${item.picto}.svg);"></span>
        </div>
      </div>
      <div class="nav-label-area">
        <span class="nav-label">${escHtml(item.label)}</span>
      </div>
    </a>`;
  }).join('');

  const sidebarWrap = document.createElement('div');
  sidebarWrap.className = 'sidebar-wrap';
  sidebarWrap.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-band"></div>
      <nav class="sidebar-nav">${navHtml}</nav>
    </div>`;

  // ── Enveloppement du contenu existant dans .main ──────────────────────────
  const frag = document.createDocumentFragment();
  while (document.body.firstChild) frag.appendChild(document.body.firstChild);

  const main = document.createElement('div');
  main.className = 'main';
  main.appendChild(frag);

  const pageBody = document.createElement('div');
  pageBody.className = 'page-body';
  pageBody.appendChild(sidebarWrap);
  pageBody.appendChild(main);

  document.body.appendChild(topbar);
  document.body.appendChild(pageBody);

  // ── Settings gear ────────────────────────────────────────────────────────────
  const gear = document.getElementById('btn-settings-gear');
  const menu = document.getElementById('settings-menu');
  if (gear && menu) {
    gear.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', () => menu.classList.remove('open'));
  }

  // ── MJ toggle ────────────────────────────────────────────────────────────────
  const toggleEl = document.getElementById('toggle-mj');
  const settingsRow = document.getElementById('settings-mj-row');
  if (toggleEl && settingsRow) {
    toggleEl.classList.toggle('on', getMJMode());
    settingsRow.addEventListener('click', async e => {
      e.stopPropagation();
      await toggleMJ();
      toggleEl.classList.toggle('on', getMJMode());
    });
  }

  // ── Changer campagne ─────────────────────────────────────────────────────────
  const changeCampBtn = document.getElementById('settings-change-camp');
  if (changeCampBtn) {
    changeCampBtn.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.remove('open');
      resetCampaignPick();
    });
  }

  // ── Mobile drawer ─────────────────────────────────────────────────────────────
  const mobileNavHtml = NAV_ITEMS.map(item => {
    if (item.sep) return '<div class="mobile-nav-sep"></div>';
    const isActive = currentPage === item.href ? ' active' : '';
    const mjOnly = item.mjOnly ? ' mj-only' : '';
    return `<a href="${escHtml(item.href)}" class="mobile-nav-item${isActive}${mjOnly}">
      <span class="mn-ico" style="mask-image:url(assets/pictos/${item.picto}.svg);-webkit-mask-image:url(assets/pictos/${item.picto}.svg);"></span>
      ${escHtml(item.label)}
    </a>`;
  }).join('');

  const mobileOverlay = document.createElement('div');
  mobileOverlay.className = 'mobile-overlay';
  mobileOverlay.id = 'mobile-overlay';
  mobileOverlay.innerHTML = `
    <div class="mobile-drawer">
      <div class="mobile-drawer-head">
        <span class="mobile-drawer-title">Navigation</span>
        <button class="btn-drawer-close" id="btn-drawer-close">&times;</button>
      </div>
      <nav class="mobile-nav">${mobileNavHtml}</nav>
    </div>`;
  document.body.appendChild(mobileOverlay);

  const burgerBtn = document.getElementById('btn-burger');
  if (burgerBtn) {
    burgerBtn.addEventListener('click', () => mobileOverlay.classList.add('open'));
  }
  const closeBtn = document.getElementById('btn-drawer-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => mobileOverlay.classList.remove('open'));
  }
  mobileOverlay.addEventListener('click', e => {
    if (!mobileOverlay.querySelector('.mobile-drawer').contains(e.target)) {
      mobileOverlay.classList.remove('open');
    }
  });

  applyMJMode(getMJMode());
  fetchAndApplySettings();

  // ── Zoom contenu (vue joueur Electron) ──────────────────────────────────────
  if (typeof window.electronAPI !== 'undefined' && typeof window.electronAPI.onContentZoom === 'function') {
    const ZOOM_KEY = 'sw_content_zoom';
    function _applyContentZoom(z) {
      const el = document.querySelector('.main');
      if (el) el.style.zoom = z;
    }
    const _storedZoom = parseFloat(localStorage.getItem(ZOOM_KEY) || '1');
    if (_storedZoom !== 1) _applyContentZoom(_storedZoom);
    window.electronAPI.onContentZoom(function(data) {
      const cur = parseFloat(localStorage.getItem(ZOOM_KEY) || '1');
      const next = data.action === 'reset' ? 1 : Math.round(Math.max(0.5, Math.min(3.0, cur + data.value)) * 100) / 100;
      localStorage.setItem(ZOOM_KEY, next);
      _applyContentZoom(next);
    });
  }
}

// ── MENU CONTEXTUEL SIDEBAR (clic droit sur logo topbar) ──────────────────────
function showSidebarMenu(e) {
  e.preventDefault();
  const ex = document.getElementById('nav-brand-ctx');
  if (ex) ex.remove();
  const m = document.createElement('div');
  m.id = 'nav-brand-ctx';
  m.className = 'nav-brand-ctx';
  m.style.left = e.clientX + 'px';
  m.style.top = e.clientY + 'px';
  const btn = document.createElement('button');
  btn.textContent = '\u2190 Changer de campagne';
  btn.onclick = resetCampaignPick;
  m.appendChild(btn);
  document.body.appendChild(m);
  function close(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close); } }
  setTimeout(() => document.addEventListener('click', close), 10);
}

function resetCampaignPick() {
  localStorage.removeItem('sw_campaign');
  localStorage.removeItem('sw_campaign_picked');
  window.location.reload();
}

// ── SÉLECTEUR DE CAMPAGNE ─────────────────────────────────────────────────────
let _pickerCamps = [];

async function checkCampaignAccess() {
  const params = new URLSearchParams(window.location.search);
  const qc = params.get('c');
  if (qc) { localStorage.setItem('sw_campaign', qc); return; }
  let camps = [];
  try {
    if (typeof window.electronAPI !== 'undefined') {
      const d = await window.electronAPI.readFile('campaigns.json');
      if (Array.isArray(d)) camps = d;
    } else {
      const r = await fetch('data/campaigns.json');
      if (r.ok) camps = await r.json();
    }
  } catch (e) {}
  if (!camps.length) { localStorage.setItem('sw_campaign', 'larmes'); return; }
  if (camps.length === 1 && !camps[0].password) {
    localStorage.setItem('sw_campaign', camps[0].id);
    return;
  }
  const picked = localStorage.getItem('sw_campaign_picked');
  if (picked && camps.some(c => c.id === picked)) {
    localStorage.setItem('sw_campaign', picked);
    return;
  }
  await showCampaignPickerOverlay(camps);
}

async function showCampaignPickerOverlay(camps) {
  _pickerCamps = camps;
  const settings = await Promise.all(camps.map(c =>
    fetch('data/' + c.id + '/settings.json')
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}))
  ));
  return new Promise(resolve => {
    window._pickerResolve = resolve;
    const ov = document.createElement('div');
    ov.id = 'camp-picker-ov';
    ov.style.cssText = "position:fixed;inset:0;background:var(--bg,#2D2D2D);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-body,'Noto Serif',serif);color:var(--text,#ECE9E0);padding:20px;";
    ov.innerHTML =
      '<div style="font-family:var(--font-ui,\'Manrope\',sans-serif);font-size:1rem;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px;font-weight:700;">Story Warden</div>' +
      '<div style="font-size:.85rem;color:var(--text-dim,#797876);font-style:italic;margin-bottom:40px">Sélectionnez votre campagne</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;width:100%;max-width:420px">' +
      camps.map((c, i) => {
        const s = settings[i] || {};
        const hasBg = s.hero_bg_type === 'image' && s.hero_bg_image;
        const bgStyle = hasBg
          ? 'background:linear-gradient(rgba(0,0,0,.52),rgba(0,0,0,.52)),url(' + s.hero_bg_image + ') center/cover;'
          : 'background:var(--surface,#393939);';
        return '<div style="' + bgStyle + 'border:1.5px solid var(--border-soft,#484848);border-radius:12px;padding:20px 24px;">' +
          '<div style="font-family:var(--font-ui,\'Manrope\',sans-serif);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:' + (c.password ? '14px' : '10px') + '">' + c.nom + '</div>' +
          (c.password
            ? '<input id="picker-pw-' + i + '" type="password" placeholder="Mot de passe" style="width:100%;padding:8px 12px;background:var(--bg,#2D2D2D);border:1.5px solid var(--border-soft,#484848);border-radius:7px;color:var(--text,#ECE9E0);font-family:var(--font-body,\'Noto Serif\',serif);font-size:.9rem;outline:none;margin-bottom:8px;" onkeydown="if(event.key===\'Enter\')pickerSubmit(' + i + ')">'
            + '<div id="picker-err-' + i + '" style="color:#c55;font-size:.75rem;min-height:1em;margin-bottom:8px"></div>'
            : '') +
          '<button onclick="pickerSubmit(' + i + ')" style="background:var(--crimson,#9E3A44);border:none;border-radius:7px;color:var(--text,#ECE9E0);font-family:var(--font-ui,\'Manrope\',sans-serif);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;padding:9px 22px;cursor:pointer;font-weight:700;">Rejoindre &#8594;</button>' +
          '</div>';
      }).join('') +
      '</div>';
    document.body.appendChild(ov);
  });
}

function pickerSubmit(i) {
  const c = _pickerCamps[i];
  if (c.password) {
    const inp = document.getElementById('picker-pw-' + i);
    const pw = inp ? inp.value : '';
    const errEl = document.getElementById('picker-err-' + i);
    if (pw !== c.password) {
      if (errEl) errEl.textContent = 'Mot de passe incorrect.';
      return;
    }
  }
  localStorage.setItem('sw_campaign', c.id);
  localStorage.setItem('sw_campaign_picked', c.id);
  const ov = document.getElementById('camp-picker-ov');
  if (ov) ov.remove();
  window._pickerResolve && window._pickerResolve();
}

// ── INIT ──────────────────────────────────────────────────────────────────────

// ── PORTRAIT LIGHTBOX ─────────────────────────────────────────────────────────
function openPortraitLightbox(src, alt) {
  if (!src) return;
  let lb = document.getElementById('sw-portrait-lb');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'sw-portrait-lb';
    lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:lbIn .18s ease';
    lb.innerHTML = '<img id="sw-portrait-lb-img" style="max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 8px 60px rgba(0,0,0,.8);object-fit:contain" alt="">';
    lb.addEventListener('click', closePortraitLightbox);
    document.head.insertAdjacentHTML('beforeend','<style>@keyframes lbIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}</style>');
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closePortraitLightbox(); });
    document.body.appendChild(lb);
  }
  document.getElementById('sw-portrait-lb-img').src = src;
  document.getElementById('sw-portrait-lb-img').alt = alt || '';
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closePortraitLightbox() {
  const lb = document.getElementById('sw-portrait-lb');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

window._swCampaignReady = new Promise(function(resolve) {
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body && document.body.hasAttribute('data-no-nav')) { resolve(); return; }
    await checkCampaignAccess();
    resolve();
    injectNav();
  });
});
