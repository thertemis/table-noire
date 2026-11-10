// Default equipment spots of a campaign (used while campaigns.equipSlots is empty).
// Keep in sync with DEFAULT_SLOTS in web/equipment.js.
// x / y are in the pixel space of the 420x890 body plates; front view: image left = character's right.
const finger = (side, x) => [['pouce', 'Pouce'], ['index', 'Index'], ['majeur', 'Majeur'], ['annulaire', 'Annulaire'], ['auriculaire', 'Auriculaire']]
  .map(([k, l], i) => ({ id: `${k}_${side}`, label: `${l} ${side === 'd' ? 'droit' : 'gauche'}`, type: 'doigt', view: 'front', x: x[i], y: [452, 498, 506, 502, 490][i], cap: 1 }));

export const DEFAULT_SLOTS = [
  { id: 'tete', label: 'Tête', type: 'tete', view: 'front', x: 213, y: 28, cap: 1 },
  { id: 'oreille_d', label: 'Oreille droite', type: 'oreille', view: 'front', x: 172, y: 72, cap: 3 },
  { id: 'oreille_g', label: 'Oreille gauche', type: 'oreille', view: 'front', x: 254, y: 72, cap: 3 },
  { id: 'cou', label: 'Cou', type: 'cou', view: 'front', x: 213, y: 124, cap: 2 },
  { id: 'teton_d', label: 'Téton droit', type: 'teton', view: 'front', x: 180, y: 205, cap: 1 },
  { id: 'teton_g', label: 'Téton gauche', type: 'teton', view: 'front', x: 246, y: 205, cap: 1 },
  { id: 'haut', label: 'Haut', type: 'haut', view: 'front', x: 213, y: 252, cap: 2 },
  { id: 'corps', label: 'Corps', type: 'corps', view: 'front', x: 213, y: 330, cap: 1 },
  { id: 'ceinture', label: 'Taille', type: 'ceinture', view: 'front', x: 213, y: 410, cap: 1 },
  { id: 'bas', label: 'Bas', type: 'bas', view: 'front', x: 213, y: 545, cap: 2 },
  { id: 'pieds', label: 'Pieds', type: 'pieds', view: 'front', x: 213, y: 862, cap: 2 },
  { id: 'poignet_d', label: 'Poignet droit', type: 'poignet', view: 'front', x: 74, y: 414, cap: 2 },
  { id: 'poignet_g', label: 'Poignet gauche', type: 'poignet', view: 'front', x: 352, y: 414, cap: 2 },
  ...finger('d', [78, 64, 46, 28, 12]),
  ...finger('g', [348, 362, 380, 398, 414]),
  { id: 'dos', label: 'Dos', type: 'dos', view: 'back', x: 213, y: 240, cap: 1 },
  { id: 'tenu_g', label: 'Main gauche (tenu)', type: 'tenu', view: 'back', x: 40, y: 462, cap: 1 },
  { id: 'tenu_d', label: 'Main droite (tenu)', type: 'tenu', view: 'back', x: 386, y: 462, cap: 1 },
];

export function campaignSlots(campaign) {
  try { const s = JSON.parse(campaign?.equipSlots || 'null'); if (Array.isArray(s) && s.length) return s; } catch { /* default */ }
  return DEFAULT_SLOTS;
}
