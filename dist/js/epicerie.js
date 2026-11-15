// D-G-060 : articles libres de l'épicerie (garde-manger et consommables de la maison), classés par rayon tout seuls.
// Le catalogue est une liste de choix préprogrammés (article → rayon) ; un nom qui n'y est pas passe par des règles
// « maison » (savon, papier…), puis par les rayons des ingrédients (cuisine.js). Un rayon choisi à la main est retenu
// dans le classeur pour la prochaine fois (D-G-062). Sans DOM : testé à part.
import { norm } from './etat.js?v=1.26.0';
import { deptOf } from './cuisine.js?v=1.26.0';

const FL = 'Fruits et légumes', BOU = 'Boulangerie', LAI = 'Produits laitiers et œufs', SEC = 'Épicerie sèche', CON = 'Conserves',
  EPI = 'Épices', COL = 'Collations et boissons', SUR = 'Surgelés', HYG = 'Hygiène et santé', ENT = 'Entretien', VIA = 'Viandes', CHA = 'Charcuterie et fromages';

const groupe = (rayon, noms) => noms.map((nom) => [nom, rayon]);
export const CATALOGUE = [
  ...groupe(FL, ['Bananes', 'Pommes', 'Oranges', 'Raisins', 'Fraises', 'Bleuets', 'Citrons', 'Limes', 'Clémentines', 'Avocats', 'Oignons', 'Ail', 'Pommes de terre', 'Patates douces', 'Carottes', 'Céleri', 'Concombre', 'Laitue', 'Épinards', 'Brocoli', 'Tomates', 'Poivrons', 'Champignons', 'Courgettes', 'Salade en sac']),
  ...groupe(BOU, ['Pain tranché', 'Pain baguette', 'Bagels', 'Muffins anglais', 'Tortillas', 'Pains à hot-dog', 'Pains à hamburger', 'Pitas', 'Croissants']),
  ...groupe(LAI, ['Lait', 'Crème 35 %', 'Crème 15 %', 'Beurre', 'Œufs', 'Yogourt', 'Yogourt grec', 'Fromage cottage', 'Crème sure', 'Boisson d\'avoine', 'Boisson de soya', 'Margarine']),
  ...groupe(CHA, ['Fromage cheddar', 'Fromage mozzarella', 'Parmesan', 'Jambon tranché', 'Dinde tranchée', 'Bacon', 'Fromage à la crème', 'Saucisson']),
  ...groupe(VIA, ['Bœuf haché', 'Poitrines de poulet', 'Saucisses']),
  ...groupe(SEC, ['Farine', 'Sucre', 'Cassonade', 'Sucre à glacer', 'Poudre à pâte', 'Bicarbonate de soude', 'Levure', 'Riz', 'Pâtes', 'Spaghetti', 'Macaroni', 'Couscous', 'Quinoa', 'Gruau', 'Céréales', 'Chapelure', 'Huile d\'olive', 'Huile végétale', 'Huile de canola', 'Vinaigre blanc', 'Vinaigre de cidre', 'Vinaigre balsamique', 'Sauce soya', 'Ketchup', 'Moutarde', 'Mayonnaise', 'Relish', 'Sirop d\'érable', 'Miel', 'Beurre d\'arachide', 'Confiture', 'Nutella', 'Bouillon de poulet', 'Bouillon de bœuf', 'Bouillon de légumes', 'Sauce BBQ', 'Sauce piquante', 'Sauce Worcestershire', 'Fécule de maïs', 'Pépites de chocolat', 'Cacao', 'Vanille', 'Noix', 'Amandes', 'Raisins secs', 'Graines de chia', 'Café', 'Café moulu', 'Thé', 'Tisane', 'Chocolat chaud']),
  ...groupe(CON, ['Tomates en dés', 'Tomates broyées', 'Pâte de tomates', 'Sauce tomate', 'Sauce à spaghetti', 'Thon en conserve', 'Saumon en conserve', 'Pois chiches', 'Haricots rouges', 'Haricots noirs', 'Lentilles', 'Maïs en grains', 'Lait de coco', 'Soupe en conserve', 'Lait concentré', 'Compote de pommes', 'Fruits en conserve', 'Cornichons', 'Olives']),
  ...groupe(EPI, ['Sel', 'Poivre', 'Paprika', 'Cumin', 'Cannelle', 'Origan', 'Thym', 'Basilic séché', 'Poudre d\'ail', 'Poudre d\'oignon', 'Poudre de chili', 'Cari', 'Flocons de piment', 'Feuilles de laurier', 'Assaisonnement à steak', 'Muscade', 'Gingembre moulu', 'Curcuma']),
  ...groupe(COL, ['Croustilles', 'Craquelins', 'Biscuits', 'Barres tendres', 'Maïs soufflé', 'Bretzels', 'Compotes en gourde', 'Chocolat', 'Bonbons', 'Jus d\'orange', 'Jus de pomme', 'Boîtes à jus', 'Eau pétillante', 'Boissons gazeuses', 'Eau en bouteille', 'Bière', 'Vin']),
  ...groupe(SUR, ['Légumes surgelés', 'Petits pois surgelés', 'Fruits surgelés', 'Frites surgelées', 'Pizza surgelée', 'Crème glacée', 'Pépites de poulet', 'Gaufres surgelées', 'Poisson pané']),
  ...groupe(HYG, ['Papier de toilette', 'Mouchoirs', 'Savon à mains', 'Savon pour le corps', 'Shampoing', 'Revitalisant', 'Dentifrice', 'Brosses à dents', 'Soie dentaire', 'Rince-bouche', 'Déodorant', 'Rasoirs', 'Crème à raser', 'Coton-tiges', 'Tampons démaquillants', 'Serviettes hygiéniques', 'Tampons', 'Couches', 'Lingettes pour bébé', 'Crème solaire', 'Pansements', 'Acétaminophène', 'Ibuprofène', 'Vitamines', 'Lotion pour le corps', 'Baume à lèvres']),
  ...groupe(ENT, ['Essuie-tout', 'Papier aluminium', 'Pellicule plastique', 'Papier parchemin', 'Sacs congélation', 'Sacs à sandwich', 'Sacs à ordures', 'Sacs de recyclage', 'Sacs à compost', 'Savon à vaisselle', 'Détergent lave-vaisselle', 'Détergent à lessive', 'Assouplissant', 'Feuilles assouplissantes', 'Eau de Javel', 'Nettoyant tout usage', 'Nettoyant à vitres', 'Nettoyant pour salle de bain', 'Lingettes désinfectantes', 'Éponges', 'Linges à vaisselle', 'Gants de caoutchouc', 'Piles', 'Ampoules', 'Allumettes', 'Chandelles', 'Litière', 'Nourriture pour chat', 'Nourriture pour chien', 'Filtres à café']),
  // D-G-063 : articles de marque qu'on rachète souvent (le nom d'abord : « Déodorant Old Spice » reste un déodorant).
  ...groupe(HYG, ['Pâte à dents', 'Pâte à dents Sensodyne Répare et protège', 'Pâte à dents Sensodyne', 'Pâte à dents Colgate', 'Pâte à dents Crest',
    'Déodorant Old Spice', 'Déodorant Dove', 'Déodorant Secret', 'Déodorant Degree', 'Déodorant Axe', 'Antisudorifique',
    'Brosses à dents Oral-B', 'Têtes de brosse à dents électrique', 'Rince-bouche Listerine', 'Soie dentaire Oral-B', 'Bâtonnets de soie dentaire',
    'Shampoing Head & Shoulders', 'Shampoing Pantene', 'Shampoing pour enfants', 'Revitalisant Pantene', 'Gel douche', 'Gel douche Old Spice', 'Savon Dove', 'Savon Irish Spring',
    'Rasoirs Gillette', 'Lames Gillette', 'Gel à raser Gillette', 'Papier de toilette Cashmere', 'Papier de toilette Royale', 'Papier de toilette Charmin',
    'Mouchoirs Kleenex', 'Mouchoirs Scotties', 'Couches Huggies', 'Couches Pampers', 'Culottes d\'entraînement', 'Lingettes Huggies',
    'Serviettes hygiéniques Always', 'Tampons Tampax', 'Protège-dessous', 'Crème hydratante', 'Lotion Aveeno', 'Baume à lèvres Blistex', 'Gel pour cheveux',
    'Fixatif', 'Démaquillant', 'Ouate', 'Tylenol', 'Advil', 'Sirop contre la toux', 'Pastilles pour la gorge', 'Antihistaminique', 'Gouttes pour les yeux',
    'Thermomètre', 'Désinfectant pour les mains', 'Masques', 'Vitamine D3', 'Multivitamines', 'Oméga-3', 'Probiotiques']),
  ...groupe(ENT, ['Détergent à lessive Tide', 'Détergent à lessive Gain', 'Détergent à lessive Purex', 'Capsules à lessive', 'Détachant', 'Assouplissant Downy',
    'Feuilles assouplissantes Bounce', 'Savon à vaisselle Dawn', 'Savon à vaisselle Palmolive', 'Savon à vaisselle Sunlight', 'Détergent lave-vaisselle Cascade',
    'Détergent lave-vaisselle Finish', 'Pastilles lave-vaisselle', 'Agent de rinçage', 'Eau de Javel Javex', 'Lingettes Lysol', 'Nettoyant Lysol', 'Nettoyant Windex',
    'Nettoyant Mr. Net', 'Nettoyant à cuvette', 'Gomme magique', 'Essuie-tout Bounty', 'Essuie-tout SpongeTowels', 'Sacs Ziploc', 'Sacs à ordures Glad',
    'Pellicule Glad', 'Sacs à lunch', 'Serviettes de table', 'Assiettes en carton', 'Verres jetables', 'Ustensiles jetables', 'Pailles', 'Désodorisant',
    'Recharges de désodorisant', 'Piles AA', 'Piles AAA', 'Sacs pour aspirateur', 'Filtre de hotte', 'Litière agglomérante', 'Gâteries pour chien', 'Gâteries pour chat',
    'Sacs à crottes', 'Lave-glace', 'Sel à déglacer']),
  ...groupe(SEC, ['Café Tim Hortons', 'Café Maxwell House', 'Café Folgers', 'Capsules Keurig', 'Café instantané Nescafé', 'Thé Red Rose', 'Thé vert',
    'Céréales Cheerios', 'Céréales Corn Flakes', 'Céréales Special K', 'Céréales Mini-Wheats', 'Gruau Quaker', 'Kraft Dinner', 'Beurre d\'arachide Kraft',
    'Ketchup Heinz', 'Mayonnaise Hellmann\'s', 'Moutarde French\'s', 'Sauce Ranch', 'Vinaigrette', 'Croûtons', 'Craquelins Ritz', 'Biscuits soda',
    'Mélange à crêpes', 'Sirop de table', 'Mélange à gâteau', 'Glaçage', 'Gélatine Jell-O', 'Pouding instantané', 'Sucre brun', 'Édulcorant']),
  ...groupe(COL, ['Croustilles Lay\'s', 'Croustilles Old Dutch', 'Doritos', 'Cheetos', 'Goldfish', 'Biscuits Oreo', 'Biscuits Dad\'s', 'Barres Nature Valley',
    'Barres Quaker', 'Fruits séchés', 'Collations aux fruits', 'Pouding en coupes', 'Yogourt à boire', 'Gomme', 'Coca-Cola', 'Pepsi', 'Ginger ale',
    'Eau gazéifiée Bubly', 'Gatorade', 'Jus de raisin', 'Limonade', 'Thé glacé', 'Boissons énergisantes', 'Café froid']),
  ...groupe(LAI, ['Lait 2 %', 'Lait 1 %', 'Lait écrémé', 'Lait 3,25 %', 'Lait sans lactose', 'Boisson d\'amande', 'Crème à café', 'Beurre salé', 'Beurre non salé', 'Fromage râpé', 'Oikos', 'Danone']),
  ...groupe(SUR, ['Glaçons', 'Pizza Delissio', 'Pogos', 'Burritos surgelés', 'Repas surgelés', 'Bleuets surgelés', 'Petits fruits surgelés', 'Edamames surgelés', 'Sucettes glacées'])
];

// Mots qui suffisent pour un nom hors catalogue (« savon à lessive Tide » → Entretien).
const REGLES = [
  [HYG, /pate a dents?|sensodyne|colgate|crest|old spice|oral.b|listerine|gillette|cashmere|charmin|scotties|huggies|pampers|tampax|always|aveeno|papier (de )?toilette|papier hygienique|mouchoir|kleenex|savon (a mains|pour le corps|corporel)|gel douche|shampo|revitalisant|dentifrice|brosses? a dents|soie dentaire|rince.bouche|deodorant|antisudorifique|rasoir|creme a raser|coton|demaquill|serviettes? hygienique|tampons|couche|lingettes? (pour )?bebe|creme solaire|pansement|tylenol|advil|acetaminophene|ibuprofene|vitamine|lotion|baume|medicament|sirop contre la toux|pharmacie/],
  [ENT, /\btide\b|downy|bounce|palmolive|sunlight|cascade|lysol|windex|javex|ziploc|\bglad\b|bounty|spongetowels|purex|essuie.tout|papier (d.)?alumin|pellicule|papier (parchemin|ciré|cire)|sacs?|savon a vaisselle|detergent|lessive|assouplissant|javel|nettoyant|desinfect|eponge|linges?|gants|piles|ampoule|allumette|chandelle|litiere|nourriture pour|moulee|filtres? a cafe|vaisselle jetable|assiettes en carton|ustensiles jetables|serviettes de table/],
  [COL, /croustille|chips|craquelin|biscuit|barres?|mais souffle|popcorn|bretzel|bonbon|chocolat|friandise|\bjus\b|boisson gazeuse|liqueur|eau petillante|eau en bouteille|biere|\bvins?\b|cidre|kombucha/],
  [SEC, /\bcafe\b|\bthe\b|tisane|cereale|gruau/]
];

const mots = (s) => norm(s).replace(/[’']/g, ' ').replace(/\ben des\b/g, 'endes').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^(de|du|des|d|la|le|les|l|a|au|aux|en|et|pour)$/.test(w)).map((w) => w.replace(/[sx]$/, ''));
const cle = (s) => mots(s).join(' ');

// L'article du catalogue qui correspond au nom tapé : même nom, sinon celui dont tous les mots sont dans le nom et qui
// commence par le même mot (le nom d'abord, en français : « Jus de tomate » n'est pas des tomates), le plus précis.
export function duCatalogue(nom) {
  const k = cle(nom); if (!k) return null;
  const tape = new Set(k.split(' ')), tete = k.split(' ')[0];
  let meilleur = null, taille = 0;
  for (const [n, rayon] of CATALOGUE) {
    const m = cle(n);
    if (m === k) return { nom: n, rayon };
    const ws = m.split(' ');
    if (ws[0] === tete && ws.every((w) => tape.has(w)) && ws.length > taille) { meilleur = { nom: n, rayon }; taille = ws.length; }
  }
  return meilleur;
}

// Rayon d'un article libre : retenu sur l'appareil, catalogue, règles maison, puis rayons des ingrédients.
export function rayonDe(nom, appris = {}) {
  const k = cle(nom);
  if (k && appris[k]) return appris[k];
  const c = duCatalogue(nom); if (c) return c.rayon;
  const s = norm(nom).replace(/[’']/g, ' ');
  for (const [rayon, re] of REGLES) if (re.test(s)) return rayon;
  return deptOf(nom);
}
export const cleRayon = cle;

// Nom propre : première lettre en majuscule, espaces simples.
export const nomPropre = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60); return t && t.charAt(0).toUpperCase() + t.slice(1); };

// Ajout dans la liste (tableau) : refuse un doublon pas encore pris. Retourne { liste, article } ou { doublon }.
export function ajouterLibre(liste, nom, rayon, id = 'x-' + Date.now().toString(36)) {
  nom = nomPropre(nom); if (!nom) return { liste };
  const deja = liste.find((a) => !a.pris && cle(a.nom) === cle(nom));
  if (deja) return { liste, doublon: deja };
  const article = { id, nom, rayon, pris: false };
  return { liste: [...liste, article], article };
}

// D-G-063 : suggestions pendant qu'on tape. sources : [{ nom, rayon, origine: 'memo' | 'inv' | 'cat', fois }].
// Chaque mot tapé doit commencer un mot du nom (« sens rep » trouve « Pâte à dents Sensodyne Répare et protège »).
// Tes articles déjà ajoutés passent d'abord (les plus fréquents en tête), puis le garde-manger, puis le catalogue.
const motsBruts = (s) => norm(s).replace(/[’']/g, ' ').replace(/[^a-z0-9% ]/g, ' ').split(/\s+/).filter(Boolean);
export function suggestions(q, sources, max = 8) {
  const tape = motsBruts(q); if (!tape.length) return [];
  const POIDS = { memo: 3, inv: 2, cat: 1 }, vus = new Map();
  for (const s of sources) {
    const ws = motsBruts(s.nom);
    if (!tape.every((t) => ws.some((w) => w.startsWith(t)))) continue;
    const score = POIDS[s.origine] * 100 + Math.min(s.fois || 0, 50) + (ws[0].startsWith(tape[0]) ? 20 : 0) - ws.length * 0.1;
    const k = cle(s.nom), deja = vus.get(k);
    if (!deja || deja.score < score) vus.set(k, { ...s, score });
  }
  return [...vus.values()].sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr')).slice(0, max);
}
