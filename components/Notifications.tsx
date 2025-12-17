
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Member, Role, RoleConfig, canEditTask, canDeleteTask, WeeklyPlan } from '../types';
import { Bell, AlertCircle, Clock, CheckCircle2, User, AlertTriangle, Calendar, ArrowRight, Users, X, Pencil, Trash2, Save, MessageSquare, PauseCircle, XCircle, ListTodo, Filter, CalendarDays } from 'lucide-react';

interface NotificationsProps {
  tasks: Task[];
  members: Member[];
  currentUser: Member;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  rolePermissions: Record<Role, RoleConfig>;
  pendingPlans?: WeeklyPlan[];
  onViewPlan?: (memberId: string) => void;
}

const Notifications: React.FC<NotificationsProps> = ({ 
    tasks, 
    members,
    currentUser,
    onUpdateTask,
    onDeleteTask,
    rolePermissions,
    pendingPlans = [],
    onViewPlan
}) => {
  // Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  
  // Filter State
  const [timeRange, setTimeRange] = useState<'7_DAYS' | '30_DAYS'>('7_DAYS');

  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const toInputDateTime = (isoString: string) => {
    if (!isoString) return '';
    if (isoString.length === 10) return `${isoString}T09:00`;
    return isoString.substring(0, 16);
  };

  const formatDateTimeDisplay = (dateStr: string) => {
      if(!dateStr) return '';
      const date = new Date(dateStr);
      // FIX: 24h format
      return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // --- DERIVED DATA ---
  
  // 1. Action Items (Always show regardless of time range)
  const actionItems = useMemo(() => {
      const overdue = tasks.filter(t => 
          t.status !== TaskStatus.DONE && 
          t.status !== TaskStatus.CANCELLED && 
          t.status !== TaskStatus.PENDING &&
          getDaysRemaining(t.deadline) < 0
      ).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

      return {
          overdue,
          pendingPlans
      };
  }, [tasks, pendingPlans]);

  // 2. Upcoming Items (Filtered by Time Range)
  const upcomingItems = useMemo(() => {
      const rangeLimit = timeRange === '7_DAYS' ? 7 : 30;
      
      const todayTasks = tasks.filter(t => 
          t.status !== TaskStatus.DONE && 
          t.status !== TaskStatus.CANCELLED && 
          t.status !== TaskStatus.PENDING &&
          getDaysRemaining(t.deadline) === 0
      );

      const futureTasks = tasks.filter(t => {
          const days = getDaysRemaining(t.deadline);
          return t.status !== TaskStatus.DONE && 
                 t.status !== TaskStatus.CANCELLED && 
                 t.status !== TaskStatus.PENDING &&
                 days > 0 && days <= rangeLimit;
      }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

      return {
          today: todayTasks,
          future: futureTasks
      };
  }, [tasks, timeRange]);

  const openTaskModal = (task: Task) => {
      setSelectedTask(task);
      setEditForm({ ...task });
  };

  const handleSave = () => {
      if (selectedTask && editForm) {
          onUpdateTask({ ...selectedTask, ...editForm } as Task);
          setSelectedTask(null);
      }
  };

  const handleDelete = () => {
      if (selectedTask && window.confirm('Bạn có chắc muốn xóa công việc này?')) {
          onDeleteTask(selectedTask.id);
          setSelectedTask(null);
      }
  };

  const renderTaskCard = (task: Task, type: 'overdue' | 'today' | 'upcoming') => {
    const assignee = members.find(m => m.id === task.assigneeId);
    const assigner = members.find(m => m.id === task.assignerId);
    const hasSupporters = task.supporterIds && task.supporterIds.length > 0;
    const daysLeft = getDaysRemaining(task.deadline);
    
    let borderClass = '';
    let icon = null;
    let timeClass = '';

    if (type === 'overdue') {
      borderClass = 'border-l-4 border-l-red-500 bg-red-50/50';
      icon = <AlertCircle size={18} className="text-red-500" />;
      timeClass = 'text-red-600 font-bold';
    } else if (type === 'today') {
      borderClass = 'border-l-4 border-l-yellow-500 bg-yellow-50/50';
      icon = <Clock size={18} className="text-yellow-600" />;
      timeClass = 'text-yellow-700 font-bold';
    } else {
      borderClass = 'border-l-4 border-l-blue-400 bg-blue-50/50';
      icon = <Calendar size={18} className="text-blue-500" />;
      timeClass = 'text-blue-600';
    }

    return (
      <div 
        key={task.id} 
        onClick={() => openTaskModal(task)}
        className={`bg-white p-4 rounded-lg shadow-sm border border-slate-100 mb-3 hover:shadow-md transition-all cursor-pointer group ${borderClass}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{task.title}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase
                ${task.priority === 'High' ? 'bg-red-100 text-red-700' : task.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}
              `}>
                {task.priority}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-2 line-clamp-2">{task.description}</p>
            
            {/* Info Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center bg-slate-100 px-2 py-1 rounded">
                 <User size={12} className="mr-1 text-slate-400" />
                 <span className="font-medium mr-1">{assigner ? assigner.name : 'Unknown'}</span>
                 <ArrowRight size={10} className="mx-1 text-slate-400" />
                 <span className="font-bold text-slate-700">{assignee ? assignee.name : 'Chưa giao'}</span>
              </div>
              
              {hasSupporters && (
                  <div className="flex items-center text-slate-500 bg-blue-50 px-2 py-1 rounded text-blue-600" title="Có người hỗ trợ">
                      <Users size={12} className="mr-1" />
                      <span>+{task.supporterIds.length} Support</span>
                  </div>
              )}

              <div className={`flex items-center ${timeClass}`}>
                {type === 'overdue' 
                    ? `Quá hạn ${Math.abs(daysLeft)} ngày` 
                    : type === 'today' ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`
                }
                 <span className="text-slate-400 font-normal ml-1">({formatDateTimeDisplay(task.deadline)})</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className={`text-xs px-2 py-1 rounded bg-white border ${
                 task.status === TaskStatus.IN_PROGRESS ? 'border-blue-200 text-blue-600' : 'border-slate-200 text-slate-500'
             }`}>
                 {task.status}
             </span>
          </div>
        </div>
      </div>
    );
  };

  const totalNotifications = actionItems.overdue.length + actionItems.pendingPlans.length + upcomingItems.today.length + upcomingItems.future.length;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-full text-orange-600 relative">
               <Bell size={28} />
               {totalNotifications > 0 && (
                   <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white">
                       {totalNotifications}
                   </span>
               )}
            </div>
            <div>
               <h2 className="text-2xl font-bold text-slate-800">Trung tâm thông báo</h2>
               <p className="text-slate-500">
                   {totalNotifications === 0 ? "Bạn đã xử lý hết các công việc quan trọng!" : "Các đầu việc cần sự chú ý của bạn"}
               </p>
            </div>
          </div>

          {/* Time Filter Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                  onClick={() => setTimeRange('7_DAYS')}
                  className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      timeRange === '7_DAYS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                  <CalendarDays size={14} className="mr-1.5"/> 7 Ngày tới
              </button>
              <button
                  onClick={() => setTimeRange('30_DAYS')}
                  className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      timeRange === '30_DAYS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                  <Calendar size={14} className="mr-1.5"/> 30 Ngày tới
              </button>
          </div>
      </div>

      {totalNotifications === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-100">
              <CheckCircle2 size={60} className="mx-auto text-green-400 mb-4" />
              <h3 className="text-xl font-bold text-slate-700">Tuyệt vời!</h3>
              <p className="text-slate-500">Hệ thống sạch sẽ, không có cảnh báo nào.</p>
          </div>
      )}

      {/* 1. CRITICAL ACTIONS (Approved/Pending/Overdue) - Always Show */}
      {(actionItems.pendingPlans.length > 0 || actionItems.overdue.length > 0) && (
          <div className="space-y-6">
              {/* Weekly Plan Approvals */}
              {actionItems.pendingPlans.length > 0 && (
                  <section>
                      <h3 className="text-sm font-bold text-blue-800 uppercase mb-3 flex items-center bg-blue-50 px-3 py-2 rounded-lg w-fit border border-blue-100">
                          <ListTodo size={16} className="mr-2 text-blue-600" />
                          Cần duyệt kế hoạch ({actionItems.pendingPlans.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {actionItems.pendingPlans.map(plan => {
                              const user = members.find(m => m.id === plan.userId);
                              return (
                                  <div 
                                      key={plan.id} 
                                      className="bg-white border border-blue-200 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-blue-400 relative overflow-hidden"
                                      onClick={() => onViewPlan && onViewPlan(plan.userId)}
                                  >
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-blue-600 font-bold overflow-hidden">
                                              {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : user?.name.charAt(0)}
                                          </div>
                                          <div>
                                              <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-700">{user?.name}</h4>
                                              <p className="text-xs text-slate-500">Gửi kế hoạch <b>Tuần {plan.weekNumber}</b></p>
                                          </div>
                                      </div>
                                      <button className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-600 hover:text-white transition-colors">
                                          Xem ngay
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                  </section>
              )}

              {/* Overdue Tasks */}
              {actionItems.overdue.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-red-800 uppercase mb-3 flex items-center bg-red-50 px-3 py-2 rounded-lg w-fit border border-red-100">
                    <AlertTriangle size={16} className="mr-2 text-red-600" />
                    Quá hạn ({actionItems.overdue.length})
                  </h3>
                  <div>
                    {actionItems.overdue.map(t => renderTaskCard(t, 'overdue'))}
                  </div>
                </section>
              )}
          </div>
      )}

      {/* 2. UPCOMING ITEMS (Filtered by Time Range) */}
      {(upcomingItems.today.length > 0 || upcomingItems.future.length > 0) && (
          <div className="space-y-6 pt-4 border-t border-slate-200 border-dashed">
              {upcomingItems.today.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-yellow-800 uppercase mb-3 flex items-center bg-yellow-50 px-3 py-2 rounded-lg w-fit border border-yellow-100">
                    <Clock size={16} className="mr-2 text-yellow-600" />
                    Hết hạn hôm nay ({upcomingItems.today.length})
                  </h3>
                  <div>
                    {upcomingItems.today.map(t => renderTaskCard(t, 'today'))}
                  </div>
                </section>
              )}

              {upcomingItems.future.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-blue-800 uppercase mb-3 flex items-center bg-blue-50 px-3 py-2 rounded-lg w-fit border border-blue-100">
                    <Calendar size={16} className="mr-2 text-blue-600" />
                    Sắp tới ({timeRange === '7_DAYS' ? '7 ngày' : '30 ngày'})
                  </h3>
                  <div>
                    {upcomingItems.future.map(t => renderTaskCard(t, 'upcoming'))}
                  </div>
                </section>
              )}
          </div>
      )}

      {/* MODAL FOR TASK DETAIL/EDIT */}
      {selectedTask && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center">
                          <Pencil size={18} className="mr-2 text-blue-600"/> Cập nhật công việc
                      </h3>
                      <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Tiêu đề</label>
                          <input 
                              type="text" 
                              value={editForm.title || ''} 
                              onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả</label>
                          <textarea 
                              value={editForm.description || ''} 
                              onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none bg-slate-50 focus:bg-white transition-colors"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Trạng thái</label>
                              <select 
                                  value={editForm.status}
                                  onChange={(e) => setEditForm({...editForm, status: e.target.value as TaskStatus})}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                              >
                                  {Object.values(TaskStatus).map(s => (
                                      <option key={s} value={s}>{s}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Hạn chót</label>
                              <input 
                                  type="datetime-local"
                                  value={toInputDateTime(editForm.deadline || '')} 
                                  onChange={(e) => setEditForm({...editForm, deadline: e.target.value})}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                      {canDeleteTask(currentUser, rolePermissions) && (
                          <button onClick={handleDelete} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium mr-auto flex items-center transition-colors">
                              <Trash2 size={16} className="mr-1"/> Xóa
                          </button>
                      )}
                      <button onClick={() => setSelectedTask(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Hủy</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md flex items-center transition-colors">
                          <Save size={16} className="mr-2"/> Lưu thay đổi
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Notifications;
