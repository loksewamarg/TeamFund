import React, { useMemo, useState } from 'react';
import { AppState } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend, Line, ComposedChart 
} from 'recharts';
import { 
  TrendingUp, Users, Download, Award, Target, Wallet, 
  ArrowUpRight, ArrowDownRight, Briefcase, Calendar, Table as TableIcon
} from 'lucide-react';
import { exportDataToCSV } from '../services/storageService';
import { format, subMonths, isSameMonth, parseISO } from 'date-fns';

interface ReportProps {
  state: AppState;
}

export const Report: React.FC<ReportProps> = ({ state }) => {
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

  // --- 3. Contribution by Member Data (Top 5 + Others) ---
  const memberContributionData = useMemo(() => {
    const map = new Map<string, number>();
    state.contributions.forEach(c => {
        const memberName = state.members.find(m => m.id === c.memberId)?.name || 'Unknown';
        map.set(memberName, (map.get(memberName) || 0) + c.amount);
    });
    
    let data = Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Limit to Top 5 and aggregate others
    if (data.length > 5) {
        const top5 = data.slice(0, 5);
        const othersValue = data.slice(5).reduce((sum, item) => sum + item.value, 0);
        if (othersValue > 0) {
            top5.push({ name: 'Others', value: othersValue });
        }
        data = top5;
    }
    
    return data;
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

  // Colors for charts
  const COLORS = ['#006c4c', '#4d6357', '#3d6373', '#89f8c6', '#d0e8d9', '#707973'];

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
            <div className="flex items-center justify-between sm:block sm:text-right bg-white/50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none border-md-sys-color-outline/10">
                <span className="text-xs font-bold text-md-sys-color-primary uppercase tracking-wider block">Current Fund</span>
                <span className="text-xl md:text-2xl font-bold text-md-sys-color-on-surface block">{state.currency}{kpis.totalCollected.toLocaleString()}</span>
            </div>

            <div className="hidden sm:block h-10 w-px bg-md-sys-color-outline/20"></div>

            <button 
                onClick={() => exportDataToCSV(state)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-md-sys-color-primary text-md-sys-color-on-primary px-5 py-3 rounded-full font-medium shadow-md-elevation-1 hover:shadow-md-elevation-2 hover:bg-md-sys-color-primary/90 transition-all active:scale-95"
            >
                <Download size={18} />
                <span>Download CSV</span>
            </button>
        </div>
      </div>

      {/* --- KPI CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

          <div className="bg-white p-4 md:p-5 rounded-md-xl border border-md-sys-color-outline/10 shadow-sm flex flex-col justify-between">
             <div className="flex items-start justify-between mb-3">
                 <div className="p-2 bg-md-sys-color-tertiary-container rounded-lg text-md-sys-color-on-tertiary-container">
                     <Target size={20} />
                 </div>
                 <span className="text-[10px] md:text-xs text-md-sys-color-on-surface-variant bg-md-sys-color-surface-container-high px-2 py-1 rounded-full">Lifetime</span>
             </div>
             <div>
                <p className="text-xs md:text-sm text-md-sys-color-on-surface-variant">Avg. Contribution</p>
                <h3 className="text-xl md:text-2xl font-bold text-md-sys-color-on-surface mt-1">{state.currency}{kpis.avgPerMember.toLocaleString()}</h3>
             </div>
          </div>

           <div className="bg-md-sys-color-primary text-md-sys-color-on-primary p-4 md:p-5 rounded-md-xl border border-transparent shadow-md-elevation-1 flex flex-col justify-between">
             <div className="flex items-start justify-between mb-3">
                 <div className="p-2 bg-white/20 rounded-lg text-white">
                     <Award size={20} />
                 </div>
             </div>
             <div>
                <p className="text-xs md:text-sm opacity-80">Total Fund Value</p>
                <h3 className="text-xl md:text-2xl font-bold mt-1">{state.currency}{kpis.totalCollected.toLocaleString()}</h3>
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

          {/* Contributions by Member (Pie) */}
          <div className="bg-white rounded-md-xl border border-md-sys-color-outline/10 p-4 md:p-6 shadow-sm flex flex-col">
               <h3 className="text-base md:text-lg font-bold text-md-sys-color-on-surface mb-2 flex items-center gap-2">
                   <Users size={18} className="text-md-sys-color-tertiary" /> Contributions by Member
               </h3>
               <p className="text-xs text-md-sys-color-on-surface-variant mb-4">Top contributors</p>
               
               <div className="flex-1 min-h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={memberContributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {memberContributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                         <div className="text-center">
                             <p className="text-xs text-gray-500">Top Contributor</p>
                             <p className="text-sm font-bold text-md-sys-color-on-surface truncate max-w-[100px]">{memberContributionData[0]?.name}</p>
                         </div>
                    </div>
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