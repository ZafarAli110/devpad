import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2, Plus } from 'lucide-react';

export const TableNode = memo(({ data, id }: any) => {
  const { title, fields, onFieldChange, onAddField, onDeleteField, onTitleChange, onDeleteNode } = data;

  return (
    <div className="bg-bg-panel border border-border rounded-lg shadow-lg min-w-[200px] overflow-visible relative group/table">
        
        {/* Delete Button (Visible on Hover) */}
        {onDeleteNode && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(id);
                }}
                className="absolute -top-3 -right-3 p-1.5 bg-bg-panel border border-border rounded-full shadow-md text-text-muted hover:text-red-500 hover:border-red-500 opacity-0 group-hover/table:opacity-100 transition-all z-10 scale-75 hover:scale-100"
                title="Delete Table"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        )}
        
      {/* Handles for connecting tables */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-accent-primary border-2 border-white" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-accent-primary border-2 border-white" />

      {/* Table Header */}
      <div className="bg-accent-primary/10 border-b border-border p-2 rounded-t-lg">
        <input
          className="w-full bg-transparent font-bold text-text-primary text-sm focus:outline-none placeholder:text-text-muted"
          value={title}
          onChange={(e) => onTitleChange(id, e.target.value)}
          placeholder="Table Name"
        />
      </div>

      {/* Fields */}
      <div className="p-2 space-y-2">
        {fields.map((field: any, index: number) => (
          <div key={index} className="flex gap-2 items-center text-xs group">
             {/* Key / Name */}
            <input
              className="flex-1 bg-transparent border-b border-transparent focus:border-accent-primary focus:outline-none text-text-primary min-w-[60px]"
              value={field.name}
              onChange={(e) => onFieldChange(id, index, 'name', e.target.value)}
              placeholder="id"
            />
            {/* Type */}
            <input
              className="w-20 bg-transparent text-text-secondary text-right border-b border-transparent focus:border-accent-primary focus:outline-none"
              value={field.type}
              onChange={(e) => onFieldChange(id, index, 'type', e.target.value)}
              placeholder="int"
            />
            {/* Delete Field */}
            <button 
                onClick={() => onDeleteField(id, index)}
                className="p-1 text-text-muted hover:text-red-500 hover:bg-bg-element rounded transition-colors ml-auto"
                title="Delete Field"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add Field Button */}
        <button
          onClick={() => onAddField(id)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs text-text-muted hover:text-accent-primary hover:bg-accent-primary/5 rounded border border-transparent hover:border-accent-primary/20 transition-all"
        >
          <Plus className="w-3 h-3" />
          <span>Add Field</span>
        </button>
      </div>
    </div>
  );
});
