import React, { useState, useMemo, useRef } from 'react';
import { AppData, Investment, InvestmentTrade, TransactionType, Transaction, AccountType } from '../types';
import Modal from '../components/Modal';

interface PortfolioPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const PortfolioPage: React.FC<PortfolioPageProps> = ({ data, onSave, showToast }) => {
  const [activeTab, setActiveTab] = useState<'unrealized' | 'realized' | 'charges'>('unrealized');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [viewingAssetLedger, setViewingAssetLedger] = useState<Investment | null>(null);
  const [editingAsset, setEditingAsset] = useState<Partial<Investment> | null>(null);
  const [tradingAsset, setTradingAsset] = useState<Investment | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
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
    const totalCharges = data.investments.reduce((sum, inv) => 
      sum + (inv.history?.reduce((hSum, trade) => hSum + (trade.charges || 0), 0) || 0), 0
    );

    return { totalInvested, currentValue, unrealizedPL, totalRealizedPL, totalCharges };
  }, [data.investments]);

  const handleUpdateMktPrice = (assetId: string, newPrice: number) => {
    const updated = data.investments.map(inv => 
      inv.id === assetId ? { ...inv, currPrice: newPrice } : inv
    );
    onSave({ ...data, investments: updated });
  };

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
    showToast('Asset Profile Initialized');
  };

  const executeTrade = () => {
    if (!tradingAsset || tradeData.qty <= 0 || tradeData.price <= 0) return;
    if (tradeData.type === 'sell' && tradingAsset.qty < tradeData.qty) return showToast('Insufficient holding quantity.');

    const timestamp = Date.now();
    const tradeValue = tradeData.qty * tradeData.price;
    // BUY: You pay Value + Charges | SELL: You get Value - Charges
    const tradeTotalImpact = (tradeData.type === 'buy') 
      ? (tradeValue + tradeData.charges) 
      : (tradeValue - tradeData.charges);
    
    const ledgerTrans: Transaction = {
      id: `trade-${timestamp}`,
      type: tradeData.type === 'buy' ? TransactionType.EXPENSE : TransactionType.INCOME,
      date: tradeData.date,
      description: `${tradeData.type.toUpperCase()} ${tradingAsset.name} (${tradeData.qty} units)`,
      category: 'Investment Trade',
      amount: Math.abs(tradeTotalImpact),
      account: tradeData.accountId,
      notes: `Asset: ${tradingAsset.name} | Price: ₹${tradeData.price} | Charges: ₹${tradeData.charges}`
    };

    const updatedInvestments = data.investments.map(inv => {
      if (inv.id === tradingAsset.id) {
        const tradeRecord: InvestmentTrade = { 
          id: `tr-${timestamp}`, 
          date: tradeData.date,
          type: tradeData.type,
          qty: tradeData.qty, 
          price: tradeData.price, 
          charges: tradeData.charges 
        };

        const history = [...inv.history, tradeRecord];

        let newQty = inv.qty;
        let newAvgPrice = inv.avgBuyPrice;
        let realizedPL = inv.totalRealizedPL;

        if (tradeData.type === 'buy') {
          const currentTotalCost = inv.qty * inv.avgBuyPrice;
          const newTradeCost = (tradeData.qty * tradeData.price) + tradeData.charges;
          newQty += tradeData.qty;
          newAvgPrice = (currentTotalCost + newTradeCost) / newQty;
        } else {
          // Realized P/L = (Sell Price - Buy Avg Price) * Qty - Sell Charges
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
          currPrice: tradeData.price 
        };
      }
      return inv;
    });

    const updatedAccounts = data.accounts.map(acc => {
      if (acc.id === tradeData.accountId) {
        return { 
          ...acc, 
          balance: tradeData.type === 'buy' ? acc.balance - tradeTotalImpact : acc.balance + tradeTotalImpact 
        };
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
    showToast(`Trade Recorded: ${tradeData.type.toUpperCase()} ₹${tradeTotalImpact.toLocaleString()}`);
  };

  const exportGlobalData = () => {
    const headers = ['Asset', 'Type', 'Held Qty', 'Avg Price', 'Live Price', 'Total Realized P/L', 'History Date', 'Trade Type', 'Trade Qty', 'Trade Price', 'Trade Charges'];
    const rows: string[][] = [];

    data.investments.forEach(inv => {
      inv.history.forEach(h => {
        rows.push([
          inv.name, inv.assetType, inv.qty.toString(), inv.avgBuyPrice.toFixed(2), inv.currPrice.toFixed(2), 
          inv.totalRealizedPL.toFixed(2), h.date, h.type, h.qty.toString(), h.price.toString(), h.charges.toString()
        ]);
      });
      if (inv.history.length === 0) {
        rows.push([inv.name, inv.assetType, inv.qty.toString(), inv.avgBuyPrice.toFixed(2), inv.currPrice.toFixed(2), inv.totalRealizedPL.toFixed(2), '-', '-', '-', '-', '-']);
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Asset_Report_Full_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete');
  };

  const handleImportSystem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const appData = imported.payload || imported;
        if (appData.auth?.userId) {
          if (confirm('Importing will overwrite your current ledger. Proceed?')) {
            onSave(appData);
            showToast('System Restore Successful');
          }
        }
      } catch (err) { showToast('Invalid Backup File'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const chargesList = useMemo(() => {
    const list: { id: string; assetName: string; date: string; type: string; qty: number; price: number; amount: number }[] = [];
    data.investments.forEach(inv => {
      inv.history.forEach(trade => {
        if (trade.charges > 0) {
          list.push({
            id: trade.id, assetName: inv.name, date: trade.date, type: trade.type, qty: trade.qty, price: trade.price, amount: trade.charges
          });
        }
      });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.investments]);

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Wealth Nodes</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Multi-Asset Performance Hub</p>
        </div>
        <div className="flex gap-4">
          <input ref={importFileInputRef} type="file" className="hidden" accept=".avindata,.json" onChange={handleImportSystem} />
          <button onClick={() => importFileInputRef.current?.click()} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-file-import"></i> Restore
          </button>
          <button onClick={exportGlobalData} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-file-export"></i> Backup
          </button>
          <button onClick={openAddAsset} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-plus"></i> Initialize Node
          </button>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invested Capital</p>
          <p className="text-xl font-black text-slate-800">₹{stats.totalInvested.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-indigo-300">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Value</p>
          <p className="text-xl font-black text-slate-800">₹{stats.currentValue.toLocaleString()}</p>
        </div>
        <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 ${stats.unrealizedPL >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unrealized P/L</p>
          <p className={`text-xl font-black ${stats.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.unrealizedPL >= 0 ? '+' : ''}₹{stats.unrealizedPL.toLocaleString()}
          </p>
        </div>
        <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 ${stats.totalRealizedPL >= 0 ? 'border-l-emerald-600' : 'border-l-rose-600'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Realized P/L</p>
          <p className={`text-xl font-black ${stats.totalRealizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {stats.totalRealizedPL >= 0 ? '+' : ''}₹{stats.totalRealizedPL.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm border-l-4 border-l-rose-400">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Friction</p>
          <p className="text-xl font-black text-rose-500">₹{stats.totalCharges.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-1 rounded-[2rem] border border-slate-100 inline-flex shadow-sm mb-4">
        {['unrealized', 'realized', 'charges'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
            {t === 'unrealized' ? 'Holdings' : t === 'realized' ? 'Bookings' : 'Audit Logs'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        {activeTab !== 'charges' ? (
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Category</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Cost</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Rate</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Impact</th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.investments
                .filter(inv => activeTab === 'unrealized' ? inv.status === 'active' : inv.totalRealizedPL !== 0)
                .map(inv => {
                  const currentUnrealizedPL = (inv.currPrice - inv.avgBuyPrice) * inv.qty;
                  const plPct = inv.avgBuyPrice > 0 ? (currentUnrealizedPL / (inv.qty * inv.avgBuyPrice)) * 100 : 0;
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
                            <input type="number" className="w-32 bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all" value={inv.currPrice || ''} onChange={(e) => handleUpdateMktPrice(inv.id, parseFloat(e.target.value) || 0)} />
                          </div>
                        ) : <p className="text-xs font-bold text-slate-400">Liquidated</p>}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div>
                          <p className={`text-sm font-black ${ (activeTab === 'unrealized' ? currentUnrealizedPL : inv.totalRealizedPL) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ₹{(activeTab === 'unrealized' ? currentUnrealizedPL : inv.totalRealizedPL).toLocaleString()}
                          </p>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{activeTab === 'unrealized' ? `${plPct.toFixed(2)}%` : 'Realized'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex gap-2 justify-end">
                           <button onClick={() => setViewingAssetLedger(inv)} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all text-[9px] font-black uppercase tracking-widest">Ledger</button>
                           <button onClick={() => { setTradingAsset(inv); setIsTradeModalOpen(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[9px] font-black uppercase tracking-widest">Trade</button>
                           <button onClick={() => { setEditingAsset(inv); setIsAssetModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><i className="fas fa-pen"></i></button>
                         </div>
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Node</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume</th>
                <th className="px-8 py-6 text-[10px) font-black text-slate-400 uppercase tracking-widest text-right">Charges (Friction)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chargesList.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-8 py-6 text-xs font-bold text-slate-400">{item.date}</td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-800">{item.assetName}</p>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${item.type === 'buy' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{item.type}</span>
                  </td>
                  <td className="px-8 py-6 text-xs font-bold text-slate-600">{item.qty} units @ ₹{item.price}</td>
                  <td className="px-8 py-6 text-right font-black text-rose-500">₹{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Asset Ledger Modal */}
      <Modal title={`Audit Ledger: ${viewingAssetLedger?.name}`} isOpen={!!viewingAssetLedger} onClose={() => setViewingAssetLedger(null)} maxWidth="max-w-4xl">
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Holding</p>
               <p className="text-xl font-black text-slate-900">{viewingAssetLedger?.qty} Units</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Cost</p>
               <p className="text-xl font-black text-slate-900">₹{viewingAssetLedger?.avgBuyPrice.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Realized P/L</p>
               <p className={`text-xl font-black ${viewingAssetLedger?.totalRealizedPL! >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{viewingAssetLedger?.totalRealizedPL.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Charges</p>
               <p className="text-xl font-black text-rose-500">₹{viewingAssetLedger?.history.reduce((s, h) => s + h.charges, 0).toLocaleString()}</p>
            </div>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vol x Rate</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Charges</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Net Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewingAssetLedger?.history.sort((a,b) => b.date.localeCompare(a.date)).map(h => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{h.date}</td>
                  <td className="px-6 py-4 uppercase font-black text-[9px]">{h.type === 'buy' ? <span className="text-emerald-500">Purchase</span> : <span className="text-rose-500">Liquidation</span>}</td>
                  <td className="px-6 py-4 text-sm font-bold">{h.qty} @ ₹{h.price}</td>
                  <td className="px-6 py-4 text-xs text-rose-400">₹{h.charges}</td>
                  <td className={`px-6 py-4 text-right font-black ${h.type === 'buy' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{((h.qty * h.price) + (h.type === 'buy' ? h.charges : -h.charges)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Initialize Asset Modal */}
      <Modal title="Initialize Asset Node" isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)}>
         <div className="space-y-6">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label>
               <input value={editingAsset?.name} onChange={e => setEditingAsset({...editingAsset!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="Asset Symbol / Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Classification</label>
                  <select value={editingAsset?.assetType} onChange={e => setEditingAsset({...editingAsset!, assetType: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                    {['Stock', 'MF', 'Gold', 'Crypto', 'Real Estate', 'FD', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Live Rate (₹)</label>
                  <input type="number" value={editingAsset?.currPrice || ''} onChange={e => setEditingAsset({...editingAsset!, currPrice: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <button onClick={handleSaveAsset} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Verify & Authorize Node</button>
         </div>
      </Modal>

      {/* Trade Modal */}
      <Modal title={`Trade Execution: ${tradingAsset?.name}`} isOpen={isTradeModalOpen} onClose={() => setIsTradeModalOpen(false)}>
         <div className="space-y-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
               <button onClick={() => setTradeData({...tradeData, type: 'buy'})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'buy' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>Purchase (Buy)</button>
               <button onClick={() => setTradeData({...tradeData, type: 'sell'})} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tradeData.type === 'sell' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400'}`}>Liquidate (Sell)</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Date</label>
                  <input type="date" value={tradeData.date} onChange={e => setTradeData({...tradeData, date: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                  <input type="number" value={tradeData.qty || ''} onChange={e => setTradeData({...tradeData, qty: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Execution Price (₹)</label>
                  <input type="number" value={tradeData.price || ''} onChange={e => setTradeData({...tradeData, price: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Friction / Charges (₹)</label>
                  <input type="number" value={tradeData.charges || ''} onChange={e => setTradeData({...tradeData, charges: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Settlement Account</label>
               <select value={tradeData.accountId} onChange={e => setTradeData({...tradeData, accountId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                 {data.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>)}
               </select>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <span>Gross Value</span>
                  <span>₹{(tradeData.qty * tradeData.price).toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Charges</span>
                  <span className="text-rose-500">{tradeData.type === 'buy' ? '+' : '-'} ₹{tradeData.charges.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Net Capital Impact</span>
                  <span className={`text-lg font-black ${tradeData.type === 'buy' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {tradeData.type === 'buy' ? '-' : '+'} ₹{((tradeData.qty * tradeData.price) + (tradeData.type === 'buy' ? tradeData.charges : -tradeData.charges)).toLocaleString()}
                  </span>
               </div>
            </div>
            <button onClick={executeTrade} className={`w-full py-5 text-white font-black rounded-3xl shadow-xl mt-2 uppercase tracking-widest text-[11px] transition-all ${tradeData.type === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>Process Authority Trade</button>
         </div>
      </Modal>
    </div>
  );
};

export default PortfolioPage;