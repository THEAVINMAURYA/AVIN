
import React, { useState } from 'react';
import { AppData, Goal } from '../types';
import Modal from '../components/Modal';

interface GoalsPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const GoalsPage: React.FC<GoalsPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<Goal> | null>(null);

  const openAdd = () => {
    setEditingGoal({ id: Date.now().toString(), name: '', target: 0, current: 0 });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingGoal?.name || !editingGoal?.target) return;
    const newList = [...data.goals];
    const index = newList.findIndex(g => g.id === editingGoal.id);
    if (index >= 0) newList[index] = editingGoal as Goal;
    else newList.push(editingGoal as Goal);

    onSave({ ...data, goals: newList });
    setIsModalOpen(false);
    showToast('Target Set');
  };

  const deleteGoal = (id: string) => {
    if (confirm('Abandon this goal?')) {
      onSave({ ...data, goals: data.goals.filter(g => g.id !== id) });
      showToast('Goal Removed');
    }
  };

  const exportCSV = () => {
    const headers = ['Goal', 'Target', 'Current', 'Progress %'];
    const rows = data.goals.map(g => [g.name, g.target, g.current, ((g.current/g.target)*100).toFixed(2)]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "wealth_targets.csv");
    link.click();
    showToast('Goals Exported');
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Wealth Targets</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Strategic milestones for financial independence.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-50"><i className="fas fa-file-csv mr-2"></i> Export</button>
          <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3"><i className="fas fa-bullseye"></i> Define GOLA</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {data.goals.map((goal) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100);
          return (
            <div key={goal.id} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">{goal.name}</h3>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Progress Monitoring</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { setEditingGoal(goal); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                   <button onClick={() => deleteGoal(goal.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash"></i></button>
                </div>
              </div>
              
              <div className="h-6 w-full bg-slate-50 rounded-full overflow-hidden mb-8 border border-slate-50 relative">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-1000 ease-out shadow-lg shadow-indigo-100" 
                  style={{ width: `${progress}%` }}
                ></div>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest mix-blend-difference">{progress.toFixed(0)}% COMPLETED</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Accrual</p>
                   <p className="text-xl font-black text-slate-900">₹{goal.current.toLocaleString()}</p>
                </div>
                <div className="space-y-1 text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terminal Target</p>
                   <p className="text-xl font-black text-slate-400">₹{goal.target.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal title="Goal Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">Goal Designation</label>
              <input placeholder="e.g. Retirement Fund" value={editingGoal?.name} onChange={e => setEditingGoal({...editingGoal!, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Target (₹)</label>
                <input type="number" placeholder="10,00,000" value={editingGoal?.target || ''} onChange={e => setEditingGoal({...editingGoal!, target: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Initial Seed (₹)</label>
                <input type="number" placeholder="0" value={editingGoal?.current || ''} onChange={e => setEditingGoal({...editingGoal!, current: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest">Establish Target</button>
        </div>
      </Modal>
    </div>
  );
};

export default GoalsPage;
