import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from './contexts/AppContext';
import { SideNav } from './components/Layout/SideNav';
import { HelpModal } from './components/Layout/HelpModal';
import { useState, useEffect } from 'react';
import { Sun, Moon, Search, FileText, HelpCircle, Menu, X as CloseIcon, Lock } from 'lucide-react';
import { db, Note, LogNote, Diagram, LogAnalysis } from './lib/storage/db';
import { seedDatabase } from './lib/storage/seed';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import { SecurityModal } from './components/Security/SecurityModal';
import { SecurityGuideModal } from './components/Security/SecurityGuideModal';

const NOTES_PER_PAGE = 50;

export function AppLayout() {
  const { theme, toggleTheme, isSidebarCollapsed, toggleSidebar } = useAppContext();
  const { isModalOpen } = useSecurity();
  const navigate = useNavigate();
  const location = useLocation();

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSecurityGuide, setShowSecurityGuide] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Recent items for sidebar
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogNote[]>([]);
  const [recentDiagrams, setRecentDiagrams] = useState<Diagram[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<LogAnalysis[]>([]);

  // Determine active menu from URL
  const activeMenu = location.pathname.startsWith('/logs') || location.pathname.startsWith('/log-analysis')
    ? 'logs' 
    : location.pathname.startsWith('/diagrams') 
      ? 'diagrams' 
      : 'notes';

  // Load recent items
  useEffect(() => {
    // Seed database if empty
    seedDatabase().then((seeded) => {
      if (seeded) {
        console.log("Database seeded with sample data");
        // Trigger a reload of recent items after seeding
        loadRecentItems();
      }
    });

    loadRecentItems();
  }, [location]); // Reload when route changes

  const loadRecentItems = () => {
    db.notes
      .orderBy('updatedAt')
      .reverse()
      .limit(NOTES_PER_PAGE)
      .toArray()
      .then(setRecentNotes);
    db.logs
      .orderBy('updatedAt')
      .reverse()
      .limit(NOTES_PER_PAGE)
      .toArray()
      .then(setRecentLogs);
    db.diagrams
      .orderBy('updatedAt')
      .reverse()
      .limit(NOTES_PER_PAGE)
      .toArray()
      .then(setRecentDiagrams);
    db.analyses
      .orderBy('updatedAt')
      .reverse()
      .limit(NOTES_PER_PAGE)
      .toArray()
      .then(setRecentAnalyses);
  };

  // Get active tab ID from URL
  const getActiveTabId = () => {
    const match = location.pathname.match(/\/(notes|logs|diagrams)\/([^/]+)/);
    return match ? match[2] : null;
  };

  // Handle sidebar navigation
  const handleNavigate = (view: 'home' | 'notes' | 'logs' | 'diagrams' | 'log-analysis') => {
    if (view === 'home') navigate('/');
    else if (view === 'notes') navigate('/notes');
    else if (view === 'logs') navigate('/logs');
    else if (view === 'log-analysis') navigate('/log-analysis');
    else navigate('/diagrams');
  };

  // Handle menu change
  const handleMenuChange = (menu: 'notes' | 'logs' | 'diagrams') => {
    if (menu === 'notes') navigate('/notes');
    else if (menu === 'logs') navigate('/logs');
    else navigate('/diagrams');
  };

  // Handle item selection
  const handleSelectItem = (item: any) => {
    if (location.pathname.startsWith('/log-analysis')) {
      navigate(`/log-analysis/${item.id}`);
      return;
    }
    const type = activeMenu === 'notes' ? 'notes' : activeMenu === 'logs' ? 'logs' : 'diagrams';
    navigate(`/${type}/${item.id}`);
  };

  // Handle create item
  const handleCreateItem = async () => {
    const id = crypto.randomUUID();
    const title =
      activeMenu === 'notes'
        ? `New Note ${recentNotes.length + 1}`
        : activeMenu === 'logs'
          ? `New Log ${recentLogs.length + 1}`
          : `New Diagram ${recentDiagrams.length + 1}`;
    
    // Create base item
    const baseItem = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (location.pathname.startsWith('/log-analysis')) {
      // Navigate to base path to trigger reset in LogDashboardView
      // We use a small state or key change if needed, but LogDashboardView is now listening to location.key
      navigate(`/log-analysis`); 
      return;
    }

    if (activeMenu === 'notes') {
      await db.notes.add({ ...baseItem, content: '', tags: [] });
      navigate(`/notes/${id}`);
    } else if (activeMenu === 'logs') {
      await db.logs.add({ ...baseItem, content: '', tags: [] });
      navigate(`/logs/${id}`);
    } else {
      await db.diagrams.add({ 
        ...baseItem, 
        content: JSON.stringify({ nodes: [], edges: [] }) 
      });
      navigate(`/diagrams/${id}`);
    }
  };



  return (
    <div className="h-full w-full bg-bg-app text-text-primary flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border bg-[var(--color-bg-header)] flex items-center px-4 justify-between shadow-sm shrink-0 z-30">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:bg-bg-panel-hover rounded-lg transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => {
              navigate('/');
              setIsMobileMenuOpen(false);
            }}
          >
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base leading-none tracking-tight text-text-primary">
                Dev<span className="text-accent-primary">Pad</span>
              </span>
              <span className="hidden sm:inline text-[10px] text-text-muted font-medium mt-0.5">
                Your intelligent scratchpad
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => navigate(activeMenu === 'logs' ? '/logs?search=' : '/notes?search=')}
            title="Search"
            aria-label="Search"
            className="p-2 text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary rounded-lg transition-all"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSecurityGuide(true)}
            title="Security Guide"
            aria-label="Security Guide"
            className="hidden sm:flex p-2 text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary rounded-lg transition-all"
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:bg-bg-panel-hover rounded-lg transition-all"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            title="Help"
            aria-label="Help"
            className="hidden sm:flex p-2 text-text-secondary hover:bg-bg-panel-hover rounded-lg transition-all"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <SideNav
          activeView={location.pathname === '/' ? 'home' : location.pathname.startsWith('/log-analysis') ? 'log-analysis' : activeMenu}
          onNavigate={(view) => {
            handleNavigate(view);
            setIsMobileMenuOpen(false);
          }}
          activeMenu={activeMenu}
          onMenuChange={(menu) => {
              handleMenuChange(menu);
              setIsMobileMenuOpen(false);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          notes={
            location.pathname.startsWith('/log-analysis') 
              ? recentAnalyses 
              : activeMenu === 'notes' ? recentNotes : activeMenu === 'logs' ? recentLogs : recentDiagrams
          }
          activeTabId={getActiveTabId()}
          onSelectNote={(note) => {
              handleSelectItem(note);
              setIsMobileMenuOpen(false);
          }}
          onCreateNote={handleCreateItem}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onShowAll={() => {
              if (activeMenu === 'notes') navigate('/notes');
              else if (activeMenu === 'logs') navigate('/logs');
              else navigate('/diagrams');
              setIsMobileMenuOpen(false);
          }}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* Security Overlays */}
      <SecurityModal isOpen={isModalOpen} />
      <SecurityGuideModal isOpen={showSecurityGuide} onClose={() => setShowSecurityGuide(false)} />
    </div>
  );
}

import { ToastProvider } from './contexts/ToastContext';

// Keep App export for backwards compatibility
export function App() {
  return (
    <ToastProvider>
      <SecurityProvider>
        <AppLayout />
      </SecurityProvider>
    </ToastProvider>
  );
}