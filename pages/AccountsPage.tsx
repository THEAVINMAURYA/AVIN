import React, { useState, useMemo } from 'react';
import { AppData, Account, AccountType, TransactionType, Transaction } from '../types';
import Modal from '../components/Modal';

interface AccountsPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const AccountsPage: React.FC<AccountsPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [viewingLedgerAcc, setViewingLedgerAcc] = useState<Account | null>(null);

  // Ledger Filter State
  const [ledgerStart, setLedgerStart] = useState('');
  const [ledgerEnd, setLedgerEnd] = useState('');

  // Transfer State
  const [transferData, setTransferData] = useState({
    fromId: data.accounts[0]?.id || '',
    toId: data.accounts[1]?.id || '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const openAdd = () => {
    setEditingAccount({
      id: Date.now().toString(),
      name: '',
      bankName: '',
      accountNumber: '',
      balance: 0,
      openingBalance: 0,
      type: AccountType.BANK
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingAccount?.name) return;
    const newList = [...data.accounts];
    const index = newList.findIndex(a => a.id === editingAccount.id);
    
    if (index >= 0) {
      const accTransactions = data.transactions.filter(t => t.account === editingAccount.id);
      const newBalance = (editingAccount.openingBalance || 0) + accTransactions.reduce((sum, t) => 
        (t.type === TransactionType.INCOME || t.type === TransactionType.SALE) ? sum + t.amount : sum - t.amount, 0
      );
      newList[index] = { ...editingAccount as Account, balance: newBalance };
    } else {
      newList.push({ ...editingAccount as Account, balance: editingAccount.openingBalance || 0 });
    }

    onSave({ ...data, accounts: newList });
    setIsModalOpen(false);
    showToast('Account Identity Synced');
  };

  const handleTransfer = () => {
    if (transferData.fromId === transferData.toId) return showToast('Source and destination must be different');
    if (transferData.amount <= 0) return showToast('Transfer amount must be positive');

    const fromAcc = data.accounts.find(a => a.id === transferData.fromId);
    const toAcc = data.accounts.find(a => a.id === transferData.toId);
    if (!fromAcc || !toAcc) return;

    const timestamp = Date.now();
    
    const outTrans: Transaction = {
      id: `tf-out-${timestamp}`,
      type: TransactionType.EXPENSE,
      date: transferData.date,
      description: `Internal Transfer to ${toAcc.name}`,
      category: 'Transfer',
      account: transferData.fromId,
      amount: transferData.amount,
      notes: transferData.notes
    };

    const inTrans: Transaction = {
      id: `tf-in-${timestamp}`,
      type: TransactionType.INCOME,
      date: transferData.date,
      description: `Internal Transfer from ${fromAcc.name}`,
      category: 'Transfer',
      account: transferData.toId,
      amount: transferData.amount,
      notes: transferData.notes
    };

    const newAccounts = data.accounts.map(a => {
      if (a.id === transferData.fromId) return { ...a, balance: a.balance - transferData.amount };
      if (a.id === transferData.toId) return { ...a, balance: a.balance + transferData.amount };
      return a;
    });

    onSave({
      ...data,
      accounts: newAccounts,
      transactions: [outTrans, inTrans, ...data.transactions]
    });

    setIsTransferModalOpen(false);
    showToast('Funds Migrated Successfully');
  };

  const deleteAccount = (id: string) => {
    if (data.accounts.length <= 1) return showToast('System requires at least one account');
    if (confirm('Permanently remove this account? Existing transaction history for this account will remain but lose association.')) {
      onSave({ ...data, accounts: data.accounts.filter(a => a.id !== id) });
      showToast('Account Purged');
    }
  };

  const accountLedgerData = useMemo(() => {
    if (!viewingLedgerAcc) return [];
    
    // Sort all transactions for this account by date ASC to calculate running balance correctly
    const allAccTrans = data.transactions
      .filter(t => t.account === viewingLedgerAcc.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let running = viewingLedgerAcc.openingBalance || 0;
    
    // Map with running balance first, then filter for view
    const ledgerWithBalance = allAccTrans.map(t => {
      if (t.type === TransactionType.INCOME || t.type === TransactionType.SALE) running += t.amount;
      else running -= t.amount;
      return { ...t, runningBalance: running };
    });

    // Apply filters for display
    return ledgerWithBalance.filter(t => {
      const matchStart = ledgerStart ? t.date >= ledgerStart : true;
      const matchEnd = ledgerEnd ? t.date <= ledgerEnd : true;
      return matchStart && matchEnd;
    }).reverse(); // Show latest entries at top
  }, [viewingLedgerAcc, data.transactions, ledgerStart, ledgerEnd]);

  const stats = useMemo(() => {
    const assets = data.accounts.filter(a => a.type !== AccountType.LOAN).reduce((s, a) => s + a.balance, 0);
    const liabilities = data.accounts.filter(a => a.type === AccountType.LOAN).reduce((s, a) => s + a.balance, 0);
    return { assets, liabilities, net: assets - liabilities };
  }, [data.accounts]);

  const exportAccountLedger = () => {
    if (!viewingLedgerAcc) return;
    const headers = ['Date', 'Type', 'Description', 'Category', 'Debit', 'Credit', 'Running Balance'];
    const rows = accountLedgerData.map(l => [
      l.date,
      l.type.toUpperCase(),
      `"${l.description.replace(/"/g, '""')}"`,
      l.category,
      (l.type === TransactionType.EXPENSE || l.type === TransactionType.PURCHASE) ? l.amount : '-',
      (l.type === TransactionType.INCOME || l.type === TransactionType.SALE) ? l.amount : '-',
      l.runningBalance
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ledger_${viewingLedgerAcc.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Account CSV Exported');
  };

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Capital Management</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Multi-Channel Fund Reconciliation</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => setIsTransferModalOpen(true)} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-shuffle"></i> Fund Transfer
          </button>
          <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-plus"></i> Add Account
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Assets</p>
          <p className="text-3xl font-black text-emerald-600">₹{stats.assets.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-rose-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Liabilities</p>
          <p className="text-3xl font-black text-rose-600">₹{stats.liabilities.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Worth</p>
          <p className="text-3xl font-black text-indigo-600">₹{stats.net.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {data.accounts.map((acc) => (
          <div key={acc.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-8">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${acc.type === AccountType.BANK ? 'bg-indigo-50 text-indigo-600' : acc.type === AccountType.CASH ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <i className={`fas ${acc.type === AccountType.BANK ? 'fa-building-columns' : acc.type === AccountType.CASH ? 'fa-wallet' : 'fa-hand-holding-dollar'}`}></i>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => { setLedgerStart(''); setLedgerEnd(''); setViewingLedgerAcc(acc); }} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-list-ul"></i></button>
                 <button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-pen-to-square"></i></button>
                 <button onClick={() => deleteAccount(acc.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"><i className="fas fa-trash-can"></i></button>
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 truncate">{acc.name}</h3>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">{acc.bankName || 'Generic Provider'} | {acc.accountNumber || 'N/A'}</p>

            <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
               <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Book Balance</p>
                 <p className={`text-3xl font-black ${acc.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>₹{acc.balance.toLocaleString()}</p>
               </div>
               <span className="text-[8px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 px-3 py-1 rounded-full">{acc.type}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Audit Ledger Modal */}
      <Modal title={`Account Audit: ${viewingLedgerAcc?.name}`} isOpen={!!viewingLedgerAcc} onClose={() => setViewingLedgerAcc(null)} maxWidth="max-w-5xl">
        <div className="space-y-6">
           {/* Modal Header & Filters */}
           <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-slate-50 p-6 rounded-[2rem]">
              <div className="flex gap-3 items-center">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From</label>
                    <input type="date" value={ledgerStart} onChange={e => setLedgerStart(e.target.value)} className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To</label>
                    <input type="date" value={ledgerEnd} onChange={e => setLedgerEnd(e.target.value)} className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                 </div>
                 <button onClick={() => { setLedgerStart(''); setLedgerEnd(''); }} className="mt-5 text-[9px] font-black text-slate-400 uppercase hover:text-indigo-600">Reset</button>
              </div>
              <button onClick={exportAccountLedger} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100">
                <i className="fas fa-file-export"></i> Export Ledger
              </button>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                 <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">Current Balance</p>
                 <p className="text-xl font-black">₹{viewingLedgerAcc?.balance.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-slate-100 p-6 rounded-[2rem]">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening</p>
                 <p className="text-xl font-black text-slate-700">₹{viewingLedgerAcc?.openingBalance.toLocaleString()}</p>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50">
                    <tr>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Context</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (-)</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit (+)</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Running Balance</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {accountLedgerData.map(l => (
                       <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">{l.date}</td>
                          <td className="px-6 py-4">
                             <p className="text-sm font-black text-slate-800 uppercase">{l.description}</p>
                             <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{l.category}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-rose-500">
                             {[TransactionType.EXPENSE, TransactionType.PURCHASE].includes(l.type) ? `₹${l.amount.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-emerald-500">
                             {[TransactionType.INCOME, TransactionType.SALE].includes(l.type) ? `₹${l.amount.toLocaleString()}` : '-'}
                          </td>
                          <td className={`px-6 py-4 text-right font-black text-xs ${l.runningBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                            ₹{l.runningBalance.toLocaleString()}
                          </td>
                       </tr>
                    ))}
                    {accountLedgerData.length === 0 && (
                       <tr><td colSpan={5} className="py-24 text-center text-slate-200 uppercase font-black tracking-widest text-xs">No entries found within date range</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </Modal>

      {/* Account Setup Modal */}
      <Modal title="Account Profile" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Account Display Name</label>
              <input value={editingAccount?.name} onChange={e => setEditingAccount({...editingAccount!, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="e.g. Current Business Account" />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fund Modality</label>
                <select value={editingAccount?.type} onChange={e => setEditingAccount({...editingAccount!, type: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                   <option value={AccountType.BANK}>Bank Account</option>
                   <option value={AccountType.CASH}>Cash Vault</option>
                   <option value={AccountType.LOAN}>Credit/Loan Line</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Opening Book Value (₹)</label>
                <input type="number" value={editingAccount?.openingBalance || ''} onChange={e => setEditingAccount({...editingAccount!, openingBalance: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bank / Institution</label>
                <input value={editingAccount?.bankName} onChange={e => setEditingAccount({...editingAccount!, bankName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="HDFC, SBI, PayPal..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Unique Identifier</label>
                <input value={editingAccount?.accountNumber} onChange={e => setEditingAccount({...editingAccount!, accountNumber: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Account Reference No." />
              </div>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Authorize Profile Sync</button>
        </div>
      </Modal>

      {/* Migration Modal */}
      <Modal title="Internal Capital Migration" isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)}>
         <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-center gap-4 mb-2">
               <i className="fas fa-circle-info text-2xl text-indigo-400"></i>
               <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight leading-relaxed">System will perform a simultaneous Debit and Credit operation to ensure double-entry integrity.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Source (Debit)</label>
                  <select value={transferData.fromId} onChange={e => setTransferData({...transferData, fromId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                     {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>)}
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Destination (Credit)</label>
                  <select value={transferData.toId} onChange={e => setTransferData({...transferData, toId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                     {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>)}
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valuation (₹)</label>
                  <input type="number" value={transferData.amount || ''} onChange={e => setTransferData({...transferData, amount: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="0.00" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Execution Date</label>
                  <input type="date" value={transferData.date} onChange={e => setTransferData({...transferData, date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>

            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Internal Reference</label>
               <input placeholder="Migration Purpose..." value={transferData.notes} onChange={e => setTransferData({...transferData, notes: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
            </div>

            <button onClick={handleTransfer} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Authorize Fund Migration</button>
         </div>
      </Modal>
    </div>
  );
};

export default AccountsPage;