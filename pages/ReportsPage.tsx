import React, { useMemo, useState } from 'react';
import { AppData, TransactionType } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];

const ReportsPage: React.FC<{ data: AppData; showToast: (m: string) => void }> = ({ data, showToast }) => {
  const [timeRange, setTimeRange] = useState<'30' | '90' | 'all'>('30');

  const filteredTransactions = useMemo(() => {
    if (timeRange === 'all') return data.transactions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(timeRange));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.transactions.filter(t => t.date >= cutoffStr);
  }, [data.transactions, timeRange]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    filteredTransactions.forEach(t => {
      const date = t.date;
      if (!map[date]) map[date] = { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) map[date].income += t.amount;
      else map[date].expense += t.amount;
    });
    return Object.entries(map).map(([date, vals]) => ({ date, ...vals })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Insights & Reports</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Advanced Analytics Engine</p>
        </div>
        <div className="flex bg-white border border-slate-100 p-1 rounded-2xl shadow-sm">
          {[
            { id: '30', label: 'Last 30D' },
            { id: '90', label: 'Last 90D' },
            { id: 'all', label: 'All Time' }
          ].map(r => (
            <button 
              key={r.id} 
              onClick={() => setTimeRange(r.id as any)}
              className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === r.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Period Inflow</p>
          <p className="text-3xl font-black text-emerald-500">₹{stats.income.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Period Outflow</p>
          <p className="text-3xl font-black text-rose-500">₹{stats.expense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Cash Flow</p>
          <p className={`text-3xl font-black ${stats.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>₹{stats.balance.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
             <i className="fas fa-chart-line text-indigo-500"></i> Cash Flow Trend
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                   contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }} 
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorInc)" strokeWidth={3} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[500px]">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
             <i className="fas fa-chart-pie text-indigo-500"></i> Expense Distribution
          </h3>
          <div className="flex-1 min-h-0 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/3 space-y-3">
               {expenseByCategory.slice(0, 5).map((cat, idx) => (
                 <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="text-[10px] font-bold text-slate-500 truncate uppercase">{cat.name}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8">Detailed Category Performance</h3>
        <div className="space-y-4">
           {expenseByCategory.map((cat, idx) => {
             const pct = (cat.value / stats.expense) * 100;
             return (
               <div key={cat.name} className="flex items-center gap-6">
                 <div className="w-32 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{cat.name}</div>
                 <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }}></div>
                 </div>
                 <div className="w-24 text-right font-black text-xs text-slate-800">₹{cat.value.toLocaleString()}</div>
               </div>
             );
           })}
           {expenseByCategory.length === 0 && (
              <div className="py-10 text-center text-slate-300 uppercase font-black tracking-widest text-[10px]">No expense data for this period</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;