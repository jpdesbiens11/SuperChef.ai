// 04 · Provigo : liste d'épicerie par rayon (R-10, R-11). Repris de Gordon Rams.ai.
import { S, $, DEPTS, iso, norm, weekLabel, render, toast, errText } from '../etat.js?v=1.26.0';
import { el, ico, patcher } from '../el.js?v=1.26.0';
import { getRecipe, majArticle, supprimerArticle, ajouterArticle, slug, relireEpicerie, ajouterLigneEpi, majLigneEpi, supprimerLigneEpi } from '../donnees.js?v=1.26.0';
import { ingKey, niceName, deptOf, invMatch, isStaple, neverBuy, zoneOf } from '../cuisine.js?v=1.26.0';
import { valeurCellule } from '../store.js?v=1.26.0';
import { frozen } from './fiche.js?v=1.26.0';
import { setQty, addInv } from './garde-manger.js?v=1.26.0';
import { panelHead, skeleton, noticeWarn, frameEmpty } from './commun.js?v=1.26.0';
import { CATALOGUE, rayonDe, cleRayon, ajouterLibre, suggestions } from '../epicerie.js?v=1.26.0';

/* ---------- D-G-062 : la liste vit dans l'onglet « Épicerie » du classeur ----------
   L'écran change tout de suite ; l'écriture suit, une à la fois par ligne (deux touchers rapides ne font pas deux lignes).
   On relit l'onglet en ouvrant Provigo ou le garde-manger et en revenant dans l'app : le PC et le téléphone voient la même liste. */
const oui = (v) => /^(oui|true|vrai|1)$/i.test(String(v || '').trim());
const semaine = () => iso(S.weekStart);
const jour = () => iso(new Date());
export const libres = () => S.prov.libres || (S.prov.libres = []);
const nouvelId = () => `e-l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const idCoche = (key) => `e-c-${semaine()}-${slug(key) || 'x'}`;
const idRayon = (cle) => `e-r-${slug(cle) || 'x'}`;
const idMemo = (cle) => `e-m-${slug(cle) || 'x'}`;
const memo = () => S.prov.memo || (S.prov.memo = {});

export function depuisClasseur() {
  const rows = S.prov.rows || [], w = semaine();
  S.prov.libres = rows.filter((r) => r.Genre === 'libre' && r.Nom).map((r) => ({ id: r.id, nom: r.Nom, rayon: r.Rayon || rayonDe(r.Nom), pris: oui(r.Pris) }));
  S.prov.checked = Object.fromEntries(rows.filter((r) => r.Genre === 'coche' && String(r['Semaine du']).slice(0, 10) === w && r['Clé']).map((r) => [r['Clé'], oui(r.Pris)]));
  S.prov.appris = Object.fromEntries(rows.filter((r) => r.Genre === 'rayon' && r.Nom).map((r) => [r.Nom, r.Rayon]));
  // D-G-063 : la mémoire de tout ce qui a été ajouté à la main (rappelé en tapant, les plus fréquents d'abord).
  S.prov.memo = Object.fromEntries(rows.filter((r) => r.Genre === 'memo' && r.Nom).map((r) => [r['Clé'] || cleRayon(r.Nom), { nom: r.Nom, rayon: r.Rayon || rayonDe(r.Nom), fois: Math.max(1, Number(r.Fois) || 1) }]));
}
const file = new Map();
// État de l'enregistrement, montré à côté du bouton « Enregistrer toute la liste dans Google Drive ».
const fini = (ok) => {
  S.prov.enCours = Math.max(0, (S.prov.enCours || 1) - 1);
  if (ok) S.prov.enregistre = new Date(); else S.prov.erreur = true;
  if (!S.prov.enCours && (S.view === 'provigo' || S.view === 'livre')) render();
  return ok;
};
function synchroniser(id, souhait) {
  S.prov.enCours = (S.prov.enCours || 0) + 1;
  const p = (file.get(id) || Promise.resolve()).then(async () => {
    const row = (S.prov.rows || []).find((r) => r.id === id), v = souhait();
    if (!v) { if (row) await supprimerLigneEpi(row); return true; }
    if (!row) { await ajouterLigneEpi({ id, ...v, 'Modifié le': jour() }); return true; }
    const diff = Object.fromEntries(Object.entries(v).filter(([c, x]) => row[c] !== valeurCellule(x)));
    if (Object.keys(diff).length) await majLigneEpi(row, { ...diff, 'Modifié le': jour() });
    return true;
  }).catch((e) => { toast('Épicerie non enregistrée dans ton classeur : ' + errText(e)); return false; }).then(fini);
  file.set(id, p);
  return p;
}
const syncLibre = (id) => synchroniser(id, () => {
  const a = libres().find((x) => x.id === id);
  return a && { Genre: 'libre', 'Semaine du': semaine(), Nom: a.nom, Rayon: a.rayon, Pris: a.pris };
});
const syncCoche = (key) => synchroniser(idCoche(key), () => ({ Genre: 'coche', 'Semaine du': semaine(), 'Clé': key, Nom: (S.prov.lines || []).find((l) => l.key === key)?.name || key, Pris: !!S.prov.checked[key] }));
const syncRayon = (cle) => synchroniser(idRayon(cle), () => S.prov.appris[cle] && { Genre: 'rayon', Nom: cle, Rayon: S.prov.appris[cle] });
const syncMemo = (cle) => synchroniser(idMemo(cle), () => { const m = memo()[cle]; return m && { Genre: 'memo', Nom: m.nom, Rayon: m.rayon, 'Clé': cle, Fois: m.fois }; });
// Chaque ajout à la main est noté (ou compté une fois de plus) : il reviendra en suggestion, même retiré de la liste.
function noter(nom, rayon) {
  const c = cleRayon(nom); if (!c) return;
  const m = memo()[c];
  memo()[c] = { nom, rayon, fois: (m ? m.fois : 0) + 1 };
  syncMemo(c);
}
export function oublierMemo(c) {
  const m = memo()[c]; if (!m) return;
  delete memo()[c]; syncMemo(c); majSuggestions(S.prov.q || ''); render();
  toast(`« ${m.nom} » oublié`, { label: 'Annuler', fn: () => { memo()[c] = m; syncMemo(c); majSuggestions(S.prov.q || ''); render(); } });
}

let relecture = null;
export function rafraichirEpicerie() {
  if (!S.ctx || relecture) return relecture;
  relecture = (async () => {
    try { await Promise.all(file.values()); await relireEpicerie(); depuisClasseur(); render(); } catch (e) { /* hors ligne : on garde l'écran */ }
    relecture = null;
  })();
  return relecture;
}

// Une fois : ce que 1.24.0 gardait dans le téléphone passe dans le classeur.
const CLE_LIBRES = 'superchef-epicerie-libre', CLE_APPRIS = 'superchef-epicerie-rayons';
const lireLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const oublier = (k) => { try { localStorage.removeItem(k); } catch (_) { /* stockage absent */ } };
export async function initEpicerie() {
  depuisClasseur();
  const envois = [], cles = [];
  const vieux = lireLocal(CLE_LIBRES);
  if (Array.isArray(vieux)) {
    cles.push(CLE_LIBRES);
    for (const a of vieux) {
      if (!a || !a.nom || libres().some((x) => cleRayon(x.nom) === cleRayon(a.nom) && x.pris === !!a.pris)) continue;
      const id = nouvelId(); libres().push({ id, nom: a.nom, rayon: a.rayon || rayonDe(a.nom, S.prov.appris), pris: !!a.pris }); envois.push(syncLibre(id));
    }
  }
  const appris = lireLocal(CLE_APPRIS);
  if (appris && typeof appris === 'object') {
    cles.push(CLE_APPRIS);
    for (const [c, r] of Object.entries(appris)) if (!S.prov.appris[c]) { S.prov.appris[c] = r; envois.push(syncRayon(c)); }
  }
  const cleSem = 'superchef-provigo-' + semaine(), coches = lireLocal(cleSem);
  if (coches && typeof coches === 'object') {
    cles.push(cleSem);
    for (const [k, v] of Object.entries(coches)) if (v && !S.prov.checked[k]) { S.prov.checked[k] = true; envois.push(syncCoche(k)); }
  }
  // D-G-063 : les articles libres d'avant la mémoire y entrent une fois.
  for (const a of libres()) { const c = cleRayon(a.nom); if (c && !memo()[c]) { memo()[c] = { nom: a.nom, rayon: a.rayon, fois: 1 }; envois.push(syncMemo(c)); } }
  if (!envois.length && !cles.length) return;
  if ((await Promise.all(envois)).every(Boolean)) cles.forEach(oublier);
  render();
}

// « Enregistrer toute la liste dans Google Drive » : la semaine (si elle n'est pas approuvée : les ingrédients en dépendent),
// puis chaque article, case cochée, rayon et mémoire, réécrits au besoin ; on relit ensuite l'onglet pour le confirmer.
export async function enregistrerTout(approuver) {
  if (S.prov.sauvegarde || !S.ctx) return;
  S.prov.sauvegarde = true; S.prov.erreur = false; render();
  let ok = true;
  try {
    if (!S.saved && S.plan.some(Boolean)) { await approuver(); ok = S.saved; }
    const envois = [...libres().map((a) => syncLibre(a.id)), ...Object.keys(S.prov.checked || {}).map(syncCoche),
      ...Object.keys(S.prov.appris || {}).map(syncRayon), ...Object.keys(memo()).map(syncMemo)];
    ok = (await Promise.all(envois)).every(Boolean) && ok;
    await relireEpicerie(); depuisClasseur();
    const n = libres().filter((a) => !a.pris).length;
    if (ok) { S.prov.enregistre = new Date(); toast(`Liste enregistrée dans Google Drive : ${n} article${n > 1 ? 's' : ''} à toi, ${Object.keys(memo()).length} en mémoire.`); }
    else { S.prov.erreur = true; toast('Une partie de la liste n\'est pas enregistrée. Réessaie dans un moment.'); }
  } catch (e) { S.prov.erreur = true; toast(errText(e)); }
  S.prov.sauvegarde = false; render();
}
const hm = (d) => `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
function etatDrive() {
  if (S.prov.sauvegarde || S.prov.enCours) return 'Enregistrement dans Google Drive…';
  if (S.prov.erreur) return 'Pas tout enregistré : touche le bouton pour réessayer.';
  if (!S.saved && S.plan.some(Boolean)) return 'Semaine pas encore approuvée : le bouton l\'approuve aussi, pour la même liste partout.';
  return S.prov.enregistre ? `Tout est dans Google Drive · ${hm(S.prov.enregistre)}` : 'Ta liste s\'enregistre dans Google Drive à chaque changement.';
}

/* ---------- D-G-063 : suggestions pendant qu'on tape ---------- */
function sources() {
  return [...Object.values(memo()).map((m) => ({ ...m, origine: 'memo' })),
    ...(S.inv.items || []).map((i) => ({ nom: i.name, rayon: i.dept || rayonDe(i.name, S.prov.appris), origine: 'inv' })),
    ...CATALOGUE.map(([nom, rayon]) => ({ nom, rayon, origine: 'cat' }))];
}
function listeSuggestions() {
  const q = S.prov.q || ''; if (!q.trim()) return [];
  const deja = new Set(libres().filter((a) => !a.pris).map((a) => cleRayon(a.nom)));
  return suggestions(q, sources(), 8).map((x) => {
    const c = cleRayon(x.nom), dessus = deja.has(c);
    return el('div', { class: 'sugg' },
      el('button', { type: 'button', class: 'sugg-choix', 'data-episugg': x.nom, 'data-rayon': x.rayon, disabled: dessus },
        el('span', {}, x.nom), el('small', {}, [x.rayon, dessus ? 'déjà sur la liste' : x.origine === 'memo' ? `ajouté ${x.fois} fois` : x.origine === 'inv' ? 'au garde-manger' : ''].filter(Boolean).join(' · '))),
      x.origine === 'memo' && el('button', { type: 'button', class: 'btn icon', 'data-epioubli': c, 'aria-label': `Oublier ${x.nom}`, title: 'Oublier' }, '×'));
  });
}
export function majSuggestions(q) {
  S.prov.q = q;
  const n = $('#epi-sugg'); if (n) patcher(n, listeSuggestions());
}

/* ---------- articles libres (D-G-060), gardés aussi au garde-manger (D-G-062) ---------- */
// L'article entre dans l'inventaire (quantité 0 : à acheter) s'il n'y est pas : il revient au garde-manger, prêt à remettre sur la liste.
async function memoriser(nom, rayon) {
  if (!S.inv.items || invMatch(ingKey(nom))) return;
  try { await ajouterArticle(nom, zoneOf(rayon), rayon, 0); render(); } catch (e) { toast(errText(e)); }
}
export function ajouterArticleLibre(nom, rayonChoisi, apprendre = true) {
  const auto = rayonDe(nom, S.prov.appris), rayon = rayonChoisi || auto;
  const r = ajouterLibre(libres(), nom, rayon, nouvelId());
  if (r.doublon) { toast(`« ${r.doublon.nom} » est déjà sur la liste (${r.doublon.rayon}).`); return false; }
  if (!r.article) return false;
  if (apprendre && rayonChoisi && rayonChoisi !== auto) { const c = cleRayon(nom); S.prov.appris[c] = rayonChoisi; syncRayon(c); }
  S.prov.libres = r.liste; S.prov.q = ''; render();
  toast(`« ${r.article.nom} » ajouté · ${rayon}`);
  syncLibre(r.article.id); noter(r.article.nom, rayon); memoriser(r.article.nom, rayon);
  return true;
}
// Choix rapide (et bouton « Épicerie » du garde-manger) : touche une fois pour l'ajouter, une 2e fois pour le retirer.
export const surLaListe = (nom) => libres().some((x) => !x.pris && cleRayon(x.nom) === cleRayon(nom));
export function basculerIdee(nom, rayon) {
  const a = libres().find((x) => !x.pris && cleRayon(x.nom) === cleRayon(nom));
  if (a) { S.prov.libres = libres().filter((x) => x !== a); render(); toast(`« ${a.nom} » retiré de l'épicerie`); syncLibre(a.id); }
  else ajouterArticleLibre(nom, rayon && DEPTS.includes(rayon) ? rayon : '', false);
}
export async function cocherLibre(id) {
  const a = libres().find((x) => x.id === id); if (!a) return;
  a.pris = !a.pris; render(); syncLibre(id);
  const m = invMatch(ingKey(a.nom));
  if (a.pris) { if (m) await setQty(m, m.qty + 1); else await addInv(a.nom); } else if (m && m.qty > 0) await setQty(m, m.qty - 1);
}
export function retirerLibre(id) {
  const avant = libres(), a = avant.find((x) => x.id === id); if (!a) return;
  S.prov.libres = avant.filter((x) => x.id !== id); render(); syncLibre(id);
  toast(`« ${a.nom} » retiré`, { label: 'Annuler', fn: () => { S.prov.libres = avant; render(); syncLibre(id); } });
}
export function viderPris() {
  const avant = libres(), pris = avant.filter((x) => x.pris); if (!pris.length) return;
  S.prov.libres = avant.filter((x) => !x.pris); render(); pris.forEach((x) => syncLibre(x.id));
  const n = pris.length;
  toast(`${n} article${n > 1 ? 's' : ''} pris retiré${n > 1 ? 's' : ''}`, { label: 'Annuler', fn: () => { S.prov.libres = avant; render(); pris.forEach((x) => syncLibre(x.id)); } });
}
export const focusLibre = () => { const i = $('#epi-nom'); if (i) { i.value = ''; i.focus(); } };

const puceIdee = (n, rayon, deja) => el('button', { type: 'button', class: 'btn', 'data-epiajout': n, 'data-rayon': rayon || null, 'aria-pressed': String(deja.has(cleRayon(n))) }, n);
// D-G-063 : section « Mes articles », sous les ingrédients des recettes. Bouton Google Drive en tête, saisie avec
// suggestions (mémoire, garde-manger, catalogue), tes articles par rayon, puis ce qui revient souvent.
function sectionLibre() {
  const ls = libres(), deja = new Set(ls.filter((a) => !a.pris).map((a) => cleRayon(a.nom))), pris = ls.filter((a) => a.pris).length;
  // Seulement ce qu'on peut encore ajouter (ce qui est déjà sur la liste est juste au-dessus).
  const epuises = (S.inv.items || []).filter((i) => i.qty <= 0 && !i.essential && !deja.has(cleRayon(i.name)));   // pas les essentiels : toujours à la maison
  const habituels = Object.values(memo()).filter((m) => !deja.has(cleRayon(m.nom))).sort((x, y) => y.fois - x.fois || x.nom.localeCompare(y.nom, 'fr')).slice(0, 30);
  const occupe = !!(S.prov.sauvegarde || S.prov.enCours);
  return el('section', { id: 'epi-section', class: 'frame epi-libre', 'aria-labelledby': 'epi-titre' },
    el('div', { class: 'epi-tete' }, el('h3', { id: 'epi-titre' }, 'Mes articles', el('small', {}, String(ls.filter((a) => !a.pris).length))),
      el('button', { class: 'btn primary epi-drive', id: 'epi-drive', type: 'button', disabled: S.prov.sauvegarde }, ico('save'), S.prov.sauvegarde ? 'Enregistrement…' : 'Enregistrer toute la liste dans Google Drive'),
      el('p', { class: `epi-etat${S.prov.erreur ? ' warn' : ''}`, role: 'status' }, occupe ? 'Enregistrement dans Google Drive…' : etatDrive())),
    el('form', { class: 'add-form', id: 'epiform' },
      el('input', { id: 'epi-nom', value: S.prov.q || '', placeholder: 'Ajouter un article (ex. déodorant)', 'aria-label': 'Article à ajouter', 'aria-controls': 'epi-sugg', autocomplete: 'off', enterkeyhint: 'done' }),
      el('select', { id: 'epi-rayon', 'aria-label': 'Rayon' }, el('option', { value: '' }, 'Rayon auto'), DEPTS.map((d) => el('option', { value: d }, d))),
      el('button', { class: 'btn primary', type: 'submit' }, ico('plus'), 'Ajouter')),
    el('div', { id: 'epi-sugg', class: 'epi-sugg', role: 'list' }, listeSuggestions()),
    ls.length ? DEPTS.map((d) => {
      const lib = ls.filter((a) => a.rayon === d); if (!lib.length) return null;
      return el('div', { class: 'dept' }, el('h3', {}, d, el('small', {}, String(lib.length))), lib.map(ligneLibre));
    }) : el('p', { class: 'hint' }, 'Rien d\'ajouté à la main pour l\'instant. Tape un article : ceux que tu as déjà ajoutés reviennent en premier.'),
    pris ? el('button', { class: 'btn', id: 'epi-vider', type: 'button' }, `Retirer les articles pris (${pris})`) : null,
    habituels.length ? el('div', { class: 'epi-groupe epi-habituels' }, el('b', {}, `Tes articles habituels · touche pour ajouter (${habituels.length})`),
      el('div', { class: 'epi-puces' }, habituels.map((m) => puceIdee(m.nom, m.rayon, deja)))) : null,
    epuises.length ? el('div', { class: 'epi-groupe epi-epuises' }, el('b', {}, `À racheter · épuisé au garde-manger (${epuises.length})`),
      el('div', { class: 'epi-puces' }, epuises.map((i) => puceIdee(i.name, i.dept, deja)))) : null,
    el('details', { id: 'epi-idees', class: 'epi-idees' }, el('summary', {}, 'Choix rapides : garde-manger et maison'),
      DEPTS.map((d) => {
        const ns = CATALOGUE.filter(([, r]) => r === d); if (!ns.length) return null;
        return el('div', { class: 'epi-groupe' }, el('b', {}, d), el('div', { class: 'epi-puces' }, ns.map(([n]) => puceIdee(n, d, deja))));
      })));
}
const ligneLibre = (a) => el('div', { class: 'glrow libre' },
  el('label', { class: `gl ${a.pris ? 'on' : ''}` }, el('input', { type: 'checkbox', 'data-epi': a.id, checked: a.pris }),
    el('div', { class: 't' }, el('span', {}, a.nom), el('small', {}, 'Ajouté à la main'))),
  el('button', { class: 'btn icon', 'data-epidel': a.id, 'aria-label': `Retirer ${a.nom} de la liste`, title: 'Retirer' }, '×'));

export function buildProvigo() {
  S.prov.err = null;
  const ids = [...S.plan.filter(Boolean), ...(S.dess || []).map((x) => x.id)];
  const pages = ids.map((id) => ({ id, d: getRecipe(id) }));
  const map = {};
  pages.forEach(({ id, d }) => d.ing.forEach((x) => {
    const k = ingKey(x.text); if (!k) return;
    (map[k] = map[k] || { key: k, name: niceName(x.text), dept: deptOf(x.text), lines: [], recipes: new Set() });
    map[k].lines.push(x.text); map[k].recipes.add(S.byId[id] ? S.byId[id].name : '');
  }));
  S.prov.lines = Object.values(map).map((l) => ({ ...l, recipes: [...l.recipes], home: (() => {
    const full = norm(l.lines[0] || l.key).replace(/[’']/g, ' ');
    if (neverBuy(l.key)) return { name: /^eau|glacon/.test(norm(l.key)) ? 'Eau du robinet' : 'Vin ou bière : pas au Provigo', qty: 'toujours' };
    if (isStaple(l.key) || isStaple(full.split(/,(?!\d)/)[0])) return { name: 'Riz, pâtes ou bouillon', qty: 'toujours' };
    const m = invMatch(l.key); return m && m.essential ? m : null;
  })() }));
  S.prov.missing = pages.filter((p) => !p.d.ing.length).map((p) => (S.byId[p.id] ? S.byId[p.id].name : '?'));
  render();
}
export async function toggleGrocery(key) {
  const l = (S.prov.lines || []).find((x) => x.key === key); if (!l) return;
  const on = !S.prov.checked[key]; S.prov.checked[key] = on; render(); syncCoche(key);
  const m = invMatch(key);
  if (on) { if (m) await setQty(m, m.qty + 1); else await addInv(l.name); } else if (m && m.qty > 0) await setQty(m, m.qty - 1);
}

// D-G-043 : « Au garde-manger » — l'article devient Essentiel (toujours à la maison) et sort des listes.
export async function auGardeManger(key) {
  const l = (S.prov.lines || []).find((x) => x.key === key); if (!l) return;
  const m = invMatch(key);
  try {
    let annuler;
    if (m) { const avant = { Essentiel: m.essential, 'Quantité': m.qty }; await majArticle(m, { Essentiel: true, 'Quantité': Math.max(1, m.qty) }); annuler = () => majArticle(m, avant); }
    else { const it = await addInv(l.name, null, 1, true); if (!it) return; annuler = () => supprimerArticle(it); }
    buildProvigo();
    toast(`« ${l.name} » est au garde-manger : il ne reviendra plus sur la liste.`, { label: 'Annuler', fn: () => annuler().then(buildProvigo).catch((e) => toast(errText(e))) });
  } catch (e) { toast(errText(e)); }
}

export function viewProvigo() {
  const out = [panelHead('04 · Épicerie', 'Provigo', `Les soupers et desserts de la ${weekLabel().toLowerCase()}, moins ce qui est déjà à la maison ; tes articles à toi suivent.`,
    el('button', { class: 'btn', id: 'rebuild' }, ico('reset'), 'Recalculer'))];
  const ls = libres(), plan = S.plan.filter(Boolean).length;
  let buy = [], home = [], mine = [];
  if (!plan) out.push(frameEmpty('Planifie ta semaine dans l\'écran Semaine : ses ingrédients s\'ajouteront ici.'));
  else if (S.prov.err) out.push(noticeWarn(S.prov.err));
  else if (!S.prov.lines) out.push(skeleton(), el('p', { class: 'label', style: 'margin-top:10px' }, 'Lecture des fiches de la semaine…'));
  else {
    // D-G-062 : la liste suit les soupers ; tant que la semaine n'est pas approuvée, l'autre appareil ne les a pas.
    if (!S.saved) out.push(noticeWarn('Semaine pas encore approuvée : approuve-la pour retrouver cette liste sur ton PC et ton téléphone.',
      el('button', { class: 'btn', id: 'prov-approuver', disabled: S.saving }, ico('save'), S.saving ? 'Enregistrement…' : 'Approuver')));
    if (S.prov.missing && S.prov.missing.length) out.push(noticeWarn(`Sans liste d'ingrédients : ${S.prov.missing.join(', ')}. Ces soupers ne sont pas dans la liste.`));
    const had = (l) => !l.home && S.have.has(l.key);
    buy = S.prov.lines.filter((l) => !l.home && !had(l)); home = S.prov.lines.filter((l) => l.home); mine = S.prov.lines.filter(had);
    if (frozen()) out.push(el('p', { class: 'hint', style: 'margin:0 0 10px' }, 'Ouvre une recette de la semaine pour cocher ce que tu as déjà, ou touche « J\'en ai » ici : les deux listes se suivent. « Au garde-manger » : tu en as toujours, il ne reviendra plus sur la liste.'));
  }
  const left = buy.filter((l) => !S.prov.checked[l.key]).length + ls.filter((a) => !a.pris).length;
  if (buy.length || ls.length) out.push(el('div', { class: 'epi-compte' }, el('p', { class: 'label' }, `${left} article${left > 1 ? 's' : ''} à prendre`)));
  DEPTS.forEach((d) => {
    const lsd = buy.filter((l) => l.dept === d); if (!lsd.length) return;
    out.push(el('div', { class: 'dept' }, el('h3', {}, d, el('small', {}, String(lsd.length))), lsd.map((l) => el('div', { class: 'glrow' },
      el('label', { class: `gl ${S.prov.checked[l.key] ? 'on' : ''}` }, el('input', { type: 'checkbox', 'data-gro': l.key, checked: !!S.prov.checked[l.key] }),
        el('div', { class: 't' }, el('span', {}, l.name), el('small', {}, `${l.lines.join(' · ')} · ${l.recipes.join(', ')}`))),
      frozen() && el('button', { class: 'btn havebtn', 'data-havebtn': l.key, 'aria-label': `J'ai déjà ${l.name}` }, 'J\'en ai'),
      el('button', { class: 'btn havebtn', 'data-augm': l.key, 'aria-label': `Garder ${l.name} au garde-manger`, title: 'Toujours à la maison : ne revient plus sur la liste', 'data-new': '1.13.0-au-garde-manger' }, 'Au garde-manger')))));
  });
  if (mine.length) out.push(el('div', { class: 'frame home-list mine' }, el('b', {}, `Coché comme déjà au frigo (${mine.length})`),
    mine.map((l) => el('div', { class: 'mrow' }, el('span', {}, l.name, el('small', {}, l.recipes.join(', '))),
      el('button', { class: 'btn', 'data-havebtn': l.key, 'aria-label': `Remettre ${l.name} sur la liste` }, 'Remettre')))));
  if (home.length) out.push(el('details', { class: 'frame home-list' }, el('summary', {}, `Déjà à la maison (${home.length})`),
    home.map((l) => el('div', {}, `${l.name} · ${l.home.name}${l.home.essential ? ' (essentiel)' : l.home.qty === 'toujours' ? '' : ' × ' + l.home.qty}`))));
  out.push(sectionLibre());                                       // D-G-063 : sous les ingrédients des recettes
  return out;
}
