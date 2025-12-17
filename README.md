# Mini-RPG — Prototype (JS / HTML / CSS)

Ce dépôt contient un prototype jouable d'un RPG tour par tour implémenté uniquement en HTML/CSS/JavaScript. Le but est de fournir un moteur complet, documenté et équilibré pour expérimenter mécaniques, compétences, loot et progression.

## Fichiers
- [index.html](index.html) : UI du jeu (single page)
- [style.css](style.css) : styles
- [game.js](game.js) : moteur, données et logique de jeu

## Principes généraux
- Tour par tour : l'ordre d'action est déterminé par la statistique `Vitesse` (Speed).
- Pas de RNG absurde : les calculs sont clairs, probabilités expliquées.
- Système modulaire : compétences, status, équipements et loot.

## Stats et formules (claires)

- HP, MP : points de vie et ressource pour compétences.
- ATK / DEF : attaque physique et défense.
- MAG / MDEF : attaque magique et défense magique.
- SPD : vitesse (détermine ordre des tours).
- CRIT Rate (%) : probabilité de coup critique.
- CRIT Dmg (%) : multiplicateur additionnel en cas de critique (ex: 50 signifie x1.5).
- ACC (Précision) / EVA (Esquive) : influencent la probabilité de toucher.
- LUCK : influence taux de drop, petite influence sur critic.

Formules principales :

- XP nécessaire pour atteindre le niveau L : `xp(L) = floor(BASE_XP * (L-1) ^ XP_GROWTH)` où `BASE_XP=100`, `XP_GROWTH=1.45`.
- Dégâts physiques (pré-crit) : base = max(1, atk * power - floor(def * 0.6)).
- Dégâts magiques (pré-crit) : base = max(1, mag * power - floor(mdef * 0.5)).
- Vérification de coup : chance de toucher = clamp(80 + acc_attacker - eva_defender, 5, 99).
- Crit : probabilité = critRate + luck * CRIT_LUCK_FACTOR (avec CRIT_LUCK_FACTOR = 0.02).
- Mult. critique : en cas de critique, dégâts *= (1 + critDmg/100).
- Variance : un multiplicateur aléatoire entre 0.9 et 1.1 est appliqué.

Exemple de calcul :
- Attaquant ATK=20, Défenseur DEF=6, power=1.0
  - base = max(1, 20*1 - floor(6*0.6)) = max(1, 20 - 3) = 17
  - si crit 50% => dmg = floor(17 * 1.5 * variance)

## Progression et niveaux
- Gains d'XP après chaque combat (exemple : 20 * niveau ennemi * 1.2).
- À certains paliers (tous les 5 niveaux) le joueur choisit une amélioration (ex: +ATK, +MAG, +SPD, +PV).
- Level cap : 50 (modifiable dans `game.js`).

## Compétences et classes
- Chaque classe dispose d'un arbre minimal (compétences actives et passives) défini dans `game.js`.
- Coûts en MP, cooldowns et synergies peuvent être ajoutés (architecture prévue).

Exemples de classes incluses : `Guerrier`, `Mage`, `Voleur`.

## Équipements et loot
- Équipement généré aléatoirement avec 4 raretés : Commun, Rare, Épique, Légendaire.
- Rareté influencée par la chance du joueur.
- Les objets modifient les stats via un simple objet `stats`.

## Ennemis et IA
- Templates d'ennemis fournis (`rat`, `gobelin`, `boss_demo`).
- IA basique choisit des compétences aléatoires mais peut être étendue pour phases et patterns de boss.

## Effets de statut
Implémentation prévue (structure) pour : Poison, Brûlure, Gel, Paralysie, Silence, Saignement, Buffs/Debuffs.

## Comment jouer
- Ouvrez `index.html` dans un navigateur moderne.
- Utilisez les boutons `Attaquer`, `Compétence`, `Défendre` pour jouer.
- Le prototype lance automatiquement un combat d'exemple au démarrage.

## Extensions suggérées
- Implémenter cooldowns et coûts progressifs des compétences.
- Améliorer IA des boss avec phases et patterns.
- Ajouter crafting et boutique pleinement fonctionnels.
- Sauvegarde locale (localStorage) et gestion d'un roster de personnages.

---
Pour toute modification ou amélioration, éditez `game.js` et la documentation correspondante.
# RPG-gaem
Tis is fun
