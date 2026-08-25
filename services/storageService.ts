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
        set(stateRef, cleanState).catch(e => {
            console.error("Firebase sync error:", e);
            if (e.message && e.message.includes('PERMISSION_DENIED')) {
                console.warn("⚠️ Firebase write permission denied. Data saved locally only.");
            }
        });
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
          if (error.message && error.message.includes('permission_denied')) {
              console.warn(
                "⚠️ TeamFund Firebase Notice: Permission denied.\n" +
                "To fix this, go to Firebase Console > Realtime Database > Rules tab, and set:\n" +
                "{\n  \"rules\": {\n    \".read\": true,\n    \".write\": true\n  }\n}"
              );
          }
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

// --- Helper: Robust Number Parser (handles currency symbols, commas, negative numbers) ---
const cleanNumber = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim().replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
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
      if (!state.members) state.members = [];
      if (!state.contributions) state.contributions = [];
      if (!state.events) state.events = [];
      if (!state.eventTransactions) state.eventTransactions = [];

      const rows = parseCSV(csvContent);
      if (rows.length < 1) return { success: false, message: "CSV file is empty." };

      let currentSection: 'UNKNOWN' | 'MEMBERS' | 'EVENTS' | 'TRANSACTIONS' = 'UNKNOWN';
      
      // Column Indices per section
      let memberCols: { name: number; job: number; mobile: number; address: number; status: number; dates: { idx: number; month: string }[] } | null = null;
      let eventCols: { name: number; date: number; status: number; budget: number; desc: number; income: number; expense: number } | null = null;
      let transCols: { eventName: number; type: number; amount: number; date: number; desc: number; memberName: number } | null = null;

      let membersAdded = 0;
      let membersUpdated = 0;
      let eventsAdded = 0;
      let eventsUpdated = 0;
      let transactionsAdded = 0;

      // Track events that have itemized transactions imported so we don't double count summary transactions
      const eventsWithItemizedTrans = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const rawCells = row.map(c => c ? c.trim() : '');
        // Check if row is all empty
        if (rawCells.every(c => !c)) continue;

        const firstCellLower = rawCells[0].toLowerCase().replace(/^["'-]+|["'-]+$/g, '').trim();
        const fullRowLower = rawCells.map(c => c.toLowerCase().replace(/^["']|["']$/g, '').trim());

        // Check for section markers or title headers
        if (
          firstCellLower.includes('events summary') || 
          firstCellLower === 'events' || 
          firstCellLower.includes('events ---') || 
          firstCellLower.includes('events list')
        ) {
          currentSection = 'EVENTS';
          eventCols = null;
          continue;
        }

        if (
          firstCellLower.includes('event transactions') || 
          firstCellLower.includes('transactions') ||
          firstCellLower.includes('transactions ---')
        ) {
          currentSection = 'TRANSACTIONS';
          transCols = null;
          continue;
        }

        if (
          firstCellLower.includes('members summary') || 
          firstCellLower === 'members' || 
          firstCellLower.includes('members ---')
        ) {
          currentSection = 'MEMBERS';
          memberCols = null;
          continue;
        }

        // Check if this row is a Header Row:
        const hasMemberHeader = fullRowLower.some(c => c === 'member name' || c.includes('member name'));
        const hasEventTransHeader = (fullRowLower.some(c => c.includes('event name') || c === 'event') && 
                                     (fullRowLower.some(c => c.includes('transaction type') || c === 'type') || 
                                      (fullRowLower.some(c => c.includes('amount')) && fullRowLower.some(c => c.includes('description')))));
        const hasEventHeader = (fullRowLower.some(c => c.includes('event name') || c === 'event' || c === 'event title') && 
                                (fullRowLower.some(c => c.includes('budget') || c.includes('estimate') || c.includes('allocation')) || 
                                 fullRowLower.some(c => c.includes('status')) || 
                                 fullRowLower.some(c => c.includes('net balance') || c.includes('net')) || 
                                 fullRowLower.some(c => c.includes('income') || c.includes('collected')) || 
                                 fullRowLower.some(c => c.includes('expense') || c.includes('spent'))));

        if (hasEventTransHeader && !hasMemberHeader) {
          currentSection = 'TRANSACTIONS';
          transCols = {
            eventName: fullRowLower.findIndex(c => c.includes('event name') || c === 'event'),
            type: fullRowLower.findIndex(c => c.includes('type')),
            amount: fullRowLower.findIndex(c => c.includes('amount')),
            date: fullRowLower.findIndex(c => c.includes('date')),
            desc: fullRowLower.findIndex(c => c.includes('description') || c.includes('desc') || c.includes('note')),
            memberName: fullRowLower.findIndex(c => c.includes('member'))
          };
          continue;
        }

        if (hasEventHeader && !hasMemberHeader) {
          currentSection = 'EVENTS';
          eventCols = {
            name: fullRowLower.findIndex(c => c.includes('event name') || c === 'event' || c === 'name' || c === 'event title'),
            date: fullRowLower.findIndex(c => c.includes('date')),
            status: fullRowLower.findIndex(c => c.includes('status')),
            budget: fullRowLower.findIndex(c => c.includes('budget') || c.includes('estimate') || c.includes('allocation')),
            desc: fullRowLower.findIndex(c => c.includes('description') || c.includes('desc') || c.includes('note') || c.includes('details')),
            income: fullRowLower.findIndex(c => c.includes('income') || c.includes('collected') || c.includes('revenue') || c.includes('received')),
            expense: fullRowLower.findIndex(c => c.includes('expense') || c.includes('spent') || c.includes('cost') || c.includes('expenditure'))
          };
          continue;
        }

        if (hasMemberHeader) {
          currentSection = 'MEMBERS';
          const dates: { idx: number; month: string }[] = [];
          fullRowLower.forEach((c, idx) => {
            if (/^\d{4}-\d{2}$/.test(c)) {
              dates.push({ idx, month: c });
            }
          });

          memberCols = {
            name: fullRowLower.findIndex(c => c.includes('member name')),
            job: fullRowLower.findIndex(c => c.includes('job') || c.includes('role') || c.includes('title')),
            mobile: fullRowLower.findIndex(c => c.includes('mobile') || c.includes('phone') || c.includes('contact')),
            address: fullRowLower.findIndex(c => c.includes('address')),
            status: fullRowLower.findIndex(c => c === 'status'),
            dates
          };
          continue;
        }

        // If we haven't identified section yet from header, check if we can infer
        if (currentSection === 'UNKNOWN') {
          continue;
        }

        // --- Process Data Rows Based on currentSection ---
        if (currentSection === 'MEMBERS' && memberCols && memberCols.name !== -1) {
          const name = rawCells[memberCols.name]?.trim();
          if (!name || name.toLowerCase().includes('member name')) continue;

          const job = memberCols.job !== -1 ? (rawCells[memberCols.job]?.trim() || 'Member') : 'Member';
          const mobile = memberCols.mobile !== -1 ? (rawCells[memberCols.mobile]?.trim() || '') : '';
          const address = memberCols.address !== -1 ? (rawCells[memberCols.address]?.trim() || '') : '';
          const statusStr = memberCols.status !== -1 ? (rawCells[memberCols.status]?.trim().toLowerCase()) : 'active';
          const active = statusStr !== 'inactive' && statusStr !== 'false' && statusStr !== '0';

          let member = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (member) {
            let wasUpdated = false;
            if (job && member.job !== job) { member.job = job; wasUpdated = true; }
            if (mobile && member.mobile !== mobile) { member.mobile = mobile; wasUpdated = true; }
            if (address && member.address !== address) { member.address = address; wasUpdated = true; }
            if (member.active !== active) { member.active = active; wasUpdated = true; }
            if (wasUpdated) membersUpdated++;
          } else {
            member = {
              id: generateId(),
              name,
              job,
              mobile,
              address,
              active,
              joinedAt: new Date().toISOString()
            };
            state.members.push(member);
            membersAdded++;
          }

          // Process monthly contributions
          memberCols.dates.forEach(col => {
            const amount = cleanNumber(rawCells[col.idx]);
            if (amount > 0 && member) {
              const existingContrib = state.contributions.find(c => c.memberId === member!.id && c.month === col.month);
              if (existingContrib) {
                if (existingContrib.amount !== amount) {
                  existingContrib.amount = amount;
                }
              } else {
                state.contributions.push({
                  id: generateId(),
                  memberId: member.id,
                  amount,
                  date: new Date(`${col.month}-01`).toISOString(),
                  month: col.month,
                  note: 'Imported via CSV'
                });
              }
            }
          });
        } else if (currentSection === 'EVENTS' && eventCols && eventCols.name !== -1) {
          const name = rawCells[eventCols.name]?.trim();
          if (!name || name.toLowerCase().includes('event name') || name.toLowerCase().includes('events summary')) continue;

          const dateRaw = eventCols.date !== -1 ? rawCells[eventCols.date]?.trim() : '';
          let parsedDate = new Date().toISOString();
          if (dateRaw) {
            const parsed = new Date(dateRaw);
            if (!isNaN(parsed.getTime())) {
              parsedDate = parsed.toISOString();
            }
          }

          const statusRaw = eventCols.status !== -1 ? rawCells[eventCols.status]?.trim().toLowerCase() : 'upcoming';
          const status: 'upcoming' | 'completed' = (statusRaw.includes('comp') || statusRaw.includes('done') || statusRaw === 'past') ? 'completed' : 'upcoming';
          
          const budget = eventCols.budget !== -1 ? cleanNumber(rawCells[eventCols.budget]) : 0;
          const description = eventCols.desc !== -1 ? (rawCells[eventCols.desc]?.trim() || '') : '';
          const income = eventCols.income !== -1 ? cleanNumber(rawCells[eventCols.income]) : 0;
          const expense = eventCols.expense !== -1 ? cleanNumber(rawCells[eventCols.expense]) : 0;

          let event = state.events.find(e => e.name.toLowerCase() === name.toLowerCase());
          if (event) {
            let wasUpdated = false;
            if (dateRaw && event.date !== parsedDate) { event.date = parsedDate; wasUpdated = true; }
            if (event.status !== status) { event.status = status; wasUpdated = true; }
            if (budget !== event.budget) { event.budget = budget; wasUpdated = true; }
            if (description && event.description !== description) { event.description = description; wasUpdated = true; }
            if (wasUpdated) eventsUpdated++;
          } else {
            event = {
              id: generateId(),
              name,
              date: parsedDate,
              status,
              budget,
              description: description || undefined
            };
            state.events.push(event);
            eventsAdded++;
          }

          // Import Income if provided in event summary
          if (income > 0) {
            const existingIncomeTrans = state.eventTransactions.filter(t => t.eventId === event!.id && t.type === 'income');
            const totalExistingIncome = existingIncomeTrans.reduce((s, t) => s + t.amount, 0);

            if (totalExistingIncome === 0) {
              state.eventTransactions.push({
                id: generateId(),
                eventId: event.id,
                type: 'income',
                amount: income,
                date: parsedDate,
                description: 'Imported Event Income'
              });
              transactionsAdded++;
            } else if (existingIncomeTrans.length === 1 && existingIncomeTrans[0].description === 'Imported Event Income') {
              existingIncomeTrans[0].amount = income;
            }
          }

          // Import Expense if provided in event summary
          if (expense > 0) {
            const existingExpenseTrans = state.eventTransactions.filter(t => t.eventId === event!.id && t.type === 'expense');
            const totalExistingExpense = existingExpenseTrans.reduce((s, t) => s + t.amount, 0);

            if (totalExistingExpense === 0) {
              state.eventTransactions.push({
                id: generateId(),
                eventId: event.id,
                type: 'expense',
                amount: expense,
                date: parsedDate,
                description: 'Imported Event Expense'
              });
              transactionsAdded++;
            } else if (existingExpenseTrans.length === 1 && existingExpenseTrans[0].description === 'Imported Event Expense') {
              existingExpenseTrans[0].amount = expense;
            }
          }
        } else if (currentSection === 'TRANSACTIONS' && transCols && transCols.eventName !== -1) {
          const eventName = rawCells[transCols.eventName]?.trim();
          if (!eventName || eventName.toLowerCase().includes('event name')) continue;

          let event = state.events.find(e => e.name.toLowerCase() === eventName.toLowerCase());
          if (!event) {
            event = {
              id: generateId(),
              name: eventName,
              date: new Date().toISOString(),
              status: 'upcoming',
              budget: 0
            };
            state.events.push(event);
            eventsAdded++;
          }

          // If this event has itemized transactions, clean up any generic placeholder created from summary headers
          if (!eventsWithItemizedTrans.has(event.id)) {
            eventsWithItemizedTrans.add(event.id);
            state.eventTransactions = state.eventTransactions.filter(t => 
              !(t.eventId === event!.id && (t.description === 'Imported Event Income' || t.description === 'Imported Event Expense'))
            );
          }

          const typeRaw = transCols.type !== -1 ? rawCells[transCols.type]?.trim().toLowerCase() : 'income';
          const type: 'income' | 'expense' = typeRaw.includes('exp') ? 'expense' : 'income';

          const amount = transCols.amount !== -1 ? cleanNumber(rawCells[transCols.amount]) : 0;
          if (amount <= 0) continue;

          const dateRaw = transCols.date !== -1 ? rawCells[transCols.date]?.trim() : '';
          let parsedDate = new Date().toISOString();
          if (dateRaw) {
            const parsed = new Date(dateRaw);
            if (!isNaN(parsed.getTime())) {
              parsedDate = parsed.toISOString();
            }
          }

          const description = transCols.desc !== -1 ? (rawCells[transCols.desc]?.trim() || '') : '';
          const memberName = transCols.memberName !== -1 ? rawCells[transCols.memberName]?.trim() : '';
          let memberId: string | undefined = undefined;
          if (memberName) {
            const m = state.members.find(mem => mem.name.toLowerCase() === memberName.toLowerCase());
            if (m) memberId = m.id;
          }

          // Check for duplicate transaction
          const isDuplicate = state.eventTransactions.some(t => 
            t.eventId === event!.id &&
            t.type === type &&
            t.amount === amount &&
            t.description === description &&
            t.date.split('T')[0] === parsedDate.split('T')[0]
          );

          if (!isDuplicate) {
            state.eventTransactions.push({
              id: generateId(),
              eventId: event.id,
              type,
              amount,
              date: parsedDate,
              description: description || `${type === 'income' ? 'Income' : 'Expense'} entry`,
              memberId
            });
            transactionsAdded++;
          }
        }
      }

      const summaryParts: string[] = [];
      if (membersAdded > 0 || membersUpdated > 0) {
        summaryParts.push(`${membersAdded} members added, ${membersUpdated} updated`);
      }
      if (eventsAdded > 0 || eventsUpdated > 0) {
        summaryParts.push(`${eventsAdded} events added, ${eventsUpdated} updated`);
      }
      if (transactionsAdded > 0) {
        summaryParts.push(`${transactionsAdded} event transactions imported`);
      }

      if (summaryParts.length === 0) {
        return { 
          success: false, 
          message: "No valid members or event records found in the uploaded CSV." 
        };
      }

      saveState(state);
      return { 
        success: true, 
        message: `Import Successful: ${summaryParts.join('; ')}.` 
      };

    } catch (error) {
      console.error("Import error", error);
      return { success: false, message: "An unexpected error occurred during CSV import." };
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

  // --- Append Events Section ---
  if (state.events && state.events.length > 0) {
      csvContent += '\n\n\n--- EVENTS ---\n';
      csvContent += 'Event Name,Date,Status,Budget,Description,Total Income,Total Expense,Net Balance\n';
      
      const transactions = state.eventTransactions || [];
      state.events.forEach(e => {
          const evtTrans = transactions.filter(t => t.eventId === e.id);
          const inc = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const exp = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          const net = inc - exp;
          
          const escapeCsv = (val: any) => {
             const str = String(val ?? '');
             if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                 return `"${str.replace(/"/g, '""')}"`;
             }
             return str;
          };

          const line = [
              escapeCsv(e.name), 
              e.date ? e.date.split('T')[0] : '', 
              e.status, 
              e.budget || 0, 
              escapeCsv(e.description || ''),
              inc, 
              exp, 
              net
          ].join(',');
          csvContent += line + '\n';
      });
  }

  // --- Append Event Transactions Section ---
  if (state.eventTransactions && state.eventTransactions.length > 0) {
      csvContent += '\n\n\n--- EVENT TRANSACTIONS ---\n';
      csvContent += 'Event Name,Transaction Type,Amount,Date,Description,Member Name\n';
      
      const getMemberName = (id?: string) => state.members.find(m => m.id === id)?.name || '';
      const getEventName = (id: string) => state.events.find(e => e.id === id)?.name || 'Unknown Event';

      state.eventTransactions.forEach(t => {
          const escapeCsv = (val: any) => {
             const str = String(val ?? '');
             if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                 return `"${str.replace(/"/g, '""')}"`;
             }
             return str;
          };

          const line = [
              escapeCsv(getEventName(t.eventId)),
              t.type,
              t.amount,
              t.date ? t.date.split('T')[0] : '',
              escapeCsv(t.description || ''),
              escapeCsv(getMemberName(t.memberId))
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