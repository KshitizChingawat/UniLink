import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Register current device
  const registerDevice = async () => {
    if (!user) return;

    const deviceId = getOrCreateDeviceId();
    const deviceName = `${navigator.platform} Browser`;
    const token = localStorage.getItem('auth_token');
    
    if (!token) return;

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceName,
          deviceType: 'browser',
          platform: 'browser',
          deviceId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Device registration error:', data.error);
        return;
      }

      setCurrentDevice(data);
    } catch (err) {
      console.error('Device registration error:', err);
    }
  };

  // Fetch all devices for the user
  const fetchDevices = async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch devices error:', data.error);
        return;
      }

      setDevices(data || []);
    } catch (err) {
      console.error('Fetch devices error:', err);
    }
  };

  // Update device status
  const updateDeviceStatus = async (deviceId: string, isActive: boolean) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive })
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Update device status error:', data.error);
        return;
      }

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
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Remove device error:', data.error);
        return;
      }

      await fetchDevices();
      toast.success('Device removed successfully');
    } catch (err) {
      console.error('Remove device error:', err);
    }
  };

  useEffect(() => {
    if (user) {
      registerDevice();
      fetchDevices();
    }
    setLoading(false);
  }, [user]);

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