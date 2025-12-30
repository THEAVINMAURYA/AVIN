import React, { useState } from 'react';
import { AppData, Credential, CredentialItem } from '../types';
import Modal from '../components/Modal';

interface VaultPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const VaultPage: React.FC<VaultPageProps> = ({ data, onSave, showToast }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<Partial<Credential> | null>(null);
  
  // Reveal state
  const [revealTarget, setRevealTarget] = useState<{ vaultId: string, itemIdx: number } | null>(null);
  const [revealPassword, setRevealPassword] = useState('');
  const [revealedValue, setRevealedValue] = useState<string | null>(null);

  const filtered = data.credentials.filter(c => 
    c.clientName.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingVault({
      id: Date.now().toString(),
      clientName: '',
      email: '',
      items: [{ label: 'Primary Password', user: '', pass: '', link: '' }]
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingVault?.clientName) return;
    const newList = [...data.credentials];
    const index = newList.findIndex(v => v.id === editingVault.id);
    if (index >= 0) newList[index] = editingVault as Credential;
    else newList.push(editingVault as Credential);

    onSave({ ...data, credentials: newList });
    setIsModalOpen(false);
    showToast('Vault Item Secured');
  };

  const handleRevealAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (revealPassword === data.auth.password) {
      const vault = data.credentials.find(v => v.id === revealTarget?.vaultId);
      const pass = vault?.items[revealTarget!.itemIdx].pass;
      setRevealedValue(pass || 'N/A');
      showToast('Identity Verified');
    } else {
      showToast('Authority Denied: Incorrect Secret Key');
    }
    setRevealPassword('');
  };

  const closeReveal = () => {
    setIsRevealModalOpen(false);
    setRevealTarget(null);
    setRevealedValue(null);
    setRevealPassword('');
  };

  const addItem = () => {
    if (editingVault) {
      setEditingVault({
        ...editingVault,
        items: [...(editingVault.items || []), { label: '', user: '', pass: '', link: '' }]
      });
    }
  };

  const updateItem = (idx: number, key: keyof CredentialItem, val: string) => {
    if (editingVault && editingVault.items) {
      const items = [...editingVault.items];
      items[idx] = { ...items[idx], [key]: val };
      setEditingVault({ ...editingVault, items });
    }
  };

  const deleteVault = (id: string) => {
    if (confirm('Delete this secure entry?')) {
      onSave({ ...data, credentials: data.credentials.filter(v => v.id !== id) });
      showToast('Vault Entry Removed');
    }
  };

  return (
    <div className="space-y-10 animate-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Secure Vault</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Sovereign Credential Management</p>
        </div>
        <div className="flex gap-4">
          <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all uppercase tracking-widest text-[10px]">
            <i className="fas fa-key"></i> Initialize Key Node
          </button>
        </div>
      </header>

      <div className="relative">
        <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
        <input type="text" placeholder="Search secure identities..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative border-b-4 border-b-transparent hover:border-b-indigo-500">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                <i className="fas fa-shield-halved"></i>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingVault(item); setIsModalOpen(true); }} className="p-3 bg-slate-50 text-slate-300 hover:text-indigo-600 rounded-xl transition-colors"><i className="fas fa-pen"></i></button>
                <button onClick={() => deleteVault(item.id)} className="p-3 bg-slate-50 text-slate-300 hover:text-rose-500 rounded-xl transition-colors"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{item.clientName}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 truncate">{item.email || 'Independent Profile'}</p>
            
            <div className="space-y-3">
              {item.items.map((key, i) => (
                <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-50 group/field">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{key.label}</span>
                     <div className="flex gap-3">
                        <button 
                          onClick={() => { setRevealTarget({ vaultId: item.id, itemIdx: i }); setIsRevealModalOpen(true); }}
                          className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700"
                        >
                          <i className="fas fa-eye mr-1"></i> Reveal
                        </button>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(key.pass); showToast('Key Copied to Clipboard'); }} 
                          className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"
                        >
                          Copy
                        </button>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-700 truncate flex-1">{key.user}</p>
                      <span className="text-slate-200">|</span>
                      <p className="text-xs font-black text-slate-300 tracking-tighter">••••••••</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
           <div className="col-span-full py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem]">
              <i className="fas fa-vault text-4xl text-slate-100 mb-4"></i>
              <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No secure nodes discovered</p>
           </div>
        )}
      </div>

      {/* Reveal Authentication Modal */}
      <Modal title="Authority Verification Required" isOpen={isRevealModalOpen} onClose={closeReveal}>
        <div className="space-y-8 text-center py-4">
           {revealedValue ? (
             <div className="space-y-6 animate-in">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-sm shadow-emerald-100">
                   <i className="fas fa-unlock"></i>
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Authenticated Credential</p>
                   <p className="text-3xl font-black text-slate-900 bg-slate-50 p-6 rounded-3xl border border-slate-100 break-all">{revealedValue}</p>
                </div>
                <button onClick={closeReveal} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-xl">Close Secure View</button>
             </div>
           ) : (
             <form onSubmit={handleRevealAttempt} className="space-y-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-sm shadow-indigo-100">
                   <i className="fas fa-lock"></i>
                </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-900 uppercase">Verification Loop</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-10">Provide your System Secret Key to authorize decryption of this node.</p>
                </div>
                <input 
                  type="password" 
                  autoFocus
                  placeholder="Secret Key" 
                  value={revealPassword} 
                  onChange={e => setRevealPassword(e.target.value)}
                  className="w-full px-6 py-5 bg-slate-50 border-0 rounded-2xl font-bold text-center focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner" 
                />
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest text-[11px] hover:scale-105 transition-all">Authorize Decryption</button>
             </form>
           )}
        </div>
      </Modal>

      {/* Vault Configuration Modal */}
      <Modal title="Secure Node Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Owner</label>
                <input value={editingVault?.clientName} onChange={e => setEditingVault({...editingVault!, clientName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="e.g. AWS, Github, Bank" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Email/ID</label>
                <input value={editingVault?.email} onChange={e => setEditingVault({...editingVault!, email: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" placeholder="owner@domain.com" />
              </div>
           </div>
           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Key Fields</h4>
                <button onClick={addItem} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">Add Field</button>
              </div>
              {editingVault?.items?.map((item, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100 shadow-sm">
                  <input placeholder="Field Label (e.g. Web Dashboard)" value={item.label} onChange={e => updateItem(i, 'label', e.target.value)} className="w-full px-4 py-3 bg-white rounded-xl border-0 text-[10px] font-black uppercase tracking-widest" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Username/Email" value={item.user} onChange={e => updateItem(i, 'user', e.target.value)} className="px-5 py-4 bg-white rounded-xl border-0 text-sm font-bold" />
                    <input placeholder="Passphrase" type="password" value={item.pass} onChange={e => updateItem(i, 'pass', e.target.value)} className="px-5 py-4 bg-white rounded-xl border-0 text-sm font-bold" />
                  </div>
                </div>
              ))}
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-[11px]">Authorize Node Initialization</button>
        </div>
      </Modal>
    </div>
  );
};

export default VaultPage;