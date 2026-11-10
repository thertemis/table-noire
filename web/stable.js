/* stable.js — keeps re-renders from flickering (loaded last, so it wraps every other render hook).
   The mockup rebuilds #main on every render: tiles replayed their entrance animation and showed one
   unpacked frame before packBento ran (two animation frames later). Here the bento is packed in the
   same task as the render (before the browser paints) and a tile only animates the first time it
   appears on a given tab and character. */
const STABLE = { seen: new Set(), key: '' };
const _renderStable = render;
render = function () {
  _renderStable();
  const key = `${S.tab}|${typeof SH !== 'undefined' ? SH.charId : ''}`;
  if (key !== STABLE.key) { STABLE.key = key; STABLE.seen.clear(); }
  for (const t of document.querySelectorAll('#main [data-tile]')) {
    if (STABLE.seen.has(t.dataset.tile)) t.style.animation = 'none'; else STABLE.seen.add(t.dataset.tile);
  }
  I18N.translate(document.getElementById('main'));   // English: tiles must be measured with their final text
  if (typeof packBento === 'function') packBento();   // synchronous: no unpacked frame is ever painted
};

/* Module check: each file of the app (see web/README.md) defines these names; a file that failed to load
   (flaky network, partial update) would leave the app half-working, so say it plainly. */
{
  const MODULES = { 'i18n.js': 'applyServerLang', 'app.js': 'renderFiche', 'fidgets.js': 'packBento', 'portrait.js': 'portraitHtml', 'settings.js': 'applySettings', 'online.js': 'enterCampaign',
    'security.js': 'cleanPortrait', 'sheet.js': 'loadSheet', 'inventory.js': 'loadInventory', 'world.js': 'loadWorld', 'equipment.js': 'renderEquipment',
    'templates.js': 'applyLayout', 'campaign.js': 'subscribeCampaign', 'rolls.js': 'sheetRoll', 'initiative.js': 'renderIniBar', 'reveal.js': 'showReveal',
    'fog.js': 'placeFog', 'gmtools.js': 'renderSessions', 'backup.js': 'exportCampaign', 'comfort.js': 'retryPending', 'library.js': 'libExport', 'notebook.js': 'renderNotebook', 'npc.js': 'renderNpcLibrary', 'lore.js': 'loreOverview', 'polls.js': 'pollsModal', 'identity.js': 'dispName', 'images.js': 'openCropper' };
  // typeof on each binding: works for function declarations and for the const of search.js (SRCH)
  const has = { applyServerLang: typeof applyServerLang, renderFiche: typeof renderFiche, packBento: typeof packBento, portraitHtml: typeof portraitHtml, applySettings: typeof applySettings,
    enterCampaign: typeof enterCampaign, cleanPortrait: typeof cleanPortrait, loadSheet: typeof loadSheet, loadInventory: typeof loadInventory,
    loadWorld: typeof loadWorld, renderEquipment: typeof renderEquipment, applyLayout: typeof applyLayout, subscribeCampaign: typeof subscribeCampaign,
    sheetRoll: typeof sheetRoll, renderIniBar: typeof renderIniBar, showReveal: typeof showReveal, placeFog: typeof placeFog, logChange: typeof logChange,
    exportCampaign: typeof exportCampaign, retryPending: typeof retryPending, renderSessions: typeof renderSessions, libExport: typeof libExport,
    renderNotebook: typeof renderNotebook, renderNpcLibrary: typeof renderNpcLibrary, loreOverview: typeof loreOverview, pollsModal: typeof pollsModal, dispName: typeof dispName, openCropper: typeof openCropper, SRCH: typeof SRCH };
  const missing = Object.entries(MODULES).filter(([, name]) => has[name] !== 'function').map(([f]) => f);
  if (has.SRCH !== 'object') missing.push('search.js');
  if (missing.length) {
    console.error('Table Noire — modules manquants :', missing.join(', '));
    document.addEventListener('DOMContentLoaded', () => toast(`Chargement incomplet (${missing.join(', ')}). Recharge la page.`));
  }
}
