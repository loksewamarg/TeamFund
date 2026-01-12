import { AppState, Member, Contribution } from '../types';
import { db } from './firebaseConfig';
import { ref, onValue, set, update, remove, get, child } from 'firebase/database';

// Default seed data to use if DB is completely empty (rarely used with Firebase as it starts null)
const DEFAULT_STATE: AppState = {
  members: [],
  contributions: [],
  monthlyTarget: 100,
  currency: '₹',
};

// --- Subscription Logic ---

/**
 * Listens to Firebase Realtime Database changes.
 */
export const subscribeToAppState = (onUpdate: (state: AppState) => void) => {
  const dbRef = ref(db, '/');
  
  const unsubscribe = onValue(dbRef, (snapshot) => {
    const val = snapshot.val();
    
    if (val) {
        // Convert Firebase Objects (keyed by ID) back to Arrays for the App
        const members = val.members ? Object.values(val.members) as Member[] : [];
        const contributions = val.contributions ? Object.values(val.contributions) as Contribution[] : [];
        const monthlyTarget = val.settings?.monthlyTarget ?? 100;
        const currency = val.settings?.currency ?? '₹';
        
        onUpdate({
            members,
            contributions,
            monthlyTarget,
            currency
        });
    } else {
        // DB is empty, initialize or just return defaults
        onUpdate(DEFAULT_STATE);
    }
  }, (error) => {
    console.error("Firebase read failed", error);
  });

  return () => {
    unsubscribe();
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
    await set(ref(db, `members/${newMember.id}`), newMember);
  },

  updateMember: async (currentMembers: Member[], updatedMember: Member) => {
    await update(ref(db, `members/${updatedMember.id}`), updatedMember);
  },

  removeMember: async (currentMembers: Member[], currentContributions: Contribution[], memberId: string) => {
    const updates: any = {};
    // Remove the member
    updates[`members/${memberId}`] = null;
    
    // Remove all contributions linked to this member
    currentContributions.forEach(c => {
        if (c.memberId === memberId) {
            updates[`contributions/${c.id}`] = null;
        }
    });
    
    await update(ref(db), updates);
  },

  addContribution: async (currentContributions: Contribution[], newContribution: Contribution) => {
    await set(ref(db, `contributions/${newContribution.id}`), newContribution);
  },

  removeContribution: async (contributionId: string) => {
    await remove(ref(db, `contributions/${contributionId}`));
  },

  updateSettings: async (settings: { monthlyTarget: number, currency: string }) => {
    await update(ref(db, 'settings'), settings);
  },

  importFromCSV: async (csvContent: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Fetch current state to check for existing members
      const snapshot = await get(child(ref(db), '/'));
      const val = snapshot.val() || {};
      
      const currentMembersMap = val.members || {};
      const currentContributionsMap = val.contributions || {};
      
      const membersArray: Member[] = Object.values(currentMembersMap);
      const contributionsArray: Contribution[] = Object.values(currentContributionsMap);

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

      const updates: any = {};
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
          let member = membersArray.find(m => m.name.toLowerCase() === name.toLowerCase());
          
          if (member) {
              // Update Member
              let wasUpdated = false;
              if (job && member.job !== job) { member.job = job; wasUpdated = true; }
              if (mobile && member.mobile !== mobile) { member.mobile = mobile; wasUpdated = true; }
              if (address && member.address !== address) { member.address = address; wasUpdated = true; }
              if (member.active !== active) { member.active = active; wasUpdated = true; }
              
              if (wasUpdated) {
                  updates[`members/${member.id}`] = member;
                  membersUpdated++;
              }
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
              updates[`members/${member.id}`] = member;
              // Add to local array for subsequent rows/contributions check
              membersArray.push(member);
              membersAdded++;
          }

          // Process Contributions
          dateColumns.forEach(col => {
              const amountStr = row[col.index];
              const amount = amountStr ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : 0;
              
              if (amount > 0 && member) {
                  const existingContrib = contributionsArray.find(c => c.memberId === member!.id && c.month === col.month);
                  
                  if (existingContrib) {
                      if (existingContrib.amount !== amount) {
                          updates[`contributions/${existingContrib.id}/amount`] = amount;
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
                      updates[`contributions/${newId}`] = contrib;
                      contributionsArray.push(contrib);
                  }
              }
          });
      }

      await update(ref(db), updates);
      return { 
          success: true, 
          message: `Import Successful: ${membersAdded} members added, ${membersUpdated} updated.` 
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

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `teamfund_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};