import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, MapPin, Search, Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: {
      securityJsCode?: string;
      serviceHost?: string;
    };
  }
}

interface PickedLocation {
  lng: number;
  lat: number;
  address: string;
  province: string;
  city: string;
  district: string;
  adcode: string;
}

interface MapPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  initialLocation?: { lng: number; lat: number } | null;
}

const AMAP_JS_API_KEY = import.meta.env.VITE_AMAP_JS_API_KEY as string | undefined;
const AMAP_SECURITY_JS_CODE = import.meta.env.VITE_AMAP_SECURITY_JS_CODE as string | undefined;

let amapLoaded = false;
let amapLoadPromise: Promise<void> | null = null;

async function loadAmap(): Promise<void> {
  if (amapLoaded) return;
  if (amapLoadPromise) return amapLoadPromise;

  amapLoadPromise = new Promise((resolve, reject) => {
    if (!AMAP_JS_API_KEY) {
      reject(new Error('AMAP_JS_API_KEY is not configured'));
      return;
    }

    if (AMAP_SECURITY_JS_CODE) {
      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_JS_CODE,
      };
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_JS_API_KEY}`;
    script.async = true;
    script.onload = () => {
      amapLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load AMap JS API'));
    document.head.appendChild(script);
  });

  return amapLoadPromise;
}

export const MapPickerModal = ({
  open,
  onClose,
  onConfirm,
  initialLocation,
}: MapPickerModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PickedLocation | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const initMap = useCallback(async () => {
    if (!containerRef.current || !open) return;

    try {
      setLoading(true);
      setError(null);
      await loadAmap();

      const defaultCenter = initialLocation || { lng: 116.397428, lat: 39.90923 };
      const map = new window.AMap.Map(containerRef.current, {
        zoom: 13,
        center: [defaultCenter.lng, defaultCenter.lat],
        viewMode: '2D',
      });

      mapRef.current = map;

      map.on('click', async (e: any) => {
        const { lng, lat } = e.lnglat;
        await handleLocationSelect(lng, lat);
      });

      if (initialLocation) {
        await handleLocationSelect(initialLocation.lng, initialLocation.lat);
      }

      setMapReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '地图加载失败');
    } finally {
      setLoading(false);
    }
  }, [open, initialLocation]);

  useEffect(() => {
    if (open) {
      initMap();
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [open, initMap]);

  const handleLocationSelect = async (lng: number, lat: number) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    const marker = new window.AMap.Marker({
      position: [lng, lat],
    });
    markerRef.current = marker;
    mapRef.current.add(marker);

    try {
      const data = await apiGet<{ result?: { formattedAddress: string; province: string; city: string; district: string; adcode: string } }>(
        `/api/regions/resolve?lng=${lng}&lat=${lat}`
      );

      if (data.result) {
        const location: PickedLocation = {
          lng,
          lat,
          address: data.result.formattedAddress,
          province: data.result.province,
          city: data.result.city,
          district: data.result.district,
          adcode: data.result.adcode,
        };
        setSelectedLocation(location);
      }
    } catch (err) {
      console.error('Failed to resolve location:', err);
      setSelectedLocation({
        lng,
        lat,
        address: `${lng.toFixed(6)}, ${lat.toFixed(6)}`,
        province: '',
        city: '',
        district: '',
        adcode: '',
      });
    }
  };

  const handleSearch = async () => {
    const query = searchInputRef.current?.value;
    if (!query || !mapRef.current) return;

    setSearching(true);
    try {
      const data = await apiGet<{ results?: any[] }>(
        `/api/regions/search/address?q=${encodeURIComponent(query)}`
      );
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleResultSelect = async (result: any) => {
    const { coordinate } = result;
    if (!coordinate || !mapRef.current) return;

    mapRef.current.setCenter([coordinate.lng, coordinate.lat]);
    mapRef.current.setZoom(15);
    await handleLocationSelect(coordinate.lng, coordinate.lat);
    setSearchResults([]);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onConfirm(selectedLocation);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-[90vw] h-[80vh] max-w-4xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-bold text-gray-800">选择地点</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索地址..."
              className="w-full pl-10 pr-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="absolute top-32 left-4 right-4 bg-white rounded-xl shadow-lg border z-10 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleResultSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="font-medium text-gray-800">{result.name}</div>
                <div className="text-sm text-gray-500">{result.address}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
                <p className="mt-2 text-gray-500">地图加载中...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-red-400 mx-auto" />
                <p className="mt-2 text-red-500">{error}</p>
                {!AMAP_JS_API_KEY && (
                  <p className="mt-1 text-sm text-gray-400">
                    请在 .env.local 中配置 VITE_AMAP_JS_API_KEY
                  </p>
                )}
              </div>
            </div>
          )}

          <div ref={containerRef} className="w-full h-full" />
        </div>

        {selectedLocation && (
          <div className="px-4 py-3 border-t bg-gray-50">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium text-gray-800">
                  {selectedLocation.province}{selectedLocation.city}{selectedLocation.district}
                </div>
                <div className="text-sm text-gray-500">{selectedLocation.address}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 px-4 py-3 border-t pb-safe">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  );
};

export type { PickedLocation };