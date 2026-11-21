import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';

// Tab types
export interface Tab {
  id: string;
  title: string;
  type: 'note' | 'log' | 'diagram';
  isProtected?: boolean;
  isHidden?: boolean;
}

// Context value interface
interface AppContextValue {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Tabs
  noteTabs: Tab[];
  logTabs: Tab[];
  diagramTabs: Tab[];
  addTab: (tab: Tab) => void;
  closeTab: (id: string, type: 'note' | 'log' | 'diagram') => void;
  getActiveTabId: (type: 'note' | 'log' | 'diagram') => string | null;

  // Sidebar
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  
  // Editor Settings
  fontSize: number;
  setFontSize: (size: number) => void;
}

// Create context with undefined default
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Storage keys
const TABS_STORAGE_KEY = 'smart-notepad-tabs';
const SIDEBAR_STORAGE_KEY = 'smart-notepad-sidebar';

// Load tabs from localStorage
function loadTabsFromStorage(): { noteTabs: Tab[]; logTabs: Tab[]; diagramTabs: Tab[] } {
  if (typeof window === 'undefined') return { noteTabs: [], logTabs: [], diagramTabs: [] };
  try {
    const stored = localStorage.getItem(TABS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        noteTabs: Array.isArray(parsed.noteTabs) ? parsed.noteTabs.slice(0, 10) : [],
        logTabs: Array.isArray(parsed.logTabs) ? parsed.logTabs.slice(0, 10) : [],
        diagramTabs: Array.isArray(parsed.diagramTabs) ? parsed.diagramTabs.slice(0, 10) : [],
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { noteTabs: [], logTabs: [], diagramTabs: [] };
}

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  // Tabs state
  const [noteTabs, setNoteTabs] = useState<Tab[]>(() => loadTabsFromStorage().noteTabs);
  const [logTabs, setLogTabs] = useState<Tab[]>(() => loadTabsFromStorage().logTabs);
  const [diagramTabs, setDiagramTabs] = useState<Tab[]>(() => loadTabsFromStorage().diagramTabs);

  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  // Persist tabs to localStorage
  useEffect(() => {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ noteTabs, logTabs, diagramTabs }));
  }, [noteTabs, logTabs, diagramTabs]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Add tab (VS Code style - add at end if not exists, don't reorder)
  const addTab = useCallback((tab: Tab) => {
    let setter: React.Dispatch<React.SetStateAction<Tab[]>>;
    if (tab.type === 'note') setter = setNoteTabs;
    else if (tab.type === 'log') setter = setLogTabs;
    else setter = setDiagramTabs;

    setter((prev) => {
      // If tab already exists, just update its title (don't reorder)
      const existingIndex = prev.findIndex((t) => t.id === tab.id);
      if (existingIndex !== -1) {
        // Update title and status flags if changed, keep position
        const updated = [...prev];
        updated[existingIndex] = { 
          ...updated[existingIndex], 
          title: tab.title,
          isProtected: tab.isProtected,
          isHidden: tab.isHidden
        };
        return updated;
      }
      // Add new tab at the end, keep max 10 tabs
      return [...prev, tab].slice(-10);
    });
  }, []);

  // Close tab
  const closeTab = useCallback((id: string, type: 'note' | 'log' | 'diagram') => {
    let setter: React.Dispatch<React.SetStateAction<Tab[]>>;
    if (type === 'note') setter = setNoteTabs;
    else if (type === 'log') setter = setLogTabs;
    else setter = setDiagramTabs;

    setter((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Get active tab ID (first tab or null)
  const getActiveTabId = useCallback(
    (type: 'note' | 'log' | 'diagram') => {
      let tabs: Tab[];
      if (type === 'note') tabs = noteTabs;
      else if (type === 'log') tabs = logTabs;
      else tabs = diagramTabs;
      
      return tabs.length > 0 ? tabs[0].id : null;
    },
    [noteTabs, logTabs, diagramTabs]
  );

  // Font Size state
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 14;
    const stored = localStorage.getItem('smart-notepad-font-size');
    return stored ? parseInt(stored, 10) : 14;
  });

  // Persist font size
  useEffect(() => {
    localStorage.setItem('smart-notepad-font-size', String(fontSize));
  }, [fontSize]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const value: AppContextValue = {
    theme,
    toggleTheme,
    noteTabs,
    logTabs,
    diagramTabs,
    addTab,
    closeTab,
    getActiveTabId,
    isSidebarCollapsed,
    toggleSidebar,
    fontSize,
    setFontSize,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
