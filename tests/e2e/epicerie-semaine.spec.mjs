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

test('Provigo : articles libres classés par rayon', async ({ page }) => {
  const { erreurs } = await demarrer(page);
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.glrow').first()).toBeVisible();
  // Tapé à la main : le rayon se trouve tout seul.
  await page.locator('#epi-nom').fill('papier toilette');
  await page.locator('#epi-nom').press('Enter');
  await expect(page.locator('.dept', { hasText: 'Hygiène et santé' }).locator('.glrow.libre')).toHaveText(/Papier toilette/);
  await expect(page.locator('#epi-nom')).toHaveValue('');
  await expect(page.locator('#epi-nom')).toBeFocused();                   // on enchaîne les ajouts
  // Doublon refusé.
  await page.locator('#epi-nom').fill('Papier Toilette');
  await page.locator('#epi-nom').press('Enter');
  await expect(page.locator('#toast')).toHaveText(/déjà sur la liste/);
  // Rayon choisi à la main.
  await page.locator('#epi-nom').fill('Kombucha maison');
  await page.locator('#epi-rayon').selectOption('Produits laitiers et œufs');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.locator('.dept', { hasText: 'Produits laitiers et œufs' }).locator('.glrow.libre')).toHaveText(/Kombucha maison/);
  // Choix rapides : un toucher ajoute, un 2e retire.
  await page.locator('.epi-idees summary').click();
  const savon = page.locator('[data-epiajout="Savon à vaisselle"]');
  await savon.click();
  await expect(savon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.dept', { hasText: 'Entretien' }).locator('.glrow.libre')).toHaveText(/Savon à vaisselle/);
  await expect(page.locator('.epi-idees')).toHaveAttribute('open', '');    // le volet reste ouvert (mise à jour en place)
  await savon.click();
  await expect(savon).toHaveAttribute('aria-pressed', 'false');
  // Cocher, puis retirer les articles pris ; la liste reste après un rechargement de l'écran.
  await page.locator('.epi-idees summary').click();
  await page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('input').check();
  await expect(page.locator('.glrow.libre', { hasText: 'Papier toilette' }).locator('.gl')).toHaveClass(/on/);
  await page.locator('#epi-vider').click();
  await expect(page.locator('.glrow.libre', { hasText: 'Papier toilette' })).toHaveCount(0);
  await page.locator('[data-go="semaine"]').click();
  await page.locator('[data-go="provigo"]').click();
  await expect(page.locator('.glrow.libre')).toHaveText([/Kombucha maison/]);
  await page.locator('[data-epidel]').click();
  await expect(page.locator('.glrow.libre')).toHaveCount(0);
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
