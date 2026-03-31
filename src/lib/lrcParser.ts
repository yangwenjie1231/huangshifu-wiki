export interface LRCLine {
  time: number;
  text: string;
}

export interface LRCData {
  lines: LRCLine[];
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    lyricist?: string;
    composer?: string;
    arranger?: string;
  };
}

function parseTime(tag: string): number {
  const match = tag.match(/\[(\d{2}):(\d{2})[:.](\d{2,3})\]/);
  if (!match) {
    const simpleMatch = tag.match(/\[(\d{2}):(\d{2})\]/);
    if (simpleMatch) {
      return parseInt(simpleMatch[1]) * 60 + parseInt(simpleMatch[2]);
    }
    return 0;
  }

  const [, min, sec, ms] = match;
  return parseInt(min) * 60 + parseInt(sec) + (parseInt(ms) / (ms.length === 3 ? 1000 : 100));
}

function parseMetadataTag(tag: string): { key: string; value: string } | null {
  const match = tag.match(/\[(ti|ar|al|by|offset|la|mu|re|ve|km|man|rev|con|phs):([^\]]*)\]/);
  if (!match) return null;
  return { key: match[1], value: match[2].trim() };
}

export function parseLRC(lrc: string): LRCData {
  const lines = lrc.split(/\r?\n/);
  const result: LRCLine[] = [];
  const metadata: LRCData['metadata'] = {};

  const timeRegex = /\[(\d{2}):(\d{2})[:.](\d{2,3})\]/;

  for (const line of lines) {
    const metaTag = parseMetadataTag(line);
    if (metaTag) {
      switch (metaTag.key) {
        case 'ti': metadata.title = metaTag.value; break;
        case 'ar': metadata.artist = metaTag.value; break;
        case 'al': metadata.album = metaTag.value; break;
        case 'lyricist': metadata.lyricist = metaTag.value; break;
        case 'composer': metadata.composer = metaTag.value; break;
        case 're': metadata.arranger = metaTag.value; break;
      }
      continue;
    }

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const time = parseTime(timeMatch[0]);
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time, text });
      }
    } else if (line.trim() && !line.startsWith('[')) {
      result.push({ time: -1, text: line.trim() });
    }
  }

  result.sort((a, b) => a.time - b.time);

  return { lines: result, metadata };
}

export function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function isLRCFormat(lrc: string): boolean {
  return /\[(\d{2}):(\d{2})[:.](\d{2,3})\]/.test(lrc);
}
