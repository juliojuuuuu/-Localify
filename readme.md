# 🎵 Localify Web V3 (Ultimate Edition)

**Le lecteur web auto-hébergé, moderne et immersif pour votre audiothèque locale.**

![Version](https://img.shields.io/badge/version-3.0.0-blueviolet) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Node.js-green)

**Localify Web** transforme vos simples dossiers de musique en une **Web App** puissante, fluide et esthétique. Conçu pour rivaliser avec Spotify ou Apple Music, mais avec **vos propres fichiers**, sans publicité et avec une personnalisation totale.

---

## ✨ Nouveautés de la Dernière Version

* 🌧️ **Mode Ambiance Global :** Donnez vie à votre interface avec des effets de particules animés (Neige ❄️, Braises 🔥, Étoiles ✨, Lucioles 🧚) visibles partout sur le site.
* 🌈 **Thème Caméléon :** L'interface change de couleur dynamiquement en s'adaptant à la pochette de l'album en cours.
* 🎧 **Mode Audio 8D :** Spatialisation du son rotative pour une immersion totale au casque.
* 📺 **Feedback Visuel (OSD) :** Affichage élégant du volume et des actions (Play/Pause) au centre de l'écran.
* 📱 **Interface Mobile Native :** Support des gestes tactiles, mode sombre profond et optimisation pour les écrans tactiles.

---

## 🚀 Fonctionnalités Clés

### 🎧 Expérience Audio & Visuelle
* **Lecture Premium :** Support MP3, FLAC, WAV, OGG avec lecture en continu (gapless) et Crossfade (fondu enchaîné).
* **Visualiseur Avancé :** 3 Modes disponibles (Barres Classiques, Onde, Circulaire).
* **Égaliseur 3 Bandes :** Ajustement précis des Basses, Médiums et Aigus avec préréglages (Bass Boost, Rock, Pop...).
* **Mode Focus :** Interface immersive plein écran avec pochette flottante, fond transparent et contrôles épurés.

### 📂 Gestion de Bibliothèque Intelligente
* **Scan Intelligent (Smart FLAC) :** Si les métadonnées sont manquantes, le lecteur utilise intelligemment les noms de dossiers pour organiser vos albums.
* **Playlists & Favoris :** Créez des playlists, likez vos titres ❤️ et retrouvez-les facilement.
* **Navigation Fluide :** Tri par Artiste, Album, ou Playlist.
* **Recherche Instantanée :** Trouvez n'importe quel titre ou artiste en une fraction de seconde.

### 🎨 Personnalisation Poussée
* **Fonds d'écran :** Ajoutez une image de fond personnalisée via URL.
* **Styles de Pochette :** Choisissez entre Carré, Rond, ou Vinyle (qui tourne pendant la lecture).
* **Minuteur de Sommeil :** Programmez l'arrêt automatique de la musique.

---

## ⚠️ Organisation des Dossiers (IMPORTANT)

Pour que la navigation et la détection fonctionnent parfaitement, il est conseillé de trier votre musique par **Catégorie**.

Localify considère le **premier dossier** à l'intérieur de `music/` comme le **Style** (Genre).

### ✅ Structure Recommandée
Créez des dossiers par genre, puis mettez vos artistes dedans :

```text
music/
├── Rap/                     <-- Style
│   ├── Eminem/              <-- Artiste
│   │   ├── The Eminem Show/ <-- Album (Optionnel mais recommandé)
│   │   │   ├── Without Me.mp3
│   │   │   └── cover.jpg
│
├── Rock/                    <-- Style
│   ├── AC-DC/               <-- Artiste
│   │   └── Back in Black.mp3
│
└── Electro/                 <-- Style
    └── Daft Punk/
        └── One More Time.flac
```
## 🚀 Installation & Démarrage

### Prérequis
* **Node.js** doit être installé sur votre machine.

### 1. Installation
Ouvrez un terminal dans le dossier du projet et lancez la commande suivante :


# Installer les dépendances
npm install

2. Configuration
Créez un dossier nommé music à la racine du projet. Déposez-y vos dossiers musicaux en respectant l'organisation décrite plus haut (Genre > Artiste > Album).

3.Lencement
# Démarrer le serveur
node server.js

Accédez ensuite à l'application via : http://localhost:3000 (ou votre IP locale sur mobile).


⌨️ Raccourcis Clavier
Touche,Action
Espace,Lecture / Pause
Flèche Gauche / Droite,Reculer / Avancer de 5 sec
Flèche Haut / Bas,Monter / Baisser le volume
N,Piste Suivante (Next)
P,Piste Précédente (Previous)
F,Activer / Désactiver le Mode Focus
L,Liker la musique en cours



📂 Structure du Code
```text
localify-web/
├── data/                  # 💾 JSON (Playlists, Favoris, Config, Historique...)
├── music/                 # 🎵 Vos fichiers audio (Racine > Genre > Artiste > Album)
├── public/                # 🌐 Frontend (Site Web)
│   ├── css/               # 🎨 Styles Modulaires
│   │   ├── variables.css      # Couleurs et variables globales
│   │   ├── base.css           # Reset et typographie
│   │   ├── layout.css         # Structure principale (Sidebar, Main)
│   │   ├── components.css     # Boutons, Inputs, Modales
│   │   ├── cards-rows.css     # Grilles d'albums et listes
│   │   ├── player.css         # Barre de lecture, Mode Focus & Transparence
│   │   ├── responsive.css     # Adaptation Mobile & Tactile
│   │   └── view-*.css         # Styles spécifiques (Dashboard, Settings, Playlists)
│   │
│   ├── js/                # 🧠 Logique JavaScript
│   │   ├── state.js           # État global et configuration par défaut
│   │   ├── audio.js           # Moteur Audio (Context, EQ, 8D)
│   │   ├── visualizer.js      # Visualiseur Audio (Canvas)
│   │   ├── player.js          # Contrôles de lecture (Play, Pause, Next...)
│   │   ├── ui.js              # Interface, Navigation & Moteur de Particules
│   │   ├── settings.js        # Gestion des paramètres & Personnalisation
│   │   ├── playlist.js        # Création et gestion des playlists
│   │   ├── events.js          # Raccourcis clavier & Événements tactiles
│   │   ├── utils.js           # Fonctions utilitaires (Format temps, couleurs...)
│   │   ├── main.js            # Point d'entrée principal (Init)
│   │   └── view-*.js          # Logique des vues (Library, Dashboard, Playlists)
│   │
│   ├── index.html         # 🏠 Page principale (SPA)
│   └── manifest.json      # 📱 Configuration PWA (Mobile)
│
├── server.js              # 🚀 Backend Node.js (Scan fichiers & API)
├── package.json           # 📦 Dépendances Node
└── .gitignore             # Fichiers ignorés par Git



```



<img width="1913" height="1024" alt="image" src="https://github.com/user-attachments/assets/0e788b82-7360-4fe8-947e-5ab421338a54" />

<img width="1222" height="733" alt="image" src="https://github.com/user-attachments/assets/907fbef2-315f-4b64-91f3-9af24a2016e0" />
<img width="326" height="503" alt="image" src="https://github.com/user-attachments/assets/3b13129b-9f59-491b-90e6-ac7f5040b883" />
<img width="1909" height="927" alt="image" src="https://github.com/user-attachments/assets/996ec5fd-0d88-45d7-894a-ca89e7e358be" />
<img width="836" height="476" alt="image" src="https://github.com/user-attachments/assets/66510c13-c795-47ea-9376-fc56aff84db5" />

<img width="1868" height="1007" alt="image" src="https://github.com/user-attachments/assets/927dfa9d-7390-43e1-b8e7-c8d259198606" />





🤝 Contribuer : Les contributions sont les bienvenues ! N'hésitez pas à proposer des idées pour améliorer l'ambiance visuelle ou le moteur audio.


