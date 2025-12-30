import React, { useState, useMemo } from 'react';
import { AppData, Transaction, TransactionType } from '../types';
import Modal from '../components/Modal';

const LedgerPage: React.FC<{ data: AppData; onSave: (d: AppData) => void; showToast: (m: string) => void }> = ({ data, onSave, showToast }) => {
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null);

  const filtered = useMemo(() => {
    return (data.transactions || [])
      .filter(t => (filter === 'all' || t.type === filter))
      .filter(t => {
        const term = search.toLowerCase();
        const party = data.parties?.find(p => p.id === t.partyId)?.name.toLowerCase() || '';
        const account = data.accounts.find(a => a.id === t.account)?.name.toLowerCase() || '';
        
        const matchesSearch = t.description.toLowerCase().includes(term) || 
                             t.category.toLowerCase().includes(term) ||
                             (t.notes && t.notes.toLowerCase().includes(term)) ||
                             party.includes(term) ||
                             account.includes(term);
                             
        const matchesStart = startDate ? t.date >= startDate : true;
        const matchesEnd = endDate ? t.date <= endDate : true;
        return matchesSearch && matchesStart && matchesEnd;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter, search, startDate, endDate, data.parties, data.accounts]);

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
    setStartDate('');
    setEndDate('');
  };

  const deleteTransaction = (id: string) => {
    if (!confirm('Reversing this transaction will restore previous balances. Proceed?')) return;
    const trans = data.transactions.find(t => t.id === id);
    if (!trans) return;

    const accounts = [...data.accounts];
    const parties = [...(data.parties || [])];
    
    // Revert Account Balance
    const accIdx = accounts.findIndex(a => a.id === trans.account);
    if (accIdx >= 0) {
      if (trans.type === TransactionType.INCOME || trans.type === TransactionType.SALE) accounts[accIdx].balance -= trans.amount;
      else accounts[accIdx].balance += trans.amount;
    }

    // Revert Party Balance if applicable
    const partyIdx = parties.findIndex(p => p.id === trans.partyId);
    if (partyIdx >= 0) {
       // Logic: 
       // Sale: Receivable increases (+) -> Delete: Receivable decreases (-)
       // Purchase: Payable increases (+) -> Delete: Payable decreases (-)
       // Income (Payment In): Receivable decreases (-) -> Delete: Receivable increases (+)
       // Expense (Payment Out): Payable decreases (-) -> Delete: Payable increases (+)
       
       if (trans.type === TransactionType.SALE) parties[partyIdx].currentBalance -= trans.amount;
       else if (trans.type === TransactionType.PURCHASE) parties[partyIdx].currentBalance += trans.amount;
       else if (trans.type === TransactionType.INCOME) parties[partyIdx].currentBalance += trans.amount;
       else if (trans.type === TransactionType.EXPENSE) parties[partyIdx].currentBalance -= trans.amount;
    }

    onSave({ ...data, transactions: data.transactions.filter(t => t.id !== id), accounts, parties });
    showToast('Transaction Voided');
  };

  const handleSave = () => {
    if (!editing?.description || !editing?.amount || !editing?.date) return;
    
    const trans: Transaction = {
      id: editing.id || Date.now().toString(),
      type: editing.type!,
      date: editing.date!,
      description: editing.description!,
      category: editing.category!,
      amount: editing.amount!,
      account: editing.account!,
      partyId: editing.partyId || undefined,
      notes: editing.notes || ''
    };
    
    // Simplest way to handle logic for a prototype: Delete old and add new to handle balance updates
    // (In a production app, we'd calculate deltas)
    let tempTransactions = [...data.transactions];
    let accounts = [...data.accounts];
    let parties = [...(data.parties || [])];

    if (editing.id) {
       const old = tempTransactions.find(t => t.id === editing.id);
       if (old) {
          // Revert old
          const oldAcc = accounts.find(a => a.id === old.account);
          if (oldAcc) {
            if (old.type === TransactionType.INCOME || old.type === TransactionType.SALE) oldAcc.balance -= old.amount;
            else oldAcc.balance += old.amount;
          }
          const oldParty = parties.find(p => p.id === old.partyId);
          if (oldParty) {
            if (old.type === TransactionType.SALE) oldParty.currentBalance -= old.amount;
            else if (old.type === TransactionType.PURCHASE) oldParty.currentBalance += old.amount;
            else if (old.type === TransactionType.INCOME) oldParty.currentBalance += old.amount;
            else if (old.type === TransactionType.EXPENSE) oldParty.currentBalance -= old.amount;
          }
          tempTransactions = tempTransactions.filter(t => t.id !== editing.id);
       }
    }

    // Apply new
    const newAcc = accounts.find(a => a.id === trans.account);
    if (newAcc) {
      if (trans.type === TransactionType.INCOME || trans.type === TransactionType.SALE) newAcc.balance += trans.amount;
      else newAcc.balance -= trans.amount;
    }
    const newParty = parties.find(p => p.id === trans.partyId);
    if (newParty) {
      if (trans.type === TransactionType.SALE) newParty.currentBalance += trans.amount;
      else if (trans.type === TransactionType.PURCHASE) newParty.currentBalance -= trans.amount;
      else if (trans.type === TransactionType.INCOME) newParty.currentBalance -= trans.amount;
      else if (trans.type === TransactionType.EXPENSE) newParty.currentBalance += trans.amount;
    }

    tempTransactions.unshift(trans);
    onSave({ ...data, transactions: tempTransactions, accounts, parties });
    setIsModalOpen(false);
    showToast('Ledger Record Synchronized');
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Category', 'Party', 'Account', 'Amount', 'Notes'];
    const rows = filtered.map(t => {
      const party = data.parties?.find(p => p.id === t.partyId)?.name || 'N/A';
      const account = data.accounts.find(a => a.id === t.account)?.name || 'N/A';
      return [
        t.date,
        t.type.toUpperCase(),
        `"${t.description.replace(/"/g, '""')}"`,
        t.category,
        `"${party}"`,
        `"${account}"`,
        t.amount,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Export Initiated');
  };

  return (
    <div className="space-y-8 animate-in pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Global Ledger</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Sovereign Financial Journal & Audit Trail</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={exportToCSV}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <i className="fas fa-file-export"></i> Export CSV
          </button>
          <button 
            onClick={() => { setEditing({ id: '', type: TransactionType.EXPENSE, date: new Date().toISOString().split('T')[0], amount: 0, description: '', category: data.categories.expense[0], account: data.accounts[0]?.id }); setIsModalOpen(true); }} 
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> New Entry
          </button>
        </div>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search descriptions, parties..." 
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="flex-1 px-4 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500"
              title="Start Date"
            />
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="flex-1 px-4 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-indigo-500"
              title="End Date"
            />
          </div>
          <div className="lg:col-span-1 flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
             {['all', ...Object.values(TransactionType)].map(t => (
                <button 
                  key={t} 
                  onClick={() => setFilter(t as any)} 
                  className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === t ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  {t}
                </button>
             ))}
          </div>
          <button 
            onClick={clearFilters}
            className="px-4 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation Context</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Party / Account</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valuation</th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => (
                <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-8 py-6 text-xs font-bold text-slate-400">{t.date}</td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-800">{t.description}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase border ${t.type === TransactionType.SALE || t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {t.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <p className="text-xs font-black text-slate-600 uppercase tracking-tight">
                        <i className="fas fa-building-columns mr-2 opacity-30"></i>
                        {data.accounts.find(a => a.id === t.account)?.name || 'N/A'}
                     </p>
                     {t.partyId && (
                       <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                          <i className="fas fa-address-book mr-2 opacity-30"></i>
                          {data.parties?.find(p => p.id === t.partyId)?.name || 'Unknown Party'}
                       </p>
                     )}
                  </td>
                  <td className={`px-8 py-6 text-right font-black ${[TransactionType.INCOME, TransactionType.SALE].includes(t.type) ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {[TransactionType.INCOME, TransactionType.SALE].includes(t.type) ? '+' : '-'} ₹{t.amount.toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(t); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                      <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-32 text-center text-slate-200 uppercase font-black tracking-widest text-[10px]">No ledger records detected for the selected criteria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title="Ledger Entry Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-100 p-1.5 rounded-2xl">
              {Object.values(TransactionType).map(t => (
                <button 
                  key={t} 
                  onClick={() => setEditing({...editing!, type: t, category: t === TransactionType.INCOME ? data.categories.income[0] : (t === TransactionType.EXPENSE ? data.categories.expense[0] : 'Commercial')})} 
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editing?.type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {t}
                </button>
              ))}
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Entry Date</label>
                <input type="date" value={editing?.date} onChange={e => setEditing({...editing!, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Total Valuation (₹)</label>
                <input type="number" placeholder="0.00" value={editing?.amount || ''} onChange={e => setEditing({...editing!, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500" />
              </div>
           </div>

           <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Description</label>
             <input placeholder="Transaction Context..." value={editing?.description} onChange={e => setEditing({...editing!, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500" />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Category / Tag</label>
                <select value={editing?.category} onChange={e => setEditing({...editing!, category: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500">
                  {editing?.type === TransactionType.INCOME ? data.categories.income.map(c => <option key={c} value={c}>{c}</option>) : 
                   editing?.type === TransactionType.EXPENSE ? data.categories.expense.map(c => <option key={c} value={c}>{c}</option>) : 
                   <option value="Commercial">Commercial Trade</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Operational Account</label>
                <select value={editing?.account} onChange={e => setEditing({...editing!, account: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500">
                  {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>)}
                </select>
              </div>
           </div>

           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Linked Party (Optional)</label>
              <select value={editing?.partyId || ''} onChange={e => setEditing({...editing!, partyId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500">
                <option value="">Independent Entry (No Party)</option>
                {data.parties?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
              </select>
           </div>

           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Internal Notes</label>
              <textarea placeholder="Audit trail details..." value={editing?.notes} onChange={e => setEditing({...editing!, notes: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0 focus:ring-2 focus:ring-indigo-500" rows={2} />
           </div>

           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-[11px] mt-4">
             Authorize Transaction Sync
           </button>
        </div>
      </Modal>
    </div>
  );
};

export default LedgerPage;