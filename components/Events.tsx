import React, { useState, useMemo, useEffect } from 'react';
import { AppState, Event } from '../types';
import { Plus, Calendar, ArrowUpCircle, ArrowDownCircle, Trash2, X, ChevronLeft, PartyPopper, Wallet, ArrowRight, CheckCircle2, RotateCcw, Edit2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { generateId, dbActions } from '../services/storageService';

interface EventsProps {
  state: AppState;
  initialEventId?: string; // For deep linking from Dashboard
}

export const Events: React.FC<EventsProps> = ({ state, initialEventId }) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income');

  // Form States
  const [newEvent, setNewEvent] = useState({ name: '', date: '', budget: '' });
  const [editEventData, setEditEventData] = useState({ id: '', name: '', date: '', budget: '' });
  const [newTransaction, setNewTransaction] = useState({ amount: '', description: '', memberId: '' });

  // Handle deep linking
  useEffect(() => {
    if (initialEventId) {
        setSelectedEventId(initialEventId);
    }
  }, [initialEventId]);

  // Ensure arrays exist (for backward compatibility if migrating from older state)
  const events = state.events || [];
  const transactions = state.eventTransactions || [];

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Derived Data for specific event
  const eventStats = useMemo(() => {
    if (!selectedEventId) return null;
    const evtTrans = transactions.filter(t => t.eventId === selectedEventId);
    
    const income = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    // Sort transactions by date desc
    const sortedTrans = [...evtTrans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { income, expense, balance: income - expense, transactions: sortedTrans };
  }, [selectedEventId, transactions]);

  // Overall List Data
  const eventsList = useMemo(() => {
     return events.map(evt => {
        const evtTrans = transactions.filter(t => t.eventId === evt.id);
        const income = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return { ...evt, income, expense, balance: income - expense };
     }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, transactions]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name) return;
    
    dbActions.addEvent({
      id: generateId(),
      name: newEvent.name,
      date: newEvent.date || new Date().toISOString(),
      status: 'upcoming',
      budget: newEvent.budget ? Number(newEvent.budget) : 0
    });
    
    setNewEvent({ name: '', date: '', budget: '' });
    setIsNewEventModalOpen(false);
  };

  const handleUpdateEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editEventData.name || !selectedEvent) return;

      dbActions.updateEvent({
          ...selectedEvent,
          name: editEventData.name,
          date: editEventData.date,
          budget: editEventData.budget ? Number(editEventData.budget) : 0
      });

      setIsEditModalOpen(false);
  };

  const openEditModal = () => {
      if(!selectedEvent) return;
      setEditEventData({
          id: selectedEvent.id,
          name: selectedEvent.name,
          date: selectedEvent.date.split('T')[0], // Extract YYYY-MM-DD
          budget: selectedEvent.budget?.toString() || ''
      });
      setIsEditModalOpen(true);
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !newTransaction.amount) return;

    dbActions.addEventTransaction({
      id: generateId(),
      eventId: selectedEventId,
      type: transactionType,
      amount: Number(newTransaction.amount),
      description: newTransaction.description || (transactionType === 'income' ? 'Contribution' : 'Expense'),
      memberId: transactionType === 'income' ? newTransaction.memberId : undefined,
      date: new Date().toISOString()
    });

    setNewTransaction({ amount: '', description: '', memberId: '' });
    setIsTransactionModalOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Delete this event? All associated records will be lost.')) {
        dbActions.deleteEvent(id);
        setSelectedEventId(null);
    }
  };

  const toggleEventStatus = (evt: Event) => {
      const newStatus = evt.status === 'upcoming' ? 'completed' : 'upcoming';
      dbActions.updateEvent({ ...evt, status: newStatus });
  };

  // --- Views ---

  // 1. DETAIL VIEW
  if (selectedEvent && eventStats) {
      return (
        <div className="pb-32 md:pb-24 animate-fade-in relative min-h-screen bg-md-sys-color-background">
             
             {/* Hero Header (Mobile Optimized) */}
             <div className="bg-md-sys-color-primary-container relative overflow-hidden pb-12 pt-6 px-4 md:rounded-b-3xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4 text-md-sys-color-on-primary-container/70 cursor-pointer" onClick={() => setSelectedEventId(null)}>
                        <ChevronLeft size={20} />
                        <span className="text-sm font-medium">Back</span>
                    </div>

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-md-sys-color-on-primary-container leading-tight">
                                {selectedEvent.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-1 text-md-sys-color-on-primary-container/80 text-sm">
                                <Calendar size={14} /> 
                                {format(new Date(selectedEvent.date), 'MMM d, yyyy')}
                                {selectedEvent.status === 'completed' && (
                                    <span className="bg-black/10 px-2 py-0.5 rounded-full text-xs font-bold">Closed</span>
                                )}
                            </div>
                        </div>
                        <button onClick={openEditModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30 text-md-sys-color-on-primary-container transition-colors">
                            <Edit2 size={18} />
                        </button>
                    </div>
                </div>
             </div>

             {/* Overlapping Stats Card */}
             <div className="px-4 -mt-8 relative z-20">
                <div className="bg-white rounded-2xl shadow-md-elevation-1 p-4 border border-md-sys-color-outline/5">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-md-sys-color-outline/10">
                         <div>
                             <p className="text-xs font-bold text-md-sys-color-on-surface-variant uppercase tracking-wider">Net Balance</p>
                             <p className={`text-3xl font-bold mt-1 ${eventStats.balance >= 0 ? 'text-md-sys-color-primary' : 'text-md-sys-color-error'}`}>
                                 {state.currency}{eventStats.balance.toLocaleString()}
                             </p>
                         </div>
                         <div className="flex gap-2">
                             <button 
                                onClick={() => toggleEventStatus(selectedEvent)} 
                                className="px-4 py-2 text-sm font-medium text-md-sys-color-primary bg-md-sys-color-primary-container/20 rounded-full flex items-center gap-2 hover:bg-md-sys-color-primary-container/30 transition-colors"
                             >
                                 {selectedEvent.status === 'upcoming' ? <CheckCircle2 size={18} /> : <RotateCcw size={18} />}
                                 {selectedEvent.status === 'upcoming' ? "Mark Complete" : "Reopen Event"}
                             </button>
                             <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="p-2 text-md-sys-color-error bg-md-sys-color-error-container/20 rounded-full" title="Delete">
                                 <Trash2 size={20} />
                             </button>
                         </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-md-sys-color-on-surface-variant">Collected</p>
                                <p className="font-bold text-md-sys-color-on-surface">{state.currency}{eventStats.income}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700">
                                <TrendingDown size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-md-sys-color-on-surface-variant">Spent</p>
                                <p className="font-bold text-md-sys-color-on-surface">{state.currency}{eventStats.expense}</p>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Transactions List */}
             <div className="mt-6 px-4">
                 <h3 className="font-bold text-md-sys-color-on-surface mb-3 flex items-center gap-2">
                     <Wallet size={18} /> Transactions
                 </h3>
                 <div className="space-y-3">
                     {eventStats.transactions.length > 0 ? (
                         eventStats.transactions.map(t => (
                             <div key={t.id} className="bg-white p-3 rounded-xl border border-md-sys-color-outline/10 flex items-center justify-between shadow-sm">
                                 <div className="flex items-center gap-3">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                         {t.type === 'income' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                     </div>
                                     <div>
                                         <p className="font-medium text-sm text-md-sys-color-on-surface line-clamp-1">
                                             {t.memberId ? state.members.find(m => m.id === t.memberId)?.name : t.description}
                                         </p>
                                         <p className="text-xs text-md-sys-color-on-surface-variant">
                                            {format(new Date(t.date), 'MMM d')} • {t.memberId ? t.description : (t.type === 'income' ? 'Income' : 'Expense')}
                                         </p>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <span className={`block font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                         {t.type === 'income' ? '+' : '-'}{state.currency}{t.amount}
                                     </span>
                                     <button onClick={() => dbActions.removeEventTransaction(t.id)} className="text-xs text-md-sys-color-outline/50 hover:text-md-sys-color-error mt-1">Remove</button>
                                 </div>
                             </div>
                         ))
                     ) : (
                         <div className="text-center py-8 text-md-sys-color-outline/50 bg-md-sys-color-surface-container-low rounded-xl border border-dashed border-md-sys-color-outline/20">
                             <p className="text-sm">No transactions yet.</p>
                         </div>
                     )}
                 </div>
             </div>
             
             {/* Sticky Actions Footer */}
             {selectedEvent.status === 'upcoming' && (
                 <div className="fixed bottom-20 md:bottom-0 left-0 right-0 p-4 bg-white border-t border-md-sys-color-outline/10 z-50 md:pl-80 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                     <button 
                        onClick={() => { setTransactionType('income'); setIsTransactionModalOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-xl font-bold shadow-md-elevation-1 active:scale-95 transition-transform"
                     >
                         <ArrowDownCircle size={18} /> Add Income
                     </button>
                     <button 
                        onClick={() => { setTransactionType('expense'); setIsTransactionModalOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-md-sys-color-error-container text-md-sys-color-on-error-container rounded-xl font-bold shadow-md-elevation-1 active:scale-95 transition-transform"
                     >
                         <ArrowUpCircle size={18} /> Add Expense
                     </button>
                 </div>
             )}
             
             {/* Transaction Modal */}
            {isTransactionModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-md-sys-color-surface w-full max-w-[360px] rounded-2xl p-6 shadow-xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold capitalize flex items-center gap-2">
                                {transactionType === 'income' ? <ArrowDownCircle className="text-green-600"/> : <ArrowUpCircle className="text-red-600"/>}
                                Add {transactionType}
                            </h3>
                            <button onClick={() => setIsTransactionModalOpen(false)} className="p-1 rounded-full hover:bg-md-sys-color-surface-container-high"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleCreateTransaction} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Amount</label>
                                <div className="flex items-center bg-md-sys-color-surface-container-low rounded-xl px-4 border border-md-sys-color-outline/10 focus-within:border-md-sys-color-primary transition-colors">
                                    <span className="text-xl font-bold text-md-sys-color-on-surface-variant mr-1">{state.currency}</span>
                                    <input 
                                        autoFocus
                                        type="number" 
                                        className="w-full bg-transparent py-3.5 outline-none font-bold text-lg text-md-sys-color-on-surface" 
                                        placeholder="0"
                                        value={newTransaction.amount}
                                        onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            {transactionType === 'income' && (
                                <div>
                                    <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Member (Optional)</label>
                                    <select 
                                        className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary text-md-sys-color-on-surface font-medium"
                                        value={newTransaction.memberId}
                                        onChange={e => setNewTransaction({...newTransaction, memberId: e.target.value})}
                                    >
                                        <option value="">-- General Collection --</option>
                                        {state.members.filter(m => m.active).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Description</label>
                                <input 
                                    className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                    placeholder={transactionType === 'income' ? "e.g. Donation" : "e.g. Decorations, Snacks"}
                                    value={newTransaction.description}
                                    onChange={e => setNewTransaction({...newTransaction, description: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="w-full py-3.5 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-xl font-bold shadow-md-elevation-1 mt-2">
                                Save Transaction
                            </button>
                        </form>
                    </div>
                </div>
            )}

             {/* Edit Event Modal */}
             {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-md-sys-color-surface w-full max-w-[360px] rounded-2xl p-6 shadow-xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Edit Event</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-md-sys-color-surface-container-high"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleUpdateEvent} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Event Name</label>
                                <input 
                                    required
                                    className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                    value={editEventData.name}
                                    onChange={e => setEditEventData({...editEventData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Date</label>
                                <input 
                                    type="date"
                                    required
                                    className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                    value={editEventData.date}
                                    onChange={e => setEditEventData({...editEventData, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Budget (Optional)</label>
                                <input 
                                    type="number"
                                    className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                    placeholder="0"
                                    value={editEventData.budget}
                                    onChange={e => setEditEventData({...editEventData, budget: e.target.value})}
                                />
                            </div>
                            <button type="submit" className="w-full py-3.5 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-xl font-bold shadow-md-elevation-1 mt-2">
                                Update Event
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // 2. LIST VIEW (Mobile Optimized)
  return (
    <div className="pb-24 animate-fade-in">
        <div className="flex justify-between items-center mb-6 px-1">
            <div>
                <h1 className="text-3xl font-medium tracking-tight text-md-sys-color-on-surface">Events</h1>
                <p className="text-sm text-md-sys-color-on-surface-variant">Manage special collections</p>
            </div>
            <button 
                onClick={() => setIsNewEventModalOpen(true)}
                className="bg-md-sys-color-primary text-md-sys-color-on-primary w-12 h-12 rounded-full shadow-md-elevation-2 hover:shadow-md-elevation-3 transition-all active:scale-95 flex items-center justify-center"
            >
                <Plus size={24} />
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {eventsList.map(evt => {
                const percentUsed = evt.budget && evt.budget > 0 ? Math.min((evt.expense / evt.budget) * 100, 100) : 0;
                
                return (
                    <div 
                        key={evt.id} 
                        onClick={() => setSelectedEventId(evt.id)}
                        className={`group bg-white rounded-2xl p-5 border border-md-sys-color-outline/10 shadow-sm hover:shadow-md-elevation-2 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between h-full min-h-[180px] ${evt.status === 'completed' ? 'opacity-75 grayscale-[0.3]' : ''}`}
                    >
                        {/* Status Bar on Left */}
                        <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${evt.status === 'completed' ? 'bg-md-sys-color-outline/20' : 'bg-md-sys-color-primary'}`}></div>

                        <div>
                            {/* Header: Date & Status */}
                            <div className="flex justify-between items-start mb-3 pl-3">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-md-sys-color-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        {format(new Date(evt.date), 'MMM d, yyyy')}
                                    </span>
                                </div>
                                
                                {evt.status === 'completed' && (
                                     <span className="text-[10px] font-bold uppercase bg-md-sys-color-surface-variant text-md-sys-color-on-surface-variant px-2 py-0.5 rounded-md">
                                        Closed
                                     </span>
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-md-sys-color-on-surface mb-2 pl-3 leading-tight group-hover:text-md-sys-color-primary transition-colors">
                                {evt.name}
                            </h3>

                            {/* Budget Progress (if budget set) */}
                            {evt.budget > 0 && (
                                <div className="pl-3 mb-4">
                                    <div className="flex justify-between text-[10px] font-medium text-md-sys-color-on-surface-variant mb-1">
                                        <span>Budget: {state.currency}{evt.budget}</span>
                                        <span>{Math.round(percentUsed)}% Used</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-md-sys-color-surface-container-high rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${percentUsed > 90 ? 'bg-md-sys-color-error' : 'bg-md-sys-color-primary'}`} 
                                            style={{ width: `${percentUsed}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer: Financial Stats */}
                        <div className="mt-4 pl-3 pt-4 border-t border-md-sys-color-outline/5 grid grid-cols-3 gap-2">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-md-sys-color-on-surface-variant/60 uppercase">Income</span>
                                <span className="text-sm font-bold text-emerald-600 flex items-center gap-0.5">
                                   <TrendingUp size={12} /> {state.currency}{evt.income}
                                </span>
                             </div>
                             <div className="flex flex-col border-l border-md-sys-color-outline/10 pl-3">
                                <span className="text-[10px] font-bold text-md-sys-color-on-surface-variant/60 uppercase">Spent</span>
                                <span className="text-sm font-bold text-rose-500 flex items-center gap-0.5">
                                   <TrendingDown size={12} /> {state.currency}{evt.expense}
                                </span>
                             </div>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-md-sys-color-on-surface-variant/60 uppercase">Net</span>
                                <span className={`text-base font-black ${evt.balance >= 0 ? 'text-md-sys-color-primary' : 'text-md-sys-color-error'}`}>
                                   {evt.balance > 0 ? '+' : ''}{evt.balance}
                                </span>
                             </div>
                        </div>
                        
                        {/* Hover decorative icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none">
                             <PartyPopper size={80} />
                        </div>
                    </div>
                );
            })}
        </div>

        {eventsList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-60">
                <div className="w-16 h-16 bg-md-sys-color-surface-container-high rounded-full flex items-center justify-center mb-4">
                    <PartyPopper size={32} className="text-md-sys-color-on-surface-variant" />
                </div>
                <h3 className="text-lg font-medium text-md-sys-color-on-surface">No Events Yet</h3>
                <p className="text-sm text-md-sys-color-on-surface-variant text-center max-w-[250px]">
                    Create an event to track separate collections.
                </p>
                <button 
                    onClick={() => setIsNewEventModalOpen(true)}
                    className="mt-4 text-md-sys-color-primary font-bold text-sm"
                >
                    Create First Event
                </button>
            </div>
        )}

        {/* New Event Modal */}
        {isNewEventModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-md-sys-color-surface w-full max-w-[360px] rounded-2xl p-6 shadow-xl animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Create Event</h3>
                        <button onClick={() => setIsNewEventModalOpen(false)} className="p-1 rounded-full hover:bg-md-sys-color-surface-container-high"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleCreateEvent} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Event Name</label>
                            <input 
                                autoFocus
                                required
                                className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                placeholder="e.g. GK Competition"
                                value={newEvent.name}
                                onChange={e => setNewEvent({...newEvent, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Date</label>
                            <input 
                                type="date"
                                required
                                className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                value={newEvent.date}
                                onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-md-sys-color-on-surface-variant block mb-1.5 uppercase">Budget (Optional)</label>
                            <input 
                                type="number"
                                className="w-full bg-md-sys-color-surface-container-low p-3.5 rounded-xl outline-none border border-md-sys-color-outline/10 focus:border-md-sys-color-primary font-medium"
                                placeholder="0"
                                value={newEvent.budget}
                                onChange={e => setNewEvent({...newEvent, budget: e.target.value})}
                            />
                        </div>
                        <button type="submit" className="w-full py-3.5 bg-md-sys-color-primary text-md-sys-color-on-primary rounded-xl font-bold shadow-md-elevation-1 mt-2">
                            Create Event
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};