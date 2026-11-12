# Changelog

Toutes les évolutions importantes de ZkPlayer Desktop sont répertoriées ici.

## [Non publié]

### Nouveautés

- Mode web sans exécutable ni signature : `start-web.bat` (ou `npm run web`) ouvre la même interface dans le navigateur, et un clic sur une chaîne, un film ou un épisode lance la lecture dans VLC. Un petit serveur Node local (sans dépendance) relaie le catalogue IPTV et pilote VLC.

## [1.1.4] - 2026-08-11

### Nouveautés

- Support Linux : générateurs AppImage et .deb, en plus des installateurs Windows.
- Téléchargement automatique de FFmpeg sous Linux (build statique).
- Ouverture des liens externes et du lecteur VLC externe fonctionnelle sous Linux.

### Corrections

- La barre de recherche temporelle ne réinitialisait plus le minuteur à 0:01 après un déplacement manuel.
- Réduction d'un bref grésillement audio lors d'une recherche dans la timeline (redémarrage de FFmpeg).

## [1.1.3] - 2026-08-10

### Maintenance

- Nettoyage des fichiers distribués avec le projet.
- Aucun changement pour vos contenus et vos réglages.

## [1.1.2] - 2026-08-10

### Nouveautés & Améliorations UI/UX

- Refonte complète de l'UI/UX et du Motion Design selon la philosophie Craft d'Emil Kowalski.
- Intégration de tokens de mouvement 60fps sur-mesure (`--ease-out-expo`, `--ease-out-quint`, `--ease-spring`).
- Réactivité tactile globale sur les boutons et cartes avec micro-enfoncement au clic (`scale(0.96)`).
- Pilule glissante animée sous les onglets de connexion (API Xtream Codes vs Lien M3U) avec transition de vue fluide.
- Animation Heart Burst (`heart-pop`) lors de la bascule d'un média en favori.
- Pop central dynamique (`play-pause-pop`) sur l'indicateur Play/Pause du lecteur vidéo et fondu d'overlay asymétrique.
- Animation d'extension sur la barre de recherche et le bouton d'effacement.

## [1.1.1] - 2026-08-08

### Nouveautés

- Créez vos propres dossiers et ajoutez-y facilement vos films, séries et chaînes.
- Ajoutez un contenu aux favoris ou à un dossier directement depuis sa carte.
- Retrouvez les favoris et dossiers personnalisés dans la navigation rapide.

### Améliorations

- Interface modernisée avec de nouvelles animations, particules et transitions.
- Installation de FFmpeg plus claire avec une progression visible.
- Lecture, stabilité et expérience générale améliorées.
- Le changelog est désormais affiché lors des mises à jour.

## [1.1.0] - 2026-08-08

- Première publication de ZkPlayer Desktop 1.1.
