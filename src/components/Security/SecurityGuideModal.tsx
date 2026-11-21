import { X, Shield, Eye, Lock, Check } from 'lucide-react';

interface SecurityGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityGuideModal({ isOpen, onClose }: SecurityGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-panel/50">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent-primary" />
              <span className="text-accent-primary">Security Guide</span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Understanding Privacy & Protection</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-element rounded-lg bg-transparent text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1 bg-bg-app/50 space-y-8">
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Hidden Notes */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-purple-500">
                        <Eye className="w-5 h-5" />
                        <h4 className="font-bold">Hidden Notes (Privacy)</h4>
                    </div>
                    <div className="bg-bg-element p-5 rounded-xl border border-border h-full flex flex-col">
                        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                            Designed for temporary privacy when working in public spaces or screen sharing.
                        </p>
                        <ul className="space-y-3 text-sm text-text-secondary flex-1">
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-purple-500 shrink-0" />
                                <span><strong className="text-text-primary">Action:</strong> Obscures content on screen.</span>
                            </li>
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-purple-500 shrink-0" />
                                <span><strong className="text-text-primary">Scope:</strong> Available for ALL notes.</span>
                            </li>
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-purple-500 shrink-0" />
                                <span><strong className="text-text-primary">Security:</strong> <span className="text-orange-500 font-bold">Low</span>. No password needed.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Protected Notes */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-purple-500">
                        <Lock className="w-5 h-5" />
                        <h4 className="font-bold">Protected Notes (Encryption)</h4>
                    </div>
                    <div className="bg-bg-element p-5 rounded-xl border border-border h-full flex flex-col">
                        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                            Military-grade encryption for passwords, API keys, and sensitive text.
                        </p>
                        <ul className="space-y-3 text-sm text-text-secondary flex-1">
                             <li className="flex gap-2">
                                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                                <span><strong className="text-text-primary">Action:</strong> Encrypts in database.</span>
                            </li>
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                                <span><strong className="text-text-primary">Scope:</strong> Plain Text notes only.</span>
                            </li>
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                                <span><strong className="text-text-primary">Security:</strong> <span className="text-green-500 font-bold">High</span>. Requires password.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* How to use */}
            <div className="space-y-4 pt-4">
                <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider opacity-80 border-b border-border pb-2">
                    How to Protect a Note
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-bg-panel p-4 rounded-lg border border-border/50 text-center space-y-2">
                        <div className="bg-blue-500/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto text-blue-500 font-bold">1</div>
                        <p className="text-sm font-medium">Create Plain Text Note</p>
                        <p className="text-xs text-text-muted">Select "Plain Text" language.</p>
                    </div>
                    <div className="bg-bg-panel p-4 rounded-lg border border-border/50 text-center space-y-2">
                         <div className="bg-blue-500/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto text-blue-500 font-bold">2</div>
                        <p className="text-sm font-medium">Click Protect</p>
                        <p className="text-xs text-text-muted">Click the <Lock className="w-3 h-3 inline mx-1" /> icon in toolbar.</p>
                    </div>
                    <div className="bg-bg-panel p-4 rounded-lg border border-border/50 text-center space-y-2">
                         <div className="bg-blue-500/10 w-10 h-10 rounded-full flex items-center justify-center mx-auto text-blue-500 font-bold">3</div>
                        <p className="text-sm font-medium">Set Password</p>
                        <p className="text-xs text-text-muted">Safe & irrecoverable without key!</p>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
