import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PlayableMedia } from '@/types/iptv'
import { useCustomFoldersStore } from '@/stores/custom-folders'

const media: PlayableMedia = {
  id: 'movie_42',
  title: 'Film de test',
  streamUrl: 'https://example.test/movie.mp4',
  type: 'movie',
}

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  })
  setActivePinia(createPinia())
})

describe('custom folders store', () => {
  it('creates, renames and deletes a folder', () => {
    const store = useCustomFoldersStore()
    const id = store.createFolder('  Week-end  ')

    expect(id).toBeTruthy()
    expect(store.folders[0].name).toBe('Week-end')
    expect(store.renameFolder(id!, 'À regarder')).toBe(true)
    expect(store.folders[0].name).toBe('À regarder')

    store.deleteFolder(id!)
    expect(store.folders).toHaveLength(0)
  })

  it('prevents duplicates and toggles media membership', () => {
    const store = useCustomFoldersStore()
    const id = store.createFolder('Favoris famille')!

    expect(store.createFolder('favoris famille')).toBeNull()
    expect(store.toggleMedia(id, media)).toBe(true)
    expect(store.hasMedia(id, media.id)).toBe(true)
    expect(store.totalItems).toBe(1)
    expect(store.toggleMedia(id, media)).toBe(false)
    expect(store.hasMedia(id, media.id)).toBe(false)
  })
})
