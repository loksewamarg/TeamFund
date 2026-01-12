import { AppState, Member, Contribution } from '../types';

const STORAGE_KEY = 'teamfund_local_db_v1';

// Default seed data to use if storage is empty
const DEFAULT_STATE: AppState = {
  members: [
    { id: '1', name: 'Alex Johnson', mobile: '9876543210', job: 'Team Lead', joinedAt: new Date().toISOString(), active: true, address: '123 Tech Park' },
    { id: '2', name: 'Sarah Connor', mobile: '9123456789', job: 'Developer', joinedAt: new Date().toISOString(), active: true, address: '456 Cyberdyne St' },
  ],
  contributions: [],
  monthlyTarget: 100,
  currency: '₹',
};

// --- Local Storage Logic ---

const getLocalState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local storage", e);
    return DEFAULT_STATE;
  }
};

const saveLocalState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notifySubscribers(state);
  } catch (e) {
    console.error("Error saving to local storage", e);
  }
};

// --- Subscription Logic ---

let subscribers: ((state: AppState) => void)[] = [];

const notifySubscribers = (state: AppState) => {
  subscribers.forEach(cb => cb(state));
};

/**
 * Listens to LocalStorage changes.
 * Also listens to 'storage' events to sync across tabs.
 */
export const subscribeToAppState = (onUpdate: (state: AppState) => void) => {
  subscribers.push(onUpdate);
  
  // Send immediate initial state
  onUpdate(getLocalState());

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const newState = JSON.parse(event.newValue);
        onUpdate(newState);
      } catch (e) {
        console.error("Error parsing storage event", e);
      }
    }
  };

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    subscribers = subscribers.filter(cb => cb !== onUpdate);
    window.removeEventListener('storage', handleStorageEvent);
  };
};

// --- Helper: Robust CSV Parser ---
// Handles quoted fields with newlines/commas
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
  
  // Push the last row if it has content
  if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
  }
  
  return rows;
};

// --- Actions ---

export const dbActions = {
  addMember: async (currentMembers: Member[], newMember: Member) => {
    const state = getLocalState();
    const updatedMembers = [...state.members, newMember];
    saveLocalState({ ...state, members: updatedMembers });
  },

  updateMember: async (currentMembers: Member[], updatedMember: Member) => {
    const state = getLocalState();
    const updatedMembers = state.members.map(m => m.id === updatedMember.id ? updatedMember : m);
    saveLocalState({ ...state, members: updatedMembers });
  },

  removeMember: async (currentMembers: Member[], currentContributions: Contribution[], memberId: string) => {
    const state = getLocalState();
    // Remove member
    const updatedMembers = state.members.filter(m => m.id !== memberId);
    // Remove contributions associated with this member
    const updatedContributions = state.contributions.filter(c => c.memberId !== memberId);
    
    saveLocalState({ 
      ...state, 
      members: updatedMembers, 
      contributions: updatedContributions 
    });
  },

  addContribution: async (currentContributions: Contribution[], newContribution: Contribution) => {
    const state = getLocalState();
    const updatedContributions = [...state.contributions, newContribution];
    saveLocalState({ ...state, contributions: updatedContributions });
  },

  updateSettings: async (settings: { monthlyTarget: number, currency: string }) => {
    const state = getLocalState();
    saveLocalState({ 
      ...state, 
      monthlyTarget: settings.monthlyTarget,
      currency: settings.currency 
    });
  },

  importFromCSV: async (csvContent: string): Promise<{ success: boolean; message: string }> => {
    try {
      const state = getLocalState();
      const rows = parseCSV(csvContent);
      
      if (rows.length < 2) {
        return { success: false, message: "CSV file is empty or missing headers." };
      }

      // Normalize headers to handle potential BOM or whitespace
      const headers = rows[0].map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      
      // Find indexes
      const nameIdx = headers.findIndex(h => h.includes('member name'));
      const jobIdx = headers.findIndex(h => h.includes('job'));
      const mobileIdx = headers.findIndex(h => h.includes('mobile'));
      const addressIdx = headers.findIndex(h => h.includes('address'));
      const statusIdx = headers.findIndex(h => h.includes('status'));

      if (nameIdx === -1) {
         return { success: false, message: "Missing required column: Member Name" };
      }

      // Identify Date Columns (Format YYYY-MM)
      const dateColumns: { index: number, month: string }[] = [];
      headers.forEach((h, idx) => {
          if (/^\d{4}-\d{2}$/.test(h)) {
              dateColumns.push({ index: idx, month: h });
          }
      });

      let membersAdded = 0;
      let membersUpdated = 0;
      let contributionsProcessed = 0;

      // Process Data Rows
      for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          // Skip empty rows
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;

          const name = row[nameIdx]?.trim();
          if (!name) continue;

          // Member Attributes
          const job = jobIdx !== -1 ? (row[jobIdx]?.trim() || '') : '';
          const mobile = mobileIdx !== -1 ? (row[mobileIdx]?.trim() || '') : '';
          const address = addressIdx !== -1 ? (row[addressIdx]?.trim() || '') : '';
          const statusVal = statusIdx !== -1 ? (row[statusIdx]?.trim().toLowerCase()) : 'active';
          const active = statusVal === 'active';

          // 1. Upsert Member
          let member = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
          
          if (member) {
              // Update existing
              let wasUpdated = false;
              if (job && member.job !== job) { member.job = job; wasUpdated = true; }
              if (mobile && member.mobile !== mobile) { member.mobile = mobile; wasUpdated = true; }
              if (address && member.address !== address) { member.address = address; wasUpdated = true; }
              if (member.active !== active) { member.active = active; wasUpdated = true; }
              
              if (wasUpdated) membersUpdated++;
          } else {
              // Create new
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

          // 2. Process Contributions for this row
          dateColumns.forEach(col => {
              const amountStr = row[col.index];
              // Clean amount string (remove currency symbols, commas, quotes)
              const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : 0;
              
              if (amount > 0 && member) {
                  const existingContribIndex = state.contributions.findIndex(c => c.memberId === member!.id && c.month === col.month);
                  
                  if (existingContribIndex >= 0) {
                      // Update existing contribution
                      state.contributions[existingContribIndex].amount = amount;
                  } else {
                      // Add new contribution
                      state.contributions.push({
                          id: generateId(),
                          memberId: member!.id,
                          amount: amount,
                          date: new Date(`${col.month}-01`).toISOString(), // Default to 1st
                          month: col.month,
                          note: 'Imported via CSV'
                      });
                  }
                  contributionsProcessed++;
              }
          });
      }

      saveLocalState(state);
      return { 
          success: true, 
          message: `Import Successful: ${membersAdded} members added, ${membersUpdated} updated. processed contributions.` 
      };

    } catch (error) {
      console.error("Import error", error);
      return { success: false, message: "An unexpected error occurred during import." };
    }
  }
};

// --- Helpers ---

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const exportDataToCSV = (state: AppState) => {
  // 1. Get all unique months from contributions and sort them (Oldest -> Newest)
  const uniqueMonths = Array.from(new Set(state.contributions.map(c => c.month))).sort();

  // 2. Prepare Headers: Member details + Dynamic Month Columns + Total
  const headers = ['Member Name', 'Job Title', 'Mobile', 'Address', 'Status', ...uniqueMonths, 'Total Contributed'];

  // 3. Build Rows (One per member)
  const rows = state.members.map(member => {
    let memberTotal = 0;

    // Calculate amount for each month column
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

  // 4. Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  // 5. Trigger Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `teamfund_monthly_matrix_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};