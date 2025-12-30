import React, { useState, useMemo } from 'react';
import { AppData, Investment, InvestmentTrade, TransactionType, Transaction } from '../types';
import Modal from '../components/Modal';

interface PortfolioPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ data, onSave, showToast }) => {
  const [activeTab, setActiveTab] = useState<'unrealized' | 'realized' | 'charges'>('unrealized');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [viewingAssetLedger, setViewingAssetLedger] = useState<Investment | null>(null);
  
  // Ledger Filters
  const [ledgerStart, setLedgerStart] = useState('');
  const [ledgerEnd, setLedgerEnd] = useState('');

  // Trade State
  const [tradeData, setTradeData] = useState({
    id: '', 
    assetId: '',
    newName: '',
    newType: 'Stock' as Investment['assetType'],
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
    const totalCharges = data.investments.reduce((sum, inv) => 
      sum + (inv.history?.reduce((hSum, trade) => hSum + (trade.charges || 0), 0) || 0), 0
    );

    return { totalInvested, currentValue, unrealizedPL, totalRealizedPL, totalCharges, assetCount: activeInvestments.length };
  }, [data.investments]);

  const filteredInvestments = useMemo(() => {
    return data.investments.filter(inv => {
      const matchesTab = activeTab === 'unrealized' ? inv.qty > 0 : (activeTab === 'realized' ? inv.totalRealizedPL !== 0 : true);
      const matchesSearch = inv.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           inv.assetType.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [data.investments, activeTab, searchTerm]);

  // Recalculates the entire asset history with running balance/qty
  const assetLedgerData = useMemo(() => {
    if (!viewingAssetLedger) return [];
    let runningQty = 0;
    let runningCapital = 0; // Net investment (Cost Basis)
    
    const fullHistory = [...viewingAssetLedger.history]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(h => {
        const impact = (h.qty * h.price) + (h.type === 'buy' ? h.charges : -h.charges);
        if (h.type === 'buy') {
          runningQty += h.qty;
          runningCapital += impact;
        } else {
          runningQty -= h.qty;
          runningCapital -= impact;
        }
        return { ...h, runningQty, runningCapital };
      });

    return fullHistory.filter(h => {
      const matchStart = ledgerStart ? h.date >= ledgerStart : true;
      const matchEnd = ledgerEnd ? h.date <= ledgerEnd : true;
      return matchStart && matchEnd;
    }).reverse();
  }, [viewingAssetLedger, ledgerStart, ledgerEnd]);

  const executeTrade = () => {
    let targetAsset: Investment | undefined;
    if (tradeData.assetId) targetAsset = data.investments.find(i => i.id === tradeData.assetId);
    else if (tradeData.newName) {
      targetAsset = { id: Date.now().toString(), name: tradeData.newName, assetType: tradeData.newType, qty: 0, avgBuyPrice: 0, currPrice: tradeData.price, history: [], status: 'active', totalRealizedPL: 0 };
    }

    if (!targetAsset) return showToast('Define Asset Node First');
    if (tradeData.qty <= 0 || tradeData.price <= 0) return showToast('Invalid Execution Metrics');

    const timestamp = Date.now();
    const tradeValue = tradeData.qty * tradeData.price;
    const netImpact = (tradeData.type === 'buy') ? (tradeValue + tradeData.charges) : (tradeValue - tradeData.charges);

    // Sync with main Authority Ledger
    const ledgerTrans: Transaction = {
      id: tradeData.id ? `trade-${tradeData.id}` : `trade-${timestamp}`,
      type: tradeData.type === 'buy' ? TransactionType.EXPENSE : TransactionType.INCOME,
      date: tradeData.date,
      description: `${tradeData.type.toUpperCase()} ${targetAsset.name} (${tradeData.qty} Units)`,
      category: 'Asset Reconciliation',
      amount: Math.abs(netImpact),
      account: tradeData.accountId,
      notes: `Trade ID: ${tradeData.id || timestamp} | Node: ${targetAsset.name}`
    };

    const tradeRecord: InvestmentTrade = { id: tradeData.id || `tr-${timestamp}`, date: tradeData.date, type: tradeData.type, qty: tradeData.qty, price: tradeData.price, charges: tradeData.charges };

    let updatedInvestments = [...data.investments];
    const assetIdx = updatedInvestments.findIndex(i => i.id === targetAsset!.id);

    let history = [...targetAsset.history];
    if (tradeData.id) history = history.filter(h => h.id !== tradeData.id);
    history.push(tradeRecord);

    // RECURSIVE RECALCULATION ENGINE
    let calcQty = 0;
    let totalCostBasis = 0;
    let totalRealizedPL = 0;

    history.sort((a,b) => a.date.localeCompare(b.date)).forEach(h => {
      if (h.type === 'buy') {
        const costWithCharges = (h.qty * h.price) + h.charges;
        calcQty += h.qty;
        totalCostBasis += costWithCharges;
      } else {
        const currentAvg = calcQty > 0 ? totalCostBasis / calcQty : 0;
        const profitOnSale = (h.price - currentAvg) * h.qty - h.charges;
        totalRealizedPL += profitOnSale;
        totalCostBasis -= (currentAvg * h.qty);
        calcQty -= h.qty;
      }
    });

    const finalAsset = { 
      ...targetAsset, 
      qty: Math.max(0, calcQty), 
      avgBuyPrice: calcQty > 0 ? totalCostBasis / calcQty : 0, 
      history, 
      totalRealizedPL, 
      status: calcQty > 0 ? 'active' : 'closed' 
    } as Investment;

    if (assetIdx >= 0) updatedInvestments[assetIdx] = finalAsset;
    else updatedInvestments.push(finalAsset);

    // Synchronize Settlement Account
    const updatedAccounts = data.accounts.map(acc => {
      if (acc.id === tradeData.accountId) {
        // Simple balance update for now
        const delta = tradeData.type === 'buy' ? -netImpact : netImpact;
        return { ...acc, balance: acc.balance + delta };
      }
      return acc;
    });

    onSave({ ...data, investments: updatedInvestments, accounts: updatedAccounts, transactions: [ledgerTrans, ...data.transactions.filter(t => t.id !== ledgerTrans.id)] });
    setIsTradeModalOpen(false);
    showToast(`Authority Protocol ${tradeData.id ? 'Amended' : 'Signed'}`);
    setTradeData({ ...tradeData, id: '', assetId: '', newName: '', qty: 0, price: 0, charges: 0 });
    if (viewingAssetLedger) setViewingAssetLedger(finalAsset);
  };

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Wealth Nodes</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Sovereign Asset Control Protocol</p>
        </div>
        <button onClick={() => { setTradeData(p => ({ ...p, id: '', assetId: '', newName: '', type: 'buy' })); setIsTradeModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
          <i className="fas fa-plus-circle"></i> Initialize Authority Trade
        </button>
      </header>

      {/* Global Metrics Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border-l-4 border-l-slate-300 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Nodes</p>
          <p className="text-xl font-black text-slate-800">{stats.assetCount}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl border-l-4 border-l-indigo-400 text-white">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Net Valuation</p>
          <p className="text-xl font-black">₹{stats.currentValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border-l-4 border-l-slate-400 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Capital Invested</p>
          <p className="text-xl font-black text-slate-800">₹{stats.totalInvested.toLocaleString()}</p>
        </div>
        <div className={`bg-white p-6 rounded-[2.5rem] border-l-4 shadow-sm ${stats.unrealizedPL >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unrealized P/L</p>
          <p className={`text-xl font-black ${stats.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>₹{stats.unrealizedPL.toLocaleString()}</p>
        </div>
        <div className={`bg-white p-6 rounded-[2.5rem] border-l-4 shadow-sm ${stats.totalRealizedPL >= 0 ? 'border-l-indigo-500' : 'border-l-rose-600'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Realized Returns</p>
          <p className={`text-xl font-black ${stats.totalRealizedPL >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>₹{stats.totalRealizedPL.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border-l-4 border-l-rose-400 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Friction</p>
          <p className="text-xl font-black text-rose-500">₹{stats.totalCharges.toLocaleString()}</p>
        </div>
      </div>

      {/* Explorer Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="bg-white p-1 rounded-[2rem] border border-slate-100 inline-flex shadow-sm">
          {['unrealized', 'realized', 'charges'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
              {t === 'unrealized' ? 'Current Holdings' : t === 'realized' ? 'Closed Trades' : 'Audit Logs'}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-96">
          <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input type="text" placeholder="Filter by asset identity..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-[2rem] font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
        </div>
      </div>

      {/* Assets Grid/Table */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Node</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Running Qty</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Impact</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredInvestments.map(inv => {
              const currentUnrealizedPL = (inv.currPrice - inv.avgBuyPrice) * inv.qty;
              const plPct = inv.avgBuyPrice > 0 ? (currentUnrealizedPL / (inv.qty * inv.avgBuyPrice)) * 100 : 0;
              return (
                <tr key={inv.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-800 uppercase">{inv.name}</p>
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{inv.assetType} | Weighted ₹{inv.avgBuyPrice.toFixed(1)}</span>
                  </td>
                  <td className="px-8 py-6 text-xs font-bold text-slate-600">{inv.qty.toLocaleString()} Units</td>
                  <td className="px-8 py-6 text-right">
                    <p className={`text-sm font-black ${ (activeTab === 'unrealized' ? currentUnrealizedPL : inv.totalRealizedPL) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      ₹{(activeTab === 'unrealized' ? currentUnrealizedPL : inv.totalRealizedPL).toLocaleString()}
                    </p>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{activeTab === 'unrealized' ? `${plPct.toFixed(1)}% Yield` : 'Net Booked'}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setLedgerStart(''); setLedgerEnd(''); setViewingAssetLedger(inv); }} className="px-4 py-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest">Audit Asset</button>
                      <button onClick={() => { setTradeData({ ...tradeData, id: '', assetId: inv.id, type: 'buy', qty: 0, price: inv.currPrice }); setIsTradeModalOpen(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[9px] font-black uppercase tracking-widest">Transact</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Asset Audit Ledger Modal (The Specific Running Ledger) */}
      <Modal title={`Full Lifecycle Audit: ${viewingAssetLedger?.name}`} isOpen={!!viewingAssetLedger} onClose={() => setViewingAssetLedger(null)} maxWidth="max-w-6xl">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
             <div className="flex gap-3">
               <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Protocol From</label>
                  <input type="date" value={ledgerStart} onChange={e => setLedgerStart(e.target.value)} className="bg-white border-0 px-4 py-2 rounded-xl font-bold text-xs shadow-sm" />
               </div>
               <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Protocol To</label>
                  <input type="date" value={ledgerEnd} onChange={e => setLedgerEnd(e.target.value)} className="bg-white border-0 px-4 py-2 rounded-xl font-bold text-xs shadow-sm" />
               </div>
               <button onClick={() => { setLedgerStart(''); setLedgerEnd(''); }} className="mt-5 text-[8px] font-black text-slate-400 uppercase hover:text-rose-500">Reset Authority</button>
             </div>
             <div className="flex gap-8">
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Units</p>
                  <p className="text-xl font-black text-slate-900">{viewingAssetLedger?.qty.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weighted Cost</p>
                  <p className="text-xl font-black text-indigo-600">₹{viewingAssetLedger?.avgBuyPrice.toLocaleString()}</p>
                </div>
             </div>
          </div>

          <div className="overflow-x-auto rounded-[2rem] border border-slate-50">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Op</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Execution</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Running Qty</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Running Balance</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetLedgerData.map(h => (
                  <tr key={h.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-5 text-xs font-bold text-slate-400">{h.date}</td>
                    <td className="px-6 py-5 uppercase font-black text-[10px]">{h.type === 'buy' ? <span className="text-emerald-500">BUY</span> : <span className="text-rose-500">SELL</span>}</td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-800">{h.qty} @ ₹{h.price}</p>
                      <p className="text-[8px] font-black text-rose-300 uppercase">Friction: ₹{h.charges}</p>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-800">{h.runningQty.toLocaleString()}</td>
                    <td className={`px-6 py-5 text-right font-black ${h.runningCapital >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>₹{h.runningCapital.toLocaleString()}</td>
                    <td className="px-6 py-5 text-right">
                       <button onClick={() => { 
                         setTradeData({ id: h.id, assetId: viewingAssetLedger!.id, newName: '', newType: viewingAssetLedger!.assetType, type: h.type, qty: h.qty, price: h.price, charges: h.charges, date: h.date, accountId: data.accounts[0].id });
                         setIsTradeModalOpen(true);
                       }} className="p-3 bg-slate-50 text-slate-200 hover:text-indigo-600 hover:bg-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-edit"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Authority Trade Config Modal */}
      <Modal title={tradeData.id ? "Amend Authority Record" : "Authorize Trade Execution"} isOpen={isTradeModalOpen} onClose={() => setIsTradeModalOpen(false)}>
         <div className="space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => setTradeData({...tradeData, type: 'buy'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'buy' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'}`}>Purchase (Buy)</button>
               <button onClick={() => setTradeData({...tradeData, type: 'sell'})} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'sell' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>Liquidation (Sell)</button>
            </div>

            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity Selection</label>
               {tradeData.id ? (
                 <div className="w-full px-5 py-4 bg-indigo-50/50 rounded-2xl font-black text-indigo-600 border border-indigo-100 uppercase text-center">{viewingAssetLedger?.name} (Amending History)</div>
               ) : (
                 <>
                  <select value={tradeData.assetId} onChange={e => setTradeData({...tradeData, assetId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold mb-3 shadow-inner outline-none">
                    <option value="">- Initialize New Node -</option>
                    {data.investments.map(i => <option key={i.id} value={i.id}>{i.name} ({i.assetType}) | Balance: {i.qty}</option>)}
                  </select>
                  {tradeData.assetId === '' && (
                    <div className="grid grid-cols-2 gap-4 animate-in">
                      <input value={tradeData.newName} onChange={e => setTradeData({...tradeData, newName: e.target.value})} className="px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner" placeholder="Asset Symbol" />
                      <select value={tradeData.newType} onChange={e => setTradeData({...tradeData, newType: e.target.value as any})} className="px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner">
                        {['Stock', 'MF', 'Gold', 'Crypto', 'Real Estate', 'FD', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                 </>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Date</label>
                  <input type="date" value={tradeData.date} onChange={e => setTradeData({...tradeData, date: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Volume (Units)</label>
                  <input type="number" value={tradeData.qty || ''} onChange={e => setTradeData({...tradeData, qty: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Rate (₹)</label>
                  <input type="number" value={tradeData.price || ''} onChange={e => setTradeData({...tradeData, price: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Friction / Fees (₹)</label>
                  <input type="number" value={tradeData.charges || ''} onChange={e => setTradeData({...tradeData, charges: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner" />
               </div>
            </div>

            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Settlement Identity</label>
               <select value={tradeData.accountId} onChange={e => setTradeData({...tradeData, accountId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold shadow-inner outline-none">
                 {data.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>)}
               </select>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
               <div className="flex justify-between items-center text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">
                  <span>Gross Valuation</span>
                  <span>₹{(tradeData.qty * tradeData.price).toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black opacity-40 uppercase tracking-widest">
                  <span>Friction Adjustment</span>
                  <span className="text-rose-400">{tradeData.type === 'buy' ? '+' : '-'} ₹{tradeData.charges.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
                  <span className="text-xs font-black uppercase tracking-widest">Net Capital Impact</span>
                  <span className={`text-2xl font-black ${tradeData.type === 'buy' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {tradeData.type === 'buy' ? '-' : '+'} ₹{((tradeData.qty * tradeData.price) + (tradeData.type === 'buy' ? tradeData.charges : -tradeData.charges)).toLocaleString()}
                  </span>
               </div>
            </div>

            <button onClick={executeTrade} className={`w-full py-5 text-white font-black rounded-3xl shadow-xl mt-2 uppercase tracking-widest text-[11px] transition-all ${tradeData.type === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>Verify & Authorize Authority Record</button>
         </div>
      </Modal>
    </div>
  );
};

export default PortfolioPage;