
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useDevices } from './useDevices';
import { toast } from 'sonner';

export interface BluetoothDevice {
  id: string;
  device_id?: string;
  bluetooth_mac: string;
  device_name: string;
  device_capabilities: any;
  signal_strength?: number;
  pairing_status: 'discovered' | 'pairing' | 'paired' | 'trusted' | 'blocked';
  last_discovered: string;
  created_at: string;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: any): Promise<any>;
    };
  }
}

export const useBluetoothDiscovery = () => {
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const { user } = useAuth();
  const { currentDevice } = useDevices();

  // Check Bluetooth support
  useEffect(() => {
    if (navigator.bluetooth) {
      setBluetoothSupported(true);
    } else {
      console.log('Web Bluetooth not supported in this browser');
    }
  }, []);

  // Start Bluetooth device scanning
  const startScanning = async () => {
    if (!bluetoothSupported) {
      toast.error('Bluetooth not supported in this browser');
      return;
    }

    if (!user || !currentDevice) {
      toast.error('Please log in and register device first');
      return;
    }

    try {
      setScanning(true);
      
      // Request Bluetooth device access
      const device = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });

      if (device) {
        // Store discovered device
        await storeDiscoveredDevice(device);
        toast.success(`Discovered device: ${device.name || 'Unknown Device'}`);
      }

    } catch (error: any) {
      console.error('Bluetooth scanning error:', error);
      if (error.name === 'NotFoundError') {
        toast.error('No Bluetooth devices found or user cancelled');
      } else {
        toast.error('Failed to scan for Bluetooth devices');
      }
    } finally {
      setScanning(false);
    }
  };

  // Store discovered Bluetooth device
  const storeDiscoveredDevice = async (device: any) => {
    if (!user) return;

    try {
      const deviceData = {
        bluetooth_mac: device.id || `bt_${Date.now()}`,
        device_name: device.name || 'Unknown Bluetooth Device',
        device_capabilities: {
          services: device.uuids || [],
          gatt: device.gatt?.connected || false
        },
        pairing_status: 'discovered' as const
      };

      const { data, error } = await supabase
        .from('bluetooth_devices')
        .upsert(deviceData, {
          onConflict: 'bluetooth_mac'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to discovered devices list
      setDiscoveredDevices(prev => {
        const exists = prev.find(d => d.bluetooth_mac === deviceData.bluetooth_mac);
        if (exists) return prev;
        return [...prev, data as BluetoothDevice];
      });

    } catch (error) {
      console.error('Error storing Bluetooth device:', error);
    }
  };

  // Pair with Bluetooth device
  const pairDevice = async (bluetoothMac: string) => {
    try {
      const { error } = await supabase
        .from('bluetooth_devices')
        .update({ 
          pairing_status: 'paired',
          device_id: currentDevice?.id 
        })
        .eq('bluetooth_mac', bluetoothMac);

      if (error) throw error;

      toast.success('Device paired successfully');
      fetchDevices();
    } catch (error) {
      console.error('Error pairing device:', error);
      toast.error('Failed to pair device');
    }
  };

  // Fetch Bluetooth devices
  const fetchDevices = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('bluetooth_devices')
        .select('*')
        .order('last_discovered', { ascending: false });

      if (error) throw error;

      const devices = (data || []).map(item => ({
        ...item,
        pairing_status: item.pairing_status as BluetoothDevice['pairing_status']
      })) as BluetoothDevice[];
      
      setDiscoveredDevices(devices.filter(d => d.pairing_status === 'discovered'));
      setPairedDevices(devices.filter(d => d.pairing_status === 'paired'));

    } catch (error) {
      console.error('Error fetching Bluetooth devices:', error);
    }
  };

  // Remove Bluetooth device
  const removeDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('bluetooth_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast.success('Device removed');
      fetchDevices();
    } catch (error) {
      console.error('Error removing device:', error);
      toast.error('Failed to remove device');
    }
  };

  useEffect(() => {
    if (user) {
      fetchDevices();
    }
  }, [user]);

  return {
    discoveredDevices,
    pairedDevices,
    scanning,
    bluetoothSupported,
    startScanning,
    pairDevice,
    removeDevice,
    fetchDevices
  };
};
