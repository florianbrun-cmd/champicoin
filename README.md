# Champicoin 🍄

Une application privée pour noter tes coins à champignons sur une carte, et les partager uniquement avec les personnes de ton choix.

## À quoi ça sert ?

- Tu marques sur une carte l'endroit exact où tu as trouvé un champignon
- Tu précises le type de champignon, la date, et des notes — l'altitude est récupérée automatiquement
- Ces coins sont partagés avec un **groupe privé** : seules les personnes ayant le code d'accès du groupe les voient
- L'application fonctionne **hors-ligne** (zones sans réseau en forêt) : les points sont enregistrés localement puis synchronisés dès que le réseau revient
- Installable comme une vraie application sur ton téléphone (PWA), sans passer par l'App Store / Play Store

## Premiers pas

1. Ouvre l'application dans ton navigateur (Safari sur iPhone, Chrome sur Android)
2. **Rejoindre un groupe** : si quelqu'un t'a donné un code (ex. `CEPE-4821`), indique ton prénom et ce code
3. **Créer un groupe** : donne-lui un nom ; un code est généré et à partager avec les personnes de confiance. Tu peux décocher "Rejoindre ce groupe sur cet appareil" si tu crées ce groupe pour quelqu'un d'autre sans y participer toi-même
4. Une fois dans un groupe, installe l'app sur ton écran d'accueil : bouton Partager (iOS) ou menu ⋮ (Android) → "Sur l'écran d'accueil"
5. **Code oublié ?** Sur l'écran de connexion, un lien permet de retrouver les groupes associés à ton prénom, s'il a déjà été utilisé pour en rejoindre un. ⚠️ L'application n'ayant pas de vrais comptes avec mot de passe, ce n'est pas une sécurité forte — juste un dépannage en cas d'oubli.

## La carte et ses boutons

### En haut de l'écran
| Élément | Fonction |
|---|---|
| ✏️ à côté du nom du groupe | Renommer le groupe |
| ✉️ | Contacter le développeur par email (bug, suggestion) |
| ❓ | Ouvre cette page d'aide dans un nouvel onglet |
| Pastille "en ligne / hors-ligne" | Indique ta connexion — **touche-la pour activer/désactiver le mode hors-ligne forcé** (utile à l'étranger, pour ne jamais utiliser de données mobiles) |
| Code affiché | **Touche-le pour le copier** dans le presse-papiers, prêt à partager |
| 🔄 | Forcer la synchronisation immédiate des points en attente |
| 👥 | Liste des membres du groupe et la date/heure de leur dernière connexion |
| ☰ | Liste de tous les points affichés, triable (proximité, plus récent, plus ancien) — bouton 🧹 pour supprimer les doublons (même date et mêmes coordonnées exactes) |
| ▽ | Ouvre les filtres (recherche, type de champignon, mois, département), avec un bouton **RAZ** pour tout réinitialiser |
| ⇄ | Change de groupe (déconnexion de cet appareil) |

### Sur la carte
- **🎯** (sous les boutons de zoom +/-) : recentre la carte sur ta position actuelle, au zoom maximum
- **Point bleu** : ta position en direct ; une petite flèche indique la direction de ton déplacement si le téléphone la détecte
- **Icônes de champignon** : chaque coin enregistré, avec une icône propre à chaque espèce
- **Icône avec un ⏳** : ce point n'est pas encore synchronisé avec le serveur (créé hors-ligne, en attente de réseau)
- **Halo doré** : un point régulièrement réactualisé au fil des années — repère rapide d'un coin productif
- **Pastille numérotée** : plusieurs coins trop proches à ce niveau de zoom sont regroupés (le gros chiffre = nombre de coins, le petit badge = nombre de types différents). Zoome pour les séparer ; au dernier niveau de zoom (~50 m), tous les points s'affichent toujours individuellement, même très rapprochés
- **Échelle** : en bas à gauche, indique la distance réelle représentée sur la carte
- Fond de carte **avec courbes de niveau (relief)** affiché par défaut ; bascule automatiquement vers un fond simplifié si une connexion lente est détectée

### Boutons flottants (bas à droite)
| Bouton | Fonction |
|---|---|
| 🍄+ (gros bouton) | Arme le mode "placement d'un point" : touche ensuite la carte à l'endroit exact du coin pour l'enregistrer |
| Import | Importe des points depuis un fichier GPX **ou directement depuis des photos** (la position est extraite automatiquement des métadonnées EXIF de la photo, si la localisation était activée à la prise de vue — fonctionne avec des JPEG, pas avec les photos HEIC) |
| 💾 | Télécharge une sauvegarde locale (fichier **GPX**, lisible par un GPS ou une appli de randonnée) de tous les points actuellement chargés — pratique "au cas où" |
| ⬇️ | Télécharge les tuiles de la carte actuellement affichée (standard ou topo) pour la zone visible, utilisable ensuite sans réseau |
| 🗑️ | Supprime les tuiles de carte téléchargées précédemment (libère de l'espace) |
| 🗻 | Bascule entre le fond de carte avec courbes de niveau et le fond simplifié |

## Ajouter ou modifier un coin

Le formulaire d'ajout permet de choisir le type de champignon dans une liste (classée par ordre alphabétique, avec "Autres" pour saisir un nom libre), la date, des notes. Les coordonnées GPS et l'altitude sont calculées et affichées automatiquement.

Dans la fenêtre de détail d'un point, **touche le nom du champignon** pour le modifier directement (type, date, notes — pas la position ; pour corriger un emplacement, supprime le point et recrée-le).

## Le détail d'un point

En cliquant sur un coin, tu retrouves :
- Son type (cliquable pour modifier), sa date et tes notes
- Ses coordonnées exactes et son altitude
- Un historique complet : qui l'a créé et quand, et le détail de chaque modification passée (type, date, notes, auteur)
- **Supprimer**
- **🧭 Itinéraire** : propose de s'y rendre via Google Maps, Plans (Apple) ou Waze

La fenêtre se ferme en cliquant n'importe où en dehors.

## Filtres

- **Recherche texte** : filtre par mot dans le type de champignon
- **Type** : sélection multiple des espèces à afficher
- **Mois** : n'affiche que les mois où au moins un coin existe
- **Département** : calculé automatiquement (nécessite d'être en ligne la première fois, puis mis en cache)
- **RAZ** : réinitialise tous les filtres en un clic

Dès qu'un filtre est actif, la carte se recentre pour englober tous les points correspondants.

## Mode hors-ligne

- Un point ajouté sans réseau est mis en attente localement (badge "X point(s) en attente de synchro", icône avec un ⏳ sur la carte) puis envoyé automatiquement dès que le réseau revient (ou via le bouton 🔄)
- Toucher la pastille "en ligne / hors-ligne" dans l'en-tête force le mode hors-ligne manuellement, par exemple à l'étranger pour ne jamais consommer de données
- Le bouton ⬇️ permet de précharger le fond de carte d'une zone avant de partir en forêt sans réseau
- Le bouton 💾 permet d'exporter une copie de sauvegarde (GPX) de tous tes points en local, à tout moment
