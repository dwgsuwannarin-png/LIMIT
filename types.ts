export interface UserData {
  id: string;
  username: string;
  password?: string; // Optional because we might not always fetch it or want to display it
  isActive: boolean;
  expiryDate: string; // ISO String
  createdAt: string;
  dailyQuota: number; // Max images per day
  usageCount: number; // Images generated today
  lastUsageDate: string; // YYYY-MM-DD
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}

export interface AuthState {
  isAuthenticated: boolean;
  role: UserRole;
  user: UserData | null;
}

export interface TabOption {
  id: string;
  label: string;
}

export interface StyleOption {
  id: string;
  label: string;
  image?: string;
}