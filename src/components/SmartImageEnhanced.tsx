/**
 * SmartImage 增强版 - v2.1 多模式支持
 * 
 * 新增功能：
 * 1. 多显示模式 (auto/thumbnail/medium/large/original)
 * 2. 模式切换 UI
 * 3. 优化的降级逻辑
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ImageMap } from '../services/imageService';

export type DisplayMode = 'auto' | 'thumbnail' | 'medium' | 'large' | 'original';

export interface SmartImageEnhancedProps {
  imageMap: ImageMap;
  
  mode?: DisplayMode;
  allowModeSwitch?: boolean;
  lazyLoadThreshold?: 'thumbnail' | 'medium' | 'large';
  
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallback?: React.ReactNode;
}

const MODE_LABELS: Record<DisplayMode, { label: string; icon: string; description: string }> = {
  auto: { label: 'Auto', icon: '🤖', description: '自动选择最优质量' },
  thumbnail: { label: 'Small', icon: '🔍', description: '缩略图 (400px)' },
  medium: { label: 'Medium', icon: '📐', description: '中图 (800px)' },
  large: { label: 'Large', icon: '🖼️', description: '大图 (1200px)' },
  original: { label: 'Original', icon: '💾', description: '原图 (无损)' },
};

export const SmartImageEnhanced: React.FC<SmartImageEnhancedProps> = ({
  imageMap,
  mode = 'auto',
  allowModeSwitch = false,
  alt = '',
  className = '',
  style = {},
  onLoad,
  onError,
  fallback,
}) => {
  const [currentMode, setCurrentMode] = useState<DisplayMode>(mode);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 根据当前模式选择最优 URL
  const imageUrl = useMemo(() => {
    switch (currentMode) {
      case 'thumbnail':
        return imageMap.thumbnailUrl || imageMap.mediumUrl || imageMap.largeUrl || imageMap.localUrl;
        
      case 'medium':
        return imageMap.mediumUrl || imageMap.largeUrl || imageMap.thumbnailUrl || imageMap.localUrl;
        
      case 'large':
        return imageMap.largeUrl || imageMap.mediumUrl || imageMap.thumbnailUrl || imageMap.localUrl;
        
      case 'original':
        return imageMap.localUrl;
        
      case 'auto':
      default:
        return selectOptimalUrl(imageMap);
    }
  }, [imageMap, currentMode]);

  // 智能降级 URL 选择
  function selectOptimalUrl(map: ImageMap): string {
    if (!map) return '';

    const priorityList = [
      map.thumbnailUrl,
      map.mediumUrl,
      map.largeUrl,
      map.localUrl,
      map.externalUrl,
      map.s3Url,
    ].filter((url): url is string => Boolean(url));

    return priorityList[0] || '';
  }

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    
    if (currentMode !== 'original' && imageUrl !== imageMap.localUrl) {
      console.warn(`[SmartImage] Failed to load ${currentMode}, falling back to original`);
      setCurrentMode('original');
      return;
    }

    setHasError(true);
    onError?.(new Error(`Failed to load image: ${imageUrl}`));
  }, [currentMode, imageUrl, imageMap.localUrl, onError]);

  const handleModeChange = useCallback((newMode: DisplayMode) => {
    if (newMode === currentMode) return;
    
    setCurrentMode(newMode);
    setIsLoading(true);
    setHasError(false);
  }, [currentMode]);

  // 渲染模式切换器
  const renderModeSwitcher = () => {
    if (!allowModeSwitch) return null;

    return (
      <div className="smart-image-mode-switcher" role="group" aria-label="Image display mode">
        {(Object.keys(MODE_LABELS) as DisplayMode[]).map((modeKey) => (
          <button
            key={modeKey}
            className={`mode-btn ${currentMode === modeKey ? 'active' : ''}`}
            onClick={() => handleModeChange(modeKey)}
            title={`${MODE_LABELS[modeKey].icon} ${MODE_LABELS[modeKey].label} - ${MODE_LABELS[modeKey].description}`}
            aria-label={`Switch to ${MODE_LABELS[modeKey].label} mode`}
            aria-pressed={currentMode === modeKey}
          >
            <span className="mode-icon">{MODE_LABELS[modeKey].icon}</span>
            <span className="mode-label">{MODE_LABELS[modeKey].label}</span>
          </button>
        ))}
      </div>
    );
  };

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div 
      className={`smart-image-enhanced-wrapper ${isLoading ? 'loading' : ''} ${className}`}
      style={style}
    >
      {/* 主图片 */}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transition: 'opacity 0.2s ease-in-out',
          opacity: isLoading ? 0.5 : 1,
        }}
      />

      {/* 加载指示器 */}
      {isLoading && (
        <div className="smart-image-loader" aria-hidden="true">
          <div className="spinner" />
          <span className="loader-text">Loading...</span>
        </div>
      )}

      {/* 模式切换按钮 */}
      {renderModeSwitcher()}

      {/* 当前模式指示器（可选显示） */}
      {currentMode !== 'auto' && allowModeSwitch && (
        <div className="current-mode-badge">
          {MODE_LABELS[currentMode].icon} {MODE_LABELS[currentMode].label}
        </div>
      )}
    </div>
  );
};

export default SmartImageEnhanced;

// ===== CSS 样式（可提取到单独的 CSS 文件中）=====
/*
.smart-image-enhanced-wrapper {
  position: relative;
  display: inline-block;
  overflow: hidden;
}

.smart-image-enhanced-wrapper.loading img {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

.smart-image-loader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #333;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loader-text {
  font-size: 12px;
  color: #666;
}

.smart-image-mode-switcher {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s;
}

.smart-image-enhanced-wrapper:hover .smart-image-mode-switcher {
  opacity: 1;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  white-space: nowrap;
}

.mode-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.mode-btn.active {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  font-weight: 600;
}

.mode-icon {
  font-size: 14px;
}

.mode-label {
  font-size: 11px;
}

.current-mode-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 11px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  z-index: 20;
}
*/
