// db.js
// Connexion à la base de données MongoDB Atlas (offre gratuite M0).
// L'adresse de connexion est lue depuis la variable d'environnement MONGODB_URI,
// définie sur Render (ou dans un fichier .env en local) — jamais écrite en dur ici.

const mongoose = require('mongoose');

async function connecterBaseDeDonnees() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ La variable d\'environnement MONGODB_URI est manquante.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅ Connecté à MongoDB Atlas');
  } catch (erreur) {
    console.error('❌ Échec de connexion à MongoDB :', erreur.message);
    process.exit(1);
  }
}

module.exports = { connecterBaseDeDonnees };
