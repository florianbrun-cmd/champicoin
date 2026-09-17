// app.js — Champicoin

const API_BASE = '/api';

// --- Correspondance type de champignon -> icône dessinée (toujours dérivée du type,
// ainsi une mise à jour des images profite automatiquement à tous les points existants) ---
const TYPE_VERS_ICONE = {
  'Cèpe': 'cepe',
  'Chanterelle (Girolle)': 'chanterelle',
  'Chanterelle Violette': 'chanterelle_violette',
  'Hygrophore': 'hygrophore',
  'Trompette chanterelle': 'trompette_chanterelle',
  'Trompette de mort': 'trompette_mort',
  'Pied de mouton': 'pied_mouton',
  'Morille': 'morille',
  'Rosé des prés': 'rose_des_pres',
  'Petit gris': 'petit_gris',
  'Pleurote': 'pleurote',
  'Bolet': 'bolet',
  'Mousseron': 'mousseron',
  'Laccaire Améthyste': 'lactaire_amethyste'
};
function iconePourType(type) { return TYPE_VERS_ICONE[type] || 'autre'; }
function urlIcone(cle) { return `icons/champignons/${cle}.png`; }
function htmlIcone(type) { return `<img src="${urlIcone(iconePourType(type))}" alt="">`; }

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// --- Éléments du DOM ---
const ecranGroupe = document.getElementById('ecran-groupe');
const ecranCarte = document.getElementById('ecran-carte');
const nomGroupeActif = document.getElementById('nom-groupe-actif');
const statutConnexion = document.getElementById('statut-connexion');
const compteurAttente = document.getElementById('compteur-attente');

let carte;
let coucheMarqueurs;
let marqueurPosition = null;
let groupeCourant = null;
let positionTemporaire = null;
let tousLesPoints = [];
let typesFiltreActifs = new Set();
let moisFiltreActifs = new Set();
let departementsFiltreActifs = new Set();
let departementParCle = new Map(); // "lat_lng" (arrondi) -> nom du département
let modeAjoutManuel = false;
let modeAvionForce = localStorage.getItem('champicoin_mode_avion') === '1';

const btnFiltre = document.getElementById('btn-filtre');
const barreFiltre = document.getElementById('barre-filtre');
const pucesFiltre = document.getElementById('puces-filtre');
const pucesFiltreMois = document.getElementById('puces-filtre-mois');
const pucesFiltreDepartement = document.getElementById('puces-filtre-departement');
const rechercheFiltre = document.getElementById('recherche-filtre');
const btnListe = document.getElementById('btn-liste');
const panneauListe = document.getElementById('panneau-liste');
const contenuListe = document.getElementById('contenu-liste');
const triListe = document.getElementById('tri-liste');
const pileBoutonsFlottants = document.getElementById('pile-boutons-flottants');

function estEnLigne() {
  return navigator.onLine && !modeAvionForce;
}

// ==================================================
// 0. PSEUDO
// ==================================================

function getPseudo() { return localStorage.getItem('champicoin_pseudo') || ''; }
function setPseudo(pseudo) { localStorage.setItem('champicoin_pseudo', pseudo.trim()); }

const pseudoConnu = getPseudo();
if (pseudoConnu) {
  document.getElementById('pseudo-rejoindre').value = pseudoConnu;
  document.getElementById('pseudo-creer').value = pseudoConnu;
}

// ==================================================
// 1. GESTION DU GROUPE
// ==================================================

document.querySelectorAll('.onglet').forEach(bouton => {
  bouton.addEventListener('click', () => {
    document.querySelectorAll('.onglet').forEach(b => b.classList.remove('actif'));
    bouton.classList.add('actif');
    const cible = bouton.dataset.onglet;
    document.getElementById('form-rejoindre').classList.toggle('cache', cible !== 'rejoindre');
    document.getElementById('form-creer').classList.toggle('cache', cible !== 'creer');
  });
});

document.getElementById('form-rejoindre').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('code-groupe').value.trim();
  const pseudo = document.getElementById('pseudo-rejoindre').value.trim();
  const erreurEl = document.getElementById('erreur-rejoindre');
  erreurEl.textContent = '';
  try {
    const reponse = await fetch(`${API_BASE}/groups/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
    });
    const data = await reponse.json();
    if (!reponse.ok) { erreurEl.textContent = data.error || 'Erreur de connexion.'; return; }
    setPseudo(pseudo);
    entrerDansGroupe(data.group);
  } catch (err) {
    erreurEl.textContent = 'Pas de connexion internet. Réessaie une fois en ligne.';
  }
});

document.getElementById('btn-code-oublie').addEventListener('click', async () => {
  const zoneResultats = document.getElementById('resultats-code-oublie');
  const pseudoSaisi = document.getElementById('pseudo-rejoindre').value.trim() || prompt('Quel est le prénom/pseudo que tu utilises habituellement pour rejoindre tes groupes ?');
  if (!pseudoSaisi) return;

  if (!navigator.onLine) {
    alert('Une connexion internet est nécessaire pour retrouver un code.');
    return;
  }

  zoneResultats.classList.remove('cache');
  zoneResultats.innerHTML = 'Recherche en cours...';

  try {
    const reponse = await fetch(`${API_BASE}/groups/find-by-pseudo?pseudo=${encodeURIComponent(pseudoSaisi)}`);
    const data = await reponse.json();
    const groupes = data.groups || [];

    if (groupes.length === 0) {
      zoneResultats.innerHTML = `Aucun groupe trouvé pour "${pseudoSaisi}". Vérifie l'orthographe exacte utilisée au moment de rejoindre le groupe.`;
      return;
    }

    zoneResultats.innerHTML = groupes.map(g => `
      <div class="resultat-code-item"><span>${g.name}</span><span class="resultat-code-valeur">${g.code}</span></div>
    `).join('');
  } catch (err) {
    zoneResultats.innerHTML = 'Erreur réseau, réessaie plus tard.';
  }
});

document.getElementById('form-creer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('nom-groupe').value.trim();
  const pseudo = document.getElementById('pseudo-creer').value.trim();
  const rejoindreApres = document.getElementById('rejoindre-apres-creation').checked;
  const erreurEl = document.getElementById('erreur-creer');
  erreurEl.textContent = '';

  if (rejoindreApres && !pseudo) {
    erreurEl.textContent = 'Indique ton prénom/pseudo, ou décoche "Rejoindre ce groupe".';
    return;
  }

  try {
    const reponse = await fetch(`${API_BASE}/groups/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    const data = await reponse.json();
    if (!reponse.ok) { erreurEl.textContent = data.error || 'Erreur de création.'; return; }

    if (rejoindreApres) {
      setPseudo(pseudo);
      alert(`Groupe créé ! Voici le code à partager : ${data.group.code}`);
      entrerDansGroupe(data.group);
    } else {
      alert(`Groupe créé pour quelqu'un d'autre ! Voici le code à lui transmettre : ${data.group.code}\n\nTu n'as pas rejoint ce groupe sur cet appareil.`);
      document.getElementById('form-creer').reset();
    }
  } catch (err) {
    erreurEl.textContent = 'Pas de connexion internet. La création d\'un groupe nécessite d\'être en ligne.';
  }
});

function entrerDansGroupe(groupe) {
  groupeCourant = groupe;
  localStorage.setItem('champicoin_groupe', JSON.stringify(groupe));
  nomGroupeActif.textContent = groupe.name;
  document.getElementById('code-groupe-actif').textContent = groupe.code;
  ecranGroupe.classList.add('cache');
  ecranCarte.classList.remove('cache');
  initCarte();
  chargerPoints();
  synchroniserPointsEnAttente(true);
  signalerPresence();

  if (modeAvionForce) {
    appliquerAffichageModeAvion();
  }
}

document.getElementById('btn-quitter-groupe').addEventListener('click', () => {
  if (confirm('Changer de groupe ? (tes points restent enregistrés)')) {
    localStorage.removeItem('champicoin_groupe');
    groupeCourant = null;
    ecranCarte.classList.add('cache');
    ecranGroupe.classList.remove('cache');
  }
});

document.getElementById('btn-renommer-groupe').addEventListener('click', async () => {
  const nouveauNom = prompt('Nouveau nom du groupe :', groupeCourant.name);
  if (!nouveauNom || !nouveauNom.trim() || nouveauNom.trim() === groupeCourant.name) return;
  if (!estEnLigne()) { alert('Renommer un groupe nécessite une connexion internet.'); return; }
  try {
    const reponse = await fetch(`${API_BASE}/groups/rename`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: groupeCourant.code, name: nouveauNom.trim() })
    });
    const data = await reponse.json();
    if (!reponse.ok) { alert(data.error || 'Impossible de renommer le groupe.'); return; }
    groupeCourant = data.group;
    localStorage.setItem('champicoin_groupe', JSON.stringify(groupeCourant));
    nomGroupeActif.textContent = groupeCourant.name;
  } catch (err) {
    alert('Erreur réseau, réessaie plus tard.');
  }
});

// --- Mode hors-ligne forcé ("mode avion"), activé en touchant le statut "en ligne / hors-ligne" ---
function appliquerAffichageModeAvion() {
  if (modeAvionForce) {
    statutConnexion.textContent = 'hors-ligne (mode avion)';
    statutConnexion.classList.add('hors-ligne');
  } else {
    statutConnexion.textContent = navigator.onLine ? 'en ligne' : 'hors-ligne';
    statutConnexion.classList.toggle('hors-ligne', !navigator.onLine);
  }
}

statutConnexion.addEventListener('click', () => {
  modeAvionForce = !modeAvionForce;
  localStorage.setItem('champicoin_mode_avion', modeAvionForce ? '1' : '0');
  appliquerAffichageModeAvion();
  if (!modeAvionForce) synchroniserPointsEnAttente(true);
});

function afficherToast(texte) {
  const toast = document.createElement('div');
  toast.className = 'toast-copie';
  toast.textContent = texte;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

document.getElementById('btn-copier-code').addEventListener('click', async () => {
  const code = groupeCourant.code;
  try {
    await navigator.clipboard.writeText(code);
  } catch (err) {
    // Solution de repli si l'API Presse-papiers n'est pas disponible
    const champTemporaire = document.createElement('textarea');
    champTemporaire.value = code;
    document.body.appendChild(champTemporaire);
    champTemporaire.select();
    document.execCommand('copy');
    champTemporaire.remove();
  }
  afficherToast('Code copié !');
});

// --- Membres du groupe ---
async function signalerPresence() {
  if (!estEnLigne() || !groupeCourant) return;
  try {
    await fetch(`${API_BASE}/groups/presence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: groupeCourant.code, pseudo: getPseudo() || 'Anonyme' })
    });
  } catch (err) { /* pas grave si ça échoue */ }
}

function tempsRelatif(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

function dateHeureComplete(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

document.getElementById('btn-membres').addEventListener('click', async () => {
  const zone = document.getElementById('contenu-membres');
  zone.innerHTML = '<p style="color:#888;">Chargement...</p>';
  document.getElementById('modal-membres').classList.remove('cache');

  if (!estEnLigne()) {
    zone.innerHTML = '<p style="color:#888;">Connexion internet requise pour voir les membres.</p>';
    return;
  }

  try {
    const reponse = await fetch(`${API_BASE}/groups/members?code=${encodeURIComponent(groupeCourant.code)}`);
    const data = await reponse.json();
    const membres = data.members || [];
    if (membres.length === 0) {
      zone.innerHTML = '<p style="color:#888;">Personne n\'a encore été vu dans ce groupe.</p>';
      return;
    }
    zone.innerHTML = membres.map(m => `
      <div class="item-membre">
        <span class="item-membre-nom">${m.pseudo}</span>
        <span class="item-membre-vu">${dateHeureComplete(m.lastSeenAt)} (${tempsRelatif(m.lastSeenAt)})</span>
      </div>
    `).join('');
  } catch (err) {
    zone.innerHTML = '<p style="color:#888;">Erreur de chargement.</p>';
  }
});

// ==================================================
// 2. CARTE
// ==================================================

const METRES_PAR_PIXEL_CIBLE = 100 / 37.8; // échelle visée : 1 cm écran ≈ 100 m réels

function calculerZoomPourEchelle(latitude) {
  const metresParPixelEquateur = 156543.03392 * Math.cos(latitude * Math.PI / 180);
  return Math.log2(metresParPixelEquateur / METRES_PAR_PIXEL_CIBLE);
}

let coucheStandard, coucheTopo, topoActif = false;

function initCarte() {
  if (carte) return;
  carte = L.map('carte').setView([46.6, 2.2], 6);

  coucheStandard = L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; contributeurs OpenStreetMap'
  });

  coucheTopo = L.tileLayer('https://a.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    maxNativeZoom: 17,
    attribution: '&copy; contributeurs OpenStreetMap, SRTM — style © OpenTopoMap (CC-BY-SA)'
  });

  // La carte avec courbes de niveau est affichée par défaut, sauf connexion détectée comme lente
  const connexionLente = navigator.connection &&
    (navigator.connection.saveData || ['slow-2g', '2g'].includes(navigator.connection.effectiveType));

  if (connexionLente) {
    topoActif = false;
    coucheStandard.addTo(carte);
    document.getElementById('btn-courbes-niveau').classList.remove('actif');
  } else {
    topoActif = true;
    coucheTopo.addTo(carte);
    document.getElementById('btn-courbes-niveau').classList.add('actif');
  }

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(carte);

  coucheMarqueurs = L.layerGroup().addTo(carte);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => carte.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {}
    );
  }

  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', () => {
      const lente = navigator.connection.saveData || ['slow-2g', '2g'].includes(navigator.connection.effectiveType);
      if (lente && topoActif) {
        if (confirm('Connexion lente détectée. Basculer sur la carte simplifiée (sans relief), plus légère ?')) {
          document.getElementById('btn-courbes-niveau').click();
        }
      }
    });
  }

  demarrerSuiviPosition();
  ajouterControleLocalisation();

  carte.on('zoomend', () => rafraichirAffichageCarte());

  // Corrige un souci d'affichage mobile : la taille réelle du conteneur peut ne se
  // stabiliser qu'après le premier rendu (barre d'adresse qui se réduit, etc.)
  setTimeout(() => carte.invalidateSize(), 300);

  carte.on('click', (e) => {
    if (modeAjoutManuel) {
      positionTemporaire = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null, elevation: null, manuel: true };
      desactiverModeAjoutManuel();
      ouvrirModalAjout();
      recupererAltitude(e.latlng.lat, e.latlng.lng);
      return;
    }
    // Un clic sur la carte referme les panneaux ouverts (filtre, liste)
    if (!barreFiltre.classList.contains('cache')) {
      barreFiltre.classList.add('cache');
      btnFiltre.classList.remove('actif');
      setTimeout(() => carte.invalidateSize(), 0);
    }
    if (!panneauListe.classList.contains('cache')) {
      panneauListe.classList.add('cache');
      pileBoutonsFlottants.classList.remove('cache');
      mettreAJourBadgeAttente();
    }
  });
}

function construireIconePosition(cap) {
  const fleche = (cap === null || cap === undefined || isNaN(cap))
    ? ''
    : `<div class="marqueur-ma-position-fleche" style="transform: rotate(${cap}deg);"></div>`;
  return L.divIcon({
    className: 'marqueur-ma-position-conteneur',
    html: `${fleche}<div class="marqueur-ma-position-point"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function demarrerSuiviPosition() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      const icone = construireIconePosition(pos.coords.heading);
      if (!marqueurPosition) {
        marqueurPosition = L.marker(latlng, { icon: icone, zIndexOffset: 1000 }).addTo(carte);
      } else {
        marqueurPosition.setLatLng(latlng);
        marqueurPosition.setIcon(icone);
      }
    },
    (err) => console.warn('Suivi de position indisponible :', err.message),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

function ajouterControleLocalisation() {
  const ControleLocalisation = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-localiser');
      const lien = L.DomUtil.create('a', '', div);
      lien.href = '#';
      lien.title = 'Me centrer sur ma position';
      lien.innerHTML = '🎯';
      L.DomEvent.on(lien, 'click', L.DomEvent.stopPropagation);
      L.DomEvent.on(lien, 'click', L.DomEvent.preventDefault);
      L.DomEvent.on(lien, 'click', () => {
        const centrerSur = (lat, lng) => carte.setView([lat, lng], carte.getMaxZoom());
        if (marqueurPosition) {
          const p = marqueurPosition.getLatLng();
          centrerSur(p.lat, p.lng);
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => centrerSur(pos.coords.latitude, pos.coords.longitude),
            () => alert('Impossible de récupérer ta position.')
          );
        }
      });
      return div;
    }
  });
  carte.addControl(new ControleLocalisation());
}

// --- Téléchargement / suppression de la zone hors-ligne ---
function long2tile(lon, zoom) { return Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); }
function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

document.getElementById('btn-telecharger-carte').addEventListener('click', async () => {
  const bouton = document.getElementById('btn-telecharger-carte');
  const zoomActuel = carte.getZoom();
  const bounds = carte.getBounds();
  const domaineTuile = topoActif ? 'a.tile.opentopomap.org' : 'a.tile.openstreetmap.org';
  const zoomMaxCouche = topoActif ? 17 : 19;
  const niveaux = [zoomActuel, zoomActuel + 1, zoomActuel + 2].filter(z => z <= zoomMaxCouche);

  let tuiles = [];
  niveaux.forEach(z => {
    const xMin = long2tile(bounds.getWest(), z);
    const xMax = long2tile(bounds.getEast(), z);
    const yMin = lat2tile(bounds.getNorth(), z);
    const yMax = lat2tile(bounds.getSouth(), z);
    for (let x = xMin; x <= xMax; x++) for (let y = yMin; y <= yMax; y++) tuiles.push(`https://${domaineTuile}/${z}/${x}/${y}.png`);
  });

  if (tuiles.length === 0) { alert('Zoom insuffisant pour déterminer une zone à télécharger.'); return; }
  if (tuiles.length > 500 && !confirm(`Cette zone représente ${tuiles.length} tuiles à télécharger, ça peut prendre du temps et consommer des données. Continuer ?`)) return;

  bouton.classList.add('telechargement-en-cours');
  const titreInitial = bouton.title;
  const taillePaquet = 6;
  for (let i = 0; i < tuiles.length; i += taillePaquet) {
    const paquet = tuiles.slice(i, i + taillePaquet);
    await Promise.all(paquet.map(url => fetch(url, { mode: 'no-cors' }).catch(() => {})));
    bouton.title = `Téléchargement... ${Math.min(i + taillePaquet, tuiles.length)}/${tuiles.length}`;
  }
  bouton.classList.remove('telechargement-en-cours');
  bouton.title = titreInitial;
  alert(`Zone téléchargée (${tuiles.length} tuiles) : elle reste consultable hors-ligne.`);
});

document.getElementById('btn-courbes-niveau').addEventListener('click', (e) => {
  topoActif = !topoActif;
  e.currentTarget.classList.toggle('actif', topoActif);
  if (topoActif) {
    carte.removeLayer(coucheStandard);
    coucheTopo.addTo(carte);
  } else {
    carte.removeLayer(coucheTopo);
    coucheStandard.addTo(carte);
  }
});

function echapperXml(texte) {
  return String(texte || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('btn-sauvegarde').addEventListener('click', () => {
  if (tousLesPoints.length === 0) {
    alert('Aucun point chargé à sauvegarder. Vérifie que tu es bien en ligne, puis réessaie.');
    return;
  }

  const waypoints = tousLesPoints.map(({ point }) => {
    const nom = echapperXml(point.mushroomType);
    const notesEchappees = echapperXml(point.notes || '');
    const dateIso = point.dateFound ? `${point.dateFound}T00:00:00Z` : '';
    const eleTag = (point.elevation !== null && point.elevation !== undefined) ? `<ele>${point.elevation}</ele>` : '';
    return `  <wpt lat="${point.lat}" lon="${point.lng}">
    ${eleTag}
    <time>${dateIso}</time>
    <name>${nom}</name>
    <desc>${notesEchappees}</desc>
  </wpt>`;
  }).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Champicoin" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  const dateFichier = new Date().toISOString().slice(0, 10);
  lien.href = url;
  lien.download = `champicoin-sauvegarde-${groupeCourant.code}-${dateFichier}.gpx`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-supprimer-cache-carte').addEventListener('click', () => {
  if (!confirm('Supprimer toutes les tuiles de carte téléchargées pour un usage hors-ligne ?')) return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('vider-cache-tuiles');
    alert('Cache de la carte vidé.');
  } else {
    alert('Le service worker n\'est pas encore actif. Recharge la page puis réessaie.');
  }
});

// ==================================================
// 3. AJOUT D'UN POINT (géolocalisation, manuel, GPX)
// ==================================================

const btnLocaliser = document.getElementById('btn-localiser');
const bandeauPlacementManuel = document.getElementById('bandeau-placement-manuel');

btnLocaliser.addEventListener('click', () => {
  modeAjoutManuel = !modeAjoutManuel;
  btnLocaliser.classList.toggle('actif', modeAjoutManuel);
  bandeauPlacementManuel.classList.toggle('cache', !modeAjoutManuel);
  document.getElementById('carte').classList.toggle('mode-placement-actif', modeAjoutManuel);
});

async function recupererAltitude(lat, lng) {
  try {
    const reponse = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const data = await reponse.json();
    const altitude = data?.elevation?.[0];
    if (altitude === undefined) return;
    if (positionTemporaire && positionTemporaire.lat === lat && positionTemporaire.lng === lng) {
      positionTemporaire.elevation = altitude;
      const zoneCoord = document.getElementById('coordonnees-ajout');
      if (zoneCoord && !document.getElementById('modal-ajout').classList.contains('cache')) {
        zoneCoord.textContent = texteCoordonnees(positionTemporaire);
      }
    }
  } catch (err) {
    // Service d'altitude indisponible : ce n'est pas bloquant, on continue sans.
  }
}

function desactiverModeAjoutManuel() {
  modeAjoutManuel = false;
  btnLocaliser.classList.remove('actif');
  bandeauPlacementManuel.classList.add('cache');
  document.getElementById('carte').classList.remove('mode-placement-actif');
}

document.getElementById('btn-importer-gpx').addEventListener('click', () => {
  document.getElementById('fichier-gpx').click();
});

function lireExif(fichier) {
  return new Promise((resolve) => {
    try {
      EXIF.getData(fichier, function () { resolve(this); });
    } catch (err) {
      resolve(null);
    }
  });
}

function dmsVersDecimal(dms, ref) {
  if (!dms || dms.length < 3) return null;
  let val = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (ref === 'S' || ref === 'W') val = -val;
  return val;
}

async function importerPhoto(fichier) {
  const donnees = await lireExif(fichier);
  if (!donnees) return null;
  const lat = dmsVersDecimal(EXIF.getTag(donnees, 'GPSLatitude'), EXIF.getTag(donnees, 'GPSLatitudeRef'));
  const lng = dmsVersDecimal(EXIF.getTag(donnees, 'GPSLongitude'), EXIF.getTag(donnees, 'GPSLongitudeRef'));
  if (lat === null || lng === null) return null;

  const altitudeExif = EXIF.getTag(donnees, 'GPSAltitude');
  const dateExif = EXIF.getTag(donnees, 'DateTimeOriginal'); // format "AAAA:MM:JJ HH:MM:SS"
  const dateFound = dateExif ? dateExif.slice(0, 10).replace(/:/g, '-') : new Date().toISOString().slice(0, 10);

  return {
    lat, lng, accuracy: null,
    elevation: (altitudeExif !== undefined && altitudeExif !== null) ? altitudeExif : null,
    mushroomType: 'Autres',
    dateFound,
    notes: `Importé depuis une photo (${fichier.name})`,
    createdBy: getPseudo(),
    clientId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  };
}

function importerGpx(texte) {
  const xml = new DOMParser().parseFromString(texte, 'application/xml');
  const waypoints = Array.from(xml.querySelectorAll('wpt'));
  return waypoints.map(wpt => {
    const lat = parseFloat(wpt.getAttribute('lat'));
    const lng = parseFloat(wpt.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lng)) return null;
    const nomBalise = wpt.querySelector('name')?.textContent?.trim();
    const dateBalise = wpt.querySelector('time')?.textContent?.trim();
    const eleBalise = wpt.querySelector('ele')?.textContent?.trim();
    return {
      lat, lng, accuracy: null,
      elevation: eleBalise ? parseFloat(eleBalise) : null,
      mushroomType: nomBalise || 'Autres',
      dateFound: dateBalise ? dateBalise.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: 'Importé depuis un fichier GPX',
      createdBy: getPseudo(),
      clientId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    };
  }).filter(Boolean);
}

document.getElementById('fichier-gpx').addEventListener('change', async (e) => {
  const fichiers = Array.from(e.target.files || []);
  if (fichiers.length === 0) return;

  try {
    let aImporter = [];
    let photosSansGps = 0;

    for (const fichier of fichiers) {
      if (fichier.name.toLowerCase().endsWith('.gpx')) {
        aImporter.push(...importerGpx(await fichier.text()));
      } else if (fichier.type === 'image/jpeg' || /\.jpe?g$/i.test(fichier.name)) {
        const point = await importerPhoto(fichier);
        if (point) aImporter.push(point);
        else photosSansGps++;
      }
    }

    if (aImporter.length === 0) {
      alert(photosSansGps > 0
        ? 'Aucune coordonnée GPS trouvée dans ces photos. Vérifie que la localisation était activée lors de la prise de vue (et que ce ne sont pas des photos HEIC, non prises en charge).'
        : 'Aucun point exploitable trouvé dans ces fichiers.');
      return;
    }

    let message = `Importer ${aImporter.length} point(s) ?`;
    if (photosSansGps > 0) message += ` (${photosSansGps} photo(s) sans position GPS ignorée(s))`;
    if (!confirm(message)) return;

    for (const nouveauPoint of aImporter) {
      tousLesPoints.push({ point: nouveauPoint, enAttente: true });
      await enregistrerPoint(nouveauPoint);
    }
    construireBarreFiltre();
    rafraichirAffichageCarte();
    afficherToast('Import terminé !');
  } catch (err) {
    alert('Erreur lors de la lecture des fichiers.');
  } finally {
    e.target.value = '';
  }
});

// --- Formulaire (ajout / modification) ---


document.getElementById('type-champignon').addEventListener('change', (e) => {
  const champAutre = document.getElementById('type-champignon-autre');
  if (e.target.value === 'autre') {
    champAutre.classList.remove('cache');
    champAutre.focus();
  } else {
    champAutre.classList.add('cache');
    champAutre.value = '';
  }
  document.getElementById('apercu-icone-type').src = urlIcone(iconePourType(e.target.value === 'autre' ? '' : e.target.value));
});

function selectionnerTypeChampignon(type) {
  const selecteur = document.getElementById('type-champignon');
  const champAutre = document.getElementById('type-champignon-autre');
  const optionExiste = Array.from(selecteur.options).some(o => o.value === type);
  if (optionExiste) {
    selecteur.value = type;
    champAutre.classList.add('cache');
    champAutre.value = '';
  } else {
    selecteur.value = 'autre';
    champAutre.classList.remove('cache');
    champAutre.value = type;
  }
  document.getElementById('apercu-icone-type').src = urlIcone(iconePourType(type));
}

// --- Format des coordonnées : N/S DD°MM.MMM  E/W DDD°MM.MMM ---
function formaterCoordDMM(lat, lng) {
  function conv(valeur, chiffresDegres, positif, negatif) {
    const hemisphere = valeur >= 0 ? positif : negatif;
    const abs = Math.abs(valeur);
    const degres = Math.floor(abs);
    const minutes = (abs - degres) * 60;
    return `${hemisphere}${String(degres).padStart(chiffresDegres, '0')}°${minutes.toFixed(3).padStart(6, '0')}`;
  }
  return `${conv(lat, 2, 'N', 'S')} ${conv(lng, 3, 'E', 'W')}`;
}

function texteCoordonnees(point) {
  if (!point) return '';
  const coord = formaterCoordDMM(point.lat, point.lng);
  let texte = `📍 ${coord}`;
  if (point.accuracy !== null && point.accuracy !== undefined) {
    texte += ` — précision ≈ ${Math.round(point.accuracy)} m`;
  }
  if (point.elevation !== null && point.elevation !== undefined) {
    texte += ` — altitude ≈ ${Math.round(point.elevation)} m`;
  }
  return texte;
}

function ouvrirModalAjout() {
  document.getElementById('titre-modal-ajout').textContent = 'Nouveau coin 🍄';
  document.getElementById('id-champignon-edite').value = '';
  document.getElementById('date-trouvee').value = new Date().toISOString().slice(0, 10);
  document.getElementById('type-champignon').value = '';
  document.getElementById('type-champignon-autre').classList.add('cache');
  document.getElementById('type-champignon-autre').value = '';
  document.getElementById('notes-champignon').value = '';
  document.getElementById('coordonnees-ajout').textContent = texteCoordonnees(positionTemporaire);
  document.getElementById('apercu-icone-type').src = urlIcone('autre');
  document.getElementById('modal-ajout').classList.remove('cache');
}

function ouvrirModalModification(point) {
  document.getElementById('titre-modal-ajout').textContent = 'Modifier le coin 🍄';
  document.getElementById('id-champignon-edite').value = point._id || '';
  selectionnerTypeChampignon(point.mushroomType);
  document.getElementById('date-trouvee').value = point.dateFound;
  document.getElementById('notes-champignon').value = point.notes || '';
  document.getElementById('coordonnees-ajout').textContent = texteCoordonnees(point);
  document.getElementById('modal-detail').classList.add('cache');
  document.getElementById('modal-ajout').classList.remove('cache');
}

document.getElementById('btn-annuler-ajout').addEventListener('click', () => {
  document.getElementById('modal-ajout').classList.add('cache');
  document.getElementById('form-champignon').reset();
  positionTemporaire = null;
});

document.getElementById('form-champignon').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idEdite = document.getElementById('id-champignon-edite').value;
  const selecteurType = document.getElementById('type-champignon').value;
  const typeFinal = selecteurType === 'autre'
    ? document.getElementById('type-champignon-autre').value.trim()
    : selecteurType;

  if (!typeFinal) { alert('Merci de préciser un type de champignon.'); return; }

  const donneesFormulaire = {
    mushroomType: typeFinal,
    dateFound: document.getElementById('date-trouvee').value,
    notes: document.getElementById('notes-champignon').value.trim()
  };

  document.getElementById('modal-ajout').classList.add('cache');
  document.getElementById('form-champignon').reset();

  if (idEdite) {
    await modifierPoint(idEdite, donneesFormulaire);
  } else {
    const nouveauPoint = {
      lat: positionTemporaire.lat, lng: positionTemporaire.lng, accuracy: positionTemporaire.accuracy,
      elevation: positionTemporaire.elevation ?? null,
      ...donneesFormulaire, createdBy: getPseudo(),
      clientId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    };
    tousLesPoints.push({ point: nouveauPoint, enAttente: true });
    construireBarreFiltre();
    rafraichirAffichageCarte();
    await enregistrerPoint(nouveauPoint);
  }
  positionTemporaire = null;
});

async function modifierPoint(id, donnees) {
  if (!estEnLigne()) { alert('La modification nécessite une connexion internet (et le mode avion doit être désactivé).'); return; }
  try {
    const reponse = await fetch(`${API_BASE}/spots/${id}?groupCode=${encodeURIComponent(groupeCourant.code)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...donnees, groupCode: groupeCourant.code, author: getPseudo() })
    });
    if (!reponse.ok) throw new Error('Échec de la modification');
    chargerPoints();
  } catch (err) {
    alert('Impossible de modifier ce point pour le moment. Réessaie plus tard.');
  }
}

// ==================================================
// 4. SYNCHRONISATION
// ==================================================

async function enregistrerPoint(point) {
  if (!estEnLigne()) { ajouterAFileDAttente(point); return; }
  try {
    const reponse = await fetch(`${API_BASE}/spots`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...point, groupCode: groupeCourant.code, author: getPseudo() })
    });
    if (!reponse.ok) throw new Error('Échec serveur');
  } catch (err) {
    ajouterAFileDAttente(point);
  }
}

function ajouterAFileDAttente(point) {
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  file.push(point);
  localStorage.setItem('champicoin_file_attente', JSON.stringify(file));
  mettreAJourBadgeAttente();
}

let synchronisationEnCours = false;

async function synchroniserPointsEnAttente(silencieux) {
  if (!groupeCourant) return;
  if (synchronisationEnCours) return; // une synchro est déjà en cours : on évite un envoi en double
  if (!estEnLigne()) {
    if (!silencieux) alert(modeAvionForce ? 'Désactive le mode avion pour synchroniser.' : 'Toujours hors-ligne : impossible de synchroniser pour le moment.');
    return;
  }

  synchronisationEnCours = true;
  try {
    const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');

    if (file.length > 0) {
      const restants = [];
      for (const point of file) {
        try {
          const reponse = await fetch(`${API_BASE}/spots`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...point, groupCode: groupeCourant.code, author: point.createdBy || getPseudo() })
          });
          if (!reponse.ok) restants.push(point);
        } catch (err) {
          restants.push(point);
        }
      }
      localStorage.setItem('champicoin_file_attente', JSON.stringify(restants));
      mettreAJourBadgeAttente();
    } else if (!silencieux) {
      afficherToast('Tout est déjà à jour.');
    }

    // Rafraîchissement systématique de la carte, qu'il y ait eu quelque chose à
    // synchroniser ou non : garantit qu'un point déjà synchronisé plus tôt ne
    // reste jamais affiché avec un sablier obsolète.
    await chargerPoints();
    rafraichirAffichageCarte();
  } finally {
    synchronisationEnCours = false;
  }
}

document.getElementById('btn-synchro-entete').addEventListener('click', () => synchroniserPointsEnAttente(false));

document.getElementById('btn-nettoyer-doublons').addEventListener('click', async () => {
  if (!estEnLigne()) { alert('Une connexion internet est nécessaire pour nettoyer les doublons.'); return; }

  const DISTANCE_DOUBLON_M = 5;

  // On ne compare qu'entre points de même type et même date (comme dans la fenêtre de zone),
  // puis on regroupe ceux à moins de 5 m les uns des autres : de vrais doublons ont rarement
  // des coordonnées identiques au bit près (positions tapées séparément), mais sont très proches.
  const parTypeEtDate = {};
  tousLesPoints.forEach(({ point }) => {
    if (!point._id) return; // on ignore les points pas encore synchronisés
    const cle = `${point.mushroomType}|${point.dateFound}`;
    if (!parTypeEtDate[cle]) parTypeEtDate[cle] = [];
    parTypeEtDate[cle].push(point);
  });

  const idsASupprimer = [];
  Object.values(parTypeEtDate).forEach(points => {
    if (points.length <= 1) return;

    // Regroupement par proximité (< 5 m), même logique qu'un union-find simple
    const n = points.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (distanceMetres(points[i].lat, points[i].lng, points[j].lat, points[j].lng) < DISTANCE_DOUBLON_M) union(i, j);
      }
    }
    const groupes = {};
    for (let i = 0; i < n; i++) { const r = find(i); (groupes[r] = groupes[r] || []).push(points[i]); }

    Object.values(groupes).forEach(groupe => {
      if (groupe.length <= 1) return;
      const tries = groupe.slice().sort((a, b) => String(a._id).localeCompare(String(b._id)));
      for (let i = 1; i < tries.length; i++) idsASupprimer.push(String(tries[i]._id));
    });
  });

  const idsUniques = [...new Set(idsASupprimer)];

  if (idsUniques.length === 0) {
    afficherToast('Aucun doublon trouvé.');
    return;
  }

  if (!confirm(`${idsUniques.length} point(s) en double détecté(s) (même type, même date, à moins de ${DISTANCE_DOUBLON_M} m). Un exemplaire de chaque sera conservé. Continuer ?`)) return;

  const bouton = document.getElementById('btn-nettoyer-doublons');
  const titreInitial = bouton.title;
  const taillePaquet = 10;
  for (let i = 0; i < idsUniques.length; i += taillePaquet) {
    const paquet = idsUniques.slice(i, i + taillePaquet);
    await Promise.all(paquet.map(id =>
      fetch(`${API_BASE}/spots/${id}?groupCode=${encodeURIComponent(groupeCourant.code)}`, { method: 'DELETE' }).catch(() => {})
    ));
    bouton.title = `Suppression... ${Math.min(i + taillePaquet, idsUniques.length)}/${idsUniques.length}`;
  }
  bouton.title = titreInitial;

  afficherToast(`${idsUniques.length} doublon(s) supprimé(s).`);
  chargerPoints();
});

function mettreAJourBadgeAttente() {
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length > 0) {
    compteurAttente.textContent = `${file.length} point(s) en attente de synchro`;
    if (panneauListe.classList.contains('cache')) compteurAttente.classList.remove('cache');
  } else {
    compteurAttente.classList.add('cache');
  }
}

window.addEventListener('online', () => {
  if (modeAvionForce) return;
  statutConnexion.textContent = 'en ligne';
  statutConnexion.classList.remove('hors-ligne');
  synchroniserPointsEnAttente(true);
});
window.addEventListener('offline', () => {
  statutConnexion.textContent = 'hors-ligne';
  statutConnexion.classList.add('hors-ligne');
});

// ==================================================
// 5. AFFICHAGE, FILTRES & LISTE TRIABLE
// ==================================================

async function chargerPoints() {
  tousLesPoints = [];
  if (estEnLigne()) {
    try {
      const reponse = await fetch(`${API_BASE}/spots?groupCode=${encodeURIComponent(groupeCourant.code)}`);
      const data = await reponse.json();
      const idsVus = new Set();
      (data.spots || []).forEach(spot => {
        if (spot._id) {
          if (idsVus.has(spot._id)) return; // sécurité : jamais deux fois le même point affiché
          idsVus.add(spot._id);
        }
        tousLesPoints.push({ point: spot, enAttente: false });
      });
    } catch (err) {
      console.warn('Impossible de charger les points depuis le serveur.');
    }
  }
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  file.forEach(point => tousLesPoints.push({ point, enAttente: true }));

  construireBarreFiltre();
  rafraichirAffichageCarte();
  rattraperAltitudesManquantes();
}

// Complète en tâche de fond l'altitude des points créés avant l'ajout de cette fonctionnalité.
// Un seul appel groupé au service d'altitude (jusqu'à 90 coordonnées à la fois), puis on
// enregistre chaque résultat côté serveur sans créer d'entrée d'historique.
let rattrapageAltitudeEnCours = false;
async function rattraperAltitudesManquantes() {
  if (rattrapageAltitudeEnCours || !estEnLigne()) return;
  const aCompleter = tousLesPoints
    .map(e => e.point)
    .filter(p => p._id && (p.elevation === null || p.elevation === undefined));
  if (aCompleter.length === 0) return;

  rattrapageAltitudeEnCours = true;
  try {
    const lot = aCompleter.slice(0, 90); // limite raisonnable par appel
    const lats = lot.map(p => p.lat).join(',');
    const lngs = lot.map(p => p.lng).join(',');
    const reponse = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
    const data = await reponse.json();
    const elevations = data?.elevation || [];

    for (let i = 0; i < lot.length; i++) {
      const altitude = elevations[i];
      if (altitude === undefined) continue;
      try {
        await fetch(`${API_BASE}/spots/${lot[i]._id}/elevation`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupCode: groupeCourant.code, elevation: altitude })
        });
        lot[i].elevation = altitude; // mise à jour locale immédiate, sans recharger toute la carte
      } catch (err) { /* on continue avec les suivants */ }
    }
  } catch (err) {
    // Service d'altitude indisponible pour le moment : on réessaiera au prochain chargement.
  } finally {
    rattrapageAltitudeEnCours = false;
  }
}

function calculerPointsFiltres() {
  const recherche = rechercheFiltre.value.trim().toLowerCase();
  return tousLesPoints.filter(({ point }) => {
    if (typesFiltreActifs.size > 0 && !typesFiltreActifs.has(point.mushroomType)) return false;
    if (recherche && !point.mushroomType.toLowerCase().includes(recherche)) return false;
    if (moisFiltreActifs.size > 0) {
      const moisPoint = new Date(point.dateFound).getMonth();
      if (!moisFiltreActifs.has(moisPoint)) return false;
    }
    if (departementsFiltreActifs.size > 0) {
      const dept = departementDe(point);
      if (!dept || !departementsFiltreActifs.has(dept)) return false;
    }
    return true;
  });
}

function filtresActifs() {
  return typesFiltreActifs.size > 0 || moisFiltreActifs.size > 0 || departementsFiltreActifs.size > 0 ||
    rechercheFiltre.value.trim() !== '';
}

document.getElementById('btn-raz-filtres').addEventListener('click', () => {
  typesFiltreActifs.clear();
  moisFiltreActifs.clear();
  departementsFiltreActifs.clear();
  rechercheFiltre.value = '';
  construireBarreFiltre();
  rafraichirAffichageCarte();
});

function ajusterVueAuxPointsFiltres() {
  const pointsFiltres = calculerPointsFiltres();
  if (filtresActifs() && pointsFiltres.length > 0) {
    carte.invalidateSize();
    const bounds = L.latLngBounds(pointsFiltres.map(({ point }) => [point.lat, point.lng]));
    carte.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }
}

// --- Regroupement en "zones" à faible/moyen zoom : coins trop proches à l'écran ---
const RAYON_CLUSTER_PIXELS = 40; // distance à l'écran, indépendante du zoom : fusion sous ce seuil
const ZOOM_SANS_REGROUPEMENT = 18; // dès une échelle d'environ 50 m, plus aucune fusion : tout s'affiche

function calculerZones(pointsAvecMeta) {
  const n = pointsAvecMeta.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

  const pointsEcran = pointsAvecMeta.map(({ point }) => carte.latLngToContainerPoint([point.lat, point.lng]));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pointsEcran[i].x - pointsEcran[j].x;
      const dy = pointsEcran[i].y - pointsEcran[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < RAYON_CLUSTER_PIXELS) union(i, j);
    }
  }
  const groupes = {};
  for (let i = 0; i < n; i++) {
    const r = find(i);
    (groupes[r] = groupes[r] || []).push(pointsAvecMeta[i]);
  }
  return Object.values(groupes);
}

function rafraichirAffichageCarte() {
  coucheMarqueurs.clearLayers();
  const pointsFiltres = calculerPointsFiltres();

  if (carte.getZoom() >= ZOOM_SANS_REGROUPEMENT) {
    // Dernier niveau de zoom : on affiche chaque point individuellement, même très proches
    pointsFiltres.forEach(({ point, enAttente }) => ajouterMarqueur(point, enAttente));
  } else {
    calculerZones(pointsFiltres).forEach(zone => {
      if (zone.length === 1) {
        ajouterMarqueur(zone[0].point, zone[0].enAttente);
      } else {
        ajouterMarqueurZone(zone);
      }
    });
  }

  if (!panneauListe.classList.contains('cache')) construireListe();
}

function ajouterMarqueur(point, enAttente) {
  const badgeAttente = enAttente ? `<span class="badge-en-attente">⏳</span>` : '';
  const nbVisites = 1 + (point.history ? point.history.length : 0);
  const productif = nbVisites >= 3 ? ' marqueur-productif' : '';
  const icone = L.divIcon({
    className: 'marqueur-champi-ancre',
    html: `<div class="marqueur-champi${enAttente ? ' point-en-attente' : ''}${productif}">${htmlIcone(point.mushroomType)}${badgeAttente}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const marqueur = L.marker([point.lat, point.lng], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => {
    if (modeAjoutManuel) {
      positionTemporaire = { lat: point.lat, lng: point.lng, accuracy: null, manuel: true, elevation: point.elevation };
      desactiverModeAjoutManuel();
      ouvrirModalAjout();
      return;
    }
    afficherDetailPoint(point);
  });
}

function ajouterMarqueurZone(zone) {
  const latMoy = zone.reduce((s, z) => s + z.point.lat, 0) / zone.length;
  const lngMoy = zone.reduce((s, z) => s + z.point.lng, 0) / zone.length;

  const nbTypes = new Set(zone.map(z => z.point.mushroomType)).size;
  let niveau = '';
  let taille = 34;
  if (zone.length >= 10) { niveau = ' niveau-3'; taille = 42; }
  else if (zone.length >= 5) { niveau = ' niveau-2'; taille = 38; }

  const badgeTypes = nbTypes > 1 ? `<span class="badge-nb-types">${nbTypes}</span>` : '';

  const icone = L.divIcon({
    className: 'marqueur-zone-wrapper',
    html: `<div class="marqueur-zone${niveau}">${zone.length}${badgeTypes}</div>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2]
  });
  const marqueur = L.marker([latMoy, lngMoy], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => afficherZone(zone));
}

function afficherZone(zone) {
  derniereZoneAffichee = zone;
  // Regroupe les coins du même type au sein de la zone, mais liste chaque coordonnée
  // individuellement : le marqueur de zone est une MOYENNE des positions, pas la position
  // réelle d'un point précis — la liste ci-dessous permet de vérifier chaque coordonnée exacte.
  const parType = {};
  zone.forEach(z => { (parType[z.point.mushroomType] = parType[z.point.mushroomType] || []).push(z); });
  const groupesTries = Object.values(parType);

  const contenu = document.getElementById('contenu-zone');
  contenu.innerHTML = Object.entries(parType).map(([type, entrees], idxGroupe) => {
    const suffixe = entrees.length > 1 ? ` (×${entrees.length})` : '';
    const entreesTriees = [...entrees].sort((a, b) => new Date(b.point.dateFound) - new Date(a.point.dateFound));
    const lignes = entreesTriees.map((e) => {
      const sousIndex = entrees.indexOf(e);
      return `
        <div class="item-zone-sous" data-groupe="${idxGroupe}" data-sous="${sousIndex}">
          <span>${formaterDate(e.point.dateFound)}</span>
          <span class="item-zone-sous-coord">${formaterCoordDMM(e.point.lat, e.point.lng)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="groupe-zone">
        <div class="item-zone">
          ${htmlIcone(type)}
          <div class="item-liste-texte"><div class="item-liste-type">${type}${suffixe}</div></div>
        </div>
        <div class="liste-coords-zone">${lignes}</div>
      </div>
    `;
  }).join('');

  contenu.querySelectorAll('.item-zone-sous').forEach(el => {
    el.addEventListener('click', () => {
      const entrees = groupesTries[parseInt(el.dataset.groupe, 10)];
      const point = entrees[parseInt(el.dataset.sous, 10)].point;
      document.getElementById('modal-zone').classList.add('cache');
      afficherDetailPoint(point, true);
    });
  });
  document.getElementById('modal-zone').classList.remove('cache');
}

// --- Filtres : type, mois, département ---

function construireBarreFiltre() {
  construireFiltreTypes();
  construireFiltreMois();
  construireFiltreDepartements();
}

function construireFiltreTypes() {
  const typesUniques = [...new Set(tousLesPoints.map(({ point }) => point.mushroomType))].sort();
  pucesFiltre.innerHTML = '';
  if (typesUniques.length === 0) return;
  typesFiltreActifs.forEach(t => { if (!typesUniques.includes(t)) typesFiltreActifs.delete(t); });

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (typesFiltreActifs.size === 0 ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => { typesFiltreActifs.clear(); construireFiltreTypes(); rafraichirAffichageCarte(); ajusterVueAuxPointsFiltres(); });
  pucesFiltre.appendChild(puceTout);

  typesUniques.forEach(type => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (typesFiltreActifs.has(type) ? ' actif' : '');
    puce.textContent = type;
    puce.addEventListener('click', () => {
      if (typesFiltreActifs.has(type)) typesFiltreActifs.delete(type); else typesFiltreActifs.add(type);
      construireFiltreTypes();
      rafraichirAffichageCarte();
      ajusterVueAuxPointsFiltres();
    });
    pucesFiltre.appendChild(puce);
  });
}

function construireFiltreMois() {
  const moisPresents = [...new Set(tousLesPoints.map(({ point }) => new Date(point.dateFound).getMonth()))].sort((a, b) => a - b);
  pucesFiltreMois.innerHTML = '';
  if (moisPresents.length === 0) return;
  moisFiltreActifs.forEach(m => { if (!moisPresents.includes(m)) moisFiltreActifs.delete(m); });

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (moisFiltreActifs.size === 0 ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => { moisFiltreActifs.clear(); construireFiltreMois(); rafraichirAffichageCarte(); ajusterVueAuxPointsFiltres(); });
  pucesFiltreMois.appendChild(puceTout);

  moisPresents.forEach(m => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (moisFiltreActifs.has(m) ? ' actif' : '');
    puce.textContent = MOIS_FR[m];
    puce.addEventListener('click', () => {
      if (moisFiltreActifs.has(m)) moisFiltreActifs.delete(m); else moisFiltreActifs.add(m);
      construireFiltreMois();
      rafraichirAffichageCarte();
      ajusterVueAuxPointsFiltres();
    });
    pucesFiltreMois.appendChild(puce);
  });
}

function departementDe(point) {
  const cle = `${point.lat.toFixed(2)}_${point.lng.toFixed(2)}`;
  return departementParCle.get(cle) || null;
}

async function obtenirDepartement(lat, lng) {
  const cleLocale = `champicoin_dept_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const enCache = localStorage.getItem(cleLocale);
  if (enCache) return enCache;
  try {
    const reponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=8&addressdetails=1`);
    const data = await reponse.json();
    const dept = (data.address && (data.address.county || data.address.state_district || data.address.state)) || 'Inconnu';
    localStorage.setItem(cleLocale, dept);
    return dept;
  } catch (err) {
    return 'Inconnu';
  }
}

function construireFiltreDepartements() {
  if (departementParCle.size === 0) {
    pucesFiltreDepartement.innerHTML = '<button class="puce-filtre actif" id="puce-departement-charger">Charger les départements…</button>';
    document.getElementById('puce-departement-charger').addEventListener('click', chargerTousLesDepartements);
    return;
  }

  const deptsPresents = [...new Set(tousLesPoints.map(({ point }) => departementDe(point)).filter(Boolean))].sort();
  pucesFiltreDepartement.innerHTML = '';
  departementsFiltreActifs.forEach(d => { if (!deptsPresents.includes(d)) departementsFiltreActifs.delete(d); });

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (departementsFiltreActifs.size === 0 ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => { departementsFiltreActifs.clear(); construireFiltreDepartements(); rafraichirAffichageCarte(); ajusterVueAuxPointsFiltres(); });
  pucesFiltreDepartement.appendChild(puceTout);

  deptsPresents.forEach(dept => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (departementsFiltreActifs.has(dept) ? ' actif' : '');
    puce.textContent = dept;
    puce.addEventListener('click', () => {
      if (departementsFiltreActifs.has(dept)) departementsFiltreActifs.delete(dept); else departementsFiltreActifs.add(dept);
      construireFiltreDepartements();
      rafraichirAffichageCarte();
      ajusterVueAuxPointsFiltres();
    });
    pucesFiltreDepartement.appendChild(puce);
  });
}

async function chargerTousLesDepartements() {
  if (!navigator.onLine) { alert('Connexion internet nécessaire pour déterminer les départements.'); return; }
  const bouton = document.getElementById('puce-departement-charger');
  const dejaVus = new Set();
  const aTraiter = [];
  tousLesPoints.forEach(({ point }) => {
    const cle = `${point.lat.toFixed(2)}_${point.lng.toFixed(2)}`;
    if (!dejaVus.has(cle)) { dejaVus.add(cle); aTraiter.push({ cle, point }); }
  });

  for (let i = 0; i < aTraiter.length; i++) {
    if (bouton) bouton.textContent = `Chargement... ${i + 1}/${aTraiter.length}`;
    const { cle, point } = aTraiter[i];
    const dept = await obtenirDepartement(point.lat, point.lng);
    departementParCle.set(cle, dept);
    if (i < aTraiter.length - 1) await new Promise(r => setTimeout(r, 1100)); // limite d'usage de Nominatim
  }
  construireFiltreDepartements();
  rafraichirAffichageCarte();
}

btnFiltre.addEventListener('click', () => {
  barreFiltre.classList.toggle('cache');
  btnFiltre.classList.toggle('actif');
  setTimeout(() => carte.invalidateSize(), 0);
});
rechercheFiltre.addEventListener('input', () => { rafraichirAffichageCarte(); ajusterVueAuxPointsFiltres(); });

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Panneau liste triable ---

function construireListe() {
  const critere = triListe.value;
  let entrees = calculerPointsFiltres();
  const positionActuelle = marqueurPosition ? marqueurPosition.getLatLng() : null;

  if (critere === 'proximite') {
    if (!positionActuelle) { contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Position indisponible pour le tri par proximité.</p>'; return; }
    entrees.sort((a, b) => distanceMetres(positionActuelle.lat, positionActuelle.lng, a.point.lat, a.point.lng) - distanceMetres(positionActuelle.lat, positionActuelle.lng, b.point.lat, b.point.lng));
  } else if (critere === 'recent') {
    entrees.sort((a, b) => new Date(b.point.dateFound) - new Date(a.point.dateFound));
  } else if (critere === 'ancien') {
    entrees.sort((a, b) => new Date(a.point.dateFound) - new Date(b.point.dateFound));
  }

  contenuListe.innerHTML = '';
  if (entrees.length === 0) { contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Aucun point à afficher.</p>'; return; }

  entrees.forEach(({ point, enAttente }) => {
    const item = document.createElement('div');
    item.className = 'item-liste';
    let details = formaterDate(point.dateFound);
    if (critere === 'proximite' && positionActuelle) {
      const d = distanceMetres(positionActuelle.lat, positionActuelle.lng, point.lat, point.lng);
      details += ' · ' + (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
    }
    if (enAttente) details += ' · ⏳ en attente';
    item.innerHTML = `
      <div class="item-liste-icone">${htmlIcone(point.mushroomType)}</div>
      <div class="item-liste-texte">
        <div class="item-liste-type">${point.mushroomType}</div>
        <div class="item-liste-details">${details}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      carte.setView([point.lat, point.lng], 17);
      panneauListe.classList.add('cache');
      pileBoutonsFlottants.classList.remove('cache');
      afficherDetailPoint(point);
    });
    contenuListe.appendChild(item);
  });
}

btnListe.addEventListener('click', () => {
  panneauListe.classList.toggle('cache');
  const ouvert = !panneauListe.classList.contains('cache');
  pileBoutonsFlottants.classList.toggle('cache', ouvert);
  if (ouvert) { compteurAttente.classList.add('cache'); construireListe(); }
  else mettreAJourBadgeAttente();
});
triListe.addEventListener('change', construireListe);

// ==================================================
// 6. DÉTAIL D'UN POINT
// ==================================================

function formaterDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formaterDateHeure(dateStr) {
  if (!dateStr) return 'date inconnue';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

let pointActuellementAffiche = null;
let derniereZoneAffichee = null;

function afficherDetailPoint(point, depuisZone) {
  pointActuellementAffiche = point;
  const zoneType = document.getElementById('detail-type');
  zoneType.innerHTML = `${htmlIcone(point.mushroomType)} ${point.mushroomType}`;
  zoneType.className = point._id ? 'detail-type-cliquable' : '';
  zoneType.onclick = point._id ? () => ouvrirModalModification(point) : null;

  const btnRetour = document.getElementById('btn-retour-zone');
  btnRetour.classList.toggle('cache', !depuisZone);
  btnRetour.onclick = () => {
    document.getElementById('modal-detail').classList.add('cache');
    if (derniereZoneAffichee) afficherZone(derniereZoneAffichee);
  };

  document.getElementById('detail-date').textContent = formaterDate(point.dateFound);
  document.getElementById('detail-notes').textContent = point.notes || '';
  document.getElementById('detail-coordonnees').textContent = texteCoordonnees(point);

  const zoneHistorique = document.getElementById('detail-historique');
  zoneHistorique.innerHTML = '';
  if (point.createdAt) {
    const l = document.createElement('div');
    l.className = 'historique-entree';
    l.textContent = `Créé le ${formaterDateHeure(point.createdAt)} par ${point.createdBy || 'inconnu'}`;
    zoneHistorique.appendChild(l);
  }
  if (point.updatedAt && point.updatedAt !== point.createdAt) {
    const l = document.createElement('div');
    l.className = 'historique-entree';
    l.textContent = `Modifié le ${formaterDateHeure(point.updatedAt)} par ${point.updatedBy || 'inconnu'}`;
    zoneHistorique.appendChild(l);
  }
  if (point.history && point.history.length > 0) {
    const titreHistorique = document.createElement('div');
    titreHistorique.className = 'historique-titre';
    titreHistorique.textContent = `📜 Historique complet (${point.history.length} version(s) précédente(s)) :`;
    zoneHistorique.appendChild(titreHistorique);

    // Les versions précédentes sont stockées de la plus ancienne à la plus récente ;
    // on les affiche en ordre inverse (la plus récente d'abord), avant l'état actuel.
    [...point.history].reverse().forEach((version, i) => {
      const l = document.createElement('div');
      l.className = 'historique-entree historique-version';
      l.innerHTML = `<b>${version.mushroomType}</b> — ${formaterDate(version.dateFound)}${version.notes ? ` — "${version.notes}"` : ''}<br>modifié le ${formaterDateHeure(version.updatedAt)} par ${version.updatedBy || 'inconnu'}`;
      zoneHistorique.appendChild(l);
    });
  }

  document.getElementById('btn-supprimer-point').onclick = async () => {
    if (!point._id) { alert('Ce point n\'est pas encore synchronisé, réessaie une fois en ligne.'); return; }
    if (!confirm('Supprimer ce coin ?')) return;
    await fetch(`${API_BASE}/spots/${point._id}?groupCode=${encodeURIComponent(groupeCourant.code)}`, { method: 'DELETE' });
    document.getElementById('modal-detail').classList.add('cache');
    chargerPoints();
  };
  document.getElementById('btn-modifier-point').onclick = () => {
    if (!point._id) { alert('Ce point n\'est pas encore synchronisé, réessaie une fois en ligne.'); return; }
    ouvrirModalModification(point);
  };

  document.getElementById('modal-detail').classList.remove('cache');
}

document.getElementById('btn-itineraire-point').addEventListener('click', () => {
  document.getElementById('modal-itineraire').classList.remove('cache');
});

document.querySelectorAll('.btn-app-navigation').forEach(bouton => {
  bouton.addEventListener('click', () => {
    if (!pointActuellementAffiche) return;
    const { lat, lng } = pointActuellementAffiche;
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    };
    window.open(urls[bouton.dataset.app], '_blank');
    document.getElementById('modal-itineraire').classList.add('cache');
  });
});

// Fermeture des modales en cliquant en dehors de leur contenu
['modal-detail', 'modal-zone', 'modal-membres', 'modal-itineraire'].forEach(id => {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) document.getElementById(id).classList.add('cache');
  });
});

// ==================================================
// 7. DÉMARRAGE
// ==================================================

const groupeSauvegarde = localStorage.getItem('champicoin_groupe');
if (groupeSauvegarde) entrerDansGroupe(JSON.parse(groupeSauvegarde));

mettreAJourBadgeAttente();

if (!navigator.onLine && !modeAvionForce) {
  statutConnexion.textContent = 'hors-ligne';
  statutConnexion.classList.add('hors-ligne');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}
