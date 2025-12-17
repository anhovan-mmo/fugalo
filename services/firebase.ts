
// ... (imports remain same)
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  getDocs,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { Task, PersonalTask, Member, Role, RoleConfig, ROLE_DEFINITIONS, ChatMessage, ChatSession, Discussion, Comment, AuditLog, AIKnowledge, WorkReport, ApprovalRequest, SummaryReport, BudgetTransaction, WeeklyPlan, AnnouncementConfig, SystemConfig } from "../types";
import { INITIAL_TASKS, INITIAL_PERSONAL_TASKS, MEMBERS as INITIAL_MEMBERS } from "../constants";

// ... (config loading logic remains same)
const LS_CONFIG_KEY = 'fugalo_custom_firebase_config';

// 1. Get Config from LocalStorage OR Environment Variables
const getFirebaseConfig = () => {
    try {
        const localConfig = localStorage.getItem(LS_CONFIG_KEY);
        if (localConfig) {
            // Self-healing: Check if user pasted Rules instead of JSON
            if (localConfig.trim().startsWith('rules_version') || !localConfig.trim().startsWith('{')) {
                console.warn("⚠️ Phát hiện cấu hình sai định dạng (Firestore Rules). Đang tự động xóa...");
                localStorage.removeItem(LS_CONFIG_KEY);
                return null;
            }

            const parsed = JSON.parse(localConfig);
            // Basic validation to check if it looks like a firebase config
            if (parsed.apiKey && parsed.projectId) {
                console.log("🔹 Đang sử dụng cấu hình Firebase từ Cài đặt người dùng.");
                return parsed;
            }
        }
    } catch (e) {
        console.error("❌ Lỗi đọc config từ LocalStorage. Đang reset về mặc định.", e);
        localStorage.removeItem(LS_CONFIG_KEY); // Auto-fix crash loop
    }

    // Fallback to default/env
    return {
        apiKey: process.env.API_KEY || "AIzaSyBD2suChugtPo7qwkOXu1FEHTpr8uCOplw",
        authDomain: "crmmarketing-1b472.firebaseapp.com",
        projectId: "crmmarketing-1b472",
        storageBucket: "crmmarketing-1b472.firebasestorage.app",
        messagingSenderId: "335346577072",
        appId: "1:335346577072:web:a642d68affc314159c9575",
        measurementId: "G-4DCR1D2CZ3"
    };
};

const firebaseConfig = getFirebaseConfig();

// =========================================================================

const LS_KEYS = {
    TASKS: 'fugalo_db_tasks',
    PERSONAL: 'fugalo_db_personal_tasks',
    MEMBERS: 'fugalo_db_members',
    PERMISSIONS: 'fugalo_db_permissions',
    CHATS: 'fugalo_db_chats',
    CHAT_SESSIONS: 'fugalo_db_chat_sessions',
    AI_KNOWLEDGE: 'fugalo_db_ai_knowledge',
    DISCUSSIONS: 'fugalo_db_discussions',
    LOGS: 'fugalo_db_logs',
    WORK_REPORTS: 'fugalo_db_work_reports',
    APPROVALS: 'fugalo_db_approvals',
    SUMMARY_REPORTS: 'fugalo_db_summary_reports',
    BUDGET: 'fugalo_db_budget_transactions',
    SYSTEM_CONFIG: 'fugalo_db_system_config',
    WEEKLY_PLANS: 'fugalo_db_weekly_plans' // NEW
};
const EVENTS = {
    TASKS_UPDATED: 'fugalo_tasks_updated',
    PERSONAL_UPDATED: 'fugalo_personal_updated',
    MEMBERS_UPDATED: 'fugalo_members_updated',
    PERMISSIONS_UPDATED: 'fugalo_permissions_updated',
    CHATS_UPDATED: 'fugalo_chats_updated',
    CHAT_SESSIONS_UPDATED: 'fugalo_chat_sessions_updated',
    AI_KNOWLEDGE_UPDATED: 'fugalo_ai_knowledge_updated',
    DISCUSSIONS_UPDATED: 'fugalo_discussions_updated',
    LOGS_UPDATED: 'fugalo_logs_updated',
    WORK_REPORTS_UPDATED: 'fugalo_work_reports_updated',
    APPROVALS_UPDATED: 'fugalo_approvals_updated',
    SUMMARY_REPORTS_UPDATED: 'fugalo_summary_reports_updated',
    BUDGET_UPDATED: 'fugalo_budget_updated',
    SYSTEM_CONFIG_UPDATED: 'fugalo_system_config_updated',
    WEEKLY_PLANS_UPDATED: 'fugalo_weekly_plans_updated', // NEW
    SYNC_LOG: 'fugalo_sync_log_event'
};

// EXPORT DB for WebRTC Usage in Components
export let db: any = null; 
let auth: any = null;
export let isFirebaseEnabled = false;

// Kiểm tra và khởi tạo Firebase
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseEnabled = true;
    console.log("✅ Đã kết nối Firebase Cloud (Online Mode)");
} catch (error) {
    console.error("❌ Lỗi kết nối Firebase, chuyển sang chế độ Offline:", error);
    isFirebaseEnabled = false;
}

// ... (Save/Clear config logic remains same)
export const saveFirebaseConfig = (configJson: string) => {
    try {
        if (!configJson.trim().startsWith('{')) {
             throw new Error("Cấu hình phải bắt đầu bằng dấu ngoặc nhọn '{'. Có thể bạn đang dán nhầm Rules?");
        }
        
        const parsed = JSON.parse(configJson);
        
        if (!parsed.apiKey || !parsed.projectId) {
            throw new Error("Cấu hình thiếu apiKey hoặc projectId");
        }
        
        localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(parsed));
        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "Lỗi cú pháp JSON" };
    }
};

export const clearFirebaseConfig = () => {
    localStorage.removeItem(LS_CONFIG_KEY);
};

// ... (Rest of existing code: collections, helpers, seeding...)

const TASKS_COLLECTION = "tasks";
const PERSONAL_TASKS_COLLECTION = "personal_tasks";
const MEMBERS_COLLECTION = "members";
const CONFIG_COLLECTION = "config"; 
const AI_CHATS_COLLECTION = "ai_chats"; 
const AI_SESSIONS_COLLECTION = "ai_chat_sessions";
const AI_KNOWLEDGE_COLLECTION = "ai_knowledge"; 
const WORK_REPORTS_COLLECTION = "work_reports"; 
const APPROVALS_COLLECTION = "approval_requests"; 
const SUMMARY_REPORTS_COLLECTION = "summary_reports"; 
const BUDGET_COLLECTION = "budget_transactions"; 
const WEEKLY_PLANS_COLLECTION = "weekly_plans"; // NEW
const ROLES_DOC_ID = "role_permissions";
const SYSTEM_SETTINGS_DOC_ID = "system_settings";
const DISCUSSIONS_COLLECTION = "discussions"; 
const LOGS_COLLECTION = "audit_logs"; 

// ... (Sync helpers, Auth, Local Data helpers, Seeding remain same)
const dispatchSyncEvent = (source: string, count: number, type: 'PULL' | 'PUSH' = 'PULL') => {
    const event = new CustomEvent(EVENTS.SYNC_LOG, {
        detail: {
            id: Date.now().toString() + Math.random(),
            source,
            type,
            count,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS'
        }
    });
    window.dispatchEvent(event);
};

export const logoutFirebase = async () => {
    if (auth) {
        return signOut(auth);
    }
};

const getLocalData = <T>(key: string, defaults: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaults;
    } catch (e) {
        console.error(`Lỗi đọc dữ liệu từ ${key}:`, e);
        return defaults;
    }
};

// Export safeStringify to prevent circular errors in other parts of the app
export const safeStringify = (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return; // Duplicate reference found, discard key
            }
            cache.add(value);
        }
        return value;
    });
};

const setLocalData = (key: string, data: any, eventName: string) => {
    try {
        localStorage.setItem(key, safeStringify(data));
        window.dispatchEvent(new Event(eventName));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             console.warn(`⚠️ LocalStorage quota exceeded for ${key}. Data not saved locally to prevent crash.`);
             window.dispatchEvent(new Event(eventName));
        } else {
            console.error(`❌ Lỗi lưu LocalStorage (${key}):`, e);
        }
    }
};

const sanitizeData = (data: any) => {
    // Deeply clean undefined values using JSON serialization
    try {
        return JSON.parse(safeStringify(data));
    } catch (e) {
        console.error("Sanitize error", e);
        return data;
    }
};

// ... (Rest of the file remains unchanged, containing seedInitialDataIfEmpty and all subscribe/update functions)
export const seedInitialDataIfEmpty = async () => {
    if (isFirebaseEnabled && db) {
        try {
            const membersQuery = query(collection(db, MEMBERS_COLLECTION));
            const snapshot = await getDocs(membersQuery);
            
            if (snapshot.empty) {
                console.log("Cloud Database rỗng, đang đồng bộ dữ liệu mẫu...");
                
                const memberPromises = INITIAL_MEMBERS.map(m => 
                    setDoc(doc(db, MEMBERS_COLLECTION, m.id), m)
                );

                const tasksQuery = query(collection(db, TASKS_COLLECTION));
                const taskSnapshot = await getDocs(tasksQuery);
                let taskPromises: Promise<void>[] = [];
                if (taskSnapshot.empty) {
                    taskPromises = INITIAL_TASKS.map(task => 
                        setDoc(doc(db, TASKS_COLLECTION, task.id), task)
                    );
                }
                
                const pTaskQuery = query(collection(db, PERSONAL_TASKS_COLLECTION));
                const pTaskSnapshot = await getDocs(pTaskQuery);
                let pTaskPromises: Promise<void>[] = [];
                if (pTaskSnapshot.empty) {
                    pTaskPromises = INITIAL_PERSONAL_TASKS.map(pTask => 
                        setDoc(doc(db, PERSONAL_TASKS_COLLECTION, pTask.id), pTask)
                    );
                }

                await setDoc(doc(db, CONFIG_COLLECTION, ROLES_DOC_ID), ROLE_DEFINITIONS, { merge: true });

                await Promise.all([...memberPromises, ...taskPromises, ...pTaskPromises]);
                console.log("✅ Đã đồng bộ toàn bộ dữ liệu mẫu thành công!");
            }
        } catch (e) { 
            console.error("Lỗi seed data cloud:", e); 
        }
    } else {
        if (!localStorage.getItem(LS_KEYS.TASKS)) setLocalData(LS_KEYS.TASKS, INITIAL_TASKS, EVENTS.TASKS_UPDATED);
        if (!localStorage.getItem(LS_KEYS.PERSONAL)) setLocalData(LS_KEYS.PERSONAL, INITIAL_PERSONAL_TASKS, EVENTS.PERSONAL_UPDATED);
        if (!localStorage.getItem(LS_KEYS.MEMBERS)) setLocalData(LS_KEYS.MEMBERS, INITIAL_MEMBERS, EVENTS.MEMBERS_UPDATED);
        if (!localStorage.getItem(LS_KEYS.PERMISSIONS)) setLocalData(LS_KEYS.PERMISSIONS, ROLE_DEFINITIONS, EVENTS.PERMISSIONS_UPDATED);
    }
};

// ... (Rest of file content)
// --- SYSTEM CONFIG API ---

const DEFAULT_CONFIG: SystemConfig = {
    appName: 'Fugalo CRM',
    themeColor: '#0f172a',
    logoUrl: 'https://i.imgur.com/KzXj0XJ.png',
    announcement: {
        enabled: true,
        title: 'Bảng Tin Nội Bộ',
        message: 'Chúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng. Đừng quên kiểm tra mục "Cần duyệt" và cập nhật tiến độ công việc trước 17:30 nhé.',
        bullets: "Triển khai chiến dịch \"Mùa Lễ Hội 2024\".\nHoàn tất đối soát ngân sách tháng trước.\nTraining đội ngũ về quy trình AI mới."
    },
    topBanner: {
        enabled: false,
        content: '',
        type: 'INFO'
    },
    broadcastTemplates: [] // NEW DEFAULT
};

export const subscribeToSystemConfig = (callback: (config: SystemConfig) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(doc(db, CONFIG_COLLECTION, SYSTEM_SETTINGS_DOC_ID), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as SystemConfig;
                // Merge with default to ensure all fields structure exists (handling partial/old data)
                const mergedConfig = { ...DEFAULT_CONFIG, ...data };
                if (data.announcement) {
                    mergedConfig.announcement = { ...DEFAULT_CONFIG.announcement, ...data.announcement };
                }
                if (data.topBanner) {
                    mergedConfig.topBanner = { ...DEFAULT_CONFIG.topBanner, ...data.topBanner };
                }
                // Ensure array exists
                if (!mergedConfig.broadcastTemplates) {
                    mergedConfig.broadcastTemplates = [];
                }
                callback(mergedConfig);
                dispatchSyncEvent('System Config', 1, 'PULL');
            } else {
                callback(DEFAULT_CONFIG);
            }
        }, (err) => {
            console.error("Lỗi fetch system config:", err);
            callback(getLocalData(LS_KEYS.SYSTEM_CONFIG, DEFAULT_CONFIG));
        });
    } else {
        const notify = () => callback(getLocalData(LS_KEYS.SYSTEM_CONFIG, DEFAULT_CONFIG));
        notify();
        window.addEventListener(EVENTS.SYSTEM_CONFIG_UPDATED, notify);
        return () => window.removeEventListener(EVENTS.SYSTEM_CONFIG_UPDATED, notify);
    }
};

export const updateSystemConfigInDB = async (config: SystemConfig) => {
    setLocalData(LS_KEYS.SYSTEM_CONFIG, config, EVENTS.SYSTEM_CONFIG_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, CONFIG_COLLECTION, SYSTEM_SETTINGS_DOC_ID), config, { merge: true });
        dispatchSyncEvent('System Config (Update)', 1, 'PUSH');
    }
};

// ... (Rest of the file APIs for permissions, members, tasks etc. remain exactly same)
export const subscribeToRolePermissions = (callback: (config: Record<Role, RoleConfig>) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(doc(db, CONFIG_COLLECTION, ROLES_DOC_ID), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Record<Role, RoleConfig>;
                callback(data);
                dispatchSyncEvent('Permissions', 1, 'PULL');
            } else {
                callback(ROLE_DEFINITIONS);
                setDoc(doc(db, CONFIG_COLLECTION, ROLES_DOC_ID), ROLE_DEFINITIONS);
            }
        }, (err) => {
            console.error("Lỗi fetch permissions:", err);
            callback(getLocalData(LS_KEYS.PERMISSIONS, ROLE_DEFINITIONS));
        });
    } else {
        const notify = () => callback(getLocalData(LS_KEYS.PERMISSIONS, ROLE_DEFINITIONS));
        notify();
        window.addEventListener(EVENTS.PERMISSIONS_UPDATED, notify);
        return () => window.removeEventListener(EVENTS.PERMISSIONS_UPDATED, notify);
    }
};

export const updateRolePermissionsInDB = async (config: Record<Role, RoleConfig>) => {
    setLocalData(LS_KEYS.PERMISSIONS, config, EVENTS.PERMISSIONS_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, CONFIG_COLLECTION, ROLES_DOC_ID), config);
        dispatchSyncEvent('Permissions', 1, 'PUSH');
    }
};

export const subscribeToMembers = (callback: (members: Member[]) => void) => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, MEMBERS_COLLECTION));
        return onSnapshot(q, (querySnapshot) => {
            const members: Member[] = [];
            querySnapshot.forEach((doc) => members.push({ ...doc.data(), id: doc.id } as Member));
            members.sort((a, b) => parseInt(a.id) - parseInt(b.id));
            callback(members);
            dispatchSyncEvent('Members', members.length, 'PULL');
        }, () => callback(getLocalData(LS_KEYS.MEMBERS, INITIAL_MEMBERS)));
    } else {
        const notify = () => callback(getLocalData(LS_KEYS.MEMBERS, INITIAL_MEMBERS));
        notify();
        window.addEventListener(EVENTS.MEMBERS_UPDATED, notify);
        return () => window.removeEventListener(EVENTS.MEMBERS_UPDATED, notify);
    }
};

export const updateMemberInDB = async (member: Member) => {
    const members = [...getLocalData<Member[]>(LS_KEYS.MEMBERS, INITIAL_MEMBERS)];
    const index = members.findIndex(m => m.id === member.id);
    if (index !== -1) members[index] = member; else members.push(member);
    setLocalData(LS_KEYS.MEMBERS, members, EVENTS.MEMBERS_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, MEMBERS_COLLECTION, member.id), member, { merge: true });
        dispatchSyncEvent(`Members (${member.name})`, 1, 'PUSH');
    }
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void, onRealtimeUpdate?: (changeType: 'added' | 'modified' | 'removed', task: Task) => void) => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, TASKS_COLLECTION));
        let isFirstLoad = true;
        return onSnapshot(q, (querySnapshot) => {
            const tasks: Task[] = [];
            if (!isFirstLoad && onRealtimeUpdate) {
                querySnapshot.docChanges().forEach((change) => {
                    if (!change.doc.metadata.hasPendingWrites) {
                        const task = { ...change.doc.data(), id: change.doc.id } as Task;
                        onRealtimeUpdate(change.type, task);
                    }
                });
            }
            querySnapshot.forEach((doc) => tasks.push({ ...doc.data(), id: doc.id } as Task));
            callback(tasks);
            dispatchSyncEvent('Tasks (Projects)', tasks.length, 'PULL');
            isFirstLoad = false;
        });
    } else {
        const notify = () => callback(getLocalData(LS_KEYS.TASKS, INITIAL_TASKS));
        notify();
        window.addEventListener(EVENTS.TASKS_UPDATED, notify);
        return () => window.removeEventListener(EVENTS.TASKS_UPDATED, notify);
    }
};

export const addTaskToDB = async (task: Task) => {
  const tasks = getLocalData<Task[]>(LS_KEYS.TASKS, []);
  setLocalData(LS_KEYS.TASKS, [...tasks, task], EVENTS.TASKS_UPDATED);
  if (isFirebaseEnabled && db) {
      await setDoc(doc(db, TASKS_COLLECTION, task.id), sanitizeData(task));
      dispatchSyncEvent(`Tasks (Create: ${task.title})`, 1, 'PUSH');
  }
};

export const updateTaskInDB = async (task: Task) => {
  const tasks = getLocalData<Task[]>(LS_KEYS.TASKS, []);
  const index = tasks.findIndex(t => t.id === task.id);
  if (index !== -1) {
    tasks[index] = task;
    setLocalData(LS_KEYS.TASKS, tasks, EVENTS.TASKS_UPDATED);
  }
  if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, TASKS_COLLECTION, task.id), sanitizeData(task));
      dispatchSyncEvent(`Tasks (Update: ${task.title})`, 1, 'PUSH');
  }
};

export const deleteTaskFromDB = async (id: string) => {
  const tasks = getLocalData<Task[]>(LS_KEYS.TASKS, []);
  setLocalData(LS_KEYS.TASKS, tasks.filter(t => t.id !== id), EVENTS.TASKS_UPDATED);
  if (isFirebaseEnabled && db) {
      await deleteDoc(doc(db, TASKS_COLLECTION, id));
      dispatchSyncEvent(`Tasks (Delete ID: ${id})`, 1, 'PUSH');
  }
};

export const subscribeToPersonalTasks = (callback: (tasks: PersonalTask[]) => void) => {
  if (isFirebaseEnabled && db) {
    return onSnapshot(collection(db, PERSONAL_TASKS_COLLECTION), (snapshot) => {
        const data = snapshot.docs.map(d => d.data() as PersonalTask);
        callback(data);
        dispatchSyncEvent('Personal Tasks', data.length, 'PULL');
    });
  } else {
    const handler = () => callback(getLocalData(LS_KEYS.PERSONAL, INITIAL_PERSONAL_TASKS));
    window.addEventListener(EVENTS.PERSONAL_UPDATED, handler);
    handler();
    return () => window.removeEventListener(EVENTS.PERSONAL_UPDATED, handler);
  }
};

export const addPersonalTaskToDB = async (task: PersonalTask) => {
  const tasks = getLocalData<PersonalTask[]>(LS_KEYS.PERSONAL, []);
  setLocalData(LS_KEYS.PERSONAL, [...tasks, task], EVENTS.PERSONAL_UPDATED);
  if (isFirebaseEnabled && db) {
      await setDoc(doc(db, PERSONAL_TASKS_COLLECTION, task.id), sanitizeData(task));
      dispatchSyncEvent('Personal Task (Add)', 1, 'PUSH');
  }
};

export const updatePersonalTaskInDB = async (task: PersonalTask) => {
  const tasks = getLocalData<PersonalTask[]>(LS_KEYS.PERSONAL, []);
  const index = tasks.findIndex(t => t.id === task.id);
  if (index !== -1) {
    tasks[index] = task;
    setLocalData(LS_KEYS.PERSONAL, tasks, EVENTS.PERSONAL_UPDATED);
  }
  if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, PERSONAL_TASKS_COLLECTION, task.id), sanitizeData(task));
      dispatchSyncEvent('Personal Task (Update)', 1, 'PUSH');
  }
};

export const deletePersonalTaskFromDB = async (id: string) => {
  const tasks = getLocalData<PersonalTask[]>(LS_KEYS.PERSONAL, []);
  setLocalData(LS_KEYS.PERSONAL, tasks.filter(t => t.id !== id), EVENTS.PERSONAL_UPDATED);
  if (isFirebaseEnabled && db) {
      await deleteDoc(doc(db, PERSONAL_TASKS_COLLECTION, id));
      dispatchSyncEvent('Personal Task (Delete)', 1, 'PUSH');
  }
};

export const subscribeToWeeklyPlan = (planId: string, callback: (plan: WeeklyPlan | null) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(doc(db, WEEKLY_PLANS_COLLECTION, planId), (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as WeeklyPlan);
                dispatchSyncEvent('Weekly Plan', 1, 'PULL');
            } else {
                callback(null);
            }
        });
    } else {
        const handler = () => {
            const plans = getLocalData<WeeklyPlan[]>(LS_KEYS.WEEKLY_PLANS, []);
            const plan = plans.find(p => p.id === planId) || null;
            callback(plan);
        };
        window.addEventListener(EVENTS.WEEKLY_PLANS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.WEEKLY_PLANS_UPDATED, handler);
    }
};

export const subscribeToPendingWeeklyPlans = (callback: (plans: WeeklyPlan[]) => void) => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, WEEKLY_PLANS_COLLECTION), where('status', '==', 'PENDING'));
        return onSnapshot(q, (snapshot) => {
            const plans = snapshot.docs.map(d => d.data() as WeeklyPlan);
            callback(plans);
            dispatchSyncEvent('Pending Plans', plans.length, 'PULL');
        });
    } else {
        const handler = () => {
            const plans = getLocalData<WeeklyPlan[]>(LS_KEYS.WEEKLY_PLANS, []);
            callback(plans.filter(p => p.status === 'PENDING'));
        };
        window.addEventListener(EVENTS.WEEKLY_PLANS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.WEEKLY_PLANS_UPDATED, handler);
    }
};

export const saveWeeklyPlan = async (plan: WeeklyPlan) => {
    const plans = getLocalData<WeeklyPlan[]>(LS_KEYS.WEEKLY_PLANS, []);
    const index = plans.findIndex(p => p.id === plan.id);
    if (index !== -1) plans[index] = plan; else plans.push(plan);
    setLocalData(LS_KEYS.WEEKLY_PLANS, plans, EVENTS.WEEKLY_PLANS_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, WEEKLY_PLANS_COLLECTION, plan.id), sanitizeData(plan));
        dispatchSyncEvent('Weekly Plan (Save)', 1, 'PUSH');
    }
};

export const subscribeToBudget = (callback: (data: BudgetTransaction[]) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(collection(db, BUDGET_COLLECTION), (snapshot) => {
            const data = snapshot.docs.map(d => d.data() as BudgetTransaction);
            callback(data);
            dispatchSyncEvent('Budget', data.length, 'PULL');
        });
    } else {
        const handler = () => callback(getLocalData(LS_KEYS.BUDGET, []));
        window.addEventListener(EVENTS.BUDGET_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.BUDGET_UPDATED, handler);
    }
};

export const addBudgetTransactionToDB = async (transaction: BudgetTransaction) => {
    const transactions = getLocalData<BudgetTransaction[]>(LS_KEYS.BUDGET, []);
    setLocalData(LS_KEYS.BUDGET, [transaction, ...transactions], EVENTS.BUDGET_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, BUDGET_COLLECTION, transaction.id), sanitizeData(transaction));
        dispatchSyncEvent('Budget (Add Transaction)', 1, 'PUSH');
    }
};

export const updateBudgetTransactionInDB = async (transaction: BudgetTransaction) => {
    const transactions = getLocalData<BudgetTransaction[]>(LS_KEYS.BUDGET, []);
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index !== -1) {
        transactions[index] = transaction;
        setLocalData(LS_KEYS.BUDGET, transactions, EVENTS.BUDGET_UPDATED);
    }
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, BUDGET_COLLECTION, transaction.id), sanitizeData(transaction));
        dispatchSyncEvent('Budget (Update Transaction)', 1, 'PUSH');
    }
};

export const deleteBudgetTransactionFromDB = async (id: string) => {
    const transactions = getLocalData<BudgetTransaction[]>(LS_KEYS.BUDGET, []);
    const newTransactions = transactions.filter(t => t.id !== id);
    setLocalData(LS_KEYS.BUDGET, newTransactions, EVENTS.BUDGET_UPDATED);
    if (isFirebaseEnabled && db) {
        await deleteDoc(doc(db, BUDGET_COLLECTION, id));
        dispatchSyncEvent('Budget (Delete Transaction)', 1, 'PUSH');
    }
};

export const addLogToDB = async (log: AuditLog) => {
  const logs = getLocalData<AuditLog[]>(LS_KEYS.LOGS, []);
  setLocalData(LS_KEYS.LOGS, [log, ...logs], EVENTS.LOGS_UPDATED);
  if (isFirebaseEnabled && db) await setDoc(doc(db, LOGS_COLLECTION, log.id), sanitizeData(log));
};

export const subscribeToLogs = (callback: (logs: AuditLog[]) => void) => {
  if (isFirebaseEnabled && db) {
    const q = query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => d.data() as AuditLog);
      callback(data);
    });
  } else {
    const handler = () => callback(getLocalData(LS_KEYS.LOGS, []));
    window.addEventListener(EVENTS.LOGS_UPDATED, handler);
    handler();
    return () => window.removeEventListener(EVENTS.LOGS_UPDATED, handler);
  }
};

export const subscribeToDiscussions = (callback: (discussions: Discussion[]) => void) => {
  if (isFirebaseEnabled && db) {
    return onSnapshot(collection(db, DISCUSSIONS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => d.data() as Discussion);
      callback(data);
      dispatchSyncEvent('Discussions', data.length, 'PULL');
    });
  } else {
    const handler = () => callback(getLocalData(LS_KEYS.DISCUSSIONS, []));
    window.addEventListener(EVENTS.DISCUSSIONS_UPDATED, handler);
    handler();
    return () => window.removeEventListener(EVENTS.DISCUSSIONS_UPDATED, handler);
  }
};

export const addDiscussionToDB = async (discussion: Discussion) => {
  const list = getLocalData<Discussion[]>(LS_KEYS.DISCUSSIONS, []);
  setLocalData(LS_KEYS.DISCUSSIONS, [discussion, ...list], EVENTS.DISCUSSIONS_UPDATED);
  if (isFirebaseEnabled && db) {
      await setDoc(doc(db, DISCUSSIONS_COLLECTION, discussion.id), sanitizeData(discussion));
      dispatchSyncEvent('Discussion (Post)', 1, 'PUSH');
  }
};

export const updateDiscussionInDB = async (discussion: Discussion) => {
  const list = getLocalData<Discussion[]>(LS_KEYS.DISCUSSIONS, []);
  const index = list.findIndex(d => d.id === discussion.id);
  if (index !== -1) {
    list[index] = discussion;
    setLocalData(LS_KEYS.DISCUSSIONS, list, EVENTS.DISCUSSIONS_UPDATED);
  }
  if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, DISCUSSIONS_COLLECTION, discussion.id), sanitizeData(discussion));
      dispatchSyncEvent('Discussion (Comment/Update)', 1, 'PUSH');
  }
};

export const subscribeToWorkReports = (callback: (reports: WorkReport[]) => void) => {
  if (isFirebaseEnabled && db) {
    return onSnapshot(collection(db, WORK_REPORTS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => d.data() as WorkReport);
      callback(data);
      dispatchSyncEvent('Work Reports', data.length, 'PULL');
    });
  } else {
    const handler = () => callback(getLocalData(LS_KEYS.WORK_REPORTS, []));
    window.addEventListener(EVENTS.WORK_REPORTS_UPDATED, handler);
    handler();
    return () => window.removeEventListener(EVENTS.WORK_REPORTS_UPDATED, handler);
  }
};

export const addWorkReportToDB = async (report: WorkReport) => {
  const list = getLocalData<WorkReport[]>(LS_KEYS.WORK_REPORTS, []);
  setLocalData(LS_KEYS.WORK_REPORTS, [report, ...list], EVENTS.WORK_REPORTS_UPDATED);
  if (isFirebaseEnabled && db) {
      await setDoc(doc(db, WORK_REPORTS_COLLECTION, report.id), sanitizeData(report));
      dispatchSyncEvent('Work Report (Submit)', 1, 'PUSH');
  }
};

export const updateWorkReportInDB = async (report: WorkReport) => {
  const list = getLocalData<WorkReport[]>(LS_KEYS.WORK_REPORTS, []);
  const index = list.findIndex(r => r.id === report.id);
  if (index !== -1) {
    list[index] = report;
    setLocalData(LS_KEYS.WORK_REPORTS, list, EVENTS.WORK_REPORTS_UPDATED);
  }
  if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, WORK_REPORTS_COLLECTION, report.id), sanitizeData(report));
      dispatchSyncEvent('Work Report (Update/Review)', 1, 'PUSH');
  }
};

export const subscribeToSummaryReports = (callback: (reports: SummaryReport[]) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(collection(db, SUMMARY_REPORTS_COLLECTION), (snapshot) => {
            const data = snapshot.docs.map(d => d.data() as SummaryReport);
            callback(data);
            dispatchSyncEvent('Summary Reports', data.length, 'PULL');
        });
    } else {
        const handler = () => callback(getLocalData(LS_KEYS.SUMMARY_REPORTS, []));
        window.addEventListener(EVENTS.SUMMARY_REPORTS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.SUMMARY_REPORTS_UPDATED, handler);
    }
};

export const saveSummaryReportToDB = async (report: SummaryReport) => {
    const list = getLocalData<SummaryReport[]>(LS_KEYS.SUMMARY_REPORTS, []);
    setLocalData(LS_KEYS.SUMMARY_REPORTS, [report, ...list], EVENTS.SUMMARY_REPORTS_UPDATED);
    if (isFirebaseEnabled && db) await setDoc(doc(db, SUMMARY_REPORTS_COLLECTION, report.id), sanitizeData(report));
};

export const subscribeToApprovals = (callback: (data: ApprovalRequest[]) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(collection(db, APPROVALS_COLLECTION), (snapshot) => {
            const data = snapshot.docs.map(d => d.data() as ApprovalRequest);
            callback(data);
            dispatchSyncEvent('Approvals', data.length, 'PULL');
        });
    } else {
        const handler = () => callback(getLocalData(LS_KEYS.APPROVALS, []));
        window.addEventListener(EVENTS.APPROVALS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.APPROVALS_UPDATED, handler);
    }
};

export const addApprovalToDB = async (req: ApprovalRequest) => {
    const list = getLocalData<ApprovalRequest[]>(LS_KEYS.APPROVALS, []);
    setLocalData(LS_KEYS.APPROVALS, [req, ...list], EVENTS.APPROVALS_UPDATED);
    if (isFirebaseEnabled && db) {
        await setDoc(doc(db, APPROVALS_COLLECTION, req.id), sanitizeData(req));
        dispatchSyncEvent('Approval (Create)', 1, 'PUSH');
    }
};

export const updateApprovalInDB = async (req: ApprovalRequest) => {
    const list = getLocalData<ApprovalRequest[]>(LS_KEYS.APPROVALS, []);
    const index = list.findIndex(r => r.id === req.id);
    if (index !== -1) {
        list[index] = req;
        setLocalData(LS_KEYS.APPROVALS, list, EVENTS.APPROVALS_UPDATED);
    }
    if (isFirebaseEnabled && db) {
        await updateDoc(doc(db, APPROVALS_COLLECTION, req.id), sanitizeData(req));
        dispatchSyncEvent('Approval (Update)', 1, 'PUSH');
    }
};

export const subscribeToChatSessions = (userId: string, callback: (sessions: ChatSession[]) => void) => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, AI_CHATS_COLLECTION), where('userId', '==', userId));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(d => d.data() as ChatSession));
        });
    } else {
        const handler = () => {
            const all = getLocalData<ChatSession[]>(LS_KEYS.CHAT_SESSIONS, []);
            callback(all.filter(s => s.userId === userId));
        };
        window.addEventListener(EVENTS.CHAT_SESSIONS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.CHAT_SESSIONS_UPDATED, handler);
    }
};

export const addChatSessionToDB = async (session: ChatSession) => {
    const list = getLocalData<ChatSession[]>(LS_KEYS.CHAT_SESSIONS, []);
    setLocalData(LS_KEYS.CHAT_SESSIONS, [...list, session], EVENTS.CHAT_SESSIONS_UPDATED);
    if (isFirebaseEnabled && db) await setDoc(doc(db, AI_CHATS_COLLECTION, session.id), sanitizeData(session));
};

export const deleteChatSessionFromDB = async (sessionId: string) => {
    const list = getLocalData<ChatSession[]>(LS_KEYS.CHAT_SESSIONS, []);
    setLocalData(LS_KEYS.CHAT_SESSIONS, list.filter(s => s.id !== sessionId), EVENTS.CHAT_SESSIONS_UPDATED);
    if (isFirebaseEnabled && db) await deleteDoc(doc(db, AI_CHATS_COLLECTION, sessionId));
};

export const subscribeToChatHistory = (sessionId: string, callback: (messages: ChatMessage[]) => void) => {
    if (isFirebaseEnabled && db) {
        const q = query(collection(db, AI_SESSIONS_COLLECTION), where('sessionId', '==', sessionId), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(d => d.data() as ChatMessage));
        });
    } else {
        const handler = () => {
            const all = getLocalData<ChatMessage[]>(LS_KEYS.CHATS, []);
            callback(all.filter(m => m.sessionId === sessionId).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        };
        window.addEventListener(EVENTS.CHATS_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.CHATS_UPDATED, handler);
    }
};

export const addChatMessageToDB = async (message: ChatMessage) => {
    const list = getLocalData<ChatMessage[]>(LS_KEYS.CHATS, []);
    setLocalData(LS_KEYS.CHATS, [...list, message], EVENTS.CHATS_UPDATED);
    if (isFirebaseEnabled && db) await setDoc(doc(db, AI_SESSIONS_COLLECTION, message.id), sanitizeData(message));
};

export const subscribeToKnowledge = (callback: (data: AIKnowledge[]) => void) => {
    if (isFirebaseEnabled && db) {
        return onSnapshot(collection(db, AI_KNOWLEDGE_COLLECTION), (snapshot) => {
            callback(snapshot.docs.map(d => d.data() as AIKnowledge));
        });
    } else {
        const handler = () => callback(getLocalData(LS_KEYS.AI_KNOWLEDGE, []));
        window.addEventListener(EVENTS.AI_KNOWLEDGE_UPDATED, handler);
        handler();
        return () => window.removeEventListener(EVENTS.AI_KNOWLEDGE_UPDATED, handler);
    }
};

export const addKnowledgeToDB = async (item: AIKnowledge) => {
    const list = getLocalData<AIKnowledge[]>(LS_KEYS.AI_KNOWLEDGE, []);
    setLocalData(LS_KEYS.AI_KNOWLEDGE, [...list, item], EVENTS.AI_KNOWLEDGE_UPDATED);
    if (isFirebaseEnabled && db) await setDoc(doc(db, AI_KNOWLEDGE_COLLECTION, item.id), sanitizeData(item));
};

export const deleteKnowledgeFromDB = async (id: string) => {
    const list = getLocalData<AIKnowledge[]>(LS_KEYS.AI_KNOWLEDGE, []);
    setLocalData(LS_KEYS.AI_KNOWLEDGE, list.filter(i => i.id !== id), EVENTS.AI_KNOWLEDGE_UPDATED);
    if (isFirebaseEnabled && db) await deleteDoc(doc(db, AI_KNOWLEDGE_COLLECTION, id));
};
