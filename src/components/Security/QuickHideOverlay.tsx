import React from 'react';
import { Eye, ShieldAlert } from 'lucide-react';

interface QuickHideOverlayProps {
  active: boolean;
  onResume: () => void;
}

export const QuickHideOverlay: React.FC<QuickHideOverlayProps> = ({ active, onResume }) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-bg-app flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="bg-accent-primary/10 p-4 rounded-full">
            <ShieldAlert className="w-12 h-12 text-accent-primary animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text-primary">Content Protected</h1>
          <p className="text-text-secondary italic">
            "Thinking is the hardest work there is, which is probably the reason why so few engage in it."
          </p>
          <p className="text-text-muted text-sm pt-4">
            Your session is hidden. Click the button below to resume.
          </p>
        </div>
        <button
          onClick={onResume}
          className="inline-flex items-center space-x-2 bg-accent-primary hover:bg-accent-primary-hover text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-accent-primary/20 transition-all transform hover:scale-105 active:scale-95"
        >
          <Eye className="w-5 h-5" />
          <span>Resume Session</span>
        </button>
      </div>
    </div>
  );
};
