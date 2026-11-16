// D-G-060 : articles libres de l'épicerie, classés par rayon tout seuls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, duCatalogue, rayonDe, ajouterLibre, nomPropre, cleRayon, suggestions } from '../../dist/js/epicerie.js';
import { DEPTS } from '../../dist/js/etat.js';

test('le catalogue n\'utilise que des rayons connus, sans doublon', () => {
  assert.ok(CATALOGUE.length >= 150);
  const vus = new Set();
  for (const [nom, rayon] of CATALOGUE) {
    assert.ok(DEPTS.includes(rayon), `${nom} : ${rayon}`);
    assert.ok(!vus.has(cleRayon(nom)), `doublon : ${nom}`); vus.add(cleRayon(nom));
  }
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

test('D-G-063 : marques rangées par le nom d\'abord', () => {
  assert.ok(CATALOGUE.length >= 400);
  assert.equal(rayonDe('déodorant Old Spice'), 'Hygiène et santé');
  assert.equal(rayonDe('pâte à dent Sensodyne repair'), 'Hygiène et santé');   // pas les pâtes alimentaires
  assert.equal(rayonDe('Pâtes'), 'Épicerie sèche');
  assert.equal(rayonDe('Tide'), 'Entretien');
  assert.equal(rayonDe('sacs Ziploc'), 'Entretien');
  assert.equal(rayonDe('Croustilles Lay\'s'), 'Collations et boissons');
});

test('D-G-063 : suggestions — tes articles d\'abord, chaque mot tapé commence un mot du nom', () => {
  const src = [{ nom: 'Déodorant Old Spice Fiji', rayon: 'Hygiène et santé', origine: 'memo', fois: 4 },
    { nom: 'Lait d\'avoine Oatly', rayon: 'Produits laitiers et œufs', origine: 'inv' },
    ...CATALOGUE.map(([nom, rayon]) => ({ nom, rayon, origine: 'cat' }))];
  assert.equal(suggestions('deo', src)[0].nom, 'Déodorant Old Spice Fiji');
  assert.equal(suggestions('sens rep', src)[0].nom, 'Pâte à dents Sensodyne Répare et protège');
  assert.equal(suggestions('oatly', src)[0].nom, 'Lait d\'avoine Oatly');
  assert.ok(suggestions('pâte à d', src).every((x) => /Pâte à dents/.test(x.nom)));
  assert.deepEqual(suggestions('   ', src), []);
  assert.ok(suggestions('a', src, 5).length === 5);
  // Même article dans la mémoire et le catalogue : une seule suggestion, celle de la mémoire.
  const deux = suggestions('essuie', [{ nom: 'Essuie-tout', rayon: 'Entretien', origine: 'memo', fois: 2 }, { nom: 'Essuie-tout', rayon: 'Entretien', origine: 'cat' }]);
  assert.equal(deux.length, 1); assert.equal(deux[0].origine, 'memo');
});
