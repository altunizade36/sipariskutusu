import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PermissionType = 
  | 'camera' 
  | 'photo_library' 
  | 'location' 
  | 'contacts' 
  | 'calendar' 
  | 'notifications';

export type PermissionStatus = 'granted' | 'denied' | 'pending' | 'unknown';

export interface PermissionState {
  camera?: PermissionStatus;
  photo_library?: PermissionStatus;
  location?: PermissionStatus;
  contacts?: PermissionStatus;
  calendar?: PermissionStatus;
  notifications?: PermissionStatus;
}

const PERMISSIONS_KEY = '@sipariskutusu/permissions';
const PERMISSION_REQUESTS_KEY = '@sipariskutusu/permission_requests';

export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PERMISSIONS_KEY);
      if (stored) {
        setPermissions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermission = useCallback(
    async (permission: PermissionType): Promise<boolean> => {
      try {
        // Track permission request
        const requests = await AsyncStorage.getItem(PERMISSION_REQUESTS_KEY);
        const requestData = requests ? JSON.parse(requests) : {};
        requestData[permission] = Date.now();
        await AsyncStorage.setItem(PERMISSION_REQUESTS_KEY, JSON.stringify(requestData));

        // In a real app, you would request from OS
        // For now, return pending
        const updated = { ...permissions, [permission]: 'pending' };
        setPermissions(updated);
        await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
        return true;
      } catch (error) {
        console.error('Failed to request permission:', error);
        return false;
      }
    },
    [permissions],
  );

  const grantPermission = useCallback(
    async (permission: PermissionType) => {
      try {
        const updated = { ...permissions, [permission]: 'granted' };
        setPermissions(updated);
        await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to grant permission:', error);
      }
    },
    [permissions],
  );

  const denyPermission = useCallback(
    async (permission: PermissionType) => {
      try {
        const updated = { ...permissions, [permission]: 'denied' };
        setPermissions(updated);
        await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to deny permission:', error);
      }
    },
    [permissions],
  );

  const getPermissionStatus = useCallback(
    (permission: PermissionType): PermissionStatus => {
      return permissions[permission] || 'unknown';
    },
    [permissions],
  );

  const hasPermission = useCallback(
    (permission: PermissionType): boolean => {
      return getPermissionStatus(permission) === 'granted';
    },
    [getPermissionStatus],
  );

  const resetPermissions = useCallback(async () => {
    try {
      setPermissions({});
      await AsyncStorage.removeItem(PERMISSIONS_KEY);
    } catch (error) {
      console.error('Failed to reset permissions:', error);
    }
  }, []);

  return {
    permissions,
    isLoading,
    requestPermission,
    grantPermission,
    denyPermission,
    getPermissionStatus,
    hasPermission,
    resetPermissions,
  };
}
