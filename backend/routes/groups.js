// routes/groups.js
// Gestion des groupes privés : création et adhésion via code d'accès.

const express = require('express');
const router = express.Router();
const Group = require('../models/Group');

// Génère un code lisible du type "CEPE-4821"
function generateCode() {
  const mots = ['CEPE', 'MORILLE', 'CHANTERELLE', 'BOLET', 'AMANITE', 'TRUFFE', 'RUSSULE', 'PIED-BLEU'];
  const mot = mots[Math.floor(Math.random() * mots.length)];
  const chiffres = Math.floor(1000 + Math.random() * 9000);
  return `${mot}-${chiffres}`;
}

// Créer un nouveau groupe privé
router.post('/create', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du groupe est requis.' });
    }

    let code;
    let existe = true;
    while (existe) {
      code = generateCode();
      existe = await Group.findOne({ code });
    }

    const groupe = await Group.create({ name: name.trim(), code });
    res.json({ group: groupe });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Rejoindre un groupe existant avec un code
router.post('/join', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code requis.' });
    }

    const groupe = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!groupe) {
      return res.status(404).json({ error: 'Code invalide, groupe introuvable.' });
    }

    res.json({ group: groupe });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
