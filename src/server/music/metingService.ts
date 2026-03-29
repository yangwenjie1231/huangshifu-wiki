import Meting from '@meting/core';

import { buildPlatformResourceUrl, type MusicPlatform, type MusicResourceType } from './musicUrlParser';

type MetingTrackRaw = {
  id?: string | number;
  name?: string;
  artist?: string[] | string;
  album?: string;
  pic_id?: string | number;
  url_id?: string | number;
  lyric_id?: string | number;
  source?: string;
};

export interface MusicImportTrack {
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  picId: string;
  urlId: string;
  lyricId: string;
  cover: string;
  sourceUrl: string;
}

export interface MusicResourcePreview {
  platform: MusicPlatform;
  type: MusicResourceType;
  id: string;
  title: string;
  artist: string;
  cover: string;
  description: string;
  platformUrl: string;
  songs: MusicImportTrack[];
}

export interface MusicSearchItem {
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  picId: string;
  sourceUrl: string;
}

function createClient(platform: MusicPlatform, formatted = true) {
  const client = new Meting(platform);
  client.format(formatted);
  return client;
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return [value];
  }
  return [];
}

function normalizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeArtist(value: unknown, fallback = '未知歌手') {
  if (Array.isArray(value)) {
    const names = value
      .map((item) => normalizeText(item))
      .filter(Boolean);
    if (names.length) {
      return names.join(' / ');
    }
  }

  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}

function normalizeId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || '';
  }
  return '';
}

async function runFormattedList(
  platform: MusicPlatform,
  runner: (client: Meting) => Promise<string>,
) {
  const client = createClient(platform, true);
  const raw = await runner(client);
  const parsed = parseJsonSafe<unknown>(raw, []);
  return toArray(parsed) as MetingTrackRaw[];
}

async function runRawValue(platform: MusicPlatform, runner: (client: Meting) => Promise<string>) {
  const client = createClient(platform, false);
  const raw = await runner(client);
  return parseJsonSafe<unknown>(raw, {});
}

async function resolvePicById(platform: MusicPlatform, picId: string, fallback = '') {
  if (!picId) {
    return fallback;
  }

  try {
    const client = createClient(platform, true);
    const raw = await client.pic(picId, 500);
    const parsed = parseJsonSafe<unknown>(raw, {});
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { url?: string } | undefined;
      return normalizeText(first?.url, fallback);
    }
    if (parsed && typeof parsed === 'object') {
      return normalizeText((parsed as { url?: string }).url, fallback);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function normalizeTrack(platform: MusicPlatform, track: MetingTrackRaw): MusicImportTrack | null {
  const sourceId = normalizeId(track.id);
  if (!sourceId) {
    return null;
  }

  const title = normalizeText(track.name, `未命名歌曲 ${sourceId}`);
  const artist = normalizeArtist(track.artist);
  const album = normalizeText(track.album, '未知专辑');
  const picId = normalizeId(track.pic_id) || sourceId;
  const urlId = normalizeId(track.url_id) || sourceId;
  const lyricId = normalizeId(track.lyric_id) || sourceId;

  return {
    sourceId,
    title,
    artist,
    album,
    picId,
    urlId,
    lyricId,
    cover: '',
    sourceUrl: buildPlatformResourceUrl(platform, 'song', sourceId),
  };
}

async function enrichTrackCovers(platform: MusicPlatform, tracks: MusicImportTrack[]) {
  const resolved: MusicImportTrack[] = [];
  for (const track of tracks) {
    const cover = await resolvePicById(platform, track.picId, track.cover);
    resolved.push({
      ...track,
      cover,
    });
  }
  return resolved;
}

function uniqueTracksBySourceId(tracks: MusicImportTrack[]) {
  const deduped = new Map<string, MusicImportTrack>();
  tracks.forEach((track) => {
    if (!deduped.has(track.sourceId)) {
      deduped.set(track.sourceId, track);
    }
  });
  return [...deduped.values()];
}

function normalizePreviewMeta(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {
      title: '',
      artist: '',
      cover: '',
      description: '',
    };
  }

  const record = value as Record<string, unknown>;
  return {
    title:
      normalizeText(record.title) ||
      normalizeText(record.name) ||
      normalizeText((record.album as Record<string, unknown> | undefined)?.name),
    artist:
      normalizeArtist(record.artist, '') ||
      normalizeArtist((record.creator as Record<string, unknown> | undefined)?.nickname, ''),
    cover:
      normalizeText(record.cover) ||
      normalizeText(record.coverImgUrl) ||
      normalizeText((record.album as Record<string, unknown> | undefined)?.picUrl) ||
      normalizeText((record.album as Record<string, unknown> | undefined)?.blurPicUrl),
    description:
      normalizeText(record.description) ||
      normalizeText(record.briefDesc),
  };
}

function fallbackPreviewTitle(type: MusicResourceType, id: string) {
  if (type === 'album') {
    return `专辑 ${id}`;
  }
  if (type === 'playlist') {
    return `歌单 ${id}`;
  }
  return `歌曲 ${id}`;
}

function mapSearchTypeToMeting(type: MusicResourceType | 'artist') {
  if (type === 'song') return 1;
  if (type === 'album') return 10;
  if (type === 'artist') return 100;
  return 1000;
}

export async function searchMusicResources(options: {
  platform: MusicPlatform;
  keyword: string;
  type: MusicResourceType | 'artist';
  page?: number;
  limit?: number;
}) {
  const client = createClient(options.platform, true);
  const raw = await client.search(options.keyword, {
    type: mapSearchTypeToMeting(options.type),
    page: options.page || 1,
    limit: options.limit || 20,
  });
  const parsed = parseJsonSafe<unknown>(raw, []);
  const list = toArray(parsed) as MetingTrackRaw[];

  const items: MusicSearchItem[] = list
    .map((item) => {
      const sourceId = normalizeId(item.id);
      if (!sourceId) {
        return null;
      }
      const title = normalizeText(item.name, sourceId);
      const artist = normalizeArtist(item.artist, '未知歌手');
      const album = normalizeText(item.album, '');
      const picId = normalizeId(item.pic_id) || sourceId;

      return {
        sourceId,
        title,
        artist,
        album,
        picId,
        sourceUrl: buildPlatformResourceUrl(options.platform, options.type === 'artist' ? 'song' : options.type, sourceId),
      };
    })
    .filter((item): item is MusicSearchItem => Boolean(item));

  return items;
}

export async function getMusicResourcePreview(
  platform: MusicPlatform,
  type: MusicResourceType,
  id: string,
): Promise<MusicResourcePreview> {
  if (type === 'song') {
    const songs = await runFormattedList(platform, (client) => client.song(id));
    const normalizedTrack = normalizeTrack(platform, songs[0] || { id });
    if (!normalizedTrack) {
      throw new Error('未找到可导入的歌曲');
    }
    const cover = await resolvePicById(platform, normalizedTrack.picId, normalizedTrack.cover);

    return {
      platform,
      type,
      id,
      title: normalizedTrack.title,
      artist: normalizedTrack.artist,
      cover,
      description: '',
      platformUrl: buildPlatformResourceUrl(platform, type, id),
      songs: [
        {
          ...normalizedTrack,
          cover,
        },
      ],
    };
  }

  const formattedTracks = await runFormattedList(
    platform,
    (client) => (type === 'album' ? client.album(id) : client.playlist(id)),
  );
  const normalized = uniqueTracksBySourceId(
    formattedTracks
      .map((track) => normalizeTrack(platform, track))
      .filter((track): track is MusicImportTrack => Boolean(track)),
  );

  if (!normalized.length) {
    throw new Error(type === 'album' ? '专辑暂无可导入歌曲' : '歌单暂无可导入歌曲');
  }

  const withCover = await enrichTrackCovers(platform, normalized);

  let title = '';
  let artist = '';
  let cover = '';
  let description = '';

  try {
    const raw = await runRawValue(
      platform,
      (client) => (type === 'album' ? client.album(id) : client.playlist(id)),
    );

    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const albumMeta = normalizePreviewMeta(record.album);
    const playlistMeta = normalizePreviewMeta(record.playlist);
    const topMeta = normalizePreviewMeta(record);

    title = albumMeta.title || playlistMeta.title || topMeta.title;
    artist = albumMeta.artist || playlistMeta.artist || topMeta.artist;
    cover = albumMeta.cover || playlistMeta.cover || topMeta.cover;
    description = albumMeta.description || playlistMeta.description || topMeta.description;
  } catch {
    title = '';
  }

  if (!title) {
    title = withCover[0]?.album || fallbackPreviewTitle(type, id);
  }
  if (!artist) {
    artist = withCover[0]?.artist || '未知歌手';
  }
  if (!cover) {
    cover = withCover[0]?.cover || '';
  }

  return {
    platform,
    type,
    id,
    title,
    artist,
    cover,
    description,
    platformUrl: buildPlatformResourceUrl(platform, type, id),
    songs: withCover,
  };
}

function extractSingleFieldAsString(payload: unknown, field: string) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  if (Array.isArray(payload)) {
    return extractSingleFieldAsString(payload[0], field);
  }

  const record = payload as Record<string, unknown>;
  const value = record[field];
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

export async function resolveAudioUrl(platform: MusicPlatform, urlId: string) {
  if (!urlId) {
    return '';
  }

  if (platform === 'netease') {
    return `https://music.163.com/song/media/outer/url?id=${urlId}.mp3`;
  }

  try {
    const client = createClient(platform, true);
    const raw = await client.url(urlId, 320);
    const parsed = parseJsonSafe<unknown>(raw, {});
    return extractSingleFieldAsString(parsed, 'url');
  } catch {
    return '';
  }
}

export async function resolveLyric(platform: MusicPlatform, lyricId: string) {
  if (!lyricId) {
    return '';
  }
  try {
    const client = createClient(platform, true);
    const raw = await client.lyric(lyricId);
    const parsed = parseJsonSafe<unknown>(raw, {});
    return extractSingleFieldAsString(parsed, 'lyric');
  } catch {
    return '';
  }
}

export async function resolveCoverUrl(platform: MusicPlatform, picId: string, fallback = '') {
  return resolvePicById(platform, picId, fallback);
}
