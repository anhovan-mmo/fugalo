
import React, { useState, useRef, useEffect } from 'react';
import { Task, PersonalTask, Member, TaskStatus } from '../types';
import { ChevronLeft, ChevronRight, Calendar, User, Users, CheckCircle2, GanttChart, ZoomIn, ZoomOut, LayoutList, MoreHorizontal, Search, Filter } from 'lucide-react';

interface ScheduleProps {
  tasks: Task[];
  personalTasks: PersonalTask[];
  members: Member[];
  currentUser: Member;
}

type ViewMode = 'TIMELINE' | 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
type Scope = 'PERSONAL' | 'TEAM';
type GroupBy = 'MEMBER' | 'NONE';

const CELL_WIDTH = 60; // Width of one day in pixels for Timeline

const Schedule: React.FC<ScheduleProps> = ({ tasks, personalTasks, members, currentUser }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('TIMELINE');
  const [scope, setScope] = useState<Scope>('TEAM');
  const [groupBy, setGroupBy] = useState<GroupBy>('MEMBER');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState(''); // NEW: Search state
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const getDayLabel = (date: Date) => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  const formatDate = (date: Date) => {
    // Helper to return YYYY-MM-DD for input type="date" value
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    return new Date(d.setDate(diff));
  };

  const getMonthName = (monthIndex: number) => {
    return `Tháng ${monthIndex + 1}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // --- Filtering Logic ---

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]; // Use simple ISO split for comparison logic
    const dayLabel = getDayLabel(date);

    let items: { id: string; title: string; type: 'task' | 'personal'; status?: string; assignee?: string }[] = [];

    if (scope === 'TEAM') {
      const teamTasks = tasks.filter(t => t.deadline === dateStr);
      items = teamTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: 'task',
        status: t.status,
        assignee: t.assigneeId
      }));
    } else {
      // Filter Personal Tasks for Current User
      const pTasks = personalTasks.filter(t => t.day === dayLabel && t.userId === currentUser.id);
      
      // Also include Project Tasks assigned to user for that date
      const myProjectTasks = tasks.filter(t => t.deadline === dateStr && t.assigneeId === currentUser.id);
      
      const checklistItems = pTasks.map(t => ({
        id: t.id,
        title: t.content,
        type: 'personal' as const,
        status: t.completed ? 'DONE' : 'TODO'
      }));

      const projectItems = myProjectTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: 'task' as const,
        status: t.status,
        assignee: t.assigneeId
      }));

      items = [...checklistItems, ...projectItems];
    }

    // Apply Search Filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        items = items.filter(i => i.title.toLowerCase().includes(query));
    }

    return items;
  };

  const getTasksForMonth = (year: number, month: number) => {
    let allMonthTasks = tasks.filter(t => {
      const d = new Date(t.deadline);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    if (scope !== 'TEAM') {
       allMonthTasks = allMonthTasks.filter(t => t.assigneeId === currentUser.id); 
    }

    // Apply Search Filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        allMonthTasks = allMonthTasks.filter(t => t.title.toLowerCase().includes(query));
    }

    return allMonthTasks;
  };

  // --- Navigation Handlers ---

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'DAY') newDate.setDate(newDate.getDate() - 1);
    if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() - 7);
    if (viewMode === 'TIMELINE' || viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() - 1);
    if (viewMode === 'QUARTER') newDate.setMonth(newDate.getMonth() - 3);
    if (viewMode === 'YEAR') newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'DAY') newDate.setDate(newDate.getDate() + 1);
    if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() + 7);
    if (viewMode === 'TIMELINE' || viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() + 1);
    if (viewMode === 'QUARTER') newDate.setMonth(newDate.getMonth() + 3);
    if (viewMode === 'YEAR') newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateJump = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
      }
  };

  // --- Renderers ---

  const renderHeader = () => {
    let title = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    switch (viewMode) {
      case 'DAY':
        title = `${getDayLabel(currentDate)}, ${currentDate.getDate()} Tháng ${month + 1}, ${year}`;
        break;
      case 'WEEK':
        const start = getStartOfWeek(currentDate);
        const end = addDays(start, 6);
        title = `Tuần ${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}, ${year}`;
        break;
      case 'TIMELINE':
      case 'MONTH':
        title = `Tháng ${month + 1}, ${year}`;
        break;
      case 'QUARTER':
        const currentQuarter = Math.floor(month / 3) + 1;
        title = `Quý ${currentQuarter}, ${year}`;
        break;
      case 'YEAR':
        title = `Năm ${year}`;
        break;
    }

    return (
      <div className="flex flex-col gap-4 mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        {/* Row 1: Navigation & Main Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
            <button
                onClick={() => setScope('PERSONAL')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${
                scope === 'PERSONAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <User size={16} className="mr-2" /> Cá nhân
            </button>
            <button
                onClick={() => setScope('TEAM')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center ${
                scope === 'TEAM' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <Users size={16} className="mr-2" /> Bộ phận
            </button>
            </div>

            <div className="flex items-center space-x-4">
                <button onClick={handlePrev} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
                <h2 className="text-lg font-bold min-w-[200px] text-center capitalize">{title}</h2>
                <button onClick={handleNext} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
                <button onClick={handleToday} className="text-sm text-blue-600 font-medium hover:underline">Hôm nay</button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button
                onClick={() => setViewMode('TIMELINE')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center ${
                    viewMode === 'TIMELINE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                <GanttChart size={14} className="mr-1.5" /> Timeline
            </button>
            <div className="w-px h-6 bg-slate-300 mx-1 self-center"></div>
            {(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as ViewMode[]).map((mode) => (
                <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                    viewMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                >
                {mode === 'DAY' && 'Ngày'}
                {mode === 'WEEK' && 'Tuần'}
                {mode === 'MONTH' && 'Tháng'}
                {mode === 'QUARTER' && 'Quý'}
                {mode === 'YEAR' && 'Năm'}
                </button>
            ))}
            </div>
        </div>

        {/* Row 2: Search & Jump to Date & Filters */}
        <div className="flex flex-col md:flex-row gap-3 pt-3 border-t border-slate-100">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Tìm tên công việc..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
            
            <div className="flex gap-3">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <Calendar size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Đến ngày:</span>
                    <input 
                        type="date" 
                        value={formatDate(currentDate)}
                        onChange={handleDateJump}
                        className="bg-transparent text-sm font-semibold outline-none text-slate-700 cursor-pointer w-32"
                    />
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <Filter size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Nhóm:</span>
                    <select 
                        value={groupBy} 
                        onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        className="text-sm bg-transparent outline-none font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
                        disabled={scope === 'PERSONAL'}
                    >
                        <option value="MEMBER">Nhân sự</option>
                        <option value="NONE">Không nhóm</option>
                    </select>
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderTimelineView = () => {
    // 1. Prepare Date Axis
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
    const today = new Date();
    today.setHours(0,0,0,0);

    // 2. Filter Tasks for this Month (Overlapping)
    const timelineStart = new Date(year, month, 1);
    const timelineEnd = new Date(year, month, daysInMonth);

    // Filter ALL tasks that overlap with the current view AND match search
    const overlappingTasks = tasks.filter(t => {
        const start = new Date(t.startDate || t.deadline);
        const end = new Date(t.deadline);
        // Check overlap
        const inTimeRange = start <= timelineEnd && end >= timelineStart;
        
        // Check Search
        const matchesSearch = !searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase());

        return inTimeRange && matchesSearch;
    });

    // 3. Grouping Logic
    let groups: { id: string; title: string; avatar?: string; items: Task[] }[] = [];

    if (scope === 'TEAM') {
        if (groupBy === 'MEMBER') {
            groups = members.map(m => ({
                id: m.id,
                title: m.name,
                avatar: m.avatar,
                items: overlappingTasks.filter(t => t.assigneeId === m.id)
            })).filter(g => g.items.length > 0); 
        } else {
            groups = [{ id: 'all', title: 'Tất cả công việc', items: overlappingTasks }];
        }
    } else {
        // Personal View: Show ONLY tasks assigned to current user
        const myTasks = overlappingTasks.filter(t => t.assigneeId === currentUser.id); 
        groups = [{ id: 'me', title: 'Công việc của tôi', items: myTasks }];
    }

    const getTaskStyles = (task: Task) => {
        const start = new Date(task.startDate || task.deadline);
        const end = new Date(task.deadline);
        
        // Clamp dates to visible range
        const visibleStart = start < timelineStart ? timelineStart : start;
        const visibleEnd = end > timelineEnd ? timelineEnd : end;

        const startDayIndex = visibleStart.getDate() - 1;
        const durationDays = Math.max(1, (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 3600 * 24) + 1);

        const left = startDayIndex * CELL_WIDTH;
        const width = durationDays * CELL_WIDTH;

        let bgColor = 'bg-slate-400';
        let extraClass = '';
        if (task.status === TaskStatus.DONE) bgColor = 'bg-emerald-500';
        else if (task.status === TaskStatus.IN_PROGRESS) bgColor = 'bg-blue-500';
        else if (task.status === TaskStatus.REVIEW) bgColor = 'bg-amber-500';
        else if (task.status === TaskStatus.PENDING) bgColor = 'bg-purple-400'; // Purple for Pending
        else if (task.status === TaskStatus.CANCELLED) { bgColor = 'bg-slate-300'; extraClass = 'line-through opacity-70'; } // Gray strikethrough for Cancelled
        else if (new Date(task.deadline) < new Date()) bgColor = 'bg-red-500';

        return { left, width, bgColor, extraClass };
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[600px] animate-fade-in">
            {/* Toolbar - Moved to Header, kept minimal here if needed or removed */}
            
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar (Member Names) */}
                <div className="w-60 flex-shrink-0 border-r border-slate-200 bg-white z-10 shadow-[4px_0_10px_-3px_rgba(0,0,0,0.1)]">
                    <div className="h-12 border-b border-slate-200 bg-slate-50 flex items-center px-4 font-bold text-slate-700 text-sm">
                        Danh sách & Công việc
                    </div>
                    <div className="overflow-y-hidden"> {/* Scroll synced via JS later or structure */}
                        {groups.map(group => (
                            <div key={group.id} className="border-b border-slate-100 last:border-0">
                                {(groupBy === 'MEMBER' || scope === 'PERSONAL') && (
                                    <div className="px-4 py-3 bg-slate-50/50 flex items-center gap-2 sticky top-0 border-b border-slate-100 h-14">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                                            {group.id === 'me' && currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : (group.avatar ? <img src={group.avatar} className="w-full h-full object-cover"/> : (group.title ? group.title.charAt(0) : 'U'))}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm text-slate-800 truncate">{group.title}</div>
                                            <div className="text-[10px] text-slate-500">{group.items.length} tasks</div>
                                        </div>
                                    </div>
                                )}
                                <div className="py-2">
                                    {group.items.map(task => (
                                        <div key={task.id} className="h-9 px-4 flex items-center text-xs text-slate-600 hover:bg-slate-50 truncate cursor-pointer" title={task.title}>
                                            {task.title}
                                        </div>
                                    ))}
                                    {group.items.length === 0 && <div className="h-9 px-4 flex items-center text-xs text-slate-400 italic">Trống</div>}
                                </div>
                            </div>
                        ))}
                        {groups.length === 0 && <div className="p-4 text-xs text-slate-400 italic text-center">Không có dữ liệu phù hợp bộ lọc.</div>}
                    </div>
                </div>

                {/* Main Timeline Grid */}
                <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollContainerRef}>
                    <div style={{ width: `${daysInMonth * CELL_WIDTH}px` }} className="min-w-full">
                        {/* Date Header */}
                        <div className="h-12 flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                            {daysArray.map((day, idx) => {
                                const isToday = day.getDate() === today.getDate() && day.getMonth() === today.getMonth();
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                return (
                                    <div 
                                        key={idx} 
                                        style={{ width: `${CELL_WIDTH}px` }} 
                                        className={`flex-shrink-0 border-r border-slate-200 flex flex-col items-center justify-center text-xs
                                            ${isToday ? 'bg-blue-100 text-blue-700 font-bold' : isWeekend ? 'bg-slate-100 text-slate-500' : 'text-slate-600'}
                                        `}
                                    >
                                        <span className="opacity-70 text-[10px]">{getDayLabel(day)}</span>
                                        <span>{day.getDate()}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grid Body */}
                        {groups.map(group => (
                            <div key={group.id} className="relative border-b border-slate-100 last:border-0">
                                {/* Row Background Grid */}
                                <div className="absolute inset-0 flex h-full pointer-events-none">
                                    {daysArray.map((day, idx) => {
                                        const isToday = day.getDate() === today.getDate() && day.getMonth() === today.getMonth();
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        return (
                                            <div 
                                                key={idx} 
                                                style={{ width: `${CELL_WIDTH}px` }} 
                                                className={`flex-shrink-0 border-r border-slate-100 h-full 
                                                    ${isToday ? 'bg-blue-50/30' : isWeekend ? 'bg-slate-50/30' : ''}
                                                `}
                                            >
                                                {isToday && <div className="h-full w-px bg-blue-400 absolute left-1/2 opacity-50"></div>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Group Header Spacer */}
                                {(groupBy === 'MEMBER' || scope === 'PERSONAL') && <div className="h-14 w-full"></div>}

                                {/* Tasks Bars */}
                                <div className="py-2 relative">
                                    {group.items.map(task => {
                                        const { left, width, bgColor, extraClass } = getTaskStyles(task);
                                        return (
                                            <div key={task.id} className="h-9 relative w-full group/taskrow">
                                                <div 
                                                    className={`absolute top-1.5 h-6 rounded-md shadow-sm border border-white/20 text-[10px] text-white flex items-center px-2 whitespace-nowrap overflow-hidden transition-all hover:brightness-110 cursor-pointer ${bgColor} ${extraClass}`}
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                    title={`${task.title} (${task.startDate} - ${task.deadline}) [${task.status}]`}
                                                >
                                                    <span className="font-semibold drop-shadow-sm sticky left-2">{task.title}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {group.items.length === 0 && <div className="h-9"></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderDayView = () => {
    const tasksForDay = getTasksForDate(currentDate);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        <h3 className="font-bold text-slate-700 mb-4">Danh sách công việc</h3>
        {tasksForDay.length === 0 ? (
          <div className="text-center text-slate-400 py-10">Không có công việc nào {searchQuery && 'phù hợp với tìm kiếm'}.</div>
        ) : (
          <div className="space-y-3">
            {tasksForDay.map((t, idx) => {
                const assignee = members.find(m => m.id === t.assignee);
                let statusColor = 'bg-yellow-100 text-yellow-700';
                if (t.status === 'DONE') statusColor = 'bg-green-100 text-green-700';
                if (t.status === 'CANCELLED') statusColor = 'bg-slate-200 text-slate-500 line-through';
                if (t.status === 'PENDING') statusColor = 'bg-purple-100 text-purple-700';

                return (
                    <div key={idx} className="flex items-center p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className={`w-2 h-10 rounded mr-4 ${t.type === 'personal' ? 'bg-teal-400' : 'bg-blue-500'}`}></div>
                        <div className="flex-1">
                            <h4 className={`font-semibold text-slate-800 ${t.status === 'CANCELLED' ? 'line-through text-slate-400' : ''}`}>{t.title}</h4>
                            <div className="flex items-center text-xs text-slate-500 mt-1">
                                {t.type === 'task' && assignee && (
                                    <span className="flex items-center mr-3">
                                        <User size={12} className="mr-1" /> {assignee.name}
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 rounded ${statusColor}`}>
                                    {t.status}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const start = getStartOfWeek(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }

    return (
      <div className="grid grid-cols-7 gap-2 h-full min-h-[600px]">
        {days.map((day, idx) => {
            const isToday = formatDate(day) === formatDate(new Date());
            const dayTasks = getTasksForDate(day);
            return (
                <div key={idx} className={`bg-white rounded-lg border ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'} flex flex-col`}>
                    <div className={`p-2 text-center border-b ${isToday ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'}`}>
                        <div className="text-xs font-bold uppercase">{getDayLabel(day)}</div>
                        <div className="text-lg font-bold">{day.getDate()}</div>
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {dayTasks.map((t, tIdx) => {
                            let bgClass = 'bg-blue-50 border-blue-100';
                            if (t.type === 'personal') bgClass = 'bg-teal-50 border-teal-100';
                            if (t.status === 'CANCELLED') bgClass = 'bg-slate-100 border-slate-200 text-slate-400 line-through';
                            if (t.status === 'PENDING') bgClass = 'bg-purple-50 border-purple-100 text-purple-700';

                            return (
                                <div key={tIdx} className={`text-xs p-2 rounded border ${bgClass}`}>
                                    <div className="font-medium line-clamp-2">{t.title}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // 0 for Mon, 6 for Sun adjustment
    const totalDays = lastDayOfMonth.getDate();
    
    const blanks = Array(startDay).fill(null);
    const days = Array.from({ length: totalDays }, (_, i) => i + 1);
    
    const allCells = [...blanks, ...days];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2">
           {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
               <div key={d} className="text-sm font-bold text-slate-600">{d}</div>
           ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-5 min-h-[600px]">
           {allCells.map((d, idx) => {
               if (!d) return <div key={idx} className="bg-slate-50/30 border-r border-b border-slate-100" />;
               
               const currentDayDate = new Date(year, month, d);
               const dayTasks = getTasksForDate(currentDayDate);
               const isToday = formatDate(currentDayDate) === formatDate(new Date());

               return (
                   <div key={idx} className={`border-r border-b border-slate-100 p-2 relative hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}>
                       <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{d}</div>
                       <div className="space-y-1">
                           {dayTasks.slice(0, 3).map((t, tIdx) => (
                               <div key={tIdx} className={`text-[10px] truncate px-1.5 py-0.5 rounded ${t.type === 'personal' ? 'bg-teal-100 text-teal-800' : t.status === 'CANCELLED' ? 'bg-slate-200 text-slate-500 line-through' : 'bg-blue-100 text-blue-800'}`}>
                                   {t.title}
                               </div>
                           ))}
                           {dayTasks.length > 3 && (
                               <div className="text-[10px] text-slate-400 pl-1">+{dayTasks.length - 3} nữa</div>
                           )}
                       </div>
                   </div>
               )
           })}
        </div>
      </div>
    );
  };

  const renderQuarterView = () => {
    const currentMonth = currentDate.getMonth(); // 0-11
    const startQuarterMonth = Math.floor(currentMonth / 3) * 3;
    const months = [startQuarterMonth, startQuarterMonth + 1, startQuarterMonth + 2];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {months.map(m => {
                const displayYear = currentDate.getFullYear();
                const tasksInMonth = getTasksForMonth(displayYear, m);
                // Filter team tasks or count personal tasks
                
                return (
                    <div key={m} className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-center text-slate-700">{getMonthName(m)}</h3>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                           {scope === 'TEAM' || tasksInMonth.length > 0 ? (
                               (tasksInMonth as Task[]).length > 0 ? (
                                   (tasksInMonth as Task[]).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).map(t => (
                                       <div key={t.id} className="p-3 border rounded-lg hover:shadow-sm transition-shadow">
                                           <div className="text-xs text-slate-500 mb-1">{t.deadline}</div>
                                           <div className="font-medium text-sm text-slate-800">{t.title}</div>
                                           <div className={`text-[10px] inline-block px-2 py-0.5 rounded mt-2 ${
                                               t.status === 'DONE' ? 'bg-green-100 text-green-700' : 
                                               t.status === 'CANCELLED' ? 'bg-slate-200 text-slate-500 line-through' :
                                               t.status === 'PENDING' ? 'bg-purple-100 text-purple-700' :
                                               'bg-blue-100 text-blue-700'
                                           }`}>{t.status}</div>
                                       </div>
                                   ))
                               ) : <div className="text-center text-sm text-slate-400 mt-10">Trống</div>
                           ) : (
                                <div className="text-center text-sm text-slate-500 italic p-4">
                                    Công việc cá nhân lặp lại hàng tuần. <br/>
                                    Xem chi tiết ở chế độ Tuần.
                                </div>
                           )}
                        </div>
                    </div>
                );
            })}
        </div>
    )
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({length: 12}, (_, i) => i);

    return (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {months.map(m => {
                 const tasksInMonth = getTasksForMonth(year, m);
                 
                 return (
                     <button 
                        key={m} 
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(m);
                            setCurrentDate(d);
                            setViewMode('MONTH');
                        }}
                        className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-400 hover:shadow-md transition-all text-left"
                     >
                         <h4 className="font-bold text-slate-700 mb-2">{getMonthName(m)}</h4>
                         <div className="flex items-center space-x-2">
                            <span className="text-2xl font-bold text-blue-600">{tasksInMonth.length}</span>
                            <span className="text-xs text-slate-500">công việc</span>
                        </div>
                     </button>
                 )
            })}
        </div>
    )
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {renderHeader()}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'TIMELINE' && renderTimelineView()}
        {viewMode === 'DAY' && renderDayView()}
        {viewMode === 'WEEK' && renderWeekView()}
        {viewMode === 'MONTH' && renderMonthView()}
        {viewMode === 'QUARTER' && renderQuarterView()}
        {viewMode === 'YEAR' && renderYearView()}
      </div>
    </div>
  );
};

export default Schedule;
