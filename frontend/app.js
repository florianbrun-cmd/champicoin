// app.js
// Logique principale de Champicoin.

const API_BASE = '/api';

// --- Correspondance type de champignon -> icône dessinée ---
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
  'Lactaire Améthyste': 'lactaire_amethyste'
};
const ICONES_CONNUES = new Set([...Object.values(TYPE_VERS_ICONE), 'autre']);

function iconePourType(type) {
  return TYPE_VERS_ICONE[type] || 'autre';
}

function urlIcone(cle) {
  return `icons/champignons/${cle}.png`;
}

// Construit le HTML d'une icône de champignon (image si connue, sinon texte brut pour compat. anciennes données)
function htmlIcone(icone) {
  if (icone && ICONES_CONNUES.has(icone)) {
    return `<img src="${urlIcone(icone)}" alt="">`;
  }
  return icone || '🍄';
}

// --- Éléments du DOM ---
const ecranGroupe = document.getElementById('ecran-groupe');
const ecranCarte = document.getElementById('ecran-carte');
const nomGroupeActif = document.getElementById('nom-groupe-actif');
const statutConnexion = document.getElementById('statut-connexion');
const compteurAttente = document.getElementById('compteur-attente');
const texteCompteurAttente = document.getElementById('texte-compteur-attente');

let carte;
let coucheMarqueurs;
let marqueurPosition = null;
let groupeCourant = null;
let positionTemporaire = null;
let tousLesPoints = [];
let typesFiltreActifs = new Set();
let modeAjoutManuel = false;

const btnFiltre = document.getElementById('btn-filtre');
const barreFiltre = document.getElementById('barre-filtre');
const pucesFiltre = document.getElementById('puces-filtre');
const rechercheFiltre = document.getElementById('recherche-filtre');
const btnListe = document.getElementById('btn-liste');
const panneauListe = document.getElementById('panneau-liste');
const contenuListe = document.getElementById('contenu-liste');
const triListe = document.getElementById('tri-liste');

// ==================================================
// 0. PSEUDO
// ==================================================

function getPseudo() {
  return localStorage.getItem('champicoin_pseudo') || '';
}
function setPseudo(pseudo) {
  localStorage.setItem('champicoin_pseudo', pseudo.trim());
}

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
  const erreurEl = document.getElementById('erreur-creer');
  erreurEl.textContent = '';
  try {
    const reponse = await fetch(`${API_BASE}/groups/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    const data = await reponse.json();
    if (!reponse.ok) { erreurEl.textContent = data.error || 'Erreur de création.'; return; }
    setPseudo(pseudo);
    alert(`Groupe créé ! Voici le code à partager : ${data.group.code}`);
    entrerDansGroupe(data.group);
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
  synchroniserPointsEnAttente();
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
  if (!navigator.onLine) { alert('Renommer un groupe nécessite une connexion internet.'); return; }
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

// ==================================================
// 2. CARTE
// ==================================================

// mètres par pixel visés pour l'échelle "1 cm pour 100 m" (référence CSS : 96px/pouce)
const METRES_PAR_PIXEL_CIBLE = 100 / 37.8;

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
    if (!modeAjoutManuel) return;
    positionTemporaire = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: null, manuel: true };
    desactiverModeAjoutManuel();
    ouvrirModalAjout();
  });
}

function demarrerSuiviPosition() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (!marqueurPosition) {
        const icone = L.divIcon({ className: 'marqueur-ma-position', iconSize: [18, 18] });
        marqueurPosition = L.marker(latlng, { icon: icone, zIndexOffset: 1000 }).addTo(carte);
      } else {
        marqueurPosition.setLatLng(latlng);
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
        const centrerSur = (lat, lng) => {
          const zoom = calculerZoomPourEchelle(lat);
          carte.setView([lat, lng], zoom);
        };
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

// --- Téléchargement de la zone visible pour un usage hors-ligne ---
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
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tuiles.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  });

  if (tuiles.length > 500) {
    if (!confirm(`Cette zone représente ${tuiles.length} tuiles à télécharger, ça peut prendre du temps et consommer des données. Continuer ?`)) return;
  } else if (tuiles.length === 0) {
    alert('Zoom insuffisant pour déterminer une zone à télécharger.');
    return;
  }

  bouton.classList.add('telechargement-en-cours');
  const texteInitial = bouton.title;

  const taillePaquet = 6;
  for (let i = 0; i < tuiles.length; i += taillePaquet) {
    const paquet = tuiles.slice(i, i + taillePaquet);
    await Promise.all(paquet.map(url => fetch(url, { mode: 'no-cors' }).catch(() => {})));
    bouton.title = `Téléchargement... ${Math.min(i + taillePaquet, tuiles.length)}/${tuiles.length}`;
  }

  bouton.classList.remove('telechargement-en-cours');
  bouton.title = texteInitial;
  alert(`Zone téléchargée (${tuiles.length} tuiles) : elle reste consultable hors-ligne.`);
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

btnPlacementManuel.addEventListener('click', () => {
  modeAjoutManuel = !modeAjoutManuel;
  btnPlacementManuel.classList.toggle('actif', modeAjoutManuel);
  bandeauPlacementManuel.classList.toggle('cache', !modeAjoutManuel);
});

function desactiverModeAjoutManuel() {
  modeAjoutManuel = false;
  btnPlacementManuel.classList.remove('actif');
  bandeauPlacementManuel.classList.add('cache');
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
        icon: 'autre',
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
  mettreAJourApercuIcone(e.target.value === 'autre' ? 'autre' : iconePourType(e.target.value));
});

function mettreAJourApercuIcone(cle) {
  document.getElementById('icone-champignon').value = cle;
  document.getElementById('apercu-icone-type').src = urlIcone(cle);
}

function selectionnerTypeChampignon(type) {
  const selecteur = document.getElementById('type-champignon');
  const champAutre = document.getElementById('type-champignon-autre');
  const optionExiste = Array.from(selecteur.options).some(o => o.value === type);
  if (optionExiste) {
    selecteur.value = type;
    champAutre.classList.add('cache');
    champAutre.value = '';
    mettreAJourApercuIcone(iconePourType(type));
  } else {
    selecteur.value = 'autre';
    champAutre.classList.remove('cache');
    champAutre.value = type;
    mettreAJourApercuIcone('autre');
  }
}

// --- Format des coordonnées : N/S DD°MM.MMM  E/W DDD°MM.MMM ---
function formaterCoordDMM(lat, lng) {
  function conv(valeur, chiffresDegres, positif, negatif) {
    const hemisphere = valeur >= 0 ? positif : negatif;
    const abs = Math.abs(valeur);
    const degres = Math.floor(abs);
    const minutes = (abs - degres) * 60;
    const degresTxt = String(degres).padStart(chiffresDegres, '0');
    const minutesTxt = minutes.toFixed(3).padStart(6, '0');
    return `${hemisphere}${degresTxt}°${minutesTxt}`;
  }
  return `${conv(lat, 2, 'N', 'S')} ${conv(lng, 3, 'E', 'W')}`;
}

function texteCoordonnees(point) {
  if (!point) return '';
  const coord = formaterCoordDMM(point.lat, point.lng);
  if (point.accuracy) return `📍 ${coord} — précision ≈ ${Math.round(point.accuracy)} m`;
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
  mettreAJourApercuIcone('autre');
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
    notes: document.getElementById('notes-champignon').value.trim(),
    icon: document.getElementById('icone-champignon').value || 'autre'
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
  if (!navigator.onLine) { alert('La modification nécessite une connexion internet.'); return; }
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
  if (!navigator.onLine) { ajouterAFileDAttente(point); return; }
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

async function synchroniserPointsEnAttente() {
  if (!groupeCourant) return;
  if (!navigator.onLine) {
    alert('Toujours hors-ligne : impossible de synchroniser pour le moment.');
    return;
  }

  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length === 0) return;

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
  if (restants.length === 0) chargerPoints();
}

document.getElementById('btn-forcer-synchro').addEventListener('click', synchroniserPointsEnAttente);

function mettreAJourBadgeAttente() {
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length > 0) {
    texteCompteurAttente.textContent = `${file.length} point(s) en attente de synchro`;
    compteurAttente.classList.remove('cache');
  } else {
    compteurAttente.classList.add('cache');
  }
}

window.addEventListener('online', () => {
  statutConnexion.textContent = 'en ligne';
  statutConnexion.classList.remove('hors-ligne');
  synchroniserPointsEnAttente();
});

window.addEventListener('offline', () => {
  statutConnexion.textContent = 'hors-ligne';
  statutConnexion.classList.add('hors-ligne');
});

// ==================================================
// 5. AFFICHAGE, FILTRE & LISTE TRIABLE
// ==================================================

async function chargerPoints() {
  tousLesPoints = [];
  if (navigator.onLine) {
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
    return true;
  });
}

function rafraichirAffichageCarte() {
  coucheMarqueurs.clearLayers();
  calculerPointsFiltres().forEach(({ point, enAttente }) => ajouterMarqueur(point, enAttente));
  if (!panneauListe.classList.contains('cache')) construireListe();
}

function ajouterMarqueur(point, enAttente) {
  const nbVersions = (point.history && point.history.length > 0) ? point.history.length + 1 : 0;
  const badge = nbVersions > 0 ? `<span class="badge-nb-maj">${nbVersions}</span>` : '';
  const icone = L.divIcon({
    className: (enAttente ? 'point-en-attente ' : '') + 'marqueur-champi',
    html: `${htmlIcone(point.icon)}${badge}`,
    iconSize: [28, 28]
  });
  const marqueur = L.marker([point.lat, point.lng], { icon: icone }).addTo(coucheMarqueurs);
  marqueur.on('click', () => afficherDetailPoint(point));
}

function construireBarreFiltre() {
  const typesUniques = [...new Set(tousLesPoints.map(({ point }) => point.mushroomType))].sort();
  pucesFiltre.innerHTML = '';
  if (typesUniques.length === 0) return;

  typesFiltreActifs.forEach(t => { if (!typesUniques.includes(t)) typesFiltreActifs.delete(t); });

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (typesFiltreActifs.size === 0 ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => {
    typesFiltreActifs.clear();
    construireBarreFiltre();
    rafraichirAffichageCarte();
  });
  pucesFiltre.appendChild(puceTout);

  typesUniques.forEach(type => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (typesFiltreActifs.has(type) ? ' actif' : '');
    puce.textContent = type;
    puce.addEventListener('click', () => {
      if (typesFiltreActifs.has(type)) typesFiltreActifs.delete(type); else typesFiltreActifs.add(type);
      construireBarreFiltre();
      rafraichirAffichageCarte();
    });
    pucesFiltre.appendChild(puce);
  });
}

btnFiltre.addEventListener('click', () => {
  barreFiltre.classList.toggle('cache');
  btnFiltre.classList.toggle('actif');
});
rechercheFiltre.addEventListener('input', () => rafraichirAffichageCarte());

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function construireListe() {
  const critere = triListe.value;
  let points = calculerPointsFiltres().map(({ point }) => point);
  const positionActuelle = marqueurPosition ? marqueurPosition.getLatLng() : null;

  if (critere === 'proximite') {
    if (!positionActuelle) {
      contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Position indisponible pour le tri par proximité.</p>';
      return;
    }
    points.sort((a, b) => distanceMetres(positionActuelle.lat, positionActuelle.lng, a.lat, a.lng) - distanceMetres(positionActuelle.lat, positionActuelle.lng, b.lat, b.lng));
  } else if (critere === 'recent') {
    points.sort((a, b) => new Date(b.dateFound) - new Date(a.dateFound));
  } else if (critere === 'ancien') {
    points.sort((a, b) => new Date(a.dateFound) - new Date(b.dateFound));
  } else if (critere === 'alpha') {
    points.sort((a, b) => a.mushroomType.localeCompare(b.mushroomType));
  }

  contenuListe.innerHTML = '';
  if (points.length === 0) {
    contenuListe.innerHTML = '<p style="padding:16px;color:#888;">Aucun point à afficher.</p>';
    return;
  }

  points.forEach(point => {
    const item = document.createElement('div');
    item.className = 'item-liste';
    let details = formaterDate(point.dateFound);
    if (critere === 'proximite' && positionActuelle) {
      const d = distanceMetres(positionActuelle.lat, positionActuelle.lng, point.lat, point.lng);
      details += ' · ' + (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
    }
    item.innerHTML = `
      <div class="item-liste-icone">${htmlIcone(point.icon)}</div>
      <div class="item-liste-texte">
        <div class="item-liste-type">${point.mushroomType}</div>
        <div class="item-liste-details">${details}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      carte.setView([point.lat, point.lng], 17);
      panneauListe.classList.add('cache');
      afficherDetailPoint(point);
    });
    contenuListe.appendChild(item);
  });
}

btnListe.addEventListener('click', () => {
  panneauListe.classList.toggle('cache');
  if (!panneauListe.classList.contains('cache')) construireListe();
});
document.getElementById('btn-fermer-liste').addEventListener('click', () => {
  panneauListe.classList.add('cache');
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

function afficherDetailPoint(point) {
  document.getElementById('detail-type').innerHTML = `${htmlIcone(point.icon)} ${point.mushroomType}`;
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

document.getElementById('btn-fermer-detail').addEventListener('click', () => {
  document.getElementById('modal-detail').classList.add('cache');
});

// ==================================================
// 7. DÉMARRAGE
// ==================================================

const groupeSauvegarde = localStorage.getItem('champicoin_groupe');
if (groupeSauvegarde) entrerDansGroupe(JSON.parse(groupeSauvegarde));

mettreAJourBadgeAttente();

if (!navigator.onLine) {
  statutConnexion.textContent = 'hors-ligne';
  statutConnexion.classList.add('hors-ligne');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}
