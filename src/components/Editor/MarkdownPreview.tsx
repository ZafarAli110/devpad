import { parseMarkdown } from '../../lib/utils/markdownParser';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = parseMarkdown(content);
  
  return (
    <div className="flex-1 h-full overflow-y-auto bg-bg-app p-8 custom-scrollbar">
      <div 
        className="max-w-4xl mx-auto markdown-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
