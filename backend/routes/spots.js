// routes/spots.js
// Gestion des points (coins à champignons) : création, liste, suppression.
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
    const { groupCode, lat, lng, mushroomType, dateFound, notes, clientId } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    if (lat === undefined || lng === undefined || !mushroomType) {
      return res.status(400).json({ error: 'Position et type de champignon requis.' });
    }

    const spot = await Spot.create({
      groupCode: groupe.code,
      lat,
      lng,
      mushroomType,
      dateFound: dateFound || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      clientId: clientId || null
    });

    res.json({ spot });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Modifier un point existant
router.put('/:id', async (req, res) => {
  try {
    const { groupCode, lat, lng, mushroomType, dateFound, notes } = req.body;
    const groupe = await verifierGroupe(groupCode);
    if (!groupe) return res.status(403).json({ error: 'Code de groupe invalide.' });

    if (!mushroomType) {
      return res.status(400).json({ error: 'Le type de champignon est requis.' });
    }

    const misAJour = { mushroomType, dateFound, notes: notes || '' };
    // On permet aussi d'ajuster la position, si fournie
    if (lat !== undefined && lng !== undefined) {
      misAJour.lat = lat;
      misAJour.lng = lng;
    }

    const spot = await Spot.findOneAndUpdate(
      { _id: req.params.id, groupCode: groupe.code },
      misAJour,
      { new: true }
    );

    if (!spot) return res.status(404).json({ error: 'Point introuvable.' });

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
