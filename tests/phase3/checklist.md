# Checklist Phase 3 — Tablette cuisine + Télé salle

> Vérification manuelle du flux temps réel complet.
> Pré-requis : app Electron ouverte, POS connecté au réseau local.
> URL à utiliser depuis les appareils : `http://[IP-DU-PC]:3002/cuisine` et `/display`
>
> Pour trouver l'IP du PC POS : `ipconfig` (Windows) ou `ip a` (Linux) → adresse 192.168.x.x

---

## 0. Pré-requis réseau

- [ ] Le PC POS et la tablette sont sur le **même réseau Wi-Fi/LAN**
- [ ] `http://[IP-PC]:3002/api/health` répond `{"status":"ok"}` depuis la tablette
- [ ] `http://[IP-PC]:3002/cuisine` s'ouvre dans le navigateur de la tablette
- [ ] `http://[IP-PC]:3002/display` s'ouvre dans le navigateur de la télé/tablette

---

## 1. Page Tablette Cuisine (`/cuisine`)

### Affichage initial
- [ ] La page se charge sans erreur (pas d'écran blanc)
- [ ] L'indicateur WebSocket affiche **"⬤ Connecté"** (vert) en haut à droite
- [ ] Si des commandes `sentToKitchen` existent → elles s'affichent en cartes
- [ ] Si aucune commande → message "✅ Pas de commande en attente"
- [ ] Le nom du restaurant n'est **pas** affiché (tablette cuisine, pas besoin)

### Cartes de commande
- [ ] Chaque carte affiche le **numéro de commande** (N°X) en grand
- [ ] Le **type** est visible (Sur place / À emporter / Livraison)
- [ ] La **liste des articles** est lisible (quantité + nom)
- [ ] Les **modificateurs** s'affichent sous chaque article (ex: "Sans oignon")
- [ ] Le **timer** indique le temps écoulé depuis la création
- [ ] Le bouton **"✓ Prêt"** est bien visible et accessible au toucher

### Code couleur urgence
- [ ] Commande < 5 min → bordure **bleue**
- [ ] Commande > 5 min → bordure **orange**
- [ ] Commande > 10 min → bordure **rouge pulsante**

### Responsive tablette
- [ ] La page s'affiche correctement en mode **paysage** (landscape)
- [ ] La page s'affiche correctement en mode **portrait**
- [ ] Les boutons sont assez grands pour être appuyés avec un doigt

---

## 2. Page Télé Salle (`/display`)

### Affichage initial
- [ ] La page se charge sans erreur
- [ ] L'indicateur WebSocket (point vert/rouge) est visible en haut à droite
- [ ] Le **nom du restaurant** s'affiche en haut (lu depuis les paramètres)
- [ ] L'**horloge** s'affiche en haut à droite
- [ ] Section "✅ COMMANDES PRÊTES" visible (même vide)
- [ ] Section "⏳ En préparation" visible en bas

### Affichage des commandes
- [ ] Les commandes `ready` s'affichent en **grand vert** dans la section haute
- [ ] Les commandes `sentToKitchen` s'affichent en **gris petit** dans la section basse
- [ ] Les numéros sont **lisibles depuis 3-4 mètres**

---

## 3. Flux temps réel complet

> Tester avec le POS ouvert sur le PC ET la tablette/télé ouverte simultanément.

### Flux : Nouvelle commande → Cuisine

- [ ] **POS** : créer une commande (ajouter des articles)
- [ ] **POS** : cliquer "Envoyer en cuisine"
- [ ] **Tablette cuisine** : la carte apparaît **sans recharger la page** (< 1 seconde)
- [ ] **Tablette cuisine** : un **son d'alerte** retentit à l'arrivée de la commande
- [ ] **Télé salle** : la commande apparaît dans "⏳ En préparation"

### Flux : Cuisine → Prêt

- [ ] **Tablette cuisine** : appuyer sur "✓ Prêt"
- [ ] **Tablette cuisine** : la carte **disparaît immédiatement**
- [ ] **Télé salle** : le numéro **apparaît en vert** dans "✅ Commandes prêtes" avec animation
- [ ] **Télé salle** : le numéro **disparaît** de "En préparation"
- [ ] **POS** : une **notification toast** apparaît "🔔 Commande N°X prête !"

### Flux : Client récupère → Payé

- [ ] **POS** : marquer la commande comme payée
- [ ] **Télé salle** : le numéro **disparaît automatiquement** de "Commandes prêtes"

---

## 4. Reconnexion WebSocket

- [ ] Fermer et rouvrir l'onglet tablette → se reconnecte et recharge les commandes
- [ ] Redémarrer Fastify (fermer/rouvrir l'Electron) → tablette se reconnecte en ~3s
- [ ] Indicateur WebSocket passe **rouge** pendant la déconnexion puis **vert** à la reconnexion

---

## 5. Compatibilité appareils

> Tester sur au moins 2 types d'appareils différents.

- [ ] **Tablette Android** (Chrome) → `/cuisine` et `/display` fonctionnent
- [ ] **iPad / iPhone** (Safari) → `/cuisine` et `/display` fonctionnent
- [ ] **Smart TV** ou navigateur embarqué → `/display` fonctionne (lecture seule)
- [ ] **PC / Mac** (Chrome/Firefox) → les deux pages fonctionnent

---

## 6. Robustesse

- [ ] Plusieurs tablettes cuisine ouvertes simultanément → toutes reçoivent les events
- [ ] Tablette cuisine ET télé salle ouvertes → les deux se mettent à jour
- [ ] Ouvrir `/cuisine` sur mobile en mode économie d'énergie → pas de déconnexion forcée
- [ ] `GET /api/ws/status` retourne le bon nombre de clients connectés

---

## Résultat

| Section | Items | Validés | Statut |
|---|---|---|---|
| 0. Pré-requis réseau | 4 | | |
| 1. Tablette cuisine | 14 | | |
| 2. Télé salle | 8 | | |
| 3. Flux temps réel | 11 | | |
| 4. Reconnexion WS | 4 | | |
| 5. Compatibilité | 4 | | |
| 6. Robustesse | 4 | | |
| **TOTAL** | **49** | | |

> Phase 3 validée quand tous les items sont ✅.
> Blockers (items ❌) à corriger avant de passer à la Phase 4.
