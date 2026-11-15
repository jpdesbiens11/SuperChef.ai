// D-G-060 : articles libres de l'épicerie, classés par rayon tout seuls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, duCatalogue, rayonDe, ajouterLibre, nomPropre, cleRayon, HORS_INVENTAIRE } from '../../dist/js/epicerie.js';
import { DEPTS } from '../../dist/js/etat.js';

test('le catalogue n\'utilise que des rayons connus, sans doublon', () => {
  assert.ok(CATALOGUE.length >= 150);
  const vus = new Set();
  for (const [nom, rayon] of CATALOGUE) {
    assert.ok(DEPTS.includes(rayon), `${nom} : ${rayon}`);
    assert.ok(!vus.has(cleRayon(nom)), `doublon : ${nom}`); vus.add(cleRayon(nom));
  }
  for (const r of HORS_INVENTAIRE) assert.ok(DEPTS.includes(r));
});

test('rayon des choix préprogrammés et des noms voisins', () => {
  assert.equal(rayonDe('Papier de toilette'), 'Hygiène et santé');
  assert.equal(rayonDe('papier toilette Cashmere'), 'Hygiène et santé');
  assert.equal(rayonDe('savon a vaisselle'), 'Entretien');
  assert.equal(rayonDe('Sacs à ordures'), 'Entretien');
  assert.equal(rayonDe('lait 2 %'), 'Produits laitiers et œufs');
  assert.equal(rayonDe('Oeufs bio'), 'Produits laitiers et œufs');
  assert.equal(rayonDe('Lait de coco'), 'Conserves');
  assert.equal(rayonDe('Beurre d\'arachide'), 'Épicerie sèche');
  assert.equal(rayonDe('Tomates cerises'), 'Fruits et légumes');
  assert.equal(rayonDe('tomates en dés'), 'Conserves');
  assert.equal(duCatalogue('jus de tomate'), null);         // « Tomates » ne prend pas le jus
  assert.equal(rayonDe('jus de tomate'), 'Collations et boissons');
});

test('hors catalogue : règles maison, puis rayons des ingrédients', () => {
  assert.equal(rayonDe('Détergent Tide'), 'Entretien');
  assert.equal(rayonDe('Shampoing pour enfants'), 'Hygiène et santé');
  assert.equal(rayonDe('Chips au vinaigre'), 'Collations et boissons');
  assert.equal(rayonDe('Nourriture pour poissons'), 'Entretien');
  assert.equal(rayonDe('Brocolini'), 'Fruits et légumes');   // deptOf : brocoli
  assert.equal(rayonDe('Côtelettes de porc'), 'Viandes');
});

test('un rayon choisi à la main est retenu', () => {
  assert.equal(rayonDe('Kombucha', { [cleRayon('kombucha')]: 'Produits laitiers et œufs' }), 'Produits laitiers et œufs');
});

test('ajout : nom propre, pas de doublon tant qu\'il n\'est pas pris', () => {
  let { liste, article } = ajouterLibre([], '  essuie-tout  ', 'Entretien', 'x1');
  assert.deepEqual(article, { id: 'x1', nom: 'Essuie-tout', rayon: 'Entretien', pris: false });
  const r = ajouterLibre(liste, 'Essuie tout', 'Entretien', 'x2');
  assert.equal(r.doublon.id, 'x1'); assert.equal(r.liste.length, 1);
  liste = liste.map((a) => ({ ...a, pris: true }));
  assert.equal(ajouterLibre(liste, 'essuie-tout', 'Entretien', 'x3').liste.length, 2);
  assert.equal(ajouterLibre(liste, '   ', 'Entretien').article, undefined);
  assert.equal(nomPropre('x'.repeat(80)).length, 60);
});
