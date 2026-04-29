export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  onEnter?: () => void;
  onExit?: () => void;
}

export class LocationService {
  private static currentLocation: Location | null = null;
  private static geofences: Map<string, GeofenceRegion> = new Map();
  private static watchId: number | null = null;

  static async getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location: Location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude || undefined,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
              timestamp: position.timestamp,
            };

            this.currentLocation = location;
            resolve(location);
          },
          (error) => {
            reject({
              code: error.code,
              message: error.message,
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      } else {
        reject({
          code: 1,
          message: 'Geolocation not supported',
        });
      }
    });
  }

  static watchLocation(
    onUpdate: (location: Location) => void,
    onError?: (error: LocationError) => void,
  ): number {
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp,
        };

        this.currentLocation = location;
        this.checkGeofences(location);
        onUpdate(location);
      },
      (error) => {
        if (onError) {
          onError({
            code: error.code,
            message: error.message,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );

    return this.watchId;
  }

  static stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  static addGeofence(region: GeofenceRegion): void {
    this.geofences.set(region.id, region);
  }

  static removeGeofence(id: string): void {
    this.geofences.delete(id);
  }

  private static checkGeofences(location: Location): void {
    for (const [, region] of this.geofences) {
      const distance = this.haversineDistance(
        location.latitude,
        location.longitude,
        region.latitude,
        region.longitude,
      );

      const isInside = distance <= region.radius;

      // Check if we just entered or exited
      // This is simplified - in production use, track previous state
      if (isInside && region.onEnter) {
        region.onEnter();
      }
    }
  }

  private static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static getCurrentLocation_Cached(): Location | null {
    return this.currentLocation;
  }

  static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return this.haversineDistance(lat1, lon1, lat2, lon2);
  }

  static isWithinRadius(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radiusMeters: number,
  ): boolean {
    const distance = this.haversineDistance(lat1, lon1, lat2, lon2);
    return distance <= radiusMeters;
  }
}
