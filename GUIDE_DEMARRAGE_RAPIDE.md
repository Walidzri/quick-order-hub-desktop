# 🚀 Guide de Démarrage Rapide - Quick Order Hub Desktop

## Installation (5 minutes)

1. **Télécharger** `Quick Order Hub Setup X.X.X.exe`
2. **Double-cliquer** sur le fichier
3. **Suivre** l'assistant d'installation
4. **Lancer** l'application depuis le Bureau

## Première Connexion

**Identifiants par défaut** :
- **Admin** : `admin` / `admin123`
- **Chef** : `chef` / `chef123`
- **Caissier** : `caissier` / `caissier123`

⚠️ **Changez les mots de passe immédiatement !**

### Comment Changer les Mots de Passe

1. **Se connecter en tant qu'Admin**
2. Aller dans **Paramètres > Utilisateurs**
3. Cliquer sur **"Modifier"** (icône crayon) à côté de chaque utilisateur
4. Entrer un **nouveau mot de passe** dans "Nouveau mot de passe"
5. **Confirmer** le mot de passe dans le champ de confirmation
6. Cliquer sur **"Enregistrer"**

**Note** : Laissez le champ vide si vous ne voulez pas changer le mot de passe.

## Configuration Initiale (10 minutes)

### 1. Paramètres Généraux
```
Paramètres > Paramètres généraux
- Nom du restaurant
- Adresse
- Téléphone
- Devise (EUR)
- Langue (Français)
```

### 2. Ajouter des Produits

**Option A : Import Template** (Recommandé)
```
Paramètres > Template des Produits > Importer
→ Sélectionner un fichier JSON de template
```

**Option B : Création Manuelle**
```
Articles > Gérer les Articles
→ Créer des catégories
→ Ajouter des produits
```

### 3. Configurer les Imprimantes
```
Paramètres > Imprimantes
→ Imprimante Caissier : [IP] [Port 9100]
→ Imprimante Cuisine : [IP] [Port 9100]
→ Tester la connexion
```

## Utilisation Quotidienne

### Prise de Commande
1. Sélectionner **type** (Sur place / À emporter)
2. Cliquer sur une **catégorie** (ex: Tacos)
3. Cliquer sur un **produit**
4. Choisir **variantes** et **modificateurs**
5. **Ajouter au panier**
6. **Payer** → Tickets imprimés automatiquement

### Gestion des Commandes
```
Menu > Commandes
→ Voir les commandes
→ Filtrer par date
→ Imprimer les tickets
→ Télécharger en PDF
```

## Sauvegarde (Important !)

### Sauvegarde Automatique (Recommandé)

**Configurer la sauvegarde automatique** :
```
Paramètres > Données > Sauvegarde automatique
→ Activer la sauvegarde automatique
→ Choisir le type de planification :
  • À intervalles réguliers (ex: toutes les heures)
  • Quotidienne (ex: tous les jours à 2h du matin)
  • Hebdomadaire (ex: chaque dimanche à 2h)
  • Mensuelle (ex: le 1er de chaque mois à 2h)
→ Sélectionner le répertoire de sauvegarde
```

### Sauvegarde Manuelle

**Sauvegarder manuellement** :
```
Paramètres > Données > Sauvegarde et Restauration
→ Exporter la sauvegarde
→ Choisir un emplacement (clé USB recommandée)
```

**Fréquence recommandée** : Quotidienne ou après modifications importantes

## Emplacement des Données

```
Windows: C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\
```

**Voir l'emplacement** :
```
Paramètres > Emplacement des Données
```

## Aide et Support

- 📖 **Documentation complète** : Voir `DOCUMENTATION_COMPLETE.md` pour tous les détails
- 🔧 **Dépannage** : Voir section Dépannage dans la documentation complète
- 📊 **Logs** : En cas de problème, consultez les logs dans `%APPDATA%\Quick Order Hub\logs\`
- 📞 **Support** : [Vos coordonnées]

---

**Astuce** : Gardez toujours une sauvegarde récente sur une clé USB séparée !

> 💡 **Note** : Ce guide est un résumé rapide. Pour plus de détails, consultez la [Documentation Complète](DOCUMENTATION_COMPLETE.md).
