import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayableMedia, AudioTrackInfo, SubtitleTrackInfo } from '@/types/iptv'
import { isTauri } from '@/services/tauri'
import { openInVlc } from '@/services/web-relay'

export interface VlcNotice {
  id: number
  kind: 'pending' | 'success' | 'error'
  message: string
}

export const usePlayerStore = defineStore('player', () => {
  const currentMedia = ref<PlayableMedia | null>(null)
  const isPlaying = ref(false)
  const isBuffering = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1.0)
  const isMuted = ref(false)
  const isFullscreen = ref(false)

  const audioTracks = ref<AudioTrackInfo[]>([])
  const selectedAudioTrack = ref<number>(-1)

  const subtitleTracks = ref<SubtitleTrackInfo[]>([])
  const selectedSubtitleTrack = ref<number>(-1)

  const seekTarget = ref<number | null>(null)

  // Web mode (plain browser, no Tauri): playback is delegated to VLC through
  // the local server, so no in-app decoding is ever needed.
  const vlcNotice = ref<VlcNotice | null>(null)
  let noticeSeq = 0
  let noticeTimer: ReturnType<typeof setTimeout> | null = null

  function showVlcNotice(kind: VlcNotice['kind'], message: string, autoHideMs = 0) {
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = null
    const id = ++noticeSeq
    vlcNotice.value = { id, kind, message }
    if (autoHideMs > 0) {
      noticeTimer = setTimeout(() => {
        if (vlcNotice.value?.id === id) vlcNotice.value = null
      }, autoHideMs)
    }
  }

  function dismissVlcNotice() {
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = null
    vlcNotice.value = null
  }

  async function sendToVlc(media: PlayableMedia) {
    const title = media.title
    showVlcNotice('pending', `Ouverture dans VLC : ${title}`)
    try {
      await openInVlc(media.streamUrl, title)
      showVlcNotice('success', `Lecture dans VLC : ${title}`, 3500)
    } catch (e) {
      showVlcNotice('error', e instanceof Error ? e.message : String(e), 8000)
    }
  }

  function playMedia(media: PlayableMedia) {
    if (!isTauri()) {
      void sendToVlc(media)
      return
    }
    currentMedia.value = media
    currentTime.value = 0
    duration.value = media.duration || 0
    isPlaying.value = true
    audioTracks.value = []
    selectedAudioTrack.value = -1
    subtitleTracks.value = []
    selectedSubtitleTrack.value = -1
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function setPlaying(playing: boolean) {
    isPlaying.value = playing
  }

  function seekTo(seconds: number) {
    const clamped = Math.max(0, Math.min(seconds, duration.value || 999999))
    currentTime.value = clamped
    seekTarget.value = clamped
  }

  function skipForward(seconds = 10) {
    seekTo(currentTime.value + seconds)
  }

  function skipBackward(seconds = 10) {
    seekTo(currentTime.value - seconds)
  }

  function setVolume(val: number) {
    volume.value = Math.max(0, Math.min(1, val))
    if (volume.value > 0) {
      isMuted.value = false
    }
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
  }

  function closePlayer() {
    currentMedia.value = null
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
  }

  return {
    currentMedia,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    audioTracks,
    selectedAudioTrack,
    subtitleTracks,
    selectedSubtitleTrack,
    seekTarget,
    vlcNotice,
    dismissVlcNotice,
    playMedia,
    togglePlay,
    setPlaying,
    seekTo,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    closePlayer,
  }
})
