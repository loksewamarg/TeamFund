import React, { useMemo, useState } from 'react';
import { AppState } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  CartesianGrid, AreaChart, Area, Cell, Legend, Line, ComposedChart 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Download, Award, Target, Wallet, 
  ArrowUpRight, ArrowDownRight, Briefcase, Calendar, Table as TableIcon, PartyPopper,
  CheckCircle2, Clock, FileJson
} from 'lucide-react';
import { exportDataToCSV, exportBackupJSON } from '../services/storageService';
import { format, subMonths, isSameMonth, parseISO } from 'date-fns';

interface ReportProps {
  state: AppState;
  onNavigate: (view: any, param?: string) => void;
}

export const Report: React.FC<ReportProps> = ({ state, onNavigate }) => {
  const [matrixView, setMatrixView] = useState<'6months' | 'year'>('6months');

  // --- 1. KPI Calculations ---
  const kpis = useMemo(() => {
    const totalCollected = state.contributions.reduce((sum, c) => sum + c.amount, 0);
    const activeMembers = state.members.filter(m => m.active).length;
    
    // Current Month vs Last Month
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const lastMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM');
    
    const currentMonthTotal = state.contributions
        .filter(c => c.month === currentMonthKey)
        .reduce((sum, c) => sum + c.amount, 0);
        
    const lastMonthTotal = state.contributions
        .filter(c => c.month === lastMonthKey)
        .reduce((sum, c) => sum + c.amount, 0);

    const growth = lastMonthTotal > 0 
        ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
        : currentMonthTotal > 0 ? 100 : 0;

    return {
      totalCollected,
      activeMembers,
      currentMonthTotal,
      growth,
      avgPerMember: activeMembers > 0 ? Math.round(totalCollected / activeMembers) : 0
    };
  }, [state]);

  // --- Event Statistics & Lists ---
  const { eventNet, pastEvents, upcomingEvents } = useMemo(() => {
    const transactions = state.eventTransactions || [];
    const events = state.events || [];

    // Calculate Total Net for Grand Total
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Process all transactions for net calc
    transactions.forEach(t => {
        if(t.type === 'income') totalIncome += t.amount;
        if(t.type === 'expense') totalExpense += t.amount;
    });
    const eventNet = totalIncome - totalExpense;

    // Helper to get net for specific event
    const getEventNet = (eventId: string) => {
        const evtTrans = transactions.filter(t => t.eventId === eventId);
        const inc = evtTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const exp = evtTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return inc - exp;
    };

    const past = events
        .filter(e => e.status === 'completed')
        .map(e => ({...e, net: getEventNet(e.id)}))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const upcoming = events
        .filter(e => e.status === 'upcoming')
        .map(e => ({...e, net: getEventNet(e.id)}))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { eventNet, pastEvents: past, upcomingEvents: upcoming };
  }, [state.events, state.eventTransactions]);

  const grandTotal = kpis.totalCollected + eventNet;

  // --- 2. Trend Chart Data (Last 12 Months) ---
  const trendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM');
      
      const collected = state.contributions
        .filter(c => c.month === key)
        .reduce((sum, c) => sum + c.amount, 0);
        
      const activeCount = state.members.filter(m => m.active).length; // Simplified historical approximation
      const target = activeCount * state.monthlyTarget;

      return { name: label, collected, target };
    });
  }, [state]);

  // --- 3. Contribution by Member Data (All) ---
  const memberContributionData = useMemo(() => {
    const map = new Map<string, number>();
    state.contributions.forEach(c => {
        const memberName = state.members.find(m => m.id === c.memberId)?.name || 'Unknown';
        map.set(memberName, (map.get(memberName) || 0) + c.amount);
    });
    
    return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [state]);

  // --- 4. Matrix Data (Last 6 Months) ---
  const matrixData = useMemo(() => {
    const months = Array.from({ length: matrixView === '6months' ? 6 : 12 }, (_, i) => {
        return format(subMonths(new Date(), (matrixView === '6months' ? 5 : 11) - i), 'yyyy-MM');
    });

    const rows = state.members.map(member => {
        const monthlyValues = months.map(m => {
            return state.contributions
                .filter(c => c.memberId === member.id && c.month === m)
                .reduce((sum, c) => sum + c.amount, 0);
        });
        const total = monthlyValues.reduce((a, b) => a + b, 0);
        return { member, monthlyValues, total };
    }).sort((a, b) => b.total - a.total);

    return { months, rows };
  }, [state, matrixView]);

  return (
    <div className="space-y-4 md:space-y-6 pb-24 animate-fade-in">
      
      {/* --- HEADER --- */}
      <div className="bg-md-sys-color-surface-container-low p-5 md:p-6 rounded-md-xl border border-md-sys-color-outline/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-2xl md:text-3xl font-medium text-md-sys-color-on-surface tracking-tight">Analytics Report</h1>
            <p className="text-sm text-md-sys-color-on-surface-variant mt-1">Financial performance & contribution analysis</p>
        </div>
        
        {/* Mobile-optimized action row */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            {/* Fund Display */}
            <div className="flex items-center justify-between sm:block sm:text-right bg-white/50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none border-md-sys-color-outline/10 min-w-[140px]">
                <span className="text-xs font-bold text-md-sys-color-primary uppercase tracking-wider block">Total Fund</span>
                <span className="text-xl md:text-2xl font-bold text-md-sys-color-on-surface block">{state.currency}{grandTotal.toLocaleString()}</span>
            </div>

            <div className="hidden sm:block h-10 w-px bg-md-sys-color-outline/20"></div>

            <div className="flex gap-2 w-full sm:w-auto">
                <button 
                    onClick={() => exportBackupJSON(state)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container px-4 py-3 rounded-full font-medium hover:shadow-md-elevation-1 transition-all active:scale-95"
                    title="Save full backup for restoration"
                >
                    <FileJson size={18} />
                    <span className="whitespace-nowrap">Backup Data</span>
                </button>
                <button 
                    onClick={() => exportDataToCSV(state)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-md-sys-color-primary text-md-sys-color-on-primary px-5 py-3 rounded-full font-medium shadow-md-elevation-1 hover:shadow-md-elevation-2 hover:bg-md-sys-color-primary/90 transition-all active:scale-95"
                >
                    <Download size={18} />
                    <span>Download CSV</span>
                </button>
            </div>
        </div>
      </div>

      {/* --- KPI CARDS (Reduced to 3) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Monthly Collection */}
          <div className="bg-white p-4 md:p-5 rounded-md-xl border border-md-sys-color-outline/10 shadow-sm flex flex-col justify-between">
             <div className="flex items-start justify-between mb-3">
                 <div className="p-2 bg-md-sys-color-primary-container rounded-lg text-md-sys-color-on-primary-container">
                     <Wallet size={20} />
                 </div>
                 <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${kpis.growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                     {kpis.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                     {Math.abs(Math.round(kpis.growth))}%
                 </div>
             </div>
             <div>
                <p className="text-xs md:text-sm text-md-sys-color-on-surface-variant">Monthly Collection</p>
                <h3 className="text-xl md:text-2xl font-bold text-md-sys-color-on-surface mt-1">{state.currency}{kpis.currentMonthTotal.toLocaleString()}</h3>
             </div>
          </div>

          {/* Active Members */}
          <div className="bg-white p-4 md:p-5 rounded-md-xl border border-md-sys-color-outline/10 shadow-sm flex flex-col justify-between">
             <div className="flex items-start justify-between mb-3">
                 <div className="p-2 bg-md-sys-color-secondary-container rounded-lg text-md-sys-color-on-secondary-container">
                     <Users size={20} />
                 </div>
             </div>
             <div>
                <p className="text-xs md:text-sm text-md-sys-color-on-surface-variant">Active Members</p>
                <h3 className="text-xl md:text-2xl font-bold text-md-sys-color-on-surface mt-1">{kpis.activeMembers}</h3>
             </div>
          </div>
          
          {/* Total Available Funds */}
          <div className="bg-md-sys-color-primary text-md-sys-color-on-primary p-4 md:p-5 rounded-md-xl border border-transparent shadow-md-elevation-1 flex flex-col justify-between">
             <div className="flex items-start justify-between mb-3">
                 <div className="p-2 bg-white/20 rounded-lg text-white">
                     <Award size={20} />
                 </div>
             </div>
             <div>
                <p className="text-xs md:text-sm opacity-80">Total Available Cash</p>
                <h3 className="text-xl md:text-2xl font-bold mt-1">{state.currency}{grandTotal.toLocaleString()}</h3>
             </div>
          </div>
      </div>
      
      {/* --- EVENTS SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Past Events */}
          <div className="bg-white rounded-md-xl border border-md-sys-color-outline/10 p-4 md:p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-bold text-md-sys-color-on-surface flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-md-sys-color-primary" /> Past Events
                    </h3>
                    <span className="text-xs font-medium bg-md-sys-color-surface-container-high px-2 py-0.5 rounded-full text-md-sys-color-on-surface-variant">
                        {pastEvents.length}
                    </span>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {pastEvents.length > 0 ? pastEvents.map(e => (
                        <div 
                            key={e.id} 
                            onClick={() => onNavigate('events', e.id)}
                            className="p-3 rounded-lg bg-md-sys-color-surface-container-low border border-md-sys-color-outline/5 flex justify-between items-center hover:bg-md-sys-color-surface-container-high/50 transition-colors cursor-pointer group"
                        >
                            <div>
                                <p className="font-medium text-sm text-md-sys-color-on-surface group-hover:text-md-sys-color-primary transition-colors">{e.name}</p>
                                <p className="text-xs text-md-sys-color-on-surface-variant">{format(new Date(e.date), 'MMM d, yyyy')}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${e.net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {e.net >= 0 ? '+' : ''}{state.currency}{e.net}
                            </span>
                        </div>
                    )) : <p className="text-xs text-md-sys-color-on-surface-variant italic p-2 text-center">No past events conducted.</p>}
                </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-md-xl border border-md-sys-color-outline/10 p-4 md:p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base font-bold text-md-sys-color-on-surface flex items-center gap-2">
                        <Calendar size={18} className="text-md-sys-color-tertiary" /> Future Plans
                    </h3>
                    <span className="text-xs font-medium bg-md-sys-color-surface-container-high px-2 py-0.5 rounded-full text-md-sys-color-on-surface-variant">
                        {upcomingEvents.length}
                    </span>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {upcomingEvents.length > 0 ? upcomingEvents.map(e => (
                        <div 
                            key={e.id} 
                            onClick={() => onNavigate('events', e.id)}
                            className="p-3 rounded-lg bg-md-sys-color-surface-container-low border border-md-sys-color-outline/5 flex justify-between items-center hover:bg-md-sys-color-surface-container-high/50 transition-colors cursor-pointer group"
                        >
                            <div>
                                <p className="font-medium text-sm text-md-sys-color-on-surface group-hover:text-md-sys-color-primary transition-colors">{e.name}</p>
                                <p className="text-xs text-md-sys-color-on-surface-variant flex items-center gap-1">
                                    <Clock size={10} /> {format(new Date(e.date), 'MMM d, yyyy')}
                                </p>
                            </div>
                            {e.budget && e.budget > 0 ? (
                                <span className="text-xs font-medium bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container px-2 py-1 rounded-full">
                                Budget: {state.currency}{e.budget}
                                </span>
                            ) : (
                                <span className="text-xs font-medium bg-md-sys-color-surface-variant text-md-sys-color-on-surface-variant px-2 py-1 rounded-full">
                                Planned
                                </span>
                            )}
                        </div>
                    )) : <p className="text-xs text-md-sys-color-on-surface-variant italic p-2 text-center">No upcoming events planned.</p>}
                </div>
          </div>
      </div>

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* Revenue Trend */}
          <div className="lg:col-span-2 bg-white rounded-md-xl border border-md-sys-color-outline/10 p-4 md:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                 <div>
                    <h3 className="text-base md:text-lg font-bold text-md-sys-color-on-surface flex items-center gap-2">
                        <TrendingUp size={18} className="text-md-sys-color-primary" /> Financial Trajectory
                    </h3>
                    <p className="text-xs text-md-sys-color-on-surface-variant">Revenue vs Target (Last 12 Months)</p>
                 </div>
              </div>
              <div className="h-[250px] md:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="name" 
                            stroke="#9ca3af" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tickMargin={10}
                        />
                        <YAxis 
                            stroke="#9ca3af" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                        />
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: '#191c1a', 
                                border: 'none', 
                                borderRadius: '8px', 
                                color: '#fff', 
                                fontSize: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}
                        />
                        <Bar 
                            dataKey="collected" 
                            name="Collected"
                            fill="#006c4c" 
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="target" 
                            name="Target"
                            stroke="#94a3b8" 
                            strokeWidth={2} 
                            strokeDasharray="4 4" 
                            dot={false}
                        />
                        <Legend iconType="circle" wrapperStyle={{paddingTop: '10px'}}/>
                    </ComposedChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Contributions by Member (List) */}
          <div className="bg-white rounded-md-xl border border-md-sys-color-outline/10 p-4 md:p-6 shadow-sm flex flex-col h-[400px]">
               <h3 className="text-base md:text-lg font-bold text-md-sys-color-on-surface mb-2 flex items-center gap-2">
                   <Users size={18} className="text-md-sys-color-tertiary" /> Contributions by Member
               </h3>
               <p className="text-xs text-md-sys-color-on-surface-variant mb-4">Ranked by total contribution</p>
               
               <div className="flex-1 overflow-y-auto pr-2">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-md-sys-color-on-surface-variant uppercase border-b border-md-sys-color-outline/10 sticky top-0 bg-white z-10">
                            <tr>
                                <th className="text-left py-2 font-medium bg-white">Member</th>
                                <th className="text-right py-2 font-medium bg-white">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-md-sys-color-outline/10">
                            {memberContributionData.map((item, index) => (
                                <tr key={index} className="group hover:bg-md-sys-color-surface-container-low transition-colors">
                                    <td className="py-3 text-md-sys-color-on-surface font-medium">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-md-sys-color-surface-container-high flex items-center justify-center text-[10px] text-md-sys-color-on-surface-variant font-bold shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="truncate">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 text-right font-bold text-md-sys-color-primary whitespace-nowrap">
                                        {state.currency}{item.value.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
               </div>
          </div>
      </div>

      {/* --- MONTHLY MATRIX TABLE --- */}
      <div className="bg-white rounded-md-xl border border-md-sys-color-outline/10 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-md-sys-color-outline/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base md:text-lg font-bold text-md-sys-color-on-surface flex items-center gap-2">
                    <TableIcon size={18} className="text-md-sys-color-secondary" /> Monthly Breakdown
                </h3>
                <p className="text-xs text-md-sys-color-on-surface-variant">Detailed view of contributions per member</p>
              </div>
              <div className="flex bg-md-sys-color-surface-container-high rounded-lg p-1 self-start sm:self-auto">
                  <button 
                    onClick={() => setMatrixView('6months')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${matrixView === '6months' ? 'bg-white shadow-sm text-md-sys-color-on-surface' : 'text-md-sys-color-on-surface-variant'}`}
                  >
                      Last 6 Months
                  </button>
                  <button 
                    onClick={() => setMatrixView('year')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${matrixView === 'year' ? 'bg-white shadow-sm text-md-sys-color-on-surface' : 'text-md-sys-color-on-surface-variant'}`}
                  >
                      Past Year
                  </button>
              </div>
          </div>
          
          <div className="overflow-x-auto relative">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-md-sys-color-on-surface-variant uppercase bg-md-sys-color-surface-container-low border-b border-md-sys-color-outline/10">
                      <tr>
                          <th className="px-4 md:px-6 py-3 md:py-4 font-medium sticky left-0 bg-md-sys-color-surface-container-low z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Member</th>
                          {matrixData.months.map(m => (
                              <th key={m} className="px-4 py-3 md:py-4 font-medium whitespace-nowrap text-center">
                                  {format(parseISO(m + '-01'), 'MMM yy')}
                              </th>
                          ))}
                          <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-right text-md-sys-color-on-surface whitespace-nowrap">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-md-sys-color-outline/10">
                      {matrixData.rows.map((row) => (
                          <tr key={row.member.id} className="hover:bg-md-sys-color-surface-container-low/50 transition-colors">
                              <td className="px-4 md:px-6 py-3 md:py-4 font-medium text-md-sys-color-on-surface sticky left-0 bg-white group-hover:bg-md-sys-color-surface-container-low/50 border-r border-transparent md:border-md-sys-color-outline/5 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                          row.member.active 
                                          ? 'bg-md-sys-color-primary-container text-md-sys-color-on-primary-container' 
                                          : 'bg-md-sys-color-surface-variant text-md-sys-color-on-surface-variant'
                                      }`}>
                                          {row.member.name.charAt(0)}
                                      </div>
                                      <div className="min-w-[80px] md:min-w-0">
                                          <p className="truncate max-w-[100px] md:max-w-[120px] text-sm">{row.member.name}</p>
                                          <p className="text-[10px] text-md-sys-color-on-surface-variant truncate">{row.member.job}</p>
                                      </div>
                                  </div>
                              </td>
                              {row.monthlyValues.map((val, idx) => {
                                  const isZero = val === 0;
                                  const isTargetMet = val >= state.monthlyTarget;
                                  return (
                                      <td key={idx} className="px-4 py-3 md:py-4 text-center">
                                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium min-w-[3rem] ${
                                              isZero 
                                              ? 'text-md-sys-color-outline/40' 
                                              : isTargetMet 
                                                  ? 'bg-green-100 text-green-800' 
                                                  : 'bg-yellow-100 text-yellow-800'
                                          }`}>
                                              {isZero ? '-' : val}
                                          </span>
                                      </td>
                                  );
                              })}
                              <td className="px-4 md:px-6 py-3 md:py-4 text-right font-bold text-md-sys-color-primary">
                                  {state.currency}{row.total.toLocaleString()}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};