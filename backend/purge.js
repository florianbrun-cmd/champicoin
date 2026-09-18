// purge.js
// Purge trimestrielle automatique : supprime DÉFINITIVEMENT les points archivés
// (masqués, généralement via le nettoyage des doublons) créés il y a plus de 3 mois.
// Les points normaux (non archivés) ne sont jamais concernés.
//
// Fonctionne sans dépendance externe de type "cron" : au démarrage du serveur, puis
// une fois par jour, on vérifie si 3 mois se sont écoulés depuis la dernière purge
// (mémorisée en base, donc résistant à un redémarrage du serveur) ; si oui, on purge.

const Spot = require('./models/Spot');
const PurgeLog = require('./models/PurgeLog');

const TROIS_MOIS_MS = 90 * 24 * 60 * 60 * 1000;
const VERIF_QUOTIDIENNE_MS = 24 * 60 * 60 * 1000;

// Supprime définitivement les points archivés créés il y a plus de 3 mois, et met à
// jour la date de dernière purge (utilisée aussi bien en manuel qu'en automatique).
async function executerPurge() {
  const seuil = new Date(Date.now() - TROIS_MOIS_MS);
  const resultat = await Spot.deleteMany({ archive: true, createdAt: { $lt: seuil } });

  let log = await PurgeLog.findOne({ cle: 'purge_archives' });
  if (!log) log = await PurgeLog.create({ cle: 'purge_archives' });
  log.dernierePurgeAt = new Date();
  log.dernierNombreSupprime = resultat.deletedCount || 0;
  await log.save();

  return resultat.deletedCount || 0;
}

async function verifierEtPurgerSiNecessaire() {
  try {
    const log = await PurgeLog.findOne({ cle: 'purge_archives' });
    const derniereFois = log && log.dernierePurgeAt ? log.dernierePurgeAt.getTime() : 0;
    if (Date.now() - derniereFois < TROIS_MOIS_MS) return; // pas encore l'heure

    const nb = await executerPurge();
    console.log(`🧹 Purge trimestrielle automatique : ${nb} point(s) archivé(s) depuis plus de 3 mois supprimé(s) définitivement.`);
  } catch (erreur) {
    console.error('Erreur lors de la purge trimestrielle :', erreur);
  }
}

function demarrerPurgeAutomatique() {
  verifierEtPurgerSiNecessaire(); // vérifie dès le démarrage du serveur
  setInterval(verifierEtPurgerSiNecessaire, VERIF_QUOTIDIENNE_MS); // puis une fois par jour
}

module.exports = { demarrerPurgeAutomatique, verifierEtPurgerSiNecessaire, executerPurge };
