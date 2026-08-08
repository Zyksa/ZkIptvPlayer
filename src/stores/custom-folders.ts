import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CustomMediaFolder, PlayableMedia } from '@/types/iptv'

const STORAGE_KEY = 'zkplayer_custom_folders_v1'
const MAX_FOLDER_NAME_LENGTH = 60

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `folder_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function sanitizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLDER_NAME_LENGTH)
}

function loadFolders(): CustomMediaFolder[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((folder): folder is CustomMediaFolder => {
      if (!folder || typeof folder !== 'object') return false
      const candidate = folder as Partial<CustomMediaFolder>
      return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && Array.isArray(candidate.items)
        && typeof candidate.createdAt === 'number'
        && typeof candidate.updatedAt === 'number'
    })
  } catch {
    return []
  }
}

export const useCustomFoldersStore = defineStore('customFolders', () => {
  const folders = ref<CustomMediaFolder[]>(loadFolders())
  const totalItems = computed(() => new Set(folders.value.flatMap((folder) => folder.items.map((item) => item.id))).size)

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders.value))
  }

  function createFolder(rawName: string): string | null {
    const name = sanitizeName(rawName)
    if (!name || folders.value.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return null
    }
    const now = Date.now()
    const id = createId()
    folders.value.push({ id, name, items: [], createdAt: now, updatedAt: now })
    persist()
    return id
  }

  function renameFolder(id: string, rawName: string): boolean {
    const name = sanitizeName(rawName)
    const folder = folders.value.find((entry) => entry.id === id)
    if (!folder || !name || folders.value.some((entry) => entry.id !== id && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return false
    }
    folder.name = name
    folder.updatedAt = Date.now()
    persist()
    return true
  }

  function deleteFolder(id: string) {
    folders.value = folders.value.filter((folder) => folder.id !== id)
    persist()
  }

  function hasMedia(folderId: string, mediaId: string): boolean {
    return folders.value.some((folder) => folder.id === folderId && folder.items.some((item) => item.id === mediaId))
  }

  function addMedia(folderId: string, media: PlayableMedia): boolean {
    const folder = folders.value.find((entry) => entry.id === folderId)
    if (!folder || folder.items.some((item) => item.id === media.id)) return false
    folder.items.unshift({ ...media })
    folder.updatedAt = Date.now()
    persist()
    return true
  }

  function removeMedia(folderId: string, mediaId: string): boolean {
    const folder = folders.value.find((entry) => entry.id === folderId)
    if (!folder) return false
    const nextItems = folder.items.filter((item) => item.id !== mediaId)
    if (nextItems.length === folder.items.length) return false
    folder.items = nextItems
    folder.updatedAt = Date.now()
    persist()
    return true
  }

  function toggleMedia(folderId: string, media: PlayableMedia): boolean {
    if (hasMedia(folderId, media.id)) {
      removeMedia(folderId, media.id)
      return false
    }
    addMedia(folderId, media)
    return true
  }

  return {
    folders,
    totalItems,
    createFolder,
    renameFolder,
    deleteFolder,
    hasMedia,
    addMedia,
    removeMedia,
    toggleMedia,
  }
})
