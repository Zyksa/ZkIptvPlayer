<template>
  <div class="h-full flex flex-col p-6 gap-4 overflow-hidden">
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <FolderHeart class="w-5 h-5 text-brand-accent" />
          <span>Dossiers personnalisés</span>
        </h1>
        <p class="text-xs text-slate-400 mt-1">Organisez vos chaînes, films et séries comme vous le souhaitez.</p>
      </div>
      <button
        type="button"
        class="primary-action px-4 py-2.5 rounded-xl text-white text-xs font-semibold flex items-center gap-2"
        @click="creating = true"
      >
        <FolderPlus class="w-4 h-4" />
        <span>Nouveau dossier</span>
      </button>
    </header>

    <Transition name="expand">
    <form v-if="creating" class="flex items-center gap-2 p-3 rounded-xl bg-white/[0.025] border border-white/10" @submit.prevent="createFolder">
      <input v-model="newName" maxlength="60" autofocus class="glass-input flex-1 px-3 py-2 rounded-lg text-xs" placeholder="Nom du nouveau dossier" />
      <button type="submit" class="compact-primary px-3 py-2 rounded-lg text-white text-xs font-semibold">Créer</button>
      <button type="button" class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" @click="cancelCreate"><X class="w-4 h-4" /></button>
      <span v-if="formError" class="text-[10px] text-rose-400">Nom vide ou déjà utilisé.</span>
    </form>
    </Transition>

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 overflow-hidden">
      <aside class="glass-panel rounded-2xl p-2 overflow-y-auto space-y-1">
        <button
          v-for="folder in folderStore.folders"
          :key="folder.id"
          type="button"
          :class="[
            'folder-tab w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left',
            selectedFolderId === folder.id ? 'folder-tab--active text-white' : 'text-slate-300'
          ]"
          @click="selectedFolderId = folder.id"
        >
          <span class="flex items-center gap-2 min-w-0">
            <Folder class="w-4 h-4 shrink-0" />
            <span class="text-xs font-semibold truncate">{{ folder.name }}</span>
          </span>
          <span class="px-1.5 py-0.5 rounded bg-black/30 text-[9px] font-mono">{{ folder.items.length }}</span>
        </button>

        <div v-if="!folderStore.folders.length" class="py-12 px-4 text-center">
          <FolderOpen class="w-8 h-8 mx-auto text-slate-700 mb-2" />
          <p class="text-[11px] text-slate-500">Créez votre premier dossier.</p>
        </div>
      </aside>

      <section class="min-w-0 overflow-hidden flex flex-col">
        <template v-if="activeFolder">
          <div class="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div class="min-w-0 flex-1">
              <form v-if="editing" class="flex items-center gap-2" @submit.prevent="saveRename">
                <input v-model="editName" maxlength="60" autofocus class="glass-input max-w-sm w-full px-3 py-2 rounded-lg text-sm font-semibold" />
                <button type="submit" class="p-2 rounded-lg bg-emerald-500/15 text-emerald-300"><Check class="w-4 h-4" /></button>
                <button type="button" class="p-2 rounded-lg bg-white/5 text-slate-400" @click="editing = false"><X class="w-4 h-4" /></button>
              </form>
              <div v-else>
                <h2 class="text-base font-bold text-slate-100 truncate">{{ activeFolder.name }}</h2>
                <p class="text-[10px] text-slate-500 mt-0.5">{{ activeFolder.items.length }} contenu{{ activeFolder.items.length > 1 ? 's' : '' }}</p>
              </div>
            </div>

            <div v-if="!editing" class="flex items-center gap-2">
              <template v-if="confirmingDelete">
                <span class="text-[10px] text-rose-300">Supprimer ce dossier ?</span>
                <button type="button" class="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[10px] font-semibold" @click="deleteActiveFolder">Confirmer</button>
                <button type="button" class="px-2.5 py-1.5 rounded-lg bg-white/5 text-slate-300 text-[10px]" @click="confirmingDelete = false">Annuler</button>
              </template>
              <template v-else>
                <button type="button" title="Renommer" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white" @click="startRename"><Pencil class="w-4 h-4" /></button>
                <button type="button" title="Supprimer" class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400" @click="confirmingDelete = true"><Trash2 class="w-4 h-4" /></button>
              </template>
            </div>
          </div>

          <div v-if="activeFolder.items.length" class="stagger-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pt-4 pr-1">
            <article
              v-for="media in activeFolder.items"
              :key="media.id"
              class="glass-card rounded-xl overflow-hidden cursor-pointer group flex flex-col"
              @click="openMedia(media)"
            >
              <div class="relative aspect-[2/3] bg-obsidian-950 overflow-hidden">
                <img v-if="isSafeImageUrl(media.poster || media.icon)" :src="media.poster || media.icon" :alt="media.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" referrerpolicy="no-referrer" />
                <div v-else class="w-full h-full grid place-items-center"><Film class="w-8 h-8 text-slate-700" /></div>
                <div class="absolute top-2 left-2 z-30 flex gap-1.5">
                  <FavoriteButton :media="media" />
                  <CustomFolderButton :media="media" />
                </div>
                <button type="button" title="Retirer du dossier" class="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/70 text-slate-300 hover:text-rose-300 hover:bg-rose-500/20 border border-white/10" @click.prevent.stop="folderStore.removeMedia(activeFolder.id, media.id)">
                  <X class="w-4 h-4" />
                </button>
                <div class="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                  <Play class="w-8 h-8 text-white fill-current" />
                </div>
              </div>
              <div class="p-3 min-w-0">
                <h3 class="content-title text-xs font-semibold text-slate-200 line-clamp-2">{{ media.title }}</h3>
                <span class="text-[9px] uppercase font-mono text-slate-500 mt-1 block">{{ mediaLabel(media.type) }}</span>
              </div>
            </article>
          </div>

          <div v-else class="flex-1 grid place-items-center text-center">
            <div>
              <FolderOpen class="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <h3 class="text-sm font-semibold text-slate-300">Ce dossier est vide</h3>
              <p class="text-[11px] text-slate-500 mt-1">Utilisez l’icône dossier présente sur les cartes de contenu.</p>
            </div>
          </div>
        </template>

        <div v-else class="flex-1 grid place-items-center text-center">
          <div>
            <FolderHeart class="w-12 h-12 mx-auto text-slate-700 mb-3" />
            <h3 class="text-sm font-semibold text-slate-300">Vos collections, à votre façon</h3>
            <p class="text-[11px] text-slate-500 mt-1">Créez un dossier pour commencer.</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Film, Folder, FolderHeart, FolderOpen, FolderPlus, Pencil, Play, Trash2, X } from 'lucide-vue-next'
import type { MediaType, PlayableMedia } from '@/types/iptv'
import { useCustomFoldersStore } from '@/stores/custom-folders'
import { useIptvStore } from '@/stores/iptv'
import { usePlayerStore } from '@/stores/player'
import FavoriteButton from '@/components/FavoriteButton.vue'
import CustomFolderButton from '@/components/CustomFolderButton.vue'
import { isSafeImageUrl } from '@/utils/url'

const folderStore = useCustomFoldersStore()
const iptvStore = useIptvStore()
const playerStore = usePlayerStore()
const selectedFolderId = ref(folderStore.folders[0]?.id || '')
const creating = ref(false)
const newName = ref('')
const formError = ref(false)
const editing = ref(false)
const editName = ref('')
const confirmingDelete = ref(false)

const activeFolder = computed(() => folderStore.folders.find((folder) => folder.id === selectedFolderId.value) || null)

watch(() => folderStore.folders.map((folder) => folder.id), () => {
  if (!activeFolder.value) selectedFolderId.value = folderStore.folders[0]?.id || ''
})

const createFolder = () => {
  const id = folderStore.createFolder(newName.value)
  if (!id) { formError.value = true; return }
  selectedFolderId.value = id
  cancelCreate()
}

const cancelCreate = () => { creating.value = false; newName.value = ''; formError.value = false }
const startRename = () => { if (activeFolder.value) { editName.value = activeFolder.value.name; editing.value = true } }
const saveRename = () => { if (activeFolder.value && folderStore.renameFolder(activeFolder.value.id, editName.value)) editing.value = false }
const deleteActiveFolder = () => { if (activeFolder.value) folderStore.deleteFolder(activeFolder.value.id); confirmingDelete.value = false }

const openMedia = (media: PlayableMedia) => {
  if (media.streamUrl) { playerStore.playMedia(media); return }
  if (media.type === 'series') { iptvStore.seriesSearch = media.title; iptvStore.currentView = 'series' }
}

const mediaLabel = (type: MediaType) => ({ live: 'Direct TV', movie: 'Film', series: 'Série' })[type]
</script>
