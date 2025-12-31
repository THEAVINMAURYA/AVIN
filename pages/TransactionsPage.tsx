import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Transaction, TransactionType } from '../types';
import Modal from '../components/Modal';

interface LedgerPageProps {
  data: AppData;
  onSave: (d: AppData) => void;
  showToast: (m: string) => void;
  search: string;
  setSearch: (val: string) => void;
  dateRange: { start: string, end: string };
  setDateRange: (range: { start: string, end: string }) => void;
}

const LedgerPage: React.FC<LedgerPageProps> = ({ data, onSave, showToast, search, setSearch, dateRange, setDateRange }) => {
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null);

  const filtered = useMemo(() => {
    return (data.transactions || [])
      .filter(t => (filter === 'all' || t.type === filter))
      .filter(t => {
        const term = search.toLowerCase();
        const party = data.parties?.find(p => p.id === t.partyId)?.name.toLowerCase() || '';
        const account = data.accounts.find(a => a.id === t.account)?.name.toLowerCase() || '';
        const matchesSearch = t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term) || (t.notes && t.notes.toLowerCase().includes(term)) || party.includes(term) || account.includes(term);
        const matchesStart = dateRange.start ? t.date >= dateRange.start : true;
        const matchesEnd = dateRange.end ? t.date <= dateRange.end : true;
        return matchesSearch && matchesStart && matchesEnd;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter, search, dateRange, data.parties, data.accounts]);

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
    
    let tempTransactions = [...data.transactions];
    let accounts = [...data.accounts];
    let parties = [...(data.parties || [])];

    if (editing.id) {
       const old = tempTransactions.find(t => t.id === editing.id);
       if (old) {
          const oldAcc = accounts.find(a => a.id === old.account);
          if (oldAcc) {
            if (old.type === TransactionType.INCOME || old.type === TransactionType.SALE) oldAcc.balance -= old.amount;
            else oldAcc.balance += old.amount;
          }
          tempTransactions = tempTransactions.filter(t => t.id !== editing.id);
       }
    }

    const newAcc = accounts.find(a => a.id === trans.account);
    if (newAcc) {
      if (trans.type === TransactionType.INCOME || trans.type === TransactionType.SALE) newAcc.balance += trans.amount;
      else newAcc.balance -= trans.amount;
    }

    tempTransactions.unshift(trans);
    onSave({ ...data, transactions: tempTransactions, accounts, parties });
    setIsModalOpen(false);
    showToast('Ledger Entry Synchronized');
  };

  const deleteTransaction = (id: string) => {
    if (!confirm('Perform Delta-Reversal on this record?')) return;
    const trans = data.transactions.find(t => t.id === id);
    if (!trans) return;
    const accounts = data.accounts.map(a => {
      if (a.id === trans.account) {
        const delta = (trans.type === TransactionType.INCOME || trans.type === TransactionType.SALE) ? -trans.amount : trans.amount;
        return { ...a, balance: a.balance + delta };
      }
      return a;
    });
    onSave({ ...data, transactions: data.transactions.filter(t => t.id !== id), accounts });
    showToast('Record Purged');
  };

  return (
    <div className="space-y-8 animate-in pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Authority Ledger</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Full Transaction Spectrum</p>
        </div>
        <button onClick={() => { setEditing({ id: '', type: TransactionType.EXPENSE, date: new Date().toISOString().split('T')[0], amount: 0, description: '', category: data.categories.expense[0], account: data.accounts[0]?.id }); setIsModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-2 hover:scale-105 transition-all">
          <i className="fas fa-plus"></i> Manual Authority Entry
        </button>
      </header>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm" />
          </div>
          <div className="flex gap-2">
            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="flex-1 px-4 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm" />
            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="flex-1 px-4 py-4 bg-slate-50 border-0 rounded-2xl font-bold text-sm" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto">
             {['all', ...Object.values(TransactionType)].map(t => (
                <button key={t} onClick={() => setFilter(t as any)} className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>{t}</button>
             ))}
          </div>
          <button onClick={() => { setSearch(''); setDateRange({start: '', end: ''}); setFilter('all'); }} className="px-4 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Clear Protocol</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation Context</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Impact</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(t => (
              <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-8 py-6 text-xs font-bold text-slate-400">{t.date}</td>
                <td className="px-8 py-6">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{t.description}</p>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</span>
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
          </tbody>
        </table>
      </div>

      <Modal title="Configure Authority Record" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-100 p-1.5 rounded-2xl">
              {Object.values(TransactionType).map(t => (
                <button key={t} onClick={() => setEditing({...editing!, type: t})} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${editing?.type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
              ))}
           </div>
           <input type="date" value={editing?.date} onChange={e => setEditing({...editing!, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
           <input type="number" placeholder="Valuation (₹)" value={editing?.amount || ''} onChange={e => setEditing({...editing!, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
           <input placeholder="Transaction Context..." value={editing?.description} onChange={e => setEditing({...editing!, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold" />
           <div className="grid grid-cols-2 gap-4">
              <select value={editing?.category} onChange={e => setEditing({...editing!, category: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold">
                {editing?.type === TransactionType.INCOME ? data.categories.income.map(c => <option key={c}>{c}</option>) : data.categories.expense.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={editing?.account} onChange={e => setEditing({...editing!, account: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold">
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl uppercase tracking-widest text-[11px] mt-4">Synchronize Authority Entry</button>
        </div>
      </Modal>
    </div>
  );
};

export default LedgerPage;