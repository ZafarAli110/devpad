import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';

interface UploadOverlayProps {
  onFilesSelected: (files: File[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function UploadOverlay({ onFilesSelected, onCancel, isOpen }: UploadOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center bg-bg-app/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className={`
          w-full max-w-xl mx-4 p-8 rounded-3xl border-2 border-dashed
          flex flex-col items-center justify-center text-center space-y-6
          transition-all duration-300 transform scale-100
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10 scale-105 shadow-2xl shadow-blue-500/20' 
            : 'border-border bg-bg-panel shadow-xl'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-bg-panel-hover text-text-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className={`
          p-6 rounded-full transition-colors duration-300
          ${isDragging ? 'bg-blue-500 text-white' : 'bg-bg-element text-blue-500'}
        `}>
          <UploadCloud className="w-12 h-12" />
        </div>

        <div>
          <h3 className="text-2xl font-black text-text-primary mb-2">
            Upload Log Files
          </h3>
          <p className="text-text-secondary max-w-sm mx-auto leading-relaxed">
            Drag and drop multiple log files here to merge them into a single timeline.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".log,.txt,.json"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Browse Files
          </button>
          <p className="text-xs text-text-muted">
            Supports .log, .txt, and .json
          </p>
        </div>
      </div>
    </div>
  );
}
