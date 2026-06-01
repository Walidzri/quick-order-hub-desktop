# Checklist manuelle — Phase 1

> **STATUT : VALIDÉE — 83/83 items (30/30 tests curl PASS)**

> ~~Vérifier chaque item après le démarrage de l'application.~~
> ~~Cocher `[x]` quand c'est validé.~~
> ~~La Phase 1 est validée quand TOUS les items sont cochés.~~

---

## 0. Démarrage

| # | Vérification | Statut |
|---|---|---|
| 0.1 | L'app Electron démarre sans erreur dans la console | [ ] |
| 0.2 | Le serveur Fastify démarre sur le port 3002 (log `[FASTIFY] Server listening`) | [ ] |
| 0.3 | Aucune erreur rouge dans la DevTools Console au démarrage | [ ] |
| 0.4 | L'écran de login / setup s'affiche correctement | [ ] |

---

## 1. Auth

| # | Vérification | Statut |
|---|---|---|
| 1.1 | Login avec PIN fonctionne | [ ] |
| 1.2 | Login avec mot de passe fonctionne | [ ] |
| 1.3 | Verrouillage automatique (lock screen) fonctionne | [ ] |
| 1.4 | Déconnexion fonctionne | [ ] |
| 1.5 | Setup (premier lancement) crée le compte Chef correctement | [ ] |

---

## 2. Caisse — Prise de commande

| # | Vérification | Statut |
|---|---|---|
| 2.1 | La grille de produits s'affiche avec les catégories et produits | [ ] |
| 2.2 | Cliquer sur un produit ouvre la modal de sélection | [ ] |
| 2.3 | Sélectionner une variante (taille) fonctionne | [ ] |
| 2.4 | Sélectionner des suppléments / modificateurs fonctionne | [ ] |
| 2.5 | L'article est ajouté au panier avec le bon prix | [ ] |
| 2.6 | Le total du panier est calculé correctement | [ ] |
| 2.7 | La modal de type de commande s'affiche à l'ajout du 1er article (sur place / emporter / livraison) | [ ] |
| 2.8 | Multi-brouillons : créer plusieurs commandes en parallèle fonctionne | [ ] |
| 2.9 | Switcher entre commandes actives fonctionne | [ ] |
| 2.10 | Supprimer un article du panier fonctionne | [ ] |
| 2.11 | Modifier un article du panier fonctionne (EditCartItemModal) | [ ] |
| 2.12 | Vider le panier fonctionne | [ ] |
| 2.13 | Ajouter un article manuel (prix libre) fonctionne | [ ] |
| 2.14 | Supprimer un brouillon de commande fonctionne | [ ] |

---

## 3. Paiement

| # | Vérification | Statut |
|---|---|---|
| 3.1 | Le bouton "Payer" ouvre la modal de paiement | [ ] |
| 3.2 | Sélectionner "Espèces" comme méthode de paiement fonctionne | [ ] |
| 3.3 | Sélectionner "Carte" fonctionne | [ ] |
| 3.4 | La commande passe en statut "paid" après paiement | [ ] |
| 3.5 | Le brouillon est supprimé après paiement | [ ] |
| 3.6 | La modal de prévisualisation reçu s'affiche après paiement | [ ] |
| 3.7 | Appliquer un code promo fonctionne (réduction affichée) | [ ] |
| 3.8 | Code promo invalide affiche un message d'erreur | [ ] |

---

## 4. Impression

| # | Vérification | Statut |
|---|---|---|
| 4.1 | L'impression du ticket caisse (PrintPreviewModal) s'affiche | [ ] |
| 4.2 | L'envoi vers le PrintDaemon C# fonctionne (si configuré) | [ ] |
| 4.3 | L'impression du ticket cuisine fonctionne | [ ] |
| 4.4 | "Envoyer en cuisine" change le statut de la commande | [ ] |

---

## 5. Historique des commandes

| # | Vérification | Statut |
|---|---|---|
| 5.1 | L'onglet "Commandes" affiche la liste des commandes | [ ] |
| 5.2 | Filtrer par statut fonctionne (payée, annulée, etc.) | [ ] |
| 5.3 | Filtrer par date fonctionne | [ ] |
| 5.4 | La pagination fonctionne (si > 1 page) | [ ] |
| 5.5 | Annuler une commande fonctionne | [ ] |
| 5.6 | Supprimer une commande fonctionne | [ ] |
| 5.7 | Supprimer plusieurs commandes (sélection multiple) fonctionne | [ ] |

---

## 6. Rapports

| # | Vérification | Statut |
|---|---|---|
| 6.1 | L'onglet "Rapports" s'affiche sans erreur | [ ] |
| 6.2 | Le CA du jour est calculé correctement | [ ] |
| 6.3 | Les graphiques de ventes s'affichent | [ ] |
| 6.4 | Filtrer par période (jour/semaine/mois) fonctionne | [ ] |

---

## 7. Gestion du catalogue

| # | Vérification | Statut |
|---|---|---|
| 7.1 | L'onglet "Produits" affiche tous les produits | [ ] |
| 7.2 | Créer un nouveau produit fonctionne | [ ] |
| 7.3 | Modifier un produit existant fonctionne | [ ] |
| 7.4 | Supprimer un produit fonctionne | [ ] |
| 7.5 | Créer une catégorie fonctionne | [ ] |
| 7.6 | Modifier une catégorie fonctionne | [ ] |
| 7.7 | Supprimer une catégorie vide fonctionne | [ ] |
| 7.8 | Supprimer une catégorie non-vide affiche une erreur | [ ] |
| 7.9 | Export JSON du catalogue fonctionne | [ ] |
| 7.10 | Import JSON du catalogue fonctionne | [ ] |

---

## 8. Paramètres

| # | Vérification | Statut |
|---|---|---|
| 8.1 | L'onglet "Paramètres" s'affiche sans erreur | [ ] |
| 8.2 | Changer la langue fonctionne (FR / EN / AR) | [ ] |
| 8.3 | Le mode RTL s'active en arabe | [ ] |
| 8.4 | Changer la devise fonctionne | [ ] |
| 8.5 | Activer le mode sombre fonctionne | [ ] |
| 8.6 | Changer la couleur principale fonctionne | [ ] |
| 8.7 | L'échelle UI (zoom) fonctionne | [ ] |
| 8.8 | Ajouter une imprimante fonctionne | [ ] |
| 8.9 | Modifier une imprimante fonctionne | [ ] |
| 8.10 | Supprimer une imprimante fonctionne | [ ] |
| 8.11 | Tester la connexion à une imprimante fonctionne | [ ] |
| 8.12 | La personnalisation du ticket (logo, textes) fonctionne | [ ] |
| 8.13 | La prévisualisation du ticket se met à jour en temps réel | [ ] |
| 8.14 | Le backup manuel fonctionne (si configuré) | [ ] |
| 8.15 | La gestion des utilisateurs (créer / modifier / supprimer) fonctionne | [ ] |

---

## 9. Mode kiosk

| # | Vérification | Statut |
|---|---|---|
| 9.1 | Activer le mode kiosk passe en plein écran | [ ] |
| 9.2 | Désactiver le mode kiosk sort du plein écran | [ ] |

---

## 10. Gestion des stocks (Inventaire)

| # | Vérification | Statut |
|---|---|---|
| 10.1 | L'onglet "Inventaire" s'affiche sans erreur | [ ] |
| 10.2 | Ajouter un fournisseur fonctionne | [ ] |
| 10.3 | Ajouter un article d'inventaire fonctionne | [ ] |
| 10.4 | Créer une facture d'achat met à jour les stocks | [ ] |
| 10.5 | Supprimer une facture annule la mise à jour des stocks | [ ] |

---

## 11. Robustesse

| # | Vérification | Statut |
|---|---|---|
| 11.1 | Recharger l'app (Ctrl+R) ne perd pas les commandes en cours dans IndexedDB | [ ] |
| 11.2 | Aucune erreur TypeScript dans la console DevTools | [ ] |
| 11.3 | Aucune erreur "usePOS must be used within a POSProvider" | [ ] |
| 11.4 | Aucune erreur "useSettings must be used within a SettingsProvider" | [ ] |
| 11.5 | Le serveur Fastify répond sur GET /api/health (vérifiable dans DevTools Network) | [ ] |

---

## Résumé

| Section | Items | Validés |
|---|---|---|
| 0. Démarrage | 4 | |
| 1. Auth | 5 | |
| 2. Caisse | 14 | |
| 3. Paiement | 8 | |
| 4. Impression | 4 | |
| 5. Historique | 7 | |
| 6. Rapports | 4 | |
| 7. Catalogue | 10 | |
| 8. Paramètres | 15 | |
| 9. Mode kiosk | 2 | |
| 10. Inventaire | 5 | |
| 11. Robustesse | 5 | |
| **TOTAL** | **83** | |

> **Phase 1 validée quand les 83 items sont cochés.**
> En cas de régression, noter le numéro d'item et la description du bug avant de passer à la Phase 2.
