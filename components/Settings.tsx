import React, { useState, useRef } from 'react';
import { AppState } from '../types';
import { Save, Database, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { exportDataToCSV, dbActions } from '../services/storageService';

interface SettingsProps {
  state: AppState;
  onUpdateSettings: (settings: Partial<AppState>) => void;
}

export const Settings: React.FC<SettingsProps> = ({ state, onUpdateSettings }) => {
  const [target, setTarget] = useState(state.monthlyTarget);
  const [currency, setCurrency] = useState(state.currency);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ monthlyTarget: target, currency });
    
    const btn = document.getElementById('save-btn');
    if (btn) {
       const originalText = btn.innerHTML;
       btn.innerText = 'Saved';
       setTimeout(() => {
           btn.innerHTML = originalText;
       }, 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) {
              const result = await dbActions.importFromCSV(content);
              setImportStatus({
                  type: result.success ? 'success' : 'error',
                  message: result.message
              });
              
              // Clear input so same file can be selected again if needed
              if (fileInputRef.current) fileInputRef.current.value = '';
              
              // Clear status after 5 seconds
              setTimeout(() => setImportStatus({ type: 'idle', message: '' }), 5000);
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="max-w-xl mx-auto pb-24 md:pb-0">
      <h2 className="text-3xl font-medium text-md-sys-color-on-surface mb-8">Settings</h2>
      
      <div className="space-y-8">
        {/* General Settings */}
        <section className="bg-md-sys-color-surface-container-low rounded-md-xl p-6 border border-md-sys-color-outline/10">
                <h3 className="text-lg font-medium text-md-sys-color-on-surface mb-6">General Configuration</h3>
                <form onSubmit={handleSave} className="space-y-6">
                
                <div className="group">
                    <label className="text-sm text-md-sys-color-on-surface-variant font-medium ml-1">Currency Symbol</label>
                    <div className="bg-md-sys-color-surface-container-high mt-1 rounded-t-md px-4 py-2 border-b border-md-sys-color-outline focus-within:border-md-sys-color-primary focus-within:border-b-2 transition-all">
                        <input 
                        type="text" 
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="w-full bg-transparent outline-none text-md-sys-color-on-surface text-lg"
                        placeholder="e.g. ₹"
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="text-sm text-md-sys-color-on-surface-variant font-medium ml-1">Monthly Target</label>
                    <div className="bg-md-sys-color-surface-container-high mt-1 rounded-t-md px-4 py-2 border-b border-md-sys-color-outline focus-within:border-md-sys-color-primary focus-within:border-b-2 transition-all flex items-center">
                        <span className="text-lg text-md-sys-color-on-surface-variant mr-1">{currency}</span>
                        <input 
                        type="number" 
                        value={target}
                        onChange={e => setTarget(Number(e.target.value))}
                        className="w-full bg-transparent outline-none text-md-sys-color-on-surface text-lg"
                        />
                    </div>
                    <p className="text-xs text-md-sys-color-outline mt-1 ml-1">Expected contribution per member.</p>
                </div>
                
                <div className="pt-2 flex justify-end">
                    <button 
                        id="save-btn"
                        type="submit"
                        className="bg-md-sys-color-primary text-md-sys-color-on-primary px-6 py-2 rounded-full font-medium shadow-md-elevation-1 hover:shadow-md-elevation-2 transition-all active:scale-[0.98] flex items-center gap-2"
                    >
                        <Save size={18} /> Save Preferences
                    </button>
                </div>
                </form>
        </section>

        {/* Data Management */}
        <section className="bg-md-sys-color-surface-container-low rounded-md-xl p-6 border border-md-sys-color-outline/10">
             <h3 className="text-lg font-medium text-md-sys-color-on-surface mb-6 flex items-center gap-2">
                 <Database size={20} /> Data Management
             </h3>
             
             <div className="space-y-4">
                 {/* Export */}
                 <div className="flex items-center justify-between p-4 bg-md-sys-color-surface-container rounded-lg">
                    <div>
                        <p className="font-medium text-md-sys-color-on-surface">Export Data</p>
                        <p className="text-xs text-md-sys-color-on-surface-variant">Download all records as CSV</p>
                    </div>
                    <button 
                        onClick={() => exportDataToCSV(state)}
                        className="text-md-sys-color-primary hover:bg-md-sys-color-primary-container/20 p-2 rounded-full transition-colors"
                        title="Download CSV"
                    >
                        <Download size={24} />
                    </button>
                 </div>

                 {/* Import */}
                 <div className="flex flex-col gap-3 p-4 bg-md-sys-color-surface-container rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-md-sys-color-on-surface">Bulk Import</p>
                            <p className="text-xs text-md-sys-color-on-surface-variant">Update members & contributions via CSV</p>
                        </div>
                        <label 
                            className="cursor-pointer text-md-sys-color-primary hover:bg-md-sys-color-primary-container/20 p-2 rounded-full transition-colors"
                            title="Upload CSV"
                        >
                            <Upload size={24} />
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>
                    
                    {importStatus.type !== 'idle' && (
                        <div className={`text-xs p-3 rounded-md flex items-start gap-2 ${
                            importStatus.type === 'success' 
                                ? 'bg-md-sys-color-secondary-container text-md-sys-color-on-secondary-container' 
                                : 'bg-md-sys-color-error-container text-md-sys-color-on-error-container'
                        }`}>
                            {importStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{importStatus.message}</span>
                        </div>
                    )}
                 </div>
             </div>
        </section>
      </div>
    </div>
  );
};