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

**Sauvegarder régulièrement** :
```
Paramètres > Sauvegarde et Restauration
→ Exporter la sauvegarde
→ Choisir un emplacement (clé USB recommandée)
```

**Fréquence** : Quotidienne ou après modifications importantes

## Emplacement des Données

```
Windows: C:\Users\[USERNAME]\AppData\Roaming\Quick Order Hub\
```

**Voir l'emplacement** :
```
Paramètres > Emplacement des Données
```

## Aide et Support

- 📖 **Documentation complète** : `DOCUMENTATION_COMPLETE.md`
- 🔧 **Dépannage** : Voir section Dépannage dans la documentation
- 📞 **Support** : [Vos coordonnées]

---

**Astuce** : Gardez toujours une sauvegarde récente sur une clé USB séparée !
