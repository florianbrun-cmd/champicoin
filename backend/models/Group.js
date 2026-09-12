// models/Group.js
const mongoose = require('mongoose');

const membreSchema = new mongoose.Schema({
  pseudo: String,
  lastSeenAt: { type: Date, default: Date.now }
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true },
  members: { type: [membreSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
