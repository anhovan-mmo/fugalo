
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, KanbanSquare, Sparkles, ClipboardList, CalendarDays, Bell, LogOut, Settings as SettingsIcon, PieChart, MessageCircle, History, BookOpenCheck, ShieldCheck, RefreshCw, Wifi, WifiOff, Wallet, BookText, X, Radio } from 'lucide-react';
import { View, Task, TaskStatus, Member, Role, WorkReport, RoleConfig } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  tasks?: Task[];
  currentUser: Member;
  onLogout: () => void;
  isCloudMode: boolean;
  onBackupData: () => void;
  isOpen: boolean;
  onClose: () => void;
  installPrompt: any;
  onInstall: () => void;
  workReports?: WorkReport[]; 
  unreadDiscussions?: number; 
  rolePermissions: Record<Role, RoleConfig>;
  lastSynced?: Date | null; 
  logoUrl?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    setCurrentView, 
    tasks = [], 
    currentUser, 
    onLogout, 
    isCloudMode, 
    // onBackupData, // Unused in Sidebar now
    isOpen,
    onClose,
    // installPrompt, // Unused in Sidebar now
    // onInstall, // Unused in Sidebar now
    workReports = [],
    unreadDiscussions = 0,
    rolePermissions,
    lastSynced,
    logoUrl
}) => {
  const [justSynced, setJustSynced] = useState(false);

  // Effect to flash the sync icon when lastSynced changes
  useEffect(() => {
      if (lastSynced) {
          setJustSynced(true);
          const timer = setTimeout(() => setJustSynced(false), 2000);
          return () => clearTimeout(timer);
      }
  }, [lastSynced]);

  // Get current user permissions
  const myPermissions = rolePermissions[currentUser.roleType].permissions;

  // Calculate notification count (Task Deadline)
  const notificationCount = tasks.filter(t => {
    if (t.status === TaskStatus.DONE) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(t.deadline);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysLeft <= 3; 
  }).length;

  // Calculate Report Notification
  let reportNotificationCount = 0;
  if (myPermissions.manageTeam || myPermissions.approveAssets) {
      reportNotificationCount = workReports.filter(r => r.status === 'PENDING' && r.userId !== currentUser.id).length;
  }

  // --- MENU CONFIGURATION ---
  // Grouping logic for professional look
  const menuGroups = [
      {
          label: "Quản trị Dự án",
          items: [
              { id: View.DASHBOARD, label: 'Tổng quan', icon: <LayoutDashboard size={18} />, visible: true },
              { id: View.SCHEDULE, label: 'Lịch trình', icon: <CalendarDays size={18} />, visible: true },
              { id: View.TASKS, label: 'Giao việc', icon: <KanbanSquare size={18} />, visible: true },
              { id: View.APPROVALS, label: 'Kiểm duyệt', icon: <ShieldCheck size={18} />, visible: true },
              { id: View.BUDGET, label: 'Ngân sách', icon: <Wallet size={18} />, visible: myPermissions.manageBudget },
          ]
      },
      {
          label: "Vận hành & Đội ngũ",
          items: [
              { 
                  id: View.COLLABORATION, 
                  label: 'Thảo luận', 
                  icon: <MessageCircle size={18} />,
                  badge: unreadDiscussions,
                  visible: true
              },
              { id: View.TEAM, label: 'Nhân sự', icon: <Users size={18} />, visible: true },
              { id: View.REPORTS, label: 'Thống kê', icon: <PieChart size={18} />, visible: myPermissions.viewReports },
              { id: View.PROCESS, label: 'Quy trình (SOP)', icon: <BookText size={18} />, visible: true }, 
          ]
      },
      {
          label: "Cá nhân",
          items: [
              { id: View.PERSONAL, label: 'Việc của tôi', icon: <ClipboardList size={18} />, visible: true },
              { 
                  id: View.WORK_REPORTS, 
                  label: 'Báo cáo ngày', 
                  icon: <BookOpenCheck size={18} />, 
                  badge: reportNotificationCount,
                  visible: true 
              },
          ]
      },
      {
          label: "Hệ thống",
          items: [
              { id: View.AI_ASSISTANT, label: 'Trợ lý AI', icon: <Sparkles size={18} />, visible: true },
              { id: View.NOTIFICATIONS, label: 'Thông báo', icon: <Bell size={18} />, badge: notificationCount, visible: true },
              { id: View.HISTORY, label: 'Lịch sử', icon: <History size={18} />, visible: myPermissions.viewHistory },
              { id: View.SETTINGS, label: 'Cấu hình', icon: <SettingsIcon size={18} />, visible: myPermissions.configureSystem },
          ]
      }
  ];

  const handleMenuClick = (itemId: View) => {
      setCurrentView(itemId);
      onClose();
  };

  return (
    <>
        {/* Mobile Overlay with Blur and Fade */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm animate-fade-in transition-opacity duration-300"
                onClick={onClose}
            ></div>
        )}

        {/* Sidebar Container */}
        <div className={`
            w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl z-50 
            transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/30">
                <img src={logoUrl || "https://i.imgur.com/KzXj0XJ.png"} alt="Logo" className="w-10 h-10 rounded-lg bg-white p-0.5 shadow-md object-contain" />
                <div>
                    <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-teal-400 bg-clip-text text-transparent">
                    FUGALO
                    </h1>
                    <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">Marketing Hub v12</p>
                </div>
                <button onClick={onClose} className="md:hidden p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors ml-auto">
                    <X size={20} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
                {menuGroups.map((group, groupIdx) => {
                    const visibleItems = group.items.filter(item => item.visible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={groupIdx}>
                            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                {group.label}
                            </div>
                            <div className="space-y-0.5">
                                {visibleItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleMenuClick(item.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group relative overflow-hidden ${
                                        currentView === item.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        {/* Active Indicator Line */}
                                        {currentView === item.id && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-r-full"></div>
                                        )}

                                        <div className="flex items-center space-x-3 relative z-10">
                                            <span className={`transition-transform duration-300 ${currentView === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                {item.icon}
                                            </span>
                                            <span>{item.label}</span>
                                        </div>
                                        {item.badge && item.badge > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[18px] text-center shadow-sm animate-pulse relative z-10">
                                            {item.badge}
                                        </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer Area */}
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 space-y-4">
                
                {/* Connection Status Widget */}
                <div className={`rounded-xl p-3 border transition-colors duration-500 relative overflow-hidden ${
                    isCloudMode 
                    ? 'bg-emerald-900/20 border-emerald-900/50' 
                    : 'bg-orange-900/20 border-orange-900/50'
                }`}>
                    {/* Status Text & Icon */}
                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="relative flex h-2.5 w-2.5">
                                {isCloudMode && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isCloudMode ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${isCloudMode ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {isCloudMode ? 'Hệ thống Online' : 'Chế độ Offline'}
                            </span>
                        </div>
                        {justSynced ? (
                            <RefreshCw size={12} className="animate-spin text-blue-400"/>
                        ) : (
                            isCloudMode ? <Wifi size={12} className="text-emerald-500"/> : <WifiOff size={12} className="text-orange-500"/>
                        )}
                    </div>

                    {/* Last Synced Info */}
                    {lastSynced && (
                        <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between relative z-10">
                            <span>Đồng bộ:</span>
                            <span className="text-slate-400">{lastSynced.toLocaleTimeString('vi-VN')}</span>
                        </div>
                    )}

                    {/* Subtle Background Glow */}
                    <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-20 ${isCloudMode ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                </div>
                
                {/* User Profile */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center font-bold text-xs shadow-md border border-slate-600 text-white">
                                {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover rounded-full"/> : currentUser.name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-200 truncate w-24 leading-tight">{currentUser.name}</p>
                            <p className="text-xs text-slate-500 truncate w-24">{currentUser.roleType}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Đăng xuất"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
    </div>
    </>
  );
};
