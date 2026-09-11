// server.js
// Point d'entrée du serveur Champicoin.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { connecterBaseDeDonnees } = require('./db');
const groupsRoutes = require('./routes/groups');
const spotsRoutes = require('./routes/spots');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API
app.use('/api/groups', groupsRoutes);
app.use('/api/spots', spotsRoutes);

// Sert le frontend (PWA) directement depuis le même serveur
app.use(express.static(path.join(__dirname, '..', 'frontend')));

async function demarrer() {
  await connecterBaseDeDonnees();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍄 Champicoin est lancé sur le port ${PORT}`);
  });
}

demarrer();
