<template>
  <div class="h-9 bg-obsidian-950 border-b border-white/10 flex items-center justify-between select-none tauri-drag-region z-50">
    <!-- Left: Logo & App Title -->
    <div class="flex items-center space-x-2.5 px-3 tauri-no-drag">
      <img src="@/assets/logo.svg" alt="ZkPlayer Logo" class="w-4 h-4" />
      <span class="text-[11px] font-bold tracking-widest text-slate-200 uppercase">
        ZkPlayer <span class="text-brand-accent text-[9px] font-mono px-1 py-0.2 bg-white/5 border border-white/10 rounded-sm">PRO</span>
      </span>
    </div>

    <!-- Center: Active Media Title Badge if playing -->
    <div v-if="playerStore.currentMedia" class="hidden md:flex items-center space-x-2 text-xs text-slate-300 bg-obsidian-900 px-3 py-0.5 rounded border border-white/10">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span class="truncate max-w-xs font-medium text-slate-200 text-[11px]">{{ playerStore.currentMedia.title }}</span>
    </div>

    <!-- Right: Classic Windows Window Controls (Minimize, Maximize/Restore, Fullscreen, Close) -->
    <div class="flex items-center h-full tauri-no-drag">
      <!-- Fullscreen Toggle -->
      <button
        @click="handleFullscreen"
        title="Mode Plein Écran Immersif (F)"
        class="w-9 h-full flex items-center justify-center text-slate-400 hover:text-brand-accent hover:bg-white/5 transition-colors"
      >
        <Maximize2 class="w-3.5 h-3.5" />
      </button>

      <!-- Minimize -->
      <button
        @click="handleMinimize"
        title="Réduire"
        class="w-10 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>

      <!-- Maximize / Restore -->
      <button
        @click="handleMaximize"
        title="Agrandir / Restaurer"
        class="w-10 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
      >
        <Square class="w-3 h-3" />
      </button>

      <!-- Close -->
      <button
        @click="handleClose"
        title="Fermer l'application"
        class="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Minus, Square, Maximize2, X } from 'lucide-vue-next'
import { minimizeWindow, toggleMaximizeWindow, closeWindow, toggleFullscreen } from '@/services/tauri'
import { usePlayerStore } from '@/stores/player'

const playerStore = usePlayerStore()

const handleMinimize = async () => {
  await minimizeWindow()
}

const handleMaximize = async () => {
  await toggleMaximizeWindow()
}

const handleFullscreen = async () => {
  await toggleFullscreen()
}

const handleClose = async () => {
  await closeWindow()
}
</script>
