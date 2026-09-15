// models/Spot.js
const mongoose = require('mongoose');

// Représente une ancienne version d'un point, conservée à chaque modification
const versionSchema = new mongoose.Schema({
  mushroomType: String,
  icon: String,
  dateFound: String,
  notes: String,
  updatedBy: String,
  updatedAt: Date
}, { _id: false });

const spotSchema = new mongoose.Schema({
  groupCode: { type: String, required: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number, default: null }, // précision GPS en mètres (null si placé manuellement)
  elevation: { type: Number, default: null }, // altitude en mètres, récupérée automatiquement
  mushroomType: { type: String, required: true },
  icon: { type: String, default: '🍄' },
  dateFound: { type: String, required: true }, // format YYYY-MM-DD
  notes: { type: String, default: '' },
  clientId: { type: String, default: null },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  history: { type: [versionSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Spot', spotSchema);
