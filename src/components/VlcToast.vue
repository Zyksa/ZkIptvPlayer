<template>
  <Transition name="vlc-toast">
    <div
      v-if="notice"
      :key="notice.id"
      role="status"
      aria-live="polite"
      class="fixed bottom-5 right-5 z-[70] max-w-sm flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md"
      :class="notice.kind === 'error'
        ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
        : 'bg-obsidian-900/95 border-white/15 text-slate-100'"
    >
      <Loader2 v-if="notice.kind === 'pending'" class="w-4 h-4 mt-0.5 shrink-0 animate-spin text-brand-accent" />
      <MonitorPlay v-else-if="notice.kind === 'success'" class="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
      <AlertTriangle v-else class="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
      <p class="text-xs leading-relaxed break-words">{{ notice.message }}</p>
      <button
        type="button"
        title="Fermer"
        class="ml-1 -mr-1 text-slate-400 hover:text-slate-100 transition-colors"
        @click="playerStore.dismissVlcNotice()"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Loader2, MonitorPlay, X } from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'

const playerStore = usePlayerStore()
const notice = computed(() => playerStore.vlcNotice)
</script>

<style scoped>
.vlc-toast-enter-active,
.vlc-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.vlc-toast-enter-from,
.vlc-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
