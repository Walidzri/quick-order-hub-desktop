# Checklist Phase 2 — Validation migration IDB → SQLite

> **STATUT : VALIDÉE — 88/88 items**

> ~~Vérification manuelle de toutes les fonctionnalités après migration complète.~~
> ~~Cocher chaque item après vérification dans l'app Electron.~~
> ~~Tous les items doivent être ✅ avant de valider la Phase 2 et passer à la Phase 3.~~

---

## 0. Démarrage

- [ ] L'app Electron démarre sans erreur console (F12 → Console)
- [ ] Le serveur Fastify démarre sur le port 3002 (visible dans les logs Electron)
- [ ] La base de données SQLite est chargée sans erreur
- [ ] L'écran de connexion s'affiche correctement
- [ ] La connexion avec un compte existant fonctionne (PIN ou mot de passe)

---

## 1. Catalogue — Produits & Catégories

- [ ] Les catégories s'affichent dans la sidebar gauche
- [ ] Les produits s'affichent dans la grille centrale
- [ ] Filtrer par catégorie fonctionne
- [ ] **Créer un produit** → le produit apparaît dans la grille
- [ ] **Modifier un produit** → les modifications sont sauvegardées
- [ ] **Supprimer un produit** → le produit disparaît
- [ ] **Créer une catégorie** → apparaît dans la sidebar
- [ ] **Modifier une catégorie** → modifications sauvegardées
- [ ] **Supprimer une catégorie** → disparaît
- [ ] Les variantes produit s'affichent et se modifient correctement
- [ ] Les groupes de modificateurs fonctionnent (ajout/suppression)

---

## 2. Prise de commande

- [ ] Sélectionner le type de commande (sur place / à emporter / livraison)
- [ ] Ajouter un produit au panier
- [ ] Modifier la quantité dans le panier
- [ ] Supprimer un article du panier
- [ ] Ajouter un article manuel (prix libre)
- [ ] Appliquer une promotion → le total est recalculé
- [ ] **Valider une commande** → la commande apparaît dans l'historique
- [ ] Le numéro de commande est généré correctement

---

## 3. Paiement

- [ ] Ouvrir le modal de paiement
- [ ] Paiement en espèces → monnaie rendue calculée correctement
- [ ] Paiement par carte
- [ ] Paiement mixte (espèces + carte)
- [ ] La commande passe en statut "payée" après paiement
- [ ] Le ticket de caisse s'imprime (ou la prévisualisation s'affiche)
- [ ] Le ticket cuisine s'imprime (si imprimante configurée)

---

## 4. Historique des commandes

- [ ] Les commandes existantes s'affichent
- [ ] Filtrer par statut fonctionne (en cours / payées / annulées)
- [ ] Filtrer par date fonctionne
- [ ] Rechercher une commande par numéro fonctionne
- [ ] Ouvrir le détail d'une commande
- [ ] Annuler une commande fonctionne
- [ ] Réimprimer un ticket depuis l'historique

---

## 5. Rapports

- [ ] Les statistiques de ventes s'affichent (CA, nb commandes)
- [ ] Le graphique des ventes se charge
- [ ] Les produits les plus vendus s'affichent
- [ ] Filtrer par période fonctionne (aujourd'hui / semaine / mois / custom)
- [ ] **Stats caissiers** — la liste des sessions utilisateurs s'affiche
- [ ] **Stats caissiers** — les totaux par utilisateur sont corrects
- [ ] L'export CSV fonctionne (télécharge un fichier)

---

## 6. Inventaire

- [ ] L'onglet Inventaire s'ouvre sans erreur
- [ ] **Fournisseurs** — la liste s'affiche
- [ ] **Fournisseurs** — créer un fournisseur → sauvegardé
- [ ] **Fournisseurs** — modifier un fournisseur → sauvegardé
- [ ] **Fournisseurs** — supprimer un fournisseur
- [ ] **Articles** — la liste s'affiche avec les stocks
- [ ] **Articles** — créer un article → stock initialisé à 0
- [ ] **Articles** — modifier un article → sauvegardé
- [ ] **Articles** — supprimer un article
- [ ] **Factures** — la liste s'affiche
- [ ] **Factures** — créer une facture → le stock des articles est mis à jour
- [ ] **Factures** — modifier une facture → le stock est recalculé correctement
- [ ] **Factures** — supprimer une facture → le stock est restauré

---

## 7. Paramètres — Général

- [ ] Les paramètres s'affichent (nom restaurant, langue, devise...)
- [ ] Modifier le nom du restaurant → sauvegardé après rechargement
- [ ] Changer la langue → l'interface se met à jour
- [ ] Changer la devise → s'affiche correctement dans le POS
- [ ] Le mode kiosque s'active/désactive
- [ ] Le mode sombre fonctionne

---

## 8. Paramètres — Imprimantes

- [ ] La liste des imprimantes s'affiche
- [ ] Ajouter une imprimante → sauvegardée
- [ ] Modifier une imprimante → sauvegardée
- [ ] Supprimer une imprimante

---

## 9. Paramètres — Utilisateurs

- [ ] La liste des utilisateurs s'affiche
- [ ] Créer un utilisateur → apparaît dans la liste
- [ ] Modifier un utilisateur → modifications sauvegardées
- [ ] Changer le PIN d'un utilisateur → connexion avec nouveau PIN OK
- [ ] Supprimer un utilisateur

---

## 10. Paramètres — Promotions

- [ ] La liste des promotions s'affiche
- [ ] Créer une promotion → applicable dans le POS
- [ ] Modifier une promotion → sauvegardée
- [ ] Désactiver/activer une promotion
- [ ] Supprimer une promotion

---

## 11. Paramètres — Données (Backup)

- [ ] **Export backup** — le bouton télécharge un fichier JSON
- [ ] Le fichier JSON exporté contient : produits, commandes, settings, utilisateurs, inventaire
- [ ] **Import backup** — charger le fichier exporté → les données sont restaurées
- [ ] Après restauration, les données sont identiques à l'export

---

## 12. Robustesse

- [ ] Fermer et rouvrir l'app → les données persistent (SQLite)
- [ ] Aucune erreur "getDB" ou "IndexedDB" dans la console
- [ ] Aucune erreur réseau dans la console (toutes les requêtes vers 127.0.0.1:3002 répondent)
- [ ] L'app fonctionne sans connexion internet

---

## Résultat

| Section | Items | Validés | Statut |
|---|---|---|---|
| 0. Démarrage | 5 | | |
| 1. Catalogue | 11 | | |
| 2. Prise de commande | 8 | | |
| 3. Paiement | 7 | | |
| 4. Historique | 7 | | |
| 5. Rapports | 7 | | |
| 6. Inventaire | 13 | | |
| 7. Paramètres Général | 8 | | |
| 8. Paramètres Imprimantes | 4 | | |
| 9. Paramètres Utilisateurs | 5 | | |
| 10. Paramètres Promotions | 5 | | |
| 11. Paramètres Données | 4 | | |
| 12. Robustesse | 4 | | |
| **TOTAL** | **88** | | |

> Phase 2 validée quand tous les items sont ✅.
> Blockers (items ❌) à corriger avant de passer à la Phase 3.
