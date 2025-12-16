import React from 'react';
import { X, FileText, CheckCircle, Info } from 'lucide-react';
import { ModalConfig } from '../types';

interface ModalProps {
  config: ModalConfig;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ config, onClose }) => {
  if (!config.isOpen) return null;

  let Icon = Info;
  let headerColor = 'bg-indigo-600';

  if (config.type === 'review') {
    Icon = CheckCircle;
    headerColor = 'bg-emerald-600';
  } else if (config.type === 'material') {
    Icon = FileText;
    headerColor = 'bg-violet-600';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200 border border-white/10 ring-1 ring-black/50">
        
        <div className={`${headerColor} px-6 py-4 flex items-center justify-between text-white border-b border-white/5`}>
          <div className="flex items-center gap-2">
            <Icon size={20} className="text-white/90" />
            <h3 className="font-semibold text-lg tracking-wide">{config.title}</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="prose prose-sm prose-invert max-w-none text-slate-300">
             {config.content.split('\n').map((line, i) => (
               <p key={i} className="mb-2 leading-relaxed font-light">{line}</p>
             ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#020617]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1e293b] border border-white/10 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-[#334155] transition-colors shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};