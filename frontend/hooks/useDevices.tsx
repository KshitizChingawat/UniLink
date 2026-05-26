import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { getBrowserDeviceName, isGenericDeviceName } from '@/lib/device-display';

let cachedDevices: Device[] = [];
let cachedCurrentDevice: Device | null = null;
let cachedDevicesUserId: string | null = null;

export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'browser';
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'browser';
  deviceId: string;
  publicKey?: string;
  lastSeen?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const useDevices = () => {
  const [devices, setDevices] = useState<Device[]>(cachedDevices);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(cachedCurrentDevice);
  const [loading, setLoading] = useState(() => !cachedDevices.length);
  const { user } = useAuth();

  // Generate unique device ID for this browser
  const getOrCreateDeviceId = () => {
    let deviceId = localStorage.getItem('unilink_device_id');
    if (!deviceId) {
      deviceId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('unilink_device_id', deviceId);
    }
    return deviceId;
  };

  const getStoredCurrentDevice = () => {
    const saved = localStorage.getItem('unilink_current_device');
    if (!saved) return null;
    try {
      return JSON.parse(saved) as Partial<Device>;
    } catch {
      localStorage.removeItem('unilink_current_device');
      return null;
    }
  };

  // Register current device
  const registerDevice = async () => {
    if (!user) return null;
    const deviceId = getOrCreateDeviceId();
    const storedDevice = getStoredCurrentDevice();
    const deviceName =
      storedDevice?.deviceName && !isGenericDeviceName(storedDevice.deviceName)
        ? storedDevice.deviceName
        : getBrowserDeviceName();
    try {
      const data = await apiFetch<Device>('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          deviceName,
          deviceType: 'browser',
          platform: 'browser',
          deviceId
        })
      });
      localStorage.setItem('unilink_current_device', JSON.stringify(data));
      cachedCurrentDevice = data;
      setCurrentDevice(data);
      return data;
    } catch (err) {
      console.error('Device registration error:', err);
      return null;
    }
  };

  // Fetch all devices for the user
  const fetchDevices = useCallback(async () => {
    if (!user) return [];
    try {
      const data = await apiFetch<Device[]>('/api/devices');
      cachedDevices = data || [];
      setDevices(cachedDevices);
      const currentDeviceId = cachedCurrentDevice?.id || getStoredCurrentDevice()?.id;
      if (currentDeviceId) {
        const matchedCurrentDevice = cachedDevices.find((device) => device.id === currentDeviceId) || null;
        cachedCurrentDevice = matchedCurrentDevice;
        setCurrentDevice(matchedCurrentDevice);
        if (matchedCurrentDevice) {
          localStorage.setItem('unilink_current_device', JSON.stringify(matchedCurrentDevice));
        }
      }
      return cachedDevices;
    } catch (err) {
      console.error('Fetch devices error:', err);
      return [];
    }
  }, [user]);

  // Update device status
  const updateDeviceStatus = async (deviceId: string, isActive: boolean) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      });

      await fetchDevices();
      toast.success('Device status updated');
    } catch (err) {
      console.error('Update device status error:', err);
    }
  };

  // Remove device
  const removeDevice = async (deviceId: string) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch(`/api/devices/${deviceId}`, {
        method: 'DELETE'
      });

      await fetchDevices();
      toast.success('Device removed successfully');
    } catch (err) {
      console.error('Remove device error:', err);
    }
  };

  useEffect(() => {
    let active = true;

    const bootstrapDevices = async () => {
      if (!user) {
        if (!active) return;
        cachedDevices = [];
        cachedCurrentDevice = null;
        cachedDevicesUserId = null;
        setDevices([]);
        setCurrentDevice(null);
        setLoading(false);
        return;
      }

      const shouldShowLoading = cachedDevicesUserId !== user.id && cachedDevices.length === 0;
      setLoading(shouldShowLoading);

      const storedDevice = getStoredCurrentDevice();
      if (storedDevice) {
        const parsedDevice = storedDevice as Device;
        cachedCurrentDevice = parsedDevice;
        setCurrentDevice(parsedDevice);
      }

      const registeredDevice = await registerDevice();
      const nextDevices = await fetchDevices();

      if (!active) return;

      if (!registeredDevice && currentDevice?.id) {
        const matchedDevice = nextDevices.find((device) => device.id === currentDevice.id) || null;
        cachedCurrentDevice = matchedDevice;
        setCurrentDevice(matchedDevice);
      }

      cachedDevicesUserId = user.id;
      setLoading(false);
    };

    bootstrapDevices();

    return () => {
      active = false;
    };
  }, [user, fetchDevices]);

  useEffect(() => {
    if (!user) return;

    const refreshDevices = () => {
      fetchDevices().catch(() => undefined);
    };

    const interval = window.setInterval(refreshDevices, 2000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDevices();
      }
    };

    window.addEventListener('focus', refreshDevices);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshDevices);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchDevices]);

  return {
    devices,
    currentDevice,
    loading,
    registerDevice,
    fetchDevices,
    updateDeviceStatus,
    removeDevice
  };
};
