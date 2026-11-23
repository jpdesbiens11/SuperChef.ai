// D-G-050 : chaque ingrédient tombe à la bonne étape, une seule fois (kits de départ et règles générales).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { ficheDeLigne, stepPlan, keywords, motDans } from '../../dist/js/cuisine.js';
import { problemesRecette } from '../../scripts/verifier-etapes.mjs';

const fiche = (ing, steps) => ficheDeLigne({ ingText: ing.join('\n'), stepsText: steps.join('\n'), sous: '' });
const etape = (d, si) => stepPlan(d).per[si].map((k) => d.ing[k].text);
const KITS = new URL('../../dist/kits/', import.meta.url).pathname;

test('D-G-050 : toutes les recettes des kits de départ sont bien découpées', async () => {
  const fichiers = (await readdir(KITS)).filter((f) => f.endsWith('.json') && f !== 'stock-base.json');
  assert.equal(fichiers.length, 11);
  for (const f of fichiers) {
    for (const r of JSON.parse(await readFile(KITS + f, 'utf8')).recettes) assert.deepEqual(problemesRecette(r), [], `${f} · ${r.Nom}`);
  }
});

test('D-G-050 : Chich taouk, la sauce et la marinade ne se mélangent plus', async () => {
  const r = JSON.parse(await readFile(KITS + 'moyen-orient.json', 'utf8')).recettes.find((x) => x.Nom === 'Chich taouk');
  const d = fiche(r['Ingrédients'], r['Étapes']);
  assert.deepEqual(etape(d, 0), ['3 gousses d\'ail, coupées en quatre (environ 15 g)', '2 blancs d\'œufs', '30 ml (2 c. à soupe) de jus de citron', '2,5 ml (1/2 c. à thé) de sel']);
  const e5 = etape(d, 4);
  assert.ok(e5.includes('15 ml (1 c. à soupe) de jus de citron') && !e5.includes('30 ml (2 c. à soupe) de jus de citron'));
  assert.ok(e5.includes('30 ml (2 c. à soupe) d\'huile de canola') && !e5.includes('375 ml (1 1/2 tasse) d\'huile de canola'));
  assert.equal(e5.filter((t) => /de sel$/.test(t)).length, 1);
  assert.ok(etape(d, 2).includes('45 ml (3 c. à soupe) d\'eau'));
  assert.deepEqual(stepPlan(d).extra, []);
});

test('D-G-050 : le nom compte, pas la préparation ; mots courts et mots entiers', () => {
  assert.deepEqual(keywords('4 gousses d\'ail, coupées en deux'), ['ail']);
  assert.deepEqual(keywords('2,5 ml (1/2 c. à thé) de sel'), ['sel']);
  assert.deepEqual(keywords('500 ml (2 tasses) de vin rouge'), ['vin', 'rouge']);
  assert.ok(motDans('saler et poivrer', 'sel') && motDans("ajouter l'ail", 'ail') && motDans('les oignons', 'oignon'));
  assert.ok(!motDans('le poisson', 'pois') && !motDans('la laitue', 'lait') && !motDans('les ailes', 'ail') && !motDans('la vaisselle', 'sel'));
});

test('D-G-050 : groupes, étiquettes, usages et mots généraux', () => {
  // « les ingrédients de la sauce » : tout le groupe Sauce ; « Verser la sauce » ne reprend pas la sauce soya
  let d = fiche(['## Sauce', '45 ml de sauce soya', '5 ml de sucre', '## Sauté', '450 g de bœuf'],
    ['Fouetter les ingrédients de la sauce.', 'Saisir le bœuf.', 'Verser la sauce et servir.']);
  assert.deepEqual(etape(d, 0), ['45 ml de sauce soya', '5 ml de sucre']);
  assert.deepEqual(etape(d, 2), []);
  // « Pâte : … » donne le groupe ; « pour badigeonner » se retrouve dans l'étape
  d = fiche(['## Garniture', '125 ml de lait', '40 g de farine', '## Pâte', '300 g de farine', 'Lait, pour badigeonner'],
    ['Pâte : mélanger la farine.', 'Garniture : délayer la farine dans le lait.', 'Badigeonner de lait.']);
  assert.deepEqual(etape(d, 0), ['300 g de farine']);
  assert.deepEqual(etape(d, 1), ['125 ml de lait', '40 g de farine']);
  assert.deepEqual(etape(d, 2), ['Lait, pour badigeonner']);
  // une ligne qu'aucune étape ne nomme va à l'étape qui en parle en général
  d = fiche(['5 ml de cumin moulu', '500 g de veau haché', '200 g de cheddar', 'Coriandre fraîche', '## Crudités', '2 carottes'],
    ['Préparer les crudités.', 'Mélanger la viande avec toutes les épices.', 'Couvrir de fromage.', 'Garnir de fines herbes.']);
  assert.deepEqual(stepPlan(d).extra, []);
  assert.deepEqual(etape(d, 1), ['5 ml de cumin moulu', '500 g de veau haché']);
  assert.deepEqual(etape(d, 0), ['2 carottes']);
});

// D-G-067 : un ingrédient se montre à l'étape où il entre, puis seulement là où l'étape en donne une portion.
const plan = (ing, etapes) => { const d = ficheDeLigne({ ingText: ing.join('\n'), stepsText: etapes.join('\n'), sous: '' }); const p = stepPlan(d); return p.per.map((l) => l.map((k) => d.ing[k].text)); };

test('D-G-067 : « Remettre la viande », « Égoutter les pâtes » ne ramènent pas l\'ingrédient', () => {
  const per = plan(['450 g de bœuf haché', '375 g de pâtes', '1 oignon, haché'],
    ['Dorer le bœuf dans une poêle. Réserver.', 'Cuire les pâtes al dente.', 'Attendrir l\'oignon, puis remettre le bœuf.', 'Égoutter les pâtes et les ajouter à la sauce.']);
  assert.deepEqual(per, [['450 g de bœuf haché'], ['375 g de pâtes'], ['1 oignon, haché'], []]);
});

test('D-G-067 : une étape qui donne une portion garde l\'ingrédient (D-G-032)', () => {
  const per = plan(['60 ml de beurre', '2 oignons'], ['Fondre 30 ml de beurre et dorer les oignons.', 'Ajouter le reste du beurre.']);
  assert.deepEqual(per, [['60 ml de beurre', '2 oignons'], ['60 ml de beurre']]);
});

test('D-G-067 : « bouillon de bœuf » n\'est pas dans « dorer le bœuf », « champignons blancs » pas dans « blanchir »', () => {
  const per = plan(['1 kg de cubes de bœuf', '750 ml de bouillon de bœuf', '280 g de petits oignons perlés', '340 g de champignons blancs'],
    ['Dorer le bœuf.', 'Ajouter le bouillon.', 'Blanchir les oignons perlés 2 minutes.', 'Faire sauter les champignons.']);
  assert.deepEqual(per, [['1 kg de cubes de bœuf'], ['750 ml de bouillon de bœuf'], ['280 g de petits oignons perlés'], ['340 g de champignons blancs']]);
});

test('D-G-067 : la ligne que l\'étape nomme le mieux a le mot ; les autres entrent plus loin', () => {
  // « l'oignon » (une fois) est à « 1 oignon » ; les oignons perlés entrent à leur étape à eux
  assert.deepEqual(plan(['1 oignon', '280 g de petits oignons perlés'], ['Ajouter l\'oignon.', 'Blanchir les oignons perlés.']),
    [['1 oignon'], ['280 g de petits oignons perlés']]);
  // « le jus de lime » est au jus ; « 1 lime, en quartiers » entre à « garnir de quartiers de lime »
  assert.deepEqual(plan(['45 ml de jus de lime', '1 lime, en quartiers'], ['Mélanger le jus de lime et le sucre.', 'Garnir de quartiers de lime.']),
    [['45 ml de jus de lime'], ['1 lime, en quartiers']]);
  // « les tomates… la pâte de tomates » : le mot revient deux fois, les deux lignes y sont
  assert.deepEqual(plan(['900 g de tomates italiennes', '45 ml de pâte de tomates'], ['Mettre les tomates et la pâte de tomates dans la cocotte.']),
    [['900 g de tomates italiennes', '45 ml de pâte de tomates']]);
});

test('D-G-067 : « jus d\'orange » n\'est pas « le jus de cuisson », « 1 grande boîte » pas « un grand chaudron »', () => {
  const per = plan(['250 ml de jus d\'orange', '1 grande boîte de sauce tomate', '2 oignons'],
    ['Dans un grand chaudron, dorer les oignons.', 'Ajouter le jus d\'orange et la sauce tomate.', 'Laisser reposer la viande dans son jus de cuisson.']);
  assert.deepEqual(per, [['2 oignons'], ['250 ml de jus d\'orange', '1 grande boîte de sauce tomate'], []]);
});
