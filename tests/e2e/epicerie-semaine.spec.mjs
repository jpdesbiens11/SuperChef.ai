// D-G-060 : articles libres de l'épicerie ; D-G-061 : Semaine compacte au téléphone, mise à jour en place.
import { test, expect } from '@playwright/test';
import { brancher } from './outils.mjs';
import { LIVRE } from './fixture.mjs';

async function demarrer(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const b = await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(LIVRE)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  return { ...b, erreurs };
}

const epicerie = (sim) => { const t = [...sim.classeurs.values()][0].onglets['Épicerie']; const h = t[0]; return t.slice(1).map((l) => Object.fromEntries(h.map((c, j) => [c, l[j] ?? '']))); };
const inventaire = (sim) => { const t = [...sim.classeurs.values()][0].onglets.Inventaire; const h = t[0]; return t.slice(1).map((l) => Object.fromEntries(h.map((c, j) => [c, l[j] ?? '']))); };

test('Provigo : articles libres classés par rayon, gardés dans le classeur et au garde-manger', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('superchef-provigo-masquer', 'non'));   // on veut voir les cases cochées (D-G-064 à part)
  const { sim, erreurs } = await demarrer(page);
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.glrow').first()).toBeVisible();
  // Tapé à la main : le rayon se trouve tout seul.
  await page.locator('#epi-nom').fill('papier toilette');
  await page.locator('#epi-nom').press('Enter');
  await expect(page.locator('.dept', { hasText: 'Hygiène et santé' }).locator('.glrow.libre')).toHaveText(/Papier toilette/);
  await expect(page.locator('#epi-nom')).toHaveValue('');
  await expect(page.locator('#epi-nom')).toBeFocused();                   // on enchaîne les ajouts
  // D-G-062 : écrit dans l'onglet Épicerie, et gardé au garde-manger (zone Maison, quantité 0 : à acheter).
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'libre').map((r) => [r.Nom, r.Rayon, r.Pris])).toEqual([['Papier toilette', 'Hygiène et santé', 'non']]);
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'memo').map((r) => [r.Nom, r.Fois])).toEqual([['Papier toilette', '1']]);   // D-G-063 : en mémoire
  // D-G-063 : « Mes articles » vient après les ingrédients des recettes.
  expect(await page.evaluate(() => { const d = document.querySelector('#main > .dept'), m = document.querySelector('.epi-libre'); return !!(d && m && (d.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING)); })).toBe(true);
  await expect.poll(() => inventaire(sim).filter((r) => r.Nom === 'Papier toilette').map((r) => [r.Zone, r['Quantité']])).toEqual([['Maison', '0']]);
  // Doublon refusé.
  await page.locator('#epi-nom').fill('Papier Toilette');
  await page.locator('#epi-nom').press('Enter');
  await expect(page.locator('#toast')).toHaveText(/déjà sur la liste/);
  // Rayon choisi à la main : retenu dans le classeur.
  await page.locator('#epi-nom').fill('Kombucha maison');
  await page.locator('#epi-rayon').selectOption('Produits laitiers et œufs');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.locator('.dept', { hasText: 'Produits laitiers et œufs' }).locator('.glrow.libre')).toHaveText(/Kombucha maison/);
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'rayon').map((r) => [r.Nom, r.Rayon])).toEqual([['kombucha maison', 'Produits laitiers et œufs']]);
  // Choix rapides : un toucher ajoute, un 2e retire.
  await page.locator('.epi-idees summary').click();
  const savon = page.locator('.epi-idees [data-epiajout="Savon à vaisselle"]');
  await savon.click();
  await expect(savon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.dept', { hasText: 'Entretien' }).locator('.glrow.libre')).toHaveText(/Savon à vaisselle/);
  await expect(page.locator('.epi-idees')).toHaveAttribute('open', '');    // le volet reste ouvert (mise à jour en place)
  await savon.click();
  await expect(savon).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.epi-idees summary').click();
  // Cocher un article libre et un ingrédient de la semaine : les deux cases sont dans le classeur.
  await page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('input').check();
  await expect(page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('.gl')).toHaveClass(/on/);
  const ingredient = page.locator('.glrow:not(.libre)').first();
  const nomIng = (await ingredient.locator('.t > span').textContent()).trim();
  await ingredient.locator('input').check();
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'coche').map((r) => [r.Nom, r.Pris])).toEqual([[nomIng, 'oui']]);
  await expect.poll(() => epicerie(sim).find((r) => r.Nom === 'Papier toilette')?.Pris).toBe('oui');
  await expect.poll(() => inventaire(sim).find((r) => r.Nom === 'Papier toilette')?.['Quantité']).toBe('1');

  // Rechargement (ou autre appareil) : tout revient du classeur, rien du téléphone.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/epicerie|provigo/.test(k)) localStorage.removeItem(k); });
  await page.reload();
  await page.getByRole('button', { name: /Continuer|Se connecter/ }).click();
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.glrow.libre')).toHaveText([/Kombucha maison/, /Papier toilette/]);
  await expect(page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('input')).toBeChecked();
  await expect(page.locator('.glrow:not(.libre)', { hasText: nomIng }).first().locator('input')).toBeChecked();   // même semaine : le brouillon est resté
  // Semaine pas approuvée : Provigo le dit et l'approuve sur place.
  await page.locator('#prov-approuver').click();
  await expect(page.locator('#prov-approuver')).toHaveCount(0);
  await expect.poll(() => [...sim.classeurs.values()][0].onglets['Plans de semaine'].length).toBeGreaterThan(1);

  // Un ajout fait sur l'autre appareil apparaît en revenant dans l'app.
  const c = [...sim.classeurs.values()][0].onglets['Épicerie'];
  c.push(c[0].map((col) => ({ id: 'e-l-pc1', Genre: 'libre', Nom: 'Piles AA', Rayon: 'Entretien', Pris: 'non' }[col] ?? '')));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.dept', { hasText: 'Entretien' }).locator('.glrow.libre')).toHaveText(/Piles AA/);

  // Retirer les articles pris : la ligne sort du classeur.
  await page.locator('#epi-vider').click();
  await expect(page.locator('.glrow.libre', { hasText: 'Papier toilette' })).toHaveCount(0);
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'libre').map((r) => r.Nom)).toEqual(['Kombucha maison', 'Piles AA']);
  // Retiré de la liste, gardé en mémoire : il revient en tapant.
  expect(epicerie(sim).filter((r) => r.Genre === 'memo').map((r) => r.Nom)).toContain('Papier toilette');
  await page.locator('#epi-nom').pressSequentially('papier t');
  await expect(page.locator('#epi-sugg .sugg-choix').first()).toContainText('Papier toilette');
  await expect(page.locator('#epi-sugg .sugg-choix').first()).toContainText('ajouté 1 fois');
  await page.locator('#epi-sugg .sugg-choix').first().click();
  await expect(page.locator('.epi-libre .glrow.libre', { hasText: 'Papier toilette' })).toHaveCount(1);
  await expect(page.locator('#epi-nom')).toHaveValue('');
  await expect(page.locator('#epi-sugg .sugg')).toHaveCount(0);
  await expect.poll(() => epicerie(sim).find((r) => r.Genre === 'memo' && r.Nom === 'Papier toilette')?.Fois).toBe('2');
  await page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('[data-epidel]').click();

  // Garde-manger : l'article ajouté à la main y est, et revient sur la liste en un toucher.
  await page.locator('[data-go="livre"]').click();
  const pt = page.locator('.inv-row', { hasText: 'Papier toilette' });
  await expect(page.locator('.zone').filter({ has: page.locator('h3', { hasText: /^Maison/ }) })).toContainText('Papier toilette');
  await expect(pt.locator('[data-invepi]')).toHaveAttribute('aria-pressed', 'false');
  await pt.locator('[data-invepi]').click();
  await expect(pt.locator('[data-invepi]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.dept', { hasText: 'Hygiène et santé' }).locator('.glrow.libre')).toHaveText(/Papier toilette/);
  await page.locator('[data-epidel]').first().click();
  expect(erreurs).toEqual([]);
});

test('D-G-062 : la liste gardée dans le téléphone (1.24.0) passe dans le classeur', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('fait')) { sessionStorage.setItem('fait', '1'); localStorage.setItem('superchef-epicerie-libre', JSON.stringify([{ id: 'x-1', nom: 'Essuie-tout', rayon: 'Entretien', pris: false }])); } });
  const { sim, erreurs } = await demarrer(page);
  await expect.poll(() => epicerie(sim).map((r) => [r.Genre, r.Nom, r.Rayon])).toEqual([['libre', 'Essuie-tout', 'Entretien'], ['memo', 'Essuie-tout', 'Entretien']]);
  expect(await page.evaluate(() => localStorage.getItem('superchef-epicerie-libre'))).toBeNull();
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.glrow.libre')).toHaveText([/Essuie-tout/]);
  expect(erreurs).toEqual([]);
});

test('D-G-063 : marques au catalogue, mémoire rappelée en tapant, « Enregistrer toute la liste dans Google Drive »', async ({ page }) => {
  const { sim, erreurs } = await demarrer(page);
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('#epi-drive')).toHaveText(/Enregistrer toute la liste dans Google Drive/);
  // Une marque du catalogue : quelques lettres suffisent.
  await page.locator('#epi-nom').pressSequentially('sens rep');
  await expect(page.locator('#epi-sugg .sugg-choix').first()).toContainText('Pâte à dents Sensodyne Répare et protège');
  await page.locator('#epi-sugg .sugg-choix').first().click();
  await expect(page.locator('.dept', { hasText: 'Hygiène et santé' }).locator('.glrow.libre')).toHaveText(/Sensodyne/);
  // Un nom tapé à la main, hors catalogue : rangé (déodorant → Hygiène) et rappelé ensuite, avant le catalogue.
  await page.locator('#epi-nom').fill('Déodorant Old Spice Fiji');
  await page.locator('#epi-nom').press('Enter');
  await expect(page.locator('.dept', { hasText: 'Hygiène et santé' }).locator('.glrow.libre')).toHaveCount(2);
  await page.locator('.glrow.libre', { hasText: 'Fiji' }).locator('[data-epidel]').click();
  await page.locator('#epi-nom').pressSequentially('deo');
  await expect(page.locator('#epi-sugg .sugg-choix').first()).toContainText('Déodorant Old Spice Fiji');
  // Oublier un article de la mémoire.
  await page.locator('#epi-sugg [data-epioubli]').first().click();
  await expect(page.locator('#epi-sugg .sugg-choix').first()).not.toContainText('ajouté');   // reste proposé : il est au garde-manger
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'memo').map((r) => r.Nom)).toEqual(['Pâte à dents Sensodyne Répare et protège']);
  await page.locator('#epi-nom').fill('');
  // Le bouton : approuve la semaine (pas encore approuvée) et confirme dans le classeur.
  await expect(page.locator('.epi-etat')).toContainText('Semaine pas encore approuvée');
  await page.locator('#epi-drive').click();
  await expect(page.locator('#toast')).toContainText('Liste enregistrée dans Google Drive');
  await expect(page.locator('.epi-etat')).toContainText('Tout est dans Google Drive');
  expect([...sim.classeurs.values()][0].onglets['Plans de semaine'].length).toBeGreaterThan(1);
  await expect(page.locator('#prov-approuver')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('Semaine : compacte au téléphone, sans tout reconstruire', async ({ page }, info) => {
  const { erreurs } = await demarrer(page);
  const tel = info.project.name === 's25';
  await expect(page.locator('.week .day[data-jour]')).toHaveCount(4);
  await expect(page.locator('.week.compacte')).toHaveCount(tel ? 1 : 0);
  if (!tel) { await page.locator('#semvue').click(); await expect(page.locator('.week.compacte')).toHaveCount(1); }
  // Les 4 soupers tiennent dans l'écran du téléphone.
  const bas = await page.locator('.week .day[data-jour]').last().evaluate((n) => n.getBoundingClientRect().bottom + scrollY);
  expect(bas).toBeLessThan(780);
  // Piger lundi : seul lundi change ; les autres cartes sont les mêmes nœuds, le défilement ne bouge pas.
  const y = await page.evaluate(() => { document.querySelectorAll('.week .day[data-jour]').forEach((n) => { n.temoin = true; }); scrollTo(0, 200); return scrollY; });
  const avant = await page.locator('.week .day[data-jour="1"] h3').textContent();
  await page.locator('[data-swap="1"]').click();
  await expect(page.locator('.week .day[data-jour="1"] h3')).not.toHaveText(avant);
  await expect(page.locator('.week .day[data-jour="1"]')).toHaveClass(/neuf/);
  expect(await page.evaluate(() => [...document.querySelectorAll('.week .day[data-jour]')].filter((n) => n.temoin).length)).toBe(4);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  // Choisir : la feuille s'ouvre ; la fiche garde Au poêle et PDF.
  await page.locator('[data-pick="0"]').click();
  await expect(page.locator('#picksheet')).toBeVisible();
  await page.locator('[data-pickclose]').click();
  await page.locator('.week .day[data-jour="0"] .title-btn').click();
  await expect(page.locator('#sheet').getByRole('button', { name: 'Partager en PDF', exact: true })).toBeVisible();
  await page.locator('#sheet [data-close]').first().click();
  // « Détails » rend les grandes cartes, et le choix est retenu.
  await page.locator('#semvue').click();
  await expect(page.locator('.week.compacte')).toHaveCount(0);
  await expect(page.locator('.week .day[data-jour="0"] [data-cook]')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Continuer|Se connecter/ }).click();
  await expect(page.locator('.week .day[data-jour]')).toHaveCount(4);
  await expect(page.locator('.week.compacte')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test('D-G-064 : « Masquer les achetés » allège la liste au fur et à mesure', async ({ page }) => {
  const { sim, erreurs } = await demarrer(page);
  await page.locator('[data-go="provigo"]').click();
  const filtre = page.locator('#prov-filtre');
  await expect(filtre).toHaveAttribute('aria-checked', 'true');                 // activé par défaut
  await page.locator('#epi-nom').fill('Piles AA');
  await page.locator('#epi-nom').press('Enter');
  const lignes = page.locator('#main > .dept .glrow');
  const avant = await lignes.count();
  const premier = lignes.first(), nom = (await premier.locator('.t > span').textContent()).trim();
  // Cocher : l'ingrédient sort de la vue, « Annuler » le remet.
  await premier.locator('input').click();
  await expect(lignes).toHaveCount(avant - 1);
  await expect(page.locator('#toast')).toContainText(`« ${nom} » dans le panier`);
  await expect(page.locator('.prov-caches')).toContainText('1 dans le panier');
  await page.locator('#toast button').click();
  await expect(lignes).toHaveCount(avant);
  // Un article à moi aussi.
  await page.locator('.glrow.libre', { hasText: 'Piles AA' }).locator('input').click();
  await expect(page.locator('.glrow.libre', { hasText: 'Piles AA' })).toHaveCount(0);
  // À off : tout revient, coché.
  await filtre.click();
  await expect(filtre).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.glrow.libre', { hasText: 'Piles AA' }).locator('input')).toBeChecked();
  await expect(page.locator('.prov-caches')).toHaveCount(0);
  // D-G-065 : le choix est dans le classeur, donc le même sur l'autre appareil.
  await expect.poll(() => epicerie(sim).filter((r) => r.Genre === 'pref').map((r) => [r.Nom, r.Pris])).toEqual([['masquer-achetes', 'non']]);
  await page.evaluate(() => localStorage.removeItem('superchef-provigo-masquer'));   // comme un autre téléphone
  await page.reload();
  await page.getByRole('button', { name: /Continuer|Se connecter/ }).click();
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('#prov-filtre')).toHaveAttribute('aria-checked', 'false');
  // Remis à on au PC : le téléphone le voit en revenant dans l'app.
  const t = [...sim.classeurs.values()][0].onglets['Épicerie'], h = t[0], k = t.findIndex((l) => l[0] === 'e-p-masquer-achetes');
  t[k][h.indexOf('Pris')] = 'oui';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#prov-filtre')).toHaveAttribute('aria-checked', 'true');
  expect(erreurs).toEqual([]);
});

test('D-G-068 : jeudi soir, la semaine en cours reste ; le menu Compte change de semaine', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T18:30:00'));     // jeudi 26 novembre, au souper
  const livre = { ...LIVRE, plans: [
    { id: 'p-2026-11-22-dimanche', 'Semaine du': '2026-11-22', Jour: 'Dimanche', 'Recette id': 'r-pate', Dessert: false },
    { id: 'p-2026-11-22-jeudi', 'Semaine du': '2026-11-22', Jour: 'Jeudi', 'Recette id': 'r-pates', Dessert: false }] };
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await brancher(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Se connecter avec Google' }).click();
  await page.locator('#fichier-import').setInputFiles({ name: 'livre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(livre)) });
  await page.locator('#lancer-import').click();
  await expect(page.getByRole('heading', { name: 'Import terminé.' })).toBeVisible();
  await page.locator('[data-compteclose]').click();
  // La semaine du 22 (pas celle du 29) : le souper de ce soir est là.
  await expect(page.locator('.panel-head h2')).toContainText('22');
  await expect(page.locator('.week .day[data-jour="4"] h3')).toHaveText('Pâtes rosées test');
  await expect(page.locator('.sem-autre')).toHaveCount(0);
  // Menu Compte : semaine d'après, puis retour.
  await page.locator('#comptebtn').click();
  await expect(page.locator('#compte-semaine')).toContainText('cette semaine');
  await page.locator('#compte-semaine [data-semnav="1"]').click();
  await expect(page.locator('#compte-semaine')).toContainText('la semaine prochaine');
  await expect(page.locator('#compte-semaine')).toContainText('29');
  await page.locator('[data-compteclose]').click();
  await expect(page.locator('.panel-head h2')).toContainText('29');
  await expect(page.locator('.sem-autre')).toContainText('la semaine prochaine');
  await expect(page.locator('.week .day[data-jour]')).toHaveCount(4);            // brouillon pigé pour la semaine à venir
  await page.locator('.sem-autre [data-semnav="0"]').click();
  await expect(page.locator('.week .day[data-jour="4"] h3')).toHaveText('Pâtes rosées test');
  // Semaine passée : vide, rien n'est pigé après coup.
  await page.locator('#comptebtn').click();
  await page.locator('#compte-semaine [data-semnav="-1"]').click();
  await expect(page.locator('#compte-semaine')).toContainText('la semaine passée');
  await page.locator('[data-compteclose]').click();
  await expect(page.locator('.week .day[data-jour]')).toHaveCount(0);
  await expect(page.locator('#save')).toBeDisabled();
  expect(erreurs).toEqual([]);
});
