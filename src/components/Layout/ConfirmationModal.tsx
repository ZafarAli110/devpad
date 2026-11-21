import { AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-bg-element border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
            <AlertCircle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="p-4 bg-bg-app border-t border-white/10 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary transition-colors active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all transform active:scale-95 ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
