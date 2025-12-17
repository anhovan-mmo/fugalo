
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Member, 
    PersonalTask, 
    Task, 
    WeeklyPlan, 
    Subtask, 
    Role, 
    AuditLog, 
    PlanStatus,
    getRoleLevel 
} from '../types';
import { 
    subscribeToWeeklyPlan, 
    saveWeeklyPlan, 
    addLogToDB, 
    subscribeToLogs 
} from '../services/firebase';
import { 
    ListTodo, ChevronDown, Search, CheckCircle2, Calendar, GitCompare, History, Focus, Layout, Target, 
    User, XCircle, Clock, Stamp, RefreshCw, Copy, Send, ChevronLeft, ChevronRight, Plus, Edit3, Trash2, 
    Activity, ArrowUp, ArrowDown, AlertCircle, Minus, Shield, CheckSquare, Square, Zap, Star, Save, 
    FileText, LayoutGrid, List, Filter, PlusCircle, ArrowRight, Lock, Award, TrendingUp, ThumbsUp, Check, X, Crown, ClipboardList, Maximize2, Minimize2, AlignJustify, ChevronUp
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';

interface PersonalWeeklyTasksProps {
  tasks: PersonalTask[];
  currentUser: Member;
  members: Member[];
  onAddTask: (task: PersonalTask) => void;
  onUpdateTask: (task: PersonalTask) => void;
  onDeleteTask: (taskId: string) => void;
  onGoToReports: () => void;
  projectTasks?: Task[]; // Inject Project Tasks for comparison
  pendingPlans?: WeeklyPlan[]; // NEW PROP
  initialMemberId?: string | null; // NEW: For direct navigation
  onClearTargetMember?: () => void; // NEW: Callback to clear target
}

// --- DATE HELPERS ---
const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    const start = new Date(d.setDate(diff));
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23,59,59,999);
    return { start, end };
};

const formatDateVN = (date: Date) => {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// Helper to get YYYY-MM-DD string locally
const getIsoDate = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

// Helper to get YYYY-MM string locally for Monthly Goals
const getMonthKey = (date: Date) => {
    return getIsoDate(date).slice(0, 7);
};

// --- SUB-COMPONENT: WEEKLY TASK CARD (Handles local collapse state) ---
interface WeeklyTaskCardProps {
    task: PersonalTask;
    isCompact: boolean;
    isLocked: boolean;
    isAdHoc: boolean;
    viewMode: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    onToggleTask: (task: PersonalTask) => void;
    onDeleteTask: (id: string) => void;
    onEditTask: (task: PersonalTask) => void;
    onUpdateSubtask: (task: PersonalTask, subtaskId: string) => void;
}

const WeeklyTaskCard: React.FC<WeeklyTaskCardProps> = ({ 
    task, isCompact, isLocked, isAdHoc, viewMode, 
    onToggleTask, onDeleteTask, onEditTask, onUpdateSubtask 
}) => {
    // Local state for expanding checklist
    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);

    const completedSubtasks = (task.subtasks || []).filter(s => s.completed).length;
    const totalSubtasks = (task.subtasks || []).length;
    const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : (task.completed ? 100 : 0);

    // COMPACT MODE RENDER
    if (isCompact && viewMode === 'WEEKLY') {
        return (
            <div className={`group relative bg-white border rounded p-1.5 hover:shadow-sm transition-all flex items-center gap-2 ${isAdHoc ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100'} ${task.completed ? 'opacity-70' : ''}`}>
                <button 
                  onClick={() => onToggleTask(task)}
                  className={`flex-shrink-0 transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'}`}
                >
                    {task.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                
                <div className="flex-1 min-w-0" onClick={() => onEditTask(task)}>
                    <p className={`text-xs font-semibold truncate cursor-pointer ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {task.content}
                    </p>
                </div>
                
                {totalSubtasks > 0 && (
                    <div className="flex-shrink-0" title={`${completedSubtasks}/${totalSubtasks} checklist`}>
                        <div className="w-4 h-4 rounded-full border border-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                            {completedSubtasks}/{totalSubtasks}
                        </div>
                    </div>
                )}

                {isAdHoc && <Zap size={10} className="text-orange-500 flex-shrink-0"/>}
                
                <button 
                  onClick={() => onDeleteTask(task.id)}
                  className={`opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-0.5 ${(isLocked && !isAdHoc && viewMode !== 'MONTHLY') ? 'hidden' : ''}`}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        );
    }

    // STANDARD MODE RENDER (With Collapsible Checklist)
    return (
        <div className={`group relative bg-white border rounded-lg p-3 hover:shadow-md transition-all flex flex-col gap-2 ${isAdHoc ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100'}`}>
            <div className="flex items-start gap-3">
                <button 
                  onClick={() => onToggleTask(task)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'}`}
                >
                    {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                        <p 
                          className={`text-sm cursor-pointer font-bold leading-snug ${task.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                          onClick={() => onEditTask(task)}
                        >
                            {task.content}
                        </p>
                        <div className="flex items-center gap-2">
                            {isAdHoc && (
                                <span className="flex-shrink-0 ml-2 text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 font-bold flex items-center" title="Công việc phát sinh sau khi chốt kế hoạch">
                                    <Zap size={10} className="mr-0.5 fill-orange-500"/>
                                </span>
                            )}
                            <button 
                              onClick={() => onDeleteTask(task.id)}
                              className={`opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-1 ${(isLocked && !isAdHoc && viewMode !== 'MONTHLY') ? 'hidden' : ''}`}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    
                    {task.notes && (
                        <div className="mt-1 text-xs text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100 flex items-start">
                            <FileText size={10} className="mr-1 mt-0.5 flex-shrink-0" />
                            {task.notes}
                        </div>
                    )}
                </div>
            </div>

            {/* CHECKLIST SECTION */}
            <div className="w-full pl-8 pr-1">
                {totalSubtasks > 0 && (
                    <>
                        <div 
                            className="flex justify-between items-center text-[10px] text-slate-500 mb-1 cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 py-0.5 transition-colors"
                            onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
                        >
                            <span className="flex items-center font-semibold text-xs">
                                {isChecklistExpanded ? <ChevronUp size={12} className="mr-1"/> : <ChevronDown size={12} className="mr-1"/>}
                                Checklist ({completedSubtasks}/{totalSubtasks})
                            </span>
                            <span className={`font-bold ${progressPercent === 100 ? 'text-green-600' : 'text-blue-600'}`}>{progressPercent}%</span>
                        </div>
                        
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{width: `${progressPercent}%`}}
                            ></div>
                        </div>

                        {/* EXPANDABLE LIST */}
                        {isChecklistExpanded && (
                            <div className="flex flex-col gap-1 mt-2 border-t border-slate-50 pt-2 animate-fade-in">
                                {task.subtasks?.map(sub => (
                                    <div 
                                        key={sub.id} 
                                        onClick={() => onUpdateSubtask(task, sub.id)}
                                        className="flex items-start gap-2 cursor-pointer group/sub p-1 hover:bg-slate-50 rounded"
                                    >
                                        <div className={`mt-0.5 flex-shrink-0 ${sub.completed ? 'text-green-500' : 'text-slate-300 group-hover/sub:text-blue-400'}`}>
                                            {sub.completed ? <CheckSquare size={14}/> : <Square size={14}/>}
                                        </div>
                                        <span className={`text-xs ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                            {sub.content}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
                {/* Visual Placeholder if no subtasks but task is complex */}
                {totalSubtasks === 0 && !task.completed && (
                    <div className="h-1"></div> // Spacer
                )}
            </div>
        </div>
    );
};

const PersonalWeeklyTasks: React.FC<PersonalWeeklyTasksProps> = ({
  tasks,
  currentUser,
  members = [], 
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onGoToReports,
  projectTasks = [],
  pendingPlans = [],
  initialMemberId,
  onClearTargetMember
}) => {
  // --- HIERARCHY LOGIC ---
  const [viewingMemberId, setViewingMemberId] = useState(currentUser.id);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const selectorRef = useRef<HTMLDivElement>(null);

  // Sync with prop when navigated from notifications
  useEffect(() => {
      if (initialMemberId) {
          setViewingMemberId(initialMemberId);
          if (onClearTargetMember) onClearTargetMember();
      }
  }, [initialMemberId]);

  // Close selector when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
              setIsSelectorOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Identify subordinates based on role hierarchy
  const subordinates = useMemo(() => {
      const myLevel = getRoleLevel(currentUser.roleType);
      if (myLevel === 1) return [];

      return members.filter(m => {
          if (m.id === currentUser.id) return false;
          const theirLevel = getRoleLevel(m.roleType);
          
          if (myLevel === 4) return true;
          if (myLevel === 3) return theirLevel < 3; 

          const isMediaPeer = 
              currentUser.department === 'Media' && 
              m.department === 'Media' &&
              (
                  (currentUser.roleType === Role.DOP && m.roleType === Role.MEDIA_LEADER) ||
                  (currentUser.roleType === Role.MEDIA_LEADER && m.roleType === Role.DOP)
              );
          
          if (isMediaPeer) return true;
          if (myLevel === 2 && m.department === currentUser.department && theirLevel < 2) return true;

          return false;
      });
  }, [members, currentUser]);

  // Filter Pending Plans relevant to current user (subordinates)
  const myPendingPlans = useMemo(() => {
      const subordinateIds = subordinates.map(s => s.id);
      return pendingPlans.filter(p => subordinateIds.includes(p.userId) || p.approverId === currentUser.id);
  }, [pendingPlans, subordinates, currentUser.id]);

  const viewingMember = useMemo(() => members.find(m => m.id === viewingMemberId) || currentUser, [members, viewingMemberId, currentUser]);
  const isViewingSelf = viewingMemberId === currentUser.id;

  const filteredSubordinates = useMemo(() => {
      if (!memberSearch) return subordinates;
      return subordinates.filter(s => s.name.toLowerCase().includes(memberSearch.toLowerCase()) || s.role.toLowerCase().includes(memberSearch.toLowerCase()));
  }, [subordinates, memberSearch]);

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'PLANNING' | 'REVIEW' | 'LOGS'>('PLANNING');
  const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [currentDate, setCurrentDate] = useState(new Date()); 
  
  // NEW: Compact Mode State
  const [isCompact, setIsCompact] = useState(false);
  
  const [activeDayInput, setActiveDayInput] = useState<string | null>(null);
  const [dayInputContent, setDayInputContent] = useState('');
  const [monthlyGoalInput, setMonthlyGoalInput] = useState('');

  const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubtasks, setEditSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHighlights, setReviewHighlights] = useState('');
  const [reviewImprovements, setReviewImprovements] = useState('');
  
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  
  // Weekly Plan Data State (from Firebase)
  const [currentWeeklyPlan, setCurrentWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>('DRAFT');
  const [planFeedback, setPlanFeedback] = useState(''); 
  const [committedTaskIds, setCommittedTaskIds] = useState<string[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [nextWeekPlanNote, setNextWeekPlanNote] = useState(''); 

  const [managerActionComment, setManagerActionComment] = useState('');
  const [managerRating, setManagerRating] = useState(0);
  const [managerComment, setManagerComment] = useState('');

  const [logs, setLogs] = useState<AuditLog[]>([]);

  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  
  function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  const currentWeekNum = getWeekNumber(weekStart);
  
  // --- FIREBASE SYNC: WEEKLY PLAN ---
  // Composite Key for Plan: userId_year_week
  const currentPlanId = useMemo(() => 
      `${viewingMemberId}_${weekStart.getFullYear()}_W${currentWeekNum}`, 
  [viewingMemberId, weekStart, currentWeekNum]);

  const defaultManager = useMemo(() => {
      if (!members || !Array.isArray(members)) return null;
      const level = getRoleLevel(viewingMember.roleType);
      let found = members.find(m => m.role === viewingMember.reportsTo || m.roleType === viewingMember.reportsTo);
      
      // Strict fallback: If reportTo leads to BOARD for non-Manager, force to MANAGER
      if (found && found.roleType === Role.BOARD && viewingMember.roleType !== Role.MANAGER) {
          found = members.find(m => m.roleType === Role.MANAGER);
      }

      if (!found) {
          if (level === 1) found = members.find(m => m.department === viewingMember.department && getRoleLevel(m.roleType) === 2);
          if (!found && level <= 2) found = members.find(m => m.roleType === Role.MANAGER);
      }
      return found;
  }, [members, viewingMember]);

  const potentialApprovers = useMemo(() => {
      const myLevel = getRoleLevel(viewingMember.roleType);
      return members.filter(m => {
          if (m.id === viewingMember.id) return false;
          
          // STRICT HIERARCHY RULE: Only MANAGER can see BOARD
          if (viewingMember.roleType !== Role.MANAGER && m.roleType === Role.BOARD) {
              return false;
          }

          if (getRoleLevel(m.roleType) >= 3) return true;
          if (getRoleLevel(m.roleType) === 2 && myLevel <= 2) return true;
          return false;
      });
  }, [members, viewingMember]);

  const targetMemberManager = useMemo(() => {
      if (selectedApproverId) {
          return members.find(m => m.id === selectedApproverId);
      }
      return defaultManager;
  }, [selectedApproverId, defaultManager, members]);

  useEffect(() => {
      // Subscribe to Weekly Plan from Firebase
      const unsubscribe = subscribeToWeeklyPlan(currentPlanId, (plan) => {
          if (plan) {
              setCurrentWeeklyPlan(plan);
              setPlanStatus(plan.status);
              setPlanFeedback(plan.managerFeedback || '');
              setSubmissionNote(plan.submissionNote || '');
              setCommittedTaskIds(plan.committedTaskIds || []);
              if (plan.approverId) setSelectedApproverId(plan.approverId);
              
              // Load Reviews if exist
              if (plan.review) {
                  setReviewRating(plan.review.rating);
                  setReviewHighlights(plan.review.highlights);
                  setReviewImprovements(plan.review.improvements);
              } else {
                  setReviewRating(0); setReviewHighlights(''); setReviewImprovements('');
              }

              // Load Manager Eval if exist
              if (plan.managerEval) {
                  setManagerRating(plan.managerEval.rating);
                  setManagerComment(plan.managerEval.comment);
              } else {
                  setManagerRating(0); setManagerComment('');
              }

          } else {
              // Reset if no plan exists yet (DRAFT)
              setCurrentWeeklyPlan(null);
              setPlanStatus('DRAFT');
              setPlanFeedback('');
              setSubmissionNote('');
              setCommittedTaskIds([]);
              setReviewRating(0); setReviewHighlights(''); setReviewImprovements('');
              setManagerRating(0); setManagerComment('');
              
              if (defaultManager) setSelectedApproverId(defaultManager.id);
          }
      });
      return () => unsubscribe();
  }, [currentPlanId, defaultManager]);

  useEffect(() => {
      const unsubscribe = subscribeToLogs((fetchedLogs) => {
          const myLogs = fetchedLogs.filter(log => 
              log.targetType === 'TASK' && 
              log.details.includes('[Việc cá nhân]') &&
              (log.actorId === viewingMemberId || (log.actorId === currentUser.id && !isViewingSelf))
          );
          setLogs(myLogs);
      });
      return () => unsubscribe();
  }, [currentUser.id, viewingMemberId, isViewingSelf]);

  const myTasks = useMemo(() => {
      return tasks.filter(t => t.userId === viewingMemberId);
  }, [tasks, viewingMemberId]);

  // --- 1. Group logs by date (MOVED TO TOP LEVEL TO FIX RULE OF HOOKS) ---
  const groupedLogs = useMemo(() => {
      const groups: Record<string, AuditLog[]> = {};
      const sortedLogs = [...logs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      sortedLogs.forEach(log => {
          const date = new Date(log.timestamp);
          const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          if (!groups[dateStr]) groups[dateStr] = [];
          groups[dateStr].push(log);
      });
      return groups;
  }, [logs]);

  // ... (Copy Task, Comparison Logic, Stats Logic - UNCHANGED)
  const handleCopyTasks = () => {
      if (!isViewingSelf) return;
      if (planStatus === 'COMPLETED' && viewMode !== 'MONTHLY') { alert("Tuần này đã chốt sổ, không thể thêm việc."); return; }

      let sourceStartDate: Date, sourceEndDate: Date;
      let confirmMsg = "";
      
      // Special Handling for Monthly Mode Copy
      if (viewMode === 'MONTHLY') {
          const currentMonthKey = getMonthKey(currentDate);
          const prevDate = new Date(currentDate);
          prevDate.setMonth(prevDate.getMonth() - 1);
          const prevMonthKey = getMonthKey(prevDate);

          if (!window.confirm(`Sao chép mục tiêu từ Tháng ${prevDate.getMonth() + 1}/${prevDate.getFullYear()} sang Tháng này?`)) return;

          // Copy Logic for Monthly
          const tasksToCopy = myTasks.filter(t => t.day === prevMonthKey || (t.day === 'MONTHLY' && prevMonthKey === getMonthKey(new Date()))); // Fallback for old 'MONTHLY' key if copying to current month
          
          if (tasksToCopy.length === 0) {
             alert("Không tìm thấy mục tiêu nào của tháng trước.");
             return;
          }

          let copiedCount = 0;
          tasksToCopy.forEach(t => {
              const newTask: PersonalTask = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  userId: currentUser.id,
                  content: t.content,
                  day: currentMonthKey, // New Month Key
                  completed: false,
                  notes: t.notes,
                  subtasks: t.subtasks?.map(s => ({...s, completed: false})) || []
              };
              onAddTask(newTask);
              copiedCount++;
          });
          
          logAction('CREATE', `Sao chép ${copiedCount} mục tiêu từ tháng trước`);
          alert(`Đã sao chép ${copiedCount} mục tiêu.`);
          return;
      }

      // --- DAILY & WEEKLY LOGIC ---
      let diffDays = 0;
      if (viewMode === 'DAILY') {
          // Copy from Yesterday
          sourceStartDate = new Date(currentDate);
          sourceStartDate.setDate(currentDate.getDate() - 1);
          sourceEndDate = new Date(sourceStartDate);
          diffDays = 1;
          confirmMsg = `Sao chép công việc từ Hôm qua (${formatDateVN(sourceStartDate)}) sang Hôm nay?`;
      } else if (viewMode === 'WEEKLY') {
          // Copy from Last Week
          sourceStartDate = new Date(weekStart);
          sourceStartDate.setDate(weekStart.getDate() - 7);
          sourceEndDate = new Date(weekEnd);
          sourceEndDate.setDate(weekEnd.getDate() - 7);
          diffDays = 7;
          confirmMsg = `Sao chép công việc từ Tuần trước (${formatDateVN(sourceStartDate)} - ${formatDateVN(sourceEndDate)}) sang Tuần này?`;
      } else {
          return;
      }

      if (!window.confirm(confirmMsg)) return;

      const startStr = getIsoDate(sourceStartDate);
      const endStr = getIsoDate(sourceEndDate);

      const tasksToCopy = myTasks.filter(t => {
          if (t.day.length === 7 || t.day === 'MONTHLY') return false; // Ignore Monthly Goals
          return t.day >= startStr && t.day <= endStr;
      });

      if (tasksToCopy.length === 0) {
          alert("Không tìm thấy công việc nào trong khoảng thời gian trước.");
          return;
      }

      let copiedCount = 0;
      tasksToCopy.forEach(t => {
          // Calculate new date
          const oldDate = new Date(t.day);
          const newDate = new Date(oldDate);
          newDate.setDate(oldDate.getDate() + diffDays);
          const newDateStr = getIsoDate(newDate);

          const newTask: PersonalTask = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              userId: currentUser.id,
              content: t.content,
              day: newDateStr, // New Date
              completed: false, // Reset status
              notes: t.notes,
              subtasks: t.subtasks?.map(s => ({...s, completed: false})) || []
          };
          onAddTask(newTask);
          copiedCount++;
      });
      
      logAction('CREATE', `Sao chép ${copiedCount} công việc từ kỳ trước`);
      alert(`Đã sao chép ${copiedCount} công việc.`);
  };

  const comparisonStats = useMemo(() => {
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      const thisWeekStart = weekStart;
      const thisWeekEnd = weekEnd;
      const lastWeekStart = new Date(thisWeekStart.getTime() - oneWeek);
      const lastWeekEnd = new Date(thisWeekEnd.getTime() - oneWeek);

      const getStatsForPeriod = (start: Date, end: Date) => {
          const sourceTasks = projectTasks.length > 0 ? projectTasks : []; 
          const periodTasks = sourceTasks.filter(t => t.assigneeId === viewingMemberId);

          const newCount = periodTasks.filter(t => {
              const d = new Date(t.startDate);
              return d >= start && d <= end;
          }).length;

          const dueTasks = periodTasks.filter(t => {
              const d = new Date(t.deadline);
              return d >= start && d <= end;
          });

          const doneCount = dueTasks.filter(t => t.status === 'DONE').length;
          const overdueCount = dueTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length;

          return { new: newCount, done: doneCount, overdue: overdueCount };
      };

      const current = getStatsForPeriod(thisWeekStart, thisWeekEnd);
      const last = getStatsForPeriod(lastWeekStart, lastWeekEnd);

      const calcGrowth = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return Math.round(((curr - prev) / prev) * 100);
      };

      return {
          current,
          last,
          growth: {
              new: calcGrowth(current.new, last.new),
              done: calcGrowth(current.done, last.done),
              overdue: calcGrowth(current.overdue, last.overdue)
          }
      };
  }, [projectTasks, viewingMemberId, weekStart, weekEnd]);

  const daysMap = [
      { key: 'T2', label: 'Thứ 2' },
      { key: 'T3', label: 'Thứ 3' },
      { key: 'T4', label: 'Thứ 4' },
      { key: 'T5', label: 'Thứ 5' },
      { key: 'T6', label: 'Thứ 6' },
      { key: 'T7', label: 'Thứ 7' },
      { key: 'CN', label: 'Chủ Nhật' },
  ];

  // Selected Date Filter Logic
  const selectedDayKey = getIsoDate(currentDate); // Using full date as key
  const selectedMonthKey = getMonthKey(currentDate); // YYYY-MM

  const dailyTasks = useMemo(() => myTasks.filter(t => t.day === selectedDayKey), [myTasks, selectedDayKey]);
  
  const monthlyGoals = useMemo(() => myTasks.filter(t => t.day === selectedMonthKey || (t.day === 'MONTHLY' && selectedMonthKey === getMonthKey(new Date()))), [myTasks, selectedMonthKey]);

  const stats = useMemo(() => {
      const startStr = getIsoDate(weekStart);
      const endStr = getIsoDate(weekEnd);
      
      const weeklyTasks = myTasks.filter(t => t.day >= startStr && t.day <= endStr);
      const committedTasks = weeklyTasks.filter(t => committedTaskIds.includes(t.id));
      const adHocTasks = weeklyTasks.filter(t => !committedTaskIds.includes(t.id));
      
      const total = weeklyTasks.length;
      const completed = weeklyTasks.filter(t => t.completed).length;
      const committedDone = committedTasks.filter(t => t.completed).length;
      const adHocDone = adHocTasks.filter(t => t.completed).length;
      
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
          total, completed, percent,
          committedCount: committedTasks.length, adHocCount: adHocTasks.length,
          committedDone, adHocDone, unfinished: total - completed
      };
  }, [myTasks, committedTaskIds, weekStart, weekEnd]);

  const isLocked = planStatus === 'PENDING' || planStatus === 'APPROVED' || planStatus === 'COMPLETED';

  // --- MISSING FUNCTIONS IMPLEMENTATION ---

  const getDateForDayColumn = (dayKey: string) => {
      // weekStart is Monday based on getWeekRange
      const dayIndexMap: Record<string, number> = { 'T2': 0, 'T3': 1, 'T4': 2, 'T5': 3, 'T6': 4, 'T7': 5, 'CN': 6 };
      const index = dayIndexMap[dayKey];
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + index);
      return targetDate;
  };

  const renderComparisonView = () => (
      <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Việc mới nhận</div>
                  <div className="flex items-end justify-between">
                      <div className="text-2xl font-black text-slate-800">{comparisonStats.current.new}</div>
                      <div className={`text-xs font-bold ${comparisonStats.growth.new >= 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {comparisonStats.growth.new > 0 ? '+' : ''}{comparisonStats.growth.new}%
                      </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">vs tuần trước ({comparisonStats.last.new})</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Đã hoàn thành</div>
                  <div className="flex items-end justify-between">
                      <div className="text-2xl font-black text-green-600">{comparisonStats.current.done}</div>
                      <div className={`text-xs font-bold ${comparisonStats.growth.done >= 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {comparisonStats.growth.done > 0 ? '+' : ''}{comparisonStats.growth.done}%
                      </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">vs tuần trước ({comparisonStats.last.done})</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Quá hạn</div>
                  <div className="flex items-end justify-between">
                      <div className="text-2xl font-black text-red-600">{comparisonStats.current.overdue}</div>
                      <div className={`text-xs font-bold ${comparisonStats.growth.overdue <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {comparisonStats.growth.overdue > 0 ? '+' : ''}{comparisonStats.growth.overdue}%
                      </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">vs tuần trước ({comparisonStats.last.overdue})</div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center py-12">
              <GitCompare size={48} className="text-slate-200 mb-4"/>
              <h3 className="font-bold text-slate-600 mb-2">Review hiệu suất tuần</h3>
              <button 
                  onClick={() => setIsReviewOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors"
              >
                  {reviewHighlights ? 'Sửa đánh giá' : 'Bắt đầu đánh giá'}
              </button>
          </div>
      </div>
  );

  const renderLogView = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center">
                  <History size={16} className="mr-2 text-orange-600"/> Nhật ký hoạt động
              </h3>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar max-h-[600px]">
              <div className="space-y-8 relative pl-2">
                  <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
                  {Object.entries(groupedLogs).length === 0 ? (
                      <div className="text-center text-slate-400 italic py-10">Chưa có hoạt động nào.</div>
                  ) : (
                      // Type assertion for Object.entries if needed in TS, but inferred usually fine
                      (Object.entries(groupedLogs) as [string, AuditLog[]][]).map(([date, items]) => (
                          <div key={date} className="relative z-10">
                              <div className="sticky top-0 z-20 mb-4 -ml-2">
                                  <span className="inline-block bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide">
                                      {date}
                                  </span>
                              </div>
                              <div className="space-y-4 pl-4">
                                  {items.map((log: AuditLog) => (
                                      <div key={log.id} className="relative flex gap-4 group">
                                          <div className="absolute top-4 -left-[22px] w-4 h-0.5 bg-slate-200"></div>
                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10 flex-shrink-0 bg-slate-400 ring-2 ring-slate-100`}>
                                              <Activity size={14} className="text-white"/>
                                          </div>
                                          <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                              <div className="flex justify-between items-start mb-1">
                                                  <span className="font-bold text-slate-800 text-xs">{log.actorName}</span>
                                                  <span className="text-[10px] text-slate-400 font-mono">
                                                      {new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                                  </span>
                                              </div>
                                              <p className="text-xs text-slate-600">{log.details}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>
  );

  // ... (Handlers: logAction, navigation, modals, submit, etc. - UNCHANGED) ...
  const logAction = async (action: 'CREATE' | 'UPDATE' | 'DELETE', details: string, taskId?: string) => {
      const isProxyAction = !isViewingSelf;
      const prefix = isProxyAction ? `[Quản lý tác động] ` : ``;
      await addLogToDB({
          id: Date.now().toString(),
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: action,
          targetType: 'TASK',
          targetId: taskId,
          details: `[Việc cá nhân] ${prefix}${details} (cho ${viewingMember.name})`,
          timestamp: new Date().toISOString()
      });
  };

  const handleTimeNavigate = (direction: -1 | 1 | 0) => {
      if (direction === 0) {
          setCurrentDate(new Date());
          return;
      }

      const newDate = new Date(currentDate);
      if (viewMode === 'DAILY') {
          newDate.setDate(newDate.getDate() + direction);
      } else if (viewMode === 'WEEKLY') {
          newDate.setDate(newDate.getDate() + (direction * 7));
      } else if (viewMode === 'MONTHLY') {
          newDate.setMonth(newDate.getMonth() + direction);
      }
      setCurrentDate(newDate);
  };

  const handleZoomToDay = (dayKey: string) => {
      // Find the date for this dayKey relative to current week view
      const dayIndexMap: Record<string, number> = { 'T2': 0, 'T3': 1, 'T4': 2, 'T5': 3, 'T6': 4, 'T7': 5, 'CN': 6 };
      const index = dayIndexMap[dayKey];
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + index);
      
      setCurrentDate(targetDate);
      setViewMode('DAILY');
  };

  const handleOpenSubmitModal = () => {
      if (!isViewingSelf) { alert("Bạn chỉ có thể gửi kế hoạch của chính mình."); return; }
      const currentWeekStartStr = getIsoDate(weekStart);
      const currentWeekEndStr = getIsoDate(weekEnd);
      const currentTasksToSubmit = myTasks.filter(t => t.day >= currentWeekStartStr && t.day <= currentWeekEndStr);

      if (currentTasksToSubmit.length === 0) { alert("Không thể gửi kế hoạch rỗng.\nVui lòng thêm ít nhất 1 đầu việc."); return; }
      if (planStatus === 'DRAFT') setSubmissionNote(''); 
      setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
      const startStr = getIsoDate(weekStart);
      const endStr = getIsoDate(weekEnd);
      const currentTasksToSubmit = myTasks.filter(t => t.day >= startStr && t.day <= endStr);

      const approverId = selectedApproverId || defaultManager?.id || '';
      const approver = members.find(m => m.id === approverId);
      
      const newPlan: WeeklyPlan = {
          id: currentPlanId,
          userId: currentUser.id,
          weekNumber: currentWeekNum,
          year: weekStart.getFullYear(),
          status: 'PENDING',
          approverId: approverId,
          submissionNote: submissionNote,
          managerFeedback: '',
          committedTaskIds: currentTasksToSubmit.map(t => t.id),
          createdAt: currentWeeklyPlan?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };

      await saveWeeklyPlan(newPlan);
      
      setPlanStatus('PENDING');
      setCommittedTaskIds(newPlan.committedTaskIds);
      logAction('UPDATE', `Đã gửi kế hoạch Tuần ${currentWeekNum} đến ${approver ? approver.name : 'Quản lý'}.`);
      setIsSubmitModalOpen(false);
  };

  const handleManagerDecision = async (decision: 'APPROVED' | 'REJECTED') => {
      if (!managerActionComment.trim() && decision === 'REJECTED') { alert("Vui lòng nhập lý do từ chối/yêu cầu sửa đổi."); return; }
      
      if (!currentWeeklyPlan) return;

      const updatedPlan: WeeklyPlan = {
          ...currentWeeklyPlan,
          status: decision,
          managerFeedback: managerActionComment,
          updatedAt: new Date().toISOString()
      };

      await saveWeeklyPlan(updatedPlan);

      setPlanStatus(decision);
      setPlanFeedback(managerActionComment);
      logAction('UPDATE', decision === 'APPROVED' ? `Đã duyệt kế hoạch của ${viewingMember.name}` : `Yêu cầu sửa lại: ${managerActionComment}`);
      setManagerActionComment('');
      alert(decision === 'APPROVED' ? "Đã phê duyệt!" : "Đã gửi yêu cầu sửa.");
  };

  const handleConfirmFinalize = async () => {
      if (!currentWeeklyPlan) return;
      
      const updatedPlan: WeeklyPlan = {
          ...currentWeeklyPlan,
          status: 'COMPLETED',
          submissionNote: submissionNote, 
          review: {
              rating: reviewRating,
              highlights: reviewHighlights,
              improvements: reviewImprovements
          },
          updatedAt: new Date().toISOString()
      };

      await saveWeeklyPlan(updatedPlan);

      setPlanStatus('COMPLETED');
      logAction('UPDATE', `Đã chốt sổ Tuần ${currentWeekNum}`);
      setIsFinalizeModalOpen(false);
      alert("Đã chốt sổ tuần thành công!");
  };

  const handleAddTask = (dayKey: string, content: string) => {
    if (!content.trim()) return;
    const newTask: PersonalTask = {
        id: Date.now().toString(), userId: viewingMemberId, content: content, day: dayKey, completed: false, subtasks: []
    };
    onAddTask(newTask);
    logAction('CREATE', `Thêm việc mới (${dayKey}): ${content}`, newTask.id);
  };

  const handleInlineAdd = (dayKey: string) => { handleAddTask(dayKey, dayInputContent); setDayInputContent(''); };
  const handleAddMonthlyGoal = () => { handleAddTask(selectedMonthKey, monthlyGoalInput); setMonthlyGoalInput(''); };
  const handleDeletePersonalTask = (taskId: string) => { onDeleteTask(taskId); logAction('DELETE', 'Xóa công việc', taskId); }

  const handleToggleTask = (task: PersonalTask) => { 
      const newCompletedState = !task.completed;
      const updatedSubtasks = task.subtasks?.map(s => ({...s, completed: newCompletedState})) || [];

      onUpdateTask({ 
          ...task, 
          completed: newCompletedState,
          subtasks: updatedSubtasks
      }); 
      logAction('UPDATE', `Đổi trạng thái: ${newCompletedState ? 'Hoàn thành' : 'Chưa làm'}`, task.id); 
  };

  const handleInlineSubtaskToggle = (task: PersonalTask, subtaskId: string) => {
      if (!task.subtasks) return;
      const updatedSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.completed);

      onUpdateTask({ 
          ...task, 
          subtasks: updatedSubtasks,
          completed: allDone 
      });
  };

  const openEditModal = (task: PersonalTask) => {
      const isAdHoc = (planStatus === 'APPROVED' || planStatus === 'PENDING') && !committedTaskIds.includes(task.id);
      if (planStatus === 'COMPLETED' && viewMode !== 'MONTHLY') { alert("Tuần này đã được chốt sổ."); return; }
      if (isLocked && isViewingSelf && !isAdHoc && planStatus !== 'COMPLETED' && viewMode !== 'MONTHLY') { alert("Không thể sửa việc đã cam kết. Chỉ sửa được việc phát sinh (Ad-hoc)."); return; }
      setEditingTask(task); setEditContent(task.content); setEditNotes(task.notes || ''); setEditSubtasks(task.subtasks || []); setNewSubtaskInput('');
  };

  const handleSaveEdit = () => {
      if (editingTask && editContent.trim()) {
          const allDone = editSubtasks.length > 0 && editSubtasks.every(s => s.completed);
          const shouldBeCompleted = editSubtasks.length > 0 ? allDone : editingTask.completed;

          onUpdateTask({ 
              ...editingTask, 
              content: editContent, 
              notes: editNotes, 
              subtasks: editSubtasks, 
              completed: shouldBeCompleted 
          });
          logAction('UPDATE', `Cập nhật: ${editContent}`, editingTask.id);
          setEditingTask(null);
      }
  };

  const handleAddSubtask = () => { if (newSubtaskInput.trim()) { setEditSubtasks([...editSubtasks, { id: Date.now().toString(), content: newSubtaskInput, completed: false }]); setNewSubtaskInput(''); } };
  const toggleSubtask = (subtaskId: string) => setEditSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s));
  const deleteSubtask = (subtaskId: string) => setEditSubtasks(prev => prev.filter(s => s.id !== subtaskId));

  const handleSaveManagerEval = async () => {
      if (!currentWeeklyPlan) return;
      const updatedPlan: WeeklyPlan = {
          ...currentWeeklyPlan,
          managerEval: {
              rating: managerRating,
              comment: managerComment
          },
          updatedAt: new Date().toISOString()
      };
      await saveWeeklyPlan(updatedPlan);
      logAction('UPDATE', 'Quản lý đánh giá kế hoạch tuần');
      alert("Đã lưu đánh giá!");
  };

  const handleSaveReview = async () => {
      if (!currentWeeklyPlan && planStatus === 'DRAFT') {
          alert("Vui lòng Gửi kế hoạch trước khi thực hiện Review.");
          return;
      }
      
      if (currentWeeklyPlan) {
          const updatedPlan: WeeklyPlan = {
              ...currentWeeklyPlan,
              review: {
                  rating: reviewRating,
                  highlights: reviewHighlights,
                  improvements: reviewImprovements
              },
              updatedAt: new Date().toISOString()
          };
          await saveWeeklyPlan(updatedPlan);
          if (!isFinalizeModalOpen) { 
              logAction('UPDATE', 'Tự đánh giá hiệu suất tuần'); 
              setIsReviewOpen(false); 
              alert("Đã lưu đánh giá!"); 
          }
      }
  };

  // ... (renderLogView, renderHeader, renderComparisonView - Unchanged)
  // Replaced renderTaskItem with the usage of WeeklyTaskCard below

  // ... (New Render for PENDING ALERTS - Unchanged)
  const renderPendingAlerts = () => {
      if (!isViewingSelf || myPendingPlans.length === 0) return null;

      return (
          <div className="bg-indigo-50 border border-indigo-200 p-4 mb-6 rounded-2xl shadow-sm animate-slide-in-right">
              <h3 className="font-bold text-indigo-900 mb-3 flex items-center">
                  <Stamp size={20} className="mr-2 text-indigo-600"/> Cần duyệt kế hoạch ({myPendingPlans.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myPendingPlans.map(plan => {
                      const user = members.find(m => m.id === plan.userId);
                      return (
                          <div 
                              key={plan.id}
                              className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
                              onClick={() => {
                                  setViewingMemberId(plan.userId);
                                  // Auto-navigate to correct week if needed
                                  // For simplicity, just switching user triggers the load
                              }}
                          >
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                      {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <span className="font-bold text-xs">{user?.name.charAt(0)}</span>}
                                  </div>
                                  <div>
                                      <div className="font-bold text-sm text-slate-800">{user?.name}</div>
                                      <div className="text-xs text-slate-500">Tuần {plan.weekNumber}</div>
                                  </div>
                              </div>
                              <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                                  Xem & Duyệt
                              </button>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  // ... (Render Header and rest of component)
  const renderHeader = () => {
      let label = '', subLabel = '';
      if (viewMode === 'DAILY') { label = currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); subLabel = 'Kế hoạch trong ngày'; }
      else if (viewMode === 'WEEKLY') { label = `Tuần ${currentWeekNum}`; subLabel = `${formatDateVN(weekStart)} - ${formatDateVN(weekEnd)}, ${weekStart.getFullYear()}`; }
      else { label = `Tháng ${currentDate.getMonth() + 1}`; subLabel = `Năm ${currentDate.getFullYear()}`; }
      const approverDisplay = selectedApproverId ? members.find(m => m.id === selectedApproverId)?.name : defaultManager?.name || 'Quản lý';

      return (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col xl:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${viewMode === 'DAILY' ? 'bg-blue-100 text-blue-600' : viewMode === 'WEEKLY' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                      {viewMode === 'DAILY' ? <Focus size={24}/> : viewMode === 'WEEKLY' ? <Layout size={24}/> : <Target size={24}/>}
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-slate-800 capitalize flex items-center gap-2">
                          {label}
                          {planStatus === 'APPROVED' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 flex items-center font-bold"><Lock size={10} className="mr-1"/> Đã duyệt {approverDisplay && `bởi ${approverDisplay}`}</span>}
                          {planStatus === 'PENDING' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200 flex items-center font-bold animate-pulse"><Clock size={10} className="mr-1"/> Chờ {approverDisplay} duyệt</span>}
                          {planStatus === 'REJECTED' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 flex items-center font-bold"><XCircle size={10} className="mr-1"/> Cần sửa</span>}
                          {planStatus === 'COMPLETED' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center font-bold"><CheckCircle2 size={10} className="mr-1"/> Đã tổng kết</span>}
                      </h3>
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                          {subLabel}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stats.percent === 100 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{stats.completed}/{stats.total} xong ({stats.percent}%)</span>
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  
                  {/* COMPACT MODE TOGGLE (Only in Weekly View) */}
                  {viewMode === 'WEEKLY' && (
                      <button 
                          onClick={() => setIsCompact(!isCompact)}
                          className={`flex items-center justify-center p-2 rounded-lg transition-all border ${isCompact ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'}`}
                          title={isCompact ? "Mở rộng" : "Thu gọn"}
                      >
                          {isCompact ? <Maximize2 size={18}/> : <Minimize2 size={18}/>}
                          <span className="text-xs font-bold ml-1 hidden lg:inline">{isCompact ? 'Chi tiết' : 'Gọn gàng'}</span>
                      </button>
                  )}

                  {/* COPY TASK BUTTON */}
                  {activeTab === 'PLANNING' && isViewingSelf && (
                      <button 
                          onClick={handleCopyTasks}
                          className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center shadow-sm text-xs"
                          title={`Sao chép công việc từ ${viewMode === 'DAILY' ? 'hôm qua' : viewMode === 'WEEKLY' ? 'tuần trước' : 'tháng trước'}`}
                      >
                          <Copy size={16} className="mr-1.5" /> Sao chép từ {viewMode === 'DAILY' ? 'Hôm qua' : viewMode === 'WEEKLY' ? 'Tuần trước' : 'Tháng trước'}
                      </button>
                  )}

                  {activeTab === 'PLANNING' && viewMode === 'WEEKLY' && isViewingSelf && stats.total > 0 && (planStatus === 'DRAFT' || planStatus === 'REJECTED') && (
                      <div className="flex flex-col items-end"><button onClick={handleOpenSubmitModal} className={`text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md flex items-center transition-all ${planStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}><Send size={16} className="mr-2"/> {planStatus === 'REJECTED' ? 'Gửi lại kế hoạch' : 'Gửi kế hoạch tuần'}</button></div>
                  )}
                  
                  {/* UPDATED NAVIGATION */}
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={() => handleTimeNavigate(0)} 
                          className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm whitespace-nowrap min-w-[80px]"
                      >
                          {viewMode === 'DAILY' ? 'Hôm nay' : viewMode === 'WEEKLY' ? 'Tuần này' : 'Tháng này'}
                      </button>
                      
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                          <button onClick={() => handleTimeNavigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
                          
                          {/* Date Picker Trigger / Label */}
                          <div className="relative group px-1">
                              {viewMode === 'MONTHLY' ? (
                                  <input 
                                      type="month"
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                      onChange={(e) => {
                                          if(e.target.value) setCurrentDate(new Date(e.target.value));
                                      }}
                                      value={currentDate.toISOString().slice(0, 7)}
                                  />
                              ) : (
                                  <input 
                                      type="date"
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                      onChange={(e) => {
                                          if(e.target.value) setCurrentDate(new Date(e.target.value));
                                      }}
                                      value={currentDate.toISOString().split('T')[0]} 
                                      title={viewMode === 'WEEKLY' ? "Chọn một ngày trong tuần để chuyển tới tuần đó" : "Chọn ngày"}
                                  />
                              )}
                              
                              <span className="px-2 py-1 text-xs font-bold text-slate-700 min-w-[90px] text-center block cursor-pointer group-hover:text-blue-600 transition-colors select-none">
                                  {viewMode === 'DAILY' && formatDateVN(currentDate)}
                                  {viewMode === 'WEEKLY' && `Tuần ${getWeekNumber(currentDate)}`}
                                  {viewMode === 'MONTHLY' && `Tháng ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`}
                              </span>
                          </div>

                          <button onClick={() => handleTimeNavigate(1)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"><ChevronRight size={16}/></button>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col animate-fade-in pb-10 relative">
      {/* HEADER: TITLE & TAB SWITCHER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <ListTodo size={24} className="mr-2 text-purple-600" />
                {isViewingSelf ? 'Kế hoạch cá nhân' : `Kế hoạch của ${viewingMember.name}`}
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">
                    {isViewingSelf ? 'Quản lý và theo dõi công việc theo dòng thời gian.' : 'Xem và quản lý kế hoạch của cấp dưới.'}
                </p>
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 items-end md:items-center">
            {/* SUBORDINATE SELECTOR */}
            {subordinates.length > 0 && (
                <div className="relative mr-2" ref={selectorRef}>
                    <button 
                        onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                        className={`flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm transition-all hover:border-blue-300 group min-w-[200px] justify-between ${isSelectorOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                {viewingMember.avatar ? <img src={viewingMember.avatar} className="w-full h-full object-cover"/> : <span className="font-bold text-xs text-slate-500">{viewingMember.name.charAt(0)}</span>}
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-bold text-slate-800 leading-tight">{viewingMember.name}</div>
                                <div className="text-[10px] text-slate-500 leading-tight truncate max-w-[100px]">{viewingMember.role}</div>
                            </div>
                        </div>
                        <ChevronDown size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors"/>
                    </button>

                    {/* DROPDOWN MENU */}
                    {isSelectorOpen && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in origin-top-right">
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        autoFocus
                                        placeholder="Tìm thành viên..."
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                            </div>

                            <div className="max-h-80 overflow-y-auto custom-scrollbar p-1">
                                {!memberSearch && (
                                    <>
                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Của tôi</div>
                                        <button
                                            onClick={() => { setViewingMemberId(currentUser.id); setIsSelectorOpen(false); }}
                                            className={`w-full flex items-center p-2 rounded-lg mb-1 transition-colors ${viewingMemberId === currentUser.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mr-3 border border-white shadow-sm">
                                                {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : currentUser.name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-bold">{currentUser.name}</div>
                                                <div className="text-[10px] opacity-70">Kế hoạch cá nhân</div>
                                            </div>
                                            {viewingMemberId === currentUser.id && <CheckCircle2 size={14} className="ml-auto text-blue-500"/>}
                                        </button>
                                        <div className="border-t border-slate-100 my-1"></div>
                                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đội ngũ ({filteredSubordinates.length})</div>
                                    </>
                                )}
                                
                                {filteredSubordinates.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-slate-400 italic">Không tìm thấy kết quả</div>
                                ) : (
                                    filteredSubordinates.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => { setViewingMemberId(m.id); setIsSelectorOpen(false); }}
                                            className={`w-full flex items-center p-2 rounded-lg mb-1 transition-colors ${viewingMemberId === m.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mr-3 border border-white shadow-sm flex-shrink-0">
                                                {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover"/> : m.name.charAt(0)}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <div className="text-xs font-bold truncate">{m.name}</div>
                                                <div className="text-[10px] opacity-70 truncate">{m.role}</div>
                                            </div>
                                            {viewingMemberId === m.id && <CheckCircle2 size={14} className="ml-auto text-blue-500"/>}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Main Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('PLANNING')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'PLANNING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Calendar size={14} className="mr-1.5"/> Lập kế hoạch
                </button>
                <button
                    onClick={() => setActiveTab('REVIEW')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'REVIEW' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <GitCompare size={14} className="mr-1.5"/> Đối soát tuần
                </button>
                <button
                    onClick={() => setActiveTab('LOGS')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'LOGS' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <History size={14} className="mr-1.5"/> Nhật ký
                </button>
            </div>

            {/* View Switcher */}
            {activeTab === 'PLANNING' && (
                <>
                    <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('DAILY')} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Focus size={14} className="mr-1.5"/> Ngày</button>
                        <button onClick={() => setViewMode('WEEKLY')} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'WEEKLY' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Layout size={14} className="mr-1.5"/> Tuần</button>
                        <button onClick={() => setViewMode('MONTHLY')} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'MONTHLY' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Target size={14} className="mr-1.5"/> Tháng</button>
                    </div>
                </>
            )}

            {isViewingSelf && (
                <button 
                    onClick={onGoToReports}
                    className="ml-auto md:ml-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-colors flex items-center shadow-sm text-xs"
                >
                    <ListTodo size={14} className="mr-1.5" />
                    Báo cáo ngày
                </button>
            )}
        </div>
      </div>

      {/* ... (Alerts and Header section - same as previous) ... */}
      {!isViewingSelf && (
          <div className="bg-orange-50 border border-orange-100 p-2 mb-4 rounded-lg flex items-center justify-center text-xs font-bold text-orange-700 animate-fade-in">
              <User size={14} className="mr-2"/> Bạn đang xem và chỉnh sửa kế hoạch của {viewingMember.name}
          </div>
      )}

      {renderPendingAlerts()}

      {/* ... (Existing Alerts: REJECTED, PENDING) ... */}
      {isViewingSelf && planStatus === 'REJECTED' && (
          <div className="bg-red-50 border border-red-100 p-4 mb-6 rounded-xl flex items-start gap-4 shadow-sm animate-fade-in">
              <div className="bg-red-100 text-red-600 p-2 rounded-full mt-1">
                  <XCircle size={24} />
              </div>
              <div className="flex-1">
                  <h3 className="font-bold text-red-800">Kế hoạch tuần chưa được duyệt</h3>
                  <div className="text-sm text-red-700 mt-1">
                      Quản lý yêu cầu sửa đổi: <span className="font-bold italic">"{planFeedback}"</span>
                  </div>
                  <div className="mt-3">
                      <button 
                          onClick={() => setIsSubmitModalOpen(true)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm"
                      >
                          Cập nhật & Gửi lại
                      </button>
                  </div>
              </div>
          </div>
      )}

      {!isViewingSelf && planStatus === 'PENDING' && (
          <div className="fixed bottom-0 left-0 md:left-64 right-0 z-30 bg-white border-t border-slate-200 p-4 shadow-lg animate-slide-up flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                  <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                      <Clock size={20} />
                  </div>
                  <div>
                      <div className="font-bold text-slate-800 text-sm">Nhân viên đã gửi kế hoạch</div>
                      <div className="text-xs text-slate-500 italic">"{submissionNote || 'Không có ghi chú'}"</div>
                  </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  <input 
                      type="text" 
                      value={managerActionComment}
                      onChange={(e) => setManagerActionComment(e.target.value)}
                      placeholder="Nhập nhận xét (nếu từ chối)..."
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px]"
                  />
                  <div className="flex gap-2">
                      <button 
                          onClick={() => handleManagerDecision('REJECTED')}
                          className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap flex items-center"
                      >
                          <RefreshCw size={14} className="mr-1"/> Yêu cầu sửa
                      </button>
                      <button 
                          onClick={() => handleManagerDecision('APPROVED')}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md whitespace-nowrap flex items-center"
                      >
                          <Stamp size={14} className="mr-1"/> Phê duyệt
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'PLANNING' && renderHeader()}

      <div className={`flex-1 overflow-y-auto custom-scrollbar pb-4 ${!isViewingSelf && planStatus === 'PENDING' ? 'mb-20' : ''}`}>
          {activeTab === 'PLANNING' && (
              <>
                {viewMode === 'DAILY' && (
                    <div className="flex flex-col lg:flex-row gap-6 h-full">
                        <div className="flex-1 bg-blue-50/30 rounded-2xl border border-blue-100 p-6 flex flex-col">
                            {/* ... (Daily content unchanged) ... */}
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center">
                                        <Calendar size={24} className="mr-2 text-blue-600"/> 
                                        {daysMap.find(d => d.key === selectedDayKey)?.label}, {formatDateVN(currentDate)}
                                    </h3>
                                    <p className="text-sm text-slate-500">Những việc cần hoàn thành trong ngày này.</p>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                {dailyTasks.map(task => (
                                    <WeeklyTaskCard
                                        key={task.id}
                                        task={task}
                                        isCompact={false}
                                        isLocked={isLocked && isViewingSelf && !(!committedTaskIds.includes(task.id) && viewMode === 'WEEKLY')}
                                        isAdHoc={(planStatus === 'APPROVED' || planStatus === 'PENDING') && !committedTaskIds.includes(task.id)}
                                        viewMode={viewMode}
                                        onToggleTask={handleToggleTask}
                                        onDeleteTask={handleDeletePersonalTask}
                                        onEditTask={openEditModal}
                                        onUpdateSubtask={handleInlineSubtaskToggle}
                                    />
                                ))}
                                {dailyTasks.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 italic text-sm">
                                        Chưa có kế hoạch cho ngày này. <br/> Thêm mới bên dưới.
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-blue-200">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={dayInputContent}
                                        onChange={(e) => setDayInputContent(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleInlineAdd(selectedDayKey)}
                                        placeholder={isLocked ? "Nhập việc phát sinh (Ad-hoc)..." : "Thêm việc mới..."}
                                        className={`flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${isLocked ? 'bg-orange-50 border-orange-200 text-orange-800 placeholder:text-orange-400 focus:ring-orange-500' : 'bg-white border-blue-200'}`}
                                    />
                                    <button 
                                        onClick={() => handleInlineAdd(selectedDayKey)}
                                        className={`px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center transition-all ${isLocked ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20'}`}
                                    >
                                        {isLocked ? <Zap size={20}/> : <Plus size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full lg:w-96 flex flex-col gap-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center"><ClipboardList size={18} className="mr-2 text-slate-500"/> Ghi chú nhanh</h4>
                                <textarea 
                                    className="w-full h-full min-h-[150px] resize-none outline-none text-sm text-slate-600 bg-transparent placeholder:text-slate-300"
                                    placeholder="Viết nháp ý tưởng, ghi chú cuộc họp..."
                                ></textarea>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'WEEKLY' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {daysMap.map(day => {
                            // Calculate exact date string for each column
                            const columnDate = getDateForDayColumn(day.key);
                            const columnDateStr = getIsoDate(columnDate);
                            
                            // Filter tasks by specific date
                            const dayTasks = myTasks.filter(t => t.day === columnDateStr);
                            const isToday = columnDate.toDateString() === new Date().toDateString();

                            return (
                                <div key={day.key} className={`bg-white rounded-xl border flex flex-col h-full min-h-[300px] shadow-sm ${isToday ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                                    
                                    {/* CLICKABLE HEADER TO ZOOM */}
                                    <div 
                                        onClick={() => handleZoomToDay(day.key)}
                                        className={`p-3 border-b border-slate-100 flex justify-between items-center cursor-pointer transition-colors group/header rounded-t-xl ${isToday ? 'bg-blue-50 hover:bg-blue-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                                        title="Nhấn để xem chi tiết ngày này"
                                    >
                                        <div>
                                            <span className={`font-bold block ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{day.label}</span>
                                            <span className="text-[10px] text-slate-500 font-semibold">{formatDateVN(columnDate)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">{dayTasks.length}</span>
                                            <Maximize2 size={14} className="text-slate-400 opacity-0 group-hover/header:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    
                                    <div className="p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[400px]">
                                        {dayTasks.map(task => (
                                            <WeeklyTaskCard
                                                key={task.id}
                                                task={task}
                                                isCompact={isCompact}
                                                isLocked={isLocked && isViewingSelf && !(!committedTaskIds.includes(task.id) && viewMode === 'WEEKLY')}
                                                isAdHoc={(planStatus === 'APPROVED' || planStatus === 'PENDING') && !committedTaskIds.includes(task.id) && viewMode === 'WEEKLY'}
                                                viewMode={viewMode}
                                                onToggleTask={handleToggleTask}
                                                onDeleteTask={handleDeletePersonalTask}
                                                onEditTask={openEditModal}
                                                onUpdateSubtask={handleInlineSubtaskToggle}
                                            />
                                        ))}
                                        
                                        {/* INLINE ADD (Only if not compact, or maybe allow if compact but show simple) */}
                                        {activeDayInput === columnDateStr ? (
                                            <div className="flex items-center gap-2 mt-2 animate-fade-in">
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    value={dayInputContent}
                                                    onChange={(e) => setDayInputContent(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleInlineAdd(columnDateStr);
                                                        if (e.key === 'Escape') { setActiveDayInput(null); setDayInputContent(''); }
                                                    }}
                                                    onBlur={() => {
                                                        if (!dayInputContent.trim()) setActiveDayInput(null);
                                                    }}
                                                    placeholder={isLocked ? "Phát sinh..." : "Nhập..."}
                                                    className={`w-full text-sm border rounded px-2 py-1.5 outline-none focus:ring-1 ${isLocked ? 'border-orange-300 focus:ring-orange-500 bg-orange-50' : 'border-blue-300 focus:ring-blue-500'}`}
                                                />
                                                <button onClick={() => handleInlineAdd(columnDateStr)} className={`${isLocked ? 'text-orange-600' : 'text-blue-600'} hover:opacity-80`}><Plus size={18}/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => { setActiveDayInput(columnDateStr); setDayInputContent(''); }}
                                                className={`w-full text-xs py-2 rounded border border-dashed mt-2 transition-colors flex items-center justify-center ${isLocked ? 'text-orange-500 border-orange-200 hover:bg-orange-50' : 'text-slate-400 border-slate-200 hover:text-blue-600 hover:bg-blue-50'}`}
                                            >
                                                {isLocked ? <Zap size={14} className="mr-1"/> : <Plus size={14} className="mr-1"/>} 
                                                {isLocked ? 'Phát sinh' : 'Thêm việc'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ... (Monthly view unchanged) ... */}
                {viewMode === 'MONTHLY' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-8 rounded-2xl border border-green-200 mb-6 text-center">
                            <h3 className="text-2xl font-bold text-green-900 mb-2">Mục tiêu Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</h3>
                            <p className="text-green-700">"Đặt mục tiêu lớn, chia nhỏ hành động, bám sát kế hoạch."</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="space-y-4 mb-6">
                                {monthlyGoals.map(task => (
                                    <WeeklyTaskCard
                                        key={task.id}
                                        task={task}
                                        isCompact={false}
                                        isLocked={false} // Monthly goals often editable
                                        isAdHoc={false}
                                        viewMode={viewMode}
                                        onToggleTask={handleToggleTask}
                                        onDeleteTask={handleDeletePersonalTask}
                                        onEditTask={openEditModal}
                                        onUpdateSubtask={handleInlineSubtaskToggle}
                                    />
                                ))}
                                
                                {monthlyGoals.length === 0 && (
                                    <div className="text-center py-10 text-slate-400 italic">
                                        Chưa có mục tiêu nào cho tháng này. Hãy thêm ngay!
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-100">
                                <input 
                                    type="text" 
                                    value={monthlyGoalInput}
                                    onChange={(e) => setMonthlyGoalInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddMonthlyGoal()}
                                    placeholder="Nhập mục tiêu lớn trong tháng..."
                                    className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 font-medium"
                                />
                                <button 
                                    onClick={handleAddMonthlyGoal}
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center"
                                >
                                    <Plus size={20} className="mr-2" /> Thêm mục tiêu
                                </button>
                            </div>
                        </div>
                    </div>
                )}
              </>
          )}

          {activeTab === 'REVIEW' && renderComparisonView()}
          {activeTab === 'LOGS' && renderLogView()}
      </div>

      {/* ... (Modals remain unchanged) ... */}
      {isReviewOpen && (
          // ... (Existing Review Modal Content) ...
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                  {/* ... Header ... */}
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center text-lg">
                          <Award size={22} className="mr-2 text-purple-600" />
                          Review Hiệu suất tuần
                      </h3>
                      <button onClick={() => setIsReviewOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full shadow-sm hover:shadow">
                          <X size={20} />
                      </button>
                  </div>
                  
                  {/* ... Body ... */}
                  <div className="p-6 space-y-6">
                      <div className="text-center">
                          <label className="block text-sm font-bold text-slate-600 mb-3">Tuần này bạn làm việc thế nào?</label>
                          <div className="flex justify-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                      key={star}
                                      onClick={() => setReviewRating(star)}
                                      className="transition-transform hover:scale-110 focus:outline-none"
                                  >
                                      <Star 
                                          size={32} 
                                          className={`${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} transition-colors`} 
                                          strokeWidth={star <= reviewRating ? 0 : 1.5}
                                      />
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                              <CheckSquare size={14} className="mr-1 text-green-600"/> Điều làm tốt (Highlights)
                          </label>
                          <textarea 
                              value={reviewHighlights}
                              onChange={(e) => setReviewHighlights(e.target.value)}
                              placeholder="- Hoàn thành dự án A trước hạn..."
                              className="w-full bg-green-50/50 border border-green-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                              <TrendingUp size={14} className="mr-1 text-orange-600"/> Điều cần cải thiện
                          </label>
                          <textarea 
                              value={reviewImprovements}
                              onChange={(e) => setReviewImprovements(e.target.value)}
                              placeholder="- Cần tập trung hơn vào buổi sáng..."
                              className="w-full bg-orange-50/50 border border-orange-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                          />
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                      <button onClick={() => setIsReviewOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">Đóng</button>
                      <button 
                          onClick={handleSaveReview}
                          className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-bold flex items-center shadow-lg transform active:scale-95 transition-all"
                      >
                          <Save size={16} className="mr-2" /> Lưu đánh giá
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isSubmitModalOpen && (
          // ... (Existing Submit Modal - kept same but ensure imports are correct) ...
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  {/* ... Header ... */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center text-lg">
                          <Shield size={22} className="mr-2 text-blue-600" />
                          Xác nhận Kế hoạch Tuần {currentWeekNum}
                      </h3>
                      <button onClick={() => setIsSubmitModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full shadow-sm">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                      {/* Approver Selection */}
                      <div className="flex flex-col gap-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gửi báo cáo đến (Approver)</label>
                          <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
                              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold border-2 border-white shadow-sm overflow-hidden">
                                  {targetMemberManager?.avatar ? <img src={targetMemberManager.avatar} className="w-full h-full object-cover"/> : <User size={18}/>}
                              </div>
                              <div className="flex-1">
                                  <select 
                                      value={selectedApproverId} 
                                      onChange={(e) => setSelectedApproverId(e.target.value)}
                                      className="w-full bg-transparent font-bold text-slate-800 text-sm outline-none border-b border-blue-200 pb-1 focus:border-blue-500 transition-colors cursor-pointer"
                                  >
                                      {defaultManager && <option value={defaultManager.id}>Mặc định: {defaultManager.name} ({defaultManager.role})</option>}
                                      <optgroup label="Lãnh đạo & Quản lý khác">
                                          {(potentialApprovers as Member[]).filter(m => m.id !== defaultManager?.id).map(approver => (
                                              <option key={approver.id} value={approver.id}>
                                                  {approver.name} ({approver.role})
                                              </option>
                                          ))}
                                      </optgroup>
                                  </select>
                                  <div className="text-[10px] text-slate-500 mt-1">Người này sẽ nhận thông báo và phê duyệt kế hoạch của bạn.</div>
                              </div>
                          </div>
                      </div>

                      {/* STATS ROW */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                              <div className="text-3xl font-black text-slate-800 mb-1">{(myTasks as PersonalTask[]).filter(t => t.day >= getIsoDate(weekStart) && t.day <= getIsoDate(weekEnd)).length}</div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tổng đầu việc</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                              <div className="text-3xl font-black text-blue-600 mb-1">{currentWeekNum}</div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tuần làm việc</div>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                              <FileText size={14} className="mr-1 text-slate-400"/> Lời nhắn / Trọng tâm tuần này
                          </label>
                          <textarea 
                              value={submissionNote}
                              onChange={(e) => setSubmissionNote(e.target.value)}
                              placeholder="VD: Tuần này em tập trung hoàn thành dự án A và hỗ trợ team B..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                          />
                      </div>

                      {/* UPDATED TASK LIST UI */}
                      <div className="mt-2">
                          <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center">
                                  <ListTodo size={14} className="mr-1.5"/> Danh sách công việc
                              </h4>
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">Preview</span>
                          </div>
                          
                          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                  {(myTasks as PersonalTask[])
                                    .filter(t => t.day >= getIsoDate(weekStart) && t.day <= getIsoDate(weekEnd))
                                    .sort((a,b) => a.day.localeCompare(b.day))
                                    .map((t, idx) => {
                                      const date = new Date(t.day);
                                      const dayLabel = date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
                                      return (
                                          <div key={t.id} className="flex items-start gap-3 p-3 border-b border-slate-100 last:border-0 hover:bg-white transition-colors group">
                                              <div className="flex-shrink-0 w-16">
                                                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded block text-center shadow-sm group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                                                      {dayLabel}
                                                  </span>
                                              </div>
                                              <div className="flex-1 min-w-0 pt-0.5">
                                                  <p className="text-xs font-semibold text-slate-700 leading-snug break-words">{t.content}</p>
                                                  {(t.subtasks?.length ?? 0) > 0 && (
                                                      <div className="flex items-center mt-1 text-[9px] text-slate-400">
                                                          <CheckSquare size={10} className="mr-1"/> 
                                                          {t.subtasks?.length} mục nhỏ
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                                  {(myTasks as PersonalTask[]).filter(t => t.day >= getIsoDate(weekStart) && t.day <= getIsoDate(weekEnd)).length === 0 && (
                                      <div className="p-8 text-center text-xs text-slate-400 italic">
                                          Chưa có công việc nào được thêm vào tuần này.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                      <button onClick={() => setIsSubmitModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Hủy bỏ</button>
                      <button 
                          onClick={handleConfirmSubmit}
                          className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold flex items-center shadow-lg transform active:scale-95 transition-all"
                      >
                          <Lock size={16} className="mr-2" /> Chốt & Gửi ngay
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isFinalizeModalOpen && (
          // ... (Existing Finalize Modal - kept same) ...
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center text-lg">
                          <CheckCircle2 size={22} className="mr-2" />
                          Tổng kết & Chốt sổ Tuần {currentWeekNum}
                      </h3>
                      <button onClick={() => setIsFinalizeModalOpen(false)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                      
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Hiệu suất làm việc</h4>
                          <div className="grid grid-cols-2 gap-4 text-center">
                              <div>
                                  <div className="text-2xl font-black text-blue-600">{stats.committedDone}/{stats.committedCount}</div>
                                  <div className="text-[10px] text-slate-500">Việc cam kết</div>
                              </div>
                              <div>
                                  <div className="text-2xl font-black text-orange-600">{stats.adHocDone}/{stats.adHocCount}</div>
                                  <div className="text-[10px] text-slate-500">Việc phát sinh</div>
                              </div>
                          </div>
                      </div>

                      {stats.unfinished > 0 ? (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                              <h4 className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center">
                                  <AlertCircle size={14} className="mr-1"/> Công việc tồn đọng ({stats.unfinished})
                              </h4>
                              <div className="text-sm text-red-600 mb-3">
                                  Bạn còn {stats.unfinished} đầu việc chưa hoàn thành. Hãy lên kế hoạch xử lý!
                              </div>
                              <ul className="max-h-32 overflow-y-auto space-y-1 pl-1">
                                  {(myTasks as PersonalTask[]).filter(t => t.day !== 'MONTHLY' && !t.completed).map(t => (
                                      <li key={t.id} className="text-xs flex items-center gap-2 text-slate-600">
                                          <Square size={12} className="text-red-400"/>
                                          <span className="truncate">{t.content}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      ) : (
                          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center text-green-700 font-bold text-sm">
                              <ThumbsUp size={18} className="mr-2"/> Xuất sắc! Bạn đã hoàn thành tất cả công việc.
                          </div>
                      )}

                      {!reviewHighlights && (
                          <div className="text-sm text-slate-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex items-center">
                              <Star size={16} className="text-yellow-500 mr-2"/>
                              Đừng quên tự đánh giá (Review) trước khi chốt sổ nhé!
                          </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đề xuất / Kế hoạch tuần tới</label>
                          <textarea 
                              value={nextWeekPlanNote}
                              onChange={(e) => setNextWeekPlanNote(e.target.value)}
                              placeholder="VD: Tuần sau sẽ tập trung xử lý các task tồn đọng..."
                              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                          />
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                      <button onClick={() => setIsFinalizeModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">Hủy bỏ</button>
                      <button 
                          onClick={handleConfirmFinalize}
                          className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-bold flex items-center shadow-lg transform active:scale-95 transition-all"
                      >
                          <Check size={18} className="mr-2" /> Xác nhận Chốt sổ
                      </button>
                  </div>
              </div>
          </div>
      )}

      {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">
                          {editingTask.day === selectedMonthKey ? 'Chi tiết Mục tiêu Tháng' : 'Chi tiết công việc'}
                      </h3>
                      <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  </div>
                  <div className="p-4 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Nội dung</label>
                          <input 
                            type="text" 
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú chi tiết</label>
                          <textarea 
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Nhập thêm thông tin, link tài liệu..."
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none bg-slate-50 focus:bg-white transition-colors"
                          />
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-2 flex justify-between">
                              <span>Checklist {editingTask.day === selectedMonthKey ? 'các bước thực hiện' : 'công việc nhỏ'}</span>
                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded">{editSubtasks.filter(s => s.completed).length}/{editSubtasks.length}</span>
                          </label>
                          <div className="space-y-2 mb-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                              {editSubtasks.map(sub => (
                                  <div key={sub.id} className="flex items-center gap-2 group/sub">
                                      <button onClick={() => toggleSubtask(sub.id)} className={sub.completed ? 'text-green-500' : 'text-slate-300'}>
                                          {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                      </button>
                                      <span className={`text-sm flex-1 ${sub.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{sub.content}</span>
                                      <button onClick={() => deleteSubtask(sub.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-opacity"><X size={14}/></button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newSubtaskInput}
                                  onChange={(e) => setNewSubtaskInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                                  placeholder="Thêm việc nhỏ..."
                                  className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button onClick={handleAddSubtask} disabled={!newSubtaskInput.trim()} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded"><Plus size={16}/></button>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                      <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Hủy</button>
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold">Lưu thay đổi</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PersonalWeeklyTasks;
