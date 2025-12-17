import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Task, TaskStatus, Member, canDeleteTask, canEditTask, getRoleLevel, Role, RoleConfig, Subtask, TaskType, AuditLog } from '../types';
import { Plus, Calendar, User, Sparkles, Pencil, AlertCircle, MessageSquare, ArrowUp, ArrowDown, Minus, Filter, Users, Trash2, Lock, Search, SortAsc, X, ChevronDown, ChevronUp, Circle, Timer, Eye, CheckCircle2, Clock, ArrowRight, LayoutGrid, List, ArrowUpDown, AlertTriangle, CheckSquare, MoreHorizontal, Check, ListTodo, Flag, Link as LinkIcon, FileText, Video, PenTool, AlignLeft, Send, PauseCircle, XCircle, CalendarDays, ChevronLeft, ChevronRight, Hash, ShieldCheck, RefreshCw, Activity, PieChart, BarChart2, TrendingUp, History, Square, FileClock, Edit3, XSquare } from 'lucide-react';
import { analyzeTask } from '../services/geminiService';
import { subscribeToLogs } from '../services/firebase'; // Import log subscription
import { PieChart as RePieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface TaskBoardProps {
  tasks: Task[];
  members: Member[];
  currentUser: Member;
  onUpdateTask: (updatedTask: Task) => void;
  onAddTask: (newTask: Task) => void;
  onDeleteTask: (taskId: string) => void;
  initialAssigneeId?: string | null;
  initialDescription?: string; 
  onClearInitialAssignee?: () => void;
  onClearInitialData?: () => void;
  rolePermissions: Record<Role, RoleConfig>;
}

type SortField = 'PRIORITY' | 'DEADLINE' | 'TITLE';
type SortDirection = 'ASC' | 'DESC';

interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

type ViewMode = 'BOARD' | 'LIST';
type TimeView = 'ALL' | 'DAY' | 'WEEK' | 'MONTH';

// --- Helper: Format DateTime for Input (YYYY-MM-DDTHH:mm) ---
const toInputDateTime = (isoString: string) => {
    if (!isoString) return '';
    if (isoString.length === 10) return `${isoString}T09:00`;
    return isoString.substring(0, 16);
};

// --- Helper: Format Display Date Time (DD/MM HH:mm) ---
const formatDisplayDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // FIX: 24h format
    return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

// --- Sub-component: Avatar ---
const Avatar: React.FC<{ member?: Member; size?: string; showName?: boolean; className?: string; hideTooltip?: boolean }> = React.memo(({ member, size = "w-6 h-6", showName = false, className = "", hideTooltip = false }) => {
    if (!member) return <div className={`${size} rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 ${className}`}><User size={12} className="text-slate-400"/></div>;
    
    return (
        <div className="flex items-center gap-2" title={hideTooltip ? undefined : `${member.name} (${member.role})`}>
            <div className={`${size} rounded-full bg-slate-100 text-white flex items-center justify-center text-[10px] font-bold border border-white shadow-sm ring-1 ring-slate-100 overflow-hidden flex-shrink-0 ${className}`}>
                {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        {member.name.charAt(0)}
                    </div>
                )}
            </div>
            {showName && <span className="text-xs text-slate-700 font-bold truncate max-w-[120px]">{member.name}</span>}
        </div>
    );
});

// --- Sub-component: TaskCard (For Board View) ---
const TaskCard: React.FC<{
  task: Task;
  members: Member[];
  currentUser: Member;
  isOverdue: boolean;
  isJustUpdated: boolean;
  analyzingId: string | null;
  isSelected: boolean;
  onToggleSelect: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAnalyze: (task: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string, assigneeId: string) => void;
  onDragEnd: () => void;
  onQuickStatusChange: (task: Task, newStatus: TaskStatus) => void; // New prop
  rolePermissions: Record<Role, RoleConfig>;
}> = React.memo(({ task, members, currentUser, isOverdue, isJustUpdated, analyzingId, isSelected, onToggleSelect, onEdit, onDelete, onAnalyze, onDragStart, onDragEnd, onQuickStatusChange, rolePermissions }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const assigner = members.find(m => m.id === task.assignerId);
  const assignee = members.find(m => m.id === task.assigneeId);
  const supporters = task.supporterIds ? members.filter(m => task.supporterIds.includes(m.id)) : [];
  
  const hasEditPermission = canEditTask(currentUser, task.assigneeId, rolePermissions);
  const hasDeletePermission = canDeleteTask(currentUser, rolePermissions);

  // Logic for Action Buttons
  const isAssignee = currentUser.id === task.assigneeId;
  // Assigner can perform actions, OR Manager/Board can override
  const isAssignerOrManager = currentUser.id === task.assignerId || currentUser.roleType === Role.MANAGER || currentUser.roleType === Role.BOARD;

  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
  
  // NEW LOGIC: Check if checklist is 100% complete
  const allSubtasksComplete = totalSubtasks === 0 || completedSubtasks === totalSubtasks;

  const getPriorityColors = (priority: string) => {
    switch (priority) {
      case 'High': return { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' };
      case 'Medium': return { border: 'border-l-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' };
      case 'Low': return { border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-800' };
      default: return { border: 'border-l-slate-300', bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-600' };
    }
  };

  const getTypeIcon = (type: TaskType) => {
      switch (type) {
          case 'MEDIA': return <Video size={12} className="text-purple-600"/>;
          case 'CONTENT': return <PenTool size={12} className="text-pink-600"/>;
          default: return <FileText size={12} className="text-blue-600"/>;
      }
  };

  const colors = getPriorityColors(task.priority);
  const isCancelled = task.status === TaskStatus.CANCELLED;

  return (
    <div
      draggable={hasEditPermission}
      onDragStart={(e) => onDragStart(e, task.id, task.assigneeId)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${colors.border} transition-all group relative animate-fade-in hover:shadow-md
        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}
        ${isJustUpdated ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}
        ${hasEditPermission ? 'cursor-move' : 'cursor-default'}
        ${isCancelled ? 'opacity-60 grayscale' : ''}
      `}
    >
      {/* Top Actions Overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {hasEditPermission && (
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
                className="p-1.5 bg-white border border-slate-200 hover:border-blue-300 rounded text-slate-400 hover:text-blue-600 shadow-sm transition-colors"
                title="Chỉnh sửa"
            >
                <Pencil size={12} />
            </button>
          )}
          {hasDeletePermission && (
             <button 
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
                className="p-1.5 bg-white border border-slate-200 hover:border-red-300 rounded text-slate-400 hover:text-red-600 shadow-sm transition-colors"
                title="Xóa"
             >
                 <Trash2 size={12} />
             </button>
          )}
      </div>

      <div className="p-3 pb-2">
          {/* Header Row: Type + Priority */}
          <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                  {hasEditPermission && (
                      <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); onToggleSelect(task.id); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                  )}
                  <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                      {getTypeIcon(task.taskType)}
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{task.taskType}</span>
                  </div>
              </div>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.badge} border border-white shadow-sm`}>
                  {task.priority}
              </span>
          </div>

          {/* Title & Desc */}
          <div className="mb-2">
              <h4 className={`font-bold text-sm leading-snug mb-1 ${isCancelled ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                  {task.title}
              </h4>
              <p 
                  className={`text-xs text-slate-500 line-clamp-2 cursor-pointer hover:text-slate-700 transition-colors`}
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={task.description}
              >
                  {task.description || "Không có mô tả"}
              </p>
              {isExpanded && task.description && (
                  <div className="absolute left-0 right-0 bg-white border border-slate-200 p-3 shadow-lg z-30 rounded-md mt-1 mx-3 text-xs text-slate-700 whitespace-pre-wrap">
                      {task.description}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="block w-full text-center mt-2 text-[10px] text-blue-500 hover:underline"
                      >
                          Thu gọn
                      </button>
                  </div>
              )}
          </div>

          {/* CHECKLIST MINI-VIEW */}
          {totalSubtasks > 0 && (
              <div className="mb-3 bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center">
                          <ListTodo size={10} className="mr-1"/> Checklist
                      </span>
                      <span className={`text-[10px] font-bold ${allSubtasksComplete ? 'text-green-600' : 'text-slate-600'}`}>
                          {completedSubtasks}/{totalSubtasks}
                      </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-slate-200 rounded-full mb-2 overflow-hidden">
                      <div 
                          className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                          style={{width: `${progressPercent}%`}}
                      ></div>
                  </div>
                  {/* List first 2 items */}
                  <div className="space-y-1">
                      {subtasks.slice(0, 2).map(sub => (
                          <div key={sub.id} className="flex items-start gap-1.5">
                              <div className={`mt-0.5 w-2.5 h-2.5 border rounded-sm flex items-center justify-center ${sub.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white'}`}>
                                  {sub.completed && <Check size={8} className="text-white"/>}
                              </div>
                              <span className={`text-[10px] leading-tight flex-1 ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{sub.content}</span>
                          </div>
                      ))}
                      {totalSubtasks > 2 && (
                          <div className="text-[9px] text-slate-400 pl-4 italic">+{totalSubtasks - 2} việc khác...</div>
                      )}
                  </div>
              </div>
          )}

          {/* Links & Notes Indicators */}
          {(task.mediaUrl || task.notes) && (
              <div className="flex gap-2 mb-2">
                  {task.mediaUrl && (
                      <a 
                        href={task.mediaUrl} 
                        target="_blank" 
                        onClick={e => { e.stopPropagation(); }} 
                        onMouseDown={e => e.stopPropagation()}
                        className="text-[9px] flex items-center bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors border border-blue-100"
                      >
                          <LinkIcon size={8} className="mr-1"/> Link
                      </a>
                  )}
                  {task.notes && (
                      <div className="text-[9px] flex items-center bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100" title={task.notes}>
                          <MessageSquare size={8} className="mr-1"/> Note
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex flex-col gap-2">
          <div className="flex justify-between items-center">
              <div className="flex items-center">
                  {/* Assignee Avatar */}
                  <div className="relative group/tooltip">
                      <Avatar member={assignee} size="w-6 h-6" className="ring-2 ring-white" />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] p-1.5 rounded whitespace-nowrap z-50">
                          Người làm: {assignee?.name}
                      </div>
                      {/* Assigner Indicator (Small) */}
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200" title={`Giao bởi: ${assigner?.name}`}>
                          {assigner?.avatar ? <img src={assigner.avatar} className="w-full h-full object-cover rounded-full"/> : <div className="text-[6px] font-bold">{assigner?.name.charAt(0)}</div>}
                      </div>
                  </div>
                  
                  {/* Supporters */}
                  {supporters.length > 0 && (
                      <div className="flex -space-x-1 ml-1.5">
                          {supporters.map(s => (
                              <Avatar key={s.id} member={s} size="w-4 h-4" className="ring-1 ring-white opacity-80" hideTooltip/>
                          ))}
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-2">
                  <div className={`flex items-center text-[10px] font-bold ${isOverdue && !isCancelled && task.status !== 'DONE' ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                      {isOverdue && !isCancelled && task.status !== 'DONE' ? <AlertCircle size={10} className="mr-1"/> : <Clock size={10} className="mr-1"/>}
                      {new Date(task.deadline).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                  </div>
                  
                  {/* AI Button */}
                  <button
                      onClick={(e) => { e.stopPropagation(); onAnalyze(task); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      disabled={analyzingId === task.id}
                      className="text-purple-400 hover:text-purple-600 transition-colors"
                      title="AI Gợi ý"
                  >
                      <Sparkles size={12} className={analyzingId === task.id ? 'animate-spin' : ''}/>
                  </button>
              </div>
          </div>

          {/* PROFESSIONAL WORKFLOW BUTTONS */}
          {/* IMPORTANT: onMouseDown stopPropagation is CRITICAL here to prevent Drag&Drop from hijacking the click */}
          {(isAssignee && task.status === TaskStatus.IN_PROGRESS) || (isAssignerOrManager && task.status === TaskStatus.REVIEW) ? (
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                  {/* Assignee Actions */}
                  {isAssignee && task.status === TaskStatus.IN_PROGRESS && (
                      <button
                          onClick={(e) => { 
                              if (!allSubtasksComplete) return; // Guard
                              e.stopPropagation(); 
                              e.preventDefault();
                              onQuickStatusChange(task, TaskStatus.REVIEW); 
                          }}
                          onMouseDown={(e) => e.stopPropagation()} // CRITICAL FIX
                          disabled={!allSubtasksComplete} // DISABLED IF CHECKLIST NOT DONE
                          className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center shadow-sm transition-all z-30 relative ${
                              allSubtasksComplete 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95' 
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          }`}
                          title={!allSubtasksComplete ? "Vui lòng hoàn thành 100% Checklist trước khi gửi duyệt" : "Báo cáo hoàn thành & Gửi duyệt"}
                      >
                          <Send size={10} className="mr-1.5"/> Gửi duyệt
                      </button>
                  )}

                  {/* Assigner Actions */}
                  {isAssignerOrManager && task.status === TaskStatus.REVIEW && (
                      <>
                          <button
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  e.preventDefault();
                                  onQuickStatusChange(task, TaskStatus.IN_PROGRESS); 
                              }}
                              onMouseDown={(e) => e.stopPropagation()} // CRITICAL FIX
                              className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center transition-all active:scale-95 z-30 relative"
                          >
                              <RefreshCw size={10} className="mr-1.5"/> Yêu cầu sửa
                          </button>
                          <button
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  e.preventDefault();
                                  onQuickStatusChange(task, TaskStatus.DONE); 
                              }}
                              onMouseDown={(e) => e.stopPropagation()} // CRITICAL FIX
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center shadow-sm transition-all active:scale-95 z-30 relative"
                          >
                              <CheckCircle2 size={10} className="mr-1.5"/> Phê duyệt
                          </button>
                      </>
                  )}
              </div>
          ) : null}
      </div>
    </div>
  );
});

const TaskBoard: React.FC<TaskBoardProps> = ({ 
  tasks, 
  members, 
  currentUser,
  onUpdateTask, 
  onAddTask, 
  onDeleteTask,
  initialAssigneeId,
  initialDescription, // Accepted prop
  onClearInitialAssignee,
  onClearInitialData,
  rolePermissions
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('BOARD');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'INFO' | 'HISTORY'>('INFO'); // NEW: Toggle between Edit Form and History
  
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [lastUpdatedTaskId, setLastUpdatedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<{isOpen: boolean, taskId: string | null}>({ isOpen: false, taskId: null });
  
  // AI Suggestion Modal State
  const [aiSuggestion, setAiSuggestion] = useState<{isOpen: boolean, taskTitle: string, content: string} | null>(null);

  // -- Selection & Bulk Action --
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState<'STATUS' | 'PRIORITY' | null>(null);

  // -- NEW FILTER STATE ---
  const [filterTaskMode, setFilterTaskMode] = useState<'ALL' | 'MY_TASKS' | 'ASSIGNED_BY_ME'>('MY_TASKS');
  const [timeView, setTimeView] = useState<TimeView>('WEEK');
  
  // *** NEW: Current Date for Time Navigation ***
  const [currentDate, setCurrentDate] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  // REMOVED: isFilterMenuOpen state

  // --- KPI DASHBOARD STATE ---
  const [showStats, setShowStats] = useState(false);
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Subscribe to logs for History View
  useEffect(() => {
      const unsubscribe = subscribeToLogs((data) => {
          setAllLogs(data);
      });
      return () => unsubscribe();
  }, []);

  const [columnSorts, setColumnSorts] = useState<Record<TaskStatus, SortConfig>>({
      [TaskStatus.TODO]: { field: 'PRIORITY', direction: 'DESC' },
      [TaskStatus.IN_PROGRESS]: { field: 'PRIORITY', direction: 'DESC' },
      [TaskStatus.REVIEW]: { field: 'PRIORITY', direction: 'DESC' },
      [TaskStatus.DONE]: { field: 'DEADLINE', direction: 'DESC' },
      [TaskStatus.PENDING]: { field: 'PRIORITY', direction: 'DESC' },
      [TaskStatus.CANCELLED]: { field: 'DEADLINE', direction: 'DESC' },
  });
  const [listSort, setListSort] = useState<SortConfig>({ field: 'DEADLINE', direction: 'ASC' });

  // FORM STATE
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('GENERAL'); 
  const [mediaUrl, setMediaUrl] = useState(''); 
  const [contentDraft, setContentDraft] = useState(''); // NEW for Content Tasks
  const [taskAssigner, setTaskAssigner] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(members[0]?.id || '');
  const [taskSupporters, setTaskSupporters] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(TaskStatus.TODO); // Added status state for edit
  
  // Subtask state for Modal
  const [taskSubtasks, setTaskSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const assignerDropdownRef = useRef<HTMLDivElement>(null);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isAssignerDropdownOpen, setIsAssignerDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setIsAssigneeDropdownOpen(false);
      }
      if (assignerDropdownRef.current && !assignerDropdownRef.current.contains(event.target as Node)) {
        setIsAssignerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const urgentCount = useMemo(() => {
    const today = new Date();
    
    return tasks.filter(t => {
      if (t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED) return false;
      const d = new Date(t.deadline);
      const diffTime = d.getTime() - today.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days <= 3;
    }).length;
  }, [tasks]);

  // Effect to handle initial Data (from Team List or Chat)
  useEffect(() => {
    if (initialAssigneeId !== undefined || initialDescription !== undefined) {
      // Set defaults for new task
      setEditingTask(null);
      setActiveModalTab('INFO');
      setTaskAssigner(currentUser.id);
      setTaskSupporters([]);
      setTaskPriority('Medium');
      setTaskType('GENERAL');
      setMediaUrl('');
      setContentDraft('');
      // Default dates with time (Current Time and +2 days)
      const now = new Date();
      const threeDaysLater = new Date();
      threeDaysLater.setDate(now.getDate() + 3);
      
      // Format for input: YYYY-MM-DDTHH:mm
      setTaskStartDate(toInputDateTime(now.toISOString()));
      setTaskDeadline(toInputDateTime(threeDaysLater.toISOString()));
      setTaskStatus(TaskStatus.TODO);
      
      setTaskNotes('');
      setTaskSubtasks([]);

      // Handle specifics
      if (initialAssigneeId) {
        setTaskAssignee(initialAssigneeId);
        setTaskTitle('');
        setTaskDesc('');
      } else {
        setTaskAssignee(members[0]?.id || '');
      }

      if (initialDescription) {
          setTaskDesc(initialDescription);
          // Suggest a title from description (first 50 chars)
          const suggestedTitle = initialDescription.length > 50 
            ? initialDescription.substring(0, 50) + "..." 
            : initialDescription;
          setTaskTitle(suggestedTitle);
      } else {
          if (!initialAssigneeId) setTaskTitle('');
          if (!initialAssigneeId) setTaskDesc('');
      }

      setIsModalOpen(true);
      
      // Cleanup props
      if (onClearInitialAssignee) onClearInitialAssignee();
      if (onClearInitialData) onClearInitialData();
    }
  }, [initialAssigneeId, initialDescription, onClearInitialAssignee, onClearInitialData, currentUser.id]);

  useEffect(() => {
    if (lastUpdatedTaskId) {
      const timer = setTimeout(() => setLastUpdatedTaskId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedTaskId]);

  const isTaskOverdue = (deadline: string, status: TaskStatus) => {
    if (status === TaskStatus.DONE || status === TaskStatus.CANCELLED || status === TaskStatus.PENDING) return false;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    return deadlineDate < today;
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setActiveModalTab('INFO');
    setTaskTitle('');
    setTaskDesc('');
    setTaskType('GENERAL');
    setMediaUrl('');
    setContentDraft('');
    setTaskAssigner(currentUser.id);
    setTaskAssignee(members[0]?.id || '');
    setTaskSupporters([]);
    setTaskPriority('Medium');
    setTaskStatus(TaskStatus.TODO);
    
    // Default dates with time
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);
    
    setTaskStartDate(toInputDateTime(now.toISOString()));
    setTaskDeadline(toInputDateTime(threeDaysLater.toISOString()));
    
    setTaskNotes('');
    setTaskSubtasks([]);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    if (!canEditTask(currentUser, task.assigneeId, rolePermissions)) return;
    setEditingTask(task);
    setActiveModalTab('INFO');
    setTaskTitle(task.title);
    setTaskDesc(task.description);
    setTaskType(task.taskType || 'GENERAL');
    setMediaUrl(task.mediaUrl || '');
    setContentDraft(task.contentDraft || '');
    setTaskAssigner(task.assignerId || currentUser.id);
    setTaskAssignee(task.assigneeId);
    setTaskSupporters(task.supporterIds || []);
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    
    // Check if task dates already have time (length > 10)
    setTaskStartDate(toInputDateTime(task.startDate || task.deadline));
    setTaskDeadline(toInputDateTime(task.deadline));
    
    setTaskNotes(task.notes || '');
    setTaskSubtasks(task.subtasks || []);
    setIsModalOpen(true);
  };

  const handleAddSubtask = () => {
      if (!newSubtaskInput.trim()) return;
      const newSubtask: Subtask = {
          id: Date.now().toString(),
          content: newSubtaskInput,
          completed: false
      };
      setTaskSubtasks([...taskSubtasks, newSubtask]);
      setNewSubtaskInput('');
  };

  const handleToggleSubtask = (id: string) => {
      setTaskSubtasks(taskSubtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleDeleteSubtask = (id: string) => {
      setTaskSubtasks(taskSubtasks.filter(s => s.id !== id));
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (editingTask) {
          const updatedTask: Task = {
            ...editingTask,
            title: taskTitle,
            description: taskDesc,
            taskType: taskType,
            mediaUrl: mediaUrl,
            contentDraft: contentDraft,
            assignerId: taskAssigner,
            assigneeId: taskAssignee,
            supporterIds: taskSupporters,
            priority: taskPriority,
            status: taskStatus, // Include status in edit
            startDate: taskStartDate,
            deadline: taskDeadline,
            notes: taskNotes,
            subtasks: taskSubtasks
          };
          await onUpdateTask(updatedTask);
          setLastUpdatedTaskId(updatedTask.id);
        } else {
          const newTask: Task = {
            id: Date.now().toString(),
            title: taskTitle,
            description: taskDesc,
            taskType: taskType,
            mediaUrl: mediaUrl,
            contentDraft: contentDraft,
            assignerId: taskAssigner,
            assigneeId: taskAssignee,
            supporterIds: taskSupporters,
            priority: taskPriority,
            startDate: taskStartDate,
            deadline: taskDeadline,
            status: TaskStatus.TODO,
            notes: taskNotes,
            subtasks: taskSubtasks,
          };
          await onAddTask(newTask);
          setLastUpdatedTaskId(newTask.id);
        }
        setIsModalOpen(false);
    } catch (error) {
        console.error("Failed to save task:", error);
        alert("Lỗi khi lưu công việc. Vui lòng thử lại.");
    }
  };

  // --- NEW: QUICK ACTION HANDLER ---
  // Use useCallback to ensure stable reference for React.memo
  const handleQuickStatusUpdate = useCallback((task: Task, newStatus: TaskStatus) => {
      let confirmMsg = "";
      if (newStatus === TaskStatus.REVIEW) confirmMsg = "Xác nhận đã hoàn thành và gửi duyệt?";
      if (newStatus === TaskStatus.DONE) confirmMsg = "Xác nhận nghiệm thu công việc này?";
      if (newStatus === TaskStatus.IN_PROGRESS && task.status === TaskStatus.REVIEW) confirmMsg = "Yêu cầu chỉnh sửa lại công việc?";

      if (confirmMsg && !window.confirm(confirmMsg)) return;

      onUpdateTask({ ...task, status: newStatus });
      setLastUpdatedTaskId(task.id);
  }, [onUpdateTask]);

  const handleConfirmDelete = (taskId: string) => {
      setDeleteModalState({ isOpen: true, taskId });
  };

  const executeDelete = () => {
    if (deleteModalState.taskId) {
        onDeleteTask(deleteModalState.taskId);
        if (editingTask && editingTask.id === deleteModalState.taskId) {
            setIsModalOpen(false);
        }
    }
    setDeleteModalState({ isOpen: false, taskId: null });
  };

  const toggleSupporter = (memberId: string) => {
      setTaskSupporters(prev => 
         prev.includes(memberId) 
         ? prev.filter(id => id !== memberId) 
         : [...prev, memberId]
      );
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, assigneeId: string) => {
    if (!canEditTask(currentUser, assigneeId, rolePermissions)) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== status) {
      if (canEditTask(currentUser, task.assigneeId, rolePermissions)) {
          onUpdateTask({ ...task, status });
          setLastUpdatedTaskId(taskId);
      } else {
          alert('Bạn không có quyền thay đổi trạng thái công việc này.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
        setDragOverColumn(status);
    }
  };

  const handleDragEnd = () => {
      setDragOverColumn(null);
  };

  const handleAIAnalysis = async (task: Task) => {
    setAnalyzingId(task.id);
    const analysis = await analyzeTask(task.description);
    setAiSuggestion({
        isOpen: true,
        taskTitle: task.title,
        content: analysis
    });
    setAnalyzingId(null);
  };

  const isFormDeadlineOverdue = () => {
    if (!taskDeadline) return false;
    const today = new Date();
    const d = new Date(taskDeadline);
    return d < today;
  };

  // --- TIME NAVIGATION HELPERS ---
  const handleTimeNavigate = (direction: -1 | 1 | 0) => {
      if (direction === 0) {
          setCurrentDate(new Date());
          return;
      }

      const newDate = new Date(currentDate);
      if (timeView === 'DAY') {
          newDate.setDate(newDate.getDate() + direction);
      } else if (timeView === 'WEEK') {
          newDate.setDate(newDate.getDate() + (direction * 7));
      } else if (timeView === 'MONTH') {
          newDate.setMonth(newDate.getMonth() + direction);
      }
      setCurrentDate(newDate);
  };

  const getTimeLabel = () => {
      if (timeView === 'DAY') {
          return `Ngày ${currentDate.toLocaleDateString('vi-VN')}`;
      } else if (timeView === 'WEEK') {
          // Get start of week (Monday)
          const d = new Date(currentDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const start = new Date(d.setDate(diff));
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          
          // Get week number
          const weekNum = Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
          
          return `Tuần ${weekNum} (${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1})`;
      } else if (timeView === 'MONTH') {
          return `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
      }
      return '';
  };

  // ... (Sort and View logic remains same) ...
  const handleColumnSortToggle = (status: TaskStatus) => {
    setColumnSorts(prev => {
        const current = prev[status];
        let next: SortConfig;
        
        if (current.field === 'PRIORITY' && current.direction === 'DESC') {
            next = { field: 'PRIORITY', direction: 'ASC' };
        } else if (current.field === 'PRIORITY' && current.direction === 'ASC') {
            next = { field: 'DEADLINE', direction: 'ASC' };
        } else if (current.field === 'DEADLINE' && current.direction === 'ASC') {
            next = { field: 'DEADLINE', direction: 'DESC' };
        } else {
            next = { field: 'PRIORITY', direction: 'DESC' };
        }
        return { ...prev, [status]: next };
    });
  };

  const handleListSort = (field: SortField) => {
      setListSort(prev => {
          if (prev.field === field) {
              return { field, direction: prev.direction === 'ASC' ? 'DESC' : 'ASC' };
          }
          return { field, direction: 'ASC' };
      });
  };

  const sortTasks = (tasksToList: Task[], config: SortConfig) => {
      return [...tasksToList].sort((a, b) => {
          if (config.field === 'PRIORITY') {
              const pMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
              const valA = pMap[a.priority];
              const valB = pMap[b.priority];
              if (valA !== valB) {
                  return config.direction === 'DESC' ? valB - valA : valA - valB;
              }
              return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          } else if (config.field === 'DEADLINE') {
              const timeA = new Date(a.deadline).getTime();
              const timeB = new Date(b.deadline).getTime();
              if (timeA !== timeB) {
                  return config.direction === 'ASC' ? timeA - timeB : timeB - timeA;
              }
              const pMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
              return pMap[b.priority] - pMap[a.priority];
          } else {
              return config.direction === 'ASC' 
                ? a.title.localeCompare(b.title) 
                : b.title.localeCompare(a.title);
          }
      });
  };

  const columns = [
    { id: TaskStatus.TODO, label: 'Chưa thực hiện', color: 'bg-slate-50', borderColor: 'border-slate-200' },
    { id: TaskStatus.IN_PROGRESS, label: 'Đang thực hiện', color: 'bg-blue-50', borderColor: 'border-blue-100' },
    { id: TaskStatus.REVIEW, label: 'Chờ duyệt', color: 'bg-orange-50', borderColor: 'border-orange-100' },
    { id: TaskStatus.DONE, label: 'Hoàn tất', color: 'bg-green-50', borderColor: 'border-green-100' },
    { id: TaskStatus.PENDING, label: 'Tạm hoãn', color: 'bg-purple-50', borderColor: 'border-purple-100' }, // Reordered
    { id: TaskStatus.CANCELLED, label: 'Đã hủy', color: 'bg-slate-100', borderColor: 'border-slate-200' }, // Reordered
  ];

  const priorityOptions = [
      { value: 'Low', label: 'Thấp', icon: ArrowDown, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
      { value: 'Medium', label: 'Trung bình', icon: Minus, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
      { value: 'High', label: 'Cao', icon: ArrowUp, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  ];

  // ... (Filtered logic) ...
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // --- BOARD VIEW LOGIC START ---
    if (currentUser.roleType === Role.BOARD) {
        // Board only sees tasks related to Manager/Deputy Manager (Level >= 3)
        // OR tasks explicitly assigned to them (unlikely but possible)
        const managerIds = members.filter(m => getRoleLevel(m.roleType) >= 3).map(m => m.id);
        
        result = result.filter(t => 
            managerIds.includes(t.assigneeId) || // Manager is doing the task
            managerIds.includes(t.assignerId) || // Manager assigned the task
            t.assigneeId === currentUser.id // Assigned to Board directly
        );
    }
    // --- BOARD VIEW LOGIC END ---

    // 1. FILTER BY ROLE MODE
    if (filterTaskMode === 'MY_TASKS') {
        result = result.filter(t => t.assigneeId === currentUser.id);
    } else if (filterTaskMode === 'ASSIGNED_BY_ME') {
        result = result.filter(t => t.assignerId === currentUser.id);
    } 
    // 'ALL' mode allows further filtering below

    // 2. TIME FILTER WITH NAVIGATION (UPDATED)
    if (timeView !== 'ALL') {
        if (timeView === 'DAY') {
            const selectedStr = currentDate.toISOString().split('T')[0];
            result = result.filter(t => t.deadline.startsWith(selectedStr));
        } else if (timeView === 'WEEK') {
            const d = new Date(currentDate);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const startOfWeek = new Date(d.setDate(diff));
            startOfWeek.setHours(0,0,0,0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23,59,59,999);

            result = result.filter(t => {
                const deadline = new Date(t.deadline);
                return deadline >= startOfWeek && deadline <= endOfWeek;
            });
        } else if (timeView === 'MONTH') {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();
            result = result.filter(t => {
                const deadline = new Date(t.deadline);
                return deadline.getMonth() === month && deadline.getFullYear() === year;
            });
        }
    }

    // 3. SEARCH
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQ) || 
        t.description.toLowerCase().includes(lowerQ)
      );
    }

    // 4. DEPARTMENT FILTER (Apply only if 'ALL' mode or if we want to filter within My Tasks too, but typically specific filters apply to All)
    // Let's allow specific filters to work in conjunction with Role Mode
    if (filterDepartment !== 'ALL') {
        result = result.filter(t => {
            const assignee = members.find(m => m.id === t.assigneeId);
            return assignee?.department === filterDepartment;
        });
    }

    // 5. ASSIGNEE FILTER (Specific person)
    // If Mode is MY_TASKS, this is redundant if filterAssignee != currentUser.id, but let's keep logic generic
    if (filterAssignee !== 'ALL') {
      result = result.filter(t => t.assigneeId === filterAssignee);
    }

    // 6. PRIORITY FILTER
    if (filterPriority !== 'ALL') {
      result = result.filter(t => t.priority === filterPriority);
    }

    // 7. DATE RANGE FILTER (Manual)
    if (dateRange.start) {
        result = result.filter(t => t.deadline >= dateRange.start);
    }
    if (dateRange.end) {
        result = result.filter(t => t.deadline <= dateRange.end);
    }

    return result;
  }, [tasks, searchQuery, filterTaskMode, timeView, currentDate, filterDepartment, filterAssignee, filterPriority, dateRange, currentUser.id, members, currentUser.roleType]); // Added roleType dependency

  // --- STATS CALCULATION (KPIs) ---
  const boardStats = useMemo(() => {
      const total = filteredTasks.length;
      const done = filteredTasks.filter(t => t.status === TaskStatus.DONE).length;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      
      const overdue = filteredTasks.filter(t => {
          if (t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED || t.status === TaskStatus.PENDING) return false;
          return new Date(t.deadline) < new Date();
      }).length;
      const onTimeRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

      // Quality: Rejection Rate (Logic approximate: In Progress after Review -> assume rejection? 
      // Hard to track history here without deep scan. 
      // Alternative: Just count current "Pending" or "Review" as active.
      // Let's stick to simple metrics available on Task object)
      
      // Checklist Progress
      let totalSub = 0;
      let doneSub = 0;
      filteredTasks.forEach(t => {
          if(t.subtasks) {
              totalSub += t.subtasks.length;
              doneSub += t.subtasks.filter(s => s.completed).length;
          }
      });
      const checklistRate = totalSub > 0 ? Math.round((doneSub/totalSub)*100) : 0;

      return { total, done, completionRate, overdue, onTimeRate, checklistRate };
  }, [filteredTasks]);

  // --- HISTORY LOGIC ---
  const getTaskLogs = (taskId: string) => {
      return allLogs.filter(log => log.targetId === taskId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Group logs for the global history panel
  const groupedActivityLogs = useMemo(() => {
      const groups: Record<string, AuditLog[]> = {};
      // Sort descending first
      const sortedLogs = [...allLogs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      sortedLogs.forEach(log => {
          const date = new Date(log.timestamp);
          // Format: "Thứ Hai, 20/10/2024" or just Date
          const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          if (!groups[dateStr]) groups[dateStr] = [];
          groups[dateStr].push(log);
      });
      return groups;
  }, [allLogs]);

  // ... (Rest of bulk handlers, renderListView) ...
  const clearFilters = () => {
    setSearchQuery('');
    setFilterDepartment('ALL');
    setFilterAssignee('ALL');
    setFilterPriority('ALL');
    setDateRange({ start: '', end: '' });
    setFilterTaskMode('ALL');
    setTimeView('ALL'); // Reset time view
    setCurrentDate(new Date()); // Reset navigation
  };

  const hasActiveFilters = searchQuery || filterDepartment !== 'ALL' || filterAssignee !== 'ALL' || filterPriority !== 'ALL' || dateRange.start || dateRange.end || filterTaskMode !== 'ALL' || timeView !== 'ALL';

  // -- Bulk Selection Handlers --
  const handleToggleTaskSelection = (taskId: string) => {
      setSelectedTaskIds(prev => 
          prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
  };

  const handleSelectAll = (isChecked: boolean) => {
      if (isChecked) {
          const editableTaskIds = filteredTasks
            .filter(t => canEditTask(currentUser, t.assigneeId, rolePermissions))
            .map(t => t.id);
          setSelectedTaskIds(editableTaskIds);
      } else {
          setSelectedTaskIds([]);
      }
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
      selectedTaskIds.forEach(id => {
          const task = tasks.find(t => t.id === id);
          if (task && canEditTask(currentUser, task.assigneeId, rolePermissions)) {
              onUpdateTask({ ...task, status });
          }
      });
      setSelectedTaskIds([]);
      setBulkActionOpen(null);
      alert(`Đã cập nhật trạng thái ${selectedTaskIds.length} công việc.`);
  };

  const handleBulkPriorityChange = (priority: 'Low' | 'Medium' | 'High') => {
      selectedTaskIds.forEach(id => {
          const task = tasks.find(t => t.id === id);
          if (task && canEditTask(currentUser, task.assigneeId, rolePermissions)) {
              onUpdateTask({ ...task, priority });
          }
      });
      setSelectedTaskIds([]);
      setBulkActionOpen(null);
      alert(`Đã cập nhật mức độ ưu tiên ${selectedTaskIds.length} công việc.`);
  };

  const handleBulkDelete = () => {
      if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedTaskIds.length} công việc đã chọn?`)) {
          selectedTaskIds.forEach(id => {
              if (canDeleteTask(currentUser, rolePermissions)) {
                  onDeleteTask(id);
              }
          });
          setSelectedTaskIds([]);
          alert('Đã xóa các công việc đã chọn.');
      }
  };

  const renderListView = () => {
    // ... (Keep existing List View logic, simplified for brevity here, assumed unchanged unless specified)
    // For this update, I'm focusing on the Modal logic mainly.
    const getStatusInfo = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.TODO: return { label: 'Chưa làm', class: 'border-slate-300 text-slate-500 bg-white' };
            case TaskStatus.IN_PROGRESS: return { label: 'Đang thực hiện', class: 'border-orange-300 text-orange-600 bg-white' };
            case TaskStatus.REVIEW: return { label: 'Chờ duyệt', class: 'border-blue-300 text-blue-600 bg-white' };
            case TaskStatus.DONE: return { label: 'Hoàn tất', class: 'border-green-400 text-green-600 bg-white' };
            case TaskStatus.PENDING: return { label: 'Tạm hoãn', class: 'border-purple-300 text-purple-600 bg-white' };
            case TaskStatus.CANCELLED: return { label: 'Đã hủy', class: 'border-slate-200 text-slate-400 bg-white line-through' };
            default: return { label: status, class: 'bg-white border-slate-200' };
        }
    };

    const sortedListTasks = sortTasks(filteredTasks, listSort);
    const allVisibleEditable = sortedListTasks.filter(t => canEditTask(currentUser, t.assigneeId, rolePermissions));
    const allSelected = allVisibleEditable.length > 0 && allVisibleEditable.every(t => selectedTaskIds.includes(t.id));

    const renderSortArrow = (field: SortField) => {
        if (listSort.field !== field) return <SortAsc size={14} className="text-slate-300 ml-1 opacity-0 group-hover:opacity-100" />;
        return listSort.direction === 'ASC' 
            ? <ArrowUp size={14} className="text-blue-600 ml-1" />
            : <ArrowDown size={14} className="text-blue-600 ml-1" />;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 mb-20 md:mb-0">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={allSelected} 
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </th>
                            <th 
                                className="p-4 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                                onClick={() => handleListSort('TITLE')}
                            >
                                <div className="flex items-center">Tên công việc {renderSortArrow('TITLE')}</div>
                            </th>
                            <th className="p-4 w-28">Thực hiện</th>
                            <th className="p-4 w-48">Tiến độ</th>
                            <th className="p-4 w-36">Trạng thái</th>
                            <th className="p-4 w-28 hidden lg:table-cell">Giao việc</th>
                            <th className="p-4 w-24 hidden lg:table-cell text-center">Ưu tiên</th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {sortedListTasks.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                    Không tìm thấy công việc nào phù hợp.
                                </td>
                            </tr>
                        ) : (
                            sortedListTasks.map(task => {
                                const assignee = members.find(m => m.id === task.assigneeId);
                                const assigner = members.find(m => m.id === task.assignerId);
                                const canEdit = canEditTask(currentUser, task.assigneeId, rolePermissions);
                                const isSelected = selectedTaskIds.includes(task.id);
                                
                                const subtasks = task.subtasks || [];
                                const total = subtasks.length;
                                const completed = subtasks.filter(s => s.completed).length;
                                
                                let percent = 0;
                                if (total > 0) {
                                    percent = Math.round((completed / total) * 100);
                                } else if (task.status === TaskStatus.DONE) {
                                    percent = 100;
                                } else if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REVIEW) {
                                    percent = 50; 
                                }

                                const statusInfo = getStatusInfo(task.status);

                                return (
                                    <tr key={task.id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4 text-center">
                                            {canEdit && (
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => handleToggleTaskSelection(task.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            )}
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            <div className="font-medium text-slate-800 truncate" title={task.title}>{task.title}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{formatDisplayDateTime(task.deadline)}</div>
                                        </td>
                                        <td className="p-4">
                                            <Avatar member={assignee} size="w-8 h-8" showName={false} />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 w-full max-w-[140px]">
                                                <span className="text-xs text-slate-500 font-medium">{percent}%</span>
                                                <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-500 ${percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                        style={{width: `${percent}%`}}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusInfo.class}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="p-4 hidden lg:table-cell">
                                            <Avatar member={assigner} size="w-8 h-8" showName={false} />
                                        </td>
                                        <td className="p-4 hidden lg:table-cell text-center">
                                            {task.priority === 'High' && <Flag size={18} className="text-red-500 mx-auto fill-red-500" />}
                                            {task.priority === 'Medium' && <Flag size={18} className="text-yellow-500 mx-auto fill-yellow-500" />}
                                            {task.priority === 'Low' && <Flag size={18} className="text-slate-300 mx-auto" />}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                {canEdit && (
                                                    <button onClick={() => openEditModal(task)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded">
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
                                                {canDeleteTask(currentUser, rolePermissions) && (
                                                    <button onClick={() => handleConfirmDelete(task.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
        {/* ... (Header and filters) ... */}
       <div className="flex flex-col space-y-4 mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">Quản lý giao công việc</h2>
                {urgentCount > 0 && (
                    <div className="flex items-center bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200 animate-pulse whitespace-nowrap">
                        <Clock size={14} className="mr-1.5" />
                        {urgentCount} cần gấp
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2 self-end md:self-auto">
                 {/* NEW: KPI REPORT TOGGLE BUTTON */}
                 <button 
                    onClick={() => setShowStats(!showStats)}
                    className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-all text-sm font-bold whitespace-nowrap border ${
                        showStats 
                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                 >
                    <BarChart2 size={18} className="mr-2" />
                    Báo cáo & KPI
                 </button>

                 {/* NEW: ACTIVITY LOG BUTTON */}
                 <button 
                    onClick={() => setShowHistoryPanel(true)}
                    className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-all text-sm font-bold whitespace-nowrap border ${
                        showHistoryPanel 
                        ? 'bg-orange-50 text-orange-700 border-orange-200' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                 >
                    <History size={18} className="mr-2" />
                    Nhật ký
                 </button>

                 <button 
                  onClick={openNewTaskModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-lg shadow-blue-900/20 transition-all text-sm font-medium whitespace-nowrap"
                >
                  <Plus size={18} className="mr-2" />
                  Thêm công việc
                </button>
            </div>
          </div>

          {/* ... (Filters) ... */}
          <div className="flex flex-col lg:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Tìm theo tiêu đề, mô tả..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>

             <div className="flex flex-wrap gap-2">
                {/* ROLE MODE TABS */}
                <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0">
                    <button
                        onClick={() => setFilterTaskMode('ALL')}
                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            filterTaskMode === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Users size={14} className="mr-1.5"/> Tất cả
                    </button>
                    <button
                        onClick={() => { setFilterTaskMode('MY_TASKS'); setFilterAssignee('ALL'); }}
                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            filterTaskMode === 'MY_TASKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <User size={14} className="mr-1.5"/> Tôi làm
                    </button>
                    <button
                        onClick={() => { setFilterTaskMode('ASSIGNED_BY_ME'); setFilterAssignee('ALL'); }}
                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            filterTaskMode === 'ASSIGNED_BY_ME' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Send size={14} className="mr-1.5"/> Tôi giao
                    </button>
                </div>

                {/* NEW TIME VIEW FILTER WITH NAVIGATION */}
                <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0 items-center">
                    <button
                        onClick={() => setTimeView('ALL')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            timeView === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Tất cả thời gian"
                    >
                        <CalendarDays size={14}/>
                    </button>
                    <button
                        onClick={() => { setTimeView('DAY'); setCurrentDate(new Date()); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            timeView === 'DAY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Ngày
                    </button>
                    <button
                        onClick={() => { setTimeView('WEEK'); setCurrentDate(new Date()); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            timeView === 'WEEK' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Tuần
                    </button>
                    <button
                        onClick={() => { setTimeView('MONTH'); setCurrentDate(new Date()); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                            timeView === 'MONTH' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Tháng
                    </button>

                    {/* Navigation Controls (Visible only when filtering by time) */}
                    {timeView !== 'ALL' && (
                        <div className="flex items-center ml-2 border-l border-slate-300 pl-2 space-x-1 animate-fade-in">
                            <button onClick={() => handleTimeNavigate(-1)} className="p-1 hover:bg-white rounded text-slate-600"><ChevronLeft size={14}/></button>
                            <span className="text-[10px] font-bold text-slate-700 min-w-[80px] text-center">{getTimeLabel()}</span>
                            <button onClick={() => handleTimeNavigate(1)} className="p-1 hover:bg-white rounded text-slate-600"><ChevronRight size={14}/></button>
                            <button onClick={() => handleTimeNavigate(0)} className="text-[10px] text-blue-600 hover:underline ml-1">H.nay</button>
                        </div>
                    )}
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg flex-shrink-0">
                    <button
                        onClick={() => setViewMode('BOARD')}
                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                            viewMode === 'BOARD' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <LayoutGrid size={14} className="mr-1.5"/> 
                    </button>
                    <button
                        onClick={() => setViewMode('LIST')}
                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                            viewMode === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <List size={14} className="mr-1.5"/> 
                    </button>
                </div>
            </div>

             <div className="hidden lg:block min-w-[150px]">
                 <select 
                    value={filterDepartment}
                    onChange={(e) => { setFilterDepartment(e.target.value); setFilterTaskMode('ALL'); }}
                    className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                    title="Lọc theo bộ phận"
                  >
                      <option value="ALL">Tất cả bộ phận</option>
                      <option value="DieuHanh">Ban Điều Hành</option>
                      <option value="Media">Media & Production</option>
                      <option value="Content">Content & Social</option>
                      <option value="Seeding">Seeding</option>
                  </select>
             </div>
             
             {/* Filter Menu button and panel removed per request */}
             
             {hasActiveFilters && (
                 <button 
                    onClick={clearFilters}
                    className="flex items-center justify-center px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                    title="Xóa bộ lọc"
                 >
                     <X size={16} />
                 </button>
             )}
          </div>
      </div>

      {/* --- KPI DASHBOARD PANEL --- */}
      {showStats && (
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 mb-6 animate-fade-in relative z-20">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center">
                      <Activity size={20} className="mr-2 text-indigo-600"/> Báo cáo hiệu suất nhanh
                  </h3>
                  <button onClick={() => setShowStats(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-full">
                      <X size={16}/>
                  </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="text-slate-500 text-xs font-bold uppercase mb-1">Tổng công việc</div>
                      <div className="text-2xl font-black text-slate-800">{boardStats.total}</div>
                      <div className="text-[10px] text-slate-400 mt-1">Trong bộ lọc hiện tại</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <div className="text-green-700 text-xs font-bold uppercase mb-1">Hoàn thành</div>
                      <div className="text-2xl font-black text-green-700">{boardStats.completionRate}%</div>
                      <div className="w-full bg-green-200 h-1 rounded-full mt-2 overflow-hidden">
                          <div className="bg-green-600 h-full" style={{width: `${boardStats.completionRate}%`}}></div>
                      </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <div className="text-blue-700 text-xs font-bold uppercase mb-1">Đúng hạn</div>
                      <div className="text-2xl font-black text-blue-700">{boardStats.onTimeRate}%</div>
                      <div className="text-[10px] text-blue-600 mt-1">{boardStats.overdue} việc quá hạn</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <div className="text-purple-700 text-xs font-bold uppercase mb-1">Checklist</div>
                      <div className="text-2xl font-black text-purple-700">{boardStats.checklistRate}%</div>
                      <div className="text-[10px] text-purple-600 mt-1">Tiến độ chi tiết</div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 h-full min-h-0 flex flex-col mb-20 md:mb-0">
        {viewMode === 'BOARD' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 h-full pb-2 flex-1 overflow-x-auto min-w-[1200px]">
                {columns.map((column) => {
                    const columnTasks = filteredTasks.filter(t => t.status === column.id);
                    const sortedColumnTasks = sortTasks(columnTasks, columnSorts[column.id]);
                    const currentSort = columnSorts[column.id];

                    return (
                        <div 
                        key={column.id} 
                        className={`rounded-xl flex flex-col transition-colors duration-200 min-w-[280px] ${
                            dragOverColumn === column.id 
                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' 
                            : `${column.color} border ${column.borderColor}`
                        }`}
                        onDrop={(e) => handleDrop(e, column.id)}
                        onDragOver={(e) => handleDragOver(e, column.id)}
                        >
                        <div className="flex justify-between items-center p-4 border-b border-white/50">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 text-sm whitespace-nowrap">{column.label}</h3>
                                <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm">
                                    {columnTasks.length}
                                </span>
                            </div>
                            
                            <button
                                onClick={() => handleColumnSortToggle(column.id)}
                                className="flex items-center text-[10px] text-slate-500 bg-white/60 hover:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-200 transition-all"
                                title="Đổi kiểu sắp xếp (Ưu tiên / Hạn chót)"
                            >
                                <ArrowUpDown size={12} className="mr-1" />
                                {currentSort.direction === 'ASC' ? <ArrowUp size={10} className="ml-0.5" /> : <ArrowDown size={10} className="ml-0.5" />}
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-[150px]">
                            {sortedColumnTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-10">
                                    <List size={32} strokeWidth={1.5} className="mb-2" />
                                    <p className="text-xs font-medium">Trống</p>
                                </div>
                            ) : (
                                sortedColumnTasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        members={members}
                                        currentUser={currentUser}
                                        isOverdue={isTaskOverdue(task.deadline, task.status)}
                                        isJustUpdated={lastUpdatedTaskId === task.id}
                                        analyzingId={analyzingId}
                                        isSelected={selectedTaskIds.includes(task.id)}
                                        onToggleSelect={handleToggleTaskSelection}
                                        onEdit={openEditModal}
                                        onDelete={handleConfirmDelete}
                                        onAnalyze={handleAIAnalysis}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        onQuickStatusChange={handleQuickStatusUpdate} // New prop for quick actions
                                        rolePermissions={rolePermissions} // Truyền quyền động
                                    />
                                ))
                            )}
                        </div>
                        </div>
                    );
                })}
             </div>
        ) : (
             renderListView()
        )}
      </div>

      {/* --- BULK ACTION TOOLBAR (Unchanged) --- */}
      {selectedTaskIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-white rounded-full shadow-2xl border border-slate-200 px-6 py-3 flex items-center gap-4 animate-fade-in w-[90%] md:w-auto md:min-w-[300px] justify-between overflow-x-auto">
               <div className="flex items-center gap-2 font-bold text-slate-700 border-r border-slate-200 pr-4 whitespace-nowrap">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                      {selectedTaskIds.length}
                  </span>
                  <span className="text-sm hidden sm:inline">Đã chọn</span>
              </div>

              <div className="flex items-center gap-2">
                  <div className="relative group">
                      <button 
                        onClick={() => setBulkActionOpen(bulkActionOpen === 'STATUS' ? null : 'STATUS')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${bulkActionOpen === 'STATUS' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                          <Circle size={14} strokeWidth={2.5}/> Trạng thái <ChevronUp size={12}/>
                      </button>
                      
                      {bulkActionOpen === 'STATUS' && (
                          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-100 p-1 w-40 overflow-hidden flex flex-col">
                              {/* SAFEGUARD: Map over enum values cast to array */}
                              {(Object.values(TaskStatus) as TaskStatus[]).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleBulkStatusChange(s)}
                                    className="text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                                  >
                                      {s}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="relative group">
                      <button 
                        onClick={() => setBulkActionOpen(bulkActionOpen === 'PRIORITY' ? null : 'PRIORITY')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${bulkActionOpen === 'PRIORITY' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-600'}`}
                      >
                          <AlertCircle size={14} strokeWidth={2.5}/> Ưu tiên <ChevronUp size={12}/>
                      </button>

                      {bulkActionOpen === 'PRIORITY' && (
                          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-100 p-1 w-40 overflow-hidden flex flex-col">
                              {/* SAFEGUARD: Explicitly define priority array to avoid inference issues */}
                              {(['Low', 'Medium', 'High'] as const).map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => handleBulkPriorityChange(p)}
                                    className="text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                                  >
                                      {p}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  {canDeleteTask(currentUser, rolePermissions) && (
                      <button 
                        onClick={handleBulkDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                      >
                          <Trash2 size={14} /> Xóa
                      </button>
                  )}
              </div>

              <button 
                onClick={() => setSelectedTaskIds([])}
                className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                  <X size={16} />
              </button>
          </div>
      )}

      {/* --- NEW: GLOBAL HISTORY PANEL --- */}
      {showHistoryPanel && (
          <>
            <div 
                className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-sm transition-opacity" 
                onClick={() => setShowHistoryPanel(false)}
            ></div>
            <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-[65] border-l border-slate-200 transform transition-transform animate-slide-in-right flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center">
                            <History size={20} className="mr-2 text-blue-600" />
                            Nhật ký Hoạt động
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Theo dõi thay đổi trong dự án</p>
                    </div>
                    <button 
                        onClick={() => setShowHistoryPanel(false)} 
                        className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-slate-50/50">
                    <div className="space-y-8 relative pl-2">
                        {/* Timeline Vertical Line */}
                        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-200 z-0"></div>

                        {Object.entries(groupedActivityLogs).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
                                <History size={48} strokeWidth={1} className="mb-3"/>
                                <span className="text-sm">Chưa có hoạt động nào được ghi lại.</span>
                            </div>
                        ) : (
                            // SAFEGUARD: Cast Object.entries result to ensure correct typing for .map
                            (Object.entries(groupedActivityLogs) as [string, AuditLog[]][]).map(([date, items]) => (
                                <div key={date} className="relative z-10">
                                    {/* Date Header Sticky */}
                                    <div className="sticky top-0 z-20 mb-4 -ml-2">
                                        <span className="inline-block bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide">
                                            {date}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-4 pl-4">
                                        {items.map(log => {
                                            const actor = members.find(m => m.id === log.actorId) || { name: log.actorName, avatar: undefined };
                                            
                                            // Action Styling
                                            let icon = <Activity size={14} className="text-white"/>;
                                            let bgColor = "bg-slate-400";
                                            let ringColor = "ring-slate-100";
                                            let actionLabel: string = log.action;
                                            
                                            if (log.action === 'CREATE') { 
                                                icon = <Plus size={14} className="text-white"/>; 
                                                bgColor = "bg-emerald-500";
                                                ringColor = "ring-emerald-100"; 
                                                actionLabel = "Tạo mới";
                                            }
                                            else if (log.action === 'UPDATE') { 
                                                icon = <Edit3 size={14} className="text-white"/>; 
                                                bgColor = "bg-blue-500"; 
                                                ringColor = "ring-blue-100";
                                                actionLabel = "Cập nhật";
                                            }
                                            else if (log.action === 'DELETE') { 
                                                icon = <Trash2 size={14} className="text-white"/>; 
                                                bgColor = "bg-red-500"; 
                                                ringColor = "ring-red-100";
                                                actionLabel = "Xóa bỏ";
                                            }

                                            return (
                                                <div key={log.id} className="relative flex gap-4 group">
                                                    {/* Connector Line Horizontal */}
                                                    <div className="absolute top-4 -left-[22px] w-4 h-0.5 bg-slate-200"></div>

                                                    {/* Icon Node */}
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10 flex-shrink-0 ${bgColor} ring-4 ${ringColor} transition-transform group-hover:scale-110`}>
                                                        {icon}
                                                    </div>

                                                    {/* Content Card */}
                                                    <div className="flex-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                                        <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-50">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                                                                    {actor.avatar ? <img src={actor.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center w-full h-full text-[8px] font-bold text-slate-500">{actor.name?.charAt(0)}</div>}
                                                                </div>
                                                                <span className="font-bold text-xs text-slate-700">{actor.name}</span>
                                                            </div>
                                                            <span className="text-[9px] text-slate-400 font-mono">
                                                                {new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false})}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="text-xs text-slate-600 leading-relaxed break-words font-medium">
                                                            {/* Highlight key terms if possible, for now just text */}
                                                            {log.details}
                                                        </div>

                                                        {/* Optional Badge for Action Type */}
                                                        <div className="mt-2 flex">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                                                log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                log.action === 'DELETE' ? 'bg-red-50 text-red-600 border-red-100' :
                                                                'bg-blue-50 text-blue-600 border-blue-100'
                                                            }`}>
                                                                {actionLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                {/* Footer (Optional) */}
                <div className="p-3 border-t border-slate-100 bg-white text-center">
                    <button 
                        onClick={() => setShowHistoryPanel(false)}
                        className="text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors"
                    >
                        Đóng nhật ký
                    </button>
                </div>
            </div>
          </>
      )}

      {/* Modal - Optimized for Mobile & Professional Look */}
       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center sm:pt-10 p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in transition-all">
          <div className="w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all scale-100 opacity-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center flex-shrink-0 z-10 relative">
              <h3 className="font-bold text-slate-800 text-lg flex items-center">
                 {editingTask ? <Pencil size={20} className="mr-2 text-blue-600"/> : <Plus size={22} className="mr-2 text-blue-600"/>}
                 {editingTask ? 'Chỉnh sửa công việc' : 'Thêm công việc mới'}
              </h3>
              
              {/* TAB SWITCHER IN MODAL */}
              {editingTask && (
                  <div className="flex bg-slate-100 p-1 rounded-lg ml-auto mr-4">
                      <button 
                          type="button"
                          onClick={() => setActiveModalTab('INFO')}
                          className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeModalTab === 'INFO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <FileText size={14} className="mr-1.5"/> Chi tiết
                      </button>
                      <button 
                          type="button"
                          onClick={() => setActiveModalTab('HISTORY')}
                          className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeModalTab === 'HISTORY' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          <History size={14} className="mr-1.5"/> Nhật ký
                      </button>
                  </div>
              )}

              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                  <X size={24} />
              </button>
            </div>
            
            {activeModalTab === 'INFO' ? (
                <form onSubmit={handleSaveTask} className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white relative">
                   <div className="space-y-6">
                      {/* Title Section */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tiêu đề công việc <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            required
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder="VD: Viết bài SEO, Thiết kế Banner..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:font-normal placeholder:text-slate-300"
                            autoFocus
                          />
                      </div>
                      
                      {/* People Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           {/* Assigner */}
                           <div className="relative group" ref={assignerDropdownRef}>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Người giao việc</label>
                              
                              <button
                                  type="button"
                                  onClick={() => {
                                      if (currentUser.roleType === 'Manager') {
                                          setIsAssignerDropdownOpen(!isAssignerDropdownOpen);
                                      }
                                  }}
                                  className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 flex items-center justify-between outline-none focus:ring-2 focus:ring-blue-500 transition-all ${currentUser.roleType === 'Manager' ? 'bg-white hover:border-blue-300 cursor-pointer' : 'bg-slate-50 cursor-default'}`}
                              >
                                  {taskAssigner ? (
                                      <div className="flex items-center gap-3">
                                          <Avatar member={members.find(m => m.id === taskAssigner)} size="w-8 h-8" />
                                          <div className="flex flex-col items-start min-w-0">
                                              <span className="font-bold text-sm text-slate-800 leading-tight truncate max-w-[140px]">
                                                  {members.find(m => m.id === taskAssigner)?.name}
                                              </span>
                                              <span className="text-[10px] text-slate-500 leading-tight truncate">
                                                  {members.find(m => m.id === taskAssigner)?.role}
                                              </span>
                                          </div>
                                      </div>
                                  ) : (
                                      <span className="text-slate-400 text-sm">Chọn người giao...</span>
                                  )}
                                  {currentUser.roleType === 'Manager' && (
                                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isAssignerDropdownOpen ? 'rotate-180' : ''}`} />
                                  )}
                              </button>

                              {isAssignerDropdownOpen && currentUser.roleType === 'Manager' && (
                                  <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[60] max-h-60 overflow-y-auto custom-scrollbar animate-fade-in p-1">
                                      {members.map(m => (
                                          <div
                                              key={m.id}
                                              onClick={() => {
                                                  setTaskAssigner(m.id);
                                                  setIsAssignerDropdownOpen(false);
                                              }}
                                              className={`flex items-center p-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${taskAssigner === m.id ? 'bg-blue-50' : ''}`}
                                          >
                                              <Avatar member={m} size="w-8 h-8" className="mr-3" />
                                              <div className="flex-1 min-w-0">
                                                  <div className={`font-bold text-sm truncate ${taskAssigner === m.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                                      {m.name}
                                                  </div>
                                                  <div className="text-xs text-slate-500 truncate">
                                                      {m.role}
                                                  </div>
                                              </div>
                                              {taskAssigner === m.id && <CheckCircle2 size={16} className="text-blue-600 ml-2" />}
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>

                          {/* Assignee */}
                          <div className="relative group" ref={assigneeDropdownRef}>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Người thực hiện</label>
                              
                              <button
                                  type="button"
                                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 flex items-center justify-between outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-blue-300 transition-all cursor-pointer shadow-sm hover:shadow-md"
                              >
                                  {taskAssignee ? (
                                      <div className="flex items-center gap-3">
                                          <Avatar member={members.find(m => m.id === taskAssignee)} size="w-8 h-8" />
                                          <div className="flex flex-col items-start min-w-0">
                                              <span className="font-bold text-sm text-slate-800 leading-tight truncate max-w-[140px]">
                                                  {members.find(m => m.id === taskAssignee)?.name}
                                              </span>
                                              <span className="text-[10px] text-slate-500 leading-tight truncate">
                                                  {members.find(m => m.id === taskAssignee)?.role}
                                              </span>
                                          </div>
                                      </div>
                                  ) : (
                                      <span className="text-slate-400 text-sm">Chọn người thực hiện...</span>
                                  )}
                                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isAssigneeDropdownOpen && (
                                  <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[60] max-h-64 overflow-y-auto custom-scrollbar animate-fade-in p-1">
                                      {members.map(m => {
                                          const currentUserLevel = getRoleLevel(currentUser.roleType);
                                          const targetLevel = getRoleLevel(m.roleType);
                                          const isDisabled = targetLevel > currentUserLevel;

                                          return (
                                              <div
                                                  key={m.id}
                                                  onClick={() => {
                                                      if (!isDisabled) {
                                                          setTaskAssignee(m.id);
                                                          if (taskSupporters.includes(m.id)) toggleSupporter(m.id);
                                                          setIsAssigneeDropdownOpen(false);
                                                      }
                                                  }}
                                                  className={`flex items-center p-2 rounded-lg cursor-pointer transition-all mb-1 last:mb-0
                                                      ${isDisabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:bg-blue-50'}
                                                      ${taskAssignee === m.id ? 'bg-blue-50 ring-1 ring-blue-100' : ''}
                                                  `}
                                              >
                                                  <Avatar member={m} size="w-8 h-8" className="mr-3" />
                                                  <div className="flex-1 min-w-0">
                                                      <div className={`font-bold text-sm truncate ${taskAssignee === m.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                                          {m.name}
                                                      </div>
                                                      <div className="text-xs text-slate-500 truncate flex items-center">
                                                          {m.role}
                                                          {isDisabled && <span className="ml-1 text-[9px] text-red-500 font-bold bg-red-50 px-1.5 rounded border border-red-100">Cấp trên</span>}
                                                      </div>
                                                  </div>
                                                  {isDisabled && <Lock size={14} className="text-slate-300 ml-2" />}
                                                  {taskAssignee === m.id && !isDisabled && <CheckCircle2 size={16} className="text-blue-600 ml-2" />}
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Time Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Thời gian bắt đầu <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <input 
                                    type="datetime-local" 
                                    required
                                    value={taskStartDate}
                                    onChange={(e) => setTaskStartDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all hover:border-blue-300 bg-slate-50 focus:bg-white"
                                />
                                <Calendar size={18} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Hạn chót (Deadline) <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <input 
                                    type="datetime-local" 
                                    required
                                    value={taskDeadline}
                                    onChange={(e) => setTaskDeadline(e.target.value)}
                                    className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all hover:border-blue-300 ${isFormDeadlineOverdue() ? 'text-red-600 font-bold border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                                />
                                <Calendar size={18} className={`absolute left-3 top-3 pointer-events-none ${isFormDeadlineOverdue() ? 'text-red-500' : 'text-slate-400'}`} />
                              </div>
                              {isFormDeadlineOverdue() && <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center"><AlertCircle size={10} className="mr-1"/> Deadline không hợp lệ</p>}
                          </div>
                      </div>
                      
                      {/* Supporters */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Người hỗ trợ</label>
                          <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50 max-h-32 overflow-y-auto custom-scrollbar">
                              {members.filter(m => m.id !== taskAssignee).map(member => {
                                  const currentUserLevel = getRoleLevel(currentUser.roleType);
                                  const targetLevel = getRoleLevel(member.roleType);
                                  const isManager = currentUserLevel >= 3;
                                  const isHigherLevel = targetLevel > currentUserLevel;
                                  const isDisabled = isHigherLevel && !isManager;

                                  return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => !isDisabled && toggleSupporter(member.id)}
                                        disabled={isDisabled}
                                        className={`flex items-center px-2.5 py-1 rounded-full text-xs border transition-all ${
                                            isDisabled 
                                            ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed opacity-60' 
                                            : taskSupporters.includes(member.id)
                                                ? 'bg-blue-100 border-blue-200 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="w-4 h-4 rounded-full bg-slate-200 overflow-hidden mr-1.5 flex items-center justify-center text-[8px] font-bold">
                                            {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover"/> : member.name.charAt(0)}
                                        </div>
                                        {member.name} {isDisabled && <Lock size={10} className="ml-1 opacity-50" />}
                                    </button>
                                  );
                              })}
                              {members.filter(m => m.id !== taskAssignee).length === 0 && <span className="text-xs text-slate-400 italic">Không còn nhân sự khác</span>}
                          </div>
                      </div>

                       {/* Priority & Type */}
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Mức độ ưu tiên</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    {priorityOptions.map(option => (
                                        <label 
                                            key={option.value} 
                                            className={`flex-1 flex items-center justify-center py-2 rounded-lg cursor-pointer transition-all ${
                                                taskPriority === option.value 
                                                ? 'bg-white shadow-sm ring-1 ring-slate-200 font-bold' 
                                                : 'hover:text-slate-800 text-slate-500'
                                            }`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="priority" 
                                                value={option.value} 
                                                checked={taskPriority === option.value}
                                                onChange={() => setTaskPriority(option.value as any)}
                                                className="hidden"
                                            />
                                            <option.icon size={14} className={`mr-1.5 ${taskPriority === option.value ? option.color.replace('text-', '') : 'text-current'}`} />
                                            <span className={`text-xs ${taskPriority === option.value ? option.color : 'text-current'}`}>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Loại công việc</label>
                                <div className="relative">
                                    <select 
                                        value={taskType}
                                        onChange={(e) => setTaskType(e.target.value as TaskType)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px] font-medium appearance-none"
                                    >
                                        <option value="GENERAL">📝 Công việc chung</option>
                                        <option value="MEDIA">🎬 Sản xuất Media</option>
                                        <option value="CONTENT">✍️ Sáng tạo Content</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>
                      </div>

                      {editingTask && (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Trạng thái hiện tại</label>
                              <div className="relative">
                                <select 
                                    value={taskStatus}
                                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    {/* Safe iteration */}
                                    {(Object.values(TaskStatus) as TaskStatus[]).map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none"/>
                              </div>
                          </div>
                      )}
                      
                      {/* DYNAMIC FIELDS BASED ON TASK TYPE */}
                      {taskType === 'MEDIA' && (
                           <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-fade-in relative overflow-hidden">
                               <div className="absolute top-0 right-0 p-2 opacity-5"><Video size={64}/></div>
                               <label className="block text-xs font-bold text-purple-800 mb-1 flex items-center uppercase tracking-wide">
                                   <LinkIcon size={12} className="mr-1.5"/> Link File Thiết kế / Video
                               </label>
                               <input 
                                    type="url" 
                                    value={mediaUrl}
                                    onChange={(e) => setMediaUrl(e.target.value)}
                                    placeholder="https://drive.google.com/..."
                                    className="w-full border border-purple-200 bg-white/80 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-sm text-blue-600 font-medium"
                               />
                           </div>
                      )}

                      {taskType === 'CONTENT' && (
                           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in relative overflow-hidden">
                               <div className="absolute top-0 right-0 p-2 opacity-5"><AlignLeft size={64}/></div>
                               <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center uppercase tracking-wide">
                                   <PenTool size={12} className="mr-1.5"/> Nội dung bài viết (Draft)
                               </label>
                               <textarea 
                                    value={contentDraft}
                                    onChange={(e) => setContentDraft(e.target.value)}
                                    placeholder="Viết nháp nội dung tại đây..."
                                    className="w-full border border-blue-200 bg-white/80 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[100px] resize-y"
                                />
                           </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mô tả chi tiết</label>
                          <textarea 
                            rows={3}
                            value={taskDesc}
                            onChange={(e) => setTaskDesc(e.target.value)}
                            placeholder="Mô tả cụ thể yêu cầu công việc..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm leading-relaxed"
                          />
                      </div>

                      {/* Checklist / Subtasks Section */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200 flex justify-between items-center">
                              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center">
                                  <ListTodo size={14} className="mr-2 text-blue-600"/> Tiến độ chi tiết (Checklist)
                              </label>
                              <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-bold shadow-sm">
                                  {taskSubtasks.filter(s => s.completed).length}/{taskSubtasks.length}
                              </span>
                          </div>
                          
                          <div className="p-4 space-y-3">
                              <div className="space-y-2">
                                  {taskSubtasks.map(subtask => (
                                      <div key={subtask.id} className="flex items-start gap-3 group/item">
                                          <button
                                              type="button"
                                              onClick={() => handleToggleSubtask(subtask.id)}
                                              className={`mt-0.5 flex-shrink-0 transition-all ${subtask.completed ? 'text-green-500 scale-110' : 'text-slate-300 hover:text-blue-500'}`}
                                          >
                                              {subtask.completed ? <CheckSquare size={18} /> : <Square size={18} strokeWidth={2}/>}
                                          </button>
                                          <span className={`text-sm flex-1 break-words transition-all leading-snug ${subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                                              {subtask.content}
                                          </span>
                                          <button 
                                              type="button" 
                                              onClick={() => handleDeleteSubtask(subtask.id)}
                                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1"
                                          >
                                              <X size={14} />
                                          </button>
                                      </div>
                                  ))}
                                  {taskSubtasks.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Chưa có đầu việc nhỏ nào.</p>}
                              </div>
                              
                              <div className="flex items-center gap-2 pt-3 border-t border-slate-200 border-dashed">
                                  <input 
                                      type="text" 
                                      value={newSubtaskInput}
                                      onChange={(e) => setNewSubtaskInput(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                                      placeholder="Thêm đầu việc nhỏ..."
                                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:border-transparent"
                                  />
                                  <button 
                                      type="button" 
                                      onClick={handleAddSubtask}
                                      disabled={!newSubtaskInput.trim()}
                                      className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                                  >
                                      <Plus size={18} />
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* General Notes */}
                      <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ghi chú thêm</label>
                           <div className="relative">
                                <input 
                                    type="text" 
                                    value={taskNotes}
                                    onChange={(e) => setTaskNotes(e.target.value)}
                                    placeholder="Lưu ý quan trọng..."
                                    className="w-full border border-yellow-200 bg-yellow-50/50 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-yellow-400 text-sm text-slate-700 transition-all focus:bg-yellow-50"
                                />
                                <MessageSquare size={16} className="absolute left-3 top-3 text-yellow-600 pointer-events-none" />
                           </div>
                      </div>
                   </div>
                </form>
            ) : (
                // --- HISTORY TAB CONTENT (Timeline UI) ---
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50">
                    <div className="space-y-6 relative pl-4">
                        {/* Timeline vertical line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200"></div>
                        
                        {allLogs.filter(log => log.targetId === editingTask?.id).length === 0 ? (
                            <div className="text-center text-slate-400 italic py-10 flex flex-col items-center">
                                <History size={32} className="mb-2 opacity-50"/>
                                Chưa có lịch sử hoạt động nào.
                            </div>
                        ) : (
                            allLogs
                                .filter(log => log.targetId === editingTask?.id)
                                .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                .map((log, index) => {
                                    const date = new Date(log.timestamp);
                                    let icon = <Activity size={14} className="text-white"/>;
                                    let bg = "bg-slate-400";
                                    let ring = "ring-slate-100";
                                    
                                    if (log.action === 'CREATE') { 
                                        icon = <Plus size={14} className="text-white"/>; 
                                        bg = "bg-green-500";
                                        ring = "ring-green-100"; 
                                    }
                                    else if (log.action === 'UPDATE') { 
                                        icon = <Edit3 size={14} className="text-white"/>; 
                                        bg = "bg-blue-500"; 
                                        ring = "ring-blue-100";
                                    }
                                    else if (log.action === 'DELETE') { 
                                        icon = <Trash2 size={14} className="text-white"/>; 
                                        bg = "bg-red-500"; 
                                        ring = "ring-red-100";
                                    }

                                    return (
                                        <div key={log.id} className="relative flex gap-4 group animate-fade-in" style={{animationDelay: `${index * 50}ms`}}>
                                            {/* Connector to timeline */}
                                            <div className="absolute top-4 -left-[22px] w-4 h-0.5 bg-slate-200"></div>

                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10 flex-shrink-0 ${bg} ring-2 ${ring}`}>
                                                {icon}
                                            </div>
                                            <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 text-xs">{log.actorName}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{log.action}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded font-mono border border-slate-100 flex items-center">
                                                        <FileClock size={10} className="mr-1"/>
                                                        {date.toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false})}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-snug mt-1">{log.details}</p>
                                            </div>
                                        </div>
                                    )
                                })
                        )}
                    </div>
                </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0 z-10 relative">
                {editingTask && activeModalTab === 'INFO' && (
                    <button 
                    type="button"
                    onClick={() => handleConfirmDelete(editingTask.id)}
                    className="mr-auto text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-bold flex items-center transition-colors border border-transparent hover:border-red-100"
                    >
                        <Trash2 size={18} className="mr-2" /> Xóa
                    </button>
                )}
                <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm rounded-xl text-sm font-bold transition-all border border-transparent hover:border-slate-200"
                >
                    Hủy bỏ
                </button>
                {activeModalTab === 'INFO' && (
                    <button 
                        onClick={handleSaveTask}
                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all transform active:scale-95 flex items-center"
                    >
                        {editingTask ? 'Lưu thay đổi' : 'Tạo công việc'} <ArrowRight size={16} className="ml-2"/>
                    </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
       {deleteModalState.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] animate-fade-in p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa công việc?</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Bạn có chắc chắn muốn xóa vĩnh viễn công việc này không? <br/>
                        Hành động này <span className="font-bold text-red-500">không thể hoàn tác</span>.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteModalState({ isOpen: false, taskId: null })}
                            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={executeDelete}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-colors"
                        >
                            Xóa ngay
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* AI Suggestion Modal */}
      {aiSuggestion && aiSuggestion.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[80] animate-fade-in p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden">
                <div className="p-4 border-b border-purple-100 bg-purple-50 flex justify-between items-center">
                    <h3 className="font-bold text-purple-900 flex items-center gap-2">
                        <Sparkles size={20} className="text-purple-600" />
                        Gợi ý thực hiện (AI)
                    </h3>
                    <button 
                        onClick={() => setAiSuggestion(null)}
                        className="text-purple-400 hover:text-purple-700 p-1 rounded-full hover:bg-purple-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    <div className="mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase">Công việc</span>
                        <h4 className="font-bold text-slate-800 text-lg">{aiSuggestion.taskTitle}</h4>
                    </div>
                    <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="whitespace-pre-wrap font-medium leading-relaxed">
                            {aiSuggestion.content}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
                    <button 
                        onClick={() => setAiSuggestion(null)}
                        className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold shadow-lg shadow-purple-900/20 transition-all"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;