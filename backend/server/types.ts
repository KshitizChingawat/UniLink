export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  plan: "free" | "pro";
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  preferences: {
    aiAssistantEnabled: boolean;
  };
}

export interface DeviceRecord {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: "desktop" | "mobile" | "tablet" | "browser";
  platform: "windows" | "macos" | "linux" | "android" | "ios" | "browser";
  deviceId: string;
  publicKey?: string;
  lastSeen: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClipboardRecord {
  id: string;
  userId: string;
  deviceId: string;
  content: string;
  contentType: string;
  syncTimestamp: string;
  syncedToDevices: string[];
  createdAt: string;
}

export interface FileTransferRecord {
  id: string;
  userId: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  transferStatus: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  transferMethod: "cloud" | "p2p" | "local";
  createdAt: string;
  completedAt?: string;
  filePath?: string;
}

export interface VaultRecord {
  id: string;
  userId: string;
  itemType: "clipboard" | "file" | "note";
  encryptedContent: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  accessedAt: string;
}

export interface AiSuggestionRecord {
  id: string;
  userId: string;
  suggestionType:
    | "clipboard_analysis"
    | "file_organization"
    | "device_recommendation"
    | "workflow_automation"
    | "content_categorization";
  content: Record<string, unknown>;
  confidenceScore: number;
  used: boolean;
  feedbackScore?: number | null;
  createdAt: string;
  expiresAt?: string | null;
  usedAt?: string;
}

export interface BluetoothDeviceRecord {
  id: string;
  userId: string;
  deviceId?: string;
  bluetoothMac: string;
  deviceName: string;
  deviceCapabilities: Record<string, unknown>;
  signalStrength?: number;
  pairingStatus: "discovered" | "pairing" | "paired" | "trusted" | "blocked";
  lastDiscovered: string;
  createdAt: string;
}

export interface PairSessionRecord {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  claimedDeviceId?: string;
}

export interface EmailVerificationRecord {
  id: string;
  email: string;
  purpose: "register";
  otpHash: string;
  expiresAt: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface AppDatabase {
  users: UserRecord[];
  devices: DeviceRecord[];
  clipboard: ClipboardRecord[];
  fileTransfers: FileTransferRecord[];
  vault: VaultRecord[];
  aiSuggestions: AiSuggestionRecord[];
  bluetoothDevices: BluetoothDeviceRecord[];
  pairSessions: PairSessionRecord[];
  emailVerifications: EmailVerificationRecord[];
}
