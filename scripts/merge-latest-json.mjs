import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'

// Combines the per-platform latest.json partials produced by
// scripts/generate-latest-json.mjs on each CI runner (one per OS) into the
// single latest.json that the Tauri updater plugin expects, with a
// `platforms` entry per OS.
//
// Usage: node scripts/merge-latest-json.mjs <out.json> <partial1.json> [partial2.json ...]
const [outputArg, ...partialArgs] = process.argv.slice(2)

if (!outputArg || partialArgs.length === 0) {
  console.error('Usage: node scripts/merge-latest-json.mjs <out.json> <partial1.json> [partial2.json ...]')
  process.exit(1)
}

const root = process.cwd()
const partials = await Promise.all(
  partialArgs.map(async p => JSON.parse(await readFile(resolve(root, p), 'utf8')))
)

const [first, ...rest] = partials
const merged = {
  version: first.version,
  notes: first.notes,
  pub_date: first.pub_date,
  platforms: { ...first.platforms },
}

for (const partial of rest) {
  if (partial.version !== merged.version) {
    console.error(
      `❌ Version mismatch entre les partiels latest.json : ${merged.version} vs ${partial.version}`
    )
    process.exit(1)
  }
  Object.assign(merged.platforms, partial.platforms)
}

const outputPath = resolve(root, outputArg)
await writeFile(outputPath, JSON.stringify(merged, null, 2) + '\n')

console.log(`✅ latest.json fusionné (${Object.keys(merged.platforms).join(', ')}) : ${outputPath}`)
