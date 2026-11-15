// 04 · Provigo : liste d'épicerie par rayon (R-10, R-11). Repris de Gordon Rams.ai.
import { S, $, DEPTS, iso, norm, weekLabel, render, toast, errText } from '../etat.js?v=1.25.0';
import { el, ico } from '../el.js?v=1.25.0';
import { getRecipe, majArticle, supprimerArticle, ajouterArticle, slug, relireEpicerie, ajouterLigneEpi, majLigneEpi, supprimerLigneEpi } from '../donnees.js?v=1.25.0';
import { ingKey, niceName, deptOf, invMatch, isStaple, neverBuy, zoneOf } from '../cuisine.js?v=1.25.0';
import { valeurCellule } from '../store.js?v=1.25.0';
import { frozen } from './fiche.js?v=1.25.0';
import { setQty, addInv } from './garde-manger.js?v=1.25.0';
import { panelHead, skeleton, noticeWarn, frameEmpty } from './commun.js?v=1.25.0';
import { CATALOGUE, rayonDe, cleRayon, ajouterLibre } from '../epicerie.js?v=1.25.0';

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

export function depuisClasseur() {
  const rows = S.prov.rows || [], w = semaine();
  S.prov.libres = rows.filter((r) => r.Genre === 'libre' && r.Nom).map((r) => ({ id: r.id, nom: r.Nom, rayon: r.Rayon || rayonDe(r.Nom), pris: oui(r.Pris) }));
  S.prov.checked = Object.fromEntries(rows.filter((r) => r.Genre === 'coche' && String(r['Semaine du']).slice(0, 10) === w && r['Clé']).map((r) => [r['Clé'], oui(r.Pris)]));
  S.prov.appris = Object.fromEntries(rows.filter((r) => r.Genre === 'rayon' && r.Nom).map((r) => [r.Nom, r.Rayon]));
}
const file = new Map();
function synchroniser(id, souhait) {
  const p = (file.get(id) || Promise.resolve()).then(async () => {
    const row = (S.prov.rows || []).find((r) => r.id === id), v = souhait();
    if (!v) { if (row) await supprimerLigneEpi(row); return true; }
    if (!row) { await ajouterLigneEpi({ id, ...v, 'Modifié le': jour() }); return true; }
    const diff = Object.fromEntries(Object.entries(v).filter(([c, x]) => row[c] !== valeurCellule(x)));
    if (Object.keys(diff).length) await majLigneEpi(row, { ...diff, 'Modifié le': jour() });
    return true;
  }).catch((e) => { toast('Épicerie non enregistrée dans ton classeur : ' + errText(e)); return false; });
  file.set(id, p);
  return p;
}
const syncLibre = (id) => synchroniser(id, () => {
  const a = libres().find((x) => x.id === id);
  return a && { Genre: 'libre', 'Semaine du': semaine(), Nom: a.nom, Rayon: a.rayon, Pris: a.pris };
});
const syncCoche = (key) => synchroniser(idCoche(key), () => ({ Genre: 'coche', 'Semaine du': semaine(), 'Clé': key, Nom: (S.prov.lines || []).find((l) => l.key === key)?.name || key, Pris: !!S.prov.checked[key] }));
const syncRayon = (cle) => synchroniser(idRayon(cle), () => S.prov.appris[cle] && { Genre: 'rayon', Nom: cle, Rayon: S.prov.appris[cle] });

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
  if (!cles.length) return;
  if ((await Promise.all(envois)).every(Boolean)) cles.forEach(oublier);
  render();
}

/* ---------- articles libres (D-G-060), gardés aussi au garde-manger (D-G-062) ---------- */
// L'article entre dans l'inventaire (quantité 0 : à acheter) s'il n'y est pas : il revient au garde-manger, prêt à remettre sur la liste.
async function memoriser(nom, rayon) {
  if (!S.inv.items || invMatch(ingKey(nom))) return;
  try { await ajouterArticle(nom, zoneOf(rayon), rayon, 0); render(); } catch (e) { toast(errText(e)); }
}
export function ajouterArticleLibre(nom, rayonChoisi) {
  const auto = rayonDe(nom, S.prov.appris), rayon = rayonChoisi || auto;
  const r = ajouterLibre(libres(), nom, rayon, nouvelId());
  if (r.doublon) { toast(`« ${r.doublon.nom} » est déjà sur la liste (${r.doublon.rayon}).`); return false; }
  if (!r.article) return false;
  if (rayonChoisi && rayonChoisi !== auto) { const c = cleRayon(nom); S.prov.appris[c] = rayonChoisi; syncRayon(c); }
  S.prov.libres = r.liste; render();
  toast(`« ${r.article.nom} » ajouté · ${rayon}`);
  syncLibre(r.article.id); memoriser(r.article.nom, rayon);
  return true;
}
// Choix rapide (et bouton « Épicerie » du garde-manger) : touche une fois pour l'ajouter, une 2e fois pour le retirer.
export const surLaListe = (nom) => libres().some((x) => !x.pris && cleRayon(x.nom) === cleRayon(nom));
export function basculerIdee(nom, rayon) {
  const a = libres().find((x) => !x.pris && cleRayon(x.nom) === cleRayon(nom));
  if (a) { S.prov.libres = libres().filter((x) => x !== a); render(); toast(`« ${a.nom} » retiré de l'épicerie`); syncLibre(a.id); }
  else ajouterArticleLibre(nom, rayon && DEPTS.includes(rayon) ? rayon : '');
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
function formLibre() {
  const deja = new Set(libres().filter((a) => !a.pris).map((a) => cleRayon(a.nom)));
  // Ce qui revient souvent : les articles épuisés du garde-manger (pas les essentiels, toujours à la maison).
  const epuises = (S.inv.items || []).filter((i) => i.qty <= 0 && !i.essential);
  return el('div', { class: 'frame epi-libre' },
    el('form', { class: 'add-form', id: 'epiform' },
      el('input', { id: 'epi-nom', list: 'epi-catalogue', placeholder: 'Ajouter un article (ex. savon)', 'aria-label': 'Article à ajouter', autocomplete: 'off', enterkeyhint: 'done' }),
      el('select', { id: 'epi-rayon', 'aria-label': 'Rayon' }, el('option', { value: '' }, 'Rayon auto'), DEPTS.map((d) => el('option', { value: d }, d))),
      el('button', { class: 'btn primary', type: 'submit' }, ico('plus'), 'Ajouter')),
    el('datalist', { id: 'epi-catalogue' }, [...new Set([...(S.inv.items || []).map((i) => i.name), ...CATALOGUE.map(([n]) => n)])].map((n) => el('option', { value: n }))),
    epuises.length ? el('div', { class: 'epi-groupe epi-epuises' }, el('b', {}, `À racheter · épuisé au garde-manger (${epuises.length})`),
      el('div', { class: 'epi-puces' }, epuises.map((i) => puceIdee(i.name, i.dept, deja)))) : null,
    el('details', { class: 'epi-idees' }, el('summary', {}, 'Choix rapides : garde-manger et maison'),
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
  const out = [panelHead('04 · Épicerie', 'Provigo', `Les soupers et desserts de la ${weekLabel().toLowerCase()}, moins ce qui est déjà à la maison, plus tes articles à toi.`,
    el('button', { class: 'btn', id: 'rebuild' }, ico('reset'), 'Recalculer')), formLibre()];
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
  const left = buy.filter((l) => !S.prov.checked[l.key]).length + ls.filter((a) => !a.pris).length, pris = ls.filter((a) => a.pris).length;
  if (buy.length || ls.length) out.push(el('div', { class: 'epi-compte' }, el('p', { class: 'label' }, `${left} article${left > 1 ? 's' : ''} à prendre`),
    pris ? el('button', { class: 'btn', id: 'epi-vider' }, `Retirer les articles pris (${pris})`) : null));
  DEPTS.forEach((d) => {
    const lsd = buy.filter((l) => l.dept === d), lib = ls.filter((a) => a.rayon === d); if (!lsd.length && !lib.length) return;
    out.push(el('div', { class: 'dept' }, el('h3', {}, d, el('small', {}, String(lsd.length + lib.length))), lsd.map((l) => el('div', { class: 'glrow' },
      el('label', { class: `gl ${S.prov.checked[l.key] ? 'on' : ''}` }, el('input', { type: 'checkbox', 'data-gro': l.key, checked: !!S.prov.checked[l.key] }),
        el('div', { class: 't' }, el('span', {}, l.name), el('small', {}, `${l.lines.join(' · ')} · ${l.recipes.join(', ')}`))),
      frozen() && el('button', { class: 'btn havebtn', 'data-havebtn': l.key, 'aria-label': `J'ai déjà ${l.name}` }, 'J\'en ai'),
      el('button', { class: 'btn havebtn', 'data-augm': l.key, 'aria-label': `Garder ${l.name} au garde-manger`, title: 'Toujours à la maison : ne revient plus sur la liste', 'data-new': '1.13.0-au-garde-manger' }, 'Au garde-manger'))),
    lib.map(ligneLibre)));
  });
  if (mine.length) out.push(el('div', { class: 'frame home-list mine' }, el('b', {}, `Coché comme déjà au frigo (${mine.length})`),
    mine.map((l) => el('div', { class: 'mrow' }, el('span', {}, l.name, el('small', {}, l.recipes.join(', '))),
      el('button', { class: 'btn', 'data-havebtn': l.key, 'aria-label': `Remettre ${l.name} sur la liste` }, 'Remettre')))));
  if (home.length) out.push(el('details', { class: 'frame home-list' }, el('summary', {}, `Déjà à la maison (${home.length})`),
    home.map((l) => el('div', {}, `${l.name} · ${l.home.name}${l.home.essential ? ' (essentiel)' : l.home.qty === 'toujours' ? '' : ' × ' + l.home.qty}`))));
  return out;
}
