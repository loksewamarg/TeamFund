import React, { useState, useMemo } from 'react';
import { AppState } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import { ArrowDownLeft, CalendarDays, Download, Search, Filter } from 'lucide-react';
import { exportDataToCSV } from '../services/storageService';

interface HistoryProps {
  state: AppState;
}

export const History: React.FC<HistoryProps> = ({ state }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Memoize sorted contributions to avoid resorting on every render
  const sortedContributions = useMemo(() => {
    return [...state.contributions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [state.contributions]);

  const getMemberName = (id: string) => state.members.find(m => m.id === id)?.name || 'Unknown';

  // Memoize filtering
  const filteredContributions = useMemo(() => {
    return sortedContributions.filter(c => {
      const memberName = getMemberName(c.memberId).toLowerCase();
      const amountStr = c.amount.toString();
      const searchLower = searchTerm.toLowerCase();
      return memberName.includes(searchLower) || amountStr.includes(searchLower);
    });
  }, [sortedContributions, searchTerm, state.members]);

  // Memoize grouping
  const grouped = useMemo(() => {
    return filteredContributions.reduce((groups, contribution) => {
      const date = new Date(contribution.date);
      const key = format(date, 'yyyy-MM-dd');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(contribution);
      return groups;
    }, {} as Record<string, typeof sortedContributions>);
  }, [filteredContributions]);

  const handleExport = () => {
    exportDataToCSV(state);
  };

  return (
    <div className="pb-24 md:pb-0 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-3xl font-medium text-md-sys-color-on-surface">Transactions</h2>
        
        <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-md-sys-color-on-surface-variant" />
                <input 
                    type="text" 
                    placeholder="Search history..." 
                    className="w-full bg-md-sys-color-surface-container-high rounded-full pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-md-sys-color-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container px-4 py-2 rounded-full text-sm font-medium hover:shadow-md-elevation-1 transition-shadow"
            >
                <Download size={18} />
                <span className="hidden md:inline">Export CSV</span>
            </button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.keys(grouped).map(dateKey => {
            const date = new Date(dateKey);
            let dateLabel = format(date, 'MMMM d, yyyy');
            if (isToday(date)) dateLabel = 'Today';
            if (isYesterday(date)) dateLabel = 'Yesterday';

            return (
                <div key={dateKey}>
                    <h3 className="text-sm font-medium text-md-sys-color-on-surface-variant mb-3 px-2 sticky top-0 bg-md-sys-color-surface/90 backdrop-blur-sm py-2 z-10">{dateLabel}</h3>
                    <div className="bg-md-sys-color-surface-container-low rounded-md-xl overflow-hidden border border-md-sys-color-outline/10">
                        {grouped[dateKey].map((contrib, index) => (
                            <div key={contrib.id} className={`flex items-center justify-between p-4 hover:bg-md-sys-color-surface-container-high transition-colors ${index !== grouped[dateKey].length - 1 ? 'border-b border-md-sys-color-outline/10' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container flex items-center justify-center shrink-0">
                                        <ArrowDownLeft size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-md-sys-color-on-surface font-medium text-base truncate">{getMemberName(contrib.memberId)}</p>
                                        <p className="text-sm text-md-sys-color-on-surface-variant">{format(new Date(contrib.date), 'h:mm a')}</p>
                                    </div>
                                </div>
                                <div className="text-right whitespace-nowrap pl-2">
                                    <p className="text-md-sys-color-primary font-bold text-lg">+{state.currency}{contrib.amount}</p>
                                    <span className="text-xs text-md-sys-color-outline block">
                                        {contrib.note || 'Contribution'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}

        {filteredContributions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-md-sys-color-outline opacity-60">
            <div className="w-16 h-16 bg-md-sys-color-surface-container-high rounded-full flex items-center justify-center mb-4">
                <Search size={32} />
            </div>
            <p className="font-medium">No transactions found.</p>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-md-sys-color-primary text-sm mt-2 hover:underline">Clear search</button>}
          </div>
        )}
      </div>
    </div>
  );
};