import { readFile } from 'fs/promises'

export async function readReleaseNotesForVersion(changelogPath, version) {
  const changelog = await readFile(changelogPath, 'utf8')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lines = changelog.split(/\r?\n/)
  const sectionHeader = new RegExp(`^## \\[${escapedVersion}\\](?:\\s|$)`)
  const sectionStart = lines.findIndex(line => sectionHeader.test(line))
  const nextSection = sectionStart >= 0
    ? lines.findIndex((line, index) => index > sectionStart && /^## \[/.test(line))
    : -1
  const sectionEnd = nextSection >= 0 ? nextSection : lines.length
  const notes = sectionStart >= 0
    ? lines.slice(sectionStart + 1, sectionEnd).join('\n').trim()
    : ''

  if (!notes) {
    throw new Error(`Aucune entrée trouvée pour la version ${version} dans CHANGELOG.md`)
  }

  return notes
}
