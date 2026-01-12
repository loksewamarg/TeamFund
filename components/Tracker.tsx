import React, { useState, useMemo } from 'react';
import { AppState, Member } from '../types';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, Search, Wallet, Calendar, Filter, RotateCcw } from 'lucide-react';
import { generateId } from '../services/storageService';

interface TrackerProps {
  state: AppState;
  onAddContribution: (contribution: any) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

type TabFilter = 'all' | 'paid' | 'pending';

export const Tracker: React.FC<TrackerProps> = ({ state, onAddContribution, currentDate, onDateChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  
  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedMemberForPay, setSelectedMemberForPay] = useState<Member | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payTargetMonth, setPayTargetMonth] = useState(''); 

  const handlePrevMonth = () => onDateChange(subMonths(currentDate, 1));
  const handleNextMonth = () => onDateChange(addMonths(currentDate, 1));
  const handleResetDate = () => onDateChange(new Date());

  const selectedMonthStr = format(currentDate, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  const trackerData = useMemo(() => {
    const monthContribs = state.contributions.filter(c => c.month === selectedMonthStr);
    
    // We include members if they are active OR if they are inactive but made a contribution in this specific month
    const relevantMembers = state.members.filter(m => {
        const paidThisMonth = monthContribs.some(c => c.memberId === m.id);
        return m.active || paidThisMonth;
    });

    const data = relevantMembers.map(member => {
      const paid = monthContribs
        .filter(c => c.memberId === member.id)
        .reduce((sum, c) => sum + c.amount, 0);
      
      const target = state.monthlyTarget;
      const remaining = Math.max(target - paid, 0);
      
      let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
      if (paid >= target) status = 'paid';
      else if (paid > 0) status = 'partial';

      return {
        ...member,
        paid,
        remaining,
        status
      };
    });

    // Filter by search term AND Active Tab
    return data.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              m.job.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesTab = true;
        if (activeTab === 'paid') matchesTab = m.status === 'paid';
        if (activeTab === 'pending') matchesTab = m.status !== 'paid';

        return matchesSearch && matchesTab;
    }).sort((a, b) => {
        // Sort: Unpaid/Partial first, then Paid. Within that, alphabetical.
        const score = (status: string) => status === 'paid' ? 2 : status === 'partial' ? 1 : 0;
        return score(a.status) - score(b.status) || a.name.localeCompare(b.name);
    });

  }, [state, selectedMonthStr, searchTerm, activeTab]);

  // Calculate stats based on ALL relevant members for this month (ignoring search filters for summary)
  const stats = useMemo(() => {
    const monthContribs = state.contributions.filter(c => c.month === selectedMonthStr);
    const allMembers = state.members.filter(m => m.active || monthContribs.some(c => c.memberId === m.id));
    
    const paidCount = allMembers.filter(m => {
        const paid = monthContribs.filter(c => c.memberId === m.id).reduce((sum, c) => sum + c.amount, 0);
        return paid >= state.monthlyTarget;
    }).length;

    return { 
        total: allMembers.length, 
        paid: paidCount, 
        pending: allMembers.length - paidCount 
    };
  }, [state, selectedMonthStr]);

  const openPayModal = (member: Member, remaining: number) => {
      setSelectedMemberForPay(member);
      setPayAmount(remaining.toString());
      setPayTargetMonth(selectedMonthStr);
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
    setSelectedMemberForPay(null);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0 animate-fade-in">
       {/* Header: Title & Filter */}
       <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-md-sys-color-on-surface truncate">Tracker</h1>
                <p className="hidden md:block text-sm text-md-sys-color-on-surface-variant truncate">Manage contributions</p>
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

      {/* Filters and Tabs Row */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-md-sys-color-on-surface-variant" />
            <input 
                type="text" 
                placeholder="Search member..." 
                className="w-full bg-md-sys-color-surface-container-low rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-md-sys-color-primary transition-all border border-md-sys-color-outline/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Segmented Control Tabs with Counts */}
        <div className="flex bg-md-sys-color-surface-container-low p-1 rounded-xl border border-md-sys-color-outline/10 w-full md:w-auto overflow-x-auto">
            <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 md:flex-none px-4 lg:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeTab === 'all' 
                    ? 'bg-md-sys-color-surface shadow-md-elevation-1 text-md-sys-color-on-surface' 
                    : 'text-md-sys-color-on-surface-variant hover:bg-md-sys-color-surface-container-high'
                }`}
            >
                All 
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'all' ? 'bg-md-sys-color-surface-variant' : 'bg-black/5'}`}>
                    {stats.total}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('paid')}
                className={`flex-1 md:flex-none px-4 lg:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeTab === 'paid' 
                    ? 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container shadow-sm' 
                    : 'text-md-sys-color-on-surface-variant hover:bg-md-sys-color-surface-container-high'
                }`}
            >
                Paid
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'paid' ? 'bg-white/20' : 'bg-black/5'}`}>
                    {stats.paid}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 md:flex-none px-4 lg:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeTab === 'pending' 
                    ? 'bg-md-sys-color-error-container text-md-sys-color-on-error-container shadow-sm' 
                    : 'text-md-sys-color-on-surface-variant hover:bg-md-sys-color-surface-container-high'
                }`}
            >
                Pending
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'pending' ? 'bg-white/20' : 'bg-black/5'}`}>
                    {stats.pending}
                </span>
            </button>
        </div>
      </div>

      {/* Tracker List */}
      <div className="bg-md-sys-color-surface-container-low rounded-xl border border-md-sys-color-outline/10 overflow-hidden min-h-[300px]">
         <div className="hidden md:grid grid-cols-4 gap-4 p-4 bg-md-sys-color-surface-container text-xs font-medium text-md-sys-color-on-surface-variant border-b border-md-sys-color-outline/10">
            <div className="col-span-2">MEMBER</div>
            <div className="text-right">STATUS</div>
            <div className="text-right">AMOUNT / ACTION</div>
         </div>

         <div className="divide-y divide-md-sys-color-outline/10">
             {trackerData.length > 0 ? (
                 trackerData.map(member => (
                    <div key={member.id} className="p-4 md:grid md:grid-cols-4 md:gap-4 flex flex-col gap-3 items-center md:items-center hover:bg-md-sys-color-surface-container-high transition-colors">
                        
                        {/* Member Info */}
                        <div className="w-full md:col-span-2 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                member.status === 'paid' 
                                    ? 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container'
                                    : 'bg-md-sys-color-surface-variant text-md-sys-color-on-surface-variant'
                            }`}>
                                {member.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-medium text-md-sys-color-on-surface flex items-center gap-2">
                                    {member.name}
                                    {!member.active && (
                                        <span className="text-[10px] bg-md-sys-color-outline/20 text-md-sys-color-on-surface-variant px-1.5 py-0.5 rounded">Inactive</span>
                                    )}
                                </p>
                                <p className="text-xs text-md-sys-color-on-surface-variant">{member.job}</p>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="w-full md:text-right flex md:justify-end items-center justify-between">
                            <span className="md:hidden text-xs text-md-sys-color-on-surface-variant font-medium">STATUS</span>
                            {member.status === 'paid' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-md-sys-color-primary-container text-md-sys-color-on-primary-container">
                                    <CheckCircle2 size={14} /> Paid
                                </span>
                            )}
                            {member.status === 'partial' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-md-sys-color-tertiary-container text-md-sys-color-on-tertiary-container">
                                    <Clock size={14} /> Partial
                                </span>
                            )}
                            {member.status === 'unpaid' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-md-sys-color-error-container text-md-sys-color-on-error-container">
                                    <AlertCircle size={14} /> Pending
                                </span>
                            )}
                        </div>

                        {/* Amount & Action */}
                        <div className="w-full md:text-right flex md:justify-end items-center justify-between">
                            <span className="md:hidden text-xs text-md-sys-color-on-surface-variant font-medium">BALANCE</span>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="font-bold text-md-sys-color-on-surface">{state.currency}{member.paid}</p>
                                    {member.remaining > 0 && (
                                        <p className="text-xs text-md-sys-color-error">Due: {state.currency}{member.remaining}</p>
                                    )}
                                </div>
                                {member.status !== 'paid' && (
                                    <button 
                                        onClick={() => openPayModal(member, member.remaining)}
                                        className="bg-md-sys-color-primary text-md-sys-color-on-primary px-3 py-1.5 rounded-full text-sm font-medium hover:shadow-md-elevation-1 transition-all flex items-center gap-1"
                                    >
                                        <Wallet size={16} /> Pay
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                 ))
             ) : (
                 <div className="flex flex-col items-center justify-center py-12 text-md-sys-color-outline text-center opacity-60">
                     <Filter size={32} className="mb-2" />
                     <p className="text-sm">No members found matching filter.</p>
                 </div>
             )}
         </div>
      </div>

      {/* Pay Modal */}
      {isPayModalOpen && selectedMemberForPay && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-md-sys-color-surface-container-high w-full max-w-[320px] md:max-w-[400px] rounded-md-xl p-6 shadow-md-elevation-3">
                 <form onSubmit={handlePaySubmit} className="space-y-4">
                    <h3 className="text-xl text-md-sys-color-on-surface">Record Payment</h3>
                    <p className="text-sm text-md-sys-color-on-surface-variant">For {selectedMemberForPay.name} - {format(new Date(payTargetMonth + '-01'), 'MMMM yyyy')}</p>
                    <div className="flex items-center bg-md-sys-color-surface-container-low p-3 rounded-md border border-md-sys-color-outline/10 focus-within:border-md-sys-color-primary transition-colors">
                        <span className="text-lg mr-2 font-bold">{state.currency}</span>
                        <input autoFocus type="number" className="w-full bg-transparent outline-none text-xl font-medium" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPayAmount(state.monthlyTarget.toString())} className="flex-1 text-xs border border-md-sys-color-outline/20 px-2 py-2 rounded hover:bg-md-sys-color-surface-container-low">Full ({state.currency}{state.monthlyTarget})</button>
                        <button type="button" onClick={() => setPayAmount((state.monthlyTarget/2).toString())} className="flex-1 text-xs border border-md-sys-color-outline/20 px-2 py-2 rounded hover:bg-md-sys-color-surface-container-low">Half</button>
                    </div>
                     <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 text-md-sys-color-primary font-medium hover:bg-md-sys-color-primary/10 rounded-full">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-full font-medium shadow-md-elevation-1">Confirm</button>
                    </div>
                 </form>
           </div>
        </div>
      )}
    </div>
  );
};