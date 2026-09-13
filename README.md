# Champicoin 🍄

Une application privée pour noter tes coins à champignons sur une carte, et les partager uniquement avec les personnes de ton choix.

## À quoi ça sert ?

- Tu marques sur une carte l'endroit exact où tu as trouvé un champignon (par GPS ou en tapant directement sur la carte)
- Tu précises le type de champignon, la date, et des notes
- Ces coins sont partagés avec un **groupe privé** : seules les personnes ayant le code d'accès du groupe les voient
- L'application fonctionne **hors-ligne** (zones sans réseau en forêt) : les points sont enregistrés localement puis synchronisés dès que le réseau revient
- Installable comme une vraie application sur ton téléphone (PWA), sans passer par l'App Store / Play Store

## Premiers pas

1. Ouvre l'application dans ton navigateur (Safari sur iPhone, Chrome sur Android)
2. **Rejoindre un groupe** : si quelqu'un t'a donné un code (ex. `CEPE-4821`), indique ton prénom et ce code
3. **Créer un groupe** : donne-lui un nom ; un code est généré et à partager avec les personnes de confiance. Tu peux décocher "Rejoindre ce groupe sur cet appareil" si tu crées ce groupe pour quelqu'un d'autre sans y participer toi-même
4. Une fois dans un groupe, installe l'app sur ton écran d'accueil : bouton Partager (iOS) ou menu ⋮ (Android) → "Sur l'écran d'accueil"

## La carte et ses boutons

### En haut de l'écran
| Bouton | Fonction |
|---|---|
| ✏️ à côté du nom du groupe | Renommer le groupe |
| ✉️ | Contacter le développeur par email (bug, suggestion) |
| Pastille "en ligne / hors-ligne" | Indique si tu es connecté à internet |
| Code affiché | Le code à partager pour inviter quelqu'un dans ce groupe |
| 🔄 | Forcer la synchronisation immédiate des points en attente |
| ✈️ | Active le **mode hors-ligne forcé** : utile à l'étranger pour être sûr de ne jamais utiliser de données mobiles, même si le réseau est disponible |
| 👥 | Liste des membres du groupe et la date/heure de leur dernière connexion |
| ☰ | Liste de tous les points affichés, triable (proximité, date, alphabétique) |
| ▽ | Ouvre les filtres (recherche, type de champignon, mois, département) |
| ⇄ | Change de groupe (déconnexion de cet appareil) |

### Sur la carte
- **🎯** (sous les boutons de zoom +/-) : recentre la carte sur ta position actuelle
- **Point bleu** : ta position en direct ; une petite flèche indique la direction de ton déplacement si le téléphone la détecte
- **Icônes de champignon** : chaque coin enregistré, avec une icône propre à chaque espèce
- **Pastille numérotée** : plusieurs coins situés à moins de 50 m les uns des autres sont regroupés ; un clic affiche le détail de chacun avec ses coordonnées exactes
- **Échelle** : en bas à gauche, indique la distance réelle représentée sur la carte

### Boutons flottants (bas à droite)
| Bouton | Fonction |
|---|---|
| 🍄+ (gros bouton) | Enregistre un nouveau coin à ta position GPS actuelle |
| ✛ | Active le mode "placement manuel" : tape ensuite un point précis sur la carte (utile si le GPS n'est pas assez précis ou pour un coin repéré autrement). Un zoom minimum est imposé pour garantir la précision |
| 📂 GPX | Importe des points depuis un fichier GPX (export d'un GPS de randonnée, par exemple) |
| ⬇️ | Télécharge les tuiles de carte de la zone visible, pour pouvoir consulter la carte même sans réseau lors d'une sortie |
| 🗑️ | Supprime les tuiles de carte téléchargées précédemment (libère de l'espace) |

## Ajouter ou modifier un coin

Le formulaire d'ajout permet de choisir le type de champignon dans une liste (ou "Autres" pour saisir un nom libre), la date, des notes, et affiche les coordonnées GPS (format `N45°12.219 E005°56.621`) ainsi que la précision estimée.

En modification, tu ne peux pas changer sa position (seulement le type, la date et les notes) — pour corriger un emplacement, supprime le point et recrée-le.

## Le détail d'un point

En cliquant sur un coin, tu retrouves :
- Son type, sa date et tes notes
- Ses coordonnées exactes
- Un historique : qui l'a créé et quand, qui l'a modifié en dernier
- **Supprimer** / **Modifier**
- **🧭 Itinéraire** : propose de s'y rendre via Google Maps, Plans (Apple) ou Waze

## Filtres

- **Recherche texte** : filtre par mot dans le type de champignon
- **Type** : sélection multiple des espèces à afficher
- **Mois** : n'affiche que les mois où au moins un coin existe
- **Département** : calculé automatiquement (nécessite d'être en ligne la première fois, puis mis en cache)

Dès qu'un filtre est actif, la carte se recentre pour englober tous les points correspondants.

## Mode hors-ligne

- Un point ajouté sans réseau est mis en attente localement (badge "X point(s) en attente de synchro") puis envoyé automatiquement dès que le réseau revient (ou via le bouton 🔄)
- Le bouton ✈️ permet de forcer ce mode manuellement, par exemple à l'étranger pour ne jamais consommer de données
- Le bouton ⬇️ permet de précharger le fond de carte d'une zone avant de partir en forêt sans réseau

## Déploiement (gratuit, sans matériel)

L'application est composée de deux parties : un frontend (l'app elle-même) et un backend (le serveur + la base de données), hébergés gratuitement.

### 1. Base de données — MongoDB Atlas
1. Compte gratuit sur mongodb.com/cloud/atlas (aucune carte bancaire requise), cluster gratuit M0
2. Onglet **Database Access** → créer un utilisateur + mot de passe
3. Onglet **Network Access** → autoriser `0.0.0.0/0`
4. Bouton **Connect** → "Drivers" → copier la chaîne de connexion, y ajouter `/champicoin` avant le `?`

### 2. Code — GitHub
Créer un dépôt et y pousser ce dossier (via `git` en ligne de commande, GitHub Desktop, ou directement en glissant les fichiers sur github.com).

### 3. Hébergement — Render
1. Compte gratuit sur render.com (connexion via GitHub)
2. **New +** → **Web Service** → sélectionner le dépôt
3. Root Directory : `backend` — Build Command : `npm install` — Start Command : `node server.js` — Instance : Free
4. Variable d'environnement `MONGODB_URI` = la chaîne de connexion Atlas

### 4. Mise à jour
Pour toute future modification : remplacer les fichiers concernés sur GitHub (dossier `frontend` et/ou `backend`) ; Render redéploie automatiquement à chaque changement détecté.

## Développement en local
```
cd backend
cp .env.example .env    # renseigner MONGODB_URI
npm install
npm start
```
Ouvrir ensuite http://localhost:3000
