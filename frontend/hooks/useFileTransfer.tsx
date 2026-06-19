import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch, ApiError, getApiUrl, resolveApiBaseUrl } from '@/lib/api';
import { getBrowserDeviceName, isGenericDeviceName } from '@/lib/device-display';

let cachedTransfers: FileTransfer[] = [];
let cachedTransfersUserId: string | null = null;
const uploadSessionStorageKey = 'unilink_upload_sessions';
const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((part) => part.trim());
  const target = parts.find((part) => part.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
};

export interface FileTransfer extends Record<string, unknown> {
  id: string;
  user_id: string;
  sender_device_id: string;
  receiver_device_id?: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  file_hash?: string;
  transfer_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  transfer_method: 'cloud' | 'p2p' | 'local';
  encrypted_metadata?: any;
  created_at: string;
  completed_at?: string;
}

export const useFileTransfer = () => {
  const [transfers, setTransfers] = useState<FileTransfer[]>(cachedTransfers);
  const [loading, setLoading] = useState(() => !cachedTransfers.length);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const activeUploadControllers = useRef<Record<string, Set<XMLHttpRequest>>>({});
  const uploadSessionIds = useRef<Record<string, string>>({});
  const uploadFingerprints = useRef<Record<string, string>>({});
  const uploadDisplayNames = useRef<Record<string, string>>({});
  const { user } = useAuth();
  // Route medium and large files through the resumable chunk path so uploads
  // stay responsive on hosted environments instead of waiting on one big relay.
  const chunkSizeThreshold = 32 * 1024 * 1024;
  const chunkUploadConcurrency = 4;
  const chunkRetryLimit = 5;
  const chunkRequestTimeoutMs = 10 * 60 * 1000;
  const chunkRetryBaseDelayMs = 1_000;
  const processingPollIntervalMs = 2_500;
  const processingPollLimit = 120;
  const csrfToken = getCookieValue('unilink_csrf');

  const getUploadSessionMap = () => {
    if (typeof window === 'undefined') return {} as Record<string, string>;
    try {
      return JSON.parse(localStorage.getItem(uploadSessionStorageKey) || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  };

  const setUploadSessionMap = (value: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(uploadSessionStorageKey, JSON.stringify(value));
  };

  const getFileFingerprint = (file: File, targetDeviceId?: string, transferMethod: 'cloud' | 'p2p' | 'local' = 'cloud') =>
    [user?.id || 'guest', file.name, file.size, file.lastModified, file.type, targetDeviceId || 'all', transferMethod].join(':');

  const getCurrentDeviceId = (): string | null => {
    if (typeof window === 'undefined') return null;
    // First try the full registered device object
    const saved = localStorage.getItem('unilink_current_device');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) return parsed.id;
      } catch {
        localStorage.removeItem('unilink_current_device');
      }
    }
    return null;
  };

  // Auto-register this browser as a device if not already registered
  const ensureDeviceRegistered = async (): Promise<string | null> => {
    const existing = getCurrentDeviceId();
    if (existing) return existing;

    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    try {
      let deviceId = localStorage.getItem('unilink_device_id');
      if (!deviceId) {
        deviceId = `browser_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('unilink_device_id', deviceId);
      }
      const storedDevice = getStoredCurrentDevice();
      const data = await apiFetch<{ id: string }>('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          deviceName:
            storedDevice?.deviceName && !isGenericDeviceName(storedDevice.deviceName)
              ? storedDevice.deviceName
              : getBrowserDeviceName(),
          deviceType: 'browser',
          platform: 'browser',
          deviceId,
        }),
      });
      localStorage.setItem('unilink_current_device', JSON.stringify(data));
      return data.id;
    } catch (err) {
      console.error('Auto device registration failed:', err);
      return null;
    }
  };

  const ensureCurrentDeviceId = async () => {
    const existingDeviceId = getCurrentDeviceId();
    if (existingDeviceId) {
      return existingDeviceId;
    }

    const browserDeviceId =
      localStorage.getItem('unilink_device_id') ||
      `browser_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('unilink_device_id', browserDeviceId);
    const storedDevice = getStoredCurrentDevice();

    const registeredDevice = await apiFetch<{
      id: string;
      deviceId: string;
      deviceName: string;
      deviceType: 'desktop' | 'mobile' | 'tablet' | 'browser';
      platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'browser';
    }>('/api/devices', {
      method: 'POST',
      body: JSON.stringify({
        deviceName:
          storedDevice?.deviceName && !isGenericDeviceName(storedDevice.deviceName)
            ? storedDevice.deviceName
            : getBrowserDeviceName(),
        deviceType: 'browser',
        platform: 'browser',
        deviceId: browserDeviceId,
      }),
    });

    localStorage.setItem('unilink_current_device', JSON.stringify(registeredDevice));
    return registeredDevice.id;
  };

  const registerActiveUpload = (uploadId: string, xhr: XMLHttpRequest) => {
    if (!activeUploadControllers.current[uploadId]) {
      activeUploadControllers.current[uploadId] = new Set();
    }
    activeUploadControllers.current[uploadId].add(xhr);
  };

  const unregisterActiveUpload = (uploadId: string, xhr?: XMLHttpRequest) => {
    if (!activeUploadControllers.current[uploadId]) return;
    if (xhr) {
      activeUploadControllers.current[uploadId].delete(xhr);
    }
    if (!xhr || activeUploadControllers.current[uploadId].size === 0) {
      delete activeUploadControllers.current[uploadId];
    }
  };

  const removeStoredUploadSession = (transferId: string) => {
    const fileFingerprint = uploadFingerprints.current[transferId];
    if (!fileFingerprint) return;
    const nextStoredSessions = getUploadSessionMap();
    delete nextStoredSessions[fileFingerprint];
    setUploadSessionMap(nextStoredSessions);
    delete uploadFingerprints.current[transferId];
  };

  const clearUploadTracking = (transferId: string) => {
    removeStoredUploadSession(transferId);
    delete uploadSessionIds.current[transferId];
    delete uploadDisplayNames.current[transferId];
  };

  const markTransferStatus = (transferId: string, status: FileTransfer['transfer_status']) => {
    cachedTransfers = cachedTransfers.map((transfer) =>
      transfer.id === transferId
        ? {
            ...transfer,
            transfer_status: status,
          }
        : transfer,
    );
    setTransfers(cachedTransfers);
  };

  const rekeyUploadTracking = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setUploadProgress((current) => {
      if (!(fromId in current)) return current;
      const next = { ...current };
      next[toId] = next[fromId];
      delete next[fromId];
      return next;
    });

    if (activeUploadControllers.current[fromId]) {
      activeUploadControllers.current[toId] = activeUploadControllers.current[fromId];
      delete activeUploadControllers.current[fromId];
    }

    if (uploadSessionIds.current[fromId]) {
      uploadSessionIds.current[toId] = uploadSessionIds.current[fromId];
      delete uploadSessionIds.current[fromId];
    }

    if (uploadDisplayNames.current[fromId]) {
      uploadDisplayNames.current[toId] = uploadDisplayNames.current[fromId];
      delete uploadDisplayNames.current[fromId];
    }

    cachedTransfers = cachedTransfers.map((transfer) =>
      transfer.id === fromId ? { ...transfer, id: toId } : transfer,
    );
    setTransfers(cachedTransfers);
  };

  const createPendingTransfer = (
    uploadId: string,
    file: File,
    senderDeviceId: string,
    receiverDeviceId?: string,
    transferMethod: 'cloud' | 'p2p' | 'local' = 'cloud'
  ): FileTransfer => ({
    id: uploadId,
    user_id: user?.id || '',
    sender_device_id: senderDeviceId,
    receiver_device_id: receiverDeviceId,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type || 'application/octet-stream',
    transfer_status: 'in_progress',
    transfer_method: transferMethod,
    created_at: new Date().toISOString(),
  });

  const updateUploadProgress = (
    uploadId: string,
    fileSize: number,
    completedChunkBytes: number,
    activeChunkProgress: Record<number, number>,
  ) => {
    const activeBytes = Object.values(activeChunkProgress).reduce((sum, value) => sum + value, 0);
    const percent = Math.min(98, Math.round(((completedChunkBytes + activeBytes) / fileSize) * 100));
    setUploadProgress((current) => ({
      ...current,
      [uploadId]: percent,
    }));
  };

  const uploadLargeFileInChunks = async (
    uploadId: string,
    sessionUploadId: string,
    chunkSize: number,
    totalChunks: number,
    file: File,
    authToken: string,
    apiBaseUrl: string,
    uploadedChunks: number[] = []
  ) => {
    const uploadedChunkSet = new Set(uploadedChunks);
    let uploadFailed = false;
    let completedChunkBytes = uploadedChunks.reduce((sum, chunkIndex) => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      return sum + (end - start);
    }, 0);
    const activeChunkProgress: Record<number, number> = {};
    updateUploadProgress(uploadId, file.size, completedChunkBytes, activeChunkProgress);

    const missingChunkIndices = Array.from({ length: totalChunks }, (_, index) => index).filter(
      (index) => !uploadedChunkSet.has(index),
    );

    const uploadSingleChunk = async (chunkIndex: number) => {
      if (uploadFailed) return;

      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      for (let attempt = 0; attempt < chunkRetryLimit; attempt += 1) {
        if (uploadFailed) return;

        let xhr: XMLHttpRequest | null = null;
        try {
          await new Promise<void>((resolve, reject) => {
            xhr = new XMLHttpRequest();
            registerActiveUpload(uploadId, xhr);
            xhr.withCredentials = true;
            xhr.open('POST', getApiUrl('/api/file-transfers/chunk', apiBaseUrl));
            xhr.timeout = chunkRequestTimeoutMs;
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            if (csrfToken) {
              xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            }
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.setRequestHeader('X-Upload-Id', sessionUploadId);
            xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));
            xhr.setRequestHeader('X-Total-Chunks', String(totalChunks));

            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              activeChunkProgress[chunkIndex] = event.loaded;
              updateUploadProgress(uploadId, file.size, completedChunkBytes, activeChunkProgress);
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                if (!uploadedChunkSet.has(chunkIndex)) {
                  uploadedChunkSet.add(chunkIndex);
                  completedChunkBytes += chunk.size;
                }
                delete activeChunkProgress[chunkIndex];
                updateUploadProgress(uploadId, file.size, completedChunkBytes, activeChunkProgress);
                resolve();
                return;
              }

              let message = 'Large file chunk upload failed';
              if (xhr.responseText) {
                try {
                  const payload = JSON.parse(xhr.responseText) as Record<string, unknown>;
                  if ('error' in payload) {
                    message = String(payload.error);
                  }
                } catch {
                  message = xhr.responseText;
                }
              }

              reject(new ApiError(message, xhr.status || 400));
            };

            xhr.onerror = () => reject(new Error('Large file upload failed. Please check your connection and try again.'));
            xhr.ontimeout = () => reject(new Error('Large file upload chunk timed out. Retrying...'));
            xhr.onabort = () => reject(new Error('Large file upload was cancelled'));
            xhr.send(chunk);
          });
          return;
        } catch (error) {
          const cancelled = error instanceof Error && /cancelled/i.test(error.message);
          const isFinalAttempt = attempt === chunkRetryLimit - 1;
          if (cancelled || isFinalAttempt) {
            uploadFailed = true;
            activeUploadControllers.current[uploadId]?.forEach((controller) => {
              if (controller !== xhr && controller.readyState !== XMLHttpRequest.DONE) {
                controller.abort();
              }
            });
            if (cancelled) {
              throw error;
            }

            const cause = error instanceof Error ? error.message : 'Unknown upload failure';
            if (error instanceof ApiError) {
              throw new ApiError(`Chunk ${chunkIndex + 1}/${totalChunks} failed after ${chunkRetryLimit} attempts. ${cause}`, error.status);
            }
            throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} failed after ${chunkRetryLimit} attempts. ${cause}`);
          }

          if (error instanceof Error && /exceeded|unsupported|invalid|limit/i.test(error.message)) {
            uploadFailed = true;
            throw error;
          }

          const retryDelayMs = chunkRetryBaseDelayMs * 2 ** attempt;
          await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
        } finally {
          delete activeChunkProgress[chunkIndex];
          updateUploadProgress(uploadId, file.size, completedChunkBytes, activeChunkProgress);
          if (xhr) {
            unregisterActiveUpload(uploadId, xhr);
          }
        }
      }

      throw new Error(`Failed to upload chunk ${chunkIndex + 1}.`);
    };

    let cursor = 0;
    const workers = Array.from({ length: Math.min(chunkUploadConcurrency, missingChunkIndices.length) }, async () => {
      while (!uploadFailed && cursor < missingChunkIndices.length) {
        const currentIndex = cursor;
        cursor += 1;
        await uploadSingleChunk(missingChunkIndices[currentIndex]);
      }
    });

    await Promise.all(workers);
  };

  const pollCompletedTransfer = async (transferId: string) => {
    for (let attempt = 0; attempt < processingPollLimit; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, processingPollIntervalMs));
      try {
        const latestTransfers = await apiFetch<FileTransfer[]>('/api/file-transfers');
        cachedTransfers = latestTransfers || [];
        if (user) {
          cachedTransfersUserId = user.id;
        }
        setTransfers(cachedTransfers);

        const completedTransfer = latestTransfers.find((entry) => entry.id === transferId);
        if (completedTransfer && getTransferFieldValue(completedTransfer, 'transfer_status', 'transferStatus') === 'completed') {
          return completedTransfer;
        }
      } catch {
        // Ignore polling errors; the next poll or background refresh can recover.
      }
    }

    return null;
  };

  const getStoredCurrentDevice = () => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('unilink_current_device');
    if (!saved) return null;
    try {
      return JSON.parse(saved) as { id?: string; deviceName?: string } | null;
    } catch {
      localStorage.removeItem('unilink_current_device');
      return null;
    }
  };

  const getTransferFieldValue = <T = unknown,>(transfer: Record<string, unknown>, ...keys: string[]) => {
    for (const key of keys) {
      if (transfer[key] !== undefined) {
        return transfer[key] as T;
      }
    }
    return undefined;
  };

  // Fetch file transfers
  const fetchTransfers = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const data = await apiFetch<FileTransfer[]>('/api/file-transfers');
      const serverTransfers = data || [];
      const localUploads = cachedTransfers.filter(
        (transfer) =>
          transfer.transfer_status === 'in_progress' &&
          uploadProgress[transfer.id] !== undefined &&
          !serverTransfers.some((serverTransfer) => serverTransfer.id === transfer.id),
      );
      cachedTransfers = [...localUploads, ...serverTransfers];
      cachedTransfersUserId = user.id;
      setTransfers(cachedTransfers);
    } catch (err) {
      console.error('Fetch transfers error:', err);
    }
  }, [user]);

  // Start file transfer
  const startFileTransfer = async (
    file: File,
    targetDeviceId?: string,
    transferMethod: 'cloud' | 'p2p' | 'local' = 'cloud'
  ) => {
    if (!user) {
      toast.error('You must be logged in to transfer files.');
      return;
    }
    const currentDeviceId = await ensureDeviceRegistered();
    if (!currentDeviceId) {
      toast.error('Could not register your device. Please refresh and try again.');
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;
    let uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    uploadDisplayNames.current[uploadId] = file.name;
    const apiBaseUrl = await resolveApiBaseUrl();

    try {
      const currentDeviceId = await ensureCurrentDeviceId();
      const pendingTransfer = createPendingTransfer(uploadId, file, currentDeviceId, targetDeviceId, transferMethod);
      cachedTransfers = [pendingTransfer, ...cachedTransfers.filter((transfer) => transfer.id !== uploadId)];
      cachedTransfersUserId = user.id;
      setTransfers(cachedTransfers);
      setLoading(true);
      setUploadProgress((current) => ({
        ...current,
        [uploadId]: 0,
      }));

      let data: FileTransfer;

      if (file.size > chunkSizeThreshold) {
        const fileFingerprint = getFileFingerprint(file, targetDeviceId, transferMethod);
        uploadFingerprints.current[uploadId] = fileFingerprint;
        const storedSessions = getUploadSessionMap();
        let sessionUploadId = storedSessions[fileFingerprint] || '';
        let init: {
          uploadId: string;
          transferId: string;
          chunkSize: number;
          totalChunks: number;
          uploadedChunks?: number[];
        };

        if (sessionUploadId) {
          try {
            init = await apiFetch<{
              uploadId: string;
              transferId: string;
              chunkSize: number;
              totalChunks: number;
              uploadedChunks: number[];
            }>(`/api/file-transfers/upload-status/${sessionUploadId}`);
            rekeyUploadTracking(uploadId, init.transferId);
            uploadId = init.transferId;
          } catch {
            sessionUploadId = '';
          }
        }

        if (!sessionUploadId) {
          init = await apiFetch<{
            uploadId: string;
            chunkSize: number;
            totalChunks: number;
            uploadedChunks: number[];
            transferId: string;
          }>('/api/file-transfers/initiate', {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type || 'application/octet-stream',
              senderDeviceId: currentDeviceId,
              receiverDeviceId: targetDeviceId,
              transferMethod,
            }),
          });
          sessionUploadId = init.uploadId;
          storedSessions[fileFingerprint] = sessionUploadId;
          setUploadSessionMap(storedSessions);
        }

        rekeyUploadTracking(uploadId, init.transferId);
        uploadId = init.transferId;
        uploadSessionIds.current[uploadId] = sessionUploadId;
        await uploadLargeFileInChunks(uploadId, sessionUploadId, init.chunkSize, init.totalChunks, file, token, apiBaseUrl, init.uploadedChunks || []);

        setUploadProgress((current) => ({
          ...current,
          [uploadId]: 98,
        }));

        const completionResponse = await apiFetch<FileTransfer | { transferId: string; processing: boolean }>('/api/file-transfers/complete-upload', {
          method: 'POST',
          body: JSON.stringify({ uploadId: sessionUploadId }),
        });
        if ('processing' in completionResponse && completionResponse.processing) {
          const completedTransfer = await pollCompletedTransfer((completionResponse as { transferId: string }).transferId);
          if (!completedTransfer) {
            throw new Error('File processing is taking too long. Please keep the app open while we finish syncing it.');
          }
          data = completedTransfer;
        } else {
          data = completionResponse as FileTransfer;
        }
        removeStoredUploadSession(uploadId);
        delete uploadSessionIds.current[uploadId];
      } else {
        data = await new Promise<FileTransfer>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          registerActiveUpload(uploadId, xhr);
          xhr.withCredentials = true;
          xhr.open('POST', getApiUrl('/api/file-transfers/upload', apiBaseUrl));
          xhr.responseType = 'json';
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          if (csrfToken) {
            xhr.setRequestHeader('X-CSRF-Token', csrfToken);
          }
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
          xhr.setRequestHeader('X-File-Size', String(file.size));
          xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
          xhr.setRequestHeader('X-Sender-Device-Id', currentDeviceId);
          xhr.setRequestHeader('X-Transfer-Method', transferMethod);
          if (targetDeviceId) {
            xhr.setRequestHeader('X-Receiver-Device-Id', targetDeviceId);
          }

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress((current) => ({
              ...current,
              [uploadId]: percent,
            }));
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = xhr.response as FileTransfer;
              resolve(response);
              return;
            }

            const payload =
              typeof xhr.response === 'object' && xhr.response
                ? xhr.response
                : (() => {
                    try {
                      return JSON.parse(xhr.responseText);
                    } catch {
                      return null;
                    }
                  })();

            const message =
              payload && typeof payload === 'object' && 'error' in payload
                ? String((payload as Record<string, unknown>).error)
                : 'Failed to start file transfer';

            reject(new ApiError(message, xhr.status || 400));
          };

          xhr.onerror = () => {
            reject(new Error('Upload failed. Check your connection or deployment API settings.'));
          };

          xhr.onabort = () => {
            reject(new Error('Upload was cancelled'));
          };

          xhr.send(file);
        }).finally(() => {
          unregisterActiveUpload(uploadId);
        });
      }

      const normalizedTransfer = {
        ...data,
        user_id: data.user_id || user.id,
      };
      cachedTransfers = [
        normalizedTransfer,
        ...cachedTransfers.filter((transfer) => transfer.id !== normalizedTransfer.id && transfer.id !== uploadId),
      ];
      cachedTransfersUserId = user.id;
      setTransfers(cachedTransfers);
      clearUploadTracking(uploadId);
      void fetchTransfers();
      setUploadProgress((current) => ({
        ...current,
        [uploadId]: 100,
      }));
      toast.success(`File transfer completed: ${file.name}`);
      return data;
    } catch (err) {
      console.error('Start transfer error:', err);
      const cancelled = err instanceof Error && /(cancelled|canceled|aborted)/i.test(err.message);
      markTransferStatus(uploadId, cancelled ? 'cancelled' : 'failed');
      if (cancelled) {
        clearUploadTracking(uploadId);
      }
      const message = cancelled
        ? `${file.name} transfer cancelled`
        : err instanceof ApiError
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Failed to start file transfer';
      if (cancelled) {
        toast.info(message);
      } else {
        toast.error(message);
      }
    } finally {
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[uploadId];
        return next;
      });
      setLoading(false);
    }
  };

  const cancelActiveUpload = (transferId: string) => {
    const xhrSet = activeUploadControllers.current[transferId];
    if (!xhrSet || xhrSet.size === 0) {
      void cancelTransfer(transferId);
      return;
    }

    markTransferStatus(transferId, 'cancelled');
    setUploadProgress((current) => {
      const next = { ...current };
      delete next[transferId];
      return next;
    });
    xhrSet.forEach((xhr) => xhr.abort());
    unregisterActiveUpload(transferId);
    const sessionUploadId = uploadSessionIds.current[transferId];
    if (sessionUploadId) {
      void apiFetch(`/api/file-transfers/upload-session/${sessionUploadId}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
    clearUploadTracking(transferId);
  };

  // Cancel file transfer
  const cancelTransfer = async (transferId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      await apiFetch(`/api/file-transfers/${transferId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          transfer_status: 'cancelled'
        })
      });

      await fetchTransfers();
      toast.success('Transfer cancelled');
    } catch (err) {
      console.error('Cancel transfer error:', err);
      toast.error('Failed to cancel transfer');
    }
  };

  const deleteTransfer = async (transferId: string) => {
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const previousTransfers = cachedTransfers;
    const nextTransfers = cachedTransfers.filter((transfer) => transfer.id !== transferId);

    try {
      cachedTransfers = nextTransfers;
      setTransfers(nextTransfers);
      clearUploadTracking(transferId);
      unregisterActiveUpload(transferId);

      await apiFetch(`/api/file-transfers/${transferId}`, {
        method: 'DELETE',
      });

      await fetchTransfers();
      toast.success('File transfer deleted');
    } catch (err) {
      cachedTransfers = previousTransfers;
      setTransfers(previousTransfers);
      console.error('Delete transfer error:', err);
      toast.error('Failed to delete file transfer');
    }
  };

  // Download file
  const downloadFile = async (transferId: string, fileName: string) => {
    if (!user) return;

    try {
      const data = await apiFetch<{ signedUrl: string; fileName: string }>(`/api/file-transfers/${transferId}/download-link`);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = data.signedUrl;
      a.download = data.fileName || fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('File download started');
    } catch (err) {
      console.error('Download file error:', err);
      toast.error('Failed to download file');
    }
  };

  // Get transfer status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'failed':
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    let active = true;

    const bootstrapTransfers = async () => {
      if (!user) {
        if (!active) return;
        cachedTransfers = [];
        cachedTransfersUserId = null;
        setTransfers([]);
        setLoading(false);
        return;
      }

      const shouldShowLoading = cachedTransfersUserId !== user.id && cachedTransfers.length === 0;
      setLoading(shouldShowLoading);
      await fetchTransfers();
      if (!active) return;
      cachedTransfersUserId = user.id;
      setLoading(false);
    };

    bootstrapTransfers();

    return () => {
      active = false;
    };
  }, [user, fetchTransfers]);

  useEffect(() => {
    if (!user) return;

    const refreshTransfers = () => {
      fetchTransfers().catch(() => undefined);
    };

    const interval = window.setInterval(refreshTransfers, 1500);
    window.addEventListener('focus', refreshTransfers);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTransfers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshTransfers);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchTransfers]);

  return {
    transfers,
    loading,
    uploadProgress,
    uploadDisplayNames: uploadDisplayNames.current,
    startFileTransfer,
    cancelTransfer,
    cancelActiveUpload,
    deleteTransfer,
    downloadFile,
    getStatusColor,
    formatFileSize,
    fetchTransfers
  };
};
