
import React, { useState, useMemo } from 'react';
import { AppData, JournalEntry } from '../types';
import Modal from '../components/Modal';

interface JournalPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const JournalPage: React.FC<JournalPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<JournalEntry> | null>(null);

  const openAdd = () => {
    setEditingEntry({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], title: '', content: '', photos: [] });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingEntry?.title) return;
    const newList = [...data.journal];
    const index = newList.findIndex(e => e.id === editingEntry.id);
    if (index >= 0) newList[index] = editingEntry as JournalEntry;
    else newList.push(editingEntry as JournalEntry);
    onSave({ ...data, journal: newList });
    setIsModalOpen(false);
    showToast('Journal Entry Secured');
  };

  const deleteEntry = (id: string) => {
    if (confirm('Permanently delete this entry?')) {
      onSave({ ...data, journal: data.journal.filter(e => e.id !== id) });
      showToast('Entry Removed');
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Financial Journal</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Reflections and strategies for wealth building.</p>
        </div>
        <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3">
          <i className="fas fa-plus"></i> New Note
        </button>
      </header>

      <div className="space-y-6">
        {data.journal.sort((a,b) => b.date.localeCompare(a.date)).map((entry) => (
          <div key={entry.id} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all relative">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{entry.date}</span>
              <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                 <button onClick={() => deleteEntry(entry.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4">{entry.title}</h3>
            <p className="text-slate-500 leading-relaxed font-medium whitespace-pre-wrap">{entry.content}</p>
          </div>
        ))}
        {data.journal.length === 0 && (
          <div className="py-40 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
             <p className="text-slate-300 font-black uppercase tracking-widest">Your financial journal is empty</p>
          </div>
        )}
      </div>

      <Modal title="Configure Journal Entry" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <input type="date" value={editingEntry?.date} onChange={e => setEditingEntry({...editingEntry!, date: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              <input placeholder="Entry Title..." value={editingEntry?.title} onChange={e => setEditingEntry({...editingEntry!, title: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-0 font-bold" />
           </div>
           <textarea rows={8} placeholder="Capture your financial thoughts..." value={editingEntry?.content} onChange={e => setEditingEntry({...editingEntry!, content: e.target.value})} className="w-full p-6 bg-slate-50 rounded-[2rem] border-0 font-medium leading-relaxed outline-none" />
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest text-xs">Verify & Archive Entry</button>
        </div>
      </Modal>
    </div>
  );
};

export default JournalPage;
