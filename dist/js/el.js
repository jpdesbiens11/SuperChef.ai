// Construction du DOM sans innerHTML (P-2, N-03).
// el('a', { href: '#', class: 'x', onclick: fn, style: 'margin:0' }, 'texte', autreNoeud)
// Les attributs data-* servent aux gestionnaires délégués, comme dans Gordon Rams.ai.
const SVG = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (cle.startsWith('on') && typeof val === 'function') { n.addEventListener(cle.slice(2), val); n.ecoute = true; }
    else if (cle === 'class') n.className = val;
    else if (cle === 'style') n.style.cssText = val;          // CSSOM : permis par la CSP
    else if (cle === 'value' && 'value' in n) n.value = val;
    else if (cle === 'checked' || cle === 'disabled' || cle === 'selected' || cle === 'open' || cle === 'hidden') n[cle] = !!val;
    else n.setAttribute(cle, val === true ? '' : String(val));
  }
  ajouter(n, enfants);
  return n;
}

export function ajouter(n, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === undefined || e === null || e === false || e === '' || e === 0) continue; // 0 : reste d'un « liste.length && … » ; afficher un nombre = String(n)
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

// D-G-061 : mise à jour en place (Semaine, Provigo). Au lieu de tout vider puis tout reconstruire, on garde les
// nœuds déjà là et on ne touche qu'aux attributs, textes et cases qui ont changé : rien ne clignote, le défilement,
// le focus et un <details> ouvert restent. Un nœud avec un écouteur (onclick d'el()) est remplacé, jamais réutilisé.
export function patcher(parent, enfants) {
  const neuf = ajouter(document.createDocumentFragment(), enfants);
  patcherEnfants(parent, neuf);
  return parent;
}
const PROPS = ['value', 'checked', 'disabled', 'selected'];
const pareil = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && !a.ecoute && !b.ecoute
  && (a.nodeType !== 1 || (a.id || '') === (b.id || ''));
function patcherNoeud(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  const props = PROPS.filter((p) => p in b).map((p) => [p, b[p]]);   // lus avant que b perde des enfants
  const garderOuvert = a.nodeName === 'DETAILS';
  // style : par le CSSOM (la CSP refuse un attribut style écrit, D-G-061), comme el().
  if ((a.getAttribute('style') || '') !== (b.getAttribute('style') || '')) a.style.cssText = b.style.cssText;
  for (const at of [...a.attributes]) if (at.name !== 'style' && !b.hasAttribute(at.name) && !(garderOuvert && at.name === 'open')) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (at.name !== 'style' && a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  patcherEnfants(a, b);
  for (const [p, v] of props) {
    if (p === 'value' && a === document.activeElement) continue;       // on ne réécrit pas ce que la personne tape
    if (a[p] !== v) a[p] = v;
  }
}
function patcherEnfants(a, b) {
  const neufs = [...b.childNodes];
  neufs.forEach((n, i) => {
    const o = a.childNodes[i];
    if (!o) a.append(n);
    else if (pareil(o, n)) patcherNoeud(o, n);
    else a.replaceChild(n, o);
  });
  while (a.childNodes.length > neufs.length) a.lastChild.remove();
}

export function vider(n) {
  while (n.firstChild) n.firstChild.remove();
  return n;
}

// Icône du sprite de index.html : <svg class="ico"><use href="#i-nom"/></svg>
export function ico(nom, cls = '') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', `ico ${cls}`.trim());
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVG, 'use');
  u.setAttribute('href', `#i-${nom}`);
  s.append(u);
  return s;
}

// Étoile pleine des notes (même tracé que l'artefact).
export function svgEtoile() {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', 'M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z');
  s.append(p);
  return s;
}

// Grande fourchette de la dernière étape.
export function svgGrand(nom) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', 'big'); s.setAttribute('viewBox', '0 0 24 24');
  const u = document.createElementNS(SVG, 'use'); u.setAttribute('href', `#i-${nom}`);
  s.append(u);
  return s;
}
