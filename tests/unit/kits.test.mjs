// D-G-025 / D-G-038 : chaque kit annoncé dans Compte existe et passe le vérificateur de kits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { verifierKit } from '../../scripts/valider-kit.mjs';
import { KITS } from '../../dist/js/vues/compte.js';

// Le kit Asiatique d'origine (1.3.0) a deux recettes sans lien d'inspiration. Le kit Air fryer (D-G-066) est rédigé
// par Claude à la demande de JP, sans recette d'inspiration : ses 20 recettes n'ont pas de lien. Seules exceptions permises.
const LIENS_MANQUANTS_PERMIS = { asiatique: 2, airfryer: 20 };

test('D-G-038 / D-G-041 / D-G-066 : les 11 kits de Compte sont publiés et valides', async () => {
  assert.deepEqual(KITS.map((k) => k.id), ['survie', 'quebecois', 'vege', 'mexicaine', 'asiatique', 'moyen-orient', 'indienne', 'russe', 'francaise', 'enfants', 'airfryer']);
  for (const k of KITS) {
    const f = new URL(`../../dist/kits/${k.id}.json`, import.meta.url).pathname;
    assert.ok(existsSync(f), `kit ${k.id} absent`);
    const err = await verifierKit(f);
    const liens = err.filter((e) => /Lien source/.test(e)).length;
    assert.ok(liens <= (LIENS_MANQUANTS_PERMIS[k.id] || 0), `${k.id} : ${liens} liens manquants`);
    assert.deepEqual(err.filter((e) => !/Lien source/.test(e)), [], k.id);
  }
});

test('D-G-038 : aucun id de recette en double entre les kits', async () => {
  const { readFile } = await import('node:fs/promises');
  const ids = [];
  for (const k of KITS) ids.push(...JSON.parse(await readFile(new URL(`../../dist/kits/${k.id}.json`, import.meta.url), 'utf8')).recettes.map((r) => r.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('D-G-066 : le nombre de recettes annoncé par chaque tuile est celui du kit', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const k of KITS) {
    const n = JSON.parse(await readFile(new URL(`../../dist/kits/${k.id}.json`, import.meta.url), 'utf8')).recettes.length;
    assert.equal(k.n || 10, n, k.id);
  }
});

test('D-G-066 : le kit Air fryer, 20 recettes à l\'air fryer, étiquetées et nommées', async () => {
  const { readFile } = await import('node:fs/promises');
  const kit = JSON.parse(await readFile(new URL('../../dist/kits/airfryer.json', import.meta.url), 'utf8'));
  assert.equal(kit.recettes.length, 20);
  for (const r of kit.recettes) {
    assert.match(r.id, /^k-airfryer-/);
    assert.equal(r.Outils, 'Air fryer', r.Nom);
    assert.equal(r['Étiquettes'], 'Air fryer', r.Nom);
    assert.match(r.Nom, /air fryer/i, r.Nom);
  }
});
