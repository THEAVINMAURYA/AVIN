
import React, { useState, useMemo } from 'react';
import { AppData, Party, PartyType, TransactionType } from '../types';
import Modal from '../components/Modal';

interface PartiesPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const PartiesPage: React.FC<PartiesPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Partial<Party> | null>(null);
  const [search, setSearch] = useState('');
  const [viewingLedger, setViewingLedger] = useState<Party | null>(null);

  const filteredParties = useMemo(() => {
    return (data.parties || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [data.parties, search]);

  const openAdd = () => {
    setEditingParty({ id: Date.now().toString(), name: '', type: PartyType.CUSTOMER, phone: '', email: '', openingBalance: 0, currentBalance: 0 });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingParty?.name) return;
    const newList = [...(data.parties || [])];
    const index = newList.findIndex(p => p.id === editingParty.id);
    
    // Calculate current balance based on transactions
    const partyTrans = data.transactions.filter(t => t.partyId === editingParty.id);
    const balanceFromTransactions = partyTrans.reduce((sum, t) => {
      // Logic: Customer owes us more if Sale, less if Payment (Income)
      // Vendor: we owe them more if Purchase, less if Payment (Expense)
      if (editingParty.type === PartyType.CUSTOMER) {
        if (t.type === TransactionType.SALE) return sum + t.amount;
        if (t.type === TransactionType.INCOME) return sum - t.amount;
      } else {
        if (t.type === TransactionType.PURCHASE) return sum - t.amount;
        if (t.type === TransactionType.EXPENSE) return sum + t.amount;
      }
      return sum;
    }, editingParty.openingBalance || 0);

    const finalParty = { ...editingParty as Party, currentBalance: balanceFromTransactions };

    if (index >= 0) newList[index] = finalParty;
    else newList.push(finalParty);

    onSave({ ...data, parties: newList });
    setIsModalOpen(false);
    showToast('Party Identity Verified');
  };

  return (
    <div className="space-y-10 animate-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Party Accounts</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Vendor & Customer Hub</p>
        </div>
        <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
          <i className="fas fa-user-plus"></i> Create New Party
        </button>
      </header>

      <div className="relative">
        <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parties (Vendors/Customers)..." className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] font-bold shadow-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredParties.map(p => (
          <div key={p.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative group border-b-4 border-b-transparent hover:border-b-indigo-500">
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${p.type === PartyType.CUSTOMER ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                <i className={`fas ${p.type === PartyType.CUSTOMER ? 'fa-user-tie' : 'fa-truck'}`}></i>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setViewingLedger(p)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-list-ul"></i></button>
                 <button onClick={() => { setEditingParty(p); setIsModalOpen(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-pen"></i></button>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 truncate">{p.name}</h3>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">{p.type} | {p.phone || 'No Contact'}</p>
            
            <div className="pt-6 border-t border-slate-50">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Balance</p>
               <p className={`text-2xl font-black ${p.currentBalance > 0 ? 'text-emerald-500' : p.currentBalance < 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                 ₹{Math.abs(p.currentBalance).toLocaleString()}
                 <span className="text-[9px] ml-2 font-black uppercase tracking-widest opacity-60">
                    {p.currentBalance > 0 ? 'Receivable' : p.currentBalance < 0 ? 'Payable' : 'Settled'}
                 </span>
               </p>
            </div>
          </div>
        ))}
        {filteredParties.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem]">
             <i className="fas fa-users text-4xl text-slate-100 mb-4"></i>
             <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No parties identified</p>
          </div>
        )}
      </div>

      <Modal title="Party Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Name</label>
              <input value={editingParty?.name} onChange={e => setEditingParty({...editingParty!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Entity/Individual Name" />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relationship</label>
                <select value={editingParty?.type} onChange={e => setEditingParty({...editingParty!, type: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                   <option value={PartyType.VENDOR}>Vendor (Supplier)</option>
                   <option value={PartyType.CUSTOMER}>Customer (Buyer)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Bal (₹)</label>
                <input type="number" value={editingParty?.openingBalance || ''} onChange={e => setEditingParty({...editingParty!, openingBalance: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Initial Credential Value" />
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                <input value={editingParty?.phone} onChange={e => setEditingParty({...editingParty!, phone: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="+91 ..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                <input value={editingParty?.email} onChange={e => setEditingParty({...editingParty!, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="mail@example.com" />
              </div>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Sync Party Record</button>
        </div>
      </Modal>

      <Modal title={`Detailed Ledger: ${viewingLedger?.name}`} isOpen={!!viewingLedger} onClose={() => setViewingLedger(null)} maxWidth="max-w-4xl">
         <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-6 rounded-[2rem]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Incurred/Earned</p>
                  <p className="text-2xl font-black text-slate-900">₹{Math.abs(viewingLedger?.currentBalance || 0).toLocaleString()}</p>
               </div>
               <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-2xl font-black text-indigo-700 uppercase tracking-tight">{viewingLedger?.currentBalance! >= 0 ? 'Receivable' : 'Payable'}</p>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50">
                     <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {data.transactions.filter(t => t.partyId === viewingLedger?.id).map(t => (
                        <tr key={t.id}>
                           <td className="px-6 py-4 text-xs font-bold text-slate-400">{t.date}</td>
                           <td className="px-6 py-4">
                              <p className="text-sm font-black text-slate-800 uppercase">{t.type}</p>
                              <p className="text-[10px] font-black text-slate-400">{t.description}</p>
                           </td>
                           <td className="px-6 py-4 text-right font-black text-rose-500">
                              {[TransactionType.SALE, TransactionType.PURCHASE].includes(t.type) ? `₹${t.amount.toLocaleString()}` : '-'}
                           </td>
                           <td className="px-6 py-4 text-right font-black text-emerald-500">
                              {[TransactionType.INCOME, TransactionType.EXPENSE].includes(t.type) ? `₹${t.amount.toLocaleString()}` : '-'}
                           </td>
                        </tr>
                     ))}
                     {data.transactions.filter(t => t.partyId === viewingLedger?.id).length === 0 && (
                        <tr><td colSpan={4} className="py-20 text-center text-slate-200 uppercase font-black tracking-widest text-[10px]">No transaction history recorded</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default PartiesPage;
