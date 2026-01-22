import { AppState, Member, Contribution, Event, EventTransaction } from '../types';
import { db } from './firebaseConfig';
import { ref, set, onValue } from 'firebase/database';

const STORAGE_KEY = 'teamfund_state';

const DEFAULT_STATE: AppState = {
  members: [],
  contributions: [],
  monthlyTarget: 100,
  currency: '₹',
  events: [],
  eventTransactions: []
};

// --- Local State Management ---

let listeners: ((state: AppState) => void)[] = [];

// Helper to sanitize arrays (handle Firebase sparse arrays/objects)
const sanitizeArray = <T>(data: any): T[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    // Filter out nulls/undefined which happen with sparse arrays in Firebase
    return data.filter(item => item !== null && item !== undefined);
  }
  // If Firebase returns an object (integer keys) instead of an array
  if (typeof data === 'object') {
    return Object.values(data);
  }
  return [];
};

/**
 * Load state from LocalStorage with robust type checking
 */
const loadState = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return DEFAULT_STATE;
    const parsed = JSON.parse(serialized);
    
    // Ensure all keys exist and are of correct type (Arrays vs Objects)
    // This fixes the issue where data loaded from a corrupted LS (object instead of array) causes .push() to fail
    return { 
      ...DEFAULT_STATE, 
      ...parsed,
      members: sanitizeArray(parsed.members),
      contributions: sanitizeArray(parsed.contributions),
      events: sanitizeArray(parsed.events),
      eventTransactions: sanitizeArray(parsed.eventTransactions)
    };
  } catch (e) {
    console.error("Failed to load state", e);
    return DEFAULT_STATE;
  }
};

/**
 * Save state to LocalStorage and Firebase, then notify listeners
 */
const saveState = (state: AppState) => {
  try {
    // 1. Save locally
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    
    // 2. Notify local listeners
    notifyListeners(state);

    // 3. Sync to Firebase (Fire and Forget)
    if (db) {
        const stateRef = ref(db, 'teamfund_state');
        // CRITICAL FIX: Firebase throws error if object contains 'undefined'.
        // JSON stringify/parse removes undefined keys, making the object safe for Firebase.
        const cleanState = JSON.parse(JSON.stringify(state));
        set(stateRef, cleanState).catch(e => console.error("Firebase sync error:", e));
    }
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

const notifyListeners = (state: AppState) => {
  listeners.forEach(l => l(state));
};

/**
 * Subscribes to changes in the AppState.
 * Also listens to the 'storage' event for cross-tab synchronization.
 * Also listens to Firebase for remote synchronization.
 */
export const subscribeToAppState = (onUpdate: (state: AppState) => void) => {
  listeners.push(onUpdate);
  
  // Initial data load from LocalStorage
  onUpdate(loadState());

  // Handle cross-tab updates (LocalStorage)
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      onUpdate(loadState());
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // Handle Firebase Realtime Updates
  let unsubscribeFirebase = () => {};
  if (db) {
      const stateRef = ref(db, 'teamfund_state');
      unsubscribeFirebase = onValue(stateRef, (snapshot) => {
          const remoteData = snapshot.val();
          if (remoteData) {
              // Merge remote data with DEFAULT_STATE
              // CRITICAL: Sanitize arrays to prevent Object-instead-of-Array bugs from Firebase
              const mergedState: AppState = {
                  ...DEFAULT_STATE,
                  ...remoteData,
                  members: sanitizeArray(remoteData.members),
                  contributions: sanitizeArray(remoteData.contributions),
                  events: sanitizeArray(remoteData.events),
                  eventTransactions: sanitizeArray(remoteData.eventTransactions)
              };

              // Update LocalStorage to keep in sync with cloud
              localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
              // Notify UI with new data
              onUpdate(mergedState);
          }
      }, (error) => {
          console.error("Firebase read failed:", error);
      });
  }

  return () => {
    listeners = listeners.filter(l => l !== onUpdate);
    window.removeEventListener('storage', handleStorageEvent);
    unsubscribeFirebase();
  };
};

// --- Helper: Robust CSV Parser ---
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'; // Escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || (char === '\r')) && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
  }
  
  return rows;
};

// --- Actions ---

export const dbActions = {
  addMember: async (currentMembers: Member[], newMember: Member) => {
    const state = loadState();
    state.members.push(newMember);
    saveState(state);
  },

  updateMember: async (currentMembers: Member[], updatedMember: Member) => {
    const state = loadState();
    const index = state.members.findIndex(m => m.id === updatedMember.id);
    if (index !== -1) {
      state.members[index] = updatedMember;
      saveState(state);
    }
  },

  removeMember: async (currentMembers: Member[], currentContributions: Contribution[], memberId: string) => {
    const state = loadState();
    // Remove member
    state.members = state.members.filter(m => m.id !== memberId);
    // Remove linked contributions
    state.contributions = state.contributions.filter(c => c.memberId !== memberId);
    saveState(state);
  },

  addContribution: async (currentContributions: Contribution[], newContribution: Contribution) => {
    const state = loadState();
    state.contributions.push(newContribution);
    saveState(state);
  },

  removeContribution: async (contributionId: string) => {
    const state = loadState();
    state.contributions = state.contributions.filter(c => c.id !== contributionId);
    saveState(state);
  },

  updateSettings: async (settings: { monthlyTarget: number, currency: string }) => {
    const state = loadState();
    state.monthlyTarget = settings.monthlyTarget;
    state.currency = settings.currency;
    saveState(state);
  },

  // --- Event Actions ---
  
  addEvent: async (newEvent: Event) => {
    const state = loadState();
    if (!state.events) state.events = [];
    state.events.push(newEvent);
    saveState(state);
  },

  updateEvent: async (updatedEvent: Event) => {
    const state = loadState();
    if (!state.events) return;
    const index = state.events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
      state.events[index] = updatedEvent;
      saveState(state);
    }
  },

  deleteEvent: async (eventId: string) => {
    const state = loadState();
    if (!state.events) return;
    state.events = state.events.filter(e => e.id !== eventId);
    // Also remove transactions associated with this event
    if (state.eventTransactions) {
      state.eventTransactions = state.eventTransactions.filter(t => t.eventId !== eventId);
    }
    saveState(state);
  },

  addEventTransaction: async (transaction: EventTransaction) => {
    try {
      const state = loadState();
      // Double check array existence and type
      if (!state.eventTransactions || !Array.isArray(state.eventTransactions)) {
        state.eventTransactions = [];
      }
      state.eventTransactions.push(transaction);
      saveState(state);
    } catch (error) {
      console.error("Error adding event transaction:", error);
    }
  },

  removeEventTransaction: async (transactionId: string) => {
    const state = loadState();
    if (!state.eventTransactions) return;
    state.eventTransactions = state.eventTransactions.filter(t => t.id !== transactionId);
    saveState(state);
  },

  importFromCSV: async (csvContent: string): Promise<{ success: boolean; message: string }> => {
    try {
      const state = loadState();
      
      const rows = parseCSV(csvContent);
      if (rows.length < 2) return { success: false, message: "CSV is empty or missing headers." };

      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const nameIdx = headers.findIndex(h => h.includes('member name'));
      const jobIdx = headers.findIndex(h => h.includes('job'));
      const mobileIdx = headers.findIndex(h => h.includes('mobile'));
      const addressIdx = headers.findIndex(h => h.includes('address'));
      const statusIdx = headers.findIndex(h => h.includes('status'));

      if (nameIdx === -1) return { success: false, message: "Missing required column: Member Name" };

      const dateColumns: { index: number, month: string }[] = [];
      headers.forEach((h, idx) => {
          if (/^\d{4}-\d{2}$/.test(h)) dateColumns.push({ index: idx, month: h });
      });

      let membersAdded = 0;
      let membersUpdated = 0;

      for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row.length || !row[nameIdx]?.trim()) continue;

          const name = row[nameIdx].trim();
          const job = jobIdx !== -1 ? (row[jobIdx]?.trim() || '') : '';
          const mobile = mobileIdx !== -1 ? (row[mobileIdx]?.trim() || '') : '';
          const address = addressIdx !== -1 ? (row[addressIdx]?.trim() || '') : '';
          const statusVal = statusIdx !== -1 ? (row[statusIdx]?.trim().toLowerCase()) : 'active';
          const active = statusVal === 'active';

          // Check if member exists
          let member = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
          
          if (member) {
              // Update Member
              let wasUpdated = false;
              if (job && member.job !== job) { member.job = job; wasUpdated = true; }
              if (mobile && member.mobile !== mobile) { member.mobile = mobile; wasUpdated = true; }
              if (address && member.address !== address) { member.address = address; wasUpdated = true; }
              if (member.active !== active) { member.active = active; wasUpdated = true; }
              
              if (wasUpdated) membersUpdated++;
          } else {
              // New Member
              member = {
                  id: generateId(),
                  name,
                  job: job || 'Member',
                  mobile,
                  address,
                  active,
                  joinedAt: new Date().toISOString()
              };
              state.members.push(member);
              membersAdded++;
          }

          // Process Contributions
          dateColumns.forEach(col => {
              const amountStr = row[col.index];
              const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : 0;
              
              if (amount > 0 && member) {
                  const existingContrib = state.contributions.find(c => c.memberId === member!.id && c.month === col.month);
                  
                  if (existingContrib) {
                      if (existingContrib.amount !== amount) {
                          existingContrib.amount = amount;
                      }
                  } else {
                      const newId = generateId();
                      const contrib = {
                          id: newId,
                          memberId: member.id,
                          amount: amount,
                          date: new Date(`${col.month}-01`).toISOString(),
                          month: col.month,
                          note: 'Imported via CSV'
                      };
                      state.contributions.push(contrib);
                  }
              }
          });
      }

      saveState(state);
      return { 
          success: true, 
          message: `Import Successful: ${membersAdded} members added, ${membersUpdated} updated.` 
      };

    } catch (error) {
      console.error("Import error", error);
      return { success: false, message: "An unexpected error occurred during import." };
    }
  },

  restoreFromBackup: async (jsonContent: string): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonContent);
      
      // Basic validation
      if (!parsed.members || !Array.isArray(parsed.members)) {
         return { success: false, message: "Invalid backup: Missing members data." };
      }

      // Sanitize and Merge with Default to ensure structure
      // We essentially overwrite the current state with the backup
      const newState: AppState = {
          ...DEFAULT_STATE,
          ...parsed,
          members: sanitizeArray(parsed.members),
          contributions: sanitizeArray(parsed.contributions),
          events: sanitizeArray(parsed.events),
          eventTransactions: sanitizeArray(parsed.eventTransactions),
          monthlyTarget: parsed.monthlyTarget || DEFAULT_STATE.monthlyTarget,
          currency: parsed.currency || DEFAULT_STATE.currency
      };

      saveState(newState);
      return { success: true, message: "System restored from backup successfully." };
    } catch (e) {
      console.error(e);
      return { success: false, message: "Failed to parse backup file." };
    }
  }
};

// --- Helpers ---

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Exports full state as JSON for backup purposes
export const exportBackupJSON = (state: AppState) => {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `teamfund_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportDataToCSV = (state: AppState) => {
  const uniqueMonths = Array.from(new Set(state.contributions.map(c => c.month))).sort();
  const headers = ['Member Name', 'Job Title', 'Mobile', 'Address', 'Status', ...uniqueMonths, 'Total Contributed'];

  const rows = state.members.map(member => {
    let memberTotal = 0;
    const monthlyValues = uniqueMonths.map(month => {
      const amount = state.contributions
        .filter(c => c.memberId === member.id && c.month === month)
        .reduce((sum, c) => sum + c.amount, 0);
      
      memberTotal += amount;
      return amount;
    });

    const escapeCsv = (val: string) => {
        if (!val) return '';
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    };

    return [
      escapeCsv(member.name), 
      escapeCsv(member.job),
      escapeCsv(member.mobile),
      escapeCsv(member.address || ''),
      member.active ? 'Active' : 'Inactive',
      ...monthlyValues,
      memberTotal
    ].join(',');
  });

  let csvContent = [headers.join(','), ...rows].join('\n');

  // --- Append Events Summary ---
  if (state.events && state.events.length > 0) {
      csvContent += '\n\n\nEVENTS SUMMARY\n';
      csvContent += 'Event Name,Date,Status,Budget,Income,Expense,Net Balance\n';
      
      const transactions = state.eventTransactions || [];
      state.events.forEach(e => {
          const evtTrans = transactions.filter(t => t.eventId === e.id);
          const inc = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const exp = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          const net = inc - exp;
          
          const escapeCsv = (val: any) => {
             const str = String(val || '');
             if (str.includes(',')) return `"${str}"`;
             return str;
          };

          const line = [
              escapeCsv(e.name), 
              e.date.split('T')[0], 
              e.status, 
              e.budget || 0, 
              inc, 
              exp, 
              net
          ].join(',');
          csvContent += line + '\n';
      });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `teamfund_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};