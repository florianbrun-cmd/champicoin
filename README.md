# Champicoin 🍄

Application pour noter tes coins à champignons et les partager avec un groupe privé, avec carte OpenStreetMap et mode hors-ligne.

## Déploiement (gratuit, sans matériel)

### 1. Base de données — MongoDB Atlas
1. Crée un compte sur https://www.mongodb.com/cloud/atlas/register (aucune carte bancaire requise)
2. Crée un cluster gratuit **M0**
3. Onglet **Database Access** → crée un utilisateur + mot de passe
4. Onglet **Network Access** → ajoute `0.0.0.0/0` (accès depuis n'importe où, nécessaire car Render n'a pas d'IP fixe)
5. Bouton **Connect** → "Drivers" → copie la chaîne de connexion, et remplace `<password>` par ton mot de passe. Ajoute `/champicoin` avant le `?` pour nommer la base :
   ```
   mongodb+srv://utilisateur:motdepasse@cluster.mongodb.net/champicoin?retryWrites=true&w=majority
   ```

### 2. Code — GitHub
1. Crée un dépôt sur https://github.com/new (public ou privé, peu importe)
2. Pousse ce dossier dedans :
   ```
   git init
   git add .
   git commit -m "Premier envoi de Champicoin"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/champicoin.git
   git push -u origin main
   ```

### 3. Hébergement — Render
1. Compte gratuit sur https://render.com (connexion via GitHub)
2. **New +** → **Web Service** → sélectionne ton dépôt `champicoin`
3. Renseigne :
   - **Root Directory** : `backend`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Instance Type** : Free
4. Onglet **Environment** → ajoute une variable :
   - `MONGODB_URI` = ta chaîne de connexion Atlas de l'étape 1
5. Clique sur **Create Web Service**. Après quelques minutes, Render te donne une URL du type `https://champicoin.onrender.com`

### 4. Installation sur les téléphones
- Ouvrir l'URL Render dans Safari (iOS) ou Chrome (Android)
- iOS : bouton Partager → "Sur l'écran d'accueil"
- Android : menu ⋮ → "Ajouter à l'écran d'accueil" (ou bannière automatique)
- L'app s'installe comme une app native, avec icône et mode hors-ligne

### 5. Utilisation
- La première personne crée un groupe (ex : "Famille Dupont") → un code est généré (ex : `CEPE-4821`)
- Elle partage ce code aux personnes de confiance, qui rejoignent le même groupe
- ⚠️ Note : l'offre gratuite Render met le serveur en veille après 15 min d'inactivité. Le premier chargement après une pause peut prendre ~30 secondes.

## Développement en local
```
cd backend
cp .env.example .env    # puis renseigne ta chaîne MongoDB dans .env
npm install
npm start
```
Ouvre ensuite http://localhost:3000
