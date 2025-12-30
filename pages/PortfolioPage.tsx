
import React, { useState, useMemo } from 'react';
import { AppData, Investment, InvestmentTrade, TransactionType, Transaction } from '../types';
import Modal from '../components/Modal';

interface PortfolioPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [viewingLedger, setViewingLedger] = useState<Investment | null>(null);
  const [editingAsset, setEditingAsset] = useState<Partial<Investment> | null>(null);
  const [tradingAsset, setTradingAsset] = useState<Investment | null>(null);
  const [tradeData, setTradeData] = useState<Partial<InvestmentTrade>>({ 
    type: 'buy', 
    qty: 0, 
    price: 0, 
    charges: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const [selectedAccount, setSelectedAccount] = useState(data.accounts[0]?.id || '');

  const openAddAsset = () => {
    setEditingAsset({
      id: Date.now().toString(),
      name: '',
      assetType: 'Stock',
      qty: 0,
      avgBuyPrice: 0,
      currPrice: 0,
      history: [],
      status: 'active',
      totalRealizedPL: 0
    });
    setIsModalOpen(true);
  };

  const handleSaveAsset = () => {
    if (!editingAsset?.name) return;
    const newList = [...data.investments];
    const index = newList.findIndex(i => i.id === editingAsset.id);
    if (index >= 0) newList[index] = editingAsset as Investment;
    else newList.push(editingAsset as Investment);
    
    onSave({ ...data, investments: newList });
    setIsModalOpen(false);
    showToast('Asset Registered');
  };

  const handleTrade = () => {
    // FIX: Added !tradeData.type check to satisfy TS compiler
    if (!tradingAsset || !tradeData.qty || !tradeData.price || !selectedAccount || !tradeData.type) return;
    
    const qty = tradeData.qty;
    const price = tradeData.price;
    const charges = tradeData.charges || 0;
    const tradeType = tradeData.type; // Extract to constant for stable typing
    const asset = { ...tradingAsset };
    
    if (tradeType === 'buy') {
      const totalCost = (asset.avgBuyPrice * asset.qty) + (qty * price) + charges;
      asset.qty += qty;
      asset.avgBuyPrice = totalCost / asset.qty;
      asset.status = 'active';
    } else {
      if (qty > asset.qty) return showToast('Insufficient Quantity');
      
      const buyCostOfSoldUnits = asset.avgBuyPrice * qty;
      const sellValue = qty * price;
      const tradeRealized = sellValue - buyCostOfSoldUnits - charges;
      
      asset.totalRealizedPL += tradeRealized;
      asset.qty -= qty;
      if (asset.qty <= 0) {
        asset.qty = 0;
        asset.status = 'closed';
      }
    }

    asset.history.push({
      id: Date.now().toString(),
      date: tradeData.date || new Date().toISOString().split('T')[0],
      type: tradeType as 'buy' | 'sell',
      qty,
      price,
      charges
    });

    const transactionValue = tradeType === 'buy' ? (qty * price + charges) : (qty * price - charges);

    const newTrans: Transaction = {
      id: Date.now().toString() + '-trade',
      type: tradeType === 'buy' ? TransactionType.EXPENSE : TransactionType.INCOME,
      date: tradeData.date || new Date().toISOString().split('T')[0],
      description: `${tradeType.toUpperCase()}: ${asset.name} (${qty} units)`,
      category: 'Investment',
      account: selectedAccount,
      amount: transactionValue,
      notes: ''
    };

    const accounts = [...data.accounts];
    const accIdx = accounts.findIndex(a => a.id === selectedAccount);
    if (accIdx >= 0) {
      if (newTrans.type === TransactionType.INCOME) accounts[accIdx].balance += transactionValue;
      else accounts[accIdx].balance -= transactionValue;
    }

    const investments = data.investments.map(i => i.id === asset.id ? asset : i);
    onSave({ 
      ...data, 
      investments, 
      accounts, 
      transactions: [newTrans, ...data.transactions] 
    });

    setIsTradeOpen(false);
    showToast(`${tradeType === 'buy' ? 'Buy Executed' : 'Sell Executed'}`);
  };

  const portfolioSummary = useMemo(() => {
    return data.investments.reduce((sum, inv) => {
      if (inv.status === 'active') {
        sum.totalValue += (inv.qty * inv.currPrice);
        sum.totalCost += (inv.qty * inv.avgBuyPrice);
      }
      sum.totalRealized += inv.totalRealizedPL;
      return sum;
    }, { totalValue: 0, totalCost: 0, totalRealized: 0 });
  }, [data.investments]);

  const unrealizedPL = portfolioSummary.totalValue - portfolioSummary.totalCost;

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Portfolio Accounting</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Real-time trade ledger and asset valuation.</p>
        </div>
        <button onClick={openAddAsset} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3">
          <i className="fas fa-plus"></i> New Asset
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-b-4 border-b-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mkt Valuation</p>
          <p className="text-3xl font-black text-slate-900">₹{portfolioSummary.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-b-4 border-b-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Realized P/L</p>
          <p className="text-3xl font-black text-emerald-600">₹{portfolioSummary.totalRealized.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-b-4 border-b-amber-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unrealized P/L</p>
          <p className={`text-3xl font-black ${unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>₹{unrealizedPL.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.investments.map((inv) => (
          <div key={inv.id} className={`bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all ${inv.qty === 0 ? 'opacity-70 bg-slate-50' : ''}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                <i className={`fas ${inv.assetType === 'Stock' ? 'fa-chart-line' : inv.assetType === 'Gold' ? 'fa-coins' : inv.assetType === 'Real Estate' ? 'fa-home' : 'fa-gem'}`}></i>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setViewingLedger(inv)} className="p-2 text-indigo-600 font-bold bg-indigo-50 rounded-xl text-[10px] uppercase tracking-widest">History</button>
                 <button onClick={() => { setTradingAsset(inv); setIsTradeOpen(true); }} className="p-2 text-emerald-600 font-bold bg-emerald-50 rounded-xl text-[10px] uppercase tracking-widest">Trade</button>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">{inv.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{inv.assetType} | {inv.qty > 0 ? 'ACTIVE' : 'EXITED'}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Holdings</p>
                 <p className="font-bold text-slate-800">{inv.qty} Units</p>
               </div>
               <div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Cost</p>
                 <p className="font-bold text-slate-800">₹{inv.avgBuyPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
               </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Value</p>
                  <p className="text-2xl font-black text-slate-900">₹{(inv.qty * inv.currPrice).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realized P/L</p>
                  <p className={`font-black ${inv.totalRealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>₹{inv.totalRealizedPL.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal title={`Investment Trade Ledger: ${viewingLedger?.name}`} isOpen={!!viewingLedger} onClose={() => setViewingLedger(null)} maxWidth="max-w-[95vw]">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead className="bg-slate-50">
              <tr>
                <th colSpan={5} className="px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-r border-slate-200">BUY SIDE DATA</th>
                <th colSpan={5} className="px-4 py-3 text-[10px] font-black text-rose-600 uppercase tracking-widest text-center border-r border-slate-200">SELL SIDE DATA</th>
                <th colSpan={3} className="px-4 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">FINANCIAL RESULTS</th>
              </tr>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Buy Date</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Qty</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Buy Price</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Buy Value</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter border-r border-slate-200">Buy Charges</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sell Date</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sell Price</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sell Value</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sell Charges</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter border-r border-slate-200">Type</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Total Charges</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Net Invested</th>
                <th className="px-3 py-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Net P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {viewingLedger?.history.map((h, i) => {
                const buyValue = h.type === 'buy' ? h.qty * h.price : 0;
                const sellValue = h.type === 'sell' ? h.qty * h.price : 0;
                const netInvested = h.type === 'buy' ? (buyValue + h.charges) : (viewingLedger.avgBuyPrice * h.qty);
                const netPL = h.type === 'sell' ? (sellValue - netInvested - h.charges) : 0;

                return (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-500">{h.type === 'buy' ? h.date : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-black text-slate-800">{h.qty}</td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-600">{h.type === 'buy' ? `₹${h.price.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-black text-indigo-600">{h.type === 'buy' ? `₹${buyValue.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-400 border-r border-slate-200">{h.type === 'buy' ? `₹${h.charges.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-500">{h.type === 'sell' ? h.date : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-600">{h.type === 'sell' ? `₹${h.price.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-black text-rose-600">{h.type === 'sell' ? `₹${sellValue.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-400">{h.type === 'sell' ? `₹${h.charges.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-4 border-r border-slate-200">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${h.type === 'buy' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>{h.type}</span>
                    </td>
                    <td className="px-3 py-4 text-[11px] font-bold text-slate-400">₹{h.charges.toLocaleString()}</td>
                    <td className="px-3 py-4 text-[11px] font-black text-slate-700">₹{netInvested.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td className={`px-3 py-4 text-[11px] font-black ${netPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {h.type === 'sell' ? `₹${netPL.toLocaleString(undefined, {maximumFractionDigits: 0})}` : 'Holding'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal title="Configure New Asset" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <input placeholder="Asset Identity (e.g. BTC, Property A, RELIANCE)" value={editingAsset?.name} onChange={e => setEditingAsset({...editingAsset!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
           <div className="grid grid-cols-2 gap-4">
              <select value={editingAsset?.assetType} onChange={e => setEditingAsset({...editingAsset!, assetType: e.target.value as any})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0">
                 <option>Stock</option><option>MF</option><option>Gold</option><option>Crypto</option><option>Real Estate</option><option>FD</option><option>Other</option>
              </select>
              <input type="number" placeholder="Current Mkt Price" value={editingAsset?.currPrice || ''} onChange={e => setEditingAsset({...editingAsset!, currPrice: parseFloat(e.target.value) || 0})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0" />
           </div>
           <button onClick={handleSaveAsset} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-xs">Authorize Asset</button>
        </div>
      </Modal>

      <Modal title={`Execute Trade: ${tradingAsset?.name}`} isOpen={isTradeOpen} onClose={() => setIsTradeOpen(false)}>
        <div className="space-y-6">
           <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setTradeData({...tradeData, type: 'buy'})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${tradeData.type === 'buy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>BUY SIDE</button>
              <button onClick={() => setTradeData({...tradeData, type: 'sell'})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${tradeData.type === 'sell' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>SELL SIDE</button>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Trade Date</label>
                <input type="date" value={tradeData.date} onChange={e => setTradeData({...tradeData, date: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Quantity</label>
                <input type="number" value={tradeData.qty || ''} onChange={e => setTradeData({...tradeData, qty: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Trade Price (₹)</label>
                <input type="number" value={tradeData.price || ''} onChange={e => setTradeData({...tradeData, price: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Charges (Brokerage/Tax)</label>
                <input type="number" value={tradeData.charges || ''} onChange={e => setTradeData({...tradeData, charges: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
           </div>
           <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Payment Account</label>
                <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                  {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance.toLocaleString()})</option>)}
                </select>
           </div>
           <button onClick={handleTrade} className={`w-full py-5 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-xs ${tradeData.type === 'buy' ? 'bg-indigo-600' : 'bg-rose-600'}`}>Post Trade to Ledger</button>
        </div>
      </Modal>
    </div>
  );
};

export default PortfolioPage;
