import { useEffect, useState } from 'react';
import { locationApi } from '../api/locationApi';
import { District, Neighborhood, Province, Street } from '../types/address';

export function useAddressHierarchy(provinceId?: number, districtId?: number, neighborhoodId?: number) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    locationApi
      .getProvinces()
      .then(setProvinces)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }
    locationApi.getDistricts(provinceId).then(setDistricts);
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) {
      setNeighborhoods([]);
      return;
    }
    locationApi.getNeighborhoods(districtId).then(setNeighborhoods);
  }, [districtId]);

  useEffect(() => {
    if (!neighborhoodId) {
      setStreets([]);
      return;
    }
    locationApi.getStreets(neighborhoodId).then(setStreets);
  }, [neighborhoodId]);

  return {
    provinces,
    districts,
    neighborhoods,
    streets,
    isLoading,
  };
}
