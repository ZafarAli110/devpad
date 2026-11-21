import { Editor, OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { registerPickBasic } from '../../lib/languages/pickbasic';

interface MonacoWrapperProps {
  content: string;
  language: string;
  onChange: (value: string | undefined) => void;
  theme?: 'light' | 'dark';
  fontSize?: number;
}

export function MonacoWrapper(props: MonacoWrapperProps) {
  const { content, language, onChange, theme = 'dark', fontSize = 14 } = props;
  const editorRef = useRef<any>(null);

  // Ensure language is registered when component mounts or language changes
  useEffect(() => {
    registerPickBasic();
  }, [language]);

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;
    // Initial registration
    registerPickBasic();
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Auto-save logic could go here or in parent
    }, 1000);
    return () => clearTimeout(timeout);
  }, [content]);

  // Drag functionality for command palette
  useEffect(() => {
    let draggedEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const widget = document.querySelector('.quick-input-widget') as HTMLElement;
      
      if (!widget || !widget.contains(target)) return;
      if (widget.getAttribute('aria-hidden') === 'true') return;
      
      const rect = widget.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      
      if (mouseY > 30) return;

      e.preventDefault();
      draggedEl = widget;
      widget.classList.add('user-dragged');
      
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      
      // Lock position immediately
      widget.style.position = 'fixed';
      widget.style.setProperty('left', `${startLeft}px`, 'important');
      widget.style.setProperty('top', `${startTop}px`, 'important');
      // transform: none is handled by CSS class .user-dragged
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!draggedEl) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      draggedEl.style.setProperty('left', `${startLeft + dx}px`, 'important');
      draggedEl.style.setProperty('top', `${startTop + dy}px`, 'important');
    };

    const onMouseUp = () => {
      draggedEl = null;
      // We don't remove 'user-dragged' so it stays where put until closed?
      // Or we keep it until next open? Monaco destroys/hides it.
    };

    // We need to attach listeners globally because the widget might be appended to body or overflow container
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="monaco-container" style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Editor
        height="100%"
        language={language}
        value={content}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: fontSize,
          automaticLayout: true,
          fixedOverflowWidgets: false,
          wordWrap: 'on',
          accessibilitySupport: 'off',
          scrollBeyondLastLine: false,
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
          }
        }}
      />
    </div>
  );
}