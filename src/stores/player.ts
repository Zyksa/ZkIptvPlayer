import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayableMedia, AudioTrackInfo, SubtitleTrackInfo } from '@/types/iptv'

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

  function playMedia(media: PlayableMedia) {
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
