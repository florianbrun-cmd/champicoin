// routes/spots.js
// Gestion des points (coins à champignons) : création, liste, modification (avec historique), suppression.
// Chaque point est rattaché à un groupCode : seuls les membres du groupe le voient.

const express = require('express');
const router = express.Router();
const Spot = require('../models/Spot');
const Group = require('../models/Group');

async function verifierGroupe(code) {
  if (!code) return null;
  return Group.findOne({ code: code.trim().toUpperCase() });
}

// Récupérer tous les points d'un groupe
router.get('/', async (req, res) => {
  try {
    const { groupCode } = req.query;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    const spots = await Spot.find({ groupCode: groupe.code });
    res.json({ spots });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Ajouter un nouveau point
router.post('/', async (req, res) => {
  try {
    const { groupCode, lat, lng, accuracy, elevation, mushroomType, icon, dateFound, notes, clientId, author } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    if (lat === undefined || lng === undefined || !mushroomType) {
      return res.status(400).json({ error: 'Position et type de champignon requis.' });
    }

    // Idempotence : si ce clientId a déjà été enregistré pour ce groupe (retransmission,
    // synchro en double, plusieurs onglets...), on renvoie le point existant plutôt que
    // d'en créer un doublon. C'est la protection la plus fiable contre les doublons, car
    // elle tient quelle que soit la cause côté navigateur.
    if (clientId) {
      const dejaExistant = await Spot.findOne({ groupCode: groupe.code, clientId });
      if (dejaExistant) {
        return res.json({ spot: dejaExistant });
      }
    }

    const maintenant = new Date();

    const spot = await Spot.create({
      groupCode: groupe.code,
      lat,
      lng,
      accuracy: (accuracy === undefined || accuracy === null) ? null : accuracy,
      elevation: (elevation === undefined || elevation === null) ? null : elevation,
      mushroomType,
      icon: icon || '🍄',
      dateFound: dateFound || maintenant.toISOString().slice(0, 10),
      notes: notes || '',
      clientId: clientId || null,
      createdBy: author || '',
      updatedBy: author || '',
      updatedAt: maintenant
    });

    res.json({ spot });
  } catch (erreur) {
    if (erreur.code === 11000) {
      // Conflit avec l'index unique (deux requêtes quasi simultanées pour le même point,
      // même clientId) : ce n'est pas une vraie erreur, on renvoie le point déjà créé.
      const spotExistant = await Spot.findOne({ groupCode: req.body.groupCode, clientId: req.body.clientId });
      if (spotExistant) return res.json({ spot: spotExistant });
    }
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Modifier un point existant : conserve l'ancienne version dans l'historique
router.put('/:id', async (req, res) => {
  try {
    const { groupCode, lat, lng, mushroomType, icon, dateFound, notes, author } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    if (!mushroomType) {
      return res.status(400).json({ error: 'Le type de champignon est requis.' });
    }

    const spotExistant = await Spot.findOne({ _id: req.params.id, groupCode: groupe.code });
    if (!spotExistant) return res.status(404).json({ error: 'Point introuvable.' });

    // On archive l'état précédent dans l'historique avant d'écraser
    const ancienneVersion = {
      mushroomType: spotExistant.mushroomType,
      icon: spotExistant.icon,
      dateFound: spotExistant.dateFound,
      notes: spotExistant.notes,
      updatedBy: spotExistant.updatedBy,
      updatedAt: spotExistant.updatedAt
    };

    const maintenant = new Date();
    const misAJour = {
      mushroomType,
      dateFound,
      notes: notes || '',
      icon: icon || '🍄',
      updatedBy: author || '',
      updatedAt: maintenant,
      $push: undefined // placeholder, remplacé ci-dessous via updateOne
    };
    delete misAJour.$push;

    if (lat !== undefined && lng !== undefined) {
      misAJour.lat = lat;
      misAJour.lng = lng;
    }

    const spot = await Spot.findOneAndUpdate(
      { _id: req.params.id, groupCode: groupe.code },
      { $set: misAJour, $push: { history: ancienneVersion } },
      { new: true }
    );

    res.json({ spot });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Supprimer un point
router.delete('/:id', async (req, res) => {
  try {
    const { groupCode } = req.query;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    await Spot.deleteOne({ _id: req.params.id, groupCode: groupe.code });
    res.json({ success: true });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Renseigne l'altitude d'un point existant qui ne l'a pas encore (rattrapage),
// sans toucher à l'historique puisqu'il ne s'agit pas d'une modification par un utilisateur.
router.patch('/:id/elevation', async (req, res) => {
  try {
    const { groupCode, elevation } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });
    if (elevation === undefined || elevation === null) {
      return res.status(400).json({ error: 'Altitude requise.' });
    }

    const spot = await Spot.findOneAndUpdate(
      { _id: req.params.id, groupCode: groupe.code },
      { $set: { elevation } },
      { new: true }
    );
    if (!spot) return res.status(404).json({ error: 'Point introuvable.' });
    res.json({ spot });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Import groupé : reçoit un lot de points en une seule requête, bien plus rapide que
// de les envoyer un par un (utile pour un import GPX/photos de plusieurs centaines de points).
router.post('/bulk', async (req, res) => {
  try {
    const { groupCode, points } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });
    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'Aucun point à importer.' });
    }

    const maintenant = new Date();
    const documents = points
      .filter(p => p.lat !== undefined && p.lng !== undefined && p.mushroomType)
      .map(p => ({
        groupCode: groupe.code,
        lat: p.lat,
        lng: p.lng,
        accuracy: (p.accuracy === undefined || p.accuracy === null) ? null : p.accuracy,
        elevation: (p.elevation === undefined || p.elevation === null) ? null : p.elevation,
        mushroomType: p.mushroomType,
        icon: p.icon || '🍄',
        dateFound: p.dateFound || maintenant.toISOString().slice(0, 10),
        notes: p.notes || '',
        clientId: p.clientId || null,
        createdBy: p.author || '',
        updatedBy: p.author || '',
        updatedAt: maintenant
      }));

    let inseres = [];
    let doublons = 0;
    try {
      inseres = await Spot.insertMany(documents, { ordered: false });
    } catch (erreurBulk) {
      // Avec ordered:false, un document en conflit avec l'index unique (clientId déjà connu)
      // échoue individuellement sans bloquer les autres : Mongoose renvoie ceux qui ont réussi.
      inseres = erreurBulk.insertedDocs || [];
      doublons = documents.length - inseres.length;
    }

    res.json({ inseres: inseres.length, doublons });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
