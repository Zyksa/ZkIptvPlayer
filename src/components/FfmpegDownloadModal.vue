<template>
  <Transition name="modal">
    <div
      v-if="visible"
      class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
    >
      <div class="bg-obsidian-900 border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-start gap-4">
          <div
            :class="[
              'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 transition-colors',
              progress.phase === 'done'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : progress.phase === 'error'
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'bg-gradient-to-tr from-brand-600 to-brand-accent text-white'
            ]"
          >
            <CheckCircle2 v-if="progress.phase === 'done'" class="w-7 h-7" />
            <AlertTriangle v-else-if="progress.phase === 'error'" class="w-7 h-7" />
            <Film v-else class="w-7 h-7" :class="{ 'animate-pulse': isInstalling }" />
          </div>

          <div class="min-w-0 pt-0.5">
            <h2 class="text-base font-extrabold text-slate-100">{{ title }}</h2>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">{{ description }}</p>
          </div>
        </div>

        <div v-if="isInstalling || progress.phase === 'done'" class="space-y-2.5">
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="text-slate-300">{{ phaseLabel }}</span>
            <span class="text-brand-accent font-semibold">{{ Math.round(overallProgress) }}%</span>
          </div>
          <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden relative">
            <div
              v-if="progress.phase === 'downloading' && progress.total_bytes <= 0"
              class="loader-bar-indeterminate"
            ></div>
            <div
              v-else
              class="h-full rounded-full bg-gradient-to-r from-brand-600 via-brand-accent to-violet-400 transition-[width] duration-300 ease-out"
              :style="{ width: `${overallProgress}%` }"
            ></div>
          </div>
          <div class="min-h-4 flex items-center justify-between gap-3 text-[10px] text-slate-500">
            <span>{{ progressDetail }}</span>
            <span v-if="isInstalling">Vous pouvez laisser l'application ouverte</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="step in steps"
            :key="step.phase"
            :class="[
              'rounded-xl border px-2 py-2.5 text-center transition-colors',
              step.state === 'done'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : step.state === 'active'
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-accent'
                  : 'bg-white/[0.025] border-white/5 text-slate-600'
            ]"
          >
            <component :is="step.icon" class="w-4 h-4 mx-auto mb-1.5" :class="{ 'animate-pulse': step.state === 'active' }" />
            <span class="block text-[9px] font-semibold">{{ step.label }}</span>
          </div>
        </div>

        <div v-if="progress.phase === 'error'" class="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3">
          <p class="text-[11px] text-rose-300 leading-relaxed">
            L'installation n'a pas abouti. Vérifiez votre connexion et l'espace disque disponible, puis réessayez.
          </p>
        </div>

        <div class="flex items-center gap-3 pt-1">
          <button
            v-if="isInstalling"
            type="button"
            @click="dismiss"
            class="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10"
          >
            Continuer en arrière-plan
          </button>

          <template v-else-if="progress.phase !== 'done'">
            <button
              type="button"
              @click="dismiss"
              class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-white/5"
            >
              Plus tard
            </button>
            <button
              type="button"
              @click="install"
              class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs shadow-lg shadow-brand-500/30 active:scale-95"
            >
              {{ progress.phase === 'error' ? 'Réessayer' : 'Installer FFmpeg' }}
            </button>
          </template>
        </div>

        <p v-if="!isInstalling && progress.phase === 'idle'" class="text-[9px] text-slate-600 text-center">
          Environ 90 Mo • nécessaire pour une lecture optimale de certains formats
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle, CheckCircle2, Download, Film, PackageOpen, Settings2 } from 'lucide-vue-next'
import { ensureFfmpeg, getFfmpegStatus, type FfmpegStatus } from '@/services/ffmpeg'

const EMPTY_STATUS: FfmpegStatus = {
  available: false,
  path: '',
  downloading: false,
  phase: 'idle',
  downloaded_bytes: 0,
  total_bytes: 0,
  error: '',
}

const PHASE_LABELS: Record<FfmpegStatus['phase'], string> = {
  idle: 'En attente',
  preparing: 'Préparation…',
  downloading: 'Téléchargement…',
  extracting: 'Extraction…',
  installing: 'Finalisation…',
  done: 'Installation terminée',
  error: 'Installation interrompue',
}

const progress = ref<FfmpegStatus>({ ...EMPTY_STATUS })
const initialized = ref(false)
const dismissed = ref(false)
const showCompletion = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let completionTimer: ReturnType<typeof setTimeout> | null = null

const activePhases = ['preparing', 'downloading', 'extracting', 'installing']
const isInstalling = computed(() => activePhases.includes(progress.value.phase))
const visible = computed(() => initialized.value && !dismissed.value && (!progress.value.available || showCompletion.value))

const title = computed(() => {
  if (progress.value.phase === 'done') return 'FFmpeg est prêt'
  if (progress.value.phase === 'error') return 'Installation interrompue'
  if (isInstalling.value) return 'Installation de FFmpeg'
  return 'FFmpeg recommandé'
})

const description = computed(() => {
  if (progress.value.phase === 'done') return 'Tous les formats audio et vidéo pris en charge sont maintenant disponibles.'
  if (progress.value.phase === 'error') return 'Aucun changement incomplet n’a été appliqué. Vous pouvez relancer l’installation.'
  if (isInstalling.value) return 'ZkPlayer prépare automatiquement les composants nécessaires à la lecture.'
  return 'Installez FFmpeg pour lire correctement les contenus lourds et les formats audio avancés.'
})

const downloadRatio = computed(() => {
  if (progress.value.total_bytes <= 0) return 0
  return Math.min(1, progress.value.downloaded_bytes / progress.value.total_bytes)
})

const overallProgress = computed(() => {
  switch (progress.value.phase) {
    case 'preparing': return 4
    case 'downloading': return progress.value.total_bytes > 0 ? 8 + downloadRatio.value * 78 : 12
    case 'extracting': return 90
    case 'installing': return 97
    case 'done': return 100
    default: return 0
  }
})

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`

const phaseLabel = computed(() => PHASE_LABELS[progress.value.phase])

const progressDetail = computed(() => {
  if (progress.value.phase === 'downloading' && progress.value.total_bytes > 0) {
    return `${formatBytes(progress.value.downloaded_bytes)} / ${formatBytes(progress.value.total_bytes)}`
  }
  if (progress.value.phase === 'extracting') return 'Décompression des fichiers…'
  if (progress.value.phase === 'installing') return 'Vérification et activation…'
  if (progress.value.phase === 'done') return 'Installation réussie'
  return 'Connexion au serveur de téléchargement…'
})

const phaseOrder = computed(() => {
  if (progress.value.phase === 'done') return 3
  if (progress.value.phase === 'installing') return 2
  if (progress.value.phase === 'extracting') return 1
  if (progress.value.phase === 'preparing' || progress.value.phase === 'downloading') return 0
  return -1
})

const steps = computed(() => [
  { phase: 'download', label: 'Télécharger', icon: markRaw(Download), state: phaseOrder.value > 0 ? 'done' : phaseOrder.value === 0 ? 'active' : 'pending' },
  { phase: 'extract', label: 'Extraire', icon: markRaw(PackageOpen), state: phaseOrder.value > 1 ? 'done' : phaseOrder.value === 1 ? 'active' : 'pending' },
  { phase: 'install', label: 'Finaliser', icon: markRaw(Settings2), state: phaseOrder.value > 2 ? 'done' : phaseOrder.value === 2 ? 'active' : 'pending' },
])

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

const finishWithSuccess = () => {
  stopPolling()
  if (completionTimer) clearTimeout(completionTimer)
  progress.value = { ...progress.value, available: true, downloading: false, phase: 'done', error: '' }
  showCompletion.value = true
  completionTimer = setTimeout(() => {
    showCompletion.value = false
    dismissed.value = true
  }, 1400)
}

const refreshProgress = async (announceSuccess = true) => {
  const next = await getFfmpegStatus()
  progress.value = next
  if (next.available && announceSuccess) finishWithSuccess()
  if (next.phase === 'error') {
    dismissed.value = false
    stopPolling()
  }
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(() => void refreshProgress(), 300)
}

const install = async () => {
  dismissed.value = false
  progress.value = { ...EMPTY_STATUS, phase: 'preparing', downloading: true }
  startPolling()
  try {
    await ensureFfmpeg()
    await refreshProgress()
  } catch (error) {
    console.error('FFmpeg installation failed:', error)
    await refreshProgress(false)
    progress.value = { ...progress.value, downloading: false, phase: 'error' }
    dismissed.value = false
    stopPolling()
  }
}

const dismiss = () => {
  dismissed.value = true
}

onMounted(async () => {
  await refreshProgress(false)
  initialized.value = true
  if (isInstalling.value) startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  if (completionTimer) clearTimeout(completionTimer)
})
</script>
