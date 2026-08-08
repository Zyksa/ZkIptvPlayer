<template>
  <div v-if="visible" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
    <div class="bg-obsidian-900 border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
      <!-- Glow effect -->
      <div class="absolute -top-20 -right-20 w-40 h-40 bg-brand-accent/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Icon & Header -->
      <div class="flex items-center space-x-3.5">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-accent flex items-center justify-center shadow-lg text-white">
          <Sparkles class="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 class="text-base font-extrabold text-slate-100">
            {{ state.event === 'DOWNLOADED' ? 'Mise à jour prête' : 'Mise à jour disponible !' }}
          </h2>
          <p class="text-xs text-brand-accent font-mono">ZkPlayer Desktop v{{ updateInfo?.version }}</p>
        </div>
      </div>

      <!-- Release Notes -->
      <div class="space-y-1.5 p-3.5 rounded-2xl bg-obsidian-950/80 border border-white/5 text-xs text-slate-300">
        <p class="font-bold text-slate-200">Nouveautés & Améliorations :</p>
        <p class="line-clamp-4 leading-relaxed font-sans text-slate-400">
          {{ updateInfo?.releaseNotes || 'Nouvelle version de ZkPlayer Desktop disponible.' }}
        </p>
      </div>

      <!-- Progress -->
      <div v-if="state.event === 'DOWNLOADING'" class="space-y-2">
        <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-brand-accent rounded-full transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>
        <p class="text-[10px] text-slate-400 font-mono text-right">Téléchargement en cours… {{ progressPercent }}%</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-3 pt-2">
        <button
          type="button"
          :disabled="state.event === 'DOWNLOADING'"
          @click="dismiss"
          class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-white/5 transition-colors disabled:opacity-50"
        >
          {{ state.event === 'DOWNLOADED' ? 'Redémarrer plus tard' : 'Plus tard' }}
        </button>

        <button
          type="button"
          :disabled="state.event === 'DOWNLOADING'"
          @click="handleAction"
          class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-95 disabled:opacity-70"
        >
          <Loader2 v-if="state.event === 'DOWNLOADING'" class="w-4 h-4 animate-spin" />
          <Download v-else-if="state.event !== 'DOWNLOADED'" class="w-4 h-4" />
          <RotateCw v-else class="w-4 h-4" />
          <span>{{ actionLabel }}</span>
        </button>
      </div>

      <p v-if="state.event === 'ERROR'" class="text-[10px] text-rose-400 text-center">
        Le téléchargement a échoué. Vérifiez votre connexion ou réessayez plus tard.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Sparkles, Download, RotateCw, Loader2 } from 'lucide-vue-next'
import type { AppUpdateInfo } from '@/types/iptv'
import { UpdaterService, type UpdateProgress } from '@/services/updater'

const updateInfo = ref<AppUpdateInfo | null>(null)
const state = ref<UpdateProgress>({ event: 'PENDING' })
const downloaded = ref(false)
const dismissed = ref(false)

const visible = computed(() => {
  return !!updateInfo.value?.available && !dismissed.value
})

const progressPercent = computed(() => {
  if (!state.value.total || state.value.total === 0) return 0
  const progress = state.value.progress || 0
  return Math.min(100, Math.round((progress / state.value.total) * 100))
})

const actionLabel = computed(() => {
  switch (state.value.event) {
    case 'DOWNLOADING':
      return 'Téléchargement…'
    case 'DOWNLOADED':
      return 'Redémarrer'
    case 'ERROR':
      return 'Réessayer'
    default:
      return 'Mettre à jour'
  }
})

onMounted(async () => {
  try {
    updateInfo.value = await UpdaterService.checkForUpdates()
  } catch {}
})

const handleAction = async () => {
  if (downloaded.value) {
    await UpdaterService.relaunchApp()
    return
  }

  state.value = { event: 'DOWNLOADING', progress: 0, total: 100 }
  const shouldRelaunch = await UpdaterService.installUpdate((s) => {
    state.value = s
  })

  if (shouldRelaunch) {
    downloaded.value = true
    state.value = { event: 'DOWNLOADED' }
  } else {
    state.value = { event: 'ERROR' }
  }
}

const dismiss = () => {
  dismissed.value = true
}
</script>
