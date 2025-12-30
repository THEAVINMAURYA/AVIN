
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
  const [editingVault, setEditingVault] = useState<Partial<Credential> | null>(null);

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

  const exportCSV = () => {
    const headers = ['Client', 'Email', 'Label', 'Username', 'Password', 'Link'];
    const rows: string[][] = [];
    data.credentials.forEach(v => {
      v.items.forEach(i => {
        rows.push([v.clientName, v.email, i.label, i.user, i.pass, i.link]);
      });
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "vault_credentials.csv");
    link.click();
    showToast('Vault Exported');
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Secure Vault</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Enterprise-grade credential management.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={exportCSV} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all"><i className="fas fa-file-csv mr-2"></i> Export</button>
          <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3"><i className="fas fa-key"></i> New Key</button>
        </div>
      </header>

      <div className="relative mb-8">
        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
        <input type="text" placeholder="Search keys..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm font-medium outline-none focus:ring-4 focus:ring-indigo-50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
                <i className="fas fa-shield-alt"></i>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingVault(item); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><i className="fas fa-edit"></i></button>
                <button onClick={() => deleteVault(item.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{item.clientName}</h3>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{item.email || 'No email attached'}</p>
            <div className="space-y-3">
              {item.items.map((key, i) => (
                <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                   <div className="flex justify-between items-center mb-1">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{key.label}</span>
                     <button onClick={() => { navigator.clipboard.writeText(key.pass); showToast('Password Copied'); }} className="text-[10px] text-indigo-500 font-bold hover:underline">Copy Pass</button>
                   </div>
                   <p className="text-sm font-bold text-slate-700 truncate">{key.user}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal title="Secure Entry Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Client Name</label>
                <input value={editingVault?.clientName} onChange={e => setEditingVault({...editingVault!, clientName: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Primary Contact</label>
                <input value={editingVault?.email} onChange={e => setEditingVault({...editingVault!, email: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
           </div>
           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Credential Fields</h4>
                <button onClick={addItem} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Add Field</button>
              </div>
              {editingVault?.items?.map((item, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                  <input placeholder="Label (e.g. AWS Console)" value={item.label} onChange={e => updateItem(i, 'label', e.target.value)} className="w-full px-4 py-2 bg-white rounded-xl border-0 text-xs font-black uppercase tracking-widest" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Username/UID" value={item.user} onChange={e => updateItem(i, 'user', e.target.value)} className="px-4 py-3 bg-white rounded-xl border-0 text-sm font-bold" />
                    <input placeholder="Passphrase" type="password" value={item.pass} onChange={e => updateItem(i, 'pass', e.target.value)} className="px-4 py-3 bg-white rounded-xl border-0 text-sm font-bold" />
                  </div>
                </div>
              ))}
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4">Secure Entry</button>
        </div>
      </Modal>
    </div>
  );
};

export default VaultPage;
