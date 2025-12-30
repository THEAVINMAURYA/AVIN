
import React, { useState, useMemo } from 'react';
import { AppData, Budget, TransactionType } from '../types';
import Modal from '../components/Modal';

interface BudgetPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const BudgetPage: React.FC<BudgetPageProps> = ({ data, onSave, showToast }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(null);

  const budgets = useMemo(() => {
    return data.budgets.filter(b => b.month === selectedMonth);
  }, [data.budgets, selectedMonth]);

  const budgetProgress = useMemo(() => {
    return budgets.map(b => {
      const spent = data.transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.category === b.category && t.date.startsWith(selectedMonth))
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = Math.min((spent / b.limit) * 100, 100);
      return { ...b, spent, pct };
    });
  }, [budgets, data.transactions, selectedMonth]);

  const openAdd = () => {
    setEditingBudget({
      id: '',
      month: selectedMonth,
      category: data.categories.expense[0] || 'General',
      limit: 0
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingBudget?.limit) return;
    const id = editingBudget.id || Date.now().toString();
    const finalBudget = { ...editingBudget, id } as Budget;
    
    let newList = [...data.budgets];
    const index = newList.findIndex(b => b.id === id);
    if (index >= 0) newList[index] = finalBudget;
    else newList.push(finalBudget);

    onSave({ ...data, budgets: newList });
    setIsModalOpen(false);
    showToast('Budget saved');
  };

  const deleteBudget = (id: string) => {
    if (confirm('Remove this budget limit?')) {
      onSave({ ...data, budgets: data.budgets.filter(b => b.id !== id) });
      showToast('Budget removed');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Monthly Budgets</h1>
          <p className="text-slate-500 mt-1">Plan your spending by categories and track limits.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-sm"
          />
          <button 
            onClick={openAdd}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Set Budget
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgetProgress.map((b) => (
          <div key={b.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${b.pct > 90 ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <i className="fas fa-layer-group"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{b.category}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Target</span>
                </div>
              </div>
              <button onClick={() => deleteBudget(b.id)} className="text-slate-200 hover:text-rose-500 transition-colors">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Spent so far</p>
                  <p className="text-2xl font-black text-slate-800">₹{b.spent.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Budget Limit</p>
                  <p className="text-lg font-bold text-slate-600">₹{b.limit.toLocaleString()}</p>
                </div>
              </div>

              <div className="relative pt-2">
                <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div 
                    className={`h-full transition-all duration-700 ease-out ${b.pct > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-200' : 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200'}`}
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  <span>Usage: {b.pct.toFixed(0)}%</span>
                  <span>{b.spent > b.limit ? 'Over Limit!' : 'Within limit'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {budgetProgress.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-3xl text-slate-200 mb-6">
              <i className="fas fa-clipboard-list"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-400">No budgets set for {selectedMonth}</h3>
            <p className="text-slate-300 mt-2">Start managing your category limits to save more.</p>
            <button onClick={openAdd} className="mt-8 text-indigo-600 font-bold hover:underline">Create First Budget Limit</button>
          </div>
        )}
      </div>

      <Modal 
        title="Set Category Budget" 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-500 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">Set Limit</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Month</label>
            <input 
              type="month" 
              value={editingBudget?.month} 
              onChange={(e) => setEditingBudget(prev => ({...prev, month: e.target.value}))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label>
            <select 
              value={editingBudget?.category} 
              onChange={(e) => setEditingBudget(prev => ({...prev, category: e.target.value}))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium"
            >
              {data.categories.expense.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Spending Limit</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
              <input 
                type="number" 
                value={editingBudget?.limit || ''} 
                onChange={(e) => setEditingBudget(prev => ({...prev, limit: parseFloat(e.target.value) || 0}))}
                className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-xl"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BudgetPage;
