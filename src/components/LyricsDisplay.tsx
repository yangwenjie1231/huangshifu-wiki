import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { parseLRC, isLRCFormat, LRCLine } from '../lib/lrcParser';

interface LyricsDisplayProps {
  lyric: string;
  currentTime?: number;
}

export const LyricsDisplay = ({ lyric, currentTime }: LyricsDisplayProps) => {
  const { lines, metadata } = useMemo(() => {
    if (lyric && isLRCFormat(lyric)) {
      return parseLRC(lyric);
    }
    return {
      lines: lyric
        ? lyric.split('\n').map((text, i) => ({ time: i * 3, text: text.trim() } as LRCLine))
        : [],
      metadata: {}
    };
  }, [lyric]);

  const currentLineIndex = useMemo(() => {
    if (currentTime === undefined) return -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].time >= 0 && currentTime >= lines[i].time) {
        return i;
      }
    }
    return -1;
  }, [currentTime, lines]);

  if (lines.length === 0) {
    return <p className="text-sm text-gray-400 italic">暂无歌词</p>;
  }

  const hasMetadata = metadata.lyricist || metadata.composer || metadata.arranger;

  return (
    <div className="space-y-4">
      {hasMetadata && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          {metadata.lyricist && (
            <span>作词：<span className="text-gray-700">{metadata.lyricist}</span></span>
          )}
          {metadata.composer && (
            <span>作曲：<span className="text-gray-700">{metadata.composer}</span></span>
          )}
          {metadata.arranger && (
            <span>编曲：<span className="text-gray-700">{metadata.arranger}</span></span>
          )}
        </div>
      )}

      <div className="space-y-2 text-sm text-gray-600 leading-relaxed max-h-[380px] overflow-y-auto pr-2">
        {lines.map((line, index) => (
          <p
            key={`${line.time}-${index}`}
            className={clsx(
              'transition-all duration-300 py-1',
              currentLineIndex === index
                ? 'text-brand-primary font-bold text-base'
                : currentLineIndex > index
                ? 'text-gray-400'
                : ''
            )}
          >
            {line.text || '\u00A0'}
          </p>
        ))}
      </div>
    </div>
  );
};
