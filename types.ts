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

export interface Event {
  id: string;
  name: string;
  date: string; // ISO date
  description?: string;
  status: 'upcoming' | 'completed';
  budget?: number; // Estimated budget
}

export interface EventTransaction {
  id: string;
  eventId: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string;
  memberId?: string; // Optional, only if type is income and linked to a member
}

export interface AppState {
  members: Member[];
  contributions: Contribution[];
  monthlyTarget: number;
  currency: string;
  events: Event[];
  eventTransactions: EventTransaction[];
}

export type ViewState = 'dashboard' | 'tracker' | 'members' | 'history' | 'settings' | 'report' | 'events' | 'insights';

export interface MonthlyStats {
  totalCollected: number;
  target: number;
  percentage: number;
  paidCount: number;
  unpaidCount: number;
  totalMembers: number;
}