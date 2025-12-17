
export enum View {
  DASHBOARD = 'DASHBOARD',
  TASKS = 'TASKS',
  TEAM = 'TEAM',
  AI_ASSISTANT = 'AI_ASSISTANT',
  PERSONAL = 'PERSONAL',
  SCHEDULE = 'SCHEDULE',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SETTINGS = 'SETTINGS',
  REPORTS = 'REPORTS',
  COLLABORATION = 'COLLABORATION',
  WORK_REPORTS = 'WORK_REPORTS', 
  APPROVALS = 'APPROVALS', 
  HISTORY = 'HISTORY',
  BUDGET = 'BUDGET',
  PROCESS = 'PROCESS'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  PENDING = 'PENDING',     // Tạm hoãn
  CANCELLED = 'CANCELLED'  // Đã hủy
}

export type TaskType = 'GENERAL' | 'MEDIA' | 'CONTENT';

export enum Role {
  // --- LEVEL 0: BOARD (New) ---
  BOARD = 'Board',
  // --- LEVEL 1: BOARD OF MANAGEMENT ---
  MANAGER = 'Manager',
  DEPUTY_MANAGER = 'Deputy Manager',
  // --- LEVEL 2: LEADERS ---
  DOP = 'DOP',
  MEDIA_LEADER = 'Media Leader',
  SOCIAL_LEADER = 'Social Leader',
  SEEDING_LEADER = 'Seeding Leader',
  // --- LEVEL 3: SPECIALISTS (12 Positions Total) ---
  PLANNER = 'Planner',
  DESIGNER = 'Designer',
  MEDIA = 'Media',
  PHOTO = 'Photo',
  SOCIAL = 'Social',
  SEEDING = 'Seeding'
}

export type Department = 'DieuHanh' | 'Media' | 'Seeding' | 'Content' | 'Board';

export interface RoleConfig {
  label: string;
  description: string;
  permissions: {
    // --- DATA PERMISSIONS (Quyền thao tác dữ liệu) ---
    view: boolean;        // Xem danh sách công việc chung
    create: boolean;      // Tạo công việc mới
    edit: boolean;        // Chỉnh sửa công việc (Global)
    delete: boolean;      // Xóa dữ liệu (Tasks, Posts)
    
    // --- MANAGEMENT PERMISSIONS (Quyền quản trị) ---
    assignTasks: boolean; // Giao việc cho người khác
    manageTeam: boolean;  // Thêm/Sửa/Xóa thành viên
    approveAssets: boolean; // Duyệt bài/Video/Thiết kế (Menu Kiểm duyệt)
    manageBudget: boolean; // Quản lý Ngân sách (Menu Ngân sách)

    // --- MENU ACCESS PERMISSIONS (Quyền truy cập Menu đặc biệt) ---
    viewReports: boolean;   // Truy cập Menu "Thống kê & Báo cáo"
    viewHistory: boolean;   // Truy cập Menu "Lịch sử hoạt động"
    configureSystem: boolean; // Truy cập Menu "Cấu hình"
  }
}

// --- CẤU HÌNH PHÂN QUYỀN CHI TIẾT (12 POSITIONS) ---
export const ROLE_DEFINITIONS: Record<Role, RoleConfig> = {
  // --- LEVEL 0: BOARD OF DIRECTORS (Cao nhất) ---
  [Role.BOARD]: {
    label: 'Ban Giám Đốc',
    description: 'Lãnh đạo cao nhất, toàn quyền kiểm soát và phê duyệt chiến lược.',
    permissions: { 
        view: true, create: true, edit: true, delete: true, 
        assignTasks: true, manageTeam: true, approveAssets: true, manageBudget: true,
        viewReports: true, viewHistory: true, configureSystem: true 
    }
  },

  // --- LEVEL 1: MANAGEMENT ---
  [Role.MANAGER]: {
    label: 'Trưởng phòng Marketing',
    description: 'Quản trị viên hệ thống, báo cáo trực tiếp cho BGĐ.',
    permissions: { 
        view: true, create: true, edit: true, delete: true, 
        assignTasks: true, manageTeam: true, approveAssets: true, manageBudget: true,
        viewReports: true, viewHistory: true, configureSystem: true 
    }
  },
  [Role.DEPUTY_MANAGER]: {
    label: 'Phó phòng Marketing',
    description: 'Hỗ trợ điều hành, xem báo cáo và duyệt bài.',
    permissions: { 
        view: true, create: true, edit: true, delete: true, 
        assignTasks: true, manageTeam: true, approveAssets: true, manageBudget: true,
        viewReports: true, viewHistory: true, configureSystem: false 
    }
  },
  
  // --- LEVEL 2: LEADERS (Quản lý cấp trung) ---
  [Role.DOP]: {
    label: 'Art Director / DOP',
    description: 'Quản lý hình ảnh, duyệt thiết kế/video.',
    permissions: { 
        view: true, create: true, edit: true, delete: false, 
        assignTasks: true, manageTeam: false, approveAssets: true, manageBudget: false,
        viewReports: true, viewHistory: true, configureSystem: false 
    }
  },
  [Role.MEDIA_LEADER]: {
    label: 'Trưởng nhóm Media',
    description: 'Quản lý team sản xuất, duyệt video.',
    permissions: { 
        view: true, create: true, edit: true, delete: false, 
        assignTasks: true, manageTeam: false, approveAssets: true, manageBudget: false,
        viewReports: true, viewHistory: true, configureSystem: false 
    }
  },
  [Role.SOCIAL_LEADER]: {
    label: 'Trưởng nhóm Content',
    description: 'Quản lý nội dung, duyệt bài viết.',
    permissions: { 
        view: true, create: true, edit: true, delete: false, 
        assignTasks: true, manageTeam: false, approveAssets: true, manageBudget: false,
        viewReports: true, viewHistory: true, configureSystem: false 
    }
  },
  [Role.SEEDING_LEADER]: {
    label: 'Trưởng nhóm Seeding',
    description: 'Quản lý chiến dịch cộng đồng.',
    permissions: { 
        view: true, create: true, edit: true, delete: false, 
        assignTasks: true, manageTeam: false, approveAssets: true, manageBudget: false,
        viewReports: true, viewHistory: true, configureSystem: false 
    }
  },

  // --- LEVEL 3: SPECIALISTS (Nhân viên) ---
  [Role.PLANNER]: {
    label: 'Strategic Planner',
    description: 'Lên kế hoạch, cần xem báo cáo để phân tích.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: true, viewHistory: false, configureSystem: false 
    }
  },
  [Role.DESIGNER]: {
    label: 'Graphic Designer',
    description: 'Thực thi thiết kế.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: false, viewHistory: false, configureSystem: false 
    }
  },
  [Role.MEDIA]: {
    label: 'Chuyên viên Media',
    description: 'Thực thi quay dựng.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: false, viewHistory: false, configureSystem: false 
    }
  },
  [Role.PHOTO]: {
    label: 'Nhiếp ảnh gia',
    description: 'Chụp ảnh sản phẩm/sự kiện.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: false, viewHistory: false, configureSystem: false 
    }
  },
  [Role.SOCIAL]: {
    label: 'Content Creator',
    description: 'Sáng tạo nội dung.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: false, viewHistory: false, configureSystem: false 
    }
  },
  [Role.SEEDING]: {
    label: 'Nhân viên Seeding',
    description: 'Thực thi tương tác.',
    permissions: { 
        view: true, create: true, edit: false, delete: false, 
        assignTasks: false, manageTeam: false, approveAssets: false, manageBudget: false,
        viewReports: false, viewHistory: false, configureSystem: false 
    }
  }
};

export interface Member {
  id: string;
  name: string;
  role: string; // Tên chức danh hiển thị
  roleType: Role; // Mã chức danh hệ thống
  department: Department;
  reportsTo: string;
  email: string;
  password?: string; // New field for security code
  phone: string;
  avatar?: string;
}

export interface Subtask {
  id: string;
  content: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignerId: string; // Người giao việc
  assigneeId: string; // Người nhận việc chính
  supporterIds: string[]; // Danh sách người hỗ trợ
  status: TaskStatus;
  startDate: string; // Ngày bắt đầu
  deadline: string; // Hạn chót
  priority: 'Low' | 'Medium' | 'High';
  notes?: string;
  subtasks?: Subtask[]; // Danh sách công việc con (Checklist)
  
  // NEW FIELDS FOR SPECIALIZED WORKFLOW
  taskType: TaskType;
  mediaUrl?: string; // Link ảnh/video demo (Cho Media)
  contentDraft?: string; // Nội dung bài viết (Cho Content)
  linkedTaskId?: string; // ID của công việc liên quan (VD: Content link tới Media)
}

export interface PersonalTask {
  id: string;
  userId: string;
  content: string;
  day: string;
  completed: boolean;
  subtasks?: Subtask[]; // Added subtasks for personal checklist
  notes?: string;
}

// --- NEW: WEEKLY PLAN (For Cloud Sync) ---
export type PlanStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface WeeklyPlan {
    id: string; // Composite: userId_Year_Week (e.g., "1_2024_W42")
    userId: string;
    weekNumber: number;
    year: number;
    status: PlanStatus;
    approverId: string;
    submissionNote: string;
    managerFeedback: string;
    committedTaskIds: string[];
    
    // Reviews
    review?: {
        rating: number;
        highlights: string;
        improvements: string;
    };
    managerEval?: {
        rating: number;
        comment: string;
    };
    
    createdAt: string;
    updatedAt: string;
}

// --- WORK REPORT (Báo cáo ngày) ---
export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorkReport {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  completedWork: string; // Hôm nay đã làm gì
  nextPlan: string;      // Dự định ngày mai
  issues: string;        // Khó khăn / Vướng mắc
  mood: 'Happy' | 'Neutral' | 'Stressed'; // Cảm xúc công việc
  
  // Professional Metrics Upgrade
  workingHours?: number; // Số giờ làm việc thực tế
  selfScore?: number; // Tự đánh giá (1-5)
  managerComment?: string; // Quản lý nhận xét
  managerRating?: number; // Quản lý chấm điểm (1-5)
  
  // Workflow Status
  status: ReportStatus; 
  approvedBy?: string; // ID của người duyệt
  approvedAt?: string;
  
  createdAt: string;
}

// --- SUMMARY REPORT (Báo cáo Tuần/Tháng đã lưu) ---
export interface SummaryReport {
    id: string; // E.g., "WEEK_42_2024" or "MONTH_10_2024"
    type: 'WEEKLY' | 'MONTHLY';
    periodLabel: string; // "Tuần 42 (14/10 - 20/10)" or "Tháng 10/2024"
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    content: string; // AI Summary content (Markdown)
    createdBy: string;
    createdAt: string;
}

// --- APPROVALS (Kiểm duyệt Nội dung/Video) ---
export type ApprovalType = 'CONTENT' | 'VIDEO' | 'DESIGN' | 'OTHER';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface ApprovalLog {
  id: string;
  actorId: string; // Người thực hiện hành động
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGE' | 'RESUBMIT';
  comment?: string;
  timestamp: string;
}

export interface ApprovalRequest {
  id: string;
  requesterId: string; // Người gửi yêu cầu
  type: ApprovalType;
  title: string;
  description?: string;
  contentUrl: string; // Link Drive/Doc/Image
  attachmentType?: 'LINK' | 'FILE'; // New field to distinguish
  taskId?: string; // Link với Task cụ thể
  priority?: 'Low' | 'Medium' | 'High'; // Added priority
  
  status: ApprovalStatus;
  feedback?: string; // (Legacy) Nhận xét của quản lý
  reviewerId?: string; // (Legacy) Người duyệt
  
  logs?: ApprovalLog[]; // Lịch sử hoạt động chi tiết (mảng ApprovalLog)
  
  createdAt: string;
  updatedAt: string;
}

// --- BUDGET TRANSACTION ---
export interface BudgetTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'ALLOCATION'; // Allocation = Adding to budget, Expense = Spending
  category: 'Ads' | 'Production' | 'Tools' | 'Seeding' | 'Event' | 'Other';
  date: string;
  createdBy: string;
  taskId?: string; // Optional link to a task
  attachmentUrl?: string; // New field for receipt/invoice
  campaign?: string; // New field for marketing campaign tracking
}

// --- AI CHAT TYPES ---
export interface ChatSession {
  id: string;
  userId: string;
  title: string; // Tên chủ đề/dự án
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string; // Link to ChatSession
  userId: string; // ID của người tạo đoạn chat
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  roleContext?: string; // Vai trò AI đóng vai (nếu có)
}

// --- AI TRAINING DATA ---
export interface AIKnowledge {
  id: string;
  title: string;
  content: string; // Nội dung văn bản
  createdBy: string; // ID người tạo
  createdAt: string;
  type: 'TEXT' | 'FILE' | 'LINK'; 
  sourceUrl?: string; // URL nếu là Link
  fileName?: string; // Tên file nếu là File
}

// --- COLLABORATION TYPES ---
export interface Comment {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
  replies?: Comment[]; // Nested replies (Thread)
  image?: string | null; // Optional attached image (Base64) - Changed to allow null
  attachmentName?: string; // Optional name for file attachment
}

export interface Discussion {
  id: string;
  type: 'DIRECT' | 'GROUP'; // Loại thảo luận
  title?: string; // Tiêu đề (Bắt buộc với Group)
  authorId: string;
  memberIds: string[]; // Danh sách thành viên được xem/tham gia
  content: string;
  timestamp: string;
  likes: string[]; // Array of User IDs who liked
  comments: Comment[];
  images?: string[];
}

// --- HISTORY LOG TYPES ---
export interface AuditLog {
  id: string;
  actorId: string; // Người thực hiện
  actorName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'CONFIG';
  targetType: 'TASK' | 'MEMBER' | 'PERMISSION' | 'DISCUSSION' | 'SYSTEM' | 'APPROVAL' | 'BUDGET';
  targetId?: string; // ID đối tượng bị tác động (nếu có)
  details: string; // Mô tả chi tiết (VD: "Đổi trạng thái từ TODO sang DONE")
  timestamp: string;
}

// --- PERMISSION HELPERS ---

// Cho phép truyền config động để check quyền thay vì dùng mặc định
export const isManagementRole = (role: Role, config: Record<Role, RoleConfig> = ROLE_DEFINITIONS): boolean => {
  return config[role].permissions.manageTeam;
};

// Hàm xác định cấp độ chức vụ (Số càng lớn chức vụ càng cao)
export const getRoleLevel = (role: Role): number => {
    switch (role) {
        case Role.BOARD:
            return 5; // Ban Giám Đốc (Cao nhất)
        case Role.MANAGER:
            return 4; // Trưởng phòng
        case Role.DEPUTY_MANAGER:
            return 3; // Phó phòng
        case Role.DOP:
        case Role.MEDIA_LEADER:
        case Role.SOCIAL_LEADER:
        case Role.SEEDING_LEADER:
            return 2; // Cấp trưởng nhóm/Leader
        default:
            return 1; // Cấp nhân viên
    }
};

export const canDeleteTask = (user: Member, config: Record<Role, RoleConfig> = ROLE_DEFINITIONS): boolean => {
  return config[user.roleType].permissions.delete;
};

export const canEditTask = (user: Member, taskAssigneeId: string, config: Record<Role, RoleConfig> = ROLE_DEFINITIONS): boolean => {
  // Check permission from dynamic config
  const hasGlobalEdit = config[user.roleType].permissions.edit;
  
  if (hasGlobalEdit) return true;
  // Staff can only edit their own tasks
  return user.id === taskAssigneeId;
};

export const canAssignFromTeamList = (user: Member, config: Record<Role, RoleConfig> = ROLE_DEFINITIONS): boolean => {
  return config[user.roleType].permissions.assignTasks;
};

export const checkPermission = (user: Member, action: keyof RoleConfig['permissions'], config: Record<Role, RoleConfig> = ROLE_DEFINITIONS): boolean => {
    return config[user.roleType].permissions[action];
};

// --- SYSTEM CONFIGURATION ---
export interface AnnouncementConfig {
    enabled: boolean;
    title: string;
    message: string;
    bullets: string; // Store as newline separated string for simple textarea editing
}

export interface TopBannerConfig {
    id?: string; // NEW: Unique ID for templates
    name?: string; // NEW: Internal name for templates
    enabled: boolean;
    content: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    actionLabel?: string; // Text for the action button
    targetView?: View; // Navigation target (Button Action)
    visibleFrom?: string; // ISO String: Show banner FROM this date
    visibleUntil?: string; // ISO String: Auto-hide banner AFTER this date
    
    // NEW: TARGETING & CONTEXTUAL DISPLAY
    targetRoles?: Role[]; // Show only to specific roles (e.g., MANAGER only)
    targetDepartments?: Department[]; // Show only to specific departments (e.g., MEDIA only)
    displayOnViews?: View[]; // Show only on specific screens (e.g., DASHBOARD only)
    
    // NEW: DISPLAY MODE (Professional Update)
    displayMode?: 'BANNER' | 'MODAL';
}

export interface SystemConfig {
    appName: string;
    themeColor: string;
    logoUrl: string;
    announcement?: AnnouncementConfig;
    topBanner?: TopBannerConfig;
    broadcastTemplates?: TopBannerConfig[]; // NEW: Store multiple banner templates
}