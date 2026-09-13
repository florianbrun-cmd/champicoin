// app.js — Champicoin

const API_BASE = '/api';

// --- Correspondance type de champignon -> icône dessinée (toujours dérivée du type,
// ainsi une mise à jour des images profite automatiquement à tous les points existants) ---
const TYPE_VERS_ICONE = {
  'Cèpe': 'cepe',
  'Chanterelle (Girolle)': 'chanterelle',
  'Trompette chanterelle': 'trompette_chanterelle',
  'Trompette de mort': 'trompette_mort',
  'Pied de mouton': 'pied_mouton',
  'Morille': 'morille',
  'Rosé des prés': 'rose_des_pres',
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
    document.getElementById('btn-mode-avion').classList.add('actif');
    document.getElementById('bandeau-mode-avion').classList.remove('cache');
    statutConnexion.textContent = 'hors-ligne (mode avion)';
    statutConnexion.classList.add('hors-ligne');
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

// --- Mode hors-ligne forcé ("mode avion") ---
document.getElementById('btn-mode-avion').addEventListener('click', () => {
  modeAvionForce = !modeAvionForce;
  localStorage.setItem('champicoin_mode_avion', modeAvionForce ? '1' : '0');
  document.getElementById('btn-mode-avion').classList.toggle('actif', modeAvionForce);
  document.getElementById('bandeau-mode-avion').classList.toggle('cache', !modeAvionForce);

  if (modeAvionForce) {
    statutConnexion.textContent = 'hors-ligne (mode avion)';
    statutConnexion.classList.add('hors-ligne');
  } else {
    statutConnexion.textContent = navigator.onLine ? 'en ligne' : 'hors-ligne';
    statutConnexion.classList.toggle('hors-ligne', !navigator.onLine);
    synchroniserPointsEnAttente();
  }
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

function initCarte() {
  if (carte) return;
  carte = L.map('carte').setView([46.6, 2.2], 6);

  L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; contributeurs OpenStreetMap'
  }).addTo(carte);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(carte);

  coucheMarqueurs = L.layerGroup().addTo(carte);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => carte.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {}
    );
  }

  demarrerSuiviPosition();
  ajouterControleLocalisation();

  carte.on('click', (e) => {
    if (modeAjoutManuel) {
      if (!zoomStabilisePourPlacement) {
        alert('Le zoom vient de changer, patiente une seconde puis retape sur la carte.');
        return;
      }
      if (carte.getZoom() < ZOOM_MIN_PLACEMENT_MANUEL) {
        alert('Zoome davantage pour placer ce point avec précision.');
        return;
      }
      positionTemporaire = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null, manuel: true };
      desactiverModeAjoutManuel();
      ouvrirModalAjout();
      return;
    }
    // Un clic sur la carte referme les panneaux ouverts (filtre, liste)
    if (!barreFiltre.classList.contains('cache')) {
      barreFiltre.classList.add('cache');
      btnFiltre.classList.remove('actif');
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
        const centrerSur = (lat, lng) => carte.setView([lat, lng], calculerZoomPourEchelle(lat));
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
  const niveaux = [zoomActuel, zoomActuel + 1, zoomActuel + 2].filter(z => z <= 19);

  let tuiles = [];
  niveaux.forEach(z => {
    const xMin = long2tile(bounds.getWest(), z);
    const xMax = long2tile(bounds.getEast(), z);
    const yMin = lat2tile(bounds.getNorth(), z);
    const yMax = lat2tile(bounds.getSouth(), z);
    for (let x = xMin; x <= xMax; x++) for (let y = yMin; y <= yMax; y++) tuiles.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
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

document.getElementById('btn-localiser').addEventListener('click', () => {
  if (!navigator.geolocation) { alert('La géolocalisation n\'est pas disponible sur cet appareil.'); return; }
  const bouton = document.getElementById('btn-localiser');
  bouton.style.opacity = '0.6';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      bouton.style.opacity = '1';
      positionTemporaire = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, manuel: false };
      carte.setView([positionTemporaire.lat, positionTemporaire.lng], 16);
      ouvrirModalAjout();
    },
    (err) => { bouton.style.opacity = '1'; alert('Impossible de récupérer ta position : ' + err.message); },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

const btnPlacementManuel = document.getElementById('btn-placement-manuel');
const bandeauPlacementManuel = document.getElementById('bandeau-placement-manuel');

const ZOOM_MIN_PLACEMENT_MANUEL = 17;
let zoomStabilisePourPlacement = true;

btnPlacementManuel.addEventListener('click', () => {
  modeAjoutManuel = !modeAjoutManuel;
  btnPlacementManuel.classList.toggle('actif', modeAjoutManuel);
  bandeauPlacementManuel.classList.toggle('cache', !modeAjoutManuel);
  document.getElementById('carte').classList.toggle('mode-placement-actif', modeAjoutManuel);

  if (modeAjoutManuel && carte.getZoom() < ZOOM_MIN_PLACEMENT_MANUEL) {
    zoomStabilisePourPlacement = false;
    carte.once('moveend', () => { zoomStabilisePourPlacement = true; });
    carte.setZoom(ZOOM_MIN_PLACEMENT_MANUEL, { animate: false });
  } else {
    zoomStabilisePourPlacement = true;
  }
});

function desactiverModeAjoutManuel() {
  modeAjoutManuel = false;
  btnPlacementManuel.classList.remove('actif');
  bandeauPlacementManuel.classList.add('cache');
  document.getElementById('carte').classList.remove('mode-placement-actif');
}

document.getElementById('btn-importer-gpx').addEventListener('click', () => {
  document.getElementById('fichier-gpx').click();
});

document.getElementById('fichier-gpx').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  if (!fichier) return;
  try {
    const texte = await fichier.text();
    const xml = new DOMParser().parseFromString(texte, 'application/xml');
    const waypoints = Array.from(xml.querySelectorAll('wpt'));
    if (waypoints.length === 0) { alert('Aucun point trouvé dans ce fichier GPX.'); return; }
    if (!confirm(`Importer ${waypoints.length} point(s) depuis ce fichier GPX ?`)) return;

    for (const wpt of waypoints) {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lng = parseFloat(wpt.getAttribute('lon'));
      if (isNaN(lat) || isNaN(lng)) continue;
      const nomBalise = wpt.querySelector('name')?.textContent?.trim();
      const dateBalise = wpt.querySelector('time')?.textContent?.trim();

      const nouveauPoint = {
        lat, lng, accuracy: null,
        mushroomType: nomBalise || 'Autres',
        dateFound: dateBalise ? dateBalise.slice(0, 10) : new Date().toISOString().slice(0, 10),
        notes: 'Importé depuis un fichier GPX',
        createdBy: getPseudo(),
        clientId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      };
      tousLesPoints.push({ point: nouveauPoint, enAttente: true });
      await enregistrerPoint(nouveauPoint);
    }
    construireBarreFiltre();
    rafraichirAffichageCarte();
    alert('Import terminé !');
  } catch (err) {
    alert('Erreur lors de la lecture du fichier GPX.');
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
  if (point.accuracy !== null && point.accuracy !== undefined) {
    return `📍 ${coord} — précision ≈ ${Math.round(point.accuracy)} m`;
  }
  return `📍 ${coord} — position placée manuellement`;
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

async function synchroniserPointsEnAttente(silencieux) {
  if (!groupeCourant) return;
  if (!estEnLigne()) {
    if (!silencieux) alert(modeAvionForce ? 'Désactive le mode avion pour synchroniser.' : 'Toujours hors-ligne : impossible de synchroniser pour le moment.');
    return;
  }

  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length === 0) {
    if (!silencieux) alert('Rien à synchroniser, tout est déjà à jour.');
    return;
  }

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
  chargerPoints(); // recharge toujours, pour retirer de la carte les points désormais synchronisés
}

document.getElementById('btn-synchro-entete').addEventListener('click', () => synchroniserPointsEnAttente(false));

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
      (data.spots || []).forEach(spot => tousLesPoints.push({ point: spot, enAttente: false }));
    } catch (err) {
      console.warn('Impossible de charger les points depuis le serveur.');
    }
  }
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  file.forEach(point => tousLesPoints.push({ point, enAttente: true }));

  construireBarreFiltre();
  rafraichirAffichageCarte();
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

// --- Regroupement en "zones" : coins distants de moins de DISTANCE_ZONE_M ---
const DISTANCE_ZONE_M = 50;

function calculerZones(pointsAvecMeta) {
  const n = pointsAvecMeta.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distanceMetres(pointsAvecMeta[i].point.lat, pointsAvecMeta[i].point.lng, pointsAvecMeta[j].point.lat, pointsAvecMeta[j].point.lng);
      if (d < DISTANCE_ZONE_M) union(i, j);
    }
  }
  const groupes = {};
  for (let i = 0; i < n; i++) {
    const r = find(i);
    (groupes[r] = groupes[r] || []).push(pointsAvecMeta[i]);
  }
  return Object.values(groupes);
}

function filtresActifs() {
  return typesFiltreActifs.size > 0 || moisFiltreActifs.size > 0 || departementsFiltreActifs.size > 0 ||
    rechercheFiltre.value.trim() !== '';
}

function ajusterVueAuxPointsFiltres() {
  const pointsFiltres = calculerPointsFiltres();
  if (filtresActifs() && pointsFiltres.length > 0) {
    const bounds = L.latLngBounds(pointsFiltres.map(({ point }) => [point.lat, point.lng]));
    carte.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }
}

function rafraichirAffichageCarte() {
  coucheMarqueurs.clearLayers();
  const pointsFiltres = calculerPointsFiltres();
  const zones = calculerZones(pointsFiltres);
  zones.forEach(zone => {
    if (zone.length === 1) {
      ajouterMarqueur(zone[0].point, zone[0].enAttente);
    } else {
      ajouterMarqueurZone(zone);
    }
  });

  if (!panneauListe.classList.contains('cache')) construireListe();
}

function ajouterMarqueur(point, enAttente) {
  const nbVersions = (point.history && point.history.length > 0) ? point.history.length + 1 : 0;
  const badge = nbVersions > 0 ? `<span class="badge-nb-maj">${nbVersions}</span>` : '';
  const icone = L.divIcon({
    className: (enAttente ? 'point-en-attente ' : '') + 'marqueur-champi',
    html: `${htmlIcone(point.mushroomType)}${badge}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const marqueur = L.marker([point.lat, point.lng], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => afficherDetailPoint(point));
}

function ajouterMarqueurZone(zone) {
  const latMoy = zone.reduce((s, z) => s + z.point.lat, 0) / zone.length;
  const lngMoy = zone.reduce((s, z) => s + z.point.lng, 0) / zone.length;
  const icone = L.divIcon({
    className: 'marqueur-zone-wrapper',
    html: `<div class="marqueur-zone">${zone.length}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
  const marqueur = L.marker([latMoy, lngMoy], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => afficherZone(zone));
}

function afficherZone(zone) {
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
      afficherDetailPoint(point);
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
  let points = calculerPointsFiltres().map(({ point }) => point);
  const positionActuelle = marqueurPosition ? marqueurPosition.getLatLng() : null;

  if (critere === 'proximite') {
    if (!positionActuelle) { contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Position indisponible pour le tri par proximité.</p>'; return; }
    points.sort((a, b) => distanceMetres(positionActuelle.lat, positionActuelle.lng, a.lat, a.lng) - distanceMetres(positionActuelle.lat, positionActuelle.lng, b.lat, b.lng));
  } else if (critere === 'recent') {
    points.sort((a, b) => new Date(b.dateFound) - new Date(a.dateFound));
  } else if (critere === 'ancien') {
    points.sort((a, b) => new Date(a.dateFound) - new Date(b.dateFound));
  } else if (critere === 'alpha') {
    points.sort((a, b) => a.mushroomType.localeCompare(b.mushroomType));
  }

  contenuListe.innerHTML = '';
  if (points.length === 0) { contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Aucun point à afficher.</p>'; return; }

  points.forEach(point => {
    const item = document.createElement('div');
    item.className = 'item-liste';
    let details = formaterDate(point.dateFound);
    if (critere === 'proximite' && positionActuelle) {
      const d = distanceMetres(positionActuelle.lat, positionActuelle.lng, point.lat, point.lng);
      details += ' · ' + (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
    }
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

function afficherDetailPoint(point) {
  pointActuellementAffiche = point;
  document.getElementById('detail-type').innerHTML = `${htmlIcone(point.mushroomType)} ${point.mushroomType}`;
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
    const l = document.createElement('div');
    l.className = 'historique-entree';
    l.textContent = `📜 ${point.history.length} version(s) précédente(s) de ce point`;
    zoneHistorique.appendChild(l);
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
