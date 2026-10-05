# Brancher Gmail et Google Drive (propriétaire du site)

Les modules **Ma messagerie (Gmail)** et **Mes fichiers (Google Drive)** sont prêts dans le code. Tant que le « Client ID » est vide dans `js/config.js`, ils tournent en **Démo** (données d'exemple, toujours signalées). Voici comment les rendre **fonctionnels**.

> État de vérification : le code, le mode Démo et la lecture des en-têtes sont testés (`tests/google.test.mjs`). La connexion réelle n'a **pas** été testée avec un vrai compte : elle exige que tu te connectes toi-même à Google (je ne me connecte jamais à un compte à ta place).

## Étapes (une seule fois, ~10 minutes)
1. Ouvre https://console.cloud.google.com/ et crée un projet (ex. « Univers »).
2. **API et services > Bibliothèque** : active **Gmail API** et **Google Drive API**.
3. **Écran de consentement OAuth** : type **Externe**, nom de l'application « Univers », ton e-mail. Laisse l'état **Test** et ajoute en « Utilisateurs de test » les comptes qui pourront se connecter (100 maximum).
4. **Identifiants > Créer des identifiants > ID client OAuth** : type **Application Web**. Dans « Origines JavaScript autorisées », ajoute `https://ladrop974.github.io` et `http://localhost:8092` (aucune URI de redirection n'est nécessaire).
5. Copie l'**ID client** (`…apps.googleusercontent.com`) dans `js/config.js` :
   ```js
   export const GOOGLE_CLIENT_ID = "1234-abc.apps.googleusercontent.com";
   ```
   Cet identifiant n'est **pas un secret** : il peut être public. **Ne mets jamais de « secret client »** dans ce dépôt (il n'est pas nécessaire ici).
6. Publie. Dans une planète adulte, le module affiche « Connecter » à la place de « Démo ».

## Ce qui est protégé
- **Lecture seule** : `gmail.readonly` et `drive.metadata.readonly`. Aucune écriture, aucun envoi.
- **Jamais le contenu** : seuls expéditeur, objet, date (Gmail) et noms de fichiers (Drive) sont lus.
- **Jeton en mémoire** uniquement : jamais écrit sur le disque, effacé à la fermeture ou à « Déconnecter » (le jeton est aussi révoqué chez Google).
- **Aucun serveur intermédiaire** : le navigateur parle directement à Google.
- **Jamais partagé** : absent des liens de partage. Réservé aux **adultes** (18+).
- **Consentement clair** avant la fenêtre officielle de Google, qui peut être refusée.

## Limites à connaître (honnêtement)
- **Mode Test = 100 comptes maximum**, avec un écran « application non vérifiée ». C'est suffisant pour toi et tes proches.
- **Ouvrir à tout le monde** demande une **validation Google**. Les accès Gmail en lecture sont dits « restreints » : Google exige une évaluation de sécurité annuelle (souvent payante). Prévois-le avant une ouverture publique, ou garde le mode Test.
- Les modules Drive/Gmail ne sont pas disponibles en dessous de 18 ans, ce qui est aussi cohérent avec les règles d'âge de Google.
- L'assistant comprend « ai-je reçu des mails ? » et « cherche le fichier X » ; il ne lit, ne résume ni n'envoie jamais un message.
