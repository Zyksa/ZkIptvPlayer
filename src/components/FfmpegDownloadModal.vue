<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
  >
    <div class="bg-obsidian-900 border border-white/15 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl text-center">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-accent flex items-center justify-center shadow-lg text-white">
        <Film class="w-7 h-7 animate-pulse" />
      </div>

      <div>
        <h2 class="text-base font-extrabold text-slate-100">FFmpeg requis</h2>
        <p class="text-xs text-slate-400 mt-1">
          ZkPlayer a besoin de FFmpeg pour décoder certains flux audio/vidéo. Il sera téléchargé automatiquement.
        </p>
      </div>

      <div v-if="status === 'downloading'" class="space-y-2">
        <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-brand-accent rounded-full animate-[pulse_2s_infinite] w-full"></div>
        </div>
        <p class="text-[10px] text-slate-400 font-mono">Téléchargement en cours… (~90 Mo)</p>
      </div>

      <div class="flex items-center space-x-3 pt-2">
        <button
          v-if="status !== 'downloading'"
          type="button"
          @click="skip"
          class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-white/5 transition-colors"
        >
          Ignorer
        </button>

        <button
          v-if="status !== 'downloading'"
          type="button"
          @click="download"
          class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs shadow-lg shadow-brand-500/30 transition-transform active:scale-95"
        >
          Télécharger FFmpeg
        </button>
      </div>

      <p v-if="error" class="text-[10px] text-rose-400">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Film } from 'lucide-vue-next'
import { ensureFfmpeg, getFfmpegStatus } from '@/services/ffmpeg'

const status = ref<'idle' | 'downloading' | 'done' | 'error'>('idle')
const error = ref('')

const visible = computed(() => status.value !== 'done')

onMounted(async () => {
  const initial = await getFfmpegStatus()
  if (initial.available) {
    status.value = 'done'
    return
  }
  if (initial.downloading) {
    status.value = 'downloading'
  }
})

const download = async () => {
  status.value = 'downloading'
  error.value = ''
  const path = await ensureFfmpeg()
  if (path) {
    status.value = 'done'
  } else {
    status.value = 'error'
    error.value = 'Le téléchargement a échoué. Vérifiez votre connexion et réessayez.'
  }
}

const skip = () => {
  status.value = 'done'
}
</script>
