
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Task, TaskStatus, Member, Department } from '../types';
import { CheckCircle2, Clock, AlertCircle, ListTodo, Bell, AlertTriangle, User, Users, Plus, FileText, X, Sparkles, TrendingUp, Briefcase, Zap, Calendar, ArrowRight, Target, Layout, PauseCircle, XCircle, AlertOctagon, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import { generatePerformanceReport, analyzeProjectBottlenecks } from '../services/geminiService';

interface DashboardProps {
  tasks: Task[];
  members: Member[];
  onCreateTask?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, members, onCreateTask }) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // --- DATA CALCULATIONS ---

  // Helper: Get Week Range
  const getWeekRange = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday (Monday start)
      const start = new Date(d.setDate(diff));
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      return { start, end };
  };

  // 1. Comparison Data Logic (This Week vs Last Week)
  const comparisonData = useMemo(() => {
      const today = new Date();
      const thisWeekRange = getWeekRange(new Date(today));
      
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const lastWeekRange = getWeekRange(lastWeekDate);

      const getStats = (start: Date, end: Date) => {
          // Tasks that are "Active" or "Due" in this period
          const periodTasks = tasks.filter(t => {
              const d = new Date(t.deadline);
              return d >= start && d <= end;
          });

          // "New Tasks": Started/Created in this period
          const newTasks = tasks.filter(t => {
              const d = new Date(t.startDate);
              return d >= start && d <= end;
          }).length;

          // "Completed": Status DONE and Deadline in this period (or completedAt if we tracked it, using deadline as proxy for period)
          const completed = periodTasks.filter(t => t.status === TaskStatus.DONE).length;
          
          // "Overdue": Due in this period but NOT done
          const overdue = periodTasks.filter(t => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED && new Date(t.deadline) < new Date()).length;

          return { new: newTasks, completed, overdue };
      };

      const thisWeek = getStats(thisWeekRange.start, thisWeekRange.end);
      const lastWeek = getStats(lastWeekRange.start, lastWeekRange.end);

      return [
          { name: 'Tuần trước', 'Mới': lastWeek.new, 'Hoàn thành': lastWeek.completed, 'Quá hạn': lastWeek.overdue },
          { name: 'Tuần này', 'Mới': thisWeek.new, 'Hoàn thành': thisWeek.completed, 'Quá hạn': thisWeek.overdue },
      ];
  }, [tasks]);

  // Calculate Growth Percentages
  const weeklyGrowth = useMemo(() => {
      const last = comparisonData[0];
      const current = comparisonData[1];

      const calcGrowth = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return Math.round(((curr - prev) / prev) * 100);
      };

      return {
          new: calcGrowth(current['Mới'], last['Mới']),
          completed: calcGrowth(current['Hoàn thành'], last['Hoàn thành']),
          overdue: calcGrowth(current['Quá hạn'], last['Quá hạn'])
      };
  }, [comparisonData]);

  // General Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.TODO || t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.REVIEW).length;
  const highPriority = tasks.filter(t => t.priority === 'High' && t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED).length;
  
  // 2. Charts Data - ORDERED 1->6
  const statusData = [
    { name: 'Chưa thực hiện', value: tasks.filter(t => t.status === TaskStatus.TODO).length },
    { name: 'Đang thực hiện', value: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length },
    { name: 'Chờ duyệt', value: tasks.filter(t => t.status === TaskStatus.REVIEW).length },
    { name: 'Hoàn tất', value: tasks.filter(t => t.status === TaskStatus.DONE).length },
    { name: 'Tạm hoãn', value: tasks.filter(t => t.status === TaskStatus.PENDING).length },
    { name: 'Đã hủy', value: tasks.filter(t => t.status === TaskStatus.CANCELLED).length },
  ];
  const COLORS = ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#64748b'];

  // 3. Urgent Tasks
  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    const deadline = new Date(dateStr);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const urgentTasks = useMemo(() => tasks
    .filter(t => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED && t.status !== TaskStatus.PENDING)
    .map(t => ({ ...t, daysLeft: getDaysRemaining(t.deadline) }))
    .filter(t => t.daysLeft <= 3) // Include overdue (negative) and upcoming within 3 days
    .sort((a, b) => a.daysLeft - b.daysLeft), [tasks]);

  const overdueCount = urgentTasks.filter(t => t.daysLeft < 0).length;

  // 4. Department Progress
  const deptProgress = useMemo(() => {
      const depts: Record<string, string> = { 'DieuHanh': 'Ban Điều Hành', 'Media': 'Media & Prod', 'Content': 'Content/Social', 'Seeding': 'Seeding' };
      return Object.keys(depts).map(deptKey => {
          const deptMembers = members.filter(m => m.department === deptKey).map(m => m.id);
          const deptTasks = tasks.filter(t => deptMembers.includes(t.assigneeId));
          const total = deptTasks.length;
          const done = deptTasks.filter(t => t.status === TaskStatus.DONE).length;
          const percent = total > 0 ? Math.round((done / total) * 100) : 0;
          let color = 'bg-blue-500';
          if (percent >= 80) color = 'bg-green-500';
          else if (percent >= 50) color = 'bg-blue-500';
          else color = 'bg-orange-500';
          return { id: deptKey, name: depts[deptKey], percent, total, done, color };
      });
  }, [tasks, members]);

  // 5. Workload / Top Active Members
  const topMembers = useMemo(() => {
      return members.map(m => {
          const active = tasks.filter(t => t.assigneeId === m.id && (t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.REVIEW)).length;
          return { ...m, activeTasks: active };
      })
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 5);
  }, [tasks, members]);

  // AI Actions
  const handleCreateReport = async () => {
      setReportTitle("Báo cáo Hiệu suất (AI)");
      setReportContent('');
      setIsReportModalOpen(true);
      setIsGeneratingReport(true);
      const report = await generatePerformanceReport(tasks, members);
      setReportContent(report);
      setIsGeneratingReport(false);
  };

  const handleAnalyzeBottlenecks = async () => {
      setReportTitle("Phân tích Điểm nghẽn & Giải pháp");
      setReportContent('');
      setIsReportModalOpen(true);
      setIsGeneratingReport(true);
      const analysis = await analyzeProjectBottlenecks(tasks, members);
      setReportContent(analysis);
      setIsGeneratingReport(false);
  };

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* ALERT BANNER */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ring-1 ring-red-100">
            <div className="flex items-center">
                <div className="bg-red-100 p-2.5 rounded-full mr-4 text-red-600 animate-pulse">
                    <AlertTriangle size={28} />
                </div>
                <div>
                    <h3 className="text-red-800 font-bold text-lg leading-tight">Cảnh báo: Có {overdueCount} công việc quá hạn!</h3>
                    <p className="text-red-600 text-sm font-medium mt-1">Tiến độ dự án đang bị ảnh hưởng. Vui lòng kiểm tra danh sách bên dưới.</p>
                </div>
            </div>
            <div className="hidden md:block">
                 <span className="text-xs font-bold text-red-400 uppercase tracking-wider border border-red-200 px-2 py-1 rounded">Urgent Action Required</span>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">{today}</p>
              <h2 className="text-2xl font-bold text-slate-800">Xin chào, Team Marketing 👋</h2>
              <p className="text-slate-500 mt-1">Tổng quan tình hình dự án hôm nay.</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto flex-wrap">
              <button onClick={handleAnalyzeBottlenecks} className="flex-1 lg:flex-none justify-center bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-4 py-2.5 rounded-xl flex items-center shadow-sm transition-all text-sm font-bold whitespace-nowrap">
                <AlertOctagon size={18} className="mr-2" /> Điểm nghẽn
              </button>
              <button onClick={handleCreateReport} className="flex-1 lg:flex-none justify-center bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-xl flex items-center shadow-sm transition-all text-sm font-bold whitespace-nowrap">
                <Sparkles size={18} className="mr-2" /> AI Report
              </button>
              {onCreateTask && (
                  <button onClick={onCreateTask} className="flex-1 lg:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center shadow-lg shadow-blue-900/20 transition-all text-sm font-bold active:scale-95 whitespace-nowrap">
                    <Plus size={18} className="mr-2" /> Tạo việc mới
                  </button>
              )}
          </div>
      </div>

      {/* --- WEEKLY COMPARISON CHART (NEW SECTION) --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center text-lg">
                  <BarChart2 size={24} className="mr-2 text-indigo-600"/> 
                  Hiệu suất: Tuần này vs Tuần trước
              </h3>
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 font-medium">
                  Tự động cập nhật theo thời gian thực
              </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart */}
              <div className="lg:col-span-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} barSize={40} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                          <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                          <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                          <Tooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                          />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}}/>
                          <Bar dataKey="Mới" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Việc mới" />
                          <Bar dataKey="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} name="Hoàn thành" />
                          <Bar dataKey="Quá hạn" fill="#ef4444" radius={[4, 4, 0, 0]} name="Quá hạn" />
                      </BarChart>
                  </ResponsiveContainer>
              </div>

              {/* Stats Summary Column */}
              <div className="flex flex-col justify-center space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                          <p className="text-xs font-bold text-slate-500 uppercase">Công việc mới</p>
                          <p className="text-2xl font-black text-slate-800">{comparisonData[1]['Mới']}</p>
                      </div>
                      <div className={`text-right ${weeklyGrowth.new > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                          <div className="text-xs font-bold flex items-center justify-end">
                              {weeklyGrowth.new > 0 ? <TrendingUp size={14} className="mr-1"/> : <Minus size={14} className="mr-1"/>}
                              {weeklyGrowth.new > 0 ? '+' : ''}{weeklyGrowth.new}%
                          </div>
                          <p className="text-[10px] text-slate-400">vs tuần trước</p>
                      </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                      <div>
                          <p className="text-xs font-bold text-green-700 uppercase">Đã hoàn thành</p>
                          <p className="text-2xl font-black text-green-800">{comparisonData[1]['Hoàn thành']}</p>
                      </div>
                      <div className={`text-right ${weeklyGrowth.completed > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          <div className="text-xs font-bold flex items-center justify-end">
                              {weeklyGrowth.completed > 0 ? <TrendingUp size={14} className="mr-1"/> : <Minus size={14} className="mr-1"/>}
                              {weeklyGrowth.completed > 0 ? '+' : ''}{weeklyGrowth.completed}%
                          </div>
                          <p className="text-[10px] text-green-600/70">vs tuần trước</p>
                      </div>
                  </div>

                  <div className={`p-4 rounded-xl border flex items-center justify-between ${comparisonData[1]['Quá hạn'] > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                          <p className={`text-xs font-bold uppercase ${comparisonData[1]['Quá hạn'] > 0 ? 'text-red-700' : 'text-slate-500'}`}>Quá hạn</p>
                          <p className={`text-2xl font-black ${comparisonData[1]['Quá hạn'] > 0 ? 'text-red-800' : 'text-slate-800'}`}>{comparisonData[1]['Quá hạn']}</p>
                      </div>
                      <div className="text-right">
                          <div className={`text-xs font-bold flex items-center justify-end ${weeklyGrowth.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {weeklyGrowth.overdue > 0 ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
                              {weeklyGrowth.overdue > 0 ? '+' : ''}{weeklyGrowth.overdue}%
                          </div>
                          <p className="text-[10px] text-slate-400">vs tuần trước</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* QUICK STATS (Summary Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Active */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <ListTodo size={80} />
          </div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Layout size={20} />
             </div>
             <span className="text-sm font-bold text-slate-500">Đang thực hiện</span>
          </div>
          <div className="flex items-baseline gap-2">
             <h3 className="text-3xl font-black text-slate-800">{pendingTasks}</h3>
             <span className="text-xs font-medium text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Active</span>
          </div>
        </div>

        {/* Card 2: Workload/Active Users */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Users size={80} />
          </div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                <Briefcase size={20} />
             </div>
             <span className="text-sm font-bold text-slate-500">Nhân sự bận rộn</span>
          </div>
          <div className="flex -space-x-2 mt-2">
             {topMembers.slice(0,4).map(m => (
                 <div key={m.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden" title={`${m.name}: ${m.activeTasks} tasks`}>
                     {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover"/> : m.name.charAt(0)}
                 </div>
             ))}
             {topMembers.length > 4 && <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">...</div>}
          </div>
        </div>

        {/* Card 3: Completion Rate */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <CheckCircle2 size={80} />
          </div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
                <Target size={20} />
             </div>
             <span className="text-sm font-bold text-slate-500">Tiến độ chung</span>
          </div>
          <div className="flex items-baseline gap-2">
             <h3 className="text-3xl font-black text-slate-800">{totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%</h3>
             <span className="text-xs text-slate-400">hoàn thành</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
             <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{width: `${totalTasks > 0 ? (completedTasks/totalTasks)*100 : 0}%`}}></div>
          </div>
        </div>

        {/* Card 4: Urgent */}
        <div className={`bg-white p-5 rounded-2xl shadow-sm border relative overflow-hidden group hover:shadow-md transition-all ${overdueCount > 0 ? 'border-red-200 ring-2 ring-red-50' : 'border-slate-100'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <AlertTriangle size={80} />
          </div>
          <div className="flex items-center gap-3 mb-3">
             <div className={`p-2.5 rounded-lg ${overdueCount > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle size={20} />
             </div>
             <span className="text-sm font-bold text-slate-500">Gấp / Quá hạn</span>
          </div>
          <div className="flex items-baseline gap-2">
             <h3 className={`text-3xl font-black ${highPriority + urgentTasks.filter(t=>t.daysLeft<0).length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                 {highPriority + urgentTasks.filter(t=>t.daysLeft<0).length}
             </h3>
             <span className="text-xs font-medium text-slate-400">task</span>
          </div>
          <p className="text-xs text-red-500 mt-2 font-medium">{overdueCount > 0 ? `Có ${overdueCount} task quá hạn!` : 'Cần xử lý ngay!'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (2/3): PROGRESS & CHARTS */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* DEPARTMENT PROGRESS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-5 flex items-center">
                    <TrendingUp size={20} className="mr-2 text-blue-600"/> Tiến độ các bộ phận
                </h3>
                <div className="space-y-5">
                    {deptProgress.map(dept => (
                        <div key={dept.id}>
                            <div className="flex justify-between items-center mb-1.5 text-sm">
                                <span className="font-bold text-slate-700">{dept.name}</span>
                                <span className="font-medium text-slate-500 text-xs">{dept.done}/{dept.total} task ({dept.percent}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${dept.color}`} style={{width: `${dept.percent}%`}}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[320px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-2">Trạng thái công việc</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            >
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                        </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                {/* WORKLOAD LIST */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[320px] overflow-hidden flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                        <span>Chi tiết nhân sự</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Top Active</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                        {topMembers.map((m, idx) => (
                            <div key={m.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden">
                                            {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full font-bold text-xs text-slate-500">{m.name.charAt(0)}</div>}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 line-clamp-1">{m.name}</div>
                                        <div className="text-[10px] text-slate-400 line-clamp-1">{m.role}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-bold text-blue-600 text-sm">{m.activeTasks}</span>
                                    <span className="text-[10px] text-slate-400">active</span>
                                </div>
                            </div>
                        ))}
                        {topMembers.length === 0 && <div className="text-center text-slate-400 text-xs py-10">Chưa có dữ liệu</div>}
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN (1/3): NOTIFICATIONS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[650px] lg:sticky lg:top-6">
          <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center justify-between">
            <span className="flex items-center"><Bell size={20} className="mr-2 text-orange-500" /> Cần chú ý</span>
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{urgentTasks.length}</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {urgentTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <div className="bg-green-50 p-4 rounded-full mb-3">
                        <CheckCircle2 size={32} className="text-green-500"/>
                    </div>
                    <p className="text-sm font-medium">Không có việc gấp!</p>
                    <p className="text-xs mt-1">Tận hưởng cafe nhé ☕</p>
                </div>
            ) : (
                urgentTasks.map(task => {
                    // Just show one assignee for notification context
                    const primaryAssignee = members.find(m => m.id === task.assigneeId);
                    const isOverdue = task.daysLeft < 0;
                    const isToday = task.daysLeft === 0;
                    
                    let statusColorClass = 'bg-white border-slate-200 hover:border-blue-300';
                    let badgeClass = 'bg-blue-100 text-blue-700';
                    let icon = <Calendar size={12} className="text-blue-600"/>;
                    let titleColor = "text-slate-800";
                    
                    if (isOverdue) {
                        statusColorClass = 'bg-red-50/50 border-red-200 hover:border-red-400';
                        badgeClass = 'bg-red-600 text-white animate-pulse shadow-sm';
                        icon = <AlertCircle size={12} className="text-white"/>;
                        titleColor = "text-red-800";
                    } else if (isToday) {
                        statusColorClass = 'bg-yellow-50/50 border-yellow-200 hover:border-yellow-400';
                        badgeClass = 'bg-yellow-500 text-white';
                        icon = <Zap size={12} className="text-white"/>;
                    } else {
                        statusColorClass = 'bg-orange-50/30 border-orange-200 hover:border-orange-300';
                        badgeClass = 'bg-orange-100 text-orange-700';
                        icon = <Clock size={12} className="text-orange-600"/>;
                    }

                    return (
                      <div key={task.id} className={`p-3 rounded-xl border transition-all group ${statusColorClass}`}>
                          <div className="flex justify-between items-start mb-2">
                              <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${badgeClass}`}>
                                  {icon}
                                  {isOverdue 
                                    ? `Trễ ${Math.abs(task.daysLeft)} ngày` 
                                    : isToday ? 'Hôm nay' : `${task.daysLeft} ngày nữa`}
                              </div>
                              {task.priority === 'High' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                          </div>
                          
                          <h4 className={`font-bold text-sm mb-2 leading-snug line-clamp-2 ${titleColor} transition-colors`} title={task.title}>
                              {task.title}
                          </h4>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-black/5 mt-2">
                             <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 overflow-hidden flex-shrink-0 shadow-sm">
                                    {primaryAssignee?.avatar ? <img src={primaryAssignee.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-[8px]">{primaryAssignee?.name.charAt(0)}</div>}
                                </div>
                                <span className="text-xs text-slate-600 truncate max-w-[80px]">
                                    {primaryAssignee?.name}
                                </span>
                             </div>
                             <div className="text-[10px] font-mono text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                {new Date(task.deadline).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                             </div>
                          </div>
                      </div>
                    );
                })
            )}
          </div>
          <button className="w-full mt-4 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center">
              Xem tất cả thông báo <ArrowRight size={12} className="ml-1"/>
          </button>
        </div>
      </div>

      {/* AI Report Modal */}
      {isReportModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                      <h3 className="font-bold text-lg flex items-center">
                          <Sparkles size={20} className="mr-2" /> {reportTitle}
                      </h3>
                      <button onClick={() => setIsReportModalOpen(false)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                      {isGeneratingReport ? (
                          <div className="flex flex-col items-center justify-center py-12">
                              <div className="relative">
                                  <Sparkles size={48} className="text-purple-500 animate-pulse" />
                                  <div className="absolute top-0 right-0 w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
                              </div>
                              <p className="text-slate-500 font-medium mt-4 animate-pulse">Gemini đang phân tích dữ liệu...</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap bg-white p-6 rounded-xl border border-slate-200 shadow-sm leading-relaxed">
                              {reportContent}
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t border-slate-100 flex justify-end bg-white">
                      <button 
                        onClick={() => setIsReportModalOpen(false)}
                        className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
