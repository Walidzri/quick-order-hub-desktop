# Guide de Démarrage - PrintDaemon C#

## 🚀 Démarrage Manuel

### Mode Développement
```bash
cd PrintDaemon
dotnet run
```

### Mode Production (exécutable compilé)
```bash
cd PrintDaemon
.\bin\Release\net8.0\win-x64\publish\PrintDaemon.exe
```

Le serveur démarre et affiche :
```
╔════════════════════════════════════════════╗
║     🖨️  PrintDaemon v1.1.0                  ║
║  Listening on: http://127.0.0.1:9100       ║
```

---

## 🔧 Configuration comme Service Windows

Pour que PrintDaemon démarre automatiquement avec Windows :

### Option 1 : Utiliser NSSM (Non-Sucking Service Manager)

1. Téléchargez NSSM : https://nssm.cc/download
2. Installez le service :
   ```powershell
   nssm install PrintDaemon "E:\chemin\vers\PrintDaemon.exe"
   nssm set PrintDaemon AppDirectory "E:\chemin\vers\PrintDaemon"
   nssm start PrintDaemon
   ```

### Option 2 : Utiliser sc.exe (Windows intégré)

```powershell
sc create PrintDaemon binPath= "E:\chemin\vers\PrintDaemon.exe" start= auto
sc start PrintDaemon
```

---

## ✅ Vérification

Testez que le daemon est actif :

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9100/status" -Method GET
```

Réponse attendue :
```json
{
  "running": true,
  "version": "1.1.0",
  "message": "PrintDaemon is running (with print queue)"
}
```

---

## 📝 Notes

- Le PrintDaemon C# doit être démarré **avant** d'utiliser l'application Electron
- Il écoute uniquement sur `127.0.0.1:9100` (localhost uniquement, pour la sécurité)
- Pour la production, configurez-le comme service Windows pour qu'il démarre automatiquement
