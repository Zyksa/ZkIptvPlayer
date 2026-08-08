import { readFile, readdir, writeFile } from 'fs/promises'
import { resolve } from 'path'

const root = process.cwd()
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json')
const bundleDir = resolve(root, 'src-tauri/target/release/bundle')
const repo = 'Zyksa/ZkIptvPlayer'

const tauriConf = JSON.parse(await readFile(tauriConfPath, 'utf8'))
const version = tauriConf.version

if (!version) {
  console.error('❌ Impossible de lire la version depuis src-tauri/tauri.conf.json')
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

const exeFile = files.find(f => f.endsWith('-setup.exe'))
const sigFile = files.find(f => f.endsWith('-setup.exe.sig'))

if (!exeFile || !sigFile) {
  console.error('❌ Bundle NSIS ou fichier .sig introuvable.')
  process.exit(1)
}

const signature = await readFile(resolve(nsisDir, sigFile), 'utf8')
// GitHub Releases normalizes asset filenames by replacing spaces with dots
// (e.g. "ZkPlayer Desktop_1.0.6_x64-setup.exe" -> "ZkPlayer.Desktop_1.0.6_x64-setup.exe").
// The local NSIS bundle keeps the space (from productName), so we must mirror
// GitHub's normalization here or the download URL in latest.json 404s.
const ghAssetName = exeFile.replace(/ /g, '.')
const url = `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(ghAssetName)}`

const latestJson = {
  version: `v${version}`,
  notes: `Version ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url,
    },
  },
}

const outputPath = resolve(nsisDir, 'latest.json')
await writeFile(outputPath, JSON.stringify(latestJson, null, 2) + '\n')

console.log(`✅ latest.json généré pour v${version} : ${outputPath}`)
