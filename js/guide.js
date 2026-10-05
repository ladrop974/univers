// Guide rapide affiché après la création d'une planète, adapté à la tranche d'âge. Données pures (testées).
const S = (h, p) => ({ h, p });

export function quickGuide(band, planetName = "ta planète") {
  const n = planetName;
  if (band <= 5) {
    return {
      title: "Bienvenue, capitaine !",
      steps: [
        S(`${n} est née !`, "Tu es son capitaine. Elle tourne dans l'espace."),
        S("Touche un dossier", "Dedans, il y a des jeux, des sons et des images."),
        S("Joue et écoute", "Touche un jeu ou un son pour commencer."),
        S("Un grand peut t'aider", "Demande-lui avant de partager ta planète."),
      ],
    };
  }
  if (band <= 9) {
    return {
      title: "Ton guide de capitaine",
      steps: [
        S(`${n} est en orbite`, "Elle tourne autour de la grande planète. Touche-la pour entrer."),
        S("Dossiers et modules", "Les dossiers rangent ta planète. Les modules sont des outils : musique, animaux, jeux, quiz."),
        S("Fonctionnel ou Démo ?", "« Fonctionnel » marche pour de vrai. « Démo » montre des exemples."),
        S("Pose une question", "Dans la barre du haut, écris par exemple : quel temps fait-il à Paris ?"),
        S("Partager", "Le lien de partage montre ta planète à un ami. Demande l'accord d'un adulte avant."),
      ],
    };
  }
  if (band <= 13) {
    return {
      title: "Guide de ta planète",
      steps: [
        S(`${n} est en orbite`, "Clique sur elle pour entrer. Tu peux en créer d'autres depuis l'Atelier."),
        S("Organise", "Crée des dossiers et des sous-dossiers, puis ajoute des modules : outils ouverts, jeux de la communauté, liens."),
        S("Lis les étiquettes", "Fonctionnel = données réelles. Démo = exemples. À configurer = une étape est nécessaire."),
        S("Cherche", "La barre du haut comprend des questions : météo d'une ville, recherche dans tes modules."),
        S("Reste protégé", "Ne donne pas d'infos personnelles. Les sources et licences sont indiquées en bas de page."),
        S("Partage", "Le lien de partage ne contient aucune clé ni donnée privée."),
      ],
    };
  }
  return {
    title: "Guide de ta planète",
    steps: [
      S(`${n} est en orbite`, "Elle apparaît autour de la planète principale. Ouvre-la, ajoute des sous-dossiers et des modules."),
      S("Compose ta planète", "Mélange des API ouvertes, des modules créés par des Soluniariens (jeux, radios, TV via SolunIA) et tes comptes."),
      S("Connecte Gmail et Drive", "Module « Messagerie et fichiers » : lecture seule, jeton gardé en mémoire, jamais partagé. Une fenêtre officielle Google demande ton accord."),
      S("Interroge ta planète", "Exemples : ai-je reçu des mails ? Quel temps fait-il à Saint-Denis ? Cherche un fichier « facture »."),
      S("Démo ou fonctionnel", "Chaque module affiche son état. Sans connexion Google, la messagerie reste en Démo avec des données d'exemple."),
      S("Sécurité", "Aucune clé n'est dans le lien de partage. Déconnecte Google à tout moment depuis le module."),
      S("Plus tard", "Ton âge est déclaré pour l'instant ; une vérification sera ajoutée."),
    ],
  };
}
