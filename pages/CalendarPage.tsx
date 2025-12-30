
import React, { useState, useMemo } from 'react';
import { AppData, TransactionType, Transaction } from '../types';
import Modal from '../components/Modal';

const CalendarPage: React.FC<{ data: AppData }> = ({ data }) => {
  const [curr, setCurr] = useState(new Date());
  const [selectedDayData, setSelectedDayData] = useState<{ day: number, dateStr: string, items: Transaction[], eodBalance: number } | null>(null);

  const daysInMonth = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
  const startDay = new Date(curr.getFullYear(), curr.getMonth(), 1).getDay();

  // Function to calculate balance for a specific date
  const getBalanceOnDate = (dateStr: string) => {
    const openingTotal = data.accounts.reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    const totalChange = data.transactions
      .filter(t => t.date <= dateStr)
      .reduce((sum, t) => t.type === TransactionType.INCOME ? sum + t.amount : sum - t.amount, 0);
    return openingTotal + totalChange;
  };

  const getDayMetrics = (day: number) => {
    const dStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const items = data.transactions.filter(t => t.date === dStr);
    const inc = items.filter(i => i.type === TransactionType.INCOME).reduce((s, i) => s + i.amount, 0);
    const exp = items.filter(i => i.type === TransactionType.EXPENSE).reduce((s, i) => s + i.amount, 0);
    const eodBalance = getBalanceOnDate(dStr);
    return { inc, exp, items, dStr, eodBalance };
  };

  const handleDayClick = (day: number) => {
    const metrics = getDayMetrics(day);
    setSelectedDayData({
      day,
      dateStr: metrics.dStr,
      items: metrics.items,
      eodBalance: metrics.eodBalance
    });
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Accounting Calendar</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Interactive Financial Timeline</p>
        </div>
        <div className="flex items-center gap-6 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100">
           <button onClick={() => setCurr(new Date(curr.setMonth(curr.getMonth() - 1)))} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
             <i className="fas fa-chevron-left"></i>
           </button>
           <span className="text-sm font-black text-slate-900 uppercase tracking-widest min-w-[160px] text-center">
             {curr.toLocaleString('default', { month: 'long', year: 'numeric' })}
           </span>
           <button onClick={() => setCurr(new Date(curr.setMonth(curr.getMonth() + 1)))} className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
             <i className="fas fa-chevron-right"></i>
           </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4">{d}</div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="opacity-0 cursor-default" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const { inc, exp, eodBalance } = getDayMetrics(day);
          const isToday = new Date().toDateString() === new Date(curr.getFullYear(), curr.getMonth(), day).toDateString();
          
          return (
            <div 
              key={day} 
              onClick={() => handleDayClick(day)}
              className={`group bg-white min-h-[140px] p-4 rounded-[2rem] border transition-all cursor-pointer flex flex-col justify-between hover:shadow-xl hover:scale-[1.02] hover:border-indigo-400 ${isToday ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-lg shadow-indigo-100' : 'border-slate-100 shadow-sm'}`}
            >
              <div className="flex justify-between items-start">
                <span className={`w-8 h-8 flex items-center justify-center text-sm font-black rounded-xl ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-900'}`}>{day}</span>
                {inc > 0 && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
              </div>
              
              <div className="space-y-1">
                <div className="flex flex-col gap-0.5">
                   {inc > 0 && <p className="text-[9px] font-black text-emerald-500">+{inc.toLocaleString()}</p>}
                   {exp > 0 && <p className="text-[9px] font-black text-rose-500">-{exp.toLocaleString()}</p>}
                </div>
                <div className="pt-2 border-t border-slate-50 mt-2">
                   <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">EOD Balance</p>
                   <p className="text-[11px] font-black text-slate-800 tracking-tight">₹{eodBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal 
        title={`Audit: ${selectedDayData?.dateStr}`} 
        isOpen={!!selectedDayData} 
        onClose={() => setSelectedDayData(null)}
      >
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inflow/Outflow</p>
                <div className="flex gap-4">
                  <span className="text-emerald-500 font-black text-lg">
                    +₹{selectedDayData?.items.filter(i => i.type === TransactionType.INCOME).reduce((s, i) => s + i.amount, 0).toLocaleString()}
                  </span>
                  <span className="text-rose-500 font-black text-lg">
                    -₹{selectedDayData?.items.filter(i => i.type === TransactionType.EXPENSE).reduce((s, i) => s + i.amount, 0).toLocaleString()}
                  </span>
                </div>
             </div>
             <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-100">
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Closing Balance</p>
                <p className="text-2xl font-black text-white">₹{selectedDayData?.eodBalance.toLocaleString()}</p>
             </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Daily Records</h3>
            {selectedDayData?.items.map(t => (
              <div key={t.id} className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 transition-colors">
                <div>
                  <p className="text-sm font-black text-slate-800">{t.description}</p>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'}₹{t.amount.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-slate-300 uppercase">{data.accounts.find(a => a.id === t.account)?.name}</p>
                </div>
              </div>
            ))}
            {selectedDayData?.items.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                <i className="fas fa-file-invoice text-3xl text-slate-100 mb-4"></i>
                <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No entries for this date</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CalendarPage;
