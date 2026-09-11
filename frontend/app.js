// app.js
// Logique principale de Champicoin : carte, géolocalisation, ajout/synchro des points.

const API_BASE = '/api'; // le backend et le frontend sont servis par la même origine

// --- Éléments du DOM ---
const ecranGroupe = document.getElementById('ecran-groupe');
const ecranCarte = document.getElementById('ecran-carte');
const nomGroupeActif = document.getElementById('nom-groupe-actif');
const statutConnexion = document.getElementById('statut-connexion');
const compteurAttente = document.getElementById('compteur-attente');

let carte;
let coucheMarqueurs;
let groupeCourant = null; // { name, code }
let positionTemporaire = null; // dernier point localisé, en attente d'un formulaire
let tousLesPoints = []; // { point, enAttente } — tous les points chargés, avant filtrage
let typeFiltreActif = null; // null = pas de filtre (tout afficher)
const btnFiltre = document.getElementById('btn-filtre');
const barreFiltre = document.getElementById('barre-filtre');

// ==================================================
// 1. GESTION DU GROUPE (connexion / création)
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
  const erreurEl = document.getElementById('erreur-rejoindre');
  erreurEl.textContent = '';

  try {
    const reponse = await fetch(`${API_BASE}/groups/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await reponse.json();
    if (!reponse.ok) {
      erreurEl.textContent = data.error || 'Erreur de connexion.';
      return;
    }
    entrerDansGroupe(data.group);
  } catch (err) {
    erreurEl.textContent = 'Pas de connexion internet. Réessaie une fois en ligne.';
  }
});

document.getElementById('form-creer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('nom-groupe').value.trim();
  const erreurEl = document.getElementById('erreur-creer');
  erreurEl.textContent = '';

  try {
    const reponse = await fetch(`${API_BASE}/groups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await reponse.json();
    if (!reponse.ok) {
      erreurEl.textContent = data.error || 'Erreur de création.';
      return;
    }
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

// ==================================================
// 2. CARTE (Leaflet + OpenStreetMap)
// ==================================================

function initCarte() {
  if (carte) return; // déjà initialisée
  carte = L.map('carte').setView([46.6, 2.2], 6); // vue par défaut : France

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; contributeurs OpenStreetMap'
  }).addTo(carte);

  coucheMarqueurs = L.layerGroup().addTo(carte);

  // Centrer sur la position de l'utilisateur si possible
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => carte.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {} // silencieux si refusé, on garde la vue par défaut
    );
  }
}

// ==================================================
// 3. GÉOLOCALISATION + AJOUT D'UN POINT
// ==================================================

document.getElementById('btn-localiser').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas disponible sur cet appareil.');
    return;
  }

  const bouton = document.getElementById('btn-localiser');
  bouton.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      bouton.textContent = '📍';
      positionTemporaire = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      carte.setView([positionTemporaire.lat, positionTemporaire.lng], 16);
      ouvrirModalAjout();
    },
    (err) => {
      bouton.textContent = '📍';
      alert('Impossible de récupérer ta position : ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

function ouvrirModalAjout() {
  document.getElementById('titre-modal-ajout').textContent = 'Nouveau coin 🍄';
  document.getElementById('id-champignon-edite').value = '';
  document.getElementById('type-champignon').value = '';
  document.getElementById('notes-champignon').value = '';
  document.getElementById('date-trouvee').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modal-ajout').classList.remove('cache');
}

function ouvrirModalModification(point) {
  document.getElementById('titre-modal-ajout').textContent = 'Modifier le coin 🍄';
  document.getElementById('id-champignon-edite').value = point._id || '';
  document.getElementById('type-champignon').value = point.mushroomType;
  document.getElementById('date-trouvee').value = point.dateFound;
  document.getElementById('notes-champignon').value = point.notes || '';
  positionTemporaire = { lat: point.lat, lng: point.lng };
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
  const donneesFormulaire = {
    mushroomType: document.getElementById('type-champignon').value.trim(),
    dateFound: document.getElementById('date-trouvee').value,
    notes: document.getElementById('notes-champignon').value.trim()
  };

  document.getElementById('modal-ajout').classList.add('cache');
  document.getElementById('form-champignon').reset();

  if (idEdite) {
    await modifierPoint(idEdite, donneesFormulaire);
  } else {
    const nouveauPoint = {
      lat: positionTemporaire.lat,
      lng: positionTemporaire.lng,
      ...donneesFormulaire,
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
  if (!navigator.onLine) {
    alert('La modification nécessite une connexion internet.');
    return;
  }
  try {
    const reponse = await fetch(`${API_BASE}/spots/${id}?groupCode=${encodeURIComponent(groupeCourant.code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...donnees, groupCode: groupeCourant.code })
    });
    if (!reponse.ok) throw new Error('Échec de la modification');
    chargerPoints();
  } catch (err) {
    alert('Impossible de modifier ce point pour le moment. Réessaie plus tard.');
  }
}

// ==================================================
// 4. SYNCHRONISATION (en ligne / hors-ligne)
// ==================================================

async function enregistrerPoint(point) {
  if (!navigator.onLine) {
    ajouterAFileDAttente(point);
    return;
  }

  try {
    const reponse = await fetch(`${API_BASE}/spots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...point, groupCode: groupeCourant.code })
    });
    if (!reponse.ok) throw new Error('Échec serveur');
  } catch (err) {
    // Le réseau a lâché entre-temps : on met en attente
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
  if (!navigator.onLine || !groupeCourant) return;

  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length === 0) return;

  const restants = [];
  for (const point of file) {
    try {
      const reponse = await fetch(`${API_BASE}/spots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...point, groupCode: groupeCourant.code })
      });
      if (!reponse.ok) restants.push(point);
    } catch (err) {
      restants.push(point);
    }
  }

  localStorage.setItem('champicoin_file_attente', JSON.stringify(restants));
  mettreAJourBadgeAttente();
  if (restants.length === 0) chargerPoints(); // recharge pour avoir les vrais IDs serveur
}

function mettreAJourBadgeAttente() {
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  if (file.length > 0) {
    compteurAttente.textContent = `${file.length} point(s) en attente de synchro`;
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
// 5. AFFICHAGE DES POINTS SUR LA CARTE
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

  // On affiche aussi les points encore en attente de synchro
  const file = JSON.parse(localStorage.getItem('champicoin_file_attente') || '[]');
  file.forEach(point => tousLesPoints.push({ point, enAttente: true }));

  construireBarreFiltre();
  rafraichirAffichageCarte();
}

function rafraichirAffichageCarte() {
  coucheMarqueurs.clearLayers();
  const aAfficher = typeFiltreActif
    ? tousLesPoints.filter(({ point }) => point.mushroomType === typeFiltreActif)
    : tousLesPoints;

  aAfficher.forEach(({ point, enAttente }) => ajouterMarqueur(point, enAttente));
}

function ajouterMarqueur(point, enAttente) {
  const icone = L.divIcon({
    className: enAttente ? 'point-en-attente' : '',
    html: '🍄',
    iconSize: [28, 28]
  });

  const marqueur = L.marker([point.lat, point.lng], { icon: icone }).addTo(coucheMarqueurs);

  marqueur.on('click', () => {
    afficherDetailPoint(point);
  });
}

// --- Filtre par type de champignon ---

function construireBarreFiltre() {
  const typesUniques = [...new Set(tousLesPoints.map(({ point }) => point.mushroomType))].sort();

  barreFiltre.innerHTML = '';

  if (typesUniques.length === 0) return;

  // Si le type actuellement filtré n'existe plus dans les points, on réinitialise
  if (typeFiltreActif && !typesUniques.includes(typeFiltreActif)) {
    typeFiltreActif = null;
  }

  const puceTout = document.createElement('button');
  puceTout.className = 'puce-filtre' + (typeFiltreActif === null ? ' actif' : '');
  puceTout.textContent = 'Tous';
  puceTout.addEventListener('click', () => {
    typeFiltreActif = null;
    construireBarreFiltre();
    rafraichirAffichageCarte();
  });
  barreFiltre.appendChild(puceTout);

  typesUniques.forEach(type => {
    const puce = document.createElement('button');
    puce.className = 'puce-filtre' + (typeFiltreActif === type ? ' actif' : '');
    puce.textContent = type;
    puce.addEventListener('click', () => {
      typeFiltreActif = type;
      construireBarreFiltre();
      rafraichirAffichageCarte();
    });
    barreFiltre.appendChild(puce);
  });
}

btnFiltre.addEventListener('click', () => {
  barreFiltre.classList.toggle('cache');
  btnFiltre.classList.toggle('actif');
});

function afficherDetailPoint(point) {
  document.getElementById('detail-type').textContent = point.mushroomType;
  document.getElementById('detail-date').textContent = formaterDate(point.dateFound);
  document.getElementById('detail-notes').textContent = point.notes || '';

  const btnSupprimer = document.getElementById('btn-supprimer-point');
  btnSupprimer.onclick = async () => {
    if (!point._id) {
      alert('Ce point n\'est pas encore synchronisé, réessaie une fois en ligne.');
      return;
    }
    if (!confirm('Supprimer ce coin ?')) return;
    await fetch(`${API_BASE}/spots/${point._id}?groupCode=${encodeURIComponent(groupeCourant.code)}`, {
      method: 'DELETE'
    });
    document.getElementById('modal-detail').classList.add('cache');
    chargerPoints();
  };

  document.getElementById('btn-modifier-point').onclick = () => {
    if (!point._id) {
      alert('Ce point n\'est pas encore synchronisé, réessaie une fois en ligne.');
      return;
    }
    ouvrirModalModification(point);
  };

  document.getElementById('modal-detail').classList.remove('cache');
}

document.getElementById('btn-fermer-detail').addEventListener('click', () => {
  document.getElementById('modal-detail').classList.add('cache');
});

function formaterDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ==================================================
// 6. DÉMARRAGE DE L'APPLICATION
// ==================================================

// Reprendre le groupe déjà enregistré localement, si présent
const groupeSauvegarde = localStorage.getItem('champicoin_groupe');
if (groupeSauvegarde) {
  entrerDansGroupe(JSON.parse(groupeSauvegarde));
}

mettreAJourBadgeAttente();

if (!navigator.onLine) {
  statutConnexion.textContent = 'hors-ligne';
  statutConnexion.classList.add('hors-ligne');
}

// Enregistrement du Service Worker (mode hors-ligne)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}
