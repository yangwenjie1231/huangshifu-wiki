import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock axios
vi.mock('axios');

// Import after mocking
import {
  addressToCoordinate,
  coordinateToAddress,
  resolveCoordinateToRegion,
  searchAddress,
  isAmapConfigured,
  type Coordinate,
  type GeocodingResult,
  type RegionResolveResult,
} from '../../src/server/location/geoService';

describe('geoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAmapConfigured', () => {
    it('is a function', () => {
      expect(typeof isAmapConfigured).toBe('function');
    });

    it('returns boolean', () => {
      const result = isAmapConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('addressToCoordinate', () => {
    it('is a function', () => {
      expect(typeof addressToCoordinate).toBe('function');
    });
  });

  describe('coordinateToAddress', () => {
    it('is a function', () => {
      expect(typeof coordinateToAddress).toBe('function');
    });
  });

  describe('resolveCoordinateToRegion', () => {
    it('is a function', () => {
      expect(typeof resolveCoordinateToRegion).toBe('function');
    });
  });

  describe('searchAddress', () => {
    it('is a function', () => {
      expect(typeof searchAddress).toBe('function');
    });
  });

  describe('Coordinate type', () => {
    it('accepts valid coordinate', () => {
      const coord: Coordinate = { lng: 116.397428, lat: 39.90923 };
      expect(coord.lng).toBe(116.397428);
      expect(coord.lat).toBe(39.90923);
    });
  });

  describe('GeocodingResult type', () => {
    it('accepts valid result', () => {
      const result: GeocodingResult = {
        coordinate: { lng: 116.397428, lat: 39.90923 },
        address: '北京市朝阳区',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        adcode: '110105',
      };
      expect(result.address).toBe('北京市朝阳区');
    });
  });

  describe('RegionResolveResult type', () => {
    it('accepts valid result', () => {
      const result: RegionResolveResult = {
        coordinate: { lng: 116.397428, lat: 39.90923 },
        province: '北京市',
        provinceCode: '110000',
        city: '北京市',
        cityCode: '110100',
        district: '朝阳区',
        districtCode: '110105',
        adcode: '110105',
        formattedAddress: '北京市朝阳区',
      };
      expect(result.provinceCode).toBe('110000');
    });
  });
});
