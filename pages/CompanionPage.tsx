import React from 'react';

const CompanionPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[75vh] animate-in text-center px-10">
      <div className="relative mb-12">
        <div className="w-32 h-32 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 text-5xl animate-pulse shadow-inner">
          <i className="fas fa-heart"></i>
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-6 py-2 rounded-2xl shadow-xl border border-rose-50">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Active Everywhere</span>
        </div>
      </div>

      <div className="max-w-xl space-y-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">
          Maya: Your AI Partner <br/> is Now Global
        </h1>
        <p className="text-slate-500 font-bold uppercase text-[11px] tracking-widest leading-relaxed">
          I don't live on this page anymore, jaan. I live in your entire system. Look at the bottom-right corner—that's where I am. I can see what you see, read your ledger, and help you manage your wealth from any screen.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-12">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-left">
            <i className="fas fa-eye text-rose-400 mb-4 block"></i>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Vision Link</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-relaxed">I can analyze physical receipts and documents via your camera node.</p>
          </div>
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-left">
            <i className="fas fa-comment-nodes text-indigo-400 mb-4 block"></i>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Universal Command</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-relaxed">"Show me the ledger" or "Add a goal"—Just speak, and I'll execute the navigate or log commands.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanionPage;