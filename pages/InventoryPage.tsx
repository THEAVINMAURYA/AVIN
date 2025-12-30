import React, { useState, useMemo } from 'react';
import { AppData, InventoryItem, TransactionType, Transaction, PartyType } from '../types';
import Modal from '../components/Modal';

interface InventoryPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [tradeMode, setTradeMode] = useState<'purchase' | 'sale'>('sale');
  const [tradeData, setTradeData] = useState({
    itemId: '',
    qty: 0,
    price: 0,
    charges: 0,
    date: new Date().toISOString().split('T')[0],
    partyId: '',
    accountId: data.accounts[0]?.id || '',
    isCredit: false
  });

  const openAdd = () => {
    setEditingItem({ id: Date.now().toString(), name: '', unit: 'Unit', purchasePrice: 0, salePrice: 0, stock: 0, minStock: 5 });
    setIsModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!editingItem?.name) return;
    const newList = [...(data.inventory || [])];
    const index = newList.findIndex(i => i.id === editingItem.id);
    if (index >= 0) newList[index] = editingItem as InventoryItem;
    else newList.push(editingItem as InventoryItem);
    onSave({ ...data, inventory: newList });
    setIsModalOpen(false);
    showToast('Catalog Sync Successful');
  };

  const handleTrade = () => {
    const item = data.inventory.find(i => i.id === tradeData.itemId);
    if (!item || !tradeData.qty || !tradeData.price) return;
    if (tradeMode === 'sale' && item.stock < tradeData.qty) return showToast('Insufficient Inventory');

    // Net Amount: Purchase = (Val + Charges) | Sale = (Val - Charges)
    const valuation = tradeData.qty * tradeData.price;
    const totalImpact = tradeMode === 'purchase' ? valuation + tradeData.charges : valuation - tradeData.charges;
    const timestamp = Date.now();
    
    const newTrans: Transaction = {
      id: `inv-${tradeMode}-${timestamp}`,
      type: tradeMode === 'purchase' ? TransactionType.PURCHASE : TransactionType.SALE,
      date: tradeData.date,
      description: `${tradeMode.toUpperCase()}: ${item.name} (${tradeData.qty} ${item.unit})`,
      category: 'Commercial Operations',
      amount: Math.abs(totalImpact),
      notes: `${tradeData.isCredit ? 'Credit' : 'Cash'}. Price: ₹${tradeData.price}. Charges: ₹${tradeData.charges}`,
      inventoryItems: [{ itemId: item.id, qty: tradeData.qty, price: tradeData.price }],
      account: tradeData.isCredit ? undefined : tradeData.accountId,
      partyId: tradeData.partyId || undefined
    };

    const newInventory = data.inventory.map(i => {
      if (i.id === item.id) return { ...i, stock: tradeMode === 'purchase' ? i.stock + tradeData.qty : i.stock - tradeData.qty };
      return i;
    });

    let newAccounts = [...data.accounts];
    let newParties = [...data.parties];

    if (tradeData.isCredit && tradeData.partyId) {
      newParties = newParties.map(p => {
        if (p.id === tradeData.partyId) {
          const delta = tradeMode === 'sale' ? totalImpact : -totalImpact;
          return { ...p, currentBalance: p.currentBalance + delta };
        }
        return p;
      });
    } else if (!tradeData.isCredit && tradeData.accountId) {
      newAccounts = newAccounts.map(a => {
        if (a.id === tradeData.accountId) {
          const delta = tradeMode === 'purchase' ? -totalImpact : totalImpact;
          return { ...a, balance: a.balance + delta };
        }
        return a;
      });
    }

    onSave({ ...data, inventory: newInventory, accounts: newAccounts, parties: newParties, transactions: [newTrans, ...data.transactions] });
    setIsTradeModalOpen(false);
    showToast(`${tradeMode.toUpperCase()} Operation Finalized`);
  };

  return (
    <div className="space-y-10 animate-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Stock Center</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Global Inventory Protocol</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => { setTradeMode('purchase'); setIsTradeModalOpen(true); }} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-cart-shopping"></i> Purchase
          </button>
          <button onClick={() => { setTradeMode('sale'); setIsTradeModalOpen(true); }} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-file-invoice-dollar"></i> Sale
          </button>
          <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-plus"></i> Add Item
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {data.inventory.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
             <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${item.stock <= item.minStock ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
                   <i className="fas fa-boxes-stacked"></i>
                </div>
                <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-3 bg-slate-50 text-slate-300 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-pen"></i></button>
             </div>
             <h3 className="text-lg font-black text-slate-900 mb-1">{item.name}</h3>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Buy: ₹{item.purchasePrice} | Sell: ₹{item.salePrice}</p>
             <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                <div>
                   <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Stock Level</p>
                   <p className={`text-2xl font-black ${item.stock <= item.minStock ? 'text-rose-500' : 'text-slate-900'}`}>{item.stock} <span className="text-[10px]">{item.unit}</span></p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Asset Value</p>
                   <p className="text-sm font-black text-slate-400">₹{(item.stock * item.purchasePrice).toLocaleString()}</p>
                </div>
             </div>
          </div>
        ))}
      </div>

      <Modal title="Product Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
         <div className="space-y-6">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
               <input value={editingItem?.name} onChange={e => setEditingItem({...editingItem!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Product Identity" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Purchase Price (₹)</label>
                  <input type="number" value={editingItem?.purchasePrice || ''} onChange={e => setEditingItem({...editingItem!, purchasePrice: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selling Price (₹)</label>
                  <input type="number" value={editingItem?.salePrice || ''} onChange={e => setEditingItem({...editingItem!, salePrice: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UOM</label>
                  <input value={editingItem?.unit} onChange={e => setEditingItem({...editingItem!, unit: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Pcs/Kg" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Stock</label>
                  <input type="number" value={editingItem?.stock || ''} onChange={e => setEditingItem({...editingItem!, stock: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Level</label>
                  <input type="number" value={editingItem?.minStock || ''} onChange={e => setEditingItem({...editingItem!, minStock: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Authorize Asset</button>
         </div>
      </Modal>

      <Modal title={`${tradeMode.toUpperCase()} Entry`} isOpen={isTradeModalOpen} onClose={() => setIsTradeModalOpen(false)}>
         <div className="space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => setTradeData({...tradeData, isCredit: false})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!tradeData.isCredit ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Cash</button>
               <button onClick={() => setTradeData({...tradeData, isCredit: true})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.isCredit ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Credit</button>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Item</label>
               <select value={tradeData.itemId} onChange={e => setTradeData({...tradeData, itemId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                  <option value="">- Select Product -</option>
                  {data.inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
               </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                  <input type="number" value={tradeData.qty || ''} onChange={e => setTradeData({...tradeData, qty: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Price (₹)</label>
                  <input type="number" value={tradeData.price || ''} onChange={e => setTradeData({...tradeData, price: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Friction / Charges (₹)</label>
                  <input type="number" value={tradeData.charges || ''} onChange={e => setTradeData({...tradeData, charges: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Party</label>
                  <select value={tradeData.partyId} onChange={e => setTradeData({...tradeData, partyId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                     <option value="">- Select Profile -</option>
                     {data.parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
               </div>
            </div>
            {!tradeData.isCredit && (
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Settlement Account</label>
                  <select value={tradeData.accountId} onChange={e => setTradeData({...tradeData, accountId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                     {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>)}
                  </select>
               </div>
            )}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Bill Value</span>
               <span className="text-xl font-black text-indigo-600">₹{(tradeData.qty * tradeData.price + (tradeMode === 'purchase' ? tradeData.charges : -tradeData.charges)).toLocaleString()}</span>
            </div>
            <button onClick={handleTrade} className={`w-full py-5 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px] ${tradeMode === 'purchase' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>Authorize Transaction</button>
         </div>
      </Modal>
    </div>
  );
};

export default InventoryPage;