import React, { useMemo, useState } from 'react';
import { AppState, Member } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, Wallet, Layers, RotateCcw, Trash2, ChevronDown, PartyPopper, ArrowRight, Banknote, TrendingUp, Calendar, Users } from 'lucide-react';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { generateId, dbActions } from '../services/storageService';

interface DashboardProps {
  state: AppState;
  onNavigate: (view: any, filter?: string) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onAddContribution: (contribution: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, onNavigate, currentDate, onDateChange, onAddContribution }) => {
  const handlePrevMonth = () => onDateChange(subMonths(currentDate, 1));
  const handleNextMonth = () => onDateChange(addMonths(currentDate, 1));
  const handleResetDate = () => onDateChange(new Date());
  
  const selectedMonthStr = format(currentDate, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedMemberForPay, setSelectedMemberForPay] = useState<Member | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payTargetMonth, setPayTargetMonth] = useState(''); 
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  // --- Derived Data ---

  // 1. Upcoming Events with Stats
  const upcomingEvents = useMemo(() => {
    return (state.events || [])
        .filter(e => e.status === 'upcoming')
        .map(evt => {
            const evtTrans = (state.eventTransactions || []).filter(t => t.eventId === evt.id);
            const collected = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const spent = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            return { ...evt, collected, spent, net: collected - spent };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.events, state.eventTransactions]);

  // 2. Event Net Balance (Income - Expense)
  const eventNetBalance = useMemo(() => {
      return (state.eventTransactions || []).reduce((acc, t) => {
          return t.type === 'income' ? acc + t.amount : acc - t.amount;
      }, 0);
  }, [state.eventTransactions]);

  // 3. Main Stats
  const stats = useMemo(() => {
    const monthContribs = state.contributions.filter(c => c.month === selectedMonthStr);
    const totalCollected = monthContribs.reduce((sum, c) => sum + c.amount, 0);
    
    const contributionTotal = state.contributions.reduce((sum, c) => sum + c.amount, 0);
    // Total Vault = All Contributions + Net Event Balance
    const lifetimeTotal = contributionTotal + eventNetBalance;

    let paidCount = 0;
    let partialCount = 0;
    const outstandingMembers: any[] = [];
    const paidMembers: any[] = [];

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
      paidMembers: paidMembers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // sort by payment date? No, members don't have date. 
    };
  }, [state, selectedMonthStr, eventNetBalance]);

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

  // --- Modal Logic ---

  const openPayModal = (member: Member, remaining: number) => {
      setSelectedMemberForPay(member);
      setPayAmount(remaining > 0 ? remaining.toString() : '');
      setPayTargetMonth(selectedMonthStr);
      setExpandedPaymentId(null);
      setIsPayModalOpen(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForPay || !payAmount) return;
    
    const recordDate = new Date(); 
    
    onAddContribution({
      id: generateId(),
      memberId: selectedMemberForPay.id,
      amount: Number(payAmount),
      date: recordDate.toISOString(),
      month: payTargetMonth,
      note: `Payment for ${format(new Date(payTargetMonth + '-01'), 'MMMM yyyy')}`
    });
    
    setPayAmount('');
    setIsPayModalOpen(false); 
  };

  const handleDeleteContribution = (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment record?')) {
        dbActions.removeContribution(id);
    }
  };

  const scrollToActions = () => {
    const element = document.getElementById('action-needed-widget');
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Get current contributions for the modal view
  const currentMemberContributions = useMemo(() => {
    if (!selectedMemberForPay || !payTargetMonth) return [];
    return state.contributions
      .filter(c => c.memberId === selectedMemberForPay.id && c.month === payTargetMonth)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.contributions, selectedMemberForPay, payTargetMonth]);

  // --- Reusable Component Pieces ---

  const MobileHeroCard = () => {
    const percent = Math.min((stats.collected / (stats.expected || 1)) * 100, 100);
    return (
      <div className="bg-gradient-to-br from-md-sys-color-primary to-[#004d36] rounded-[1.5rem] p-5 text-white shadow-md-elevation-2 relative overflow-hidden mb-5">
        {/* Abstract Shapes */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-12 -mt-12 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
               <div className="flex items-center gap-2 opacity-80">
                  <span className="text-xs font-bold uppercase tracking-widest">Total Collected</span>
               </div>
               <div className="bg-white/10 px-2 py-1 rounded-lg backdrop-blur-md border border-white/5">
                   <span className="text-xs font-bold">{Math.round(percent)}%</span>
               </div>
            </div>
            <div className="flex items-baseline gap-2 mb-6">
                 <h2 className="text-4xl font-bold tracking-tight truncate">{state.currency}{stats.collected.toLocaleString()}</h2>
                 <span className="text-sm opacity-60 font-medium whitespace-nowrap">/ {state.currency}{stats.expected.toLocaleString()}</span>
            </div>
          </div>

          <div>
             {/* Progress Bar */}
            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mb-6 backdrop-blur-sm">
                <div className="bg-white h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${percent}%` }}></div>
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-2 gap-3">
                <div 
                    onClick={scrollToActions} 
                    className="bg-black/20 hover:bg-black/30 active:scale-95 transition-all rounded-xl p-3 backdrop-blur-md border border-white/5 cursor-pointer flex flex-col justify-between"
                >
                    <div className="flex items-center gap-2 mb-2 text-emerald-100">
                        <Users size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide opacity-80">Pending</span>
                    </div>
                    <p className="text-lg font-bold truncate">{state.currency}{stats.pending.toLocaleString()}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md border border-white/5 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 text-emerald-100">
                        <Layers size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide opacity-80">Vault</span>
                    </div>
                    <p className="text-lg font-bold truncate">{state.currency}{stats.lifetimeTotal.toLocaleString()}</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const VaultWidget = ({ mobile = false }) => (
    <div className={`bg-md-sys-color-tertiary-container rounded-2xl p-5 relative overflow-hidden text-md-sys-color-on-tertiary-container transition-all hover:shadow-md flex flex-col justify-between ${mobile ? 'h-full min-h-[120px]' : 'w-full min-h-[140px]'}`}>
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
        <div className="relative z-10 min-w-0 w-full">
            <div className="flex items-center gap-2 mb-2 opacity-80">
                <Layers size={16} />
                <span className="text-xs font-bold uppercase tracking-wider truncate">Total Vault</span>
            </div>
            <div 
                className="text-2xl font-bold tracking-tight truncate w-full" 
                title={`${state.currency}${stats.lifetimeTotal.toLocaleString()}`}
            >
                {state.currency}{stats.lifetimeTotal.toLocaleString()}
            </div>
        </div>
    </div>
  );

  const UpcomingEventsWidget = ({ mobile = false }) => (
    <div className={`bg-md-sys-color-surface-container-low rounded-2xl border border-md-sys-color-outline/10 flex flex-col overflow-hidden ${mobile ? 'min-h-[120px]' : 'min-h-[140px]'}`}>
        <div className="px-4 py-3 border-b border-md-sys-color-outline/10 flex justify-between items-center bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container">
            <h3 className="font-medium flex items-center gap-2 text-sm min-w-0">
                <PartyPopper size={16} className="shrink-0" /> <span className="truncate">Upcoming</span>
            </h3>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                {upcomingEvents.length}
            </span>
        </div>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            {upcomingEvents.length > 0 ? (
                upcomingEvents.slice(0, 3).map(evt => {
                     return (
                        <div 
                            key={evt.id} 
                            onClick={() => onNavigate('events', evt.id)}
                            className="w-full flex flex-col p-3 hover:bg-md-sys-color-surface-container-high rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-md-sys-color-outline/10"
                        >
                            <div className="flex justify-between items-start w-full gap-2 mb-1">
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-bold text-md-sys-color-on-surface truncate leading-tight">{evt.name}</p>
                                    <p className="text-xs text-md-sys-color-on-surface-variant flex items-center gap-1 mt-0.5">
                                        <Calendar size={12} /> {format(new Date(evt.date), 'MMMM d')}
                                    </p>
                                </div>
                                <ArrowRight size={16} className="text-md-sys-color-outline/50 group-hover:text-md-sys-color-primary shrink-0 mt-0.5" />
                            </div>
                            
                            {/* Financial Details */}
                            <div className="flex flex-wrap items-center gap-2 w-full mt-1">
                                <div className="bg-md-sys-color-primary-container/40 px-1.5 py-0.5 rounded text-xs font-medium text-md-sys-color-primary whitespace-nowrap truncate max-w-[45%]">
                                    Col: {state.currency}{evt.collected}
                                </div>
                                <div className="bg-md-sys-color-error-container/40 px-1.5 py-0.5 rounded text-xs font-medium text-md-sys-color-error whitespace-nowrap truncate max-w-[45%]">
                                    Spt: {state.currency}{evt.spent}
                                </div>
                            </div>
                        </div>
                     );
                })
            ) : (
                <div className="flex flex-col items-center justify-center h-full py-4 opacity-50 text-center">
                    <PartyPopper size={20} className="mb-1 opacity-50"/>
                    <p className="text-xs">No upcoming events.</p>
                </div>
            )}
        </div>
    </div>
  );

  const ActionNeededWidget = () => (
    <div id="action-needed-widget" className="bg-md-sys-color-surface-container-low rounded-2xl border border-md-sys-color-outline/10 flex flex-col overflow-hidden h-full max-h-[400px]">
        <div className="px-4 py-3 border-b border-md-sys-color-outline/10 flex justify-between items-center bg-md-sys-color-surface-container">
            <h3 className="font-medium text-md-sys-color-on-surface flex items-center gap-2 text-sm">
                <Wallet size={16} /> Action Needed
            </h3>
            <span className="text-xs font-bold bg-md-sys-color-error-container text-md-sys-color-on-error-container px-2 py-0.5 rounded-full">
                {stats.outstandingMembers.length}
            </span>
        </div>
    
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {stats.outstandingMembers.length > 0 ? (
                stats.outstandingMembers.map(member => (
                    <div 
                        key={member.id} 
                        className="w-full flex items-center justify-between p-2.5 hover:bg-md-sys-color-surface-container-high rounded-xl transition-colors group text-left border border-transparent hover:border-md-sys-color-outline/10 cursor-pointer"
                        onClick={() => openPayModal(member, member.balance)}
                    >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-md-sys-color-surface-variant flex items-center justify-center font-bold text-sm text-md-sys-color-on-surface-variant group-hover:bg-md-sys-color-error-container group-hover:text-md-sys-color-on-error-container transition-colors shrink-0">
                            {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-md-sys-color-on-surface truncate">{member.name}</p>
                            <p className="text-xs text-md-sys-color-error font-medium truncate">Due: {state.currency}{member.balance}</p>
                        </div>
                    </div>
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            openPayModal(member, member.balance);
                        }}
                        className="ml-2 p-2 rounded-full bg-md-sys-color-primary-container text-md-sys-color-on-primary-container hover:bg-md-sys-color-primary hover:text-md-sys-color-on-primary transition-colors hover:shadow-sm shrink-0"
                        title="Pay Now"
                     >
                        <Wallet size={16} />
                    </button>
                    </div>
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-md-sys-color-outline text-center px-4">
                    <CheckCircle2 size={32} className="mb-2 text-md-sys-color-primary" />
                    <p className="text-sm font-medium text-md-sys-color-on-surface">All caught up!</p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-24 md:pb-12">
      
      {/* Header: Title & Filter */}
      <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
            <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-md-sys-color-on-surface truncate">Overview</h1>
                <p className="hidden md:block text-sm text-md-sys-color-on-surface-variant truncate">Financial Snapshot</p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
                    {!isCurrentMonth && (
                    <button 
                        onClick={handleResetDate}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-md-sys-color-primary-container text-md-sys-color-on-primary-container shadow-sm hover:shadow-md transition-all active:scale-90"
                        title="Reset to current month"
                    >
                        <RotateCcw size={18} className="opacity-80" />
                    </button>
                )}

                {/* Date Selector */}
                <div className="flex items-center bg-md-sys-color-surface rounded-full p-1 border border-md-sys-color-outline/10 shadow-sm relative overflow-hidden group">
                    <button 
                        onClick={handlePrevMonth} 
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-md-sys-color-surface-container-high transition-colors"
                    >
                        <ChevronLeft size={18} className="text-md-sys-color-on-surface opacity-70" />
                    </button>
                    
                    <div className="flex flex-col items-center justify-center px-3 min-w-[80px]">
                        <span className="text-[10px] font-bold text-md-sys-color-primary uppercase tracking-wider leading-none mb-0.5">
                            {format(currentDate, 'yyyy')}
                        </span>
                        <span className="text-sm font-bold text-md-sys-color-on-surface leading-none">
                            {format(currentDate, 'MMMM')}
                        </span>
                    </div>

                    <button 
                        onClick={handleNextMonth} 
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-md-sys-color-surface-container-high transition-colors"
                    >
                        <ChevronRight size={18} className="text-md-sys-color-on-surface opacity-70" />
                    </button>
                </div>
            </div>
      </div>

      {/* --- MOBILE HERO SECTION --- */}
      <div className="md:hidden">
         <MobileHeroCard />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        
        {/* --- MAIN CONTENT AREA --- */}
        <div className="xl:col-span-3 space-y-4 md:space-y-6">

            {/* Desktop Top Stats Grid (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-2 gap-4">
                {/* 1. Collected */}
                <div className="bg-md-sys-color-primary-container text-md-sys-color-on-primary-container rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between min-h-[140px]">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
                             Collected
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold tracking-tight truncate">{state.currency}{stats.collected.toLocaleString()}</span>
                            <span className="text-xs opacity-70 hidden sm:inline whitespace-nowrap">/ {state.currency}{stats.expected}</span>
                        </div>
                    </div>
                     {/* Progress Bar */}
                    <div className="relative z-10 w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-white h-full rounded-full transition-all duration-1000" 
                            style={{width: `${Math.min((stats.collected / (stats.expected || 1)) * 100, 100)}%`}}
                        ></div>
                    </div>
                </div>

                {/* 2. Outstanding */}
                <div 
                    onClick={scrollToActions}
                    className="bg-md-sys-color-error-container text-md-sys-color-on-error-container rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between min-h-[140px] cursor-pointer active:scale-95"
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                    <div className="relative z-10">
                         <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
                             Pending
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold tracking-tight truncate">{state.currency}{stats.pending.toLocaleString()}</span>
                        </div>
                    </div>
                    <p className="relative z-10 text-xs font-medium opacity-90 flex items-center gap-1">
                        <Users size={12} /> {stats.outstandingMembers.length} members
                    </p>
                </div>
            </div>
            
            {/* Tablet/Mobile Widget Group */}
            {/* On Mobile: Hidden (handled by hero) | On Tablet (md/lg): Grid 2 cols | On Desktop (xl): Hidden (moved to sidebar) */}
            <div className="md:grid md:grid-cols-2 gap-4 xl:hidden hidden">
                <div className="h-full">
                    <VaultWidget mobile />
                </div>
                {upcomingEvents.length > 0 && (
                    <div className="h-full">
                         <UpcomingEventsWidget mobile />
                    </div>
                )}
            </div>
            
            {/* Mobile Only: Events below Hero */}
            <div className="md:hidden">
                 {upcomingEvents.length > 0 && <UpcomingEventsWidget mobile />}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Participation Donut */}
                 <div className="bg-md-sys-color-surface-container-low rounded-2xl p-4 md:p-6 border border-md-sys-color-outline/10 flex flex-col">
                     <h3 className="text-base md:text-lg font-medium text-md-sys-color-on-surface mb-2">Participation</h3>
                     <div className="flex-1 min-h-[180px] md:min-h-[200px] relative">
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
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '0px' }}
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
                 <div className="bg-md-sys-color-surface-container-low rounded-2xl p-4 md:p-6 border border-md-sys-color-outline/10 flex flex-col">
                     <h3 className="text-base md:text-lg font-medium text-md-sys-color-on-surface mb-2">6 Month Trend</h3>
                     <div className="flex-1 min-h-[180px] md:min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#707973" 
                                    fontSize={11} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickMargin={8}
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

            {/* Action Needed (Visible on Mobile/Tablet/LG here, Hidden on XL sidebar) */}
            <div className="xl:hidden">
                <ActionNeededWidget />
            </div>

            {/* Payments List */}
            <div className="bg-md-sys-color-surface-container-low rounded-2xl p-4 md:p-6 border border-md-sys-color-outline/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base md:text-lg font-medium text-md-sys-color-on-surface">Payments Received ({format(currentDate, 'MMM')})</h3>
                    <span className="text-xs font-bold bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container px-2 py-1 rounded-full">
                        {stats.paidMembers.length} / {stats.paidCount + stats.partialCount + stats.unpaidCount}
                    </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayPaidMembers.length > 0 ? (
                        displayPaidMembers.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-md-sys-color-surface-container rounded-xl border border-transparent hover:border-md-sys-color-primary/20 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container flex items-center justify-center text-xs font-bold shrink-0">
                                        {member.name.charAt(0)}
                                    </div>
                                    <div className="truncate min-w-0">
                                        <p className="text-sm font-medium text-md-sys-color-on-surface truncate">{member.name}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-md-sys-color-primary text-sm whitespace-nowrap ml-2 shrink-0">
                                    +{state.currency}{member.paid}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-6 text-center text-md-sys-color-on-surface-variant bg-md-sys-color-surface-container/50 rounded-lg border border-dashed border-md-sys-color-outline/20">
                            <Clock className="mx-auto mb-1 opacity-50" size={20} />
                            <p className="text-xs">No contributions yet.</p>
                        </div>
                    )}
                    
                    {remainingPaidCount > 0 && (
                        <div className="col-span-full flex justify-center mt-1">
                             <span className="text-xs text-md-sys-color-primary font-medium bg-md-sys-color-primary-container px-3 py-1 rounded-full cursor-pointer hover:bg-md-sys-color-primary/20 transition-colors" onClick={() => onNavigate('history')}>
                                +{remainingPaidCount} more
                             </span>
                        </div>
                    )}
                </div>
            </div>

        </div>

        {/* --- SIDEBAR COLUMN (Desktop XL Only) --- */}
        <div className="hidden xl:block space-y-6 min-w-0">
            <VaultWidget />
            {upcomingEvents.length > 0 && <UpcomingEventsWidget />}
            <ActionNeededWidget />
        </div>
      </div>
      
       {/* Pay Modal */}
      {isPayModalOpen && selectedMemberForPay && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-md-sys-color-surface-container-high w-full max-w-[360px] md:max-w-[420px] rounded-2xl p-6 shadow-md-elevation-3 flex flex-col max-h-[85vh]">
                 <div className="mb-4">
                     <h3 className="text-xl font-medium text-md-sys-color-on-surface">Manage Payment</h3>
                     <p className="text-sm text-md-sys-color-on-surface-variant">{selectedMemberForPay.name} • {format(new Date(payTargetMonth + '-01'), 'MMMM yyyy')}</p>
                 </div>

                 {/* Existing Contributions List */}
                 <div className="flex-1 overflow-y-auto mb-6 bg-md-sys-color-surface-container-low rounded-xl p-2 space-y-2 border border-md-sys-color-outline/10">
                    <div className="flex justify-between items-center px-2 pt-1 pb-1">
                        <p className="text-xs font-bold text-md-sys-color-on-surface-variant uppercase">Payment History</p>
                        <span className="text-[10px] text-md-sys-color-outline">{currentMemberContributions.length} records</span>
                    </div>
                    {currentMemberContributions.length > 0 ? (
                        currentMemberContributions.map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => setExpandedPaymentId(expandedPaymentId === c.id ? null : c.id)}
                                className={`flex flex-col p-3 bg-md-sys-color-surface rounded-lg border transition-all cursor-pointer ${
                                    expandedPaymentId === c.id 
                                    ? 'border-md-sys-color-primary shadow-md-elevation-1 ring-1 ring-md-sys-color-primary' 
                                    : 'border-md-sys-color-outline/5 hover:border-md-sys-color-primary/20'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div>
                                        <p className="font-bold text-md-sys-color-primary text-sm">+{state.currency}{c.amount}</p>
                                        <p className="text-[10px] text-md-sys-color-on-surface-variant">{format(new Date(c.date), 'MMM d, h:mm a')}</p>
                                    </div>
                                    <div className={`transition-transform duration-200 ${expandedPaymentId === c.id ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={16} className="text-md-sys-color-outline/30" />
                                    </div>
                                </div>
                                
                                {expandedPaymentId === c.id && (
                                    <div className="mt-3 pt-2 border-t border-md-sys-color-outline/10 animate-fade-in">
                                        {c.note && <p className="text-xs text-md-sys-color-on-surface-variant mb-2 italic">"{c.note}"</p>}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteContribution(c.id);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 bg-md-sys-color-error-container text-md-sys-color-on-error-container text-xs font-bold py-2 rounded-lg hover:opacity-80 transition-opacity"
                                        >
                                            <Trash2 size={14} /> Delete Record
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-center py-4 text-md-sys-color-outline/50 italic">No payments recorded yet.</p>
                    )}
                 </div>

                 <form onSubmit={handlePaySubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-md-sys-color-on-surface-variant uppercase">Add New Payment</label>
                        <div className="flex items-center bg-md-sys-color-surface rounded-lg border border-md-sys-color-outline/10 focus-within:border-md-sys-color-primary transition-colors p-3">
                            <span className="text-lg mr-2 font-bold text-md-sys-color-on-surface-variant">{state.currency}</span>
                            <input 
                                autoFocus={currentMemberContributions.length === 0} 
                                type="number" 
                                className="w-full bg-transparent outline-none text-xl font-medium text-md-sys-color-on-surface" 
                                value={payAmount} 
                                onChange={e => setPayAmount(e.target.value)} 
                                placeholder="Enter amount"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPayAmount(state.monthlyTarget.toString())} className="flex-1 text-xs border border-md-sys-color-outline/20 px-2 py-2 rounded-lg hover:bg-md-sys-color-surface-container-low text-md-sys-color-on-surface-variant">Full ({state.currency}{state.monthlyTarget})</button>
                        <button type="button" onClick={() => setPayAmount((state.monthlyTarget/2).toString())} className="flex-1 text-xs border border-md-sys-color-outline/20 px-2 py-2 rounded-lg hover:bg-md-sys-color-surface-container-low text-md-sys-color-on-surface-variant">Half</button>
                    </div>
                     <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-md-sys-color-outline/10">
                        <button type="button" onClick={() => { setIsPayModalOpen(false); setSelectedMemberForPay(null); }} className="px-4 py-2 text-md-sys-color-primary font-medium hover:bg-md-sys-color-primary/10 rounded-full">Close</button>
                        <button type="submit" disabled={!payAmount} className="px-6 py-2 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-full font-medium shadow-md-elevation-1 disabled:opacity-50 disabled:shadow-none">Add</button>
                    </div>
                 </form>
           </div>
        </div>
      )}
    </div>
  );
};