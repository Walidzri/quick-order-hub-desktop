# 🖥️ Configuration du Démarrage Automatique - Quick Order Hub (Windows)

Ce guide explique comment configurer **Windows** pour que Quick Order Hub démarre automatiquement au lancement du PC. Cette approche est recommandée pour un usage POS/caisse (PC tactile, 4 Go RAM, usage pro fast-food).

**Pourquoi configurer via Windows plutôt que dans le logiciel ?**
- Plus fiable et natif
- Fonctionne même si l'app plante ou est fermée
- Pas de dépendance à Explorer
- Idéal pour un poste dédié caisse

---

## Vue d'ensemble

| Étape | Où | Description |
|-------|-----|-------------|
| 1 | Windows | Créer un utilisateur dédié POS |
| 2 | Windows | Configurer l'auto-login (connexion automatique) |
| 3 | Windows | Ajouter le lancement auto de l'app |
| 4 | Logiciel | Plein écran + Mode kiosque (déjà fait dans l'app) |

---

## 1. Créer un utilisateur dédié POS

1. **Ouvrir les paramètres Windows**
   - `Win + I` ou Démarrer → Paramètres

2. **Aller dans Comptes → Famille et autres utilisateurs**

3. **Cliquer sur « Ajouter un autre utilisateur sur ce PC »**

4. **Créer un compte local**
   - « Je n'ai pas les informations de connexion de cette personne »
   - « Ajouter un utilisateur sans compte Microsoft »
   - Nom : `POS` (ou `Caisse`)
   - Mot de passe : laisser vide ou mettre un mot de passe simple
   - Confirmer

5. **Retirer les droits administrateur** (optionnel mais recommandé)
   - Cliquer sur le compte créé
   - « Changer le type de compte » → Utilisateur standard

---

## 2. Configurer l'auto-login (connexion automatique)

Pour que le PC se connecte automatiquement sans demander de mot de passe :

1. **Ouvrir la boîte de dialogue utilisateurs**
   - `Win + R` → taper `netplwiz` → Entrée

2. **Décocher** la case :
   - « Les utilisateurs doivent entrer un nom d'utilisateur et un mot de passe pour utiliser cet ordinateur »

3. **Cliquer sur « Appliquer »**

4. **Dans la fenêtre qui s'ouvre** :
   - Nom d'utilisateur : `POS` (ou le nom du compte créé)
   - Mot de passe : celui du compte (ou vide)
   - Confirmer le mot de passe

5. **Valider** → Redémarrer le PC pour tester

✅ Au redémarrage, Windows doit se connecter automatiquement au compte POS.

---

## 3. Lancer Quick Order Hub automatiquement au démarrage

### Option A : Dossier Démarrage (simple)

1. **Ouvrir le dossier Démarrage**
   - `Win + R` → taper `shell:startup` → Entrée

2. **Créer un raccourci vers l'application**
   - Clic droit dans le dossier → Nouveau → Raccourci
   - Parcourir vers l'exécutable Quick Order Hub, par exemple :
     - Après installation : `C:\Users\POS\AppData\Local\Programs\Quick Order Hub\Quick Order Hub.exe`
     - Ou : `C:\Program Files\Quick Order Hub\Quick Order Hub.exe`
   - Nom du raccourci : `Quick Order Hub`
   - Terminer

3. **Tester** : Redémarrer le PC et vérifier que l'app se lance

---

### Option B : Planificateur de tâches (plus robuste)

Utile si l'app doit démarrer avec un délai (ex. après le réseau, PrintDaemon, etc.) :

1. **Ouvrir le Planificateur de tâches**
   - `Win + R` → taper `taskschd.msc` → Entrée

2. **Créer une tâche** (et non une tâche de base)
   - Menu Action → Créer une tâche...

3. **Onglet Général**
   - Nom : `Quick Order Hub - Démarrage auto`
   - Description : Lance Quick Order Hub au démarrage du PC
   - Cocher : **« Exécuter que l'utilisateur soit connecté ou non »**
   - Cocher : **« Exécuter avec les privilèges les plus élevés »** (si nécessaire pour l'imprimante)
   - Configurer pour : Windows 10 ou 11

4. **Onglet Déclencheurs**
   - Nouveau...
   - Démarrage : **Au démarrage** (ou « À la connexion » si vous préférez)
   - Utilisateur : le compte POS
   - Activer : oui
   - OK

5. **Onglet Actions**
   - Nouveau...
   - Action : Démarrer un programme
   - Programme/script : chemin complet vers l'exe
     ```
     C:\Users\POS\AppData\Local\Programs\Quick Order Hub\Quick Order Hub.exe
     ```
   - (Optionnel) Ajouter des arguments : aucun
   - Démarrer dans : dossier de l'app (optionnel)
   - OK

6. **Onglet Conditions** (optionnel)
   - Décocher « Démarrer la tâche uniquement si l'ordinateur est sur secteur » (pour PC portable)
   - Cocher « Réveiller l'ordinateur pour exécuter cette tâche » si besoin

7. **Onglet Paramètres**
   - Cocher « Autoriser l'exécution de la tâche à la demande »
   - OK

8. **Valider** et redémarrer pour tester

---

## 4. Configuration dans Quick Order Hub (déjà en place)

Le logiciel est déjà configuré pour :

- **Plein écran** : s'affiche en plein écran au lancement
- **Mode kiosque** : Paramètres → Général → Mode kiosque → activer

---

## Ordre des opérations recommandé

1. Installer Quick Order Hub
2. Créer l'utilisateur POS
3. Se connecter avec le compte POS
4. Configurer l'app (produits, imprimantes, etc.)
5. Activer Mode kiosque dans Paramètres
6. Configurer l'auto-login (`netplwiz`)
7. Ajouter le raccourci au démarrage (ou la tâche planifiée)
8. Redémarrer et vérifier

---

## Résumé rapide (pour demain)

```
1. netplwiz → décocher "utilisateurs doivent entrer..." → Appliquer → compte POS
2. shell:startup → raccourci vers Quick Order Hub.exe
3. Redémarrer
4. Vérifier Mode kiosque dans Paramètres > Général
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| L'app ne démarre pas | Vérifier le chemin de l'exe (peut changer après installation) |
| Mot de passe demandé au démarrage | Vérifier que netplwiz a bien enregistré le compte |
| L'app démarre en arrière-plan | Délai possible ; vérifier la tâche planifiée |
| PrintDaemon ne répond pas | L'app attend le réseau ; ajouter un délai dans le Planificateur (ex. 30 s) |
