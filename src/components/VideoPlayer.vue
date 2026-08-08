<template>
  <div
    ref="playerContainer"
    class="fixed inset-0 bg-black z-50 flex flex-col justify-between select-none overflow-hidden"
    :style="{ cursor: showControls ? 'default' : 'none' }"
    @mousemove="handleMouseMove"
    @keydown="handleKeyDown"
    tabindex="0"
  >
    <!-- Native Video Element -->
    <div class="relative w-full h-full flex items-center justify-center bg-black" @dblclick="toggleFull">
      <video
        ref="videoRef"
        class="w-full h-full object-contain"
        autoplay
        playsinline
        crossorigin="anonymous"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @waiting="playerStore.isBuffering = true"
        @canplay="onCanPlay"
        @ended="onVideoEnded"
        @error="onVideoError"
        @click="playerStore.togglePlay"
      ></video>

      <!-- Buffering Spinner Overlay -->
      <div v-if="playerStore.isBuffering" class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none animate-fade-in">
        <LoadingSpinner label="Préparation du flux vidéo" />
        <p class="mt-3 text-[10px] font-mono uppercase text-slate-500 tracking-widest">Direct3D11 · FFmpeg</p>
      </div>

      <!-- Error Fallback Banner -->
      <div v-if="streamError" class="absolute inset-0 flex flex-col items-center justify-center bg-obsidian-950/90 p-6 text-center space-y-4">
        <AlertTriangle class="w-12 h-12 text-amber-400 animate-bounce" />
        <div>
          <h3 class="text-base font-bold text-slate-100">Erreur de lecture du flux</h3>
          <p class="text-xs text-slate-400 max-w-md mt-1">{{ streamError }}</p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            @click="launchExternalPlayer"
            class="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-xs shadow-lg flex items-center space-x-1.5"
          >
            <ExternalLink class="w-4 h-4" />
            <span>Ouvrir dans VLC</span>
          </button>
          <button
            @click="retryWithM3u8"
            class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs border border-white/10"
          >
            Mode HLS (.m3u8)
          </button>
        </div>
      </div>

      <!-- Center Play/Pause Indicator -->
      <div v-if="showCenterPlayIcon" class="absolute inset-0 flex items-center justify-center pointer-events-none animate-fade-in">
        <div class="w-20 h-20 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center text-white">
          <Play v-if="!playerStore.isPlaying" class="w-10 h-10 ml-1" />
          <Pause v-else class="w-10 h-10" />
        </div>
      </div>
    </div>

    <!-- Top Floating Header Overlay -->
    <div
      :class="[
        'absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-10',
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      ]"
    >
      <div class="flex items-center space-x-4">
        <button
          @click="closePlayer"
          class="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/10 text-slate-200 transition-colors"
          title="Retour (Échap)"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h2 class="text-sm font-bold text-slate-100 tracking-wide">{{ playerStore.currentMedia?.title }}</h2>
          <div class="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
            <span class="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-accent border border-brand-500/30 uppercase font-semibold">
              {{ playerStore.currentMedia?.type }}
            </span>
            <span v-if="playerStore.currentMedia?.containerExtension" class="uppercase">
              .{{ playerStore.currentMedia.containerExtension }}
            </span>
            <span>• Direct3D11 GPU</span>
            <span v-if="resumingNotice" class="text-amber-400 font-semibold">• Reprise à {{ formatTime(resumingNotice) }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <!-- Open in VLC / External Player Button -->
        <button
          @click="launchExternalPlayer"
          class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold backdrop-blur flex items-center space-x-1.5 transition-all shadow-md"
          title="Lancer avec VLC Media Player"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          <span>Ouvrir dans VLC</span>
        </button>

        <!-- Next Episode Top Button -->
        <button
          v-if="playerStore.currentMedia?.nextEpisode"
          @click="playNextEpisode"
          class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-xs shadow-lg flex items-center space-x-1.5 border border-brand-400/30"
          :title="nextEpisodeLabel"
        >
          <span>{{ nextEpisodeLabel }}</span>
          <SkipForward class="w-3.5 h-3.5 fill-current" />
        </button>

        <button
          @click="toggleAudioBoost"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur border transition-all flex items-center space-x-1.5',
            audioBoostEnabled
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
              : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
          ]"
          title="Amplifier le volume (+6dB Boost)"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>Audio Boost {{ audioBoostEnabled ? '+6dB' : 'OFF' }}</span>
        </button>

        <button
          @click="toggleFav"
          :class="[
            'p-2 rounded-xl backdrop-blur border transition-colors',
            isFav
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
          ]"
          title="Favoris"
        >
          <Heart :class="['w-5 h-5', isFav ? 'fill-current' : '']" />
        </button>
      </div>
    </div>

    <!-- Bottom Controls Overlay -->
    <div
      :class="[
        'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-10 space-y-3',
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      ]"
    >
      <!-- Timeline Seek Bar -->
      <div v-if="playerStore.currentMedia?.type !== 'live'" class="space-y-1">
        <div class="relative flex items-center group cursor-pointer">
          <input
            type="range"
            min="0"
            :max="playerStore.duration || 100"
            step="0.1"
            :value="isScrubbing ? scrubTime : playerStore.currentTime"
            @input="onSeekInput"
            @change="onSeekChange"
            class="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer group-hover:h-2.5 transition-all accent-brand-accent"
          />
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>{{ formatTime(isScrubbing ? scrubTime : playerStore.currentTime) }}</span>
          <span>{{ formatTime(playerStore.duration) }}</span>
        </div>
      </div>

      <!-- Control Buttons Row -->
      <div class="flex items-center justify-between">
        <!-- Left: Play/Pause/Skip -->
        <div class="flex items-center space-x-3">
          <button
            @click="playerStore.togglePlay"
            class="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 transition-transform active:scale-95"
          >
            <Play v-if="!playerStore.isPlaying" class="w-5 h-5 ml-0.5" />
            <Pause v-else class="w-5 h-5" />
          </button>

          <button
            v-if="playerStore.currentMedia?.type !== 'live'"
            @click="playerStore.skipBackward(10)"
            class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="-10 sec (Flèche Gauche)"
          >
            <RotateCcw class="w-5 h-5" />
          </button>

          <button
            v-if="playerStore.currentMedia?.type !== 'live'"
            @click="playerStore.skipForward(10)"
            class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="+10 sec (Flèche Droite)"
          >
            <RotateCw class="w-5 h-5" />
          </button>

          <!-- Next Episode Button in Control Bar -->
          <button
            v-if="playerStore.currentMedia?.nextEpisode"
            @click="playNextEpisode"
            class="p-2 rounded-xl text-brand-accent hover:text-white hover:bg-white/10 transition-colors flex items-center space-x-1"
            :title="nextEpisodeLabel"
          >
            <SkipForward class="w-5 h-5" />
          </button>

          <!-- Volume Controls -->
          <div class="flex items-center space-x-2 pl-2">
            <button @click="playerStore.toggleMute" class="text-slate-300 hover:text-white">
              <VolumeX v-if="playerStore.isMuted || playerStore.volume === 0" class="w-5 h-5 text-rose-400" />
              <Volume2 v-else-if="playerStore.volume > 0.5" class="w-5 h-5" />
              <Volume1 v-else class="w-5 h-5" />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="playerStore.isMuted ? 0 : playerStore.volume"
              @input="onVolumeInput"
              class="w-20 h-1 bg-white/20 rounded appearance-none cursor-pointer accent-brand-accent"
            />
          </div>
        </div>

        <!-- Right: Speed, Audio Tracks, Subtitles, PiP, Fullscreen -->
        <div class="flex items-center space-x-2">
          <!-- Playback Speed Selector (VLC Feature) -->
          <div class="relative">
            <button
              @click="showSpeedMenu = !showSpeedMenu"
              class="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-slate-200 border border-white/10 transition-colors"
            >
              {{ playbackSpeed }}x
            </button>
            <div
              v-if="showSpeedMenu"
              class="absolute bottom-10 right-0 w-32 bg-obsidian-900/95 border border-white/15 rounded-xl p-1.5 shadow-2xl backdrop-blur z-20 space-y-1"
            >
              <p class="text-[9px] font-bold uppercase text-slate-400 px-2 py-0.5 border-b border-white/5">Vitesse de lecture</p>
              <button
                v-for="spd in [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]"
                :key="spd"
                @click="setSpeed(spd)"
                :class="[
                  'w-full text-left px-2.5 py-1 rounded-lg text-xs font-mono flex items-center justify-between',
                  playbackSpeed === spd ? 'bg-brand-500 text-white font-bold' : 'text-slate-300 hover:bg-white/5'
                ]"
              >
                <span>{{ spd }}x</span>
                <span v-if="spd === 1.0" class="text-[9px] opacity-75">Normal</span>
              </button>
            </div>
          </div>

          <!-- Audio Tracks Selector -->
          <div class="relative" v-if="playerStore.audioTracks.length > 0">
            <button
              @click="showAudioMenu = !showAudioMenu"
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 border border-white/10 transition-colors"
            >
              <Music class="w-3.5 h-3.5 text-brand-accent" />
              <span>Audio ({{ playerStore.audioTracks.length }})</span>
            </button>
            <div
              v-if="showAudioMenu"
              class="absolute bottom-10 right-0 w-60 bg-obsidian-900/95 border border-white/15 rounded-xl p-2 shadow-2xl backdrop-blur z-20 space-y-1"
            >
              <p class="text-[10px] font-bold uppercase text-slate-400 px-2 py-1 border-b border-white/5">Pistes Audio Disponibles</p>
              <button
                v-for="track in playerStore.audioTracks"
                :key="track.id"
                @click="selectAudioTrack(track.id)"
                :class="[
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between',
                  playerStore.selectedAudioTrack === track.id
                    ? 'bg-brand-500/20 text-brand-accent font-semibold border border-brand-500/30'
                    : 'text-slate-300 hover:bg-white/5'
                ]"
              >
                <span class="truncate">{{ track.label || `Piste ${track.id}` }}</span>
                <span class="text-[9px] uppercase font-mono text-emerald-400 px-1 rounded bg-emerald-500/10 shrink-0 ml-1">{{ track.codec }}</span>
              </button>
            </div>
          </div>

          <!-- Subtitle Tracks Selector -->
          <div class="relative" v-if="playerStore.subtitleTracks.length > 0">
            <button
              @click="showSubMenu = !showSubMenu"
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 border border-white/10 transition-colors"
            >
              <Subtitles class="w-3.5 h-3.5 text-brand-accent" />
              <span>Sous-titres</span>
            </button>
            <div
              v-if="showSubMenu"
              class="absolute bottom-10 right-0 w-48 bg-obsidian-900/95 border border-white/15 rounded-xl p-2 shadow-2xl backdrop-blur z-20 space-y-1"
            >
              <p class="text-[10px] font-bold uppercase text-slate-400 px-2 py-1 border-b border-white/5">Sélection Sous-titres</p>
              <button
                @click="selectSubtitleTrack(-1)"
                :class="[
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs',
                  playerStore.selectedSubtitleTrack === -1 ? 'bg-brand-500/20 text-brand-accent font-semibold' : 'text-slate-300 hover:bg-white/5'
                ]"
              >
                Désactivé
              </button>
              <button
                v-for="sub in playerStore.subtitleTracks"
                :key="sub.id"
                @click="selectSubtitleTrack(sub.id)"
                :class="[
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs',
                  playerStore.selectedSubtitleTrack === sub.id ? 'bg-brand-500/20 text-brand-accent font-semibold' : 'text-slate-300 hover:bg-white/5'
                ]"
              >
                {{ sub.label || `Sous-titre ${sub.id}` }}
              </button>
            </div>
          </div>

          <!-- Picture in Picture (PiP) -->
          <button
            @click="togglePiP"
            class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Image dans l'image (PiP)"
          >
            <PictureInPicture2 class="w-5 h-5" />
          </button>

          <!-- Fullscreen Button -->
          <button
            @click="toggleFull"
            class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Plein écran (F / Double-clic)"
          >
            <Maximize v-if="!playerStore.isFullscreen" class="w-5 h-5" />
            <Minimize v-else class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type HlsType from 'hls.js'
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, Volume1, VolumeX,
  Maximize, Minimize, ArrowLeft, Heart, Music, Subtitles, Zap, AlertTriangle, SkipForward, ExternalLink, PictureInPicture2
} from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'
import { useIptvStore } from '@/stores/iptv'
import { toggleFullscreen, getProxyStreamUrl, getProxyStreamUrlSync, openInExternalPlayer, getTranscodeDuration } from '@/services/tauri'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const playerStore = usePlayerStore()
const iptvStore = useIptvStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const playerContainer = ref<HTMLDivElement | null>(null)
const showControls = ref(true)
const showCenterPlayIcon = ref(false)
const showAudioMenu = ref(false)
const showSubMenu = ref(false)
const showSpeedMenu = ref(false)
const streamError = ref<string | null>(null)
const audioBoostEnabled = ref(true)
const playbackSpeed = ref(1.0)
const resumingNotice = ref<number | null>(null)

const isScrubbing = ref(false)
const scrubTime = ref(0)
let ffmpegSeekOffset = 0

let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null
let centerIconTimeout: ReturnType<typeof setTimeout> | null = null
let hlsInstance: HlsType | null = null
let audioCtx: AudioContext | null = null
let gainNode: GainNode | null = null
let sourceGeneration = 0
let externalPlayerLaunching = false
let compatibilityTranscodeActive = false

const isFav = computed(() => {
  return playerStore.currentMedia ? iptvStore.isFavorite(playerStore.currentMedia.id) : false
})

const nextEpisodeLabel = computed(() =>
  playerStore.currentMedia?.nextEpisodeLabel || 'Épisode suivant'
)

const toggleFav = () => {
  if (playerStore.currentMedia) {
    iptvStore.toggleFavorite(playerStore.currentMedia)
  }
}

const playNextEpisode = () => {
  if (playerStore.currentMedia?.nextEpisode) {
    playerStore.playMedia(playerStore.currentMedia.nextEpisode)
  }
}

const launchExternalPlayer = async () => {
  const media = playerStore.currentMedia
  if (!media || externalPlayerLaunching) return

  externalPlayerLaunching = true
  videoRef.value?.pause()
  playerStore.setPlaying(false)
  hlsInstance?.stopLoad()

  try {
    const opened = await openInExternalPlayer(media.streamUrl)
    if (opened) {
      closePlayer()
      return
    }

    // If no external application accepted the URL, keep the current player
    // usable instead of leaving it frozen on a failed handoff.
    hlsInstance?.startLoad()
    playerStore.setPlaying(true)
    videoRef.value?.play().catch(() => {})
  } finally {
    externalPlayerLaunching = false
  }
}

const setSpeed = (spd: number) => {
  playbackSpeed.value = spd
  if (videoRef.value) {
    videoRef.value.playbackRate = spd
  }
  showSpeedMenu.value = false
}

const togglePiP = async () => {
  if (!videoRef.value) return
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else {
      await videoRef.value.requestPictureInPicture()
    }
  } catch (e) {
    console.warn('PiP error:', e)
  }
}

let mediaElementSource: MediaElementAudioSourceNode | null = null

const initWebAudio = () => {
  if (!videoRef.value || audioCtx || !audioBoostEnabled.value) return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    audioCtx = new AudioContextClass()

    mediaElementSource = audioCtx.createMediaElementSource(videoRef.value)
    gainNode = audioCtx.createGain()
    gainNode.gain.value = 2.0

    mediaElementSource.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
  } catch (err) {
    console.warn('WebAudio setup notice:', err)
  }
}

const toggleAudioBoost = () => {
  audioBoostEnabled.value = !audioBoostEnabled.value
  if (audioBoostEnabled.value) {
    initWebAudio()
    if (gainNode) gainNode.gain.value = 2.0
  } else if (gainNode) {
    gainNode.gain.value = 1.0
  }
}

const handleMouseMove = () => {
  showControls.value = true
  if (hideControlsTimeout) clearTimeout(hideControlsTimeout)
  hideControlsTimeout = setTimeout(() => {
    if (playerStore.isPlaying) {
      showControls.value = false
      showAudioMenu.value = false
      showSubMenu.value = false
      showSpeedMenu.value = false
    }
  }, 3500)
}

const closePlayer = () => {
  if (videoRef.value && playerStore.currentMedia) {
    iptvStore.saveWatchProgress(playerStore.currentMedia, playerStore.currentTime, playerStore.duration || 0)
  }
  sourceGeneration++
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
  if (videoRef.value) {
    // Closing the underlying resource immediately disconnects the local proxy,
    // which in turn terminates FFmpeg instead of leaving the film streaming in
    // the background after VLC has taken over.
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
    videoRef.value.load()
  }
  if (durationPollTimer) { clearTimeout(durationPollTimer); durationPollTimer = null }
  // DO NOT close audioCtx here, because the video element is reused and createMediaElementSource can only be called once.
  playerStore.closePlayer()
}

const formatTime = (secs: number): string => {
  if (isNaN(secs) || secs < 0) return '00:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const loadSource = async (overrideUrl?: string, forceH264 = compatibilityTranscodeActive) => {
  if (!videoRef.value || !playerStore.currentMedia) return
  const generation = ++sourceGeneration
  streamError.value = null
  resumingNotice.value = null
  ffmpegSeekOffset = 0
  const rawUrl = overrideUrl || playerStore.currentMedia.streamUrl
  const isLive = playerStore.currentMedia.type === 'live'

  // Determine the resume target ONCE and clear seekTarget synchronously (before any
  // await) so the seekTarget watcher cannot race this initial load with a second
  // src assignment that would overwrite our seeked URL.
  let resumeTarget: number | null = playerStore.seekTarget
  playerStore.seekTarget = null
  if (resumeTarget === null && !isLive) {
    const historyItem = iptvStore.continueWatching.find((i) => i.id === playerStore.currentMedia?.id)
    if (historyItem && historyItem.currentTime > 10) {
      resumeTarget = historyItem.currentTime
    }
  }
  if (resumeTarget !== null && resumeTarget > 5) {
    resumingNotice.value = resumeTarget
  }

  // NOTE: no separate ffprobe pass. Duration is parsed from the transcode FFmpeg's
  // own stderr (see pollTranscodeDuration below) to avoid opening a second
  // connection to providers that throttle each connection after a few MB.

  // Call Rust backend to get the correct proxy URL (/transcode with FFmpeg or /proxy fallback)
  let proxiedUrl = await getProxyStreamUrl(rawUrl, isLive)
  if (forceH264 && !isLive && proxiedUrl.includes('/transcode?')) {
    proxiedUrl += '&video=h264'
  }
  if (generation !== sourceGeneration || !videoRef.value || !playerStore.currentMedia) return
  console.log('[ZkPlayer] Stream URL:', rawUrl, '→ proxy:', proxiedUrl, 'live:', isLive)

  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }

  // Only use Hls.js if the URL is an explicit .m3u8 HLS playlist
  if (rawUrl.toLowerCase().includes('.m3u8')) {
    const Hls = (await import('hls.js')).default
    if (generation !== sourceGeneration || !videoRef.value || !playerStore.currentMedia) return
    // For HLS playlists, use a direct /proxy URL so Hls.js can parse the m3u8 text
    const hlsProxyUrl = getProxyStreamUrlSync(rawUrl, isLive).replace('/transcode?', '/proxy?')
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 180,
        maxBufferLength: 120,
        fragLoadingTimeOut: 25000,
        manifestLoadingTimeOut: 25000,
      })
      hlsInstance = hls

      hls.loadSource(hlsProxyUrl)
      hls.attachMedia(videoRef.value)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (generation !== sourceGeneration || hls !== hlsInstance) return
        if (hls.audioTracks) {
          playerStore.audioTracks = hls.audioTracks.map((t, idx) => ({
            id: idx,
            label: t.name || `Piste Audio ${idx + 1}`,
            language: t.lang || 'fr',
            codec: (t as any).codec || (t as any).attrs?.CODECS || 'AAC/AC-3',
          }))
          playerStore.selectedAudioTrack = hls.audioTrack
        }
        if (hls.subtitleTracks) {
          playerStore.subtitleTracks = hls.subtitleTracks.map((s, idx) => ({
            id: idx,
            label: s.name || `Sous-titre ${idx + 1}`,
            language: s.lang || 'fr',
          }))
        }
        // Apply timeline resume for VOD HLS via native currentTime (works once the
        // manifest is parsed; hls.js loads the matching fragment automatically).
        if (resumeTarget !== null && resumeTarget > 5 && videoRef.value) {
          videoRef.value.currentTime = resumeTarget
        }
        videoRef.value?.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (generation !== sourceGeneration || hls !== hlsInstance) return
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              streamError.value = `Impossible de charger le flux (${data.details}).`
              break
          }
        }
      })
    } else {
      videoRef.value.src = hlsProxyUrl
      videoRef.value.play().catch(() => {})
    }
  } else {
    // All other streams (.ts, .mp4, .mkv) go through FFmpeg transcode proxy.
    // Apply the resume target atomically by appending &seek=N so FFmpeg starts
    // (-ss) at the requested position. ffmpegSeekOffset keeps the timeline correct.
    let finalUrl = proxiedUrl
    if (resumeTarget !== null && resumeTarget > 5 && finalUrl.includes('/transcode?')) {
      finalUrl += '&seek=' + resumeTarget.toFixed(1)
      ffmpegSeekOffset = resumeTarget
      playerStore.currentTime = resumeTarget
    }

    videoRef.value.src = finalUrl
    videoRef.value.play().catch((e) => {
      console.warn('Playback start error:', e)
    })

    // Duration for transcode streams can't come from the <video> element (fMP4
    // reports Infinity). FFmpeg prints it on its stderr once it has analyzed the
    // input; poll the backend for it. Guarded by media id so a late result for a
    // previous film can't overwrite the current one's duration.
    pollTranscodeDuration(rawUrl)
  }
}

let durationPollTimer: any = null
const pollTranscodeDuration = (url: string) => {
  if (durationPollTimer) { clearTimeout(durationPollTimer); durationPollTimer = null }
  if (!playerStore.currentMedia) return
  const probeMediaId = playerStore.currentMedia.id
  let attempts = 0
  const tick = async () => {
    durationPollTimer = null
    if (playerStore.currentMedia?.id !== probeMediaId || playerStore.duration > 0) return
    if (attempts++ >= 20) return // ~20s window: FFmpeg may be slow on throttled links
    try {
      const d = await getTranscodeDuration(url)
      if (d > 0 && playerStore.currentMedia?.id === probeMediaId) {
        playerStore.duration = d
        return
      }
    } catch (e) {
      console.warn('transcode duration poll error:', e)
    }
    durationPollTimer = setTimeout(tick, 1000)
  }
  durationPollTimer = setTimeout(tick, 800)
}

const onVideoError = () => {
  if (!playerStore.currentMedia) return
  const rawUrl = playerStore.currentMedia.streamUrl
  const errMsg = videoRef.value?.error ? `Code ${videoRef.value.error.code}: ${videoRef.value.error.message}` : 'unknown'
  console.warn('[ZkPlayer] Video element error:', errMsg, rawUrl)
  if (playerStore.currentMedia.type !== 'live' && !rawUrl.includes('.m3u8') && !compatibilityTranscodeActive) {
    compatibilityTranscodeActive = true
    console.warn('[ZkPlayer] Retrying with H.264 compatibility transcoding...')
    loadSource(undefined, true)
    return
  }
  if (!rawUrl.includes('.m3u8')) {
    console.warn('[ZkPlayer] Attempting HLS (.m3u8) fallback...')
    const m3u8Url = rawUrl.replace(/\.(mkv|mp4|avi|ts)$/, '.m3u8')
    loadSource(m3u8Url)
  } else {
    streamError.value = `Erreur de lecture du flux.\n${errMsg}`
  }
}

const retryWithM3u8 = () => {
  if (!playerStore.currentMedia) return
  const m3u8Url = playerStore.currentMedia.streamUrl.replace(/\.(ts|mp4|mkv)$/, '.m3u8')
  loadSource(m3u8Url)
}

const onLoadedMetadata = () => {
  if (videoRef.value) {
    // If the stream is FFmpeg-transcoded, the browser's duration is wrong (Infinity or a few seconds)
    // NEVER use videoRef.value.duration for proxied streams (because the timeline would break and max at 5 seconds).
    // Only use it for direct streams or HLS if we still have no duration.
    if (!playerStore.duration && videoRef.value.duration && videoRef.value.duration !== Infinity) {
      if (!videoRef.value.src.includes('127.0.0.1:14221') || playerStore.currentMedia?.streamUrl.includes('.m3u8')) {
        playerStore.duration = videoRef.value.duration
      }
    }
    videoRef.value.volume = playerStore.volume
    videoRef.value.muted = playerStore.isMuted
    videoRef.value.playbackRate = playbackSpeed.value
  }
}

const onCanPlay = () => {
  playerStore.isBuffering = false
  if (audioBoostEnabled.value) initWebAudio()
}

const onTimeUpdate = () => {
  if (videoRef.value && !isScrubbing.value) {
    playerStore.currentTime = ffmpegSeekOffset + videoRef.value.currentTime
  }
}

/**
 * Unified seek handler for FFmpeg-transcoded streams.
 * Reloads the source with &seek=N so FFmpeg restarts at the requested timestamp.
 * For HLS/.m3u8 streams, uses native video.currentTime.
 */
const ffmpegSeek = async (targetTime: number) => {
  if (!videoRef.value || !playerStore.currentMedia) return

  const rawUrl = playerStore.currentMedia.streamUrl
  const clamped = Math.max(0, Math.min(targetTime, playerStore.duration || 999999))

  // For HLS, native seek works
  if (rawUrl.toLowerCase().includes('.m3u8')) {
    videoRef.value.currentTime = clamped
    playerStore.currentTime = clamped
    return
  }

  // For FFmpeg transcode streams: reload with seek parameter
  ffmpegSeekOffset = clamped
  playerStore.currentTime = clamped
  const isLiveFfmpegSeek = playerStore.currentMedia.type === 'live'
  let proxiedUrl = await getProxyStreamUrl(rawUrl, isLiveFfmpegSeek)
  if (compatibilityTranscodeActive && !isLiveFfmpegSeek && proxiedUrl.includes('/transcode?')) {
    proxiedUrl += '&video=h264'
  }
  if (proxiedUrl.includes('/transcode?')) {
    let seekUrl = proxiedUrl + '&seek=' + clamped.toFixed(1)
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
    videoRef.value.src = seekUrl
    videoRef.value.play().catch(() => {})
  } else {
    videoRef.value.currentTime = clamped
  }
}

const onSeekInput = (e: Event) => {
  isScrubbing.value = true
  scrubTime.value = parseFloat((e.target as HTMLInputElement).value)
}

const onSeekChange = async (e: Event) => {
  const targetTime = parseFloat((e.target as HTMLInputElement).value)
  isScrubbing.value = false

  if (!videoRef.value || !playerStore.currentMedia) return

  const rawUrl = playerStore.currentMedia.streamUrl

  // For HLS (.m3u8), native seek works fine
  if (rawUrl.toLowerCase().includes('.m3u8')) {
    playerStore.seekTo(targetTime)
    return
  }

  // For FFmpeg-transcoded streams: reload source with &seek=N parameter
  // FFmpeg will use -ss to start at the requested position
  playerStore.currentTime = targetTime
  const isLiveSeek = playerStore.currentMedia.type === 'live'
  const proxiedUrl = await getProxyStreamUrl(rawUrl, isLiveSeek)
  if (proxiedUrl.includes('/transcode?')) {
    let seekUrl = proxiedUrl + '&seek=' + targetTime.toFixed(1)
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
    videoRef.value.src = seekUrl
    videoRef.value.play().catch(() => {})
  } else {
    // Direct proxy: try native seek
    videoRef.value.currentTime = targetTime
  }
}

const onVolumeInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value)
  playerStore.setVolume(val)
  if (videoRef.value) {
    videoRef.value.volume = val
  }
}

const toggleFull = async () => {
  // Sync from the actual window state returned by the backend so the
  // fullscreen icon/state can't desync.
  playerStore.isFullscreen = await toggleFullscreen()
}

const selectAudioTrack = (id: number) => {
  playerStore.selectedAudioTrack = id
  if (hlsInstance) {
    hlsInstance.audioTrack = id
  }
  showAudioMenu.value = false
}

const selectSubtitleTrack = (id: number) => {
  playerStore.selectedSubtitleTrack = id
  if (hlsInstance) {
    hlsInstance.subtitleTrack = id
  }
  showSubMenu.value = false
}

const onVideoEnded = () => {
  if (playerStore.currentMedia?.nextEpisode) {
    playerStore.playMedia(playerStore.currentMedia.nextEpisode)
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === ' ') {
    e.preventDefault()
    playerStore.togglePlay()
    showCenterIcon()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (e.shiftKey) {
      playerStore.skipForward(60) // Jump +1 min
    } else {
      playerStore.skipForward(10)
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (e.shiftKey) {
      playerStore.skipBackward(60) // Jump -1 min
    } else {
      playerStore.skipBackward(10)
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    playerStore.setVolume(playerStore.volume + 0.1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    playerStore.setVolume(playerStore.volume - 0.1)
  } else if (e.key === 'm' || e.key === 'M') {
    e.preventDefault()
    playerStore.toggleMute()
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault()
    toggleFull()
  } else if (e.key === 'Escape') {
    // In fullscreen, Esc only exits fullscreen (reduces the player); it only
    // quits the player when not already fullscreen.
    if (playerStore.isFullscreen) {
      e.preventDefault()
      toggleFull()
    } else {
      closePlayer()
    }
  }
}

const showCenterIcon = () => {
  showCenterPlayIcon.value = true
  if (centerIconTimeout) clearTimeout(centerIconTimeout)
  centerIconTimeout = setTimeout(() => {
    centerIconTimeout = null
    showCenterPlayIcon.value = false
  }, 600)
}

watch(() => playerStore.currentMedia, () => {
  compatibilityTranscodeActive = false
  loadSource()
})

watch(() => playerStore.isPlaying, (playing) => {
  if (!videoRef.value) return
  if (playing) {
    videoRef.value.play().catch(() => {})
  } else {
    videoRef.value.pause()
  }
})

watch(() => playerStore.seekTarget, async (target) => {
  if (target !== null && videoRef.value) {
    playerStore.seekTarget = null
    await ffmpegSeek(target)
  }
})

watch(() => playerStore.volume, (vol) => {
  if (videoRef.value) {
    videoRef.value.volume = vol
  }
})

watch(() => playerStore.isMuted, (muted) => {
  if (videoRef.value) {
    videoRef.value.muted = muted
  }
})

onMounted(() => {
  loadSource()
  if (playerContainer.value) {
    playerContainer.value.focus()
  }
})

onUnmounted(() => {
  sourceGeneration++
  if (hideControlsTimeout) clearTimeout(hideControlsTimeout)
  if (centerIconTimeout) clearTimeout(centerIconTimeout)
  if (hlsInstance) {
    hlsInstance.destroy()
  }
  if (durationPollTimer) { clearTimeout(durationPollTimer); durationPollTimer = null }
  if (audioCtx) {
    audioCtx.close()
  }
})
</script>
