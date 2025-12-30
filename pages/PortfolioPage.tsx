import React, { useState, useMemo } from 'react';
import { AppData, Investment, InvestmentTrade, TransactionType, Transaction, AccountType } from '../types';
import Modal from '../components/Modal';

interface PortfolioPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ data, onSave, showToast }) => {
  const [activeTab, setActiveTab] = useState<'unrealized' | 'realized'>('unrealized');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Partial<Investment> | null>(null);
  const [tradingAsset, setTradingAsset] = useState<Investment | null>(null);
  const [tradeData, setTradeData] = useState({
    type: 'buy' as 'buy' | 'sell',
    qty: 0,
    price: 0,
    charges: 0,
    date: new Date().toISOString().split('T')[0],
    accountId: data.accounts[0]?.id || ''
  });

  const stats = useMemo(() => {
    const activeInvestments = data.investments.filter(i => i.qty > 0);
    const totalInvested = activeInvestments.reduce((sum, i) => sum + (i.qty * i.avgBuyPrice), 0);
    const currentValue = activeInvestments.reduce((sum, i) => sum + (i.qty * i.currPrice), 0);
    const unrealizedPL = currentValue - totalInvested;
    const totalRealizedPL = data.investments.reduce((sum, i) => sum + (i.totalRealizedPL || 0), 0);

    return { totalInvested, currentValue, unrealizedPL, totalRealizedPL };
  }, [data.investments]);

  const handleUpdateMktPrice = (assetId: string, newPrice: number) => {
    const updated = data.investments.map(inv => 
      inv.id === assetId ? { ...inv, currPrice: newPrice } : inv
    );
    onSave({ ...data, investments: updated });
  };

  // Fix: Added missing openAddAsset function for initializing new assets
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
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = () => {
    if (!editingAsset?.name) return;
    const newList = [...data.investments];
    const index = newList.findIndex(i => i.id === editingAsset.id);
    
    const finalAsset = {
      ...editingAsset,
      history: editingAsset.history || [],
      totalRealizedPL: editingAsset.totalRealizedPL || 0,
      qty: editingAsset.qty || 0,
      avgBuyPrice: editingAsset.avgBuyPrice || 0,
      currPrice: editingAsset.currPrice || 0,
      status: 'active'
    } as Investment;

    if (index >= 0) newList[index] = finalAsset;
    else newList.push(finalAsset);

    onSave({ ...data, investments: newList });
    setIsAssetModalOpen(false);
    showToast('Asset Profile Synchronized');
  };

  const executeTrade = () => {
    if (!tradingAsset || tradeData.qty <= 0 || tradeData.price <= 0) return;
    if (tradeData.type === 'sell' && tradingAsset.qty < tradeData.qty) return showToast('Insufficient Quantity');

    const timestamp = Date.now();
    const tradeTotal = (tradeData.qty * tradeData.price) + (tradeData.type === 'buy' ? tradeData.charges : -tradeData.charges);
    
    // Create Transaction for Ledger
    const ledgerTrans: Transaction = {
      id: `trade-${timestamp}`,
      type: tradeData.type === 'buy' ? TransactionType.EXPENSE : TransactionType.INCOME,
      date: tradeData.date,
      description: `${tradeData.type.toUpperCase()} ${tradingAsset.name} (${tradeData.qty} units)`,
      category: 'Investment Trade',
      amount: Math.abs(tradeTotal),
      account: tradeData.accountId,
      notes: `Trade executed at ₹${tradeData.price}/unit`
    };

    // Update Investment Metrics
    const updatedInvestments = data.investments.map(inv => {
      if (inv.id === tradingAsset.id) {
        const history = [...inv.history, { 
          id: `tr-${timestamp}`, 
          ...tradeData, 
          qty: tradeData.qty, 
          price: tradeData.price, 
          charges: tradeData.charges 
        } as InvestmentTrade];

        let newQty = inv.qty;
        let newAvgPrice = inv.avgBuyPrice;
        let realizedPL = inv.totalRealizedPL;

        if (tradeData.type === 'buy') {
          const totalCost = (inv.qty * inv.avgBuyPrice) + (tradeData.qty * tradeData.price) + tradeData.charges;
          newQty += tradeData.qty;
          newAvgPrice = totalCost / newQty;
        } else {
          const profitOnThisSell = (tradeData.price - inv.avgBuyPrice) * tradeData.qty - tradeData.charges;
          realizedPL += profitOnThisSell;
          newQty -= tradeData.qty;
        }

        return { 
          ...inv, 
          qty: newQty, 
          avgBuyPrice: newAvgPrice, 
          history, 
          totalRealizedPL: realizedPL,
          currPrice: tradeData.price // Update current market price to last traded price
        };
      }
      return inv;
    });

    // Update Account Balance
    const updatedAccounts = data.accounts.map(acc => {
      if (acc.id === tradeData.accountId) {
        return { ...acc, balance: tradeData.type === 'buy' ? acc.balance - tradeTotal : acc.balance + tradeTotal };
      }
      return acc;
    });

    onSave({
      ...data,
      investments: updatedInvestments,
      accounts: updatedAccounts,
      transactions: [ledgerTrans, ...data.transactions]
    });

    setIsTradeModalOpen(false);
    showToast('Trade Authorized & Executed');
  };

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Portfolio Node</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Multi-Asset Wealth Tracker</p>
        </div>
        <button onClick={openAddAsset} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
          <i className="fas fa-plus"></i> Initialize New Asset
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Invested</p>
          <p className="text-2xl font-black text-slate-800">₹{stats.totalInvested.toLocaleString()}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-300">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Valuation</p>
          <p className="text-2xl font-black text-slate-800">₹{stats.currentValue.toLocaleString()}</p>
        </div>
        <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 ${stats.unrealizedPL >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unrealized P/L</p>
          <p className={`text-2xl font-black ${stats.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.unrealizedPL >= 0 ? '+' : ''}₹{stats.unrealizedPL.toLocaleString()}
          </p>
        </div>
        <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 ${stats.totalRealizedPL >= 0 ? 'border-l-indigo-600' : 'border-l-rose-600'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Realized P/L</p>
          <p className={`text-2xl font-black ${stats.totalRealizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {stats.totalRealizedPL >= 0 ? '+' : ''}₹{stats.totalRealizedPL.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white p-1 rounded-[2rem] border border-slate-100 inline-flex shadow-sm mb-4">
        <button 
          onClick={() => setActiveTab('unrealized')} 
          className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'unrealized' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
        >
          Unrealized (Live)
        </button>
        <button 
          onClick={() => setActiveTab('realized')} 
          className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'realized' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
        >
          Realized (Booked)
        </button>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Hierarchy</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Buy Price</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mkt Valuation Rate</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">P/L Impact</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.investments
              .filter(inv => activeTab === 'unrealized' ? inv.qty > 0 : inv.totalRealizedPL !== 0)
              .map(inv => {
                const pl = (inv.currPrice - inv.avgBuyPrice) * inv.qty;
                const plPct = inv.avgBuyPrice > 0 ? (pl / (inv.qty * inv.avgBuyPrice)) * 100 : 0;
                
                return (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-800">{inv.name}</p>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{inv.assetType}</span>
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-600">{inv.qty} units</td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-400">₹{inv.avgBuyPrice.toLocaleString()}</td>
                    <td className="px-8 py-6">
                      {activeTab === 'unrealized' ? (
                        <div className="flex items-center gap-2 group/input">
                          <span className="text-xs font-black text-slate-300">₹</span>
                          <input 
                            type="number" 
                            className="w-32 bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={inv.currPrice || ''}
                            onChange={(e) => handleUpdateMktPrice(inv.id, parseFloat(e.target.value) || 0)}
                          />
                          <i className="fas fa-arrows-rotate text-[10px] text-slate-200 group-hover/input:text-indigo-400 animate-spin-slow"></i>
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-slate-400">Settled</p>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {activeTab === 'unrealized' ? (
                        <div>
                          <p className={`text-sm font-black ${pl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {pl >= 0 ? '+' : ''}₹{pl.toLocaleString()}
                          </p>
                          <p className={`text-[10px] font-black ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%
                          </p>
                        </div>
                      ) : (
                        <div>
                           <p className={`text-sm font-black ${inv.totalRealizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {inv.totalRealizedPL >= 0 ? '+' : ''}₹{inv.totalRealizedPL.toLocaleString()}
                          </p>
                          <span className="text-[9px] font-black text-slate-300 uppercase">Booked Profit</span>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex gap-4 justify-end">
                         <button 
                           onClick={() => { setTradingAsset(inv); setIsTradeModalOpen(true); }}
                           className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-xs"
                           title="Execute Trade"
                         >
                           <i className="fas fa-shuffle"></i>
                         </button>
                         <button 
                           onClick={() => { setEditingAsset(inv); setIsAssetModalOpen(true); }}
                           className="p-3 bg-slate-50 text-slate-300 hover:text-indigo-600 rounded-xl transition-all text-xs"
                         >
                           <i className="fas fa-pen"></i>
                         </button>
                       </div>
                    </td>
                  </tr>
                );
            })}
            {data.investments.length === 0 && (
              <tr><td colSpan={6} className="py-40 text-center text-slate-200 uppercase font-black tracking-widest text-xs">No assets recorded in this sector</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Asset Config Modal */}
      <Modal title="Asset Parameters" isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)}>
         <div className="space-y-6">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label>
               <input value={editingAsset?.name} onChange={e => setEditingAsset({...editingAsset!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Asset Name / Symbol" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Category</label>
                  <select value={editingAsset?.assetType} onChange={e => setEditingAsset({...editingAsset!, assetType: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                    {['Stock', 'MF', 'Gold', 'Crypto', 'Real Estate', 'FD', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Market Price (₹)</label>
                  <input type="number" value={editingAsset?.currPrice || ''} onChange={e => setEditingAsset({...editingAsset!, currPrice: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <button onClick={handleSaveAsset} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Authorize Asset Initializer</button>
         </div>
      </Modal>

      {/* Trade Execution Modal */}
      <Modal title={`Trade Execution: ${tradingAsset?.name}`} isOpen={isTradeModalOpen} onClose={() => setIsTradeModalOpen(false)}>
         <div className="space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => setTradeData({...tradeData, type: 'buy'})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'buy' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400'}`}>Purchase (Buy)</button>
               <button onClick={() => setTradeData({...tradeData, type: 'sell'})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'sell' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'text-slate-400'}`}>Liquidate (Sell)</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Volume (Qty)</label>
                  <input type="number" value={tradeData.qty || ''} onChange={e => setTradeData({...tradeData, qty: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Price (₹)</label>
                  <input type="number" value={tradeData.price || ''} onChange={e => setTradeData({...tradeData, price: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brokerage/Charges (₹)</label>
                  <input type="number" value={tradeData.charges || ''} onChange={e => setTradeData({...tradeData, charges: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Settlement Account</label>
                  <select value={tradeData.accountId} onChange={e => setTradeData({...tradeData, accountId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                    {data.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>)}
                  </select>
               </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <span>Gross Value</span>
                  <span>₹{(tradeData.qty * tradeData.price).toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Charges Impact</span>
                  <span className={tradeData.type === 'buy' ? 'text-rose-500' : 'text-rose-500'}>{tradeData.type === 'buy' ? '+' : '-'} ₹{tradeData.charges.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Net Cash Impact</span>
                  <span className={`text-lg font-black ${tradeData.type === 'buy' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {tradeData.type === 'buy' ? '-' : '+'} ₹{((tradeData.qty * tradeData.price) + (tradeData.type === 'buy' ? tradeData.charges : -tradeData.charges)).toLocaleString()}
                  </span>
               </div>
            </div>

            <button onClick={executeTrade} className={`w-full py-5 text-white font-black rounded-3xl shadow-xl mt-2 uppercase tracking-widest text-[11px] transition-all ${tradeData.type === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              Verify & Authorize Trade
            </button>
         </div>
      </Modal>
    </div>
  );
};

export default PortfolioPage;