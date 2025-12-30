
import React from 'react';

/**
 * Reusable Modal component for the WealthTrack Pro Ecosystem.
 */

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode; 
  footer?: React.ReactNode; 
  maxWidth?: string;
}

// Fix: Export Modal as default for external consumption
const Modal: React.FC<ModalProps> = ({ 
  title, isOpen, onClose, children, footer, maxWidth = 'max-w-2xl' 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative w-full ${maxWidth} bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in`}>
        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-slate-100 text-slate-400 transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="px-8 py-8 max-h-[75vh] overflow-y-auto no-scrollbar">{children}</div>
        {footer && <div className="px-8 py-5 border-t border-slate-50 bg-slate-50/20 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
