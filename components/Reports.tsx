
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Task, TaskStatus, Member, Role, Department, getRoleLevel, WorkReport, ApprovalRequest } from '../types';
import { 
  PieChart as PieChartIcon, 
  Users, 
  User, 
  Download, 
  Calendar, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Trophy, 
  Target, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Search,
  X,
  Star,
  Activity,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface ReportsProps {
  tasks: Task[];
  members: Member[];
  currentUser: Member;
  workReports?: WorkReport[]; // Added for KPI Quality/Discipline
  approvals?: ApprovalRequest[]; // Added for KPI Quality
}

const COLORS = {
  [TaskStatus.TODO]: '#94a3b8',
  [TaskStatus.IN_PROGRESS]: '#3b82f6',
  [TaskStatus.REVIEW]: '#f59e0b',
  [TaskStatus.DONE]: '#10b981',
  [TaskStatus.PENDING]: '#a855f7',
  [TaskStatus.CANCELLED]: '#64748b',
  OVERDUE: '#ef4444'
};

// --- KPI HELPER FUNCTIONS ---
const calculateMemberKPI = (
    memberId: string, 
    tasks: Task[], 
    reports: WorkReport[], 
    approvals: ApprovalRequest[], 
    startDate: Date, 
    endDate: Date
) => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 1. FILTER DATA BY DATE & USER
    const myTasks = tasks.filter(t => {
        const d = new Date(t.deadline);
        return t.assigneeId === memberId && d >= startDate && d <= endDate;
    });
    
    const myReports = reports.filter(r => r.userId === memberId && r.date >= startStr && r.date <= endStr);
    
    const myRequests = approvals.filter(r => {
        const d = new Date(r.createdAt);
        return r.requesterId === memberId && d >= startDate && d <= endDate;
    });

    // 2. CALCULATE METRICS

    // A. OUTPUT (HIỆU SUẤT) - 50%
    // - Completion Rate: Done / Total
    const totalTasks = myTasks.length;
    const doneTasks = myTasks.filter(t => t.status === TaskStatus.DONE).length;
    const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
    
    // - On-Time Delivery: Done & Not Overdue / Total Done
    const overdueTasks = myTasks.filter(t => {
        // If not done, it's overdue if deadline < now
        if (t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED) {
            return new Date(t.deadline) < new Date();
        }
        return false; 
    }).length;
    
    // Let's use a "Success Rate" = (Total - Overdue) / Total
    const onTimeRate = totalTasks > 0 ? ((totalTasks - overdueTasks) / totalTasks) * 100 : 100;
    
    const outputScore = Math.round(completionRate * 0.6 + onTimeRate * 0.4);

    // B. QUALITY (CHẤT LƯỢNG) - 30%
    // - Manager Rating: Avg of `managerRating` (1-5) -> 100 scale
    const ratedReports = myReports.filter(r => r.managerRating);
    const avgRating = ratedReports.reduce((acc, r) => acc + (r.managerRating || 0), 0) / (ratedReports.length || 1);
    const ratingScore = (avgRating / 5) * 100; // 0-100

    // - Approval Rate: Approved immediately / Total requests
    const totalRequests = myRequests.length;
    const approvedRequests = myRequests.filter(r => r.status === 'APPROVED').length;
    const approvalScore = totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 100; // Default 100 if no requests (neutral)

    // Weighted Quality: Rating (if exists) has higher weight.
    const qualityScore = ratedReports.length > 0 
        ? Math.round(ratingScore * 0.7 + approvalScore * 0.3)
        : Math.round(approvalScore); // Fallback if no ratings yet

    // C. DISCIPLINE (KỶ LUẬT) - 20%
    // - Report Compliance: Submitted Reports / Working Days (approx)
    let workingDays = 0;
    let loopDate = new Date(startDate);
    while (loopDate <= endDate && loopDate <= new Date()) { // Don't count future days
        const day = loopDate.getDay();
        if (day !== 0 && day !== 6) workingDays++;
        loopDate.setDate(loopDate.getDate() + 1);
    }
    const submittedCount = myReports.length;
    const disciplineScore = workingDays > 0 ? Math.min((submittedCount / workingDays) * 100, 100) : 100;

    // TOTAL KPI (Weighted)
    const finalScore = Math.round(outputScore * 0.5 + qualityScore * 0.3 + disciplineScore * 0.2);

    return {
        score: finalScore,
        details: {
            output: outputScore,
            quality: qualityScore,
            discipline: Math.round(disciplineScore),
            // Raw data for tooltip
            totalTasks, doneTasks, overdueTasks,
            avgRating: avgRating.toFixed(1),
            approvalRate: Math.round(approvalScore),
            reportsSubmitted: submittedCount
        }
    };
};

const Reports: React.FC<ReportsProps> = ({ tasks, members, currentUser, workReports = [], approvals = [] }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MEMBERS' | 'PROJECTS'>('OVERVIEW');
  const [timeRange, setTimeRange] = useState<'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH'>('THIS_MONTH');
  
  // KPI Detail Modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // --- HIERARCHY LOGIC ---
  const myRoleLevel = getRoleLevel(currentUser.roleType);
  
  const viewableMembers = useMemo(() => {
      // 1. Board Members (Level 5) -> See Managers (Level 4) and Deputy (Level 3) only
      if (myRoleLevel === 5) {
           return members.filter(m => getRoleLevel(m.roleType) >= 3);
      }

      // 2. Managers (Level 4) -> See All
      if (myRoleLevel >= 3) return members;

      // 3. Leaders (Level 2) -> See Dept Staff + Themselves
      if (myRoleLevel === 2) {
          return members.filter(m => 
              m.department === currentUser.department && 
              (getRoleLevel(m.roleType) < 2 || m.id === currentUser.id)
          );
      }

      // 4. Staff (Level 1) -> See Only Self
      return members.filter(m => m.id === currentUser.id);
  }, [members, currentUser, myRoleLevel]);

  const viewableMemberIds = useMemo(() => viewableMembers.map(m => m.id), [viewableMembers]);

  // --- TIME FILTER LOGIC ---
  const getDateRange = () => {
      const now = new Date();
      const start = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      if (timeRange === 'THIS_WEEK') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          start.setHours(0,0,0,0);
          end.setDate(start.getDate() + 6);
      } else if (timeRange === 'LAST_WEEK') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
          start.setDate(diff);
          start.setHours(0,0,0,0);
          end.setDate(start.getDate() + 6);
      } else if (timeRange === 'THIS_MONTH') {
          start.setDate(1);
          start.setHours(0,0,0,0);
          end.setMonth(start.getMonth() + 1);
          end.setDate(0);
      } else if (timeRange === 'LAST_MONTH') {
          start.setMonth(start.getMonth() - 1);
          start.setDate(1);
          start.setHours(0,0,0,0);
          end.setDate(0);
      }
      return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // --- FILTER TASKS ---
  const filteredTasks = useMemo(() => {
      return tasks.filter(t => {
          const isViewableAssignee = viewableMemberIds.includes(t.assigneeId);
          if (!isViewableAssignee) return false;

          const taskDate = new Date(t.deadline);
          return taskDate >= startDate && taskDate <= endDate;
      });
  }, [tasks, viewableMemberIds, startDate, endDate]);

  // --- MEMBER LEADERBOARD (3D KPI Model) ---
  const memberLeaderboard = useMemo(() => {
      return viewableMembers.map(m => {
          const kpi = calculateMemberKPI(m.id, tasks, workReports, approvals, startDate, endDate);
          return { ...m, ...kpi };
      }).sort((a, b) => b.score - a.score);
  }, [filteredTasks, viewableMembers, workReports, approvals, startDate, endDate]);

  // --- SELECTED MEMBER DATA FOR MODAL ---
  const selectedMemberData = useMemo(() => {
      if (!selectedMemberId) return null;
      return memberLeaderboard.find(m => m.id === selectedMemberId);
  }, [selectedMemberId, memberLeaderboard]);

  const radarData = useMemo(() => {
      if (!selectedMemberData) return [];
      return [
          { subject: 'Hiệu suất (50%)', A: selectedMemberData.details.output, fullMark: 100 },
          { subject: 'Chất lượng (30%)', A: selectedMemberData.details.quality, fullMark: 100 },
          { subject: 'Kỷ luật (20%)', A: selectedMemberData.details.discipline, fullMark: 100 },
      ];
  }, [selectedMemberData]);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      const total = filteredTasks.length;
      const done = filteredTasks.filter(t => t.status === TaskStatus.DONE).length;
      const cancelled = filteredTasks.filter(t => t.status === TaskStatus.CANCELLED).length;
      const overdue = filteredTasks.filter(t => {
          if (t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED || t.status === TaskStatus.PENDING) return false;
          return new Date(t.deadline) < new Date();
      }).length;
      const validTotal = total - cancelled;
      const completionRate = validTotal > 0 ? Math.round((done / validTotal) * 100) : 0;
      
      return { total, done, cancelled, overdue, completionRate };
  }, [filteredTasks]);

  // --- CHARTS DATA ---
  const statusData = useMemo(() => {
      const counts: Record<string, number> = {};
      Object.values(TaskStatus).forEach(s => counts[s] = 0);
      filteredTasks.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
      return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredTasks]);

  const handlePrint = () => window.print();

  return (
    <div className="h-full flex flex-col animate-fade-in pb-10 space-y-6">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                  <PieChartIcon size={24} className="mr-3 text-blue-600" />
                  Báo cáo & KPI
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                  Đánh giá hiệu suất nhân sự theo mô hình 3 chiều (Output - Quality - Discipline).
              </p>
          </div>

          <div className="flex flex-wrap gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  {[
                      { id: 'THIS_WEEK', label: 'Tuần này' },
                      { id: 'LAST_WEEK', label: 'Tuần trước' },
                      { id: 'THIS_MONTH', label: 'Tháng này' },
                      { id: 'LAST_MONTH', label: 'Tháng trước' },
                  ].map((opt) => (
                      <button
                          key={opt.id}
                          onClick={() => setTimeRange(opt.id as any)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                              timeRange === opt.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                      >
                          {opt.label}
                      </button>
                  ))}
              </div>
              
              <button 
                  onClick={handlePrint}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center shadow-sm transition-all text-xs font-bold print:hidden"
              >
                  <Download size={16} className="mr-2" /> Xuất báo cáo
              </button>
          </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Tổng công việc</p>
              <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Briefcase size={20}/></div>
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Tỷ lệ hoàn thành</p>
              <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-green-600">{stats.completionRate}%</h3>
                  <div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle2 size={20}/></div>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-green-500 h-full transition-all duration-1000" style={{width: `${stats.completionRate}%`}}></div>
              </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Quá hạn</p>
              <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-red-600">{stats.overdue}</h3>
                  <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertCircle size={20}/></div>
              </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-xl border border-indigo-400 shadow-sm text-white">
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">Điểm KPI cao nhất</p>
              <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black text-white">{memberLeaderboard[0]?.score || 0}</h3>
                  <div className="p-2 bg-white/20 rounded-lg"><Trophy size={20}/></div>
              </div>
              <p className="text-xs text-indigo-100 mt-1 opacity-90">
                  {memberLeaderboard[0] ? `${memberLeaderboard[0].name} (${memberLeaderboard[0].role})` : 'Chưa có dữ liệu'}
              </p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Charts */}
          <div className="lg:col-span-2 space-y-6">
              {/* Task Distribution */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-6 flex items-center">
                      <Layers size={20} className="mr-2 text-blue-600"/> Phân bổ trạng thái công việc
                  </h4>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}} />
                              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                  {statusData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as unknown as TaskStatus] || '#cbd5e1'} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          {/* Right: KPI Leaderboard */}
          <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-yellow-50 to-orange-50">
                  <h4 className="font-bold text-yellow-800 flex items-center text-lg">
                      <Trophy size={20} className="mr-2 text-yellow-600" /> Bảng xếp hạng KPI
                  </h4>
                  <p className="text-xs text-yellow-700 mt-1">Dựa trên mô hình 3D (Hiệu suất - Chất lượng - Kỷ luật)</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  {memberLeaderboard.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 italic">Chưa có dữ liệu.</div>
                  ) : (
                      memberLeaderboard.map((m, idx) => (
                          <div 
                              key={m.id} 
                              onClick={() => setSelectedMemberId(m.id)}
                              className="flex items-center gap-3 p-3 hover:bg-blue-50/50 rounded-xl transition-colors border border-transparent hover:border-blue-100 mb-1 relative group cursor-pointer"
                          >
                              <div className={`
                                  w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs flex-shrink-0 border-2
                                  ${idx === 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 
                                    idx === 1 ? 'bg-slate-200 text-slate-700 border-slate-300' : 
                                    idx === 2 ? 'bg-orange-100 text-orange-800 border-orange-200' : 
                                    'bg-white text-slate-500 border-slate-100'}
                              `}>
                                  {idx + 1}
                              </div>
                              
                              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                  {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-xs font-bold text-slate-400">{m.name.charAt(0)}</div>}
                              </div>

                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                      <h5 className="font-bold text-sm text-slate-800 truncate">{m.name}</h5>
                                      <span className="font-black text-indigo-600 text-sm">{m.score}</span>
                                  </div>
                                  <div className="flex justify-between items-center mt-1">
                                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{m.role}</span>
                                      <div className="flex items-center gap-2 text-[10px]">
                                          <span className="text-slate-400 text-[10px]">Nhấn để xem chi tiết</span>
                                      </div>
                                  </div>
                                  {/* Metric Bars (Mini) */}
                                  <div className="flex gap-1 mt-1.5 h-1">
                                      <div className="bg-blue-500 rounded-full" style={{width: `${m.details.output/3}%`}} title="Hiệu suất"></div>
                                      <div className="bg-purple-500 rounded-full" style={{width: `${m.details.quality/3}%`}} title="Chất lượng"></div>
                                      <div className="bg-orange-500 rounded-full" style={{width: `${m.details.discipline/3}%`}} title="Kỷ luật"></div>
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      {/* KPI DETAIL MODAL */}
      {selectedMemberData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedMemberId(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/50 overflow-hidden">
                              {selectedMemberData.avatar ? <img src={selectedMemberData.avatar} className="w-full h-full object-cover"/> : <span className="text-xl font-bold">{selectedMemberData.name.charAt(0)}</span>}
                          </div>
                          <div>
                              <h3 className="font-bold text-xl">{selectedMemberData.name}</h3>
                              <p className="text-blue-100 text-sm">{selectedMemberData.role}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-xs text-blue-200 uppercase font-bold tracking-wider">Tổng điểm KPI</div>
                          <div className="text-4xl font-black">{selectedMemberData.score}</div>
                      </div>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="flex flex-col md:flex-row gap-8 items-center">
                          {/* Left: Radar Chart */}
                          <div className="w-full md:w-1/2 h-64 relative">
                              <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                      <PolarGrid />
                                      <PolarAngleAxis dataKey="subject" tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} />
                                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                      <Radar name={selectedMemberData.name} dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.5} />
                                      <Tooltip />
                                  </RadarChart>
                              </ResponsiveContainer>
                              {/* Central Score */}
                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                  <div className="text-xs font-bold text-indigo-900 bg-white/80 px-2 rounded-full backdrop-blur-sm">Balanced</div>
                              </div>
                          </div>

                          {/* Right: Detailed Metrics */}
                          <div className="flex-1 w-full space-y-4">
                              {/* Output */}
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-blue-800 text-sm flex items-center"><Zap size={14} className="mr-1"/> Hiệu suất (Output)</span>
                                      <span className="font-bold text-blue-600">{selectedMemberData.details.output}/100</span>
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                      <div className="flex justify-between"><span>Hoàn thành:</span> <b>{selectedMemberData.details.doneTasks}/{selectedMemberData.details.totalTasks} task</b></div>
                                      <div className="flex justify-between"><span>Đúng hạn:</span> <b>{selectedMemberData.details.overdueTasks} trễ</b></div>
                                  </div>
                              </div>

                              {/* Quality */}
                              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-purple-800 text-sm flex items-center"><Star size={14} className="mr-1"/> Chất lượng (Quality)</span>
                                      <span className="font-bold text-purple-600">{selectedMemberData.details.quality}/100</span>
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                      <div className="flex justify-between"><span>Đánh giá Manager:</span> <b>{selectedMemberData.details.avgRating}/5.0</b></div>
                                      <div className="flex justify-between"><span>Tỷ lệ duyệt bài:</span> <b>{selectedMemberData.details.approvalRate}%</b></div>
                                  </div>
                              </div>

                              {/* Discipline */}
                              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-orange-800 text-sm flex items-center"><ShieldCheck size={14} className="mr-1"/> Kỷ luật (Discipline)</span>
                                      <span className="font-bold text-orange-600">{selectedMemberData.details.discipline}/100</span>
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                      <div className="flex justify-between"><span>Báo cáo đã nộp:</span> <b>{selectedMemberData.details.reportsSubmitted}</b></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                      <button onClick={() => setSelectedMemberId(null)} className="px-5 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-100 transition-colors">
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;
