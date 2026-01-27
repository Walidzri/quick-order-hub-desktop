# Guide de Test du Daemon d'Impression

## Vérification du Statut du Daemon

### Méthode 1 : Via l'Interface (Recommandé)

1. Ouvrir l'application
2. Aller dans **Paramètres > Données**
3. Voir la section **"Statut du Daemon d'Impression"**
4. Le statut est vérifié automatiquement toutes les 5 secondes
5. Cliquer sur l'icône de rafraîchissement pour vérifier manuellement

**Indicateurs :**
- 🟢 **Vert (actif)** : Le daemon fonctionne correctement
- 🔴 **Rouge (inactif)** : Le daemon n'est pas accessible

### Méthode 2 : Via PowerShell/CMD

**Test rapide :**
```powershell
# Test avec curl (si disponible)
curl http://127.0.0.1:9100/health

# Ou avec Invoke-WebRequest (PowerShell)
Invoke-WebRequest -Uri http://127.0.0.1:9100/health
```

**Réponse attendue (si le daemon est actif) :**
```json
{
  "status": "ok",
  "message": "Print daemon running",
  "version": "0.1.0"
}
```

**Si le daemon n'est pas actif :**
- Erreur de connexion : `Connection refused` ou `Unable to connect`
- Timeout : La requête ne répond pas

### Méthode 3 : Via le Navigateur

1. Ouvrir un navigateur (Chrome, Edge, Firefox)
2. Aller à l'adresse : `http://127.0.0.1:9100/health`
3. Vous devriez voir le JSON de réponse si le daemon est actif
4. Erreur de connexion si le daemon n'est pas actif

### Méthode 4 : Vérifier le Processus

**Dans PowerShell :**
```powershell
# Voir les processus Node.js en cours
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Quick Order Hub*" }

# Ou voir tous les processus Node.js
Get-Process node -ErrorAction SilentlyContinue
```

**Dans le Gestionnaire des tâches :**
1. Ouvrir le Gestionnaire des tâches (Ctrl+Shift+Esc)
2. Onglet "Détails"
3. Chercher "node.exe"
4. Vérifier qu'un processus Node.js est en cours d'exécution

## Port du Daemon

Le daemon écoute par défaut sur :
- **Host** : `127.0.0.1` (localhost uniquement)
- **Port** : `9100`

**Note** : Le port peut être changé via la variable d'environnement `PRINT_DAEMON_PORT`.

## Dépannage

### Le daemon ne démarre pas

1. **Vérifier les logs Electron** :
   - Ouvrir la console (F12 si DevTools disponibles)
   - Chercher les messages `[MAIN] Starting print daemon...`
   - Vérifier les erreurs éventuelles

2. **Vérifier que le fichier existe** :
   - En production : `resources/print-daemon/server.cjs`
   - En développement : `print-daemon/server.cjs`

3. **Vérifier Node.js** :
   - Le daemon nécessite Node.js pour fonctionner
   - Vérifier que Node.js est installé : `node --version`

### Le daemon démarre mais ne répond pas

1. **Vérifier le port** :
   - Le port 9100 est-il déjà utilisé par un autre processus ?
   - Tester : `netstat -ano | findstr :9100`

2. **Vérifier le pare-feu** :
   - Le pare-feu Windows peut bloquer les connexions locales
   - Ajouter une exception pour l'application

3. **Redémarrer le daemon** :
   - Via l'interface : Cliquer sur "Redémarrer le daemon"
   - Ou redémarrer l'application complète

### Le daemon crash régulièrement

1. **Vérifier les logs** :
   - Consulter les logs dans `%APPDATA%\Quick Order Hub\logs\`
   - Chercher les erreurs liées au daemon

2. **Vérifier les permissions** :
   - L'application a-t-elle les permissions nécessaires ?
   - Tester en exécutant en tant qu'administrateur

## Commandes Utiles

### Tester l'endpoint /health

```powershell
# PowerShell
Invoke-RestMethod -Uri http://127.0.0.1:9100/health -Method Get

# CMD (avec curl installé)
curl http://127.0.0.1:9100/health
```

### Vérifier si le port est ouvert

```powershell
# PowerShell
Test-NetConnection -ComputerName 127.0.0.1 -Port 9100

# CMD
netstat -ano | findstr :9100
```

### Tuer un processus Node.js bloqué

```powershell
# Trouver le PID
Get-Process node | Where-Object { $_.Path -like "*Quick Order Hub*" }

# Tuer le processus (remplacer PID par le numéro)
Stop-Process -Id PID -Force
```

## Redémarrage du Daemon

### Via l'Interface

1. Aller dans **Paramètres > Données**
2. Section **"Statut du Daemon d'Impression"**
3. Si le daemon est inactif, cliquer sur **"Redémarrer le daemon"**

### Via Redémarrage de l'Application

Le daemon redémarre automatiquement quand vous relancez l'application.

## Logs du Daemon

En mode développement, les logs du daemon sont visibles dans la console Electron.

En production, les logs peuvent être consultés dans :
- Console Electron (si DevTools activés)
- Logs de l'application dans `%APPDATA%\Quick Order Hub\logs\`

---

**Note** : Le daemon doit être actif pour que l'impression fonctionne correctement. Si le daemon est inactif, l'impression directe TCP/IP peut ne pas fonctionner.
