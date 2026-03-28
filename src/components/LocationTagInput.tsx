import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { MapPickerModal, type PickedLocation } from './MapPickerModal';

interface RegionSuggestion {
  code: string;
  name: string;
  fullName: string;
  level: number;
  levelName: string;
  parentCode: string | null;
}

interface LocationTagInputProps {
  value: string | null;
  locationCode: string | null;
  onChange: (fullName: string, code: string) => void;
  onClear: () => void;
}

export const LocationTagInput = ({
  value,
  locationCode,
  onChange,
  onClear,
}: LocationTagInputProps) => {
  const [open, setOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<RegionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/regions/search?q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await response.json();
      setSuggestions(data.regions || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowDropdown(true);
    setSelectedIndex(-1);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(newValue);
    }, 200);
  };

  const handleSelect = (region: RegionSuggestion) => {
    setInputValue(region.fullName);
    onChange(region.fullName, region.code);
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setInputValue('');
    onClear();
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleMapConfirm = async (location: PickedLocation) => {
    try {
      const response = await fetch('/api/regions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lng: location.lng, lat: location.lat }),
      });

      if (!response.ok) {
        console.error('Failed to resolve location');
        return;
      }

      const data = await response.json();
      if (data.result) {
        const adcode = data.result.adcode;
        const fullName = `${data.result.province}${data.result.city}${data.result.district}`.replace(/^(内蒙古自治区|宁夏回族自治区|广西壮族自治区|新疆维吾尔自治区|西藏自治区|特别行政区)/g, (m: string) => m);

        setInputValue(fullName);
        onChange(fullName, adcode);
      }
    } catch (err) {
      console.error('Failed to resolve location:', err);
    }
  };

  const handleFocus = () => {
    if (inputValue && suggestions.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  };

  if (value && !inputValue) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {value}
        </span>
        <button
          onClick={handleClear}
          className="p-0.5 rounded-full hover:bg-gray-200 transition-colors"
          type="button"
        >
          <X className="w-3 h-3 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="输入或选择地点..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          )}
          {!loading && inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200"
              type="button"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setMapPickerOpen(true)}
          className="p-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
          type="button"
          title="在地图上选择"
        >
          <MapPin className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-20 max-h-60 overflow-y-auto"
        >
          {suggestions.map((region, index) => (
            <button
              key={region.code}
              onClick={() => handleSelect(region)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-gray-50' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="font-medium text-gray-800">{region.name}</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">
                  {region.levelName}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5 pl-4.5">
                {region.fullName}
              </div>
            </button>
          ))}
        </div>
      )}

      <MapPickerModal
        open={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
};

export type { RegionSuggestion };