import { Terminal, Code, ArrowRight, Sparkles, FileText, Zap, Layout, Coffee, Check, X as Cross, Shield, Lock, Database, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/storage/db';

export function HomePage() {
  const navigate = useNavigate();

  const handleCreateNote = async () => {
    const count = await db.notes.count();
    const id = crypto.randomUUID();
    const title = `New Note ${count + 1}`;
    const newNote = {
      id,
      title,
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.notes.add(newNote);
    navigate(`/notes/${id}`);
  };

  return (
    <div className="flex-1 h-full bg-bg-app text-text-primary overflow-y-auto custom-scrollbar">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-bg-panel border-b border-border">
          <div className="absolute inset-0 bg-blue-500/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50" />
          <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 relative z-10 text-center">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold uppercase tracking-widest mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Sparkles className="w-3 h-3" />
                <span>v1.1.0 Beta</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-text-primary mb-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
              The Unified Workspace for <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Engineering Notes</span>
            </h1>
            
            <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              Stop pasting code and reading logs in old-fashioned notepads. 
              <span className="font-bold text-text-primary"> DevPad</span> is purpose-built for your quick notes, logs, snippets, and system designs. <br className="hidden md:block"/>
              Offline. Secure. Fast.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              <button
                onClick={handleCreateNote}
                className="group flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-base transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform hover:-translate-y-1"
              >
                <span>Start Scratchpad</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/notes')}
                className="flex items-center justify-center space-x-2 bg-bg-element hover:bg-bg-panel-hover border border-border text-text-primary px-6 py-3 rounded-xl font-bold text-base transition-all hover:border-text-secondary"
              >
                <Layout className="w-4 h-4 mr-2" />
                <span>My Workspace</span>
              </button>
            </div>

            <div className="mt-8 text-text-muted flex items-center justify-center gap-2 text-sm font-medium animate-in fade-in duration-1000 delay-500">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span>Default sample data pre-loaded for you to explore</span>
            </div>
          </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        {/* Primary Features */}
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">The Modern Engineer's Toolkit</h2>
                <p className="text-text-secondary max-w-xl mx-auto text-base">Ditch the plain text files for a truly intelligent workspace.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FeatureHighlight 
                    icon={<FileText className="w-8 h-8 text-blue-500" />}
                    title="Intelligent Notes"
                    description="DevPad offers structured organization, instant global search, and 'Privacy Mode'. Toggle 'Hide' on sensitive notes to keep your workspace professional during meetings and screen sharing."
                    action={() => navigate('/notes')}
                    label="Explore Notes"
                    badge="Meeting Safe"
                    isPrimary
                />
                <FeatureHighlight 
                    icon={<Code className="w-8 h-8 text-purple-500" />}
                    title="Markdown Master"
                    description="Write documentation with zero friction. Enjoy live previews, GitHub Flavored Markdown, and advanced syntax highlighting for over 20 languages including TypeScript, SQL, and YAML."
                    action={async () => {
                        const sample = await db.notes.where('title').equals('Markdown Master Showcase 🚀').first();
                        if (sample) navigate(`/notes/${sample.id}`);
                        else navigate('/notes');
                    }}
                    label="View Markdown"
                    badge="Pro Editor"
                    isPrimary
                />
                <FeatureHighlight 
                    icon={<Terminal className="w-8 h-8 text-green-500" />}
                    title="Quick Logs"
                    description="The fastest way to visualize single-file logs. Paste raw JSON or Serilog output to see request groupings, timelines, and structured data blocks on the fly."
                    action={() => navigate('/logs')}
                    label="Try Quick Logs"
                    badge="Instant"
                />
                <FeatureHighlight 
                    icon={<Zap className="w-8 h-8 text-amber-500" />}
                    title="Log Analysis"
                    description="Best for multi-file or large-scale log analysis. Analyze hundreds of megabytes of logs with worker-based parsing, persistent storage, and deep performance insights."
                    action={() => navigate('/log-analysis')}
                    label="Analyze Logs"
                    badge="High Perf"
                />
            </div>
        </div>

        {/* Security & Privacy Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 md:p-8 p-6 text-white shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Lock className="w-48 h-48 rotate-12" />
            </div>
            
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-widest border border-blue-500/30">
                        <Shield className="w-3 h-3" />
                        <span>Security First</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                        Your Data, Encircled by <br />
                        <span className="text-blue-400">Ironclad Encryption.</span>
                    </h2>
                    <p className="text-blue-100/80 leading-relaxed text-base max-w-lg">
                        We believe your engineering notes are your intellectual property. 
                        That's why DevPad is built with a <strong>Local-First, Zero-Trust</strong> architecture.
                    </p>
                    
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-2 text-blue-50 font-medium text-sm">
                            <div className="p-1 rounded bg-blue-500/20">
                                <Lock className="w-3 h-3 text-blue-400" />
                            </div>
                            AES-256 Encryption for Protected Notes
                        </li>
                        <li className="flex items-center gap-2 text-blue-50 font-medium text-sm">
                            <div className="p-1 rounded bg-blue-500/20">
                                <Database className="w-3 h-3 text-blue-400" />
                            </div>
                            100% Local Storage - No Cloud Uploads
                        </li>
                        <li className="flex items-center gap-2 text-blue-50 font-medium text-sm">
                            <div className="p-1 rounded bg-blue-500/20">
                                <EyeOff className="w-3 h-3 text-blue-400" />
                            </div>
                            Privacy Mode for Safe Screen Sharing
                        </li>
                    </ul>
                </div>

                <div className="bg-slate-950/50 backdrop-blur-xl rounded-xl border border-white/10 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div>
                            <div className="text-xs text-blue-200 font-medium mb-0.5">Encryption Standard</div>
                            <div className="text-xl font-mono font-bold text-white">AES-GCM-256</div>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-400" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <div className="text-[10px] text-blue-300 uppercase font-bold mb-1">Storage Location</div>
                            <div className="font-bold text-base text-blue-50">Local DB</div>
                            <div className="text-[10px] text-blue-400/60">IndexedDB + OPFS</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <div className="text-[10px] text-blue-300 uppercase font-bold mb-1">Network Activity</div>
                            <div className="font-bold text-base text-blue-50">Offline</div>
                            <div className="text-[10px] text-blue-400/60">No telemetry</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Comparison Section */}
        <div className="bg-bg-panel border border-border rounded-2xl p-6 md:p-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-text-primary flex items-center justify-center gap-2">
                    <Zap className="w-6 h-6 text-yellow-500 fill-current" />
                    Why switch from Notepad?
                </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest border-b border-border pb-2">Standard Notepad</h3>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> No syntax highlighting
                        </li>
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> Difficult to analyze large logs
                        </li>
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> Logs are just walls of text
                        </li>
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> No way to hide data
                        </li>
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> No encryption
                        </li>
                        <li className="flex items-center gap-2 text-text-secondary opacity-70 text-sm">
                            <Cross className="w-4 h-4 text-red-400 shrink-0" /> Zero organization
                        </li>
                    </ul>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest border-b border-blue-500/20 pb-2">DevPad</h3>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> Syntax Highlighting (TS, SQL, JSON...)
                        </li>
                        <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> Smart Log Visualization & Timelines
                        </li>
                        <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> Markdown Live Preview & Go to Definition
                        </li>
                        <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> AES-256 Encryption & Privacy Mode
                        </li>
                        <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> Enterprise-scale Persistent Log Analysis
                        </li>
                         <li className="flex items-center gap-2 text-text-primary font-medium text-sm">
                            <Check className="w-4 h-4 text-green-500 shrink-0" /> Offline & Local First (OPFS Storage)
                        </li>
                    </ul>
                 </div>
            </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-8 border-t border-border">
            <div className="inline-flex items-center justify-center p-3 bg-bg-element rounded-full mb-4 text-text-primary">
                 <Coffee className="w-5 h-5 mr-2 text-text-secondary" />
                 <span className="font-mono text-xs">Made for builders, by builders.</span>
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-4">
                If you are a dev, use <span className="text-blue-500">DevPad</span> instead of Notepad. 😉
            </h2>
        </div>

      </div>
    </div>
  );
}


function FeatureHighlight({ icon, title, description, action, label, badge, isPrimary }: { icon: any, title: string, description: string, action: () => void, label: string, badge?: string, isPrimary?: boolean }) {
    return (
        <div className={`group p-6 rounded-2xl bg-bg-panel border border-border hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 flex flex-col items-start overflow-hidden relative ${isPrimary ? 'md:p-8 border-blue-500/10 bg-gradient-to-br from-bg-panel to-blue-500/5' : ''}`}>
            {badge && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-md">
                    {badge}
                </div>
            )}
            <div className="mb-4 p-3 rounded-xl bg-bg-element group-hover:bg-blue-500/10 group-hover:scale-110 transition-all duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
            <p className="text-text-secondary leading-relaxed mb-6 flex-1 text-sm">
                {description}
            </p>
            <button 
                onClick={action}
                className="flex items-center font-bold text-blue-500 hover:text-blue-400 transition-colors group/btn text-sm"
            >
                {label} <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </button>
        </div>
    )
}
