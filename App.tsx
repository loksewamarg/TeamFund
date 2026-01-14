import React, { useState, useEffect, Suspense, lazy } from 'react';
import { LayoutDashboard, Users, History as HistoryIcon, Settings as SettingsIcon, CalendarCheck, PieChart, Loader2 } from 'lucide-react';
import { AppState, ViewState, Contribution, Member } from './types';
import { subscribeToAppState, dbActions } from './services/storageService';

// Lazy load components to optimize initial load
// Handles named exports by mapping the module
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Members = lazy(() => import('./components/Members').then(module => ({ default: module.Members })));
const Tracker = lazy(() => import('./components/Tracker').then(module => ({ default: module.Tracker })));
const History = lazy(() => import('./components/History').then(module => ({ default: module.History })));
const Report = lazy(() => import('./components/Report').then(module => ({ default: module.Report })));
const Settings = lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));

// NavItem extracted to prevent re-creation on every render
const NavItem = ({ 
  view, 
  icon: Icon, 
  label, 
  mobile = false, 
  isActive, 
  onClick 
}: { 
  view: ViewState, 
  icon: any, 
  label: string, 
  mobile?: boolean, 
  isActive: boolean, 
  onClick: (view: ViewState) => void 
}) => {
  // Desktop Style
  if (!mobile) {
    return (
      <button
        onClick={() => onClick(view)}
        className={`flex items-center gap-3 px-6 py-4 rounded-full w-full transition-colors ${
          isActive 
            ? 'bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container font-bold' 
            : 'text-md-sys-color-on-surface-variant hover:bg-md-sys-color-surface-container-high'
        }`}
      >
        <Icon size={24} className={isActive ? 'fill-current' : ''} />
        <span className="text-sm tracking-medium">{label}</span>
      </button>
    );
  }

  // Mobile Bottom Bar Style
  return (
    <button
      onClick={() => onClick(view)}
      className="flex flex-col items-center justify-center w-full py-2 gap-1 group"
    >
      <div className={`px-5 py-1 rounded-full transition-all ${
          isActive 
          ? 'bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container' 
          : 'text-md-sys-color-on-surface-variant group-hover:bg-md-sys-color-surface-container-high'
      }`}>
          <Icon size={24} className={isActive ? 'fill-current' : ''} />
      </div>
      <span className={`text-xs font-medium tracking-wide ${isActive ? 'text-md-sys-color-on-surface' : 'text-md-sys-color-on-surface-variant'}`}>
        {label}
      </span>
    </button>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [globalDate, setGlobalDate] = useState(new Date());

  // Subscribe to Realtime Database on mount
  useEffect(() => {
    const unsubscribe = subscribeToAppState((newData) => {
      setState(newData);
    });
    return () => unsubscribe();
  }, []);

  const addContribution = (contribution: Contribution) => {
    if (!state) return;
    dbActions.addContribution(state.contributions, contribution);
  };

  const addMember = (member: Member) => {
    if (!state) return;
    dbActions.addMember(state.members, member);
  };

  const updateMember = (updatedMember: Member) => {
    if (!state) return;
    dbActions.updateMember(state.members, updatedMember);
  };

  const removeMember = (id: string) => {
    if (!state) return;
    dbActions.removeMember(state.members, state.contributions, id);
  };

  const updateSettings = (updates: Partial<AppState>) => {
    if (!state) return;
    if (updates.monthlyTarget !== undefined && updates.currency !== undefined) {
        dbActions.updateSettings({
            monthlyTarget: updates.monthlyTarget,
            currency: updates.currency
        });
    }
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initial Loading Screen
  if (!state) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-md-sys-color-background text-md-sys-color-primary">
            <Loader2 size={48} className="animate-spin mb-4" />
            <p className="font-medium text-md-sys-color-on-surface">Connecting to TeamFund Database...</p>
        </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard 
          state={state} 
          onNavigate={handleNavigate} 
          currentDate={globalDate}
          onDateChange={setGlobalDate}
          onAddContribution={addContribution}
        />;
      case 'tracker':
        return <Tracker 
          state={state} 
          onAddContribution={addContribution} 
          currentDate={globalDate}
          onDateChange={setGlobalDate}
        />;
      case 'members':
        return <Members 
          state={state} 
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onRemoveMember={removeMember}
        />;
      case 'history':
        return <History state={state} />;
      case 'report':
        return <Report state={state} />;
      case 'settings':
        return <Settings state={state} onUpdateSettings={updateSettings} />;
      default:
        return <Dashboard 
          state={state} 
          onNavigate={handleNavigate}
          currentDate={globalDate}
          onDateChange={setGlobalDate}
          onAddContribution={addContribution}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-md-sys-color-background text-md-sys-color-on-background flex flex-col md:flex-row font-sans">
      
      {/* --- DESKTOP NAVIGATION DRAWER --- */}
      <aside className="hidden md:flex flex-col w-80 p-4 fixed h-full z-20 bg-md-sys-color-surface-container-low border-r border-md-sys-color-outline/10">
        <div className="px-6 py-8 mb-4">
           <div className="flex items-center gap-3 text-md-sys-color-primary">
              <div className="w-10 h-10 rounded-xl bg-md-sys-color-primary-container text-md-sys-color-on-primary-container flex items-center justify-center text-xl font-bold">
                {state.currency}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-md-sys-color-on-surface">TeamFund</h1>
           </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" isActive={currentView === 'dashboard'} onClick={handleNavigate} />
          <NavItem view="tracker" icon={CalendarCheck} label="Tracker" isActive={currentView === 'tracker'} onClick={handleNavigate} />
          <NavItem view="members" icon={Users} label="Members" isActive={currentView === 'members'} onClick={handleNavigate} />
          <NavItem view="report" icon={PieChart} label="Reports" isActive={currentView === 'report'} onClick={handleNavigate} />
          <NavItem view="history" icon={HistoryIcon} label="History" isActive={currentView === 'history'} onClick={handleNavigate} />
          <NavItem view="settings" icon={SettingsIcon} label="Settings" isActive={currentView === 'settings'} onClick={handleNavigate} />
        </nav>

        <div className="mt-auto px-6 py-6">
           <div className="flex items-center gap-4 p-4 rounded-2xl bg-md-sys-color-surface-variant/50">
               <div className="w-10 h-10 rounded-full bg-md-sys-color-primary text-md-sys-color-on-primary flex items-center justify-center font-bold">A</div>
               <div>
                  <p className="text-sm font-bold text-md-sys-color-on-surface">Admin</p>
                  <p className="text-xs text-md-sys-color-on-surface-variant">Team Lead</p>
               </div>
           </div>
        </div>
      </aside>

      {/* --- MOBILE TOP BAR --- */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-md-sys-color-surface sticky top-0 z-30 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-md-sys-color-primary-container text-md-sys-color-on-primary-container flex items-center justify-center font-bold text-sm">
               {state.currency}
            </div>
            <span className="text-lg font-medium text-md-sys-color-on-surface">TeamFund</span>
         </div>
         <div className="w-8 h-8 rounded-full bg-md-sys-color-surface-variant flex items-center justify-center text-md-sys-color-on-surface-variant font-bold text-xs">A</div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 md:ml-80 p-4 pb-24 md:p-8 max-w-7xl mx-auto w-full">
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[50vh] text-md-sys-color-primary">
                <Loader2 size={32} className="animate-spin mb-2" />
                <p className="text-sm font-medium opacity-80">Loading View...</p>
            </div>
        }>
            {renderView()}
        </Suspense>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-md-sys-color-surface-container shadow-[0_-2px_10px_rgba(0,0,0,0.05)] h-20 flex items-center z-40 px-2 justify-around">
        <NavItem view="dashboard" icon={LayoutDashboard} label="Home" mobile isActive={currentView === 'dashboard'} onClick={handleNavigate} />
        <NavItem view="tracker" icon={CalendarCheck} label="Track" mobile isActive={currentView === 'tracker'} onClick={handleNavigate} />
        <NavItem view="members" icon={Users} label="Team" mobile isActive={currentView === 'members'} onClick={handleNavigate} />
        <NavItem view="report" icon={PieChart} label="Report" mobile isActive={currentView === 'report'} onClick={handleNavigate} />
        <NavItem view="settings" icon={SettingsIcon} label="Config" mobile isActive={currentView === 'settings'} onClick={handleNavigate} />
      </div>

    </div>
  );
};

export default App;