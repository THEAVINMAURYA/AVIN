import React, { useState, useMemo } from 'react';
import { AppData, Task } from '../types';
import Modal from '../components/Modal';

interface TaskPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
  search: string;
}

const TaskPage: React.FC<TaskPageProps> = ({ data, onSave, showToast, search }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);

  const filteredTasks = useMemo(() => {
    return (data.tasks || []).filter(t => 
      t.content.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      if (a.completed === b.completed) return b.dueDate.localeCompare(a.dueDate);
      return a.completed ? 1 : -1;
    });
  }, [data.tasks, search]);

  const toggleTask = (id: string) => {
    const newTasks = data.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    onSave({ ...data, tasks: newTasks });
    showToast('Task Status Updated');
  };

  const deleteTask = (id: string) => {
    if (confirm('Delete this task?')) {
      const newTasks = data.tasks.filter(t => t.id !== id);
      onSave({ ...data, tasks: newTasks });
      showToast('Task Removed');
    }
  };

  const handleSave = () => {
    if (!editingTask?.content) return;
    const task: Task = {
      id: editingTask.id || Date.now().toString(),
      content: editingTask.content,
      dueDate: editingTask.dueDate || new Date().toISOString().split('T')[0],
      priority: editingTask.priority || 'medium',
      completed: editingTask.completed || false
    };

    let newTasks = [...data.tasks];
    const idx = newTasks.findIndex(t => t.id === task.id);
    if (idx >= 0) newTasks[idx] = task;
    else newTasks.unshift(task);

    onSave({ ...data, tasks: newTasks });
    setIsModalOpen(false);
    showToast('Task Protocol Synchronized');
  };

  return (
    <div className="space-y-8 animate-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Task Matrix</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Operational Objectives</p>
        </div>
        <button onClick={() => { setEditingTask({ content: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium' }); setIsModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3">
          <i className="fas fa-plus"></i> New Objective
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map(task => (
          <div key={task.id} className={`bg-white p-6 rounded-[2rem] border transition-all flex items-center justify-between group ${task.completed ? 'opacity-60 border-slate-100' : 'border-slate-100 hover:border-indigo-200 shadow-sm'}`}>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => toggleTask(task.id)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-indigo-500'}`}
              >
                {task.completed && <i className="fas fa-check"></i>}
              </button>
              <div>
                <p className={`font-black text-slate-800 ${task.completed ? 'line-through' : ''}`}>{task.content}</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <i className="fas fa-calendar"></i> {task.dueDate}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-rose-50 text-rose-500' : task.priority === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingTask(task); setIsModalOpen(true); }} className="p-3 text-slate-300 hover:text-indigo-600"><i className="fas fa-pen"></i></button>
              <button onClick={() => deleteTask(task.id)} className="p-3 text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
            </div>
          </div>
        ))}
        {filteredTasks.length === 0 && (
          <div className="py-32 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
            <i className="fas fa-clipboard-check text-4xl text-slate-100 mb-4"></i>
            <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No pending objectives</p>
          </div>
        )}
      </div>

      <Modal title="Configure Objective" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Objective Content</label>
            <textarea 
              value={editingTask?.content} 
              onChange={e => setEditingTask({...editingTask!, content: e.target.value})} 
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold min-h-[120px]" 
              placeholder="What needs to be done?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Deadline</label>
              <input type="date" value={editingTask?.dueDate} onChange={e => setEditingTask({...editingTask!, dueDate: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Priority</label>
              <select value={editingTask?.priority} onChange={e => setEditingTask({...editingTask!, priority: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 uppercase tracking-widest">Sign Protocol</button>
        </div>
      </Modal>
    </div>
  );
};

export default TaskPage;