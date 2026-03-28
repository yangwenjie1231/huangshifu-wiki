import axios from 'axios';

const AMAP_WEB_SERVICE_KEY = process.env.AMAP_API_KEY || '';
const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface AddressComponent {
  province: string;
  city: string;
  district: string;
  township?: string;
}

export interface GeocodingResult {
  coordinate: Coordinate;
  address: string;
  province: string;
  city: string;
  district: string;
  township?: string;
  adcode: string;
}

export interface RegionResolveResult {
  coordinate: Coordinate;
  province: string;
  provinceCode: string;
  city: string;
  cityCode: string;
  district: string;
  districtCode: string;
  adcode: string;
  formattedAddress: string;
}

async function amapGet<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  if (!AMAP_WEB_SERVICE_KEY) {
    console.warn('AMAP_API_KEY is not configured');
    return null;
  }

  try {
    const response = await axios.get(`${AMAP_BASE_URL}${endpoint}`, {
      params: {
        key: AMAP_WEB_SERVICE_KEY,
        ...params,
      },
      timeout: 10000,
    });

    if (response.data.status !== '1') {
      console.error('Amap API error:', response.data.info);
      return null;
    }

    return response.data as T;
  } catch (error) {
    console.error('Amap request failed:', error);
    return null;
  }
}

export async function addressToCoordinate(address: string): Promise<Coordinate | null> {
  interface GeocodeResponse {
    status: string;
    geocodes: Array<{
      location: string;
      adcode: string;
    }>;
  }

  const data = await amapGet<GeocodeResponse>('/geocode/geo', {
    address,
    output: 'json',
  });

  if (!data || !data.geocodes || data.geocodes.length === 0) {
    return null;
  }

  const [lng, lat] = data.geocodes[0].location.split(',').map(Number);
  if (isNaN(lng) || isNaN(lat)) {
    return null;
  }

  return { lng, lat };
}

export async function coordinateToAddress(lng: number, lat: number): Promise<GeocodingResult | null> {
  interface RegeoResponse {
    status: string;
    regeocode: {
      addressComponent: {
        province: string;
        city: string;
        district: string;
        township: string;
        adcode: string;
      };
      formatted_address: string;
    };
  }

  const data = await amapGet<RegeoResponse>('/geocode/regeo', {
    location: `${lng},${lat}`,
    extensions: 'base',
    output: 'json',
  });

  if (!data || !data.regeocode) {
    return null;
  }

  const { addressComponent, formatted_address } = data.regeocode;

  return {
    coordinate: { lng, lat },
    address: formatted_address,
    province: addressComponent.province,
    city: addressComponent.city,
    district: addressComponent.district,
    township: addressComponent.township,
    adcode: addressComponent.adcode,
  };
}

export async function resolveCoordinateToRegion(lng: number, lat: number): Promise<RegionResolveResult | null> {
  const addressResult = await coordinateToAddress(lng, lat);
  if (!addressResult) {
    return null;
  }

  return {
    coordinate: { lng, lat },
    province: addressResult.province,
    provinceCode: addressResult.adcode.slice(0, 2) + '0000',
    city: addressResult.city || addressResult.province,
    cityCode: addressResult.adcode.slice(0, 4) + '00',
    district: addressResult.district,
    districtCode: addressResult.adcode,
    adcode: addressResult.adcode,
    formattedAddress: addressResult.address,
  };
}

export async function searchAddress(keyword: string, city?: string): Promise<Array<{
  name: string;
  address: string;
  coordinate: Coordinate;
  adcode: string;
}>> {
  interface TextSearchResponse {
    status: string;
    suggestions: Array<{
      name: string;
      location: string;
      address: string;
      adcode: string;
    }>;
  }

  const params: Record<string, string> = {
    keywords: keyword,
    output: 'json',
  };

  if (city) {
    params.city = city;
  }

  const data = await amapGet<TextSearchResponse>('/place/text', params);

  if (!data || !data.suggestions) {
    return [];
  }

  return data.suggestions.map((s) => {
    const [lng, lat] = s.location.split(',').map(Number);
    return {
      name: s.name,
      address: s.address,
      coordinate: { lng: isNaN(lng) ? 0 : lng, lat: isNaN(lat) ? 0 : lat },
      adcode: s.adcode,
    };
  });
}

export function isAmapConfigured(): boolean {
  return Boolean(AMAP_WEB_SERVICE_KEY);
}