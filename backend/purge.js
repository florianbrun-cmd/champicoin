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

async function verifierEtPurgerSiNecessaire() {
  try {
    let log = await PurgeLog.findOne({ cle: 'purge_archives' });
    if (!log) log = await PurgeLog.create({ cle: 'purge_archives' });

    const maintenant = Date.now();
    const derniereFois = log.dernierePurgeAt ? log.dernierePurgeAt.getTime() : 0;
    if (maintenant - derniereFois < TROIS_MOIS_MS) return; // pas encore l'heure

    const seuil = new Date(maintenant - TROIS_MOIS_MS);
    const resultat = await Spot.deleteMany({ archive: true, createdAt: { $lt: seuil } });

    log.dernierePurgeAt = new Date();
    log.dernierNombreSupprime = resultat.deletedCount || 0;
    await log.save();

    console.log(`🧹 Purge trimestrielle : ${resultat.deletedCount || 0} point(s) archivé(s) depuis plus de 3 mois supprimé(s) définitivement.`);
  } catch (erreur) {
    console.error('Erreur lors de la purge trimestrielle :', erreur);
  }
}

function demarrerPurgeAutomatique() {
  verifierEtPurgerSiNecessaire(); // vérifie dès le démarrage du serveur
  setInterval(verifierEtPurgerSiNecessaire, VERIF_QUOTIDIENNE_MS); // puis une fois par jour
}

module.exports = { demarrerPurgeAutomatique, verifierEtPurgerSiNecessaire };
