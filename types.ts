export interface Member {
  id: string;
  name: string;
  mobile: string; // Renamed from phone
  job: string;    // Renamed from role
  joinedAt: string;
  avatarUrl?: string; // Optional custom avatar
  active: boolean; // New field for soft delete/inactive status
  address?: string; // Optional address
}

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  date: string; // ISO string
  month: string; // Format: "YYYY-MM"
  note?: string;
}

export interface AppState {
  members: Member[];
  contributions: Contribution[];
  monthlyTarget: number;
  currency: string;
}

export type ViewState = 'dashboard' | 'tracker' | 'members' | 'history' | 'settings' | 'report';

export interface MonthlyStats {
  totalCollected: number;
  target: number;
  percentage: number;
  paidCount: number;
  unpaidCount: number;
  totalMembers: number;
}