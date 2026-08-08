<template>
  <button
    type="button"
    :class="[
      labeled
        ? 'px-3 py-2 rounded-lg bg-white/5 hover:bg-brand-500/10 text-slate-300 hover:text-brand-accent border border-white/10 flex items-center gap-2 text-xs font-semibold'
        : 'p-1.5 rounded-full bg-black/65 hover:bg-brand-500/20 text-white hover:text-brand-accent border border-white/20 backdrop-blur shadow hover:scale-110'
    ]"
    title="Ajouter à un dossier"
    aria-label="Ajouter à un dossier personnalisé"
    @click.prevent.stop="open = true"
  >
    <FolderPlus class="w-4 h-4" />
    <span v-if="labeled">Ajouter à un dossier</span>
  </button>

  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="open = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-obsidian-900 border border-white/15 shadow-2xl p-5 space-y-4" @click.stop>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-sm font-bold text-slate-100">Ajouter à un dossier</h2>
              <p class="text-[11px] text-slate-400 truncate mt-1">{{ media.title }}</p>
            </div>
            <button type="button" class="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5" @click="open = false">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="folderStore.folders.length" class="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            <button
              v-for="folder in folderStore.folders"
              :key="folder.id"
              type="button"
              class="w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors text-left"
              :class="folderStore.hasMedia(folder.id, media.id)
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-accent'
                : 'bg-white/[0.025] border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/10'"
              @click="toggleFolder(folder.id)"
            >
              <span class="flex items-center gap-2.5 min-w-0">
                <Folder class="w-4 h-4 shrink-0" />
                <span class="text-xs font-semibold truncate">{{ folder.name }}</span>
              </span>
              <Check v-if="folderStore.hasMedia(folder.id, media.id)" class="w-4 h-4 shrink-0" />
              <span v-else class="text-[9px] text-slate-600 font-mono">{{ folder.items.length }}</span>
            </button>
          </div>

          <div v-else class="py-4 text-center text-xs text-slate-500">
            Aucun dossier pour le moment.
          </div>

          <form class="flex items-center gap-2 pt-2 border-t border-white/10" @submit.prevent="createAndAdd">
            <input
              v-model="newFolderName"
              maxlength="60"
              class="glass-input flex-1 min-w-0 px-3 py-2 rounded-lg text-xs"
              placeholder="Nouveau dossier…"
            />
            <button
              type="submit"
              :disabled="!newFolderName.trim()"
              class="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold disabled:opacity-40"
            >
              Créer
            </button>
          </form>
          <p v-if="createError" class="text-[10px] text-rose-400">Ce nom est vide ou déjà utilisé.</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Check, Folder, FolderPlus, X } from 'lucide-vue-next'
import type { PlayableMedia } from '@/types/iptv'
import { useCustomFoldersStore } from '@/stores/custom-folders'

const props = withDefaults(defineProps<{ media: PlayableMedia; labeled?: boolean }>(), { labeled: false })
const folderStore = useCustomFoldersStore()
const open = ref(false)
const newFolderName = ref('')
const createError = ref(false)

const createAndAdd = () => {
  const folderId = folderStore.createFolder(newFolderName.value)
  if (!folderId) {
    createError.value = true
    return
  }
  folderStore.addMedia(folderId, props.media)
  newFolderName.value = ''
  createError.value = false
  open.value = false
}

const toggleFolder = (folderId: string) => {
  folderStore.toggleMedia(folderId, props.media)
  open.value = false
}
</script>
