export interface UserProfile {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  isVerified: boolean;
  isAdmin: boolean;
  publicKey?: string;
  settings?: UserSettings;
}

export interface UserSettings {
  theme?: "light" | "dark" | "system";
  notifications?: {
    push?: boolean;
    email?: boolean;
  };
  privacy?: {
    showOnlineStatus?: boolean;
    readReceipts?: boolean;
  };
}

export interface DeviceInfo {
  deviceId: string;
  platform: string;
  fingerprint: string;
  lastSeenAt: string;
  userAgent: string;
}

export interface SessionInfo {
  id: string;
  deviceId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface ContactRecord {
  userId: string;
  contactUserId: string;
  name: string;
  createdAt: string;
}

export interface GroupMeta {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessagePayload {
  id: string;
  senderId: string;
  recipientId: string;
  groupId?: string;
  content: string;
  type: "text" | "image" | "video" | "file" | "location" | "reaction" | "poll";
  metadata?: Record<string, unknown>;
  createdAt: string;
  editedAt?: string;
  replyToId?: string;
  isDeleted?: boolean;
}

export interface OfflineMessageEnvelope {
  recipientId: string;
  senderId: string;
  message: MessagePayload;
  sentAt: string;
}
