export type AuthMode = 'xtream' | 'm3u'

export interface XtreamCredentials {
  serverUrl: string
  username: string
  password: string
}

export interface M3uCredentials {
  playlistUrl: string
  name?: string
}

export interface XtreamUserInfo {
  username: string
  status: string
  exp_date: string
  is_trial: string
  active_cons: string
  max_connections: string
  created_at: string
  allowed_output_formats: string[]
}

export interface XtreamServerInfo {
  url: string
  port: string
  https_port: string
  server_protocol: string
  rtmp_port: string
  timezone: string
  timestamp_now: number
  time_now: string
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo
  server_info: XtreamServerInfo
}

export interface Category {
  category_id: string
  category_name: string
  parent_id?: number
}

export interface LiveChannel {
  num?: number
  name: string
  stream_type: string
  stream_id: number
  stream_icon?: string
  epg_channel_id?: string
  added?: string
  category_id: string
  custom_sid?: string
  tv_archive?: number
  direct_source?: string
  tv_archive_duration?: number
  streamUrl?: string
}

export interface Movie {
  num?: number
  name: string
  stream_type: string
  stream_id: number
  stream_icon?: string
  rating?: string | number
  rating_5based?: number
  added?: string
  category_id: string
  container_extension: string
  custom_sid?: string
  direct_source?: string
  streamUrl?: string
}

export interface MovieInfo {
  tmdb_id?: string
  name?: string
  o_name?: string
  cover_big?: string
  movie_image?: string
  releasedate?: string
  episode_run_time?: string
  youtube_trailer?: string
  genre?: string
  director?: string
  actors?: string
  cast?: string
  description?: string
  plot?: string
  age?: string
  mpaa_rating?: string
  rating_count_only?: number
  rating?: string | number
  duration_secs?: number
  duration?: string
  video?: Record<string, any>
  audio?: Record<string, any>
  bitrate?: number
}

export interface MovieDetail {
  info: MovieInfo
  movie_data: Movie
}

export interface Series {
  num?: number
  name: string
  series_id: number
  cover?: string
  plot?: string
  cast?: string
  director?: string
  genre?: string
  releaseDate?: string
  last_modified?: string
  rating?: string | number
  rating_5based?: number
  category_id: string
  backdrop_path?: string[]
  youtube_trailer?: string
  episode_run_time?: string
  streamUrl?: string
}

export interface Episode {
  id: string
  episode_num: number | string
  title: string
  container_extension: string
  info?: {
    duration_secs?: number
    duration?: string
    video?: Record<string, any>
    audio?: Record<string, any>
    bitrate?: number
    rating?: number | string
    plot?: string
    movie_image?: string
    releasedate?: string
  }
  custom_sid?: string
  added?: string
  season?: number
  streamUrl?: string
}

export interface SeriesDetail {
  seasons: Array<{
    air_date?: string
    episode_count?: number
    id?: number
    name?: string
    overview?: string
    poster_path?: string
    season_number: number
  }>
  info: Series
  episodes: Record<string, Episode[]>
}

export interface EPGProgram {
  id: string
  epg_id: string
  title: string
  lang?: string
  start: string
  end: string
  description: string
  channel_id: string
  start_timestamp: number
  stop_timestamp: number
}

export type MediaType = 'live' | 'movie' | 'series'

export interface PlayableMedia {
  id: string
  title: string
  streamUrl: string
  type: MediaType
  icon?: string
  poster?: string
  backdrop?: string
  duration?: number
  categoryId?: string
  categoryName?: string
  seriesId?: number
  seasonNum?: number
  episodeNum?: number
  episodeTitle?: string
  containerExtension?: string
  nextEpisode?: PlayableMedia
  nextEpisodeLabel?: 'Épisode suivant' | 'Saison suivante'
}

export interface AudioTrackInfo {
  id: number
  label: string
  language: string
  codec: string
}

export interface SubtitleTrackInfo {
  id: number
  label: string
  language: string
}

export interface ContinueWatchingItem {
  id: string
  media: PlayableMedia
  currentTime: number
  duration: number
  lastWatched: number
}

export interface AppUpdateInfo {
  available: boolean
  version: string
  releaseNotes: string
  downloadUrl: string
  pubDate: string
}
