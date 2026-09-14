// routes/groups.js
// Gestion des groupes privés : création et adhésion via code d'accès.

const express = require('express');
const router = express.Router();
const Group = require('../models/Group');

// Limiteur très simple contre l'énumération de pseudos : max 5 recherches / 10 min / IP.
// (Ce n'est pas une vraie authentification — voir le README pour les limites de sécurité.)
const tentativesRecherche = new Map(); // ip -> [timestamps]
function trafiqueAutorise(ip) {
  const maintenant = Date.now();
  const fenetre = 10 * 60 * 1000;
  const historique = (tentativesRecherche.get(ip) || []).filter(t => maintenant - t < fenetre);
  if (historique.length >= 5) return false;
  historique.push(maintenant);
  tentativesRecherche.set(ip, historique);
  return true;
}

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

// Renommer un groupe existant
router.put('/rename', async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name || !name.trim()) {
      return res.status(400).json({ error: 'Code et nouveau nom requis.' });
    }

    const groupe = await Group.findOneAndUpdate(
      { code: code.trim().toUpperCase() },
      { name: name.trim() },
      { new: true }
    );

    if (!groupe) return res.status(404).json({ error: 'Groupe introuvable.' });

    res.json({ group: groupe });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Signaler sa présence dans un groupe (pour la liste des membres)
router.post('/presence', async (req, res) => {
  try {
    const { code, pseudo } = req.body;
    if (!code || !pseudo) return res.status(400).json({ error: 'Code et pseudo requis.' });

    const groupe = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!groupe) return res.status(404).json({ error: 'Groupe introuvable.' });

    const membreExistant = groupe.members.find(m => m.pseudo === pseudo);
    if (membreExistant) {
      membreExistant.lastSeenAt = new Date();
    } else {
      groupe.members.push({ pseudo, lastSeenAt: new Date() });
    }
    await groupe.save();
    res.json({ success: true });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Lister les membres connus d'un groupe
router.get('/members', async (req, res) => {
  try {
    const { code } = req.query;
    const groupe = await Group.findOne({ code: (code || '').trim().toUpperCase() });
    if (!groupe) return res.status(404).json({ error: 'Groupe introuvable.' });

    const membres = [...groupe.members].sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    res.json({ members: membres });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Retrouver les groupes associés à un pseudo (en cas de code oublié)
router.get('/find-by-pseudo', async (req, res) => {
  try {
    const pseudo = (req.query.pseudo || '').trim();
    if (pseudo.length < 3) return res.status(400).json({ error: 'Indique au moins 3 caractères.' });

    const ip = req.ip || req.connection.remoteAddress || 'inconnu';
    if (!trafiqueAutorise(ip)) {
      return res.status(429).json({ error: 'Trop de tentatives, réessaie dans quelques minutes.' });
    }

    const groupes = await Group.find({ 'members.pseudo': new RegExp(`^${pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    res.json({ groups: groupes.map(g => ({ name: g.name, code: g.code })) });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
