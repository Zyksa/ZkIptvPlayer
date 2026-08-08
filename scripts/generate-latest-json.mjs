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

const nsisDir = resolve(bundleDir, 'nsis')
let files

try {
  files = await readdir(nsisDir)
} catch {
  console.error(`❌ Dossier NSIS introuvable : ${nsisDir}`)
  process.exit(1)
}

const exeFile = `${productName}_${version}_x64-setup.exe`
const sigFile = `${exeFile}.sig`

if (!files.includes(exeFile) || !files.includes(sigFile)) {
  console.error(`❌ Bundle NSIS ou signature introuvable pour la version ${version}.`)
  process.exit(1)
}

const signature = await readFile(resolve(nsisDir, sigFile), 'utf8')
const releaseNotes = await readReleaseNotesForVersion(changelogPath, version)
// GitHub Releases normalizes asset filenames by replacing spaces with dots
// (e.g. "ZkPlayer Desktop_1.0.6_x64-setup.exe" -> "ZkPlayer.Desktop_1.0.6_x64-setup.exe").
// The local NSIS bundle keeps the space (from productName), so we must mirror
// GitHub's normalization here or the download URL in latest.json 404s.
const ghAssetName = exeFile.replace(/ /g, '.')
const url = `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(ghAssetName)}`

const latestJson = {
  version: `v${version}`,
  notes: releaseNotes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url,
    },
  },
}

const outputPath = resolve(nsisDir, 'latest.json')
const releaseNotesPath = resolve(nsisDir, 'release-notes.md')
await writeFile(outputPath, JSON.stringify(latestJson, null, 2) + '\n')
await writeFile(releaseNotesPath, releaseNotes + '\n')

console.log(`✅ latest.json généré pour v${version} : ${outputPath}`)
console.log(`✅ Notes de version générées : ${releaseNotesPath}`)
