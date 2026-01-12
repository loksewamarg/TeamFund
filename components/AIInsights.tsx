import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { generateTeamInsights, suggestBudgeting } from '../services/geminiService';
import { Bot, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIInsightsProps {
  state: AppState;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ state }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [budgetIdeas, setBudgetIdeas] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-generate on first mount if not present
  useEffect(() => {
    if (!insight) handleGenerateReport();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setInsight(null);
    const result = await generateTeamInsights(
      state.members,
      state.contributions,
      state.monthlyTarget,
      state.currency
    );
    setInsight(result);
    setLoading(false);
  };

  const handleSuggestBudget = async () => {
      setLoadingBudget(true);
      const totalFunds = state.contributions.reduce((acc, curr) => acc + curr.amount, 0);
      const result = await suggestBudgeting(totalFunds, state.currency);
      setBudgetIdeas(result);
      setLoadingBudget(false);
  }

  const copyToClipboard = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-20 md:pb-0 max-w-3xl mx-auto">
       <header className="flex items-center gap-3 mb-8">
         <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white" size={24} />
         </div>
         <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Financial Assistant</h1>
            <p className="text-slate-500 text-sm">Powered by Gemini</p>
         </div>
       </header>

       {/* Main Report Card */}
       <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-semibold text-slate-800 flex items-center gap-2">
               <Bot size={18} className="text-indigo-600"/> 
               Monthly Analysis
             </h3>
             <button 
               onClick={handleGenerateReport}
               disabled={loading}
               className="text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
             >
               <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
               {loading ? 'Analyzing...' : 'Refresh'}
             </button>
          </div>
          
          <div className="p-6 min-h-[200px]">
             {loading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                   <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                   <p className="text-slate-500 text-sm animate-pulse">Crunching numbers & crafting messages...</p>
                </div>
             ) : (
                <div className="prose prose-sm max-w-none text-slate-600">
                   {/* We render markdown directly, ensuring safe styling */}
                   <div className="whitespace-pre-wrap">
                      {insight ? (
                          <div dangerouslySetInnerHTML={{ 
                              // Use text-slate-900 for bold headers for better contrast
                              __html: insight
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>')
                                .replace(/\n/g, '<br/>')
                                .replace(/- /g, '• ') 
                          }} />
                      ) : (
                          <p>Click Refresh to generate a report.</p>
                      )}
                   </div>
                </div>
             )}
          </div>

          {!loading && insight && (
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Report'}
                </button>
             </div>
          )}
       </div>

       {/* Budget Suggestions */}
       <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="text-emerald-400">$</span> Spending Ideas
            </h3>
            {budgetIdeas ? (
                <div className="text-slate-300 text-sm space-y-2">
                    {budgetIdeas.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
            ) : (
                <p className="text-slate-400 text-sm">Want to know how to spend the collected funds?</p>
            )}
            
            <button 
                onClick={handleSuggestBudget}
                disabled={loadingBudget}
                className="mt-4 w-full py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
                {loadingBudget ? 'Thinking...' : 'Get Fun Suggestions'}
            </button>
       </div>
    </div>
  );
};