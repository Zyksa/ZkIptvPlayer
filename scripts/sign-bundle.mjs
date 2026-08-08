import { execSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const root = process.cwd()
const tauriConf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))
const { productName, version } = tauriConf

const bundleDir = resolve(root, 'src-tauri/target/release/bundle')
const bundles = [
  join(bundleDir, 'nsis', `${productName}_${version}_x64-setup.exe`),
  join(bundleDir, 'msi', `${productName}_${version}_x64_en-US.msi`),
]

const password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ''

// Prefer passing the private key inline via -k to avoid the CLI picking up both
// a path and an env var at the same time (which it rejects as conflicting).
let keyArg = ''
let cleanupKey = null

const inlineKey = process.env.TAURI_SIGNING_PRIVATE_KEY
if (inlineKey) {
  keyArg = `-k "${inlineKey.replace(/\r?\n/g, '\\n').replace(/"/g, '\\"')}"`
} else {
  let keyPath = resolve(root, 'src-tauri/tauri.key')
  if (!existsSync(keyPath)) {
    console.error('❌ Aucune clé de signature trouvée.')
    console.error('   Placez src-tauri/tauri.key ou définissez TAURI_SIGNING_PRIVATE_KEY.')
    process.exit(1)
  }
  keyArg = `-f "${keyPath}"`
}

let signed = 0
for (const bundle of bundles) {
  if (!existsSync(bundle)) continue
  const quoted = `"${bundle}"`
  console.log(`🔏 Signing ${bundle}...`)
  execSync(`npx tauri signer sign ${keyArg} -p "${password}" ${quoted}`, { stdio: 'inherit' })
  signed++
}

if (cleanupKey) cleanupKey()

if (signed === 0) {
  console.warn('⚠️ Aucun bundle trouvé à signer.')
} else {
  console.log(`✅ ${signed} bundle(s) signé(s).`)
}
