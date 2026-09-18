// models/PurgeLog.js
// Un unique document qui garde la trace de la dernière purge automatique des
// points archivés, pour savoir quand la prochaine est due (même après un
// redémarrage du serveur).
const mongoose = require('mongoose');

const purgeLogSchema = new mongoose.Schema({
  cle: { type: String, unique: true, default: 'purge_archives' },
  dernierePurgeAt: { type: Date, default: null },
  dernierNombreSupprime: { type: Number, default: 0 }
});

module.exports = mongoose.model('PurgeLog', purgeLogSchema);
