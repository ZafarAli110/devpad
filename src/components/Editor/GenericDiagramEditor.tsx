import { useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState, 
    addEdge, 
    Connection, 
    MarkerType,
    ConnectionLineType,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TableNode } from './nodes/TableNode';
import { ShapeNode } from './nodes/ShapeNode';
import DeletableEdge from './nodes/DeletableEdge';
import { Save, Trash2, ArrowLeft, Download, Database, Square, Circle, Diamond, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../Layout/ConfirmationModal';

interface GenericDiagramEditorProps {
    initialTitle: string;
    initialContent: string;
    onSave: (title: string, content: string) => Promise<void>;
    onDelete: () => Promise<void>;
}

function GenericDiagramEditorContent({ initialTitle, initialContent, onSave, onDelete }: GenericDiagramEditorProps) {
    const navigate = useNavigate();
    const { showToast, error: toastError } = useToast();
    const [title, setTitle] = useState(initialTitle);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // ReactFlow hooks
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition, setViewport } = useReactFlow();

    // Parse Initial Content
    const initialData = useMemo(() => {
        try {
            return JSON.parse(initialContent);
        } catch {
            return { nodes: [], edges: [] };
        }
    }, [initialContent]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges || []);
    const [isSaving, setIsSaving] = useState(false);

    const nodeTypes = useMemo(() => ({ 
        table: TableNode,
        shape: ShapeNode
    }), []);
    
    const edgeTypes = useMemo(() => ({
        deletable: DeletableEdge
    }), []);

    // Helper to update node data
    const updateNodeData = useCallback((nodeId: string, transform: (data: any) => any) => {
        setNodes((nds) => 
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: transform(node.data) };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Table Node Callbacks
    const onTitleChange = useCallback((id: string, newTitle: string) => {
        updateNodeData(id, (data) => ({ ...data, title: newTitle }));
    }, [updateNodeData]);

    const onFieldChange = useCallback((id: string, index: number, key: string, value: string) => {
        updateNodeData(id, (data) => {
            const newFields = [...data.fields];
            newFields[index] = { ...newFields[index], [key]: value };
            return { ...data, fields: newFields };
        });
    }, [updateNodeData]);

    const onAddField = useCallback((id: string) => {
        updateNodeData(id, (data) => ({ 
            ...data, 
            fields: [...data.fields, { name: '', type: 'varchar' }] 
        }));
    }, [updateNodeData]);

    const onDeleteField = useCallback((id: string, index: number) => {
        updateNodeData(id, (data) => ({ 
            ...data, 
            fields: data.fields.filter((_: any, i: number) => i !== index) 
        }));
    }, [updateNodeData]);

    const onDeleteNode = useCallback((id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
    }, [setNodes]);

    // Shape Node Callbacks
    const onLabelChange = useCallback((id: string, newLabel: string) => {
        updateNodeData(id, (data) => ({ ...data, label: newLabel }));
    }, [updateNodeData]);


    // Connection Handler
    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({
        ...params, 
        type: 'deletable',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 }
    }, eds)), [setEdges]);


    // Action Handlers
    const handleAddNode = (type: 'table' | 'shape', shapeType?: string) => {
        const id = crypto.randomUUID();
        
        // Calculate center position
        let position = { x: 100, y: 100 };
        if (reactFlowWrapper.current) {
            const { top, left, width, height } = reactFlowWrapper.current.getBoundingClientRect();
            position = screenToFlowPosition({
                x: left + width / 2,
                y: top + height / 2,
            });
            // Adjust for node center (approximate)
            position.x -= 75; 
            position.y -= 40;
        }

        if (type === 'table') {
            const newNode = {
                id,
                type: 'table',
                position,
                data: { 
                    title: 'New Table', 
                    fields: [{ name: 'id', type: 'int' }],
                    onTitleChange,
                    onFieldChange,
                    onAddField,
                    onDeleteField,
                    onDeleteNode
                },
            };
            setNodes((nds) => [...nds, newNode]);
        } else {
             const newNode = {
                id,
                type: 'shape',
                position,
                style: { width: 150, height: 80 },
                data: { 
                    label: shapeType === 'diamond' ? 'Decision' : 'Process', 
                    shape: shapeType,
                    color: '#3b82f6', // Default blue
                    onLabelChange,
                    onDeleteNode
                },
            };
            setNodes((nds) => [...nds, newNode]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Serialize: Strip functions from data
        const cleanNodes = nodes.map(n => {
            const { onTitleChange, onFieldChange, onAddField, onDeleteField, onLabelChange, ...restData } = n.data;
            return {
                ...n,
                data: restData
            };
        });

        const content = JSON.stringify({ nodes: cleanNodes, edges });
        try {
            await onSave(title, content);
            showToast('Diagram saved successfully', 'success');
        } catch (error) {
            showToast('Failed to save diagram', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = () => {
         const cleanNodes = nodes.map(n => {
            const { onTitleChange, onFieldChange, onAddField, onDeleteField, onLabelChange, ...restData } = n.data;
            return { ...n, data: restData };
        });
        const exportData = {
            title,
            nodes: cleanNodes,
            edges,
            version: 1
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'diagram'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    // Import Logic
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                if (data.nodes && data.edges) {
                    setNodes(data.nodes);
                    setEdges(data.edges);
                    if (data.title) setTitle(data.title);
                    
                    // Reset Viewport if needed (optional)
                    if (data.viewport) {
                        setViewport(data.viewport);
                    }
                    
                    showToast('Diagram imported successfully', 'success');
                } else {
                    toastError('Invalid diagram file format');
                }
            } catch (error) {
                toastError('Failed to parse diagram file');
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        await onDelete();
        setShowDeleteConfirm(false);
    };

    // We will Map the nodes prop passed to ReactFlow to inject callbacks.
    const nodesWithCallbacks = useMemo(() => {
        return nodes.map(n => {
            if (n.type === 'table') {
                return {
                    ...n,
                    data: { ...n.data, onTitleChange, onFieldChange, onAddField, onDeleteField, onDeleteNode }
                };
            } else if (n.type === 'shape') {
                return {
                    ...n,
                    data: { ...n.data, onLabelChange, onDeleteNode }
                };
            }
            return n;
        });
    }, [nodes, onTitleChange, onFieldChange, onAddField, onDeleteField, onLabelChange, onDeleteNode]);

    return (
        <div className="flex flex-col h-full bg-bg-app">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
            />
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-panel">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/diagrams')} className="text-text-muted hover:text-text-primary">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-transparent font-bold text-text-primary focus:outline-none border-b border-transparent focus:border-accent-primary"
                        placeholder="Diagram Title"
                    />
                </div>
                
                {/* Tools */}
                <div className="flex items-center gap-1 bg-bg-element p-1 rounded-lg border border-border">
                    <button 
                        onClick={() => handleAddNode('table')}
                        className="p-2 text-text-secondary hover:text-accent-primary hover:bg-bg-panel rounded transition-colors"
                        title="Add Database Table"
                    >
                        <Database className="w-5 h-5" />
                    </button>
                    <div className="w-px h-5 bg-border mx-1" />
                    <button 
                         onClick={() => handleAddNode('shape', 'rectangle')}
                         className="p-2 text-text-secondary hover:text-accent-primary hover:bg-bg-panel rounded transition-colors"
                         title="Add Process (Rectangle)"
                    >
                        <Square className="w-5 h-5" />
                    </button>
                    <button 
                         onClick={() => handleAddNode('shape', 'diamond')}
                         className="p-2 text-text-secondary hover:text-accent-primary hover:bg-bg-panel rounded transition-colors"
                         title="Add Decision (Diamond)"
                    >
                        <Diamond className="w-5 h-5" />
                    </button>
                     <button 
                         onClick={() => handleAddNode('shape', 'circle')}
                         className="p-2 text-text-secondary hover:text-accent-primary hover:bg-bg-panel rounded transition-colors"
                         title="Add Start/End (Circle)"
                    >
                        <Circle className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                     <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 ${
                            isSaving
                              ? 'bg-green-600 text-white scale-95'
                              : 'bg-accent-primary hover:bg-accent-hover text-white'
                          }`}
                    >
                         <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    
                     <button 
                        onClick={handleImportClick}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                        title="Import JSON"
                    >
                         <Upload className="w-3.5 h-3.5" />
                        <span>Import</span>
                    </button>

                     <button 
                        onClick={handleDownload}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                        title="Download JSON"
                    >
                         <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                    </button>

                     <button 
                        onClick={handleDeleteClick} 
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                        title="Delete Diagram"
                    >
                         <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 h-full w-full" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodesWithCallbacks}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}

                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep} // Or Step, generic uses smooth or step
                    fitView
                    fitViewOptions={{ padding: 0.5, minZoom: 0.1, maxZoom: 1.5 }} // Zoom out by default (higher padding = more space around = smaller view)
                    minZoom={0.1}
                    deleteKeyCode="Delete"
                    multiSelectionKeyCode="Control"
                >
                    <Background color="#1e1e1e" gap={16} />
                    <Controls />
                </ReactFlow>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Diagram"
                message="Are you sure you want to delete this diagram? This action cannot be undone."
                confirmLabel="Delete"
                isDestructive={true}
            />
        </div>
    );
}

export function GenericDiagramEditor(props: GenericDiagramEditorProps) {
    return (
        <ReactFlowProvider>
            <GenericDiagramEditorContent {...props} />
        </ReactFlowProvider>
    );
}
