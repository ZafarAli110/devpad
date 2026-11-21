import { X, FileText, Search, Terminal, Shield, Zap } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border bg-bg-app">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Welcome to DevPad</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 text-text-secondary">
          <section>
            <p className="text-lg leading-relaxed text-text-primary">
              A better notepad for{' '}
              <span className="text-blue-500 font-semibold">Engineers & DevOps</span>. Quick notes, log visualization, 
              and system design in one private, offline-ready app.
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-blue-500" />}
              title="Log Analysis"
              description="Analyze enterprise-scale production logs. Features persistent storage (OPFS), worker-based parsing, and high-performance insights."
            />
            <FeatureCard
              icon={<Terminal className="w-5 h-5 text-green-500" />}
              title="Quick Log Timelines"
              description="Paste a single log file directly into your notes for instant visualization. Group by RequestID and track timelines on the fly."
            />
            <FeatureCard
              icon={<FileText className="w-5 h-5 text-purple-500" />}
              title="Markdown Support"
              description="Write beautiful documentation with full Markdown support. Tables, code blocks, lists, and more."
            />
            <FeatureCard
              icon={<Search className="w-5 h-5 text-blue-500" />}
              title="System Diagrams & SQL ERD"
              description="Map out architecture, flows, and database structures with the integrated diagram editor."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 text-orange-500" />}
              title="Secure & Private"
              description="100% Offline. Hide notes for privacy or Encrypt them for maximum security. Your keys, your data."
            />
          </div>

          <section className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl p-4">
            <h3 className="text-sm font-bold text-accent-primary uppercase tracking-widest mb-2">
              Getting Started
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>
                Click <strong>New Entry</strong> to start a scratchpad.
              </li>
              <li>Paste any text or log file. The viewer on the right adapts automatically.</li>
              <li>Select your language from the top toolbar for syntax highlighting.</li>
              <li>
                Large files (&gt;50MB) are automatically saved to OPFS (Origin Private File System)
                to keep the app fast.
              </li>
            </ul>
          </section>
        </div>

        <div className="p-4 border-t border-border bg-bg-app flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex space-x-4 p-4 rounded-xl bg-bg-element border border-border hover:border-text-muted transition-colors">
      <div className="mt-1">{icon}</div>
      <div>
        <h3 className="font-bold text-text-primary mb-1">{title}</h3>
        <p className="text-sm text-text-secondary leading-snug">{description}</p>
      </div>
    </div>
  );
}
