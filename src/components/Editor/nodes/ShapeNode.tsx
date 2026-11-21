import { memo } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import { Trash2 } from 'lucide-react';

export const ShapeNode = memo(({ data, id, selected }: any) => {
  const { label, shape = 'rectangle', color = '#3b82f6', onLabelChange, onDeleteNode } = data; // Default blue



  const handles = [
    { type: 'target', pos: Position.Top, id: 't', style: { top: -8 } },
    { type: 'source', pos: Position.Right, id: 'r', style: { right: -8 } },
    { type: 'source', pos: Position.Bottom, id: 'b', style: { bottom: -8 } },
    // Diamond (Decision) = Source (Output) for "No/Loop". Others = Target (Input)
    { type: shape === 'diamond' ? 'source' : 'target', pos: Position.Left, id: 'l', style: { left: -8 } },
  ];

  return (
    <div className="relative group w-full h-full min-w-[50px] min-h-[50px]">
       <NodeResizer 
            color={color} 
            isVisible={selected} 
            minWidth={50} 
            minHeight={50} 
        />

       {/* Handles - Offset to prevent interference */}
       {handles.map(h => (
           <Handle 
                key={h.id} 
                type={h.type as any} 
                position={h.pos} 
                id={h.id}
                style={{ 
                    ...h.style, 
                    width: 16, 
                    height: 16,
                    background: 'var(--color-text-secondary)',
                    border: '2px solid var(--color-bg-app)'
                }}
                className={`transition-opacity z-[100] !pointer-events-auto ${selected || 'group-hover:opacity-100 opacity-0'}`}
            />
       ))}

        {/* Delete Button */}
        {onDeleteNode && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(id);
                }}
                className="absolute -top-3 -right-3 p-1.5 bg-bg-panel border border-border rounded-full shadow-md text-text-muted hover:text-red-500 hover:border-red-500 opacity-0 group-hover:opacity-100 transition-all z-50 scale-75 hover:scale-100"
                title="Delete Node"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        )}

      {/* Shape Render */}
      <div className="w-full h-full relative flex items-center justify-center">
          {/* Background Layer */}
          <div className="absolute inset-0 z-0 pointer-events-none">
             {shape === 'diamond' ? (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible drop-shadow-sm">
                    <polygon 
                        points="50,0 100,50 50,100 0,50" 
                        fill={`${color}10`} 
                        stroke={color} 
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
             ) : (
                <div 
                    className={`w-full h-full border-2 shadow-sm transition-all ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
                    style={{ 
                        borderColor: color,
                        backgroundColor: `${color}10`,
                    }}
                />
             )}
          </div>

          {/* Content Layer */}
          <div className="z-10 relative px-2 max-w-full overflow-hidden">
            <input
                value={label}
                onChange={(e) => onLabelChange && onLabelChange(id, e.target.value)}
                className="bg-transparent text-center text-xs font-medium focus:outline-none text-text-primary w-full overflow-hidden text-ellipsis placeholder:text-text-muted/50"
                placeholder="Label"
                style={{ minWidth: '40px' }}
            />
          </div>
      </div>
    </div>
  );
});
