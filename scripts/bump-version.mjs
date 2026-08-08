import { readFile, writeFile } from 'fs/promises'
import { execSync } from 'child_process'
import { resolve } from 'path'

const root = process.cwd()
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json')
const cargoTomlPath = resolve(root, 'src-tauri/Cargo.toml')

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', cwd: root, ...opts }).toString().trim()
}

function runAllowFailure(cmd, opts = {}) {
  try {
    return run(cmd, opts)
  } catch {
    return ''
  }
}

// 1. Bump npm version (patch) — met à jour package.json et package-lock.json.
run('npm version patch --no-git-tag-version')

// 2. Lire la nouvelle version.
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const newVersion = pkg.version

// 3. Mettre à jour tauri.conf.json.
const tauriConf = JSON.parse(await readFile(tauriConfPath, 'utf8'))
tauriConf.version = newVersion
await writeFile(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')

// 4. Mettre à jour Cargo.toml.
let cargoToml = await readFile(cargoTomlPath, 'utf8')
cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${newVersion}"`)
await writeFile(cargoTomlPath, cargoToml)

// 5. Mettre à jour Cargo.lock via cargo.
run('cargo update -p zkplayer-desktop', { cwd: resolve(root, 'src-tauri') })

// 6. Commit. Le [skip ci] évite une boucle infinie.
run('git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock')
run(`git commit -m "chore(release): bump version to ${newVersion} [skip ci]"`)

// 7. Push commit. Si le remote est en avance, on pull --rebase puis on repush.
try {
  run('git push origin main')
} catch {
  runAllowFailure('git pull origin main --rebase')
  run('git push origin main')
}

// 8. Créer/pousser le tag. Si le tag existe déjà sur le remote, on ne bloque pas.
const tagName = `v${newVersion}`
run(`git tag -f ${tagName}`)
try {
  run(`git push origin ${tagName}`)
} catch {
  // Tag may already exist on remote; force-push the local tag to ensure it points to current commit
  runAllowFailure(`git push origin --force ${tagName}`)
}

console.log(`✅ Version bumped to ${newVersion} and tag ${tagName} pushed.`)
