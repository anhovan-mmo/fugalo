
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TaskBoard from './components/TaskBoard';
import TeamList from './components/TeamList';
import AIAssistant from './components/AIAssistant';
import PersonalWeeklyTasks from './components/PersonalWeeklyTasks';
import Schedule from './components/Schedule';
import Notifications from './components/Notifications';
import Login from './components/Login';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Collaboration from './components/Collaboration';
import WorkReports from './components/WorkReports';
import Approvals from './components/Approvals';
import HistoryLog from './components/HistoryLog';
import BudgetManager from './components/BudgetManager';
import ProcessDocumentation from './components/ProcessDocumentation'; // Import Process Component

import { Member, Task, View, Role, RoleConfig, ROLE_DEFINITIONS, Discussion, WorkReport, PersonalTask, ApprovalRequest, AnnouncementConfig, TopBannerConfig, WeeklyPlan, SystemConfig } from './types';
import { MEMBERS } from './constants';
import { 
    seedInitialDataIfEmpty, subscribeToTasks, subscribeToPersonalTasks, 
    addTaskToDB, updateTaskInDB, deleteTaskFromDB,
    addPersonalTaskToDB, updatePersonalTaskInDB, deletePersonalTaskFromDB,
    subscribeToDiscussions, subscribeToWorkReports, subscribeToApprovals,
    logoutFirebase, updateMemberInDB, updateRolePermissionsInDB, subscribeToMembers, subscribeToRolePermissions, addLogToDB, isFirebaseEnabled, subscribeToSystemConfig,
    safeStringify,
    subscribeToPendingWeeklyPlans
} from './services/firebase';
import { CheckCircle2, AlertCircle, X, Menu, Bell, ArrowRight, Megaphone, Calendar, Info, AlertTriangle } from 'lucide-react';

const STORAGE_KEYS = {
  CURRENT_USER: 'fugalo_crm_user',
  DISCUSSION_READS: 'fugalo_discussion_reads',
  TASKS: 'fugalo_db_tasks',
  PERSONAL: 'fugalo_db_personal_tasks',
  MEMBERS: 'fugalo_db_members',
  PERMISSIONS: 'fugalo_db_permissions', 
  APP_LOGO: 'fugalo_app_logo' // Legacy Key, now using Firebase subscription
};

const DEFAULT_LOGO = 'https://i.imgur.com/KzXj0XJ.png';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Member | null>(() => {
    try {
        const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return savedUser ? JSON.parse(savedUser) : null;
    } catch {
        return null;
    }
  });

  const [members, setMembers] = useState<Member[]>(MEMBERS);
  // Ref to keep track of latest members for use in callbacks without re-subscribing
  const membersRef = useRef<Member[]>(MEMBERS);

  // Default view set to DASHBOARD
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // App Logo State - Initially load from storage to prevent flicker, then subscribe
  const [appLogo, setAppLogo] = useState<string>(DEFAULT_LOGO);
  const [appName, setAppName] = useState<string>('Fugalo CRM');
  const [announcementConfig, setAnnouncementConfig] = useState<AnnouncementConfig | undefined>(undefined);
  const [topBannerConfig, setTopBannerConfig] = useState<TopBannerConfig | undefined>(undefined);
  const [showBanner, setShowBanner] = useState(true); // Local state to dismiss banner

  // Pending Task State (For Quick Create / Chat-to-Task)
  const [pendingTaskData, setPendingTaskData] = useState<{ assigneeId?: string | null, description?: string } | null>(null);
  
  // Target Member State (For Deep Linking to Personal Plan)
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
  const [workReports, setWorkReports] = useState<WorkReport[]>([]); 
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]); // New State for KPI
  const [discussions, setDiscussions] = useState<Discussion[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null); // NEW STATE FOR SYNC TIME
  const [pendingPlans, setPendingPlans] = useState<WeeklyPlan[]>([]);
  
  // Trigger to force re-render badge when user reads a message
  const [readUpdateTrigger, setReadUpdateTrigger] = useState(0);

  // Responsive State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(isFirebaseEnabled);
  
  // State phân quyền động (Role Permissions)
  const [rolePermissions, setRolePermissions] = useState<Record<Role, RoleConfig>>(ROLE_DEFINITIONS);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // --- NEW TASK POPUP STATE ---
  const [newTaskAlert, setNewTaskAlert] = useState<Task | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- WELCOME MODAL STATE ---
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // --- PWA INSTALL STATE ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- FORCE UPDATE TIMER FOR SCHEDULED BANNERS ---
  const [now, setNow] = useState(new Date());

  // Update ref whenever members state changes
  useEffect(() => {
      membersRef.current = members;
  }, [members]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("PWA Install Prompt captured");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Initialize Notification Audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    // Request Notification Permission on load if previously granted (to ensure state consistency)
    if ("Notification" in window && Notification.permission === "granted") {
        console.log("Notifications already granted");
    }

    // Interval to update 'now' every minute to check for scheduled banners
    const interval = setInterval(() => setNow(new Date()), 60000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Đang cài đặt ứng dụng...');
      }
      setDeferredPrompt(null);
    });
  };

  const handleRequestNotificationPermission = async () => {
      if (!("Notification" in window)) {
          showToast("Trình duyệt này không hỗ trợ thông báo.", "error");
          return false;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
          showToast("Đã bật thông báo đẩy thành công!");
          
          // Test Notification
          if (navigator.serviceWorker) {
              navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification("Fugalo CRM", {
                      body: "Hệ thống thông báo đã sẵn sàng!",
                      icon: "https://cdn-icons-png.flaticon.com/512/9187/9187604.png"
                  });
              });
          }
          return true;
      } else {
          showToast("Bạn đã từ chối quyền thông báo.", "error");
          return false;
      }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000); 
  };

  const playNotificationSound = () => {
      if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio play prevented", e));
      }
  };

  const triggerSystemNotification = (title: string, body: string) => {
      if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
          navigator.serviceWorker.ready.then(registration => {
              // Cast to any to avoid strict type checking on 'vibrate' which can cause issues in some TS environments
              registration.showNotification(title, {
                  body: body,
                  icon: "https://cdn-icons-png.flaticon.com/512/9187/9187604.png",
                  vibrate: [200, 100, 200]
              } as any);
          });
      }
  };

  // --- DATA SUBSCRIPTIONS ---
  useEffect(() => {
    seedInitialDataIfEmpty();

    // Subscribe to System Config (Logo, App Name, Banner)
    const unsubscribeConfig = subscribeToSystemConfig((config) => {
        if (config.logoUrl) setAppLogo(config.logoUrl);
        if (config.appName) setAppName(config.appName);
        if (config.announcement) setAnnouncementConfig(config.announcement);
        if (config.topBanner) {
            setTopBannerConfig(config.topBanner);
            // Re-show banner if content changes or enabled toggles
            if (config.topBanner.enabled) setShowBanner(true);
        }
    });

    // Subscribe to TASKS with Real-time Alerts
    const unsubscribeTasks = subscribeToTasks(
        (fetchedTasks) => {
            setTasks(fetchedTasks);
            setIsLoading(false);
            setLastSynced(new Date()); // UPDATE SYNC TIME
        },
        // Real-time Update Callback
        (changeType, task) => {
            if (!currentUser) return;

            // 1. Assignment Alert: Task ADDED (Assigned to me)
            // Logic: Task assigned to me AND I am NOT the assigner (prevent self-notification)
            if (changeType === 'added' && task.assigneeId === currentUser.id && task.assignerId !== currentUser.id) {
                // Use membersRef to access current members list safely inside callback
                const assignerName = membersRef.current.find(m => m.id === task.assignerId)?.name || 'Sếp';
                
                // Trigger In-App Popup
                setNewTaskAlert(task);
                playNotificationSound();
                
                // Trigger Push Notification (Background/System)
                triggerSystemNotification("Bạn có việc mới!", `${assignerName} vừa giao cho bạn: ${task.title}`);
            }

            // 2. Update Alert: Task MODIFIED
            if (changeType === 'modified') {
                if (task.assigneeId === currentUser.id) {
                    showToast(`ℹ️ Công việc "${task.title}" của bạn vừa được cập nhật.`);
                }
                
                if (task.assignerId === currentUser.id && task.assigneeId !== currentUser.id) {
                    const assigneeName = membersRef.current.find(m => m.id === task.assigneeId)?.name || 'Nhân viên';
                    const msg = `${assigneeName} vừa cập nhật trạng thái việc "${task.title}" thành: ${task.status}`;
                    showToast(`✅ ${msg}`);
                    
                    // Notify Manager if task is DONE
                    if (task.status === 'DONE') {
                        triggerSystemNotification("Công việc hoàn thành", msg);
                    }
                }
            }
        }
    );

    const unsubscribePersonal = subscribeToPersonalTasks((fetchedTasks) => {
        setPersonalTasks(fetchedTasks);
        setLastSynced(new Date()); // UPDATE SYNC TIME
    });

    const unsubscribeReports = subscribeToWorkReports((fetchedReports) => {
        setWorkReports(fetchedReports);
        setLastSynced(new Date()); // UPDATE SYNC TIME
    });

    const unsubscribeApprovals = subscribeToApprovals((fetchedApprovals) => {
        setApprovals(fetchedApprovals);
        setLastSynced(new Date());
    });

    const unsubscribeDiscussions = subscribeToDiscussions((fetchedDiscussions) => {
        setDiscussions(fetchedDiscussions);
        setLastSynced(new Date()); // UPDATE SYNC TIME
    });

    const unsubscribeMembers = subscribeToMembers((fetchedMembers) => {
        setMembers(fetchedMembers);
        setLastSynced(new Date()); // UPDATE SYNC TIME
        setCurrentUser((curr) => {
            if (!curr) return null;
            const updatedMe = fetchedMembers.find(m => m.id === curr.id);
            if (updatedMe) {
                 localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedMe));
                 return updatedMe;
            }
            return curr;
        });
    });

    const unsubscribePermissions = subscribeToRolePermissions((config) => {
        // Merge with default to prevent missing keys causing crashes
        setRolePermissions(prev => ({ ...ROLE_DEFINITIONS, ...config }));
        setLastSynced(new Date()); // UPDATE SYNC TIME
    });

    const unsubscribePlans = subscribeToPendingWeeklyPlans((plans) => {
        setPendingPlans(plans);
        setLastSynced(new Date());
    });

    // LISTEN FOR READ STATUS UPDATES FROM COLLABORATION COMPONENT
    const handleReadStatusUpdate = () => {
        setReadUpdateTrigger(prev => prev + 1);
    };
    window.addEventListener('fugalo_discussion_read_updated', handleReadStatusUpdate);

    return () => {
        if (unsubscribeConfig) unsubscribeConfig();
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribePersonal) unsubscribePersonal();
        if (unsubscribeMembers) unsubscribeMembers();
        if (unsubscribePermissions) unsubscribePermissions();
        if (unsubscribeReports) unsubscribeReports();
        if (unsubscribeApprovals) unsubscribeApprovals();
        if (unsubscribeDiscussions) unsubscribeDiscussions();
        if (unsubscribePlans) unsubscribePlans();
        window.removeEventListener('fugalo_discussion_read_updated', handleReadStatusUpdate);
    };
  }, [currentUser?.id]);

  // ... (Rest of functions: handleLogin, handleLogout, etc.) ...
  const handleLogin = (member: Member) => {
    setCurrentUser(member);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(member));
    showToast(`Chào mừng quay lại, ${member.name}!`);
    // Only show if config enables it
    if (announcementConfig?.enabled !== false) {
        setShowWelcomeModal(true); 
    }
  };

  const handleLogout = async () => {
    await logoutFirebase();
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentView(View.DASHBOARD);
  };

  const handleNavigateToTaskCreation = (assigneeId: string | null = null) => {
    setPendingTaskData({ assigneeId });
    setCurrentView(View.TASKS);
  };

  // Other handlers... (unchanged)
  const handleSidebarNavigation = (view: View) => {
    if (view === View.TASKS) setPendingTaskData(null);
    if (view !== View.PERSONAL) setTargetMemberId(null); // Clear target if navigating away
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  // --- DATA BACKUP & RESTORE ---
  const handleBackupData = () => {
      const data = {
          timestamp: new Date().toISOString(),
          version: "1.0",
          tasks,
          personalTasks,
          members,
          rolePermissions,
          workReports,
          discussions
      };
      // Use safeStringify to avoid circular reference errors
      const blob = new Blob([safeStringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fugalo_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Đã tải xuống file sao lưu dữ liệu.");
  };

  const handleRestoreData = async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              
              // Validate minimal structure
              if (!json.timestamp || !json.tasks || !json.members) {
                  throw new Error("File không hợp lệ hoặc thiếu dữ liệu.");
              }

              // Update State
              if (json.tasks) setTasks(json.tasks);
              if (json.personalTasks) setPersonalTasks(json.personalTasks);
              if (json.members) setMembers(json.members);
              if (json.rolePermissions) setRolePermissions(json.rolePermissions);
              if (json.workReports) setWorkReports(json.workReports);
              if (json.discussions) setDiscussions(json.discussions);

              // Update LocalStorage (Critical for Offline Mode)
              localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(json.tasks));
              localStorage.setItem(STORAGE_KEYS.PERSONAL, JSON.stringify(json.personalTasks));
              localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(json.members));
              localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(json.rolePermissions));
              
              // Trigger Last Synced Update
              setLastSynced(new Date());
              
              showToast("Đã khôi phục dữ liệu thành công!");
              
              // If connected to Firebase, this does NOT automatically push everything back due to one-way sync logic in current implementation.
              // This restore is primarily for Local/Offline usage or viewing historic data.
              if (isFirebaseEnabled) {
                  showToast("Lưu ý: Dữ liệu khôi phục hiện tại chỉ áp dụng trên thiết bị này. Vui lòng kiểm tra kết nối để đồng bộ.", "error");
              }

          } catch (err) {
              console.error("Restore failed:", err);
              showToast("Lỗi khi đọc file sao lưu. Vui lòng kiểm tra lại.", "error");
          }
      };
      reader.readAsText(file);
  };

  // DB Updaters
  const handleUpdateMember = async (updatedMember: Member) => {
      try {
          await updateMemberInDB(updatedMember);
          showToast("Đã cập nhật thông tin nhân sự và đồng bộ!");
      } catch (error) {
          showToast("Lỗi khi lưu thông tin nhân sự", "error");
      }
  };

  const handleUpdatePermissions = async (newConfig: Record<Role, RoleConfig>) => {
      try {
          await updateRolePermissionsInDB(newConfig);
          showToast("Đã cập nhật cấu hình phân quyền thành công!");
      } catch (error) {
          showToast("Lỗi khi lưu cấu hình phân quyền", "error");
      }
  };

  const updateTask = async (updatedTask: Task) => {
    try {
        await updateTaskInDB(updatedTask);
        showToast("Đã cập nhật công việc thành công!");
    } catch (e) {
        showToast("Lỗi khi cập nhật công việc", "error");
    }
  };

  const addTask = async (newTask: Task) => {
    try {
        await addTaskToDB(newTask);
        showToast("Đã thêm công việc mới!");
    } catch (e) {
        showToast("Lỗi khi thêm công việc", "error");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
        await deleteTaskFromDB(taskId);
        showToast("Đã xóa công việc.");
    } catch (e) {
        showToast("Lỗi khi xóa công việc", "error");
    }
  };

  const addPersonalTask = async (newTask: PersonalTask) => {
    try {
        await addPersonalTaskToDB(newTask);
        showToast("Đã thêm việc cá nhân!");
    } catch (e) {
        showToast("Lỗi khi lưu", "error");
    }
  };

  const updatePersonalTask = async (task: PersonalTask) => {
    try {
        await updatePersonalTaskInDB(task);
    } catch (e) {
        showToast("Lỗi khi cập nhật", "error");
    }
  };

  const deletePersonalTask = async (taskId: string) => {
    try {
        await deletePersonalTaskFromDB(taskId);
        showToast("Đã xóa việc cá nhân.");
    } catch (e) {
        showToast("Lỗi khi xóa", "error");
    }
  };

  const unreadDiscussionCount = React.useMemo(() => {
      if (!currentUser) return 0;
      try {
          const readStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISCUSSION_READS) || '{}');
          return discussions.filter(d => {
              const memberIds = d.memberIds || [];
              const isMember = memberIds.includes(currentUser.id);
              const isAuthor = d.authorId === currentUser.id;
              const isManagerViewingGroup = currentUser.roleType === Role.MANAGER && d.type === 'GROUP';
              if (!isMember && !isAuthor && !isManagerViewingGroup) return false;
              const lastActivity = new Date(d.timestamp).getTime();
              const lastRead = readStatus[d.id] ? new Date(readStatus[d.id]).getTime() : 0;
              return lastActivity > lastRead;
          }).length;
      } catch (e) {
          return 0;
      }
  }, [discussions, currentUser, readUpdateTrigger]);

  const renderContent = () => {
    if (!currentUser) return null;

    // Safety check for permissions to prevent crash if data is corrupted
    const currentRoleConfig = rolePermissions[currentUser.roleType];
    const safePermissions = currentRoleConfig ? currentRoleConfig.permissions : ROLE_DEFINITIONS[Role.PLANNER].permissions;

    if (isLoading && members.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Đang tải dữ liệu từ Cloud...</p>
            </div>
        );
    }

    switch (currentView) {
      case View.DASHBOARD:
        return (
            <Dashboard 
                tasks={tasks} 
                members={members} 
                onCreateTask={() => handleNavigateToTaskCreation(null)}
            />
        );
      case View.COLLABORATION:
        return (
            <Collaboration 
                currentUser={currentUser}
                members={members}
                discussions={discussions}
            />
        );
      case View.WORK_REPORTS:
        return (
            <WorkReports
                currentUser={currentUser}
                members={members}
                tasks={tasks}
                personalTasks={personalTasks}
                reports={workReports}
            />
        );
      case View.APPROVALS:
        return (
            <Approvals
                currentUser={currentUser}
                members={members}
                tasks={tasks}
                personalTasks={personalTasks}
            />
        );
      case View.BUDGET:
        if (safePermissions.manageBudget) {
            return (
                <BudgetManager
                    currentUser={currentUser}
                    members={members}
                    tasks={tasks}
                />
            );
        }
        // Fallback if accessed directly or permission lost
        return <Dashboard tasks={tasks} members={members} onCreateTask={() => handleNavigateToTaskCreation(null)} />;
        
      case View.REPORTS:
        return (
            <Reports 
                tasks={tasks} 
                members={members} 
                currentUser={currentUser} 
                workReports={workReports} 
                approvals={approvals} 
            />
        );
      case View.NOTIFICATIONS:
        return (
             <Notifications 
                tasks={tasks} 
                members={members} 
                currentUser={currentUser}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                rolePermissions={rolePermissions}
                pendingPlans={pendingPlans}
                onViewPlan={(memberId) => {
                    // Navigate DIRECTLY to Personal Weekly Tasks of that user
                    setTargetMemberId(memberId);
                    setCurrentView(View.PERSONAL);
                }}
             />
        );

      case View.SCHEDULE:
        return <Schedule tasks={tasks} personalTasks={personalTasks} members={members} currentUser={currentUser} />;
      case View.TASKS:
        return (
          <TaskBoard 
            tasks={tasks} 
            members={members} 
            currentUser={currentUser}
            onUpdateTask={updateTask}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            initialAssigneeId={pendingTaskData?.assigneeId}
            initialDescription={pendingTaskData?.description}
            onClearInitialData={() => setPendingTaskData(null)}
            rolePermissions={rolePermissions} 
          />
        );
      case View.PERSONAL:
        return (
            <PersonalWeeklyTasks 
                tasks={personalTasks}
                currentUser={currentUser}
                onAddTask={addPersonalTask}
                onUpdateTask={updatePersonalTask}
                onDeleteTask={deletePersonalTask}
                onGoToReports={() => setCurrentView(View.WORK_REPORTS)} 
                members={members}
                projectTasks={tasks} // PASS PROJECT TASKS FOR COMPARISON
                pendingPlans={pendingPlans}
                initialMemberId={targetMemberId} // PASS TARGET ID FOR DIRECT VIEW
                onClearTargetMember={() => setTargetMemberId(null)} // CLEANUP
            />
        );
      case View.TEAM:
        return (
            <TeamList 
                members={members} 
                currentUser={currentUser}
                onAssignTask={handleNavigateToTaskCreation}
                onUpdateMember={handleUpdateMember}
                rolePermissions={rolePermissions} 
                onUpdatePermissions={handleUpdatePermissions} 
                onSwitchUser={handleLogin} // PASS HANDLE LOGIN FOR IMPERSONATION
                logoUrl={appLogo} // PASS LOGO
            />
        );
      case View.AI_ASSISTANT:
        return (
            <AIAssistant 
                currentUser={currentUser} 
                members={members} 
            />
        );
      
      case View.SETTINGS:
        // Restricted to users with configureSystem permission
        if (safePermissions.configureSystem) {
            return (
                <Settings 
                    installPrompt={deferredPrompt} 
                    onInstall={handleInstallClick} 
                    onRequestNotification={handleRequestNotificationPermission}
                    onBackup={handleBackupData}
                    onRestore={handleRestoreData}
                    currentUser={currentUser}
                    onUpdateMember={handleUpdateMember}
                    onUpdateLogo={(newLogo) => setAppLogo(newLogo)} // Pass logo updater wrapper
                />
            );
        }
        return <Dashboard tasks={tasks} members={members} onCreateTask={() => handleNavigateToTaskCreation(null)} />;
        
      case View.HISTORY:
        if (safePermissions.viewHistory) {
             return <HistoryLog currentUser={currentUser} />;
        }
        return <Dashboard tasks={tasks} members={members} onCreateTask={() => handleNavigateToTaskCreation(null)} />;

      case View.PROCESS:
        return <ProcessDocumentation onNavigate={setCurrentView} />;

      default:
        return (
            <Dashboard 
                tasks={tasks} 
                members={members}
                onCreateTask={() => handleNavigateToTaskCreation(null)}
            />
        );
    }
  };

  if (!currentUser) {
      return <Login onLogin={handleLogin} logoUrl={appLogo} />;
  }

  // Parse Bullets for Display
  const announcementBulletsList = announcementConfig?.bullets ? announcementConfig.bullets.split('\n').filter(b => b.trim()) : [];

  // Handler for Banner Action Button
  const handleBannerAction = () => {
      if (topBannerConfig?.targetView) {
          setCurrentView(topBannerConfig.targetView);
          setShowBanner(false);
      }
  };

  // CHECK EXPIRATION & SCHEDULE & TARGETING
  // 'now' state is updated every minute via useEffect to ensure banners show up on time without reload
  const isBannerStarted = topBannerConfig?.visibleFrom 
      ? now >= new Date(topBannerConfig.visibleFrom) 
      : true;

  const isBannerExpired = topBannerConfig?.visibleUntil 
      ? now > new Date(topBannerConfig.visibleUntil) 
      : false;

  // --- NEW: TARGETING LOGIC ---
  const isTargetRole = !topBannerConfig?.targetRoles || topBannerConfig.targetRoles.length === 0 || topBannerConfig.targetRoles.includes(currentUser.roleType);
  const isTargetDept = !topBannerConfig?.targetDepartments || topBannerConfig.targetDepartments.length === 0 || topBannerConfig.targetDepartments.includes(currentUser.department);
  const isTargetView = !topBannerConfig?.displayOnViews || topBannerConfig.displayOnViews.length === 0 || topBannerConfig.displayOnViews.includes(currentView);

  const shouldShowBanner = topBannerConfig?.enabled && showBanner && topBannerConfig.content && isBannerStarted && !isBannerExpired && isTargetRole && isTargetDept && isTargetView;

  // --- NEW: RENDER MODAL vs BANNER ---
  const isModalMode = topBannerConfig?.displayMode === 'MODAL';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] flex items-center p-4 rounded-xl shadow-2xl animate-fade-in border ${
            toast.type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'
        }`}>
            <div className={`mr-3 p-1 rounded-full ${toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <span className="font-medium text-sm max-w-xs">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-4 text-slate-400 hover:text-slate-600">
                <X size={16} />
            </button>
        </div>
      )}

      {/* NEW TASK ASSIGNMENT POPUP MODAL */}
      {newTaskAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 relative border border-white/10">
                  
                  {/* Decorative Header - Blue/Indigo Theme */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative overflow-hidden">
                      <div className="relative z-10 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner">
                              <Bell size={24} className="text-white animate-swing" />
                          </div>
                          <div>
                              <h3 className="text-xl font-bold mb-0.5">Bạn có việc mới!</h3>
                              <p className="text-blue-100 text-xs opacity-90">Được giao bởi {members.find(m => m.id === newTaskAlert.assignerId)?.name || 'Quản lý'}</p>
                          </div>
                      </div>
                      
                      {/* Abstract Shapes */}
                      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-cyan-400/20 rounded-full blur-2xl"></div>
                  </div>
                  
                  <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-full border border-slate-100 uppercase tracking-wide">
                              <Calendar size={10} className="mr-1"/>
                              {new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} • Hôm nay
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${newTaskAlert.priority === 'High' ? 'bg-red-100 text-red-700' : newTaskAlert.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {newTaskAlert.priority} Priority
                          </span>
                      </div>

                      <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl mb-6 shadow-sm">
                          <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{newTaskAlert.title}</h4>
                          <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                              {newTaskAlert.description || "Không có mô tả chi tiết."}
                          </p>
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={() => setNewTaskAlert(null)}
                              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors text-sm"
                          >
                              Để sau
                          </button>
                          <button 
                              onClick={() => {
                                  setNewTaskAlert(null);
                                  setCurrentView(View.TASKS);
                              }}
                              className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 flex items-center justify-center transition-all text-sm group"
                          >
                              Xem ngay <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform"/>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- WELCOME / ANNOUNCEMENT MODAL (DYNAMIC) --- */}
      {showWelcomeModal && announcementConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 relative">
                  {/* Decorative Header */}
                  <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white relative overflow-hidden">
                      <div className="relative z-10 flex items-center justify-between">
                          <div>
                              <h3 className="text-2xl font-bold mb-1 flex items-center">
                                  <Megaphone size={24} className="mr-2 animate-pulse"/>
                                  {announcementConfig.title || 'Bảng Tin Nội Bộ'}
                              </h3>
                              <p className="text-orange-100 text-sm opacity-90">Thông báo quan trọng từ Ban Giám Đốc</p>
                          </div>
                      </div>
                      
                      {/* Abstract Shapes */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl"></div>
                  </div>

                  <div className="p-6">
                      <div className="flex items-center text-xs font-bold text-slate-400 mb-4 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                          <Calendar size={12} className="mr-1.5"/>
                          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>

                      <div className="space-y-4">
                          <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                              <h4 className="font-bold text-slate-800 text-lg mb-2">Chào mừng trở lại, {currentUser.name}! 👋</h4>
                              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                  {announcementConfig.message || "Chúc bạn một ngày làm việc hiệu quả!"}
                              </p>
                          </div>

                          {announcementBulletsList.length > 0 && (
                              <div className="text-sm text-slate-500 border-t border-slate-100 pt-4 mt-4">
                                  <p className="font-bold text-slate-700 mb-2">🚀 Tiêu điểm:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                      {announcementBulletsList.map((bullet, idx) => (
                                          <li key={idx}>{bullet}</li>
                                      ))}
                                  </ul>
                              </div>
                          )}
                      </div>

                      <button 
                          onClick={() => setShowWelcomeModal(false)}
                          className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center"
                      >
                          Đã hiểu, Bắt đầu làm việc <ArrowRight size={18} className="ml-2"/>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- BROADCAST ALERT (MODAL or BANNER) --- */}
      {shouldShowBanner && topBannerConfig && (
          isModalMode ? (
              // MODAL MODE
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 border border-white/20 relative">
                      <div className={`h-2 w-full ${topBannerConfig.type === 'ERROR' ? 'bg-red-500' : topBannerConfig.type === 'WARNING' ? 'bg-orange-500' : topBannerConfig.type === 'SUCCESS' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                      <button 
                          onClick={() => setShowBanner(false)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                      >
                          <X size={20} />
                      </button>
                      <div className="p-8 text-center">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${topBannerConfig.type === 'ERROR' ? 'bg-red-100 text-red-600' : topBannerConfig.type === 'WARNING' ? 'bg-orange-100 text-orange-600' : topBannerConfig.type === 'SUCCESS' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                              {topBannerConfig.type === 'ERROR' ? <AlertTriangle size={32}/> : 
                               topBannerConfig.type === 'WARNING' ? <AlertCircle size={32}/> :
                               topBannerConfig.type === 'SUCCESS' ? <CheckCircle2 size={32}/> :
                               <Info size={32}/>}
                          </div>
                          <h3 className="font-bold text-slate-800 text-lg mb-2 uppercase tracking-wide">Thông báo Hệ thống</h3>
                          <p className="text-sm text-slate-600 leading-relaxed mb-6">
                              {topBannerConfig.content}
                          </p>
                          
                          {topBannerConfig.targetView && topBannerConfig.actionLabel && (
                              <button 
                                  onClick={handleBannerAction}
                                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center"
                              >
                                  {topBannerConfig.actionLabel} <ArrowRight size={18} className="ml-2"/>
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          ) : (
              // BANNER MODE (Floating Card Style)
              <div className="fixed top-4 right-4 z-[110] w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in transition-all hover:shadow-3xl">
                  {/* Header mimicking Google Prompt */}
                  <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-start bg-white">
                      <div className="flex items-center gap-2">
                          <img src={appLogo} alt="Logo" className="w-5 h-5 object-contain" />
                          <span className="text-xs font-semibold text-slate-600">Thông báo từ {appName}</span>
                      </div>
                      <button 
                          onClick={() => setShowBanner(false)}
                          className="text-slate-400 hover:text-slate-600 rounded-full p-0.5 hover:bg-slate-100 transition-colors"
                      >
                          <X size={16} />
                      </button>
                  </div>

                  {/* Content Body mimicking Account List */}
                  <div className="p-2">
                      <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-default group">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                               {/* Use system icon based on type, or user avatar if general */}
                               {topBannerConfig.type === 'ERROR' ? (
                                   <div className="w-full h-full flex items-center justify-center bg-red-100 text-red-600"><AlertTriangle size={20}/></div>
                               ) : topBannerConfig.type === 'WARNING' ? (
                                   <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-600"><AlertCircle size={20}/></div>
                               ) : topBannerConfig.type === 'SUCCESS' ? (
                                   <div className="w-full h-full flex items-center justify-center bg-green-100 text-green-600"><CheckCircle2 size={20}/></div>
                               ) : (
                                   <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600"><Info size={20}/></div>
                               )}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                                  {topBannerConfig.content}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">
                                  {currentUser?.email || 'admin@fugalo.vn'}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  {/* Footer Actions */}
                  <div className="px-4 pb-3 flex justify-end gap-2">
                      <button 
                          onClick={() => {
                              setCurrentView(View.COLLABORATION);
                              setShowBanner(false);
                          }}
                          className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm"
                      >
                          Khám phá
                      </button>

                      {topBannerConfig.targetView && topBannerConfig.actionLabel && (
                          <button 
                              onClick={handleBannerAction}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center"
                          >
                              {topBannerConfig.actionLabel} <ArrowRight size={12} className="ml-1"/>
                          </button>
                      )}
                  </div>
              </div>
          )
      )}

      <div className="flex flex-1 overflow-hidden">
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden fixed top-3 left-4 z-40 bg-white p-2 rounded-lg shadow-md border border-slate-100 text-slate-700 active:bg-slate-50 transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          <Sidebar 
            currentView={currentView} 
            setCurrentView={handleSidebarNavigation} 
            tasks={tasks} 
            currentUser={currentUser}
            onLogout={handleLogout}
            isCloudMode={isCloudMode}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            onBackupData={() => {}} // Legacy
            installPrompt={deferredPrompt}
            onInstall={handleInstallClick}
            workReports={workReports}
            unreadDiscussions={unreadDiscussionCount}
            rolePermissions={rolePermissions}
            lastSynced={lastSynced}
            logoUrl={appLogo}
          />
          
          {/* Main Content */}
          <main className={`flex-1 w-full md:ml-60 h-[calc(100vh-2rem)] overflow-y-auto transition-all duration-300`}>
            <div className="p-3 md:p-6 mt-14 md:mt-0 pb-24 md:pb-8 w-full min-h-full flex flex-col">
              {renderContent()}
            </div>
          </main>
      </div>
    </div>
  );
};

export default App;
