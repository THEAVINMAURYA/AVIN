
import React, { useRef } from 'react';
import { AppData } from '../types';

interface SystemPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const SystemPage: React.FC<SystemPageProps> = ({ data, onSave, showToast }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAll = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      payload: data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WealthNode_Backup_${new Date().toISOString().split('T')[0]}.avindata`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Global Backup Downloaded');
  };

  const handleImportAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const appData = imported.payload || imported;
        if (appData.auth?.userId) {
          if (confirm('Restoring will overwrite all current local data. Proceed?')) {
            onSave(appData);
            showToast('System State Restored');
          }
        } else {
          showToast('Invalid Data Format');
        }
      } catch (err) {
        showToast('Restoration Failed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-10 animate-in pb-20">
      <header>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Data Governance</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">System Backup & Synchronization Engine</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center text-2xl mb-6">
              <i className="fas fa-cloud-arrow-down"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Export Data Vault</h3>
            <p className="text-sm font-medium text-slate-400 leading-relaxed mb-8">Generate a universal system backup containing all transactions, accounts, portfolio nodes, and secure credentials. Keep this file safe for offline migration.</p>
          </div>
          <button onClick={handleExportAll} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-[11px]">
            Download Full JSON Backup
          </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-2xl mb-6">
              <i className="fas fa-cloud-arrow-up"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Restore Infrastructure</h3>
            <p className="text-sm font-medium text-slate-400 leading-relaxed mb-8">Restore your entire financial ecosystem from a previously exported .avindata package. Warning: This operation overwrites all current local state.</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".avindata,.json" onChange={handleImportAll} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-[11px]">
            Upload & Restore System
          </button>
        </div>
      </div>

      <div className="bg-slate-900 p-10 rounded-[3rem] text-white">
        <div className="flex items-center gap-4 mb-6">
          <i className="fas fa-shield-halved text-2xl text-indigo-400"></i>
          <h4 className="text-xs font-black uppercase tracking-widest">Security Protocol</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="text-indigo-400 font-black text-[10px] uppercase">Encryption</p>
            <p className="text-sm font-bold opacity-60">All data is processed strictly within your local browser sandbox.</p>
          </div>
          <div className="space-y-2">
            <p className="text-indigo-400 font-black text-[10px] uppercase">Persistence</p>
            <p className="text-sm font-bold opacity-60">System state is automatically cached to LocalStorage every millisecond.</p>
          </div>
          <div className="space-y-2">
            <p className="text-indigo-400 font-black text-[10px] uppercase">Portability</p>
            <p className="text-sm font-bold opacity-60">Backup files are fully compatible with any AVIN MAURYA node instance.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPage;
