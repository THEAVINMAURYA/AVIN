
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppData, AccountType, TransactionType } from './types';
import Modal from './components/Modal';

// Page Imports
import Dashboard from './pages/Dashboard';
import LedgerPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import PartiesPage from './pages/PartiesPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import PortfolioPage from './pages/PortfolioPage';
import VaultPage from './pages/CredentialsPage';
import JournalPage from './pages/JournalPage';
import GoalsPage from './pages/GoalsPage';
import BudgetPage from './pages/BudgetPage';
import CalendarPage from './pages/CalendarPage';
import CategoriesPage from './pages/CategoriesPage';
import SystemPage from './pages/SystemPage';

const INITIAL_DATA: AppData = {
  auth: { userId: '', password: '' },
  sync: { syncId: '', autoSync: true, lastSynced: '' },
  transactions: [],
  accounts: [{ id: 'cash-01', name: 'Main Cash', bankName: 'Physical', accountNumber: '-', balance: 0, type: AccountType.CASH, openingBalance: 0 }],
  parties: [],
  inventory: [],
  credentials: [],
  categories: { 
    income: ['Sales', 'Service', 'Freelance', 'Investment'], 
    expense: ['Inventory Purchase', 'Rent', 'Salaries', 'Utilities', 'Travel'] 
  },
  journal: [],
  budgets: [],
  goals: [],
  investments: []
};

const cryptoUtils = {
  async hash(str: string) {
    const msgUint8 = new TextEncoder().encode(str + "avin_maurya_v2");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
  }
};

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isImportUnlockOpen, setIsImportUnlockOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const loginFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('avin_maurya_v2_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.auth?.userId) setData(parsed);
      } catch (e) { console.error(e); }
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const persist = useCallback((newData: AppData) => {
    setData(newData);
    localStorage.setItem('avin_maurya_v2_data', JSON.stringify(newData));
  }, []);

  const handleImportVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setPendingImportData(imported);
        setIsImportUnlockOpen(true);
      } catch (err) {
        showToast('Invalid Data Package');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleVerifyImport = async (uid: string, pass: string) => {
    if (!pendingImportData) return;
    const appData = pendingImportData.payload || pendingImportData;
    if (appData.auth?.userId === uid && appData.auth?.password === pass) {
      persist({ ...INITIAL_DATA, ...appData });
      setIsLoggedIn(true);
      setIsImportUnlockOpen(false);
      setPendingImportData(null);
      showToast('Vault Restored Successfully');
    } else {
      showToast('Credential Mismatch for this Vault');
    }
  };

  const handleAuthorize = async (uid: string, pass: string) => {
    const derivedId = await cryptoUtils.hash(uid + pass);
    if (authMode === 'signin') {
      if (data.auth.userId === uid && data.auth.password === pass) {
        setIsLoggedIn(true);
        showToast('System Authorized');
      } else {
        showToast('Authentication Failed');
      }
    } else {
      const newData = { ...INITIAL_DATA, auth: { userId: uid, password: pass }, sync: { ...INITIAL_DATA.sync, syncId: derivedId } };
      persist(newData);
      setIsLoggedIn(true);
      showToast('Identity Created');
    }
  };

  const renderPage = () => {
    const props = { data, onSave: persist, showToast };
    switch (currentPage) {
      case 'dashboard': return <Dashboard data={data} onNavigate={setCurrentPage} />;
      case 'ledger': return <LedgerPage {...props} />;
      case 'inventory': return <InventoryPage {...props} />;
      case 'parties': return <PartiesPage {...props} />;
      case 'accounts': return <AccountsPage {...props} />;
      case 'reports': return <ReportsPage {...props} />;
      case 'portfolio': return <PortfolioPage {...props} />;
      case 'vault': return <VaultPage {...props} />;
      case 'journal': return <JournalPage {...props} />;
      case 'goals': return <GoalsPage {...props} />;
      case 'budget': return <BudgetPage {...props} />;
      case 'calendar': return <CalendarPage {...props} />;
      case 'categories': return <CategoriesPage {...props} />;
      case 'system': return <SystemPage {...props} />;
      default: return <Dashboard data={data} onNavigate={setCurrentPage} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
        
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 relative z-10 border border-slate-100">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-indigo-100">
              <i className="fas fa-fingerprint"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">AVIN MAURYA</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Global Accounting Node</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button onClick={() => setAuthMode('signin')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Authorize</button>
            <button onClick={() => setAuthMode('signup')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Register</button>
          </div>

          <form onSubmit={(e: any) => { e.preventDefault(); handleAuthorize(e.target.uid.value, e.target.pass.value); }} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Identity ID</label>
              <input name="uid" type="text" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="UserID" required />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Secret Key</label>
              <input name="pass" type="password" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-[11px] scale-100 active:scale-95">Verify Authority</button>
          </form>

          <div className="mt-8 text-center pt-8 border-t border-slate-50">
            <button onClick={() => loginFileInputRef.current?.click()} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
              <i className="fas fa-file-shield"></i> Restore Local Ledger
            </button>
            <input ref={loginFileInputRef} type="file" accept=".avindata,.json" onChange={handleImportVault} className="hidden" />
          </div>
        </div>
        
        <Modal title="Ledger Restoration" isOpen={isImportUnlockOpen} onClose={() => { setIsImportUnlockOpen(false); setPendingImportData(null); }}>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center text-2xl mx-auto"><i className="fas fa-lock"></i></div>
            <h3 className="text-xl font-black text-slate-900">Encrypted Package Detected</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Enter the original Identity ID and Secret Key to unlock this data vault.</p>
            <form onSubmit={(e: any) => { e.preventDefault(); handleVerifyImport(e.target.uid.value, e.target.pass.value); }} className="space-y-4 text-left">
              <input name="uid" placeholder="Identity ID" className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" required />
              <input name="pass" type="password" placeholder="Secret Key" className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" required />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Verify & Decrypt</button>
            </form>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-100 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200"><i className="fas fa-cube"></i></div>
            <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">AVIN MAURYA</span>
          </div>
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar pb-10">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'fa-house' },
              { id: 'ledger', label: 'Ledger', icon: 'fa-list-check' },
              { id: 'reports', label: 'Reports', icon: 'fa-chart-column' },
              { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-days' },
              { id: 'accounts', label: 'Accounts', icon: 'fa-building-columns' },
              { id: 'portfolio', label: 'Portfolio', icon: 'fa-chart-pie' },
              { id: 'budget', label: 'Budgets', icon: 'fa-piggy-bank' },
              { id: 'goals', label: 'Goals', icon: 'fa-bullseye' },
              { id: 'vault', label: 'Vault', icon: 'fa-key' },
              { id: 'journal', label: 'Journal', icon: 'fa-book' },
              { id: 'categories', label: 'Categories', icon: 'fa-tags' },
              { id: 'parties', label: 'Parties', icon: 'fa-address-book' },
              { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
              { id: 'system', label: 'System Node', icon: 'fa-gear' },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => { setCurrentPage(item.id); setIsSidebarOpen(false); }} 
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${currentPage === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold translate-x-1' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
              >
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-6 border-t border-slate-50">
             <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 px-6 py-4 text-rose-500 hover:bg-rose-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"><i className="fas fa-power-off"></i> Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-6 md:p-12 w-full max-w-[1600px] mx-auto overflow-x-hidden">
        {renderPage()}
      </main>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl z-[100] animate-in flex items-center gap-4 border border-white/10">
          <i className="fas fa-check-circle text-emerald-400"></i>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{toast}</span>
        </div>
      )}

      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 shadow-2xl shadow-indigo-200 rounded-full flex items-center justify-center z-[100] text-white text-xl">
        <i className={`fas ${isSidebarOpen ? 'fa-xmark' : 'fa-bars-staggered'}`}></i>
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
