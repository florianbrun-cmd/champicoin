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
  'Bolet à pied rouge': 'bolet_pied_rouge',
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
let derniereAccuracyConnue = null;
let dernierCapConnu = null;
let marqueurTemporaireAjout = null;
let dernierePositionTimestamp = null;
let groupeCourant = null;
let positionTemporaire = null;
let tousLesPoints = [];
let typesFiltreActifs = new Set();
let moisFiltreActifs = new Set();
let importFiltreActifs = new Set();
let departementsFiltreActifs = new Set();
let departementParCle = new Map(); // "lat_lng" (arrondi) -> nom du département
let modeAjoutManuel = false;
let modeAvionForce = localStorage.getItem('champicoin_mode_avion') === '1';

const btnFiltre = document.getElementById('btn-filtre');
const barreFiltre = document.getElementById('barre-filtre');
const pucesFiltre = document.getElementById('puces-filtre');
const pucesFiltreMois = document.getElementById('puces-filtre-mois');
const pucesFiltreImport = document.getElementById('puces-filtre-import');
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
      <div class="resultat-code-item resultat-code-cliquable" data-code="${g.code}">
        <span>${g.name}</span><span class="resultat-code-valeur">${g.code}</span>
      </div>
    `).join('');

    zoneResultats.querySelectorAll('.resultat-code-cliquable').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('code-groupe').value = el.dataset.code;
        zoneResultats.classList.add('cache');
        document.getElementById('code-groupe').focus();
      });
    });
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

// Recentre la carte sur la position actuelle (ou, à défaut, la vue par défaut) : appelée à
// chaque entrée dans un groupe, pour ne jamais repartir sur la vue laissée par un groupe précédent.
function recentrerSurPositionActuelle() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => carte.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => carte.setView([46.6, 2.2], 6)
    );
  } else {
    carte.setView([46.6, 2.2], 6);
  }
}

async function entrerDansGroupe(groupe) {
  groupeCourant = groupe;
  localStorage.setItem('champicoin_groupe', JSON.stringify(groupe));
  nomGroupeActif.textContent = groupe.name;
  document.getElementById('code-groupe-actif').textContent = groupe.code;
  ecranGroupe.classList.add('cache');
  ecranCarte.classList.remove('cache');
  initCarte();
  recentrerSurPositionActuelle();
  await chargerPoints();
  await synchroniserPointsEnAttente(true);
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
  carte = L.map('carte', { rotate: true, touchRotate: true, rotateControl: false, bearing: 0 }).setView([46.6, 2.2], 6);

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
  ajouterControleRotation();
  carte.on('rotate', () => {
    if (marqueurPosition) marqueurPosition.setIcon(construireIconePosition(dernierCapConnu));
  });

  carte.on('zoomend', () => rafraichirAffichageCarte());

  // Corrige un souci d'affichage mobile : la taille réelle du conteneur peut ne se
  // stabiliser qu'après le premier rendu (barre d'adresse qui se réduit, etc.)
  setTimeout(() => carte.invalidateSize(), 300);

  carte.on('click', (e) => {
    if (modeAjoutManuel) {
      positionTemporaire = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: accuracyActuelleSiRecente(), elevation: null, manuel: true };
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
      const largeurPanneau = panneauListe.offsetWidth;
      panneauListe.classList.add('cache');
      pileBoutonsFlottants.classList.remove('cache');
      mettreAJourBadgeAttente();
      carte.panBy([-largeurPanneau / 2, 0], { animate: true });
    }
  });
}

function construireIconePosition(cap) {
  const bearingCarte = (carte && carte.getBearing) ? carte.getBearing() : 0;
  const fleche = (cap === null || cap === undefined || isNaN(cap))
    ? ''
    : `<div class="marqueur-ma-position-fleche" style="transform: rotate(${cap - bearingCarte}deg);"></div>`;
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
      // Le cap GPS (déplacement) n'existe que lorsqu'on bouge suffisamment vite ; à l'arrêt,
      // il vaut null — on garde alors le dernier cap connu (boussole de l'appareil, voir
      // activerSuiviBoussole) au lieu d'effacer la flèche de direction.
      if (pos.coords.heading !== null && pos.coords.heading !== undefined && !isNaN(pos.coords.heading)) {
        dernierCapConnu = pos.coords.heading;
      }
      const icone = construireIconePosition(dernierCapConnu);
      if (!marqueurPosition) {
        marqueurPosition = L.marker(latlng, { icon: icone, zIndexOffset: 1000 }).addTo(carte);
      } else {
        marqueurPosition.setLatLng(latlng);
        marqueurPosition.setIcon(icone);
      }
      derniereAccuracyConnue = pos.coords.accuracy;
      dernierePositionTimestamp = Date.now();
    },
    (err) => console.warn('Suivi de position indisponible :', err.message),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

// Boussole de l'appareil : fournit un cap même à l'arrêt (contrairement au cap GPS, qui
// nécessite un déplacement). Nécessite une autorisation sur iOS, demandée au premier
// geste de l'utilisateur (voir l'appel dans le contrôle de localisation).
let boussoleActivee = false;

function gererOrientationAppareil(event) {
  let cap = null;
  if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
    cap = event.webkitCompassHeading; // iOS Safari : déjà en degrés depuis le nord, sens horaire
  } else if (event.alpha !== null && event.alpha !== undefined) {
    cap = 360 - event.alpha; // approximation raisonnable pour Android/Chrome
  }
  if (cap === null || isNaN(cap)) return;

  dernierCapConnu = cap;
  if (marqueurPosition) marqueurPosition.setIcon(construireIconePosition(dernierCapConnu));
}

function activerSuiviBoussole() {
  if (boussoleActivee || typeof DeviceOrientationEvent === 'undefined') return;
  boussoleActivee = true;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(reponse => {
      if (reponse === 'granted') window.addEventListener('deviceorientation', gererOrientationAppareil);
    }).catch(() => {});
  } else {
    window.addEventListener('deviceorientationabsolute', gererOrientationAppareil);
    window.addEventListener('deviceorientation', gererOrientationAppareil);
  }
}

// Renvoie la précision GPS actuelle de l'appareil si elle est connue et récente
// (moins de 30 s), sinon null — utilisée au moment d'un placement manuel sur la carte.
function accuracyActuelleSiRecente() {
  if (derniereAccuracyConnue === null || !dernierePositionTimestamp) return null;
  if (Date.now() - dernierePositionTimestamp > 30000) return null;
  return derniereAccuracyConnue;
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
        activerSuiviBoussole();
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

function ajouterControleRotation() {
  const ControleRotation = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-rotation');
      const lien = L.DomUtil.create('a', '', div);
      lien.href = '#';
      lien.title = "Réorienter la carte plein nord";
      const fleche = L.DomUtil.create('span', 'fleche-nord', lien);
      fleche.innerHTML = '↑';
      L.DomEvent.on(lien, 'click', L.DomEvent.stopPropagation);
      L.DomEvent.on(lien, 'click', L.DomEvent.preventDefault);
      L.DomEvent.on(lien, 'click', () => carte.setBearing(0));
      carte.on('rotate', () => { fleche.style.transform = `rotate(${-carte.getBearing()}deg)`; });
      return div;
    }
  });
  carte.addControl(new ControleRotation());
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
  activerSuiviBoussole();
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
  let imageBlob = fichier;
  const estHeic = f => f.type === 'image/heic' || f.type === 'image/heif' || /\.heic$/i.test(f.name);

  // Les photos HEIC (format par défaut sur iPhone) ne sont pas lisibles directement par
  // exif-js : on les convertit d'abord en JPEG via heic2any, si la librairie est chargée.
  if (estHeic(fichier)) {
    if (window.heic2any) {
      try {
        const resultat = await heic2any({ blob: fichier, toType: 'image/jpeg', quality: 0.8 });
        imageBlob = Array.isArray(resultat) ? resultat[0] : resultat;
      } catch (err) {
        return null;
      }
    } else {
      return null;
    }
  }

  const donnees = await lireExif(imageBlob);
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
    sourceImport: 'photo',
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
      sourceImport: 'gpx',
      clientId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
    };
  }).filter(Boolean);
}

let tourneeImportPoints = [];
let tourneeImportIndex = 0;

function demarrerTourneeImport(points) {
  if (!points || points.length === 0) return;
  tourneeImportPoints = points;
  tourneeImportIndex = 0;
  afficherPointTournee();
  document.getElementById('navigation-import').classList.toggle('cache', points.length <= 1);
}

function afficherPointTournee() {
  const p = tourneeImportPoints[tourneeImportIndex];
  if (!p) return;
  carte.setView([p.lat, p.lng], Math.max(carte.getZoom(), 17));
  document.getElementById('nav-import-compteur').textContent = `${tourneeImportIndex + 1}/${tourneeImportPoints.length}`;
}

document.getElementById('btn-nav-precedent').addEventListener('click', () => {
  tourneeImportIndex = (tourneeImportIndex - 1 + tourneeImportPoints.length) % tourneeImportPoints.length;
  afficherPointTournee();
});
document.getElementById('btn-nav-suivant').addEventListener('click', () => {
  tourneeImportIndex = (tourneeImportIndex + 1) % tourneeImportPoints.length;
  afficherPointTournee();
});
document.getElementById('btn-nav-fermer').addEventListener('click', () => {
  document.getElementById('navigation-import').classList.add('cache');
});

document.getElementById('fichier-gpx').addEventListener('change', async (e) => {
  const fichiers = Array.from(e.target.files || []);
  if (fichiers.length === 0) return;

  const zoneProgression = document.getElementById('progression-import');
  const texteProgression = document.getElementById('progression-import-texte');
  const barreProgression = document.getElementById('progression-import-barre');

  async function majProgression(texte, ratio) {
    zoneProgression.classList.remove('cache');
    compteurAttente.classList.add('cache'); // évite la confusion avec le badge "en attente" pendant l'import
    texteProgression.textContent = texte;
    barreProgression.style.width = `${Math.round(ratio * 100)}%`;
    // Sans cette pause, le navigateur peut enchaîner les étapes sans jamais peindre
    // la barre à l'écran (mise à jour trop rapide pour être visible autrement).
    await new Promise(r => setTimeout(r, 0));
  }

  try {
    let aImporter = [];
    let photosSansGps = 0;

    for (let i = 0; i < fichiers.length; i++) {
      const fichier = fichiers[i];
      await majProgression(`Lecture des fichiers... ${i + 1}/${fichiers.length}`, (i + 1) / fichiers.length / 2);
      if (fichier.name.toLowerCase().endsWith('.gpx')) {
        aImporter.push(...importerGpx(await fichier.text()));
      } else if (fichier.type === 'image/jpeg' || /\.jpe?g$/i.test(fichier.name) || fichier.type === 'image/heic' || fichier.type === 'image/heif' || /\.heic$/i.test(fichier.name)) {
        const point = await importerPhoto(fichier);
        if (point) aImporter.push(point);
        else photosSansGps++;
      }
    }

    if (aImporter.length === 0) {
      zoneProgression.classList.add('cache');
      alert(photosSansGps > 0
        ? 'Aucune coordonnée GPS trouvée dans ces photos. Vérifie que la localisation était activée lors de la prise de vue.'
        : 'Aucun point exploitable trouvé dans ces fichiers.');
      return;
    }

    // Évite de réimporter un point déjà présent (même type, même date, mêmes coordonnées) —
    // utile si le même fichier GPX ou les mêmes photos sont importés une seconde fois.
    const clesExistantes = new Set(
      tousLesPoints
        .filter(({ point }) => point._id)
        .map(({ point }) => `${point.mushroomType}|${point.dateFound}|${point.lat.toFixed(6)}|${point.lng.toFixed(6)}`)
    );
    const nbAvantFiltre = aImporter.length;
    aImporter = aImporter.filter(p => !clesExistantes.has(`${p.mushroomType}|${p.dateFound}|${p.lat.toFixed(6)}|${p.lng.toFixed(6)}`));
    const dejaExistants = nbAvantFiltre - aImporter.length;

    if (aImporter.length === 0) {
      zoneProgression.classList.add('cache');
      alert(`Les ${dejaExistants} point(s) de cet import existent déjà (même type, même date, mêmes coordonnées) — rien à ajouter.`);
      return;
    }

    let message = `Importer ${aImporter.length} point(s) ?`;
    if (photosSansGps > 0) message += ` (${photosSansGps} photo(s) sans position GPS ignorée(s))`;
    if (dejaExistants > 0) message += ` (${dejaExistants} déjà existant(s) ignoré(s))`;
    if (!confirm(message)) { zoneProgression.classList.add('cache'); return; }

    if (estEnLigne()) {
      const TAILLE_LOT = 200;
      let totalInseres = 0;
      let totalDoublons = 0;
      for (let i = 0; i < aImporter.length; i += TAILLE_LOT) {
        const lot = aImporter.slice(i, i + TAILLE_LOT);
        const fait = Math.min(i + TAILLE_LOT, aImporter.length);
        await majProgression(`Enregistrement... ${fait}/${aImporter.length}`, 0.5 + (fait / aImporter.length) / 2);
        try {
          const reponse = await fetch(`${API_BASE}/spots/bulk`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupCode: groupeCourant.code,
              points: lot.map(p => ({ ...p, author: getPseudo() }))
            })
          });
          const data = await reponse.json();
          totalInseres += data.inseres || 0;
          totalDoublons += data.doublons || 0;
        } catch (err) {
          // Ce lot n'est pas passé (réseau coupé en cours d'import) : on le met en
          // attente locale comme un ajout hors-ligne classique, rien n'est perdu.
          lot.forEach(p => ajouterAFileDAttente(p));
        }
      }
      await chargerPoints();
      afficherToast(totalDoublons > 0 ? `Import terminé : ${totalInseres} point(s) (${totalDoublons} déjà existant(s) ignoré(s)).` : 'Import terminé !');
      demarrerTourneeImport(aImporter);
    } else {
      aImporter.forEach(p => ajouterAFileDAttente(p));
      construireBarreFiltre();
      rafraichirAffichageCarte();
      afficherToast('Import terminé (en attente de réseau pour synchroniser).');
      demarrerTourneeImport(aImporter);
    }
  } catch (err) {
    alert('Erreur lors de la lecture des fichiers.');
  } finally {
    zoneProgression.classList.add('cache');
    barreProgression.style.width = '0%';
    mettreAJourBadgeAttente();
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

function placerMarqueurTemporaire(lat, lng, type) {
  retirerMarqueurTemporaire();
  const icone = L.divIcon({
    className: 'marqueur-temporaire-ancre',
    html: `<div class="marqueur-temporaire">${htmlIcone(type || 'Autres')}<span class="croix-precision">✛</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34]
  });
  marqueurTemporaireAjout = L.marker([lat, lng], { icon: icone, zIndexOffset: 2000 }).addTo(carte);
  activerAppuiLongPourDeplacer(marqueurTemporaireAjout);
}

const SEUIL_APPUI_LONG_MS = 550;
const SEUIL_MOUVEMENT_ANNULATION_PX = 12;

// Glissé entièrement géré à la main (plutôt que via marker.dragging de Leaflet) : en
// s'appuyant sur ce dernier, activer le glissé après le délai d'appui long arrivait
// TROP TARD pour capter le mousedown/touchstart déjà en cours, rendant le déplacement
// impossible à la souris (fonctionnait par chance au doigt sur certains appareils).
function activerAppuiLongPourDeplacer(marqueur) {
  let minuteur = null;
  let depart = null;
  let libere = false;

  function coordonneesEvenement(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function deplacerVers(e) {
    const pos = coordonneesEvenement(e);
    const rect = document.getElementById('carte').getBoundingClientRect();
    const latlng = carte.containerPointToLatLng(L.point(pos.x - rect.left, pos.y - rect.top));
    marqueur.setLatLng(latlng);
  }

  function demarrer(e) {
    depart = coordonneesEvenement(e);
    libere = false;
    minuteur = setTimeout(() => {
      libere = true;
      carte.dragging.disable(); // la carte ne doit plus bouger pendant qu'on positionne le marqueur
      const el = marqueur.getElement();
      if (el) el.classList.add('marqueur-temporaire-libere');
      if (navigator.vibrate) navigator.vibrate(30);
    }, SEUIL_APPUI_LONG_MS);
  }

  function pendantDeplacement(e) {
    if (!depart) return;
    if (!libere) {
      const pos = coordonneesEvenement(e);
      if (Math.hypot(pos.x - depart.x, pos.y - depart.y) > SEUIL_MOUVEMENT_ANNULATION_PX) {
        clearTimeout(minuteur);
        minuteur = null;
      }
      return;
    }
    if (e.cancelable) e.preventDefault();
    deplacerVers(e);
  }

  function terminer() {
    clearTimeout(minuteur);
    minuteur = null;
    if (libere) {
      carte.dragging.enable();
      const pos = marqueur.getLatLng();
      positionTemporaire.lat = pos.lat;
      positionTemporaire.lng = pos.lng;
      positionTemporaire.accuracy = null; // position ajustée à la main : la précision GPS d'origine ne s'applique plus
      document.getElementById('coordonnees-ajout').textContent = texteCoordonnees(positionTemporaire);
      recupererAltitude(pos.lat, pos.lng);
      const el = marqueur.getElement();
      if (el) el.classList.remove('marqueur-temporaire-libere');
    }
    libere = false;
    depart = null;
  }

  marqueur.on('add', () => {
    const el = marqueur.getElement();
    if (!el) return;
    el.addEventListener('touchstart', demarrer, { passive: true });
    el.addEventListener('touchmove', pendantDeplacement, { passive: false });
    el.addEventListener('touchend', terminer);
    el.addEventListener('touchcancel', terminer);
    el.addEventListener('mousedown', demarrer);
    document.addEventListener('mousemove', pendantDeplacement);
    document.addEventListener('mouseup', terminer);
    marqueur._nettoyageAppuiLong = () => {
      document.removeEventListener('mousemove', pendantDeplacement);
      document.removeEventListener('mouseup', terminer);
      clearTimeout(minuteur);
      carte.dragging.enable();
    };
  });
}

function retirerMarqueurTemporaire() {
  if (marqueurTemporaireAjout) {
    if (marqueurTemporaireAjout._nettoyageAppuiLong) marqueurTemporaireAjout._nettoyageAppuiLong();
    carte.removeLayer(marqueurTemporaireAjout);
    marqueurTemporaireAjout = null;
  }
}

let panAppliquePourModalAjout = 0;

function recentrerCartePourModal(lat, lng) {
  requestAnimationFrame(() => {
    const feuille = document.querySelector('#modal-ajout .modal-contenu');
    const zoneCarte = document.getElementById('carte');
    if (!feuille || !zoneCarte || !carte) return;
    const hauteurFeuille = feuille.offsetHeight;
    const hauteurCarte = zoneCarte.offsetHeight;
    const pointEcran = carte.latLngToContainerPoint([lat, lng]);
    const limiteVisible = hauteurCarte - hauteurFeuille - 20;
    if (pointEcran.y > limiteVisible) {
      const decalage = pointEcran.y - limiteVisible / 2;
      panAppliquePourModalAjout = decalage;
      carte.panBy([0, decalage], { animate: true });
    } else {
      panAppliquePourModalAjout = 0;
    }
  });
}

function annulerRecentrageModal() {
  if (panAppliquePourModalAjout && carte) {
    carte.panBy([0, -panAppliquePourModalAjout], { animate: true });
  }
  panAppliquePourModalAjout = 0;
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
  document.getElementById('astuce-deplacement').classList.add('cache');
  document.getElementById('modal-ajout').classList.remove('cache');
  if (positionTemporaire) recentrerCartePourModal(positionTemporaire.lat, positionTemporaire.lng);
}

function ouvrirModalModification(point) {
  document.getElementById('titre-modal-ajout').textContent = 'Modifier le coin 🍄';
  document.getElementById('id-champignon-edite').value = point._id || '';
  selectionnerTypeChampignon(point.mushroomType);
  document.getElementById('date-trouvee').value = point.dateFound;
  document.getElementById('notes-champignon').value = point.notes || '';
  // La position devient ajustable au glissé (appui long) pendant la modification,
  // contrairement à la création où le point vient d'être tapé précisément.
  positionTemporaire = { lat: point.lat, lng: point.lng, accuracy: point.accuracy, elevation: point.elevation, manuel: true };
  document.getElementById('coordonnees-ajout').textContent = texteCoordonnees(positionTemporaire);
  document.getElementById('modal-detail').classList.add('cache');
  document.getElementById('astuce-deplacement').classList.remove('cache');
  document.getElementById('modal-ajout').classList.remove('cache');
  placerMarqueurTemporaire(point.lat, point.lng, point.mushroomType);
  recentrerCartePourModal(point.lat, point.lng);
}

document.getElementById('btn-annuler-ajout').addEventListener('click', () => {
  document.getElementById('modal-ajout').classList.add('cache');
  document.getElementById('form-champignon').reset();
  positionTemporaire = null;
  retirerMarqueurTemporaire();
  annulerRecentrageModal();
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
    if (positionTemporaire) {
      donneesFormulaire.lat = positionTemporaire.lat;
      donneesFormulaire.lng = positionTemporaire.lng;
      donneesFormulaire.elevation = positionTemporaire.elevation;
    }
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
    if (estEnLigne()) await chargerPoints(); // remplace l'entrée optimiste par l'état réel du serveur
  }
  positionTemporaire = null;
  retirerMarqueurTemporaire();
  annulerRecentrageModal();
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
  const zoneProgression = document.getElementById('progression-import');
  const texteProgression = document.getElementById('progression-import-texte');
  const barreProgression = document.getElementById('progression-import-barre');
  try {
    const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');

    if (file.length > 0) {
      zoneProgression.classList.remove('cache');
      compteurAttente.classList.add('cache');
      const restants = [];
      for (let i = 0; i < file.length; i++) {
        const point = file[i];
        texteProgression.textContent = `Synchronisation... ${i + 1}/${file.length}`;
        barreProgression.style.width = `${Math.round(((i + 1) / file.length) * 100)}%`;
        await new Promise(r => setTimeout(r, 0));
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
      zoneProgression.classList.add('cache');
      barreProgression.style.width = '0%';
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
    zoneProgression.classList.add('cache');
    barreProgression.style.width = '0%';
  }
}

document.getElementById('btn-synchro-entete').addEventListener('click', () => synchroniserPointsEnAttente(false));
compteurAttente.addEventListener('click', () => synchroniserPointsEnAttente(false));

document.getElementById('btn-archives').addEventListener('click', async () => {
  const zone = document.getElementById('contenu-archives');
  zone.innerHTML = '<p style="color:#888;padding:10px 0;">Chargement...</p>';
  document.getElementById('modal-archives').classList.remove('cache');

  if (!estEnLigne()) {
    zone.innerHTML = '<p style="color:#888;">Connexion internet requise.</p>';
    return;
  }

  try {
    const reponse = await fetch(`${API_BASE}/spots?groupCode=${encodeURIComponent(groupeCourant.code)}&archives=1`);
    const data = await reponse.json();
    const archives = data.spots || [];

    if (archives.length === 0) {
      zone.innerHTML = '<p style="color:#888;">Aucun point archivé pour le moment.</p>';
      return;
    }

    zone.innerHTML = archives.map(point => `
      <div class="item-liste" data-id="${point._id}">
        <div class="item-liste-icone">${htmlIcone(point.mushroomType)}</div>
        <div class="item-liste-texte">
          <div class="item-liste-type">${point.mushroomType}</div>
          <div class="item-liste-details">${formaterDate(point.dateFound)} · ${formaterCoordDMM(point.lat, point.lng)}</div>
        </div>
        <button type="button" class="btn-restaurer" data-id="${point._id}">Restaurer</button>
      </div>
    `).join('');

    zone.querySelectorAll('.btn-restaurer').forEach(bouton => {
      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        bouton.textContent = '...';
        await fetch(`${API_BASE}/spots/${bouton.dataset.id}/archive`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupCode: groupeCourant.code, archive: false })
        });
        bouton.closest('.item-liste').remove();
        afficherToast('Point restauré.');
        chargerPoints();
      });
    });
  } catch (err) {
    zone.innerHTML = '<p style="color:#888;">Erreur de chargement.</p>';
  }
});

document.getElementById('btn-purger-archives').addEventListener('click', async () => {
  if (!estEnLigne()) { alert('Une connexion internet est nécessaire pour purger.'); return; }
  if (!confirm('Supprimer définitivement tous les points archivés depuis plus de 3 mois ? Cette action est irréversible (contrairement à l\'archivage).')) return;

  const bouton = document.getElementById('btn-purger-archives');
  bouton.disabled = true;
  bouton.textContent = 'Purge en cours...';
  try {
    const reponse = await fetch(`${API_BASE}/spots/purge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupCode: groupeCourant.code })
    });
    const data = await reponse.json();
    if (!reponse.ok) { alert(data.error || 'Erreur lors de la purge.'); return; }
    afficherToast(`${data.supprimes} point(s) définitivement supprimé(s).`);
    document.getElementById('btn-archives').click(); // rafraîchit la liste affichée
  } catch (err) {
    alert('Erreur réseau, réessaie plus tard.');
  } finally {
    bouton.disabled = false;
    bouton.textContent = 'Purger maintenant (+3 mois)';
  }
});

document.getElementById('btn-nettoyer-doublons').addEventListener('click', async () => {
  if (!estEnLigne()) { alert('Une connexion internet est nécessaire pour nettoyer les doublons.'); return; }

  // Correspondance stricte : mêmes coordonnées (au mètre près) ET même date.
  const groupes = {};
  const pointsAvecId = tousLesPoints.filter(({ point }) => point._id);
  pointsAvecId.forEach(({ point }) => {
    const cle = `${point.lat.toFixed(6)}_${point.lng.toFixed(6)}_${point.dateFound}`;
    if (!groupes[cle]) groupes[cle] = [];
    groupes[cle].push(point);
  });

  const idsAArchiver = [];
  Object.values(groupes).forEach(points => {
    if (points.length <= 1) return;
    const tries = points.slice().sort((a, b) => String(a._id).localeCompare(String(b._id)));
    for (let i = 1; i < tries.length; i++) idsAArchiver.push(String(tries[i]._id));
  });
  const idsUniques = [...new Set(idsAArchiver)];

  if (idsUniques.length === 0) {
    afficherToast('Aucun doublon exact trouvé.');
    return;
  }

  const totalActuel = pointsAvecId.length;
  const restants = totalActuel - idsUniques.length;
  const messageConfirmation = `${idsUniques.length} doublon(s) exact(s) détecté(s) (même date, mêmes coordonnées).\n\n` +
    `Total actuel : ${totalActuel} points\n` +
    `Archivés (masqués de la carte) : ${idsUniques.length}\n` +
    `Visibles après nettoyage : ${restants}\n\n` +
    `Un exemplaire de chaque doublon reste visible. Les autres ne sont pas supprimés : ils sont archivés, et resteront récupérables depuis "Points archivés". Continuer ?`;
  if (!confirm(messageConfirmation)) return;

  const zoneProgression = document.getElementById('progression-import');
  const texteProgression = document.getElementById('progression-import-texte');
  const barreProgression = document.getElementById('progression-import-barre');
  zoneProgression.classList.remove('cache');
  compteurAttente.classList.add('cache');

  const taillePaquet = 10;
  for (let i = 0; i < idsUniques.length; i += taillePaquet) {
    const paquet = idsUniques.slice(i, i + taillePaquet);
    const fait = Math.min(i + taillePaquet, idsUniques.length);
    texteProgression.textContent = `Archivage des doublons... ${fait}/${idsUniques.length}`;
    barreProgression.style.width = `${Math.round((fait / idsUniques.length) * 100)}%`;
    await new Promise(r => setTimeout(r, 0));
    await Promise.all(paquet.map(id =>
      fetch(`${API_BASE}/spots/${id}/archive`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode: groupeCourant.code, archive: true })
      }).catch(() => {})
    ));
  }

  zoneProgression.classList.add('cache');
  barreProgression.style.width = '0%';
  mettreAJourBadgeAttente();

  afficherToast(`${idsUniques.length} doublon(s) archivé(s) — récupérables via "Points archivés".`);
  await chargerPoints();
});

function mettreAJourBadgeAttente() {
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length > 0) {
    compteurAttente.textContent = `${file.length} point(s) en attente — toucher pour synchroniser`;
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

let promesseChargementEnCours = null;

function chargerPointsDepuisCache(cleCache) {
  try {
    const cache = JSON.parse(localStorage.getItem(cleCache) || 'null');
    if (!cache || !Array.isArray(cache.spots)) return false;

    const idsVus = new Set();
    cache.spots.forEach(spot => {
      if (spot._id) {
        if (idsVus.has(spot._id)) return;
        idsVus.add(spot._id);
      }
      tousLesPoints.push({ point: spot, enAttente: false });
    });
    if (cache.spots.length > 0) {
      const dateSauvegarde = new Date(cache.sauvegardeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      afficherToast(`Points hors-ligne (dernière synchro : ${dateSauvegarde})`);
    }
    return true;
  } catch (err) {
    return false; // pas de cache disponible, on continue avec la file d'attente seule
  }
}

function chargerPoints() {
  // Si un chargement est déjà en cours, on renvoie la même promesse au lieu d'en
  // démarrer un second en parallèle : c'était la cause du doublon d'affichage
  // (deux chargements qui se chevauchent poussent chacun leur propre exemplaire).
  if (promesseChargementEnCours) return promesseChargementEnCours;

  promesseChargementEnCours = (async () => {
    tousLesPoints = [];
    const cleCache = `champicoin_cache_points_${groupeCourant.code}`;

    if (estEnLigne()) {
      try {
        const controleur = new AbortController();
        const delaiMax = setTimeout(() => controleur.abort(), 8000);
        const reponse = await fetch(`${API_BASE}/spots?groupCode=${encodeURIComponent(groupeCourant.code)}`, { signal: controleur.signal });
        clearTimeout(delaiMax);
        if (!reponse.ok) throw new Error('Réponse serveur invalide');
        const data = await reponse.json();
        const idsVus = new Set();
        (data.spots || []).forEach(spot => {
          if (spot._id) {
            if (idsVus.has(spot._id)) return; // sécurité : jamais deux fois le même point affiché
            idsVus.add(spot._id);
          }
          tousLesPoints.push({ point: spot, enAttente: false });
        });
        // Copie locale des points, pour pouvoir les afficher même sans réseau la prochaine fois
        try {
          localStorage.setItem(cleCache, JSON.stringify({ spots: data.spots || [], sauvegardeLe: new Date().toISOString() }));
        } catch (err) { /* stockage plein ou indisponible : pas bloquant */ }
      } catch (err) {
        // La requête a échoué malgré une connexion déclarée présente (réseau faible/instable) :
        // on se rabat sur la dernière copie connue plutôt que d'afficher une carte vide.
        console.warn('Impossible de charger les points depuis le serveur, repli sur le cache local.');
        chargerPointsDepuisCache(cleCache);
      }
    } else {
      // Hors-ligne : on affiche la dernière copie connue des points de ce groupe, s'il en existe une
      chargerPointsDepuisCache(cleCache);
    }

    const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
    file.forEach(point => tousLesPoints.push({ point, enAttente: true }));

    construireBarreFiltre();
    rafraichirAffichageCarte();
    rattraperAltitudesManquantes();
  })().finally(() => { promesseChargementEnCours = null; });

  return promesseChargementEnCours;
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
    if (importFiltreActifs.size > 0) {
      const dateImport = dateImportDe(point);
      if (!dateImport || !importFiltreActifs.has(dateImport)) return false;
    }
    return true;
  });
}

function filtresActifs() {
  return typesFiltreActifs.size > 0 || moisFiltreActifs.size > 0 || departementsFiltreActifs.size > 0 ||
    importFiltreActifs.size > 0 ||
    rechercheFiltre.value.trim() !== '';
}

document.getElementById('btn-raz-filtres').addEventListener('click', () => {
  typesFiltreActifs.clear();
  moisFiltreActifs.clear();
  departementsFiltreActifs.clear();
  importFiltreActifs.clear();
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
    // Dernier niveau de zoom : on affiche chaque point individuellement, même très proches ;
    // si plusieurs points partagent quasiment les mêmes coordonnées, on les répartit très
    // légèrement en cercle pour que chacun reste visible et cliquable séparément.
    ecarterPointsCoincidents(pointsFiltres).forEach(({ point, enAttente, latAffiche, lngAffiche, memeCoinPlusieursFois }) => {
      ajouterMarqueur(point, enAttente, { lat: latAffiche, lng: lngAffiche }, memeCoinPlusieursFois);
    });
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

// Deux coins peuvent légitimement partager la même coordonnée exacte (même trou, années
// différentes). À l'affichage individuel, on les écarte de quelques mètres en cercle pour
// que chaque icône reste visible et cliquable — la coordonnée réelle du point, elle, ne
// change jamais (ni en base, ni dans la fiche détail).
function ecarterPointsCoincidents(pointsFiltres) {
  const RAYON_ECART_M = 3;
  const groupes = {};
  pointsFiltres.forEach(entree => {
    const cle = `${entree.point.lat.toFixed(5)}_${entree.point.lng.toFixed(5)}`;
    (groupes[cle] = groupes[cle] || []).push(entree);
  });

  const resultat = [];
  Object.values(groupes).forEach(groupe => {
    if (groupe.length === 1) {
      const { point } = groupe[0];
      resultat.push({ ...groupe[0], latAffiche: point.lat, lngAffiche: point.lng, memeCoinPlusieursFois: false });
      return;
    }
    groupe.forEach((entree, i) => {
      const angle = (2 * Math.PI * i) / groupe.length;
      const dLat = (RAYON_ECART_M * Math.cos(angle)) / 111320;
      const dLng = (RAYON_ECART_M * Math.sin(angle)) / (111320 * Math.cos(entree.point.lat * Math.PI / 180));
      // Le halo doré ne s'applique que si un AUTRE point du groupe partage aussi le même type
      // (même coordonnées mais espèces différentes = pas "productif" pour autant)
      const memeType = groupe.some((autre, j) => j !== i && autre.point.mushroomType === entree.point.mushroomType);
      resultat.push({ ...entree, latAffiche: entree.point.lat + dLat, lngAffiche: entree.point.lng + dLng, memeCoinPlusieursFois: memeType });
    });
  });
  return resultat;
}

function ajouterMarqueur(point, enAttente, positionAffichee, memeCoinPlusieursFois) {
  const badgeAttente = enAttente ? `<span class="badge-en-attente">⏳</span>` : '';
  const nbVisites = 1 + (point.history ? point.history.length : 0);
  const productif = (nbVisites >= 3 || memeCoinPlusieursFois) ? ' marqueur-productif' : '';
  const icone = L.divIcon({
    className: 'marqueur-champi-ancre',
    html: `<div class="marqueur-champi${enAttente ? ' point-en-attente' : ''}${productif}">${htmlIcone(point.mushroomType)}${badgeAttente}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const lat = positionAffichee ? positionAffichee.lat : point.lat;
  const lng = positionAffichee ? positionAffichee.lng : point.lng;
  const marqueur = L.marker([lat, lng], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => {
    if (modeAjoutManuel) {
      positionTemporaire = { lat: point.lat, lng: point.lng, accuracy: accuracyActuelleSiRecente(), manuel: true, elevation: point.elevation };
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
  construireFiltreImport();
  construireFiltreDepartements();
}

function dateImportDe(point) {
  if (!point.sourceImport || !point.createdAt) return null;
  return point.createdAt.slice(0, 10); // "AAAA-MM-JJ"
}

function construireFiltreImport() {
  const datesPresentes = [...new Set(tousLesPoints.map(({ point }) => dateImportDe(point)).filter(Boolean))].sort().reverse();
  pucesFiltreImport.innerHTML = '';
  if (datesPresentes.length === 0) return; // aucun point importé : la section reste vide

  importFiltreActifs.forEach(d => { if (!datesPresentes.includes(d)) importFiltreActifs.delete(d); });

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (importFiltreActifs.size === 0 ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => { importFiltreActifs.clear(); construireFiltreImport(); rafraichirAffichageCarte(); ajusterVueAuxPointsFiltres(); });
  pucesFiltreImport.appendChild(puceTout);

  datesPresentes.forEach(d => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (importFiltreActifs.has(d) ? ' actif' : '');
    puce.textContent = formaterDate(d);
    puce.addEventListener('click', () => {
      if (importFiltreActifs.has(d)) importFiltreActifs.delete(d); else importFiltreActifs.add(d);
      construireFiltreImport();
      rafraichirAffichageCarte();
      ajusterVueAuxPointsFiltres();
    });
    pucesFiltreImport.appendChild(puce);
  });
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
  const etaitOuvert = !panneauListe.classList.contains('cache');
  const largeurPanneau = panneauListe.offsetWidth || 300;
  panneauListe.classList.toggle('cache');
  const ouvert = !panneauListe.classList.contains('cache');
  pileBoutonsFlottants.classList.toggle('cache', ouvert);
  if (ouvert) {
    compteurAttente.classList.add('cache');
    construireListe();
    // Le panneau recouvre la partie droite de la carte : on décale la vue pour
    // ne pas laisser de points cachés dessous (même logique que pour le filtre).
    carte.panBy([largeurPanneau / 2, 0], { animate: true });
  } else {
    mettreAJourBadgeAttente();
    if (etaitOuvert) carte.panBy([-largeurPanneau / 2, 0], { animate: true });
  }
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

document.getElementById('btn-dupliquer-point').addEventListener('click', () => {
  if (!pointActuellementAffiche) return;
  const point = pointActuellementAffiche;
  positionTemporaire = {
    lat: point.lat, lng: point.lng,
    accuracy: accuracyActuelleSiRecente(),
    elevation: point.elevation,
    manuel: true
  };
  document.getElementById('modal-detail').classList.add('cache');
  ouvrirModalAjout();
  // Pré-remplit le même type, pour aller vite ; la date reste sur aujourd'hui
  selectionnerTypeChampignon(point.mushroomType);
});

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
['modal-detail', 'modal-zone', 'modal-membres', 'modal-itineraire', 'modal-archives'].forEach(id => {
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
