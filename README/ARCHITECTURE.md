# Architecture complète — Quick Order Hub

> Document de référence pour la Phase 4 (VPS, sync cloud, click & collect, licences).
> Tout ce qui est décrit ici est prévu mais pas encore implémenté (sauf ce qui est marqué ✅).

---

## Vue d'ensemble

```
Internet
└── Client (click & collect)
      └── Site vitrine + commande en ligne
            └── VPS
                  └── WireGuard VPN
                        └── Réseau local restaurant
                              ├── PC tactile POS (caisse)
                              ├── Tablette cuisine
                              ├── Télé salle (clients)
                              └── Imprimante thermique
```

---

## 1. VPS

### Ce qu'il héberge
- **Site vitrine** — accueil, menu, localisation (déjà en place ✅)
- **WireGuard VPN** — tunnel sécurisé vers le réseau local (déjà en place ✅)
- **Backend cloud** — Fastify + PostgreSQL (Phase 3)
- **Panel admin** — supervision globale des commandes (Phase 3)

### Rôle dans l'architecture
Le VPS est le pont entre internet et le réseau local du restaurant. Il ne contacte jamais directement le POS — c'est toujours le POS qui initie les connexions vers l'extérieur.

### Stack technique
```
VPS
├── WireGuard (VPN)
├── Fastify (API cloud)
├── PostgreSQL (base de données cloud)
└── Site vitrine (HTML statique)
```

---

## 2. Réseau local restaurant

### Topologie

```
Routeur (WireGuard client)
└── LAN 192.168.1.0/24
      ├── PC tactile POS     192.168.1.2
      ├── Tablette cuisine   192.168.1.3
      ├── Télé salle         192.168.1.4
      └── Imprimante         192.168.1.5
```

### VPN sur le routeur (pas sur chaque appareil)
Le routeur est le seul à gérer la connexion WireGuard vers le VPS. Tous les appareils du réseau local bénéficient automatiquement du tunnel sans configuration individuelle. L'ajout d'un nouvel appareil (caisse supplémentaire, tablette...) ne nécessite aucune config VPN.

### DNS local (optionnel mais recommandé)
Un serveur DNS local (Pi-hole ou Adguard Home) pour éviter de retenir les IPs :

```
pos.local       → 192.168.1.2   # POS = seul serveur, toutes les pages viennent de lui
cuisine.local   → 192.168.1.2   # alias vers le POS (la page /cuisine est servie par Fastify sur le POS)
display.local   → 192.168.1.2   # alias vers le POS (la page /display est servie par Fastify sur le POS)
vps.local       → 10.0.0.1      # IP WireGuard du VPS
```

> Les tablettes/TV n'hébergent rien — elles consomment uniquement des pages servies par le POS.
> `cuisine.local` et `display.local` pointent vers le POS, pas vers les appareils eux-mêmes.

---

## 3. PC tactile POS — le cœur du système

### Rôle
C'est le serveur principal du réseau local. Il héberge Fastify qui sert à la fois l'API REST, les pages web des autres écrans, et les WebSockets temps réel.

### Ce qu'il fait tourner
```
PC tactile
├── Electron (interface caisse)     ~200MB RAM
├── Fastify :3002                   ~50MB RAM
│     ├── API REST (/api/*)
│     ├── Page cuisine (/cuisine)
│     ├── Page salle (/display)
│     └── WebSocket (/ws/events)
├── SQLite (base locale)            ~10MB RAM
└── PrintDaemon C# (impression)
```

### Routes Fastify
```
GET  /api/orders          → liste des commandes
POST /api/orders          → nouvelle commande
PATCH /api/orders/:id     → mise à jour statut

GET  /api/products        → catalogue produits
GET  /api/categories      → catégories

POST /api/print           → délègue au PrintDaemon

GET  /cuisine             → page web tablette cuisine
GET  /display             → page web télé salle
WS   /ws/events           → WebSocket temps réel
```

### Offline-first
SQLite local = source de vérité. Le POS fonctionne intégralement sans internet et sans VPS. La sync cloud se fait en arrière-plan quand la connexion est disponible.

---

## 4. Tablette cuisine

### Rôle
Afficher les commandes en cours pour le cuisinier. Permettre de marquer une commande comme prête.

### Technique
```
Tablette (n'importe quel appareil avec un navigateur)
└── Chrome / Safari / Firefox
      └── http://pos.local:3002/cuisine
            └── WebSocket ws://pos.local:3002/ws/events
                  └── reçoit les nouvelles commandes en temps réel
```

Zéro installation — juste un navigateur pointant vers le POS local. Marche sur Android, iPad, vieille tablette reconditionnée (50-100€).

### Flux
```
1. Nouvelle commande créée sur le POS
2. WebSocket push → tablette cuisine
3. Commande apparaît à l'écran
4. Cuisinier prépare → appuie "Prêt"
5. PATCH /api/orders/:id { status: "ready" }
6. WebSocket push → télé salle + notification caisse
```

---

## 5. Télé salle (écran clients)

### Rôle
Afficher les numéros de commandes prêtes à être récupérées par les clients.

### Technique
```
Télé / écran (n'importe quel appareil avec un navigateur)
└── Chrome / navigateur intégré Smart TV
      └── http://pos.local:3002/display
            └── WebSocket temps réel
                  └── affiche/retire les numéros automatiquement
```

Marche sur Smart TV (Samsung Tizen, LG WebOS), tablette, mini PC, Raspberry Pi. Zéro installation, zéro OS supplémentaire si la TV a un navigateur intégré.

### Ce qu'il affiche
```
┌─────────────────────────────┐
│     COMMANDES PRÊTES        │
│                             │
│   🟢 N°12    🟢 N°15       │
│   🟢 N°18                  │
│                             │
│   En préparation : N°20    │
└─────────────────────────────┘
```

---

## 6. Flux de synchronisation POS ↔ VPS

### Principe — le POS initie toujours
Le VPS ne contacte jamais directement le POS. C'est le POS qui :
- Envoie les commandes vers le VPS après paiement
- Récupère les nouvelles commandes click & collect via long polling

### Long polling (click & collect)
```
POS → GET /api/orders/pending (VPS)
VPS → attend jusqu'à 30s
      → nouvelle commande ? répond immédiatement
      → rien après 30s ? répond "rien de nouveau"
POS → re-demande immédiatement
```

Quasi temps réel, sans WebSocket persistant vers l'extérieur, sans ouvrir de ports entrants.

### Sync commandes locales → VPS
```
Commande payée sur le POS
└── SQLite : syncStatus = "pending"
      └── SyncService (background)
            └── POST /api/orders (VPS)
                  └── succès : syncStatus = "synced"
                  └── échec réseau : retry automatique
```

### Flux click & collect complet
```
1. Client commande sur le site web
2. Commande créée sur le VPS (PostgreSQL)
3. POS poll le VPS → "nouvelle commande click & collect"
4. Commande apparaît sur le POS comme commande normale
5. Cuisinier prépare → "Prêt"
6. Statut sync vers VPS
7. Client reçoit notification (SMS ou page web)
```

---

## 7. Impression

### PrintDaemon C# (inchangé)
Le PrintDaemon reste le microservice d'impression. Il gère tous les protocoles :

```
Fastify (printService.ts)
└── HTTP → PrintDaemon C# :9100
      ├── TCP/IP → imprimante réseau
      ├── USB    → imprimante locale
      └── BT     → imprimante Bluetooth
```

### Ce qui est imprimé
- Ticket caisse (client)
- Ticket cuisine (bon de commande)
- Ticket récapitulatif (fin de service)

---

## 8. Scalabilité — vendre la solution

### Modèle envisagé (à définir)
Plusieurs options possibles :

**Multi-tenant centralisé** — un seul VPS, une base PostgreSQL par client
```
VPS central
├── Restaurant A (base isolée)
├── Restaurant B (base isolée)
└── Restaurant C (base isolée)
```
Avantage : un seul endroit à maintenir, mises à jour pour tout le monde en une fois.

**Déploiement client** — chaque restaurant reçoit un PC préconfiguré
```
1. PC tactile préconfiguré avec Electron + SQLite + restaurant_id
2. Client branche et démarre
3. Sync automatique avec le VPS central
4. Panel admin central pour superviser tous les restaurants
```

> ⚠️ Modèle de pricing et architecture multi-client à définir en Phase 3.

---

## 9. Phases de développement

| Phase | Statut | Contenu |
|---|---|---|
| **Phase 0** | ✅ Terminée | Analyse complète du code |
| **Phase 1** | ✅ Terminée | Séparation frontend/backend, Fastify |
| **Phase 2** | ✅ Terminée | Migration IndexedDB → SQLite |
| **Phase 3** | ✅ Terminée | WebSocket + service pages HTML (cuisine, display) |
| **Phase 4** | ⏳ En attente | VPS cloud, sync, click & collect, multi-restaurant |

---

## 10. Sécurité réseau local

> Ces mesures sont à implémenter avant toute mise en production.

### Priorité 1 — Deux WiFi séparés (le plus important)

```
Routeur
├── WiFi "Restaurant"  → clients, internet uniquement, isolé du LAN
└── WiFi "POS"         → appareils internes uniquement, accès LAN
```

Un client connecté au WiFi public ne voit jamais le réseau POS. C'est la protection la plus efficace — si l'attaquant ne voit pas le réseau, il ne peut rien faire. La plupart des routeurs modernes supportent plusieurs SSID avec isolation.

### Priorité 2 — Whitelist d'IPs dans Fastify

Autoriser uniquement les IPs connues du réseau local :

```typescript
fastify.addHook('onRequest', (request, reply, done) => {
  const ip = request.ip
  const allowed = ['192.168.1.3', '192.168.1.4', '127.0.0.1']

  if (!allowed.includes(ip)) {
    reply.status(403).send({ error: 'Accès refusé' })
    return
  }
  done()
})
```

### Priorité 3 — Token sur les routes sensibles

Un token statique dans les headers pour les routes POST/PATCH/DELETE :

```typescript
// Côté client
headers: { 'x-api-key': 'mon-token-secret' }

// Côté Fastify
if (request.headers['x-api-key'] !== process.env.API_KEY) {
  reply.status(401).send({ error: 'Non autorisé' })
}
```

Les routes GET publiques (page cuisine, display) ne nécessitent pas de token. Uniquement les routes qui modifient des données.

### Priorité 4 — HTTPS en local (optionnel, plus tard)

Chiffrer le trafic local avec un certificat auto-signé pour éviter qu'un attaquant puisse lire le trafic réseau en clair. Pas prioritaire si le WiFi est bien isolé.

### Récapitulatif

| Priorité | Mesure | Impact | Complexité |
|---|---|---|---|
| 1 | WiFi séparé POS / clients | Très élevé | Faible |
| 2 | Whitelist IPs Fastify | Élevé | Faible |
| 3 | Token sur routes sensibles | Moyen | Faible |
| 4 | HTTPS local | Faible | Élevé |

---

## 11. Stack technique complète

| Composant | Technologie | Où |
|---|---|---|
| Interface caisse | Electron + React + TypeScript | PC tactile |
| Backend local | Fastify + TypeScript | PC tactile |
| Base locale | SQLite + better-sqlite3 | PC tactile |
| Impression | PrintDaemon C# | PC tactile |
| Écran cuisine | HTML/CSS/JS (page web) | Tablette |
| Écran salle | HTML/CSS/JS (page web) | Télé / écran |
| Backend cloud | Fastify + TypeScript | VPS |
| Base cloud | PostgreSQL | VPS |
| VPN | WireGuard | Routeur + VPS |
| DNS local | Pi-hole ou Adguard Home | Routeur / RPi |
| Site vitrine | HTML statique | VPS |

---

## 12. Synchronisation des données POS → VPS

### Ce qui est synchronisé et ce qui reste local

| Donnée | Local uniquement | Sync vers VPS | Raison |
|---|---|---|---|
| Commandes | ✅ SQLite | ✅ PostgreSQL | Stats, click & collect, panel admin |
| Produits (published) | ✅ SQLite | ✅ PostgreSQL | Affichage site vitrine |
| Produits (brouillon) | ✅ SQLite | ❌ | Éviter affichage non voulu sur le site |
| Catégories | ✅ SQLite | ✅ PostgreSQL | Affichage site vitrine |
| Users POS (admin, chef) | ✅ SQLite | ❌ | Inutiles côté cloud, moins de données exposées |
| Settings POS | ✅ SQLite | ❌ | Config locale uniquement |
| Comptes clients | ❌ | ✅ PostgreSQL | Click & collect, historique |
| Compte propriétaire | ❌ | ✅ PostgreSQL | Panel admin, stats globales |

### Système de publication des produits

Un champ `published` sur chaque produit contrôle la visibilité sur le site vitrine :

```
Produit
├── name: "Article test"
├── price: 5.00
└── published: false   ← reste local, jamais sync vers VPS

Produit
├── name: "Tacos bœuf"
├── price: 8.50
└── published: true    ← sync vers VPS → visible sur le site
```

Sur le POS, un simple toggle dans la gestion des produits :
```
[ Tacos bœuf      8.50€ ]  🟢 Publié sur le site
[ Article test    5.00€ ]  ⚫ Brouillon (local uniquement)
```

Avantage bonus : permet de préparer des nouveaux articles à l'avance sans les afficher immédiatement.

### Flux de sync produits

```
Admin publie un produit sur le POS (published: true)
└── SQLite local mis à jour
      └── SyncService (background, async)
            └── POST /api/products (VPS Fastify)
                  └── PostgreSQL VPS mis à jour
                        └── site vitrine lit PostgreSQL
                              └── produit apparaît sur le site
```

### Flux de sync commandes

```
Commande payée sur le POS
└── SQLite : syncStatus = "pending"
      └── SyncService (background)
            └── POST /api/orders (VPS Fastify)
                  └── succès : syncStatus = "synced"
                  └── échec réseau : retry automatique
```

### Architecture VPS — le site lit Fastify, pas PostgreSQL directement

```
POS → sync → PostgreSQL VPS
               └── Fastify VPS lit PostgreSQL
                     ├── GET /api/products?published=true  → site vitrine
                     ├── GET /api/orders                   → panel admin
                     └── POST /api/orders                  → click & collect
```

Le site vitrine consomme l'API Fastify en localhost — ultra rapide, zéro dépendance vers le restaurant. Si le POS est éteint, le site fonctionne toujours.

### Séparation des comptes

```
Comptes POS (SQLite local)          Comptes VPS (PostgreSQL)
├── admin                           ├── proprietaire (panel admin, stats)
├── chef cuisinier                  └── clients (click & collect)
└── caissier
```

Les comptes POS ne sont jamais exposés côté cloud. Le propriétaire a un compte séparé sur le VPS pour accéder au panel admin et aux statistiques en ligne.


---

## 13. Protection du logiciel & système de licence

### Le problème à résoudre

```
Sans protection
└── quelqu'un récupère l'installateur
      └── installe sur n'importe quel PC
            └── logiciel 100% fonctionnel gratuitement
```

### Principe général — licence liée au PC

Au démarrage, le logiciel vérifie une clé de licence associée à un identifiant unique du PC (machine ID). Si la clé est invalide ou expirée, le logiciel est bloqué.

```
POS démarre
└── vérifie licence (locale ou VPS selon le pack)
      ├── valide → démarre normalement
      └── invalide / expirée → écran bloqué
```

### Machine ID — lier la licence au hardware

```typescript
import { machineIdSync } from 'node-machine-id'

// Hash unique basé sur CPU + carte mère + MAC adresse
const machineId = machineIdSync()
// → "a3f8b2c1d4e5..."
```

Une licence = un PC. Copier l'installateur sur un autre PC → licence refusée car machine ID différent.

### Deux modes de vérification selon le pack

**Pack Starter (sans internet) — licence offline**

Licence = fichier signé cryptographiquement, vérifiable sans internet :

```
Fichier licence (généré par toi à l'installation)
├── machine_id  : "abc123"
├── plan        : "starter"
├── expires_at  : "2027-03-01"
└── signature   : [signé avec ta clé privée]

POS vérifie la signature localement
└── impossible à falsifier sans ta clé privée
└── zéro appel réseau nécessaire
```

Flow d'activation Starter :
```
1. Tu préconfigures le PC dans ton atelier (internet dispo chez toi)
2. Tu génères la licence signée pour ce machine_id → fichier local
3. Tu livres le PC chez le client
4. Le client n'a jamais besoin d'internet pour faire tourner le logiciel
5. Renouvellement annuel → nouveau fichier licence (hotspot téléphone suffit)
```

**Pack Pro / Business (avec internet) — licence VPS**

```typescript
// Au démarrage
const license = await verifyLicense(licenseKey, getMachineId())

if (!license.valid) {
  showLicenseExpiredScreen() // bloque l'accès
}
```

Table PostgreSQL sur le VPS :
```sql
licenses
├── key          -- "ABC-123-DEF-456"
├── restaurant   -- "Restaurant Le Doudou"
├── machine_id   -- hash unique du PC
├── plan         -- starter | pro | business
├── status       -- active | suspended | expired
└── expires_at   -- date d'expiration
```

### Grace period — ne pas bloquer un client qui a juste un souci réseau

Le POS met en cache la dernière vérification réussie (valable 7 jours). Si le VPS est injoignable, il utilise le cache. Si le cache expire ET le VPS est injoignable → avertissement mais pas de blocage immédiat.

```
Vérification VPS OK → cache local mis à jour (7 jours)
VPS injoignable     → utilise le cache
Cache expiré        → avertissement affiché, grace period 3 jours supplémentaires
Grace period expirée → écran "abonnement suspendu, contactez le support"
```

### Flow d'activation complet (Pro / Business)

```
1. Tu crées la licence dans ton panel admin VPS
   └── génère clé "ABC-123-DEF-456", plan = pro

2. Tu livres le PC préconfiguré (clé pré-renseignée dans config.json)

3. Premier démarrage chez le client
   └── POS envoie { licenseKey, machineId } au VPS
   └── VPS enregistre le machineId → licence activée
   └── logiciel démarre normalement

4. Si client ne paie plus
   └── tu passes status = "suspended" dans ton panel
   └── au prochain démarrage → écran "abonnement suspendu"
   └── grace period 7 jours avant blocage total
```

### Modularité — un seul logiciel, une config par client

Pas besoin de builds différents. Un fichier `config.json` par installation :

```typescript
{
  plan: "starter",        // starter | pro | business
  licenseKey: "ABC-123",  // clé unique par client
  cloudSync: false,       // active/désactive SyncService
  clickCollect: false,    // active/désactive long polling VPS
  kitchenScreen: false,   // active/désactive route /cuisine
  displayScreen: false,   // active/désactive route /display
  vpsUrl: null            // null si pack Starter
}
```

Un client qui upgrade Starter → Pro : changement de config + activation licence VPS.

### Récapitulatif par pack

| Pack | Internet requis | Vérification licence | Renouvellement |
|---|---|---|---|
| **Starter** | Non | Fichier signé local, 12 mois | Annuel, hotspot suffit |
| **Pro** | Oui | VPS au démarrage + cache 7j | Automatique (abonnement) |
| **Business** | Oui | VPS au démarrage + cache 7j | Automatique (abonnement) |

