import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlayCircle, 
  Terminal, 
  Split, 
  AlertCircle, 
  CheckCircle2,
  Settings, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  X,
  Clock,
  Code,
  Share2,
  ChevronRight,
  Search,
  MoreVertical,
  Layers,
  Save,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import { useWorkflowsList, useWorkflowDetail, useWorkflowMutations } from '@/src/hooks/useWorkflows';
import { apiErrorMessage } from '@/src/lib/api';
import { uiToWorkflowSteps, workflowToUi, type UiWorkflow } from '@/src/lib/workflowAdapter';

const WorkflowNode = ({ type, title, subtitle, icon: Icon, color, position, active, failed, pending, code, isSelected }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    style={{ left: position.x, top: position.y }}
    className={cn(
      "absolute w-64 glass-card p-4 rounded-2xl group cursor-pointer transition-all duration-300",
      active ? "border-primary/40 ring-1 ring-primary/20 shadow-[0_0_30px_rgba(164,230,255,0.15)]" : "",
      failed ? "border-error/40 ring-1 ring-error/20" : "",
      pending ? "border-primary/20" : "",
      isSelected ? "border-primary ring-2 ring-primary/20 z-30" : "hover:border-white/20"
    )}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center gap-2.5">
        <Icon size={18} className={cn(color)} />
        <span className={cn("text-[9px] font-mono font-bold uppercase tracking-[0.2em]", color)}>{type}</span>
      </div>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#a4e6ff]" />}
    </div>
    
    <div className="flex items-center gap-2 mb-1">
      {active && <CheckCircle2 size={12} className="text-tertiary shadow-[0_0_8px_#68f5b8] shrink-0" />}
      {failed && <AlertCircle size={12} className="text-error shadow-[0_0_8px_#ffb4ab] shrink-0" />}
      {pending && <Clock size={12} className="text-yellow-400 shadow-[0_0_8px_#facc15] shrink-0" />}
      {!active && !failed && !pending && <div className="w-2 h-2 rounded-full bg-white/10 shrink-0" />}
      <h4 className="font-bold text-on-surface leading-tight">{title}</h4>
    </div>
    {subtitle && <p className="text-[11px] text-on-surface-variant/70 mt-1">{subtitle}</p>}
    
    {code && (
      <div className="mt-3 p-2 rounded-lg bg-surface-container-lowest/80 border border-white/5 font-mono text-[11px] text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
        {code}
      </div>
    )}

    {failed && (
      <div className="mt-3 flex gap-2">
        <button className="flex-1 py-1.5 bg-error/20 hover:bg-error/30 text-error rounded-lg text-[10px] font-bold transition-colors">RETRY</button>
        <button className="p-1.5 bg-white/5 hover:bg-white/10 text-on-surface-variant rounded-lg transition-all">
          <Settings size={14} />
        </button>
      </div>
    )}
  </motion.div>
);

const INITIAL_WORKFLOWS = [
  {
    id: 'wf-analytics',
    name: 'Data Pipeline Alpha',
    description: 'Main production analytics and re-indexing pipeline.',
    status: 'Running',
    lastRun: '2m ago',
    nodes: [
      { 
        id: 'node-1',
        type: 'TRIGGER', 
        title: 'Schedule Start', 
        subtitle: 'Every 15 minutes', 
        icon: PlayCircle, 
        color: 'text-primary', 
        position: { x: 80, y: 80 },
        status: 'pending'
      },
      { 
        id: 'node-2',
        type: 'SCRIPT', 
        title: 'Process Analytics', 
        code: 'python main.py --env prod', 
        icon: Terminal, 
        color: 'text-primary', 
        position: { x: 420, y: 180 },
        status: 'active'
      },
      { 
        id: 'node-3',
        type: 'CONDITION', 
        title: 'Validation Check', 
        subtitle: 'exit_code == 0', 
        icon: Split, 
        color: 'text-tertiary', 
        position: { x: 800, y: 80 },
        status: 'pending'
      },
      { 
        id: 'node-4',
        type: 'COMMAND', 
        title: 'DB Sync Hook', 
        subtitle: 'Socket timeout error', 
        icon: AlertCircle, 
        color: 'text-error', 
        position: { x: 800, y: 280 },
        status: 'failed'
      },
      { 
        id: 'node-5',
        type: 'NOTIFICATION', 
        title: 'Slack Alert', 
        subtitle: '#ops-critical', 
        icon: AlertCircle, 
        color: 'text-error', 
        position: { x: 1150, y: 280 },
        status: 'pending'
      },
      { 
        id: 'node-6',
        type: 'SUCCESS', 
        title: 'Workflow Complete', 
        subtitle: 'Archive logs', 
        icon: CheckCircle2, 
        color: 'text-tertiary', 
        position: { x: 1150, y: 80 },
        status: 'pending'
      }
    ],
    connections: [
      { d: "M 280 140 C 350 140, 350 240, 420 240", color: "#a4e6ff", dashed: true },
      { d: "M 670 240 C 740 240, 740 140, 810 140", color: "#a4e6ff" },
      { d: "M 670 240 C 740 240, 740 340, 810 340", color: "#ffb4ab", dashed: true },
      { d: "M 1050 140 C 1100 140, 1100 140, 1150 140", color: "#a4e6ff", dashed: true },
      { d: "M 1050 340 C 1100 340, 1100 340, 1150 340", color: "#ffb4ab", dashed: true }
    ]
  },
  {
    id: 'wf-backup',
    name: 'Daily DB Backup',
    description: 'System-wide snapshot and cold storage archival.',
    status: 'Idle',
    lastRun: '14h ago',
    nodes: [
      { 
        id: 'b-node-1',
        type: 'TRIGGER', 
        title: 'Cron Job', 
        subtitle: '0 0 * * *', 
        icon: Clock, 
        color: 'text-primary', 
        position: { x: 100, y: 150 },
        status: 'pending'
      },
      { 
        id: 'b-node-2',
        type: 'SCRIPT', 
        title: 'Snapshot DB', 
        code: 'pg_dump -U prod_user', 
        icon: Terminal, 
        color: 'text-primary', 
        position: { x: 450, y: 150 },
        status: 'pending'
      }
    ],
    connections: [
      { d: "M 300 210 L 450 210", color: "#a4e6ff" }
    ]
  }
];

const WF_PAGE_LIMIT = 20;

export default function Workflows() {
  const [workflows, setWorkflows] = useState<UiWorkflow[]>(INITIAL_WORKFLOWS as UiWorkflow[]);
  const [activeWorkflowId, setActiveWorkflowId] = useState(INITIAL_WORKFLOWS[0].id);
  const [wfPage, setWfPage] = useState(1);
  const [wfMenuOpen, setWfMenuOpen] = useState(false);
  const [showDeleteWf, setShowDeleteWf] = useState(false);
  const [wfError, setWfError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: wfList } = useWorkflowsList({ page: wfPage, limit: WF_PAGE_LIMIT });
  const { create, execute, update, remove } = useWorkflowMutations();

  const detailId = useMemo(() => {
    const wf = workflows.find((w) => w.id === activeWorkflowId);
    return wf?._raw ? activeWorkflowId : null;
  }, [workflows, activeWorkflowId]);

  const { data: wfDetail, isFetching: detailLoading } = useWorkflowDetail(detailId);

  useEffect(() => {
    if (wfList?.items?.length) {
      const ui = wfList.items.map(workflowToUi);
      setWorkflows((prev) => {
        const byId = new Map(prev.map((w) => [w.id, w]));
        for (const w of ui) byId.set(w.id, w);
        return Array.from(byId.values());
      });
      setActiveWorkflowId((prev) =>
        ui.some((w) => w.id === prev) ? prev : ui[0].id,
      );
    }
  }, [wfList]);

  useEffect(() => {
    if (!wfDetail) return;
    const ui = workflowToUi(wfDetail);
    setWorkflows((prev) => {
      const idx = prev.findIndex((w) => w.id === ui.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ui;
        return next;
      }
      return [...prev, ui];
    });
  }, [wfDetail]);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking the background
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      if (canvasRef.current) {
        setPanStart({
          x: e.pageX - canvasRef.current.offsetLeft,
          y: e.pageY - canvasRef.current.offsetTop,
          scrollLeft: canvasRef.current.scrollLeft,
          scrollTop: canvasRef.current.scrollTop
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !canvasRef.current) return;
    e.preventDefault();
    const x = e.pageX - canvasRef.current.offsetLeft;
    const y = e.pageY - canvasRef.current.offsetTop;
    const walkX = (x - panStart.x);
    const walkY = (y - panStart.y);
    canvasRef.current.scrollLeft = panStart.scrollLeft - walkX;
    canvasRef.current.scrollTop = panStart.scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const activeWorkflow = useMemo(() => 
    workflows.find(w => w.id === activeWorkflowId) || workflows[0]
  , [workflows, activeWorkflowId]);

  const selectedNode = activeWorkflow.nodes.find(n => n.id === selectedNodeId);

  const updateNode = (nodeId: string, updates: any) => {
    setWorkflows(prev => prev.map(wf => {
      if (wf.id === activeWorkflowId) {
        return {
          ...wf,
          nodes: wf.nodes.map(node => node.id === nodeId ? { ...node, ...updates } : node)
        };
      }
      return wf;
    }));
  };

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createNewWorkflow = async () => {
    try {
      const created = await create.mutateAsync({
        name: 'Untitled Workflow',
        description: 'Configure your new automation flow...',
        isActive: false,
        steps: [
          {
            order: 1,
            type: 'COMMAND',
            config: { command: 'echo start', title: 'Manual Trigger' },
            onFailure: 'STOP',
          },
        ],
      });
      const ui = workflowToUi(created);
      setWorkflows((prev) => [...prev, ui]);
      setActiveWorkflowId(ui.id);
    } catch {
      const newId = `wf-${Date.now()}`;
      const newWorkflow: UiWorkflow = {
        id: newId,
        name: 'Untitled Workflow',
        description: 'Configure your new automation flow...',
        status: 'Idle',
        lastRun: 'Never',
        nodes: [
          {
            id: 't-1',
            type: 'TRIGGER',
            title: 'Manual Trigger',
            subtitle: 'Starts on run',
            position: { x: 100, y: 150 },
            status: 'pending',
          },
        ],
        connections: [],
      };
      setWorkflows((prev) => [...prev, newWorkflow]);
      setActiveWorkflowId(newId);
    }
  };

  const runWorkflow = async () => {
    try {
      await execute.mutateAsync(activeWorkflowId);
      setIsRunning(true);
      setTimeout(() => setIsRunning(false), 3000);
    } catch {
      setIsRunning(!isRunning);
    }
  };

  const updateActiveWorkflow = (patch: Partial<Pick<UiWorkflow, 'name' | 'description'>>) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === activeWorkflowId ? { ...w, ...patch } : w)),
    );
  };

  const saveWorkflow = async () => {
    const wf = workflows.find((w) => w.id === activeWorkflowId);
    if (!wf?._raw) return;
    setWfError('');
    try {
      await update.mutateAsync({
        id: wf.id,
        dto: {
          name: wf.name,
          description: wf.description,
          steps: uiToWorkflowSteps(wf.nodes),
        },
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      setWfError(apiErrorMessage(err));
    }
  };

  const handleDeleteWorkflow = async () => {
    const wf = workflows.find((w) => w.id === activeWorkflowId);
    if (!wf?._raw) return;
    setWfError('');
    try {
      await remove.mutateAsync(activeWorkflowId);
      const remaining = workflows.filter((w) => w.id !== activeWorkflowId);
      setWorkflows(remaining);
      setActiveWorkflowId(remaining[0]?.id ?? '');
      setShowDeleteWf(false);
      setWfMenuOpen(false);
    } catch (err) {
      setWfError(apiErrorMessage(err));
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex rounded-tl-3xl bg-surface-container-lowest overflow-hidden">
      {/* Workflow Selection Sidebar */}
      <aside className="w-80 border-r border-white/5 bg-surface-container-low/40 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              Workflows
            </h3>
            <button 
              onClick={createNewWorkflow}
              className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all border border-primary/20"
            >
              <Plus size={18} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={14} />
            <input 
              type="text"
              placeholder="Filter flows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/2 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          {filteredWorkflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => {
                setActiveWorkflowId(workflow.id);
                setSelectedNodeId('');
              }}
              className={cn(
                "w-full p-4 rounded-2xl text-left transition-all border group relative overflow-hidden",
                activeWorkflowId === workflow.id 
                  ? "bg-primary/5 border-primary/20 shadow-lg" 
                  : "bg-transparent border-transparent hover:bg-white/5"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm text-on-surface truncate pr-4">{workflow.name}</span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  workflow.status === 'Running' ? "bg-primary animate-pulse shadow-[0_0_8px_#a4e6ff]" : "bg-on-surface-variant/20"
                )} />
              </div>
              <p className="text-[10px] text-on-surface-variant/60 line-clamp-2 leading-relaxed mb-3">{workflow.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-on-surface-variant/40">
                  Last run: {workflow.lastRun}
                </span>
                <ChevronRight size={14} className={cn(
                  "text-primary transition-all",
                  activeWorkflowId === workflow.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                )} />
              </div>
            </button>
          ))}
        </div>

        <Pagination
          page={wfPage}
          limit={WF_PAGE_LIMIT}
          total={wfList?.meta.total ?? filteredWorkflows.length}
          onPageChange={setWfPage}
          className="p-4 border-t border-white/5 shrink-0"
        />
      </aside>

      {/* Main Canvas Area */}
      <div className="flex-1 relative workflow-grid h-full overflow-hidden flex flex-col">
        {/* Canvas Toolbar */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2 z-10 gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
             <div className="px-3 py-1 bg-surface-container-high rounded-lg text-[10px] font-mono font-bold text-primary uppercase tracking-widest border border-white/5 shrink-0">
                {activeWorkflow.id.slice(0, 8)}…
             </div>
             <div className="min-w-0 flex-1 space-y-1">
               <input
                 type="text"
                 value={activeWorkflow.name}
                 onChange={(e) => updateActiveWorkflow({ name: e.target.value })}
                 className="w-full text-sm font-bold text-on-surface bg-transparent border-b border-transparent hover:border-white/10 focus:border-primary/40 focus:outline-none"
               />
               <input
                 type="text"
                 value={activeWorkflow.description}
                 onChange={(e) => updateActiveWorkflow({ description: e.target.value })}
                 className="w-full text-[10px] text-on-surface-variant bg-transparent border-b border-transparent hover:border-white/10 focus:border-primary/40 focus:outline-none"
               />
               {detailLoading && (
                 <span className="text-[9px] font-mono text-primary">Loading detail…</span>
               )}
             </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 relative">
            {wfError && <span className="text-[10px] text-error max-w-[120px] truncate">{wfError}</span>}
            <button
              type="button"
              disabled={!activeWorkflow._raw || update.isPending}
              onClick={() => void saveWorkflow()}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
            >
              <Save size={14} />
              {saveOk ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={() => setWfMenuOpen((v) => !v)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-on-surface transition-all">
              <MoreVertical size={16} />
            </button>
            {wfMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] glass-card rounded-xl border border-white/10 py-1 shadow-2xl">
                <button
                  type="button"
                  disabled={!activeWorkflow._raw}
                  onClick={() => {
                    setWfMenuOpen(false);
                    setShowDeleteWf(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-error/10 text-error disabled:opacity-30"
                >
                  <Trash2 size={14} /> Delete workflow
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Body */}
        <div 
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "flex-1 relative overflow-auto p-20 custom-scrollbar select-none",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {/* SVG Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            {activeWorkflow.connections.map((conn, idx) => (
              <path 
                key={idx}
                d={conn.d} 
                fill="none" 
                stroke={conn.color} 
                strokeWidth="2" 
                strokeDasharray={conn.dashed ? "4 4" : "none"} 
              />
            ))}
          </svg>

          {activeWorkflow.nodes.map((node) => (
            <div key={node.id} onClick={() => setSelectedNodeId(node.id)}>
              <WorkflowNode 
                {...node}
                active={node.status === 'active'}
                failed={node.status === 'failed'}
                pending={node.status === 'pending'}
                isSelected={selectedNodeId === node.id}
              />
            </div>
          ))}

          {/* Float Controls */}
          <div className="fixed bottom-8 left-[calc(50%+40px)] -translate-x-1/2 flex items-center gap-2 glass-panel p-2 rounded-2xl shadow-2xl z-40">
            <button 
              onClick={() => void runWorkflow()}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all",
                isRunning ? "bg-error/20 text-error" : "bg-primary text-on-primary shadow-lg shadow-primary/20"
              )}
            >
              <PlayCircle size={18} className={cn(isRunning && "animate-pulse")} />
              <span>{isRunning ? 'Stop Workflow' : 'Run Workflow'}</span>
            </button>
            <div className="w-[1px] h-8 bg-white/10 mx-2" />
            <button
              type="button"
              disabled={!activeWorkflow._raw || update.isPending}
              onClick={() => void saveWorkflow()}
              className="px-4 py-2.5 bg-white/5 text-on-surface rounded-xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all disabled:opacity-30"
            >
              <Save size={18} />
              <span>Save</span>
            </button>
            <button className="px-4 py-2.5 bg-white/5 text-on-surface rounded-xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
              <Plus size={18} />
              <span>Add Step</span>
            </button>
            <div className="w-[1px] h-8 bg-white/10 mx-2" />
            <button className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all"><ZoomIn size={18} /></button>
            <button className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all"><ZoomOut size={18} /></button>
            <button className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all"><Maximize size={18} /></button>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <aside className="w-[400px] border-l border-white/5 bg-surface-container-low/60 backdrop-blur-xl flex flex-col z-50">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
          <h3 className="text-xl font-bold">Properties</h3>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={() => setSelectedNodeId('')}><X size={20} /></button>
        </div>
        
        <AnimatePresence mode="wait">
          {selectedNodeId && selectedNode ? (
            <motion.div 
              key={selectedNodeId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar"
            >
              {/* Header Info */}
              <div className={cn("rounded-2xl border p-5", selectedNode.status === 'failed' ? "bg-error/5 border-error/20" : "bg-primary/5 border-primary/20")}>
                <div className="flex items-center gap-3 mb-2">
                  <selectedNode.icon className={cn(selectedNode.color)} size={20} />
                  <span className="font-bold text-on-surface uppercase tracking-tight">{selectedNode.title}</span>
                </div>
                <p className="text-[10px] font-mono text-on-surface-variant opacity-60">Step ID: datn_{selectedNode.id.replace('-', '_')}</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/5">
                {['Configuration', 'Logs', 'Output'].map((tab) => (
                  <button 
                    key={tab}
                    className={cn(
                      "px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all relative",
                      tab === 'Configuration' ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                {/* Visual Identity */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Icon</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-surface-container-high/50 border border-white/10 rounded-xl">
                      {[PlayCircle, Terminal, Split, AlertCircle, CheckCircle2, Clock, Code, Share2, Layers, Search].map((Icon, idx) => {
                        const isSelected = selectedNode.icon === Icon;
                        return (
                          <button 
                            key={idx}
                            onClick={() => updateNode(selectedNode.id, { icon: Icon })}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                              isSelected ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "hover:bg-white/5 text-on-surface-variant"
                            )}
                          >
                            <Icon size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Theme Color</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-surface-container-high/50 border border-white/10 rounded-xl">
                      {['text-primary', 'text-tertiary', 'text-error', 'text-yellow-400', 'text-secondary'].map((colorClass) => {
                        const isSelected = selectedNode.color === colorClass;
                        return (
                          <button 
                            key={colorClass}
                            onClick={() => updateNode(selectedNode.id, { color: colorClass })}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-lg transition-all border",
                              isSelected ? "border-white/40 ring-1 ring-white/20" : "border-transparent hover:bg-white/5"
                            )}
                          >
                            <div className={cn("w-4 h-4 rounded-full bg-current", colorClass)} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Node Name</label>
                  <input 
                    type="text"
                    value={selectedNode.title}
                    onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                    className="w-full bg-surface-container-high/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-on-surface focus:outline-none focus:border-primary/40 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Description</label>
                  <textarea 
                    value={selectedNode.subtitle || ''}
                    onChange={(e) => updateNode(selectedNode.id, { subtitle: e.target.value })}
                    className="w-full bg-surface-container-high/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40 transition-all resize-none h-20"
                    placeholder="Brief description of this step..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Action Type</label>
                  <div className="bg-surface-container-high/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium flex justify-between items-center group cursor-pointer hover:border-primary/30 transition-all">
                    {selectedNode.type}
                    <Settings size={14} className="text-on-surface-variant" />
                  </div>
                </div>

                {selectedNode.code && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Command</label>
                    <div className="bg-surface-container-lowest border border-white/5 rounded-xl p-4 font-mono text-xs text-primary-container leading-relaxed break-all">
                       {selectedNode.code}
                    </div>
                  </div>
                )}

                {selectedNode.type === 'TRIGGER' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Schedule Management</label>
                    <div className="bg-surface-container-high/30 rounded-2xl border border-white/10 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                          <Clock size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{selectedNode.subtitle}</p>
                          <p className="text-[10px] font-mono opacity-40">*/15 * * * *</p>
                        </div>
                      </div>
                      <button className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all uppercase tracking-widest">
                        Update Cron Settings
                      </button>
                    </div>
                  </div>
                )}

                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Attempts</label>
                      <div className="bg-surface-container-high/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-center">3</div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-widest px-1">Retry Delay</label>
                      <div className="bg-surface-container-high/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-center">5s</div>
                   </div>
                 </div>

                 {selectedNode.status === 'failed' && (
                   <div className="bg-error/10 border border-error/20 rounded-2xl p-5 space-y-3">
                     <div className="flex items-center gap-2 text-error">
                       <AlertCircle size={16} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Execution Failure</span>
                     </div>
                     <p className="text-xs text-on-surface-variant leading-relaxed">
                       Runtime error encountered. Socket timeout while attempting to sync with primary database cluster.
                     </p>
                     <button className="w-full py-2 bg-error text-on-error rounded-lg font-bold text-[10px] uppercase tracking-widest">
                       Relaunch Step
                     </button>
                   </div>
                 )}
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
                <Code size={30} />
              </div>
              <p className="text-sm font-bold">Select a node to view properties</p>
              <p className="text-xs mt-2">Adjust configurations, check logs, and monitor outputs in real-time.</p>
            </div>
          )}
        </AnimatePresence>

        <div className="p-6 bg-surface-container/40 border-t border-white/5">
          <button
            type="button"
            disabled={!activeWorkflow._raw || update.isPending}
            onClick={() => void saveWorkflow()}
            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
          >
            {saveOk ? 'Saved' : 'Save Workflow'}
          </button>
        </div>
      </aside>

      {showDeleteWf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-4">
            <h3 className="text-xl font-bold">Delete workflow</h3>
            <p className="text-on-surface-variant text-sm">
              Delete &quot;{activeWorkflow.name}&quot;? This cannot be undone.
            </p>
            {wfError && <p className="text-error text-sm">{wfError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowDeleteWf(false)} className="flex-1 py-3 rounded-xl border border-white/10">
                Cancel
              </button>
              <button type="button" onClick={() => void handleDeleteWorkflow()} className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
