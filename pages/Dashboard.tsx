
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AppData, TransactionType } from '../types';

const Dashboard: React.FC<{ data: AppData; onNavigate: (p: string) => void }> = ({ data, onNavigate }) => {
  const stats = useMemo(() => {
    const income = data.transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = data.transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const sales = data.transactions.filter(t => t.type === TransactionType.SALE).reduce((s, t) => s + t.amount, 0);
    const purchases = data.transactions.filter(t => t.type === TransactionType.PURCHASE).reduce((s, t) => s + t.amount, 0);
    
    const stockValue = data.inventory.reduce((s, item) => s + (item.stock * item.purchasePrice), 0);
    const receivable = data.parties.reduce((s, p) => s + (p.currentBalance > 0 ? p.currentBalance : 0), 0);
    const payable = data.parties.reduce((s, p) => s + (p.currentBalance < 0 ? Math.abs(p.currentBalance) : 0), 0);

    return { income, expense, sales, purchases, stockValue, receivable, payable, net: income + sales - expense - purchases };
  }, [data.transactions, data.inventory, data.parties]);

  return (
    <div className="space-y-10 animate-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Executive Summary</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Real-time Accounting Perspective</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => onNavigate('inventory')} className="px-6 py-4 bg-white border border-slate-100 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
             <i className="fas fa-boxes-stacked"></i> Stock Valuation: ₹{stats.stockValue.toLocaleString()}
          </button>
          <button onClick={() => onNavigate('ledger')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-plus"></i> New Transaction
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Worth</p>
          <p className="text-3xl font-black text-slate-900">₹{stats.net.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sales Turnover</p>
          <p className="text-3xl font-black text-emerald-600">₹{stats.sales.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-rose-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Purchases</p>
          <p className="text-3xl font-black text-rose-500">₹{stats.purchases.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-amber-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Inventory Assets</p>
          <p className="text-3xl font-black text-amber-500">₹{stats.stockValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
               <i className="fas fa-address-book text-indigo-500"></i> Party Balance Summary
            </h3>
            <div className="space-y-6">
               <div className="flex justify-between items-center p-6 bg-emerald-50 rounded-[2rem]">
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Receivables</p>
                    <p className="text-2xl font-black text-emerald-700">₹{stats.receivable.toLocaleString()}</p>
                  </div>
                  <i className="fas fa-arrow-down-long text-3xl text-emerald-200"></i>
               </div>
               <div className="flex justify-between items-center p-6 bg-rose-50 rounded-[2rem]">
                  <div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Total Payables</p>
                    <p className="text-2xl font-black text-rose-700">₹{stats.payable.toLocaleString()}</p>
                  </div>
                  <i className="fas fa-arrow-up-long text-3xl text-rose-200"></i>
               </div>
            </div>
         </div>

         <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
               <i className="fas fa-clock-rotate-left text-indigo-500"></i> Critical Stock Status
            </h3>
            <div className="space-y-4">
               {data.inventory.filter(i => i.stock <= i.minStock).slice(0, 5).map(item => (
                 <div key={item.id} className="flex justify-between items-center p-4 border border-rose-100 bg-rose-50/30 rounded-2xl">
                    <div>
                       <p className="font-bold text-slate-800">{item.name}</p>
                       <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Low Stock Alert</p>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-rose-600">{item.stock} {item.unit}</p>
                       <p className="text-[9px] font-bold text-slate-300 uppercase">Min: {item.minStock}</p>
                    </div>
                 </div>
               ))}
               {data.inventory.filter(i => i.stock <= i.minStock).length === 0 && (
                 <div className="py-12 text-center text-slate-200 uppercase font-black tracking-widest text-[10px]">All inventory levels healthy</div>
               )}
            </div>
         </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <h3 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-3">
          <i className="fas fa-list-ul text-indigo-500"></i> Recent Journal Entries
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Context</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.transactions.slice(0, 10).map(t => (
                <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 text-xs font-bold text-slate-400">{t.date}</td>
                  <td className="py-6">
                    <p className="text-sm font-black text-slate-800">{t.description}</p>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</p>
                  </td>
                  <td className={`py-6 text-right font-black ${[TransactionType.INCOME, TransactionType.SALE].includes(t.type) ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {[TransactionType.INCOME, TransactionType.SALE].includes(t.type) ? '+' : '-'} ₹{t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.transactions.length === 0 && (
                <tr><td colSpan={3} className="py-20 text-center text-slate-300 uppercase font-black tracking-widest text-xs">Waiting for first commercial entry</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
