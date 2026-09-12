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
    const { groupCode, lat, lng, accuracy, mushroomType, icon, dateFound, notes, clientId, author } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    if (lat === undefined || lng === undefined || !mushroomType) {
      return res.status(400).json({ error: 'Position et type de champignon requis.' });
    }

    const maintenant = new Date();

    const spot = await Spot.create({
      groupCode: groupe.code,
      lat,
      lng,
      accuracy: (accuracy === undefined || accuracy === null) ? null : accuracy,
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

module.exports = router;
