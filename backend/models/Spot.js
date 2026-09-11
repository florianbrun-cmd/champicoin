// models/Spot.js
const mongoose = require('mongoose');

const spotSchema = new mongoose.Schema({
  groupCode: { type: String, required: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  mushroomType: { type: String, required: true },
  dateFound: { type: String, required: true }, // format YYYY-MM-DD
  notes: { type: String, default: '' },
  clientId: { type: String, default: null }, // identifiant local côté app, pour la synchro
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Spot', spotSchema);
