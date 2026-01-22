import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, Member } from '../types';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import { generateId, dbActions } from '../services/storageService';

interface TrackerProps {
  state: AppState;
  onAddContribution: (contribution: any) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export const Tracker: React.FC<TrackerProps> = ({ state, onAddContribution, currentDate, onDateChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Confirmation Modal State
  const [confirmClear, setConfirmClear] = useState<{ member: Member, monthKey: string } | null>(null);

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);

  // Scroll Shadow Logic
  const handleScroll = () => {
      if (scrollContainerRef.current) {
          setShowLeftShadow(scrollContainerRef.current.scrollLeft > 0);
      }
  };

  useEffect(() => {
      const el = scrollContainerRef.current;
      if (el) {
          el.addEventListener('scroll', handleScroll);
          handleScroll();
          return () => el.removeEventListener('scroll', handleScroll);
      }
  }, [state.members]);

  // --- Data Logic ---

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthStr = `${selectedYear}-${monthNum.toString().padStart(2, '0')}`;
        const date = new Date(selectedYear, i, 1);
        return {
            key: monthStr,
            label: format(date, 'MMM'),
            fullLabel: format(date, 'MMMM'),
            isFuture: date > new Date() && date.getMonth() !== new Date().getMonth()
        };
    });
  }, [selectedYear]);

  const filteredMembers = useMemo(() => {
    return state.members.filter(m => 
        (m.active || state.contributions.some(c => c.memberId === m.id && c.month.startsWith(selectedYear.toString()))) &&
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.members, state.contributions, selectedYear, searchTerm]);

  // Aggregations
  const { columnTotals, grandTotal } = useMemo(() => {
      const totals: Record<string, number> = {};
      let totalCollected = 0;

      yearMonths.forEach(m => totals[m.key] = 0);
      
      filteredMembers.forEach(member => {
          yearMonths.forEach(month => {
             const paid = state.contributions
                .filter(c => c.memberId === member.id && c.month === month.key)
                .reduce((sum, c) => sum + c.amount, 0);
             totals[month.key] += paid;
             totalCollected += paid;
          });
      });
      
      return { 
          columnTotals: totals, 
          grandTotal: totalCollected,
      };
  }, [filteredMembers, state.contributions, yearMonths]);


  // --- Click Handlers ---

  const handleCellClick = (member: Member, monthKey: string) => {
      const paid = state.contributions
        .filter(c => c.memberId === member.id && c.month === monthKey)
        .reduce((sum, c) => sum + c.amount, 0);
      
      const isPaid = paid >= state.monthlyTarget;
      
      if (isPaid) {
          // Fully paid -> ask to clear
          setConfirmClear({ member, monthKey });
      } else {
          // Unpaid or Partial -> make fully paid
          const remaining = state.monthlyTarget - paid;
          if (remaining > 0) {
            onAddContribution({
                id: generateId(),
                memberId: member.id,
                amount: remaining,
                date: new Date().toISOString(),
                month: monthKey,
                note: `Marked Paid`
            });
          }
      }
  };

  const handleConfirmClearAction = () => {
      if (!confirmClear) return;
      const { member, monthKey } = confirmClear;
      const toDelete = state.contributions.filter(c => c.memberId === member.id && c.month === monthKey);
      toDelete.forEach(c => dbActions.removeContribution(c.id));
      setConfirmClear(null);
  };


  // --- Renders ---

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-[calc(100vh-64px)] pb-4 md:pb-0 animate-fade-in gap-3 bg-white md:bg-transparent">
       
       {/* 1. TOP CONTROL */}
       <div className="shrink-0 flex items-center justify-between gap-3 px-1 pt-2 md:pt-0">
           <div className="relative flex-1 max-w-[200px] md:max-w-[240px] group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                    type="text" 
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm leading-5 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
           </div>

           <div className="shrink-0 flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-0.5">
                <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
                    <ChevronLeft size={18} />
                </button>
                <span className="px-2 md:px-4 text-sm font-bold text-slate-800 min-w-[4rem] text-center select-none tabular-nums">
                    {selectedYear}
                </span>
                <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
                    <ChevronRight size={18} />
                </button>
           </div>
       </div>

       {/* 2. DATA SPREADSHEET */}
       <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-auto relative overscroll-x-contain"
            >
                <table className="w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                        <tr>
                            <th className={`sticky left-0 z-40 bg-slate-50 px-3 py-3 text-left border-b border-r border-slate-200 min-w-[120px] sm:min-w-[140px] lg:min-w-[200px] transition-shadow duration-200 ${showLeftShadow ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)]' : ''}`}>
                                Member
                            </th>
                            {yearMonths.map(m => (
                                <th key={m.key} className="px-1 py-3 text-center border-b border-r border-slate-100 min-w-[50px] sm:min-w-[60px] lg:min-w-[80px]">
                                    <span className="md:hidden">{m.label.charAt(0)}</span>
                                    <span className="hidden md:inline lg:hidden">{m.label}</span>
                                    <span className="hidden lg:inline">{m.label}</span>
                                </th>
                            ))}
                            <th className="px-2 py-3 text-center border-b border-l border-slate-200 min-w-[70px] sm:min-w-[80px] bg-slate-50/50">
                                Total
                            </th>
                        </tr>
                    </thead>
                    
                    <tbody className="bg-white">
                        {filteredMembers.map((member) => {
                            let rowTotal = 0;
                            return (
                                <tr key={member.id} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className={`sticky left-0 z-20 bg-white group-hover:bg-slate-50 px-3 py-2 border-b border-r border-slate-200 transition-shadow duration-200 ${showLeftShadow ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]' : ''}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${member.active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate leading-tight ${member.active ? 'text-slate-800' : 'text-slate-400'}`}>{member.name}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {yearMonths.map(month => {
                                            const paid = state.contributions
                                            .filter(c => c.memberId === member.id && c.month === month.key)
                                            .reduce((sum, c) => sum + c.amount, 0);
                                            rowTotal += paid;

                                            const isPaid = paid >= state.monthlyTarget;
                                            const isPartial = paid > 0 && !isPaid;
                                            const isFuture = month.isFuture;

                                            let cellClass = "bg-transparent";
                                            let content = <div className="w-1.5 h-1.5 rounded-full bg-slate-100 mx-auto group-hover:bg-slate-200"></div>;

                                            if (isPaid) {
                                                cellClass = "bg-emerald-50 text-emerald-700 font-bold border-emerald-100";
                                                content = <span className="text-[10px] sm:text-[11px]">{state.currency}{paid}</span>;
                                            } else if (isPartial) {
                                                cellClass = "bg-amber-50 text-amber-700 font-medium border-amber-100";
                                                content = <span className="text-[10px] sm:text-[11px]">{state.currency}{paid}</span>;
                                            } else if (isFuture) {
                                                content = <span className="opacity-0">-</span>
                                            }

                                            return (
                                                <td 
                                                    key={month.key} 
                                                    onClick={() => handleCellClick(member, month.key)}
                                                    className="p-1 border-b border-r border-slate-100 h-11 cursor-pointer align-middle select-none"
                                                >
                                                    <div className={`w-full h-full flex items-center justify-center rounded border border-transparent transition-all active:scale-95 hover:border-indigo-200 ${cellClass}`}>
                                                        {content}
                                                    </div>
                                                </td>
                                            )
                                    })}

                                    <td className="px-2 py-2 text-center border-b border-l border-slate-200 font-bold text-slate-700 text-sm">
                                        {state.currency}{rowTotal.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}

                        <tr className="bg-slate-50 font-bold text-xs sticky bottom-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                             <td className={`sticky left-0 z-40 bg-slate-50 px-3 py-3 border-t border-r border-slate-200 text-slate-500 uppercase tracking-wider transition-shadow duration-200 ${showLeftShadow ? 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)]' : ''}`}>
                                 Total
                             </td>
                             {yearMonths.map(m => (
                                 <td key={m.key} className="px-1 py-3 text-center border-t border-r border-slate-200 text-emerald-700">
                                     {columnTotals[m.key] > 0 ? (
                                         <span className="text-[10px] sm:text-xs">{state.currency}{columnTotals[m.key]}</span>
                                     ) : <span className="text-slate-300">-</span>}
                                 </td>
                             ))}
                             <td className="px-2 py-3 text-center border-t border-l border-slate-200 text-emerald-700">
                                 {state.currency}{grandTotal.toLocaleString()}
                             </td>
                        </tr>
                    </tbody>
                </table>
            </div>
       </div>

       {/* 3. CONFIRMATION POPUP */}
       {confirmClear && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-xs sm:max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4 text-amber-600">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <AlertTriangle size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Unpaid?</h3>
                    </div>
                    
                    <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                        Are you sure you want to mark 
                        <strong className="text-slate-900"> {confirmClear.member.name} </strong> 
                        as unpaid for 
                        <strong className="text-slate-900"> {format(new Date(confirmClear.monthKey + '-01'), 'MMMM')}</strong>?
                        <br/>
                        <span className="text-xs text-slate-500 mt-2 block">This will remove the payment record.</span>
                    </p>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setConfirmClear(null)} 
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmClearAction} 
                            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm"
                        >
                            Yes, Unpaid
                        </button>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
};