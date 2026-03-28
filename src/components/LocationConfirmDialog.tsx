import React from 'react';
import { MapPin, Check, X, Loader2 } from 'lucide-react';

interface RegionSuggestion {
  code: string;
  name: string;
  fullName: string;
  level: number;
  levelName: string;
  parentCode: string | null;
}

interface LocationConfirmDialogProps {
  open: boolean;
  detectedLocation: RegionSuggestion | null;
  onConfirm: () => void;
  onChange: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export const LocationConfirmDialog = ({
  open,
  detectedLocation,
  onConfirm,
  onChange,
  onSkip,
  loading,
}: LocationConfirmDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onSkip} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-full">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">检测到拍摄地点</h3>
              <p className="text-sm text-gray-500">是否使用从图片中提取的地点？</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span className="ml-2 text-gray-500">正在解析地点...</span>
            </div>
          ) : detectedLocation ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="font-medium text-amber-800">
                  {detectedLocation.fullName}
                </div>
                <div className="text-sm text-amber-600 mt-1">
                  {detectedLocation.levelName}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  使用该地点
                </button>
                <button
                  onClick={onChange}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  更换地点
                </button>
              </div>

              <button
                onClick={onSkip}
                className="w-full px-4 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
              >
                暂不设置地点
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <p className="text-gray-500">未能在图片中检测到有效的 GPS 信息</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onChange}
                  className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-colors"
                >
                  手动选择地点
                </button>
                <button
                  onClick={onSkip}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  跳过
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type { RegionSuggestion };