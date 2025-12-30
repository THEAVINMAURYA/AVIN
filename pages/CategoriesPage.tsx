
import React, { useState } from 'react';
import { AppData } from '../types';

const CategoriesPage: React.FC<{ data: AppData; onSave: (d: AppData) => void; showToast: (m: string) => void }> = ({ data, onSave, showToast }) => {
  const [newCat, setNewCat] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const add = () => {
    if (!newCat) return;
    const cats = { ...data.categories };
    if (cats[type].includes(newCat)) return showToast('Exists');
    cats[type].push(newCat);
    onSave({ ...data, categories: cats });
    setNewCat('');
    showToast('Category Added');
  };

  const remove = (cat: string, t: 'income' | 'expense') => {
    const cats = { ...data.categories };
    cats[t] = cats[t].filter(c => c !== cat);
    onSave({ ...data, categories: cats });
    showToast('Removed');
  };

  return (
    <div className="space-y-12 animate-in max-w-4xl">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Categories Manager</h1>
        <p className="text-slate-400 font-medium">Customize your financial taxonomy</p>
      </header>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex gap-4 mb-8">
          <select value={type} onChange={e => setType(e.target.value as any)} className="bg-slate-50 px-6 py-4 rounded-2xl font-bold border-0 text-sm">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input 
            value={newCat} 
            onChange={e => setNewCat(e.target.value)} 
            placeholder="New category name..." 
            className="flex-1 bg-slate-50 px-6 py-4 rounded-2xl font-bold border-0 text-sm"
          />
          <button onClick={add} className="bg-indigo-600 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest">Add</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <i className="fas fa-arrow-down text-emerald-500"></i> Income Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.categories.income.map(c => (
                <div key={c} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                  {c} <button onClick={() => remove(c, 'income')} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times"></i></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <i className="fas fa-arrow-up text-rose-500"></i> Expense Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.categories.expense.map(c => (
                <div key={c} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                  {c} <button onClick={() => remove(c, 'expense')} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times"></i></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;
