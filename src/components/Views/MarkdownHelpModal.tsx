import { X, Copy, Terminal, Type } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MarkdownHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarkdownHelpModal({ isOpen, onClose }: MarkdownHelpModalProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'format'>('code');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-panel/50">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span className="text-accent-primary">Markdown Guide</span>
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Essential syntax for your notes</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-element rounded-lg bg-transparent text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 gap-6">
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'code'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Code Blocks
          </button>
          <button
            onClick={() => setActiveTab('format')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'format'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Type className="w-4 h-4" />
            Formatting
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1 bg-bg-app/50">
          
          {activeTab === 'code' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-bold text-text-primary">Syntax Highlighting</h3>
                <p className="text-sm text-text-secondary">
                  Use triple backticks followed by the language name to create a highlighted code block.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <CodeExample 
                  title="JavaScript / TypeScript" 
                  code={`\`\`\`javascript
function hello() {
  console.log("World");
}
\`\`\``} 
                />
                <CodeExample 
                  title="SQL" 
                  code={`\`\`\`sql
SELECT * FROM users
WHERE id = 1;
\`\`\``} 
                />
                <CodeExample 
                  title="JSON" 
                  code={`\`\`\`json
{
  "key": "value"
}
\`\`\``} 
                />
                <CodeExample 
                  title="CSS" 
                  code={`\`\`\`css
.nav {
  color: blue;
}
\`\`\``} 
                />
                <CodeExample 
                  title="HTML" 
                  code={`\`\`\`html
<div>
  <h1>Hello</h1>
</div>
\`\`\``} 
                />
                 <CodeExample 
                  title="C#" 
                  code={`\`\`\`csharp
public void Hello() {
  Console.WriteLine("Hello");
}
\`\`\``} 
                />
              </div>
            </div>
          )}

          {activeTab === 'format' && (
            <div className="space-y-8">
              <Section title="Headers">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <code className="text-accent-primary"># Heading 1</code>
                  </div>
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <h1 className="text-xl font-bold">Heading 1</h1>
                  </div>
                  
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <code className="text-accent-primary">## Heading 2</code>
                  </div>
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <h2 className="text-lg font-bold">Heading 2</h2>
                  </div>
                </div>
              </Section>

              <Section title="Emphasis">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <code className="text-accent-primary">**Bold**</code>
                  </div>
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <strong>Bold</strong>
                  </div>
                  
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <code className="text-accent-primary">*Italic*</code>
                  </div>
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <em>Italic</em>
                  </div>
                </div>
              </Section>

              <Section title="Lists">
                 <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-bg-element rounded border border-border space-y-1">
                    <div className="text-accent-primary">- Item 1</div>
                    <div className="text-accent-primary">- Item 2</div>
                  </div>
                  <div className="p-3 bg-bg-element rounded border border-border">
                    <ul className="list-disc list-inside">
                      <li>Item 1</li>
                      <li>Item 2</li>
                    </ul>
                  </div>
                </div>
              </Section>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-bg-panel/50 text-xs text-text-muted text-center">
            Markdown is a lightweight markup language for creating formatted text using a plain-text editor.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider opacity-80">{title}</h3>
      {children}
    </div>
  );
}

function CodeExample({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-bg-element border border-border rounded-lg overflow-hidden flex flex-col group">
      <div className="px-3 py-2 bg-black/20 border-b border-border flex items-center justify-between">
        <span className="text-xs font-mono font-medium text-text-secondary">{title}</span>
        <button 
          onClick={handleCopy}
          className="text-text-muted hover:text-accent-primary transition-colors focus:outline-none"
          title="Copy"
        >
          {copied ? <span className="text-[10px] font-bold">Copied!</span> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="p-3 bg-bg-app/50 font-mono text-xs overflow-x-auto text-text-secondary">
        <pre>{code}</pre>
      </div>
    </div>
  );
}
