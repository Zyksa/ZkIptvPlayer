import { readFile, readdir, writeFile } from 'fs/promises'
import { resolve } from 'path'

const root = process.cwd()
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json')
const changelogPath = resolve(root, 'CHANGELOG.md')
const bundleDir = resolve(root, 'src-tauri/target/release/bundle')
const repo = 'Zyksa/ZkIptvPlayer'
const { readReleaseNotesForVersion } = await import('./release-notes.mjs')

const tauriConf = JSON.parse(await readFile(tauriConfPath, 'utf8'))
const version = tauriConf.version
const productName = tauriConf.productName

if (!version || !productName) {
  console.error('❌ Version ou nom du produit absent de src-tauri/tauri.conf.json')
  process.exit(1)
}

// This script only ever runs on the OS it targets (one CI job per platform),
// so it writes a PARTIAL latest.json containing just that platform's entry.
// scripts/merge-latest-json.mjs combines the Windows + Linux partials
// produced by the two CI jobs into the single latest.json GitHub Releases
// serves to the updater.
const PLATFORM_CONFIGS = {
  win32: {
    key: 'windows-x86_64',
    dir: 'nsis',
    exeFile: `${productName}_${version}_x64-setup.exe`,
  },
  linux: {
    key: 'linux-x86_64',
    dir: 'appimage',
    exeFile: `${productName}_${version}_amd64.AppImage`,
  },
}

const platformConfig = PLATFORM_CONFIGS[process.platform]
if (!platformConfig) {
  console.error(`❌ Plateforme non supportée pour la génération de latest.json : ${process.platform}`)
  process.exit(1)
}

const { key: platformKey, dir: bundleSubdir, exeFile } = platformConfig
const outDir = resolve(bundleDir, bundleSubdir)
let files

try {
  files = await readdir(outDir)
} catch {
  console.error(`❌ Dossier de bundle introuvable : ${outDir}`)
  process.exit(1)
}

const sigFile = `${exeFile}.sig`

if (!files.includes(exeFile) || !files.includes(sigFile)) {
  console.error(`❌ Bundle ou signature introuvable pour la version ${version} (${platformKey}).`)
  process.exit(1)
}

const signature = await readFile(resolve(outDir, sigFile), 'utf8')
const releaseNotes = await readReleaseNotesForVersion(changelogPath, version)
// GitHub Releases normalizes asset filenames by replacing spaces with dots
// (e.g. "ZkPlayer Desktop_1.0.6_x64-setup.exe" -> "ZkPlayer.Desktop_1.0.6_x64-setup.exe").
// The local bundle keeps the space (from productName), so we must mirror
// GitHub's normalization here or the download URL in latest.json 404s.
const ghAssetName = exeFile.replace(/ /g, '.')
const url = `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(ghAssetName)}`

const latestJson = {
  version: `v${version}`,
  notes: releaseNotes,
  pub_date: new Date().toISOString(),
  platforms: {
    [platformKey]: {
      signature,
      url,
    },
  },
}

const outputPath = resolve(outDir, 'latest.json')
const releaseNotesPath = resolve(outDir, 'release-notes.md')
await writeFile(outputPath, JSON.stringify(latestJson, null, 2) + '\n')
await writeFile(releaseNotesPath, releaseNotes + '\n')

console.log(`✅ latest.json (${platformKey}) généré pour v${version} : ${outputPath}`)
console.log(`✅ Notes de version générées : ${releaseNotesPath}`)
