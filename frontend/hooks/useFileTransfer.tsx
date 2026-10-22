import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { apiFetch, ApiError, getApiUrl, resolveApiBaseUrl } from '@/lib/api';
import { getBrowserDeviceName, isGenericDeviceName } from '@/lib/device-display';

let cachedTransfers: FileTransfer[] = [];
let cachedTransfersUserId: string | null = null;
// Shared across every hook instance (DashboardHome, FileTransferPage, ...) so
// several mounted components never fire duplicate list requests at once.
let transfersFetchInFlight: Promise<FileTransfer[]> | null = null;
// Uploads whose chunks all reached storage but whose finalize call was lost
// (page reload, proxy error, server restart) are completed once per session.
let interruptedUploadRecoveryUserId: string | null = null;
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
  // camelCase aliases exposed by the API and used by some dashboard widgets.
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  transferStatus?: FileTransfer['transfer_status'];
  transferMethod?: FileTransfer['transfer_method'];
  createdAt?: string;
  completedAt?: string;
  senderDeviceId?: string;
  receiverDeviceId?: string;
}

// The API stores/returns camelCase records while older UI code expects
// snake_case. Normalize to both shapes once so status, size, and name checks
// behave identically everywhere.
const normalizeTransferRecord = (transfer: Record<string, unknown>): FileTransfer => {
  const fileName = String(transfer.file_name ?? transfer.fileName ?? 'file');
  const fileSize = Number(transfer.file_size ?? transfer.fileSize ?? 0);
  const fileType = String(transfer.file_type ?? transfer.fileType ?? 'application/octet-stream');
  const transferStatus = String(
    transfer.transfer_status ?? transfer.transferStatus ?? 'pending',
  ) as FileTransfer['transfer_status'];
  const transferMethod = String(
    transfer.transfer_method ?? transfer.transferMethod ?? 'cloud',
  ) as FileTransfer['transfer_method'];
  const createdAt = String(transfer.created_at ?? transfer.createdAt ?? new Date().toISOString());
  const senderDeviceId = String(transfer.sender_device_id ?? transfer.senderDeviceId ?? '');
  const receiverValue = transfer.receiver_device_id ?? transfer.receiverDeviceId;
  const receiverDeviceId = receiverValue ? String(receiverValue) : undefined;
  const completedValue = transfer.completed_at ?? transfer.completedAt;
  const completedAt = completedValue ? String(completedValue) : undefined;

  return {
    ...(transfer as FileTransfer),
    id: String(transfer.id ?? ''),
    user_id: String(transfer.user_id ?? transfer.userId ?? ''),
    sender_device_id: senderDeviceId,
    receiver_device_id: receiverDeviceId,
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    file_hash: transfer.file_hash ? String(transfer.file_hash) : undefined,
    transfer_status: transferStatus,
    transfer_method: transferMethod,
    created_at: createdAt,
    completed_at: completedAt,
    fileName,
    fileSize,
    fileType,
    transferStatus,
    transferMethod,
    createdAt,
    completedAt,
    senderDeviceId,
    receiverDeviceId,
  };
};

const requestTransfers = async () => {
  if (transfersFetchInFlight) {
    return transfersFetchInFlight;
  }

  transfersFetchInFlight = apiFetch<FileTransfer[]>('/api/file-transfers')
    .then((data) => (data || []).map((entry) => normalizeTransferRecord(entry as Record<string, unknown>)))
    .finally(() => {
      transfersFetchInFlight = null;
    });

  return transfersFetchInFlight;
};

// Access tokens live for 30 minutes by default. A large upload can easily run
// longer, so refresh shortly before expiry (and share one refresh across all
// in-flight chunks) instead of letting every chunk start returning 401.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
let tokenRefreshInFlight: Promise<string> | null = null;

const getJwtExpiryMs = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const refreshAuthToken = (fallbackToken: string) => {
  if (tokenRefreshInFlight) {
    return tokenRefreshInFlight;
  }

  tokenRefreshInFlight = apiFetch<{ token?: string }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ rememberMe: localStorage.getItem('remember-me') === 'true' }),
  })
    .then((data) => {
      const nextToken = typeof data?.token === 'string' ? data.token : '';
      if (!nextToken) return fallbackToken;
      localStorage.setItem('auth_token', nextToken);
      return nextToken;
    })
    .catch(() => fallbackToken)
    .finally(() => {
      tokenRefreshInFlight = null;
    });

  return tokenRefreshInFlight;
};

const ensureFreshAuthToken = async (token: string, force = false) => {
  if (!token) return token;
  const expiresAt = getJwtExpiryMs(token);
  if (!expiresAt) return token;
  if (!force && expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return token;
  }
  return refreshAuthToken(token);
};

export const useFileTransfer = () => {
  const [transfers, setTransfers] = useState<FileTransfer[]>(cachedTransfers);
  const [loading, setLoading] = useState(() => !cachedTransfers.length);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const activeUploadControllers = useRef<Record<string, Set<XMLHttpRequest>>>({});
  // Tracks uploads that are active in this tab, keyed by the id currently shown
  // in the list. The list poll uses this instead of render state so an
  // in-flight transfer is never dropped between server refreshes.
  const activeUploadIds = useRef<Record<string, boolean>>({});
  const uploadSessionIds = useRef<Record<string, string>>({});
  const uploadFingerprints = useRef<Record<string, string>>({});
  const uploadDisplayNames = useRef<Record<string, string>>({});
  const { user } = useAuth();
  // Route medium and large files through the resumable chunk path so uploads
  // stay responsive on hosted environments instead of waiting on one big relay.
  const chunkSizeThreshold = 32 * 1024 * 1024;
  // Browsers open ~6 parallel connections per host; saturating them keeps large
  // uploads at full bandwidth while each 8 MB chunk stays cheap to retry.
  const chunkUploadConcurrency = 6;
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

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
            transferStatus: status,
          }
        : transfer,
    );
    setTransfers(cachedTransfers);
  };

  // Persist a terminal status on the server. Without this, a failed chunk
  // upload only existed in this tab's memory: the next 4 s list poll replaced
  // it with the server's "in_progress" record and the transfer appeared stuck
  // forever. Local-only placeholder ids ("upload-...") are ignored.
  const syncTransferStatus = async (
    transferId: string,
    status: FileTransfer['transfer_status'],
  ) => {
    if (!transferId || transferId.startsWith('upload-')) return;
    try {
      await apiFetch(`/api/file-transfers/${transferId}`, {
        method: 'PATCH',
        body: JSON.stringify({ transfer_status: status }),
      });
    } catch {
      // Best effort: the next list refresh still shows the server's view.
    }
  };

  const clearUploadProgress = (uploadId: string) => {
    setUploadProgress((current) => {
      if (!(uploadId in current)) return current;
      const next = { ...current };
      delete next[uploadId];
      return next;
    });
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

    if (activeUploadIds.current[fromId]) {
      activeUploadIds.current[toId] = true;
      delete activeUploadIds.current[fromId];
    }

    if (uploadSessionIds.current[fromId]) {
      uploadSessionIds.current[toId] = uploadSessionIds.current[fromId];
      delete uploadSessionIds.current[fromId];
    }

    if (uploadFingerprints.current[fromId]) {
      uploadFingerprints.current[toId] = uploadFingerprints.current[fromId];
      delete uploadFingerprints.current[fromId];
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
  ): FileTransfer =>
    normalizeTransferRecord({
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
    // Keep the access token fresh for the whole upload. A large file can take
    // longer than the token lifetime; refreshing here (shared across parallel
    // chunks) prevents every remaining chunk from failing with 401.
    let activeAuthToken = authToken;

    const missingChunkIndices = Array.from({ length: totalChunks }, (_, index) => index).filter(
      (index) => !uploadedChunkSet.has(index),
    );

    const uploadSingleChunk = async (chunkIndex: number) => {
      if (uploadFailed) return;

      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      let authRetryAfterRefresh = false;
      for (let attempt = 0; attempt < chunkRetryLimit; attempt += 1) {
        if (uploadFailed) return;

        activeAuthToken = await ensureFreshAuthToken(
          localStorage.getItem('auth_token') || activeAuthToken,
        );
        if (uploadFailed) return;

        let xhr: XMLHttpRequest | null = null;
        try {
          await new Promise<void>((resolve, reject) => {
            xhr = new XMLHttpRequest();
            registerActiveUpload(uploadId, xhr);
            xhr.withCredentials = true;
            xhr.open('POST', getApiUrl('/api/file-transfers/chunk', apiBaseUrl));
            xhr.timeout = chunkRequestTimeoutMs;
            xhr.setRequestHeader('Authorization', `Bearer ${activeAuthToken}`);
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
          const authFailure = error instanceof ApiError && error.status === 401;
          if (authFailure && !authRetryAfterRefresh && !isFinalAttempt && !cancelled) {
            // Token rotated between the proactive check and the request (or the
            // server rejected an old one): get a new token and retry at once.
            authRetryAfterRefresh = true;
            activeAuthToken = await ensureFreshAuthToken(activeAuthToken, true);
            continue;
          }
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
        const latestTransfers = (await apiFetch<FileTransfer[]>('/api/file-transfers') || []).map((entry) =>
          normalizeTransferRecord(entry as Record<string, unknown>),
        );
        cachedTransfers = latestTransfers || [];
        if (user) {
          cachedTransfersUserId = user.id;
        }
        setTransfers(cachedTransfers);

        const completedTransfer = latestTransfers.find((entry) => entry.id === transferId);
        if (completedTransfer) {
          const status = getTransferFieldValue(completedTransfer, 'transfer_status', 'transferStatus');
          if (status === 'completed') {
            return completedTransfer;
          }
          // Do not keep polling for five minutes after a definitive failure.
          if (status === 'failed' || status === 'cancelled') {
            return null;
          }
        }
      } catch {
        // Ignore polling errors; the next poll or background refresh can recover.
      }
    }

    return null;
  };

  const recoverCompletedUpload = async (transferId: string, sessionUploadId: string) => {
    const readLatestTransfer = async (id: string) => {
      const latestTransfers = ((await apiFetch<FileTransfer[]>('/api/file-transfers')) || []).map((entry) =>
        normalizeTransferRecord(entry as Record<string, unknown>),
      );
      cachedTransfers = latestTransfers;
      if (user) {
        cachedTransfersUserId = user.id;
      }
      setTransfers(cachedTransfers);
      return latestTransfers.find((entry) => entry.id === id);
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const uploadStatus = await apiFetch<{
          uploadId: string;
          transferId: string;
          chunkSize: number;
          totalChunks: number;
          uploadedChunks: number[];
          processing: boolean;
          transferStatus: FileTransfer['transfer_status'];
        }>(`/api/file-transfers/upload-status/${sessionUploadId}`);
        const resolvedTransferId = uploadStatus.transferId || transferId;

        if (uploadStatus.transferStatus === 'completed') {
          const completedEntry = await readLatestTransfer(resolvedTransferId);
          if (completedEntry && completedEntry.transfer_status === 'completed') {
            return completedEntry;
          }
        }

        const allChunksUploaded =
          !uploadStatus.processing &&
          uploadStatus.uploadedChunks.length === uploadStatus.totalChunks &&
          uploadStatus.totalChunks > 0;

        if (allChunksUploaded) {
          // A previous completion call may have been lost (page reload, proxy
          // timeout, server restart). The bytes are all in storage, so asking
          // again is safe and lets the server finalize without re-uploading.
          try {
            const completionResponse = await apiFetch<
              FileTransfer | { transferId: string; processing: boolean }
            >('/api/file-transfers/complete-upload', {
              method: 'POST',
              body: JSON.stringify({ uploadId: uploadStatus.uploadId }),
            });
            if (completionResponse && !('processing' in completionResponse)) {
              const completedTransfer = normalizeTransferRecord(
                completionResponse as Record<string, unknown>,
              );
              if (completedTransfer.transfer_status === 'completed') {
                return completedTransfer;
              }
            }
          } catch {
            // Fall through to polling; the server may already be finalizing.
          }
        }

        if (uploadStatus.processing || allChunksUploaded) {
          const completedTransfer = await pollCompletedTransfer(resolvedTransferId);
          if (completedTransfer) {
            return completedTransfer;
          }
        }
      } catch {
        // The status endpoint 404s once finalize has removed the session, so a
        // completed transfer must still be recoverable from the list below.
      }

      if (attempt < 3) {
        await sleep(1_500);
      }
    }

    // Final fallback: the session may already be gone but the transfer record
    // is the source of truth.
    try {
      const latestEntry = await readLatestTransfer(transferId);
      if (latestEntry && latestEntry.transfer_status === 'completed') {
        return latestEntry;
      }
    } catch {
      // Ignore; the periodic dashboard poll will pick up the final state.
    }

    return null;
  };

  // Shared by every background-finalize path: wait for the server, then put
  // the finished transfer into the list and surface the success toast. If the
  // upload definitively failed, refresh so the UI shows "failed" instead of
  // leaving a stale "in_progress" row behind.
  const finalizeUploadInBackground = (
    transferId: string,
    sessionUploadId: string,
    fileName: string,
  ) => {
    void recoverCompletedUpload(transferId, sessionUploadId)
      .then((completedTransfer) => {
        if (!completedTransfer) {
          void fetchTransfers();
          return;
        }
        cachedTransfers = [
          completedTransfer,
          ...cachedTransfers.filter((transfer) => transfer.id !== completedTransfer.id),
        ];
        if (user) {
          cachedTransfersUserId = user.id;
        }
        setTransfers(cachedTransfers);
        clearUploadTracking(transferId);
        clearUploadProgress(transferId);
        void fetchTransfers();
        toast.success(`File transfer completed: ${fileName}`);
      })
      .catch(() => {
        void fetchTransfers();
      });
  };

  // On dashboard load, finish chunked uploads whose bytes all reached storage
  // but whose complete-upload call never ran (for example the tab was closed
  // after the last chunk). This never touches an upload that is still missing
  // chunks, so it cannot interfere with another device that is sending now.
  const recoverInterruptedUploads = async (transferList: FileTransfer[]) => {
    if (!user || interruptedUploadRecoveryUserId === user.id) return;
    interruptedUploadRecoveryUserId = user.id;
    const candidates = transferList
      .filter((transfer) => transfer.transfer_status === 'in_progress')
      .filter((transfer) => typeof transfer.uploadSessionId === 'string' && transfer.uploadSessionId)
      .slice(0, 5);
    let completedAny = false;

    for (const transfer of candidates) {
      try {
        const uploadStatus = await apiFetch<{
          uploadId: string;
          transferId: string;
          totalChunks: number;
          uploadedChunks: number[];
          processing: boolean;
          transferStatus: FileTransfer['transfer_status'];
        }>(`/api/file-transfers/upload-status/${transfer.uploadSessionId as string}`);
        if (
          uploadStatus.transferStatus !== 'in_progress' ||
          uploadStatus.processing ||
          uploadStatus.uploadedChunks.length !== uploadStatus.totalChunks
        ) {
          continue;
        }
        await apiFetch('/api/file-transfers/complete-upload', {
          method: 'POST',
          body: JSON.stringify({ uploadId: uploadStatus.uploadId }),
        });
        completedAny = true;
      } catch {
        // Session already gone or temporarily unavailable; the normal list
        // poll and stale-upload cleanup will settle the final state.
      }
    }

    if (completedAny) {
      await sleep(750);
      await fetchTransfers();
    }
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
      const serverTransfers = await requestTransfers();
      const localUploads = cachedTransfers.filter(
        (transfer) =>
          transfer.transfer_status === 'in_progress' &&
          Boolean(activeUploadIds.current[transfer.id]) &&
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

    let token = localStorage.getItem('auth_token');
    if (!token) return;
    token = await ensureFreshAuthToken(token);
    let uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    uploadDisplayNames.current[uploadId] = file.name;
    activeUploadIds.current[uploadId] = true;
    const apiBaseUrl = await resolveApiBaseUrl();
    // Once every chunk has been accepted, the transfer is recoverable even if
    // the final completion request is lost. Before that point a failure means
    // the upload really is incomplete and must be reported to the server.
    let allChunksUploaded = false;
    let recoverySessionUploadId = '';

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
        allChunksUploaded = true;
        recoverySessionUploadId = sessionUploadId;

        setUploadProgress((current) => ({
          ...current,
          [uploadId]: 98,
        }));

        let completionResponse: FileTransfer | { transferId: string; processing: boolean } | null = null;
        try {
          completionResponse = await apiFetch<FileTransfer | { transferId: string; processing: boolean }>('/api/file-transfers/complete-upload', {
            method: 'POST',
            body: JSON.stringify({ uploadId: sessionUploadId }),
          });
        } catch (completionError) {
          console.warn('Initial upload completion request failed, attempting recovery:', completionError);
        }

        if (completionResponse && 'processing' in completionResponse && completionResponse.processing) {
          clearUploadProgress(uploadId);
          void fetchTransfers();
          data = normalizeTransferRecord({
            ...pendingTransfer,
            id: uploadId,
            transfer_status: 'in_progress',
          });
          toast.info(`${file.name} is finalizing in the background.`);
          finalizeUploadInBackground(uploadId, sessionUploadId, file.name);
        } else if (completionResponse) {
          data = normalizeTransferRecord(completionResponse as Record<string, unknown>);
        } else {
          clearUploadProgress(uploadId);
          data = normalizeTransferRecord({
            ...pendingTransfer,
            id: uploadId,
            transfer_status: 'in_progress',
          });
          toast.info(`${file.name} finished sending and is syncing in the background.`);
          finalizeUploadInBackground(uploadId, sessionUploadId, file.name);
        }
        if (data.transfer_status !== 'in_progress') {
          removeStoredUploadSession(uploadId);
          delete uploadSessionIds.current[uploadId];
        }
      } else {
        data = await new Promise<FileTransfer>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          registerActiveUpload(uploadId, xhr);
          xhr.withCredentials = true;
          xhr.open('POST', getApiUrl('/api/file-transfers/upload', apiBaseUrl));
          xhr.responseType = 'json';
          xhr.timeout = chunkRequestTimeoutMs;
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
              resolve(normalizeTransferRecord(response as Record<string, unknown>));
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

          xhr.ontimeout = () => {
            reject(new Error('Upload timed out. Please check your connection and try again.'));
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
      if (normalizedTransfer.transfer_status !== 'in_progress') {
        clearUploadTracking(uploadId);
      }
      void fetchTransfers();
      clearUploadProgress(uploadId);
      if (normalizedTransfer.transfer_status === 'in_progress') {
        toast.info(`${file.name} is syncing in the background.`);
      } else {
        toast.success(`File transfer completed: ${file.name}`);
      }
      return data;
    } catch (err) {
      console.error('Start transfer error:', err);
      const cancelled = err instanceof Error && /(cancelled|canceled|aborted)/i.test(err.message);
      if (cancelled) {
        markTransferStatus(uploadId, 'cancelled');
        clearUploadTracking(uploadId);
      } else if (allChunksUploaded && recoverySessionUploadId) {
        // Every byte is already in storage. A failed finalize call (proxy
        // timeout, 502, dropped connection) is recoverable, so retry it in the
        // background instead of leaving the server row "in_progress" forever.
        markTransferStatus(uploadId, 'in_progress');
        void fetchTransfers();
        finalizeUploadInBackground(uploadId, recoverySessionUploadId, file.name);
      } else {
        markTransferStatus(uploadId, 'failed');
        void syncTransferStatus(uploadId, 'failed');
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
      } else if (allChunksUploaded) {
        toast.info(`${file.name} uploaded, and we're finishing the sync in the background.`);
      } else {
        toast.error(message);
      }
    } finally {
      delete activeUploadIds.current[uploadId];
      clearUploadProgress(uploadId);
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
    clearUploadProgress(transferId);
    delete activeUploadIds.current[transferId];
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

      void fetchTransfers();
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
      delete activeUploadIds.current[transferId];
      clearUploadTracking(transferId);
      unregisterActiveUpload(transferId);

      await apiFetch(`/api/file-transfers/${transferId}`, {
        method: 'DELETE',
      });

      void fetchTransfers();
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
        interruptedUploadRecoveryUserId = null;
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
      // Repair uploads left in "in_progress" by a closed tab or lost finalize
      // request. Runs once per signed-in session and never touches uploads
      // that are still missing chunks.
      void recoverInterruptedUploads(cachedTransfers).catch(() => undefined);
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

    // Polling exists so a file sent from another device appears here. 4 s is
    // responsive without hammering the API/database (and it is shared between
    // hook instances), and hidden tabs stop polling entirely.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshTransfers();
      }
    }, 4000);
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
