// Schlanke Typen für die Teile der Spotify Web API, die Betterfy nutzt (Stand: API nach Feb. 2026).

export type Image = { url: string; width?: number | null; height?: number | null };

export type ArtistRef = { id: string; name: string; uri: string };

export type Artist = ArtistRef & { images?: Image[]; genres?: string[] };

export type AlbumRef = {
  id: string;
  name: string;
  uri: string;
  images: Image[];
  artists: ArtistRef[];
  album_type?: string;
  release_date?: string;
  total_tracks?: number;
};

export type Album = AlbumRef & {
  tracks: Paging<Omit<Track, 'album'>>;
  copyrights?: { text: string }[];
};

export type Track = {
  id: string;
  name: string;
  uri: string;
  type: 'track' | 'episode';
  duration_ms: number;
  explicit?: boolean;
  is_local?: boolean;
  track_number?: number;
  artists: ArtistRef[];
  album: AlbumRef;
};

export type Episode = {
  id: string;
  name: string;
  uri: string;
  type: 'episode';
  duration_ms: number;
  images: Image[];
  show?: { id: string; name: string; uri: string; images: Image[] };
};

export type Paging<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
};

export type CursorPaging<T> = {
  items: T[];
  next: string | null;
  cursors?: { after?: string };
  total?: number;
};

export type PlaylistRef = {
  id: string;
  name: string;
  uri: string;
  description?: string | null;
  images: Image[] | null;
  owner: { id: string; display_name?: string | null };
  collaborative?: boolean;
  public?: boolean | null;
  /** neu seit 2026 */
  items?: { total: number; href?: string };
  /** veraltet, wird noch geliefert */
  tracks?: { total: number; href?: string };
};

export type PlaylistEntry = {
  added_at: string | null;
  is_local?: boolean;
  item?: Track | Episode | null;
  /** veraltet */
  track?: Track | Episode | null;
};

export type Playlist = Omit<PlaylistRef, 'items'> & {
  items?: Paging<PlaylistEntry> | { total: number };
};

export type User = {
  id: string;
  display_name: string | null;
  images?: Image[];
  uri: string;
};

export type Device = {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  volume_percent: number | null;
  supports_volume?: boolean;
};

export type PlaybackState = {
  device: Device;
  repeat_state: 'off' | 'track' | 'context';
  shuffle_state: boolean;
  context: { type: string; uri: string } | null;
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: Track | Episode | null;
  currently_playing_type: string;
};

/** Einheitliche Darstellung eines Songs/Episoden für Listen und Player */
export type Playable = {
  id: string;
  uri: string;
  name: string;
  durationMs: number;
  explicit?: boolean;
  artists: ArtistRef[];
  album?: AlbumRef;
  image?: string;
  addedAt?: string | null;
  isLocal?: boolean;
};
