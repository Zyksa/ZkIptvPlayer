<div align="center">

# 🎬 ZkPlayer Desktop

**Lecteur IPTV & VOD pour Windows — moderne, léger et rapide.**

Regardez la **TV en direct**, les **films** et les **séries** depuis vos playlists **M3U** ou vos comptes **Xtream Codes**.

![Version](https://img.shields.io/github/v/release/Zyksa/ZkIptvPlayer?label=version)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows)

</div>

---

## ✨ Fonctionnalités

- 📺 **TV en direct** avec recherche instantanée
- 🎥 **Films** et **séries** organisés par dossiers, avec affiches et synopsis
- 🔍 **Recherche globale** + recherche dans chaque dossier
- 📂 Support des playlists **M3U** et des comptes **Xtream Codes**
- ⚡ Proxy local Rust + transcodage **FFmpeg** (AC-3 / DTS → AAC)
- 🖥️ Lecteur vidéo intégré avec support **HLS**
- 🌙 Interface sombre, moderne et responsive
- 🔄 **Mises à jour automatiques** au démarrage
- 🧙 Installateur guidé avec installation optionnelle de VLC

---

## 📥 Télécharger & installer

1. Rendez-vous sur la page [**Releases**](https://github.com/Zyksa/ZkIptvPlayer/releases/latest).
2. Téléchargez **`ZkPlayer.Desktop_<version>_x64-setup.exe`**.
3. Double-cliquez sur le fichier et suivez l'assistant.

> 💡 **FFmpeg** est téléchargé automatiquement au premier lancement (~90 Mo). Aucune action requise.

---

## 🛠️ Construire son propre `.exe`

### Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/tools/install)
- Windows 10/11

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/Zyksa/ZkIptvPlayer.git
cd ZkIptvPlayer

# 2. Installer les dépendances
npm install

# 3. Lancer en développement (hot reload)
npm run tauri dev

# 4. Construire l'installateur release
npm run build:tauri
```

L'installateur généré se trouve dans :

```
src-tauri/target/release/bundle/nsis/ZkPlayer.Desktop_<version>_x64-setup.exe
```

### Build signé (pour les mises à jour automatiques)

Les mises à jour automatiques nécessitent un installateur **signé** :

```bash
npm run build:tauri:signed
```

La clé de signature est lue depuis `src-tauri/tauri.key` (déjà ignorée par git).
Voir [`.env.example`](./.env.example) pour les variables optionnelles.

---

## 🧩 Stack technique

- **Frontend :** Vue 3 + TypeScript + Pinia + Tailwind CSS
- **Backend natif :** Rust + Tauri 2
- **Streaming :** proxy local Rust sur `127.0.0.1:14221`
- **Installateur :** NSIS personnalisé avec option VLC

---

## 📝 Licence

Distribué sous licence **MIT**. Voir le fichier [LICENSE](./LICENSE).