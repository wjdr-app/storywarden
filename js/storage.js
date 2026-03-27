// storage.js — Helpers données JSON + localStorage
// La Larme d'Argent — Outil de gestion de campagne

const STORAGE_PREFIX = 'sw_data_';

/**
 * Résout l'identifiant de campagne actif.
 * Priorité : paramètre URL ?c=xxx > localStorage > défaut 'larmes'
 */
function getCampaignId() {
  const p = new URLSearchParams(window.location.search).get('c');
  if (p) { localStorage.setItem('sw_campaign', p); return p; }
  return localStorage.getItem('sw_campaign') || 'larmes';
}

/** Détecte le contexte Electron (preload injecte window.electronAPI) */
function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Charge un fichier JSON.
 * - Electron : via IPC readFile (AppData, fallback dossier projet dans main.js)
 * - Web     : localStorage > fetch static
 * @param {string} filename - nom du fichier (ex: "personnages.json")
 * @returns {Promise<Array|Object|null>}
 */
async function loadData(filename) {
  const cid = getCampaignId();

  if (isElectron()) {
    return window.electronAPI.readFile(cid + '/' + filename);
  }

  // Mode web : localStorage > fetch
  const localKey = STORAGE_PREFIX + cid + '_' + filename;
  const local = localStorage.getItem(localKey);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.warn('Données locales corrompues pour', filename, '— rechargement depuis fichier.');
      localStorage.removeItem(localKey);
    }
  }
  const path = 'data/' + cid + '/' + filename;
  const resp = await fetch(path);
  if (!resp.ok) throw new Error('Impossible de charger ' + path + ' (' + resp.status + ')');
  return resp.json();
}

/**
 * Sauvegarde un fichier JSON.
 * - Electron : via IPC writeFile (AppData)
 * - Web     : localStorage (sync GitHub via syncToGitHub() dans admin.html)
 * @param {string} filename
 * @param {Array|Object} data
 */
async function saveData(filename, data) {
  const cid = getCampaignId();
  if (isElectron()) {
    return window.electronAPI.writeFile(cid + '/' + filename, data);
  }
  saveLocal(filename, data);
}

/**
 * Sauvegarde des données modifiées en localStorage
 * @param {string} filename
 * @param {Array|Object} data
 */
function saveLocal(filename, data) {
  localStorage.setItem(STORAGE_PREFIX + getCampaignId() + '_' + filename, JSON.stringify(data));
}

/**
 * Efface les modifications locales pour un fichier (retour à la version JSON)
 * @param {string} filename
 */
function clearLocal(filename) {
  localStorage.removeItem(STORAGE_PREFIX + getCampaignId() + '_' + filename);
}

/**
 * Exporte les données modifiées en téléchargement JSON
 * @param {Array|Object} data
 * @param {string} filename
 */
function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Affiche une erreur de chargement dans un conteneur
 * @param {HTMLElement} container
 * @param {string} message
 */
function showError(container, message) {
  if (!container) return;
  container.innerHTML = `<p style="color:#7a1a0a;font-family:'Cinzel',serif;font-size:0.8rem;padding:20px;text-align:center;">
    ⚠ ${message}
  </p>`;
}
