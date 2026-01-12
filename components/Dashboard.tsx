import React, { useMemo } from 'react';
import { AppState } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, AlertCircle, CheckCircle2, Clock, Wallet, Layers, ArrowRight, Calendar, RotateCcw } from 'lucide-react';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';

interface DashboardProps {
  state: AppState;
  onNavigate: (view: any, filter?: string) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, onNavigate, currentDate, onDateChange }) => {
  const handlePrevMonth = () => onDateChange(subMonths(currentDate, 1));
  const handleNextMonth = () => onDateChange(addMonths(currentDate, 1));
  const handleResetDate = () => onDateChange(new Date());
  
  const selectedMonthStr = format(currentDate, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  const stats = useMemo(() => {
    const monthContribs = state.contributions.filter(c => c.month === selectedMonthStr);
    const totalCollected = monthContribs.reduce((sum, c) => sum + c.amount, 0);
    const lifetimeTotal = state.contributions.reduce((sum, c) => sum + c.amount, 0);

    let paidCount = 0;
    let partialCount = 0;
    const outstandingMembers = [];
    const paidMembers = [];

    state.members.forEach(member => {
      // Only consider active members for monthly stats usually, but we check history
      if (!member.active) {
         // If inactive member paid this month, include them in paid calculations
         const inactivePaid = monthContribs.some(c => c.memberId === member.id);
         if (!inactivePaid) return; 
      }

      const memberPaid = monthContribs
        .filter(c => c.memberId === member.id)
        .reduce((sum, c) => sum + c.amount, 0);
      
      const target = state.monthlyTarget;
      const balance = target - memberPaid;
        
      if (memberPaid >= target) {
        paidCount++;
        paidMembers.push({ ...member, paid: memberPaid });
      } else {
        if (memberPaid > 0) {
            partialCount++;
            paidMembers.push({ ...member, paid: memberPaid });
        }
        outstandingMembers.push({
          ...member,
          paid: memberPaid,
          balance: balance,
          status: memberPaid > 0 ? 'Partial' : 'Unpaid'
        });
      }
    });

    const activeMembersCount = state.members.filter(m => m.active).length;
    // Adjust total members count to only include active ones for the expected target, 
    // unless an inactive member paid.
    const effectiveTotalMembers = activeMembersCount; 
    
    const unpaidCount = effectiveTotalMembers - paidCount - partialCount;
    const expectedTotal = effectiveTotalMembers * state.monthlyTarget;
    const pendingAmount = Math.max(expectedTotal - totalCollected, 0);

    return {
      collected: totalCollected,
      lifetimeTotal,
      expected: expectedTotal,
      pending: pendingAmount,
      paidCount,
      partialCount,
      unpaidCount,
      outstandingMembers: outstandingMembers.sort((a, b) => b.balance - a.balance),
      paidMembers: paidMembers.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    };
  }, [state, selectedMonthStr]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const mStr = format(d, 'yyyy-MM');
        const monthLabel = format(d, 'MMM');
        const total = state.contributions
            .filter(c => c.month === mStr)
            .reduce((sum, c) => sum + c.amount, 0);
        data.push({ 
          name: monthLabel, 
          amount: total,
          isCurrent: mStr === selectedMonthStr 
        });
    }
    return data;
  }, [state.contributions, selectedMonthStr]);

  const participationData = [
      { name: 'Paid', value: stats.paidCount, color: '#66bb6a' }, // Light Green
      { name: 'Partial', value: stats.partialCount, color: '#90a4ae' }, // Blue Grey
      { name: 'Pending', value: stats.unpaidCount, color: '#ef5350' }, // Light Red
  ].filter(d => d.value > 0);

  // Pagination for paid members list
  const DISPLAY_LIMIT = 9;
  const displayPaidMembers = stats.paidMembers.slice(0, DISPLAY_LIMIT);
  const remainingPaidCount = Math.max(0, stats.paidMembers.length - DISPLAY_LIMIT);

  return (
    <div className="animate-fade-in pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- MAIN COLUMN (Monthly Details) --- */}
        <div className="lg:col-span-3 space-y-6">
            
            {/* Header: Title & Filter */}
            <div className="flex items-center justify-between gap-2 mb-2 md:mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-md-sys-color-on-surface truncate">Overview</h1>
                    <p className="hidden md:block text-sm text-md-sys-color-on-surface-variant truncate">Financial Snapshot</p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                     {!isCurrentMonth && (
                        <button 
                            onClick={handleResetDate}
                            className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-md-sys-color-primary-container text-md-sys-color-on-primary-container shadow-sm hover:shadow-md-elevation-1 transition-all active:scale-90"
                            title="Reset to current month"
                        >
                            <RotateCcw size={16} className="md:w-5 md:h-5 opacity-80" />
                        </button>
                    )}

                    {/* Compact Floating Pill Style Date Selector */}
                    <div className="flex items-center justify-between bg-md-sys-color-surface rounded-full p-0.5 md:p-1 pl-1 md:pl-2 border border-md-sys-color-outline/10 shadow-sm relative overflow-hidden group">
                        <button 
                            onClick={handlePrevMonth} 
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-md-sys-color-surface-container-high active:bg-md-sys-color-secondary-container transition-colors"
                        >
                            <ChevronLeft size={18} className="md:w-5 md:h-5 text-md-sys-color-on-surface opacity-70" />
                        </button>
                        
                        <div className="flex flex-col items-center justify-center px-2 md:px-4 min-w-[60px] md:min-w-[100px]">
                            <span className="text-[9px] md:text-xs font-bold text-md-sys-color-primary uppercase tracking-widest leading-none mb-0.5">
                                {format(currentDate, 'yyyy')}
                            </span>
                            <span className="text-sm md:text-lg font-bold text-md-sys-color-on-surface leading-none">
                                <span className="md:hidden">{format(currentDate, 'MMM')}</span>
                                <span className="hidden md:inline">{format(currentDate, 'MMMM')}</span>
                            </span>
                        </div>

                        <button 
                            onClick={handleNextMonth} 
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-md-sys-color-surface-container-high active:bg-md-sys-color-secondary-container transition-colors"
                        >
                            <ChevronRight size={18} className="md:w-5 md:h-5 text-md-sys-color-on-surface opacity-70" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Monthly Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Collected */}
                <div className="bg-md-sys-color-primary-container text-md-sys-color-on-primary-container rounded-md-xl p-6 relative overflow-hidden transition-all hover:shadow-md-elevation-2">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                    <p className="text-sm font-medium opacity-80 mb-2 flex items-center gap-2">
                        <CheckCircle2 size={16} /> Collected this Month
                    </p>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold tracking-tight">{state.currency}{stats.collected.toLocaleString()}</span>
                        {stats.expected > 0 && (
                             <span className="text-sm font-medium mb-2 opacity-80">/ {state.currency}{stats.expected}</span>
                        )}
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-black/10 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div 
                            className="bg-white h-full rounded-full transition-all duration-1000" 
                            style={{width: `${Math.min((stats.collected / (stats.expected || 1)) * 100, 100)}%`}}
                        ></div>
                    </div>
                </div>

                {/* Pending */}
                <div className="bg-md-sys-color-error-container text-md-sys-color-on-error-container rounded-md-xl p-6 relative overflow-hidden transition-all hover:shadow-md-elevation-2">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                    <p className="text-sm font-medium opacity-80 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} /> Outstanding
                    </p>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold tracking-tight">{state.currency}{stats.pending.toLocaleString()}</span>
                    </div>
                    <p className="mt-4 text-sm font-medium opacity-90 flex items-center gap-1">
                        {stats.outstandingMembers.length} members pending
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Participation Donut */}
                 <div className="bg-md-sys-color-surface-container-low rounded-md-xl p-6 border border-md-sys-color-outline/10 flex flex-col">
                     <h3 className="text-lg font-medium text-md-sys-color-on-surface mb-2">Participation</h3>
                     <div className="flex-1 min-h-[200px] relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={participationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {participationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    wrapperStyle={{ outline: 'none', zIndex: 1000 }}
                                    contentStyle={{ 
                                        backgroundColor: '#ffffff', 
                                        border: '1px solid #e0e0e0', 
                                        borderRadius: '12px', 
                                        color: '#191c1a', 
                                        fontSize: '12px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                        padding: '8px 12px'
                                    }}
                                    itemStyle={{ color: '#191c1a', padding: 0, fontWeight: 500 }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                                />
                            </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                             <div className="text-center">
                                 <span className="text-3xl font-bold text-md-sys-color-on-surface">
                                     {Math.round((stats.paidCount / (stats.paidCount + stats.partialCount + stats.unpaidCount || 1)) * 100)}%
                                 </span>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Historical Trends */}
                 <div className="bg-md-sys-color-surface-container-low rounded-md-xl p-6 border border-md-sys-color-outline/10 flex flex-col">
                     <h3 className="text-lg font-medium text-md-sys-color-on-surface mb-2">6 Month Trend</h3>
                     <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#707973" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickMargin={10}
                                />
                                <YAxis 
                                    hide
                                />
                                <RechartsTooltip 
                                    cursor={{fill: 'rgba(0,0,0,0.05)'}}
                                    wrapperStyle={{ outline: 'none', zIndex: 1000 }}
                                    contentStyle={{ 
                                        backgroundColor: '#ffffff', 
                                        border: '1px solid #e0e0e0', 
                                        borderRadius: '12px', 
                                        color: '#191c1a', 
                                        fontSize: '12px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                        padding: '8px 12px'
                                    }}
                                    itemStyle={{ color: '#006c4c', padding: 0, fontWeight: 600 }}
                                    labelStyle={{ color: '#707973', marginBottom: '4px', fontWeight: 500 }}
                                />
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.isCurrent ? '#66bb6a' : '#e0e0e0'} 
                                    />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                 </div>
            </div>

            {/* Payments List */}
            <div className="bg-md-sys-color-surface-container-low rounded-md-xl p-6 border border-md-sys-color-outline/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-md-sys-color-on-surface">Payments Received ({format(currentDate, 'MMM')})</h3>
                    <span className="text-xs font-bold bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container px-2 py-1 rounded-full">
                        {stats.paidMembers.length} / {stats.paidCount + stats.partialCount + stats.unpaidCount}
                    </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayPaidMembers.length > 0 ? (
                        displayPaidMembers.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-md-sys-color-surface-container rounded-md-lg border border-transparent hover:border-md-sys-color-primary/20 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container flex items-center justify-center text-xs font-bold shrink-0">
                                        {member.name.charAt(0)}
                                    </div>
                                    <div className="truncate">
                                        <p className="text-sm font-medium text-md-sys-color-on-surface truncate">{member.name}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-md-sys-color-primary text-sm whitespace-nowrap ml-2">
                                    +{state.currency}{member.paid}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-8 text-center text-md-sys-color-on-surface-variant bg-md-sys-color-surface-container/50 rounded-lg border border-dashed border-md-sys-color-outline/20">
                            <Clock className="mx-auto mb-2 opacity-50" size={24} />
                            <p className="text-sm">No contributions recorded for {format(currentDate, 'MMMM')}.</p>
                        </div>
                    )}
                    
                    {remainingPaidCount > 0 && (
                        <div className="col-span-full flex justify-center mt-2">
                             <span className="text-xs text-md-sys-color-primary font-medium bg-md-sys-color-primary-container px-3 py-1 rounded-full cursor-pointer hover:bg-md-sys-color-primary/20 transition-colors" onClick={() => onNavigate('history')}>
                                +{remainingPaidCount} more payments
                             </span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* --- SIDE COLUMN (Sidebar) --- */}
        <div className="space-y-6">
            
            {/* Lifetime Fund Card */}
            <div className="bg-md-sys-color-tertiary-container rounded-md-xl p-6 relative overflow-hidden text-md-sys-color-on-tertiary-container transition-all hover:shadow-md-elevation-2 group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500"></div>
                <div className="relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4 text-md-sys-color-on-tertiary-container">
                        <Layers size={20} />
                    </div>
                    <p className="text-sm font-medium opacity-80 mb-1">Total Vault</p>
                    <div className="text-3xl font-bold tracking-tight mb-1">
                        {state.currency}{stats.lifetimeTotal.toLocaleString()}
                    </div>
                    <p className="text-xs opacity-70">Accumulated since start</p>
                </div>
            </div>

            {/* Action Needed Sidebar */}
            <div className="bg-md-sys-color-surface-container-low rounded-md-xl border border-md-sys-color-outline/10 flex flex-col overflow-hidden max-h-[600px]">
                <div className="p-4 border-b border-md-sys-color-outline/10 flex justify-between items-center bg-md-sys-color-surface-container">
                    <h3 className="font-medium text-md-sys-color-on-surface flex items-center gap-2">
                        <Wallet size={16} /> Action Needed
                    </h3>
                    <span className="text-xs font-bold bg-md-sys-color-error-container text-md-sys-color-on-error-container px-2 py-0.5 rounded-full">
                        {stats.outstandingMembers.length}
                    </span>
                </div>
            
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {stats.outstandingMembers.length > 0 ? (
                        stats.outstandingMembers.map(member => (
                            <button 
                                key={member.id} 
                                onClick={() => onNavigate('tracker')}
                                className="w-full flex items-center justify-between p-3 hover:bg-md-sys-color-surface-container-high rounded-md-lg transition-colors group text-left border border-transparent hover:border-md-sys-color-outline/10"
                            >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-md-sys-color-surface-variant flex items-center justify-center font-bold text-xs text-md-sys-color-on-surface-variant group-hover:bg-md-sys-color-error-container group-hover:text-md-sys-color-on-error-container transition-colors shrink-0">
                                    {member.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-md-sys-color-on-surface truncate">{member.name}</p>
                                    <p className="text-xs text-md-sys-color-error font-medium">Due: {state.currency}{member.balance}</p>
                                </div>
                            </div>
                            <ArrowRight size={16} className="text-md-sys-color-outline/30 group-hover:text-md-sys-color-primary transition-colors" />
                            </button>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-md-sys-color-outline text-center px-4">
                            <CheckCircle2 size={32} className="mb-2 text-md-sys-color-primary" />
                            <p className="text-sm font-medium text-md-sys-color-on-surface">All caught up!</p>
                            <p className="text-xs mt-1">Everyone has paid for {format(currentDate, 'MMMM')}.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};