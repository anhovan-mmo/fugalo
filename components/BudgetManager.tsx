
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, Task, BudgetTransaction, AuditLog } from '../types';
import { subscribeToBudget, addBudgetTransactionToDB, updateBudgetTransactionInDB, deleteBudgetTransactionFromDB, addLogToDB, subscribeToLogs } from '../services/firebase';
import { analyzeBudget } from '../services/geminiService';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, LineChart, Line } from 'recharts';
import { Wallet, TrendingDown, TrendingUp, Plus, Trash2, Calendar, Filter, DollarSign, PieChart as PieChartIcon, Settings, AlertTriangle, CheckCircle2, Zap, ArrowRight, Search, X, Link as LinkIcon, Briefcase, Paperclip, Upload, FileText, Image as ImageIcon, Target, Download, Grid, LayoutDashboard, List, Sparkles, Pencil, Users, BarChart3, ChevronLeft, ChevronRight, ShieldCheck, CreditCard, Lock, History, Clock } from 'lucide-react';

interface BudgetManagerProps {
    currentUser: Member;
    members: Member[];
    tasks: Task[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

// Helper to resize image for Firestore
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress
        } else {
            resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// --- TIME HELPERS ---
const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getDateRangeOfWeek = (weekNo: number, year: number) => {
    const d = new Date(year, 0, 1);
    const dayNum = d.getDay();
    let requiredDate = --weekNo * 7;
    if (((dayNum !== 0) || dayNum > 4)) {
        requiredDate += 7;
    }
    d.setDate(1 - d.getDay() + ++requiredDate);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    
    const start = new Date(d);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    start.setDate(diff);
    start.setHours(0,0,0,0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23,59,59,999);
    
    return { start, end };
};

const BudgetManager: React.FC<BudgetManagerProps> = ({ currentUser, members, tasks }) => {
    const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
    const [budgetLogs, setBudgetLogs] = useState<AuditLog[]>([]);
    const [viewMode, setViewMode] = useState<'TRANSACTIONS' | 'ANALYTICS' | 'HISTORY'>('TRANSACTIONS');
    
    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<BudgetTransaction | null>(null); 
    const [chartView, setChartView] = useState<'CATEGORY' | 'LIMIT'>('LIMIT');
    
    // Attachment View State
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
    
    // AI State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Config State
    const [monthlyLimit, setMonthlyLimit] = useState(() => {
        const saved = localStorage.getItem('fugalo_budget_limit');
        return saved ? parseFloat(saved) : 20000000;
    });
    
    const [tempLimitInput, setTempLimitInput] = useState('');

    // --- ENHANCED FILTER STATE ---
    const [timeFilterType, setTimeFilterType] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().substring(0, 10)); // YYYY-MM-DD
    const [filterWeek, setFilterWeek] = useState(`${new Date().getFullYear()}-W${getWeekNumber(new Date())}`); // YYYY-Www
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString()); // YYYY

    const [filterCategory, setFilterCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState(''); 

    // Form State
    const [newDesc, setNewDesc] = useState('');
    const [newAmount, setNewAmount] = useState(''); 
    const [newType, setNewType] = useState<'EXPENSE' | 'ALLOCATION'>('EXPENSE');
    const [newCategory, setNewCategory] = useState('Ads');
    const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));
    const [newTaskId, setNewTaskId] = useState('');
    const [newCampaign, setNewCampaign] = useState(''); 
    
    // Attachment State
    const [attachmentType, setAttachmentType] = useState<'FILE' | 'LINK'>('FILE');
    const [newAttachment, setNewAttachment] = useState('');
    const [uploadFileName, setUploadFileName] = useState('');

    // Task Selector State
    const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
    const [taskSearch, setTaskSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeToBudget((data) => {
            setTransactions(data);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeToLogs((data) => {
            // Filter logs related to BUDGET targetType
            setBudgetLogs(data.filter(log => log.targetType === 'BUDGET'));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTaskDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isSettingsOpen) {
            setTempLimitInput(formatNumberInput(monthlyLimit.toString()));
        }
    }, [isSettingsOpen, monthlyLimit]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatNumberInput = (value: string) => {
        const rawValue = value.replace(/\D/g, '');
        return rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatNumberInput(e.target.value);
        setNewAmount(formatted);
    };

    const handleLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatNumberInput(e.target.value);
        setTempLimitInput(formatted);
    };

    const handleSaveLimit = async () => {
        const rawValue = parseFloat(tempLimitInput.replace(/\./g, ''));
        if (isNaN(rawValue)) return;

        setMonthlyLimit(rawValue);
        localStorage.setItem('fugalo_budget_limit', rawValue.toString());
        setIsSettingsOpen(false);
        await addLogToDB({
            id: Date.now().toString(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: 'CONFIG',
            targetType: 'BUDGET',
            details: `Cập nhật hạn mức ngân sách tháng: ${formatCurrency(rawValue)}`,
            timestamp: new Date().toISOString()
        });
    };

    // --- DERIVED DATA & FILTERS ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
            
            // TIME FILTER LOGIC
            let matchesTime = false;
            
            if (timeFilterType === 'DAY') {
                matchesTime = t.date === filterDate;
            } else if (timeFilterType === 'WEEK') {
                const [year, week] = filterWeek.split('-W').map(Number);
                const { start, end } = getDateRangeOfWeek(week, year);
                // Adjust tDate to compare properly
                const checkDate = new Date(t.date);
                checkDate.setHours(12,0,0,0);
                matchesTime = checkDate >= start && checkDate <= end;
            } else if (timeFilterType === 'MONTH') {
                matchesTime = t.date.startsWith(filterMonth);
            } else if (timeFilterType === 'YEAR') {
                matchesTime = t.date.startsWith(filterYear);
            }

            // Search Logic
            const lowerQuery = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                t.description.toLowerCase().includes(lowerQuery) || 
                (t.campaign && t.campaign.toLowerCase().includes(lowerQuery));

            return matchesCategory && matchesTime && matchesSearch;
        });
    }, [transactions, filterCategory, timeFilterType, filterDate, filterWeek, filterMonth, filterYear, searchQuery]);

    const stats = useMemo(() => {
        // Stats based on current FILTERED view
        const totalAllocation = filteredTransactions.filter(t => t.type === 'ALLOCATION').reduce((acc, t) => acc + t.amount, 0);
        const totalSpent = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
        
        // Calculate Pro-rated Limit based on Time View
        let periodLimit = monthlyLimit;
        if (timeFilterType === 'DAY') periodLimit = monthlyLimit / 30;
        if (timeFilterType === 'WEEK') periodLimit = monthlyLimit / 4;
        if (timeFilterType === 'YEAR') periodLimit = monthlyLimit * 12;

        const percentageUsed = periodLimit > 0 ? Math.min((totalSpent / periodLimit) * 100, 100) : 0;
        const remainingBudget = periodLimit - totalSpent;

        return {
            totalAllocation,
            totalSpent,
            walletBalance: totalAllocation - totalSpent,
            periodLimit,
            remainingBudget,
            percentageUsed,
        };
    }, [filteredTransactions, monthlyLimit, timeFilterType]);

    // ... (Analytics Data Preparation logic remains same) ...
    const analyticsData = useMemo(() => {
        const expenses = filteredTransactions.filter(t => t.type === 'EXPENSE');
        const trendMap: Record<string, number> = {};
        expenses.forEach(t => {
            const day = t.date.slice(5); // MM-DD
            trendMap[day] = (trendMap[day] || 0) + t.amount;
        });
        const trendData = Object.keys(trendMap).sort().reduce((acc: any[], day) => {
            const dailyAmount = trendMap[day];
            const prevTotal = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
            acc.push({ name: day, daily: dailyAmount, cumulative: prevTotal + dailyAmount });
            return acc;
        }, []);
        const campaignMap: Record<string, number> = {};
        expenses.forEach(t => {
            const campaign = t.campaign || 'Chưa phân loại';
            campaignMap[campaign] = (campaignMap[campaign] || 0) + t.amount;
        });
        const campaignData = Object.keys(campaignMap).map(key => ({ name: key, value: campaignMap[key] })).sort((a, b) => b.value - a.value);
        return { trendData, campaignData };
    }, [filteredTransactions]);

    const categoryData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
            data[t.category] = (data[t.category] || 0) + t.amount;
        });
        return Object.keys(data).map(key => ({ name: key, value: data[key] }));
    }, [filteredTransactions]);

    const memberSpendingData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
            data[t.createdBy] = (data[t.createdBy] || 0) + t.amount;
        });
        return Object.keys(data)
            .map(uid => ({ 
                id: uid,
                name: members.find(m => m.id === uid)?.name || 'Unknown', 
                avatar: members.find(m => m.id === uid)?.avatar, 
                value: data[uid] 
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); 
    }, [filteredTransactions, members]);

    const budgetComparisonData = [
        { name: 'Đã chi', value: stats.totalSpent, fill: stats.totalSpent > stats.periodLimit ? '#ef4444' : '#3b82f6' },
        { name: 'Hạn mức', value: stats.periodLimit, fill: '#10b981' }
    ];

    // ... (Helper functions for Task Select, CSV, File Upload, Delete remain same) ...
    const filteredTasksForSelect = useMemo(() => tasks.filter(t => t.status !== 'CANCELLED' && t.title.toLowerCase().includes(taskSearch.toLowerCase())), [tasks, taskSearch]);
    const selectedTaskObj = tasks.find(t => t.id === newTaskId);

    // --- FORM HANDLERS ---
    
    // Reset Form
    const resetForm = () => {
        setNewDesc('');
        setNewAmount('');
        setNewType('EXPENSE');
        setNewCategory('Ads');
        setNewDate(new Date().toISOString().substring(0, 10));
        setNewTaskId('');
        setNewCampaign('');
        setNewAttachment('');
        setUploadFileName('');
        setAttachmentType('FILE');
        setEditingTransaction(null);
    };

    // Open Edit Modal
    const openEditModal = (t: BudgetTransaction) => {
        setEditingTransaction(t);
        setNewDesc(t.description);
        setNewAmount(formatNumberInput(t.amount.toString()));
        setNewType(t.type);
        setNewCategory(t.category);
        setNewDate(t.date);
        setNewTaskId(t.taskId || '');
        setNewCampaign(t.campaign || '');
        setNewAttachment(t.attachmentUrl || '');
        if (t.attachmentUrl && !t.attachmentUrl.startsWith('data:')) {
             setAttachmentType('LINK');
        } else {
             setAttachmentType('FILE');
             setUploadFileName(t.attachmentUrl ? 'Existing Image' : '');
        }
        setIsAddModalOpen(true);
    };

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFileName(file.name);
            try {
                const base64 = await resizeImage(file);
                setNewAttachment(base64);
            } catch (err) {
                console.error("Error processing image", err);
                alert("Lỗi xử lý ảnh.");
            }
        }
    };

    // Handle Form Submit
    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amountVal = parseFloat(newAmount.replace(/\./g, ''));
        if (isNaN(amountVal) || amountVal <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ');
            return;
        }
        if (!newDesc.trim()) {
            alert('Vui lòng nhập nội dung');
            return;
        }

        const transactionData: BudgetTransaction = {
            id: editingTransaction ? editingTransaction.id : Date.now().toString(),
            description: newDesc,
            amount: amountVal,
            type: newType,
            category: newCategory as any,
            date: newDate,
            createdBy: currentUser.id,
            taskId: newTaskId || undefined,
            attachmentUrl: newAttachment || undefined,
            campaign: newCampaign || undefined
        };

        try {
            if (editingTransaction) {
                await updateBudgetTransactionInDB(transactionData);
                await addLogToDB({
                    id: Date.now().toString(),
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    action: 'UPDATE',
                    targetType: 'BUDGET',
                    targetId: transactionData.id,
                    details: `Cập nhật giao dịch: ${transactionData.description}`,
                    timestamp: new Date().toISOString()
                });
            } else {
                await addBudgetTransactionToDB(transactionData);
                await addLogToDB({
                    id: Date.now().toString(),
                    actorId: currentUser.id,
                    actorName: currentUser.name,
                    action: 'CREATE',
                    targetType: 'BUDGET',
                    targetId: transactionData.id,
                    details: `Tạo giao dịch mới: ${transactionData.description} (${formatCurrency(transactionData.amount)})`,
                    timestamp: new Date().toISOString()
                });
            }
            setIsAddModalOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            alert('Có lỗi xảy ra khi lưu giao dịch.');
        }
    };

    const handleExportCSV = () => { 
        const headers = ["ID", "Date", "Type", "Category", "Description", "Amount", "Campaign", "TaskID", "CreatedBy"];
        const rows = filteredTransactions.map(t => [
            t.id, 
            t.date, 
            t.type, 
            t.category, 
            `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
            t.amount,
            t.campaign || "",
            t.taskId || "",
            t.createdBy
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `budget_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleQuickAllocate = async () => { 
        if(window.confirm(`Xác nhận cấp vốn nhanh ${formatCurrency(monthlyLimit)} cho tháng hiện tại?`)) {
             const transactionData: BudgetTransaction = {
                id: Date.now().toString(),
                description: `Cấp vốn tháng ${new Date().getMonth() + 1}`,
                amount: monthlyLimit,
                type: 'ALLOCATION',
                category: 'Other',
                date: new Date().toISOString().substring(0, 10),
                createdBy: currentUser.id,
            };
            await addBudgetTransactionToDB(transactionData);
            await addLogToDB({
                id: Date.now().toString(),
                actorId: currentUser.id,
                actorName: currentUser.name,
                action: 'CREATE',
                targetType: 'BUDGET',
                targetId: transactionData.id,
                details: `Cấp vốn nhanh: ${transactionData.description}`,
                timestamp: new Date().toISOString()
            });
        }
    };
    
    const handleDelete = async (id: string) => { 
        if (window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) {
            await deleteBudgetTransactionFromDB(id);
            await addLogToDB({
                id: Date.now().toString(),
                actorId: currentUser.id,
                actorName: currentUser.name,
                action: 'DELETE',
                targetType: 'BUDGET',
                targetId: id,
                details: "Xóa giao dịch ngân sách",
                timestamp: new Date().toISOString()
            });
        }
    };
    
    const handleAnalyzeBudget = async () => { 
        setIsAnalyzing(true);
        const analysis = await analyzeBudget(filteredTransactions, monthlyLimit, filterMonth);
        setAiAnalysis(analysis);
        setIsAnalyzing(false);
    };

    return (
        <div className="h-full flex flex-col animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Wallet size={24} className="mr-2 text-green-600" />
                        Quản lý Ngân sách Marketing
                    </h2>
                    <p className="text-sm text-slate-500">Theo dõi dòng tiền và hạn mức chi tiêu.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center transition-all text-sm font-bold shadow-sm ${isSettingsOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                    >
                        <Settings size={18} className="mr-2" /> Thiết lập hạn mức
                    </button>
                    <button 
                        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transition-all text-sm font-bold"
                    >
                        <Plus size={18} className="mr-2" /> Giao dịch mới
                    </button>
                </div>
            </div>

            {/* Config Panel (Professional Redesign) */}
            {isSettingsOpen && (
                <div className="bg-slate-900 text-white p-6 rounded-2xl mb-8 shadow-2xl border border-slate-700 relative overflow-hidden animate-fade-in">
                    <div className="absolute -right-10 -top-10 text-slate-700 opacity-20 transform rotate-12 pointer-events-none">
                        <CreditCard size={200} />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1">
                            <h3 className="text-xl font-bold flex items-center text-blue-400 mb-2">
                                <ShieldCheck size={24} className="mr-2"/> Cấu hình Hạn mức Tài chính (Monthly Cap)
                            </h3>
                            <p className="text-slate-400 text-sm mb-4 leading-relaxed max-w-xl">
                                Thiết lập "trần ngân sách" cho bộ phận Marketing. 
                                Con số này được dùng để tính toán tỷ lệ chi tiêu (Burn Rate) và cảnh báo khi vượt ngưỡng.
                                <br/><span className="text-xs text-slate-500 italic">*Lưu ý: Thay đổi này áp dụng cho toàn bộ hệ thống báo cáo.</span>
                            </p>
                            
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-800/50 p-2 rounded w-fit">
                                <Lock size={12}/> Secure Configuration
                            </div>
                        </div>

                        <div className="bg-slate-800 p-5 rounded-xl border border-slate-600 w-full md:w-auto min-w-[300px] shadow-lg">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">Hạn mức tháng (VND)</label>
                            <div className="relative mb-4">
                                <input 
                                    type="text" 
                                    value={tempLimitInput}
                                    onChange={handleLimitInputChange}
                                    className="w-full bg-slate-900 border border-slate-600 text-white text-2xl font-bold px-4 py-3 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right pr-12 font-mono"
                                    placeholder="20.000.000"
                                />
                                <span className="absolute right-4 top-4 text-slate-500 font-bold">₫</span>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={handleSaveLimit}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 flex items-center"
                                >
                                    <CheckCircle2 size={16} className="mr-2"/> Lưu thiết lập
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Budget Control Center */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-50 to-blue-50 rounded-full blur-3xl opacity-50 -z-10 transform translate-x-1/2 -translate-y-1/2"></div>

                <div className="flex flex-col lg:flex-row gap-8 items-center">
                    {/* Left: Progress Circle & Main Stats */}
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 flex items-center">
                                    <Zap size={20} className="mr-2 text-yellow-500" /> 
                                    {timeFilterType === 'DAY' ? 'Hiệu suất hôm nay' : 
                                     timeFilterType === 'WEEK' ? 'Hiệu suất tuần này' : 
                                     timeFilterType === 'YEAR' ? 'Hiệu suất năm nay' : 
                                     `Hiệu suất tháng ${filterMonth}`}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">So sánh thực chi với hạn mức quy định.</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5 tracking-wide">Hạn mức quy định (Cap)</div>
                                <div className="text-xl font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 inline-block">
                                    {formatCurrency(stats.periodLimit)}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative pt-6 pb-2">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-600 flex items-center">
                                    Đã chi: <span className="text-slate-900 ml-1 text-sm">{formatCurrency(stats.totalSpent)}</span>
                                </span>
                                <span className={stats.remainingBudget < 0 ? 'text-red-600' : 'text-blue-600'}>
                                    {stats.remainingBudget < 0 ? 'Vượt mức: ' : 'Khả dụng: '} 
                                    <span className="text-sm">{formatCurrency(Math.abs(stats.remainingBudget))}</span>
                                </span>
                            </div>
                            <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative border border-slate-200">
                                <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-red-400/30 z-10 border-l border-dashed border-red-400" title="80% Warning Threshold"></div>
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 relative ${
                                        stats.percentageUsed > 100 ? 'bg-red-500' : 
                                        stats.percentageUsed > 80 ? 'bg-orange-500' : 'bg-green-500'
                                    }`} 
                                    style={{width: `${Math.min(stats.percentageUsed, 100)}%`}}
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.2)_50%,rgba(255,255,255,.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-50"></div>
                                </div>
                            </div>
                            {stats.percentageUsed > 100 && (
                                <div className="flex items-center text-xs text-red-600 font-bold mt-2 animate-pulse bg-red-50 p-2 rounded border border-red-100">
                                    <AlertTriangle size={14} className="mr-2"/> 
                                    CẢNH BÁO: Đã vượt quá ngân sách {formatCurrency(Math.abs(stats.remainingBudget))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px h-24 bg-slate-200 mx-4"></div>

                    {/* Right: Balance & Allocation */}
                    <div className="flex-1 w-full">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between h-full">
                                <div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Dòng tiền vào (Allocated)</p>
                                    <p className="text-xl font-black text-green-600">
                                        +{formatCurrency(stats.totalAllocation)}
                                    </p>
                                </div>
                                {timeFilterType === 'MONTH' && stats.totalAllocation === 0 && (
                                    <button 
                                        onClick={handleQuickAllocate}
                                        className="mt-3 text-xs flex items-center justify-center bg-white border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors font-bold shadow-sm"
                                    >
                                        <Plus size={12} className="mr-1"/> Cấp vốn {formatCurrency(monthlyLimit)}
                                    </button>
                                )}
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between h-full">
                                <div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Thực chi (Spent)</p>
                                    <p className="text-xl font-black text-red-600">
                                        -{formatCurrency(stats.totalSpent)}
                                    </p>
                                </div>
                                <div className="text-[10px] text-slate-400 text-right mt-2">
                                    {stats.percentageUsed.toFixed(1)}% hạn mức
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIEW MODE TABS */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-4 w-fit self-start">
                <button
                    onClick={() => setViewMode('TRANSACTIONS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${
                        viewMode === 'TRANSACTIONS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <List size={16} className="mr-2" /> Sổ giao dịch
                </button>
                <button
                    onClick={() => setViewMode('ANALYTICS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${
                        viewMode === 'ANALYTICS' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <LayoutDashboard size={16} className="mr-2" /> Phân tích & AI
                </button>
                <button
                    onClick={() => setViewMode('HISTORY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${
                        viewMode === 'HISTORY' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <History size={16} className="mr-2" /> Nhật ký (Audit)
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                
                {/* --- TRANSACTIONS VIEW --- */}
                {viewMode === 'TRANSACTIONS' && (
                    <>
                        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                            {/* Filters & Search */}
                            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 bg-slate-50 items-center">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-2 text-slate-400" size={16}/>
                                    <input 
                                        type="text" 
                                        placeholder="Tìm khoản chi, chiến dịch..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                {/* TIME FILTER TABS */}
                                <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg">
                                    <button onClick={() => setTimeFilterType('DAY')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'DAY' ? 'bg-slate-100 text-blue-600' : 'text-slate-500'}`}>Ngày</button>
                                    <button onClick={() => setTimeFilterType('WEEK')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'WEEK' ? 'bg-slate-100 text-blue-600' : 'text-slate-500'}`}>Tuần</button>
                                    <button onClick={() => setTimeFilterType('MONTH')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'MONTH' ? 'bg-slate-100 text-blue-600' : 'text-slate-500'}`}>Tháng</button>
                                    <button onClick={() => setTimeFilterType('YEAR')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilterType === 'YEAR' ? 'bg-slate-100 text-blue-600' : 'text-slate-500'}`}>Năm</button>
                                </div>

                                {/* DYNAMIC DATE INPUT */}
                                <div className="min-w-[150px]">
                                    {timeFilterType === 'DAY' && (
                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                                            <button onClick={() => {const d = new Date(filterDate); d.setDate(d.getDate()-1); setFilterDate(d.toISOString().split('T')[0])}} className="p-1 hover:bg-slate-50 text-slate-500"><ChevronLeft size={16}/></button>
                                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-xs font-bold border-none outline-none text-center w-24"/>
                                            <button onClick={() => {const d = new Date(filterDate); d.setDate(d.getDate()+1); setFilterDate(d.toISOString().split('T')[0])}} className="p-1 hover:bg-slate-50 text-slate-500"><ChevronRight size={16}/></button>
                                        </div>
                                    )}
                                    {timeFilterType === 'WEEK' && (
                                        <input type="week" value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none w-full"/>
                                    )}
                                    {timeFilterType === 'MONTH' && (
                                        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none w-full"/>
                                    )}
                                    {timeFilterType === 'YEAR' && (
                                        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none w-full">
                                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    )}
                                </div>

                                <select 
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                    <option value="ALL">Tất cả danh mục</option>
                                    <option value="Ads">Quảng cáo (Ads)</option>
                                    <option value="Production">Sản xuất (Production)</option>
                                    <option value="Tools">Công cụ (Tools)</option>
                                    <option value="Seeding">Seeding</option>
                                    <option value="Event">Sự kiện</option>
                                    <option value="Other">Khác</option>
                                </select>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                {filteredTransactions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 italic text-sm">
                                        Không tìm thấy giao dịch nào.
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="text-xs text-slate-500 font-bold uppercase bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3">Ngày</th>
                                                <th className="p-3">Nội dung</th>
                                                <th className="p-3">Danh mục</th>
                                                <th className="p-3">Chiến dịch</th>
                                                <th className="p-3 text-right">Số tiền</th>
                                                <th className="p-3 w-16 text-center">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-slate-100">
                                            {filteredTransactions.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 group">
                                                    <td className="p-3 text-slate-500 font-mono text-xs whitespace-nowrap">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                                    <td className="p-3 font-medium text-slate-700">
                                                        <div className="flex items-center gap-2">
                                                            {t.description}
                                                            {t.attachmentUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (t.attachmentUrl?.startsWith('http') && !t.attachmentUrl.startsWith('data:')) {
                                                                            window.open(t.attachmentUrl, '_blank');
                                                                        } else {
                                                                            setViewingAttachment(t.attachmentUrl || null);
                                                                        }
                                                                    }}
                                                                    className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded transition-colors"
                                                                    title="Xem chứng từ/ảnh"
                                                                >
                                                                    <Paperclip size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {t.taskId && <span className="mt-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold flex items-center inline-flex w-fit"><LinkIcon size={8} className="mr-1"/> Task</span>}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${t.category === 'Ads' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {t.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        {t.campaign && (
                                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-semibold border border-indigo-100">
                                                                {t.campaign}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className={`p-3 text-right font-bold ${t.type === 'ALLOCATION' ? 'text-green-600' : 'text-slate-800'}`}>
                                                        {t.type === 'ALLOCATION' ? '+' : '-'}{formatCurrency(t.amount)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => openEditModal(t)}
                                                                className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Pencil size={14}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(t.id)} 
                                                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Right: Enhanced Sidebar with Tabs */}
                        <div className="w-full lg:w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-fit overflow-hidden">
                            {/* Toggle Header */}
                            <div className="flex border-b border-slate-100">
                                <button
                                    onClick={() => setChartView('LIMIT')}
                                    className={`flex-1 py-3 text-xs font-bold transition-all ${chartView === 'LIMIT' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <BarChart3 size={14} className="inline mr-1"/> Ngân sách
                                </button>
                                <button
                                    onClick={() => setChartView('CATEGORY')}
                                    className={`flex-1 py-3 text-xs font-bold transition-all ${chartView === 'CATEGORY' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <PieChartIcon size={14} className="inline mr-1"/> Danh mục
                                </button>
                            </div>

                            <div className="p-4">
                                {chartView === 'LIMIT' ? (
                                    <>
                                        <h3 className="font-bold text-slate-800 mb-4 flex items-center text-sm">
                                            Ngân sách vs Thực chi
                                        </h3>
                                        <div className="h-48 w-full mb-6">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={budgetComparisonData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 11, fontWeight: 'bold'}} />
                                                    <Tooltip formatter={(value) => formatCurrency(value as number)} cursor={{fill: 'transparent'}} />
                                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} label={{ position: 'right', fill: '#64748b', fontSize: 10, formatter: (val: number) => (val/1000000).toFixed(1) + 'M' }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        
                                        {/* Top Spenders List */}
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-xs uppercase mb-3 flex items-center">
                                                <Users size={14} className="mr-1.5"/> Top chi tiêu
                                            </h4>
                                            <div className="space-y-3">
                                                {memberSpendingData.map((item, idx) => (
                                                    <div key={item.id} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                                {item.avatar ? <img src={item.avatar} className="w-full h-full object-cover"/> : <span className="text-[9px] font-bold">{item.name.charAt(0)}</span>}
                                                            </div>
                                                            <span className="text-xs font-medium text-slate-700 truncate max-w-[100px]">{item.name}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mr-2">
                                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.value / stats.totalSpent) * 100}%` }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-800">{formatCurrency(item.value)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {memberSpendingData.length === 0 && <p className="text-xs text-slate-400 italic">Chưa có dữ liệu chi tiêu.</p>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="font-bold text-slate-800 mb-2 flex items-center text-sm">
                                            Cơ cấu chi tiêu
                                        </h3>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={categoryData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {categoryData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => formatCurrency(value as number)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                                    <Legend wrapperStyle={{fontSize: '11px'}} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {categoryData.length === 0 && <p className="text-center text-xs text-slate-400 -mt-32">Chưa có dữ liệu chi tiêu</p>}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* --- ANALYTICS VIEW --- */}
                {viewMode === 'ANALYTICS' && (
                    <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-2">
                        {/* 1. Spending Trend Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                                <TrendingUp size={20} className="mr-2 text-blue-600"/> Xu hướng chi tiêu (Tích lũy theo ngày)
                            </h3>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analyticsData.trendData}>
                                        <defs>
                                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                        <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. Campaign Breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                                    <Target size={20} className="mr-2 text-indigo-600"/> Chi phí theo Chiến dịch
                                </h3>
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analyticsData.campaignData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                                            <Tooltip formatter={(value) => formatCurrency(value as number)} cursor={{fill: 'transparent'}} />
                                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                                {analyticsData.campaignData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 3. AI Budget Advisor */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-indigo-900 flex items-center text-lg">
                                        <Sparkles size={24} className="mr-2 text-purple-600"/> Cố vấn Tài chính AI
                                    </h3>
                                    {!isAnalyzing && (
                                        <button 
                                            onClick={handleAnalyzeBudget}
                                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-50 transition-colors border border-indigo-200"
                                        >
                                            Phân tích ngay
                                        </button>
                                    )}
                                </div>
                                
                                <div className="flex-1 bg-white/60 rounded-xl p-4 border border-indigo-100 overflow-y-auto custom-scrollbar relative">
                                    {isAnalyzing ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-400">
                                            <Sparkles size={32} className="animate-spin mb-2"/>
                                            <span className="text-sm font-medium animate-pulse">Đang phân tích dữ liệu...</span>
                                        </div>
                                    ) : aiAnalysis ? (
                                        <div className="prose prose-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                            {aiAnalysis}
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-400 py-10 italic text-sm">
                                            Nhấn "Phân tích ngay" để nhận đánh giá chi tiết về tình hình tài chính và đề xuất tối ưu hóa từ AI.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- HISTORY VIEW (AUDIT LOG) --- */}
                {viewMode === 'HISTORY' && (
                    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-orange-600"/>
                                <h3 className="font-bold text-slate-800 text-sm">Lịch sử thay đổi Ngân sách</h3>
                            </div>
                            <span className="text-xs text-slate-500">{budgetLogs.length} bản ghi</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {budgetLogs.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 italic text-sm">
                                    Chưa có dữ liệu lịch sử nào.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                                        <tr>
                                            <th className="p-4 w-40">Thời gian</th>
                                            <th className="p-4 w-40">Người thực hiện</th>
                                            <th className="p-4 w-24 text-center">Hành động</th>
                                            <th className="p-4">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm">
                                        {budgetLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-slate-500 text-xs font-mono whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                                                </td>
                                                <td className="p-4 font-medium text-slate-700">
                                                    {log.actorName}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                                                        log.action === 'CREATE' ? 'bg-green-100 text-green-700' : 
                                                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-600">
                                                    {log.details}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center">
                                <Wallet className="mr-2 text-blue-600" size={24}/>
                                {editingTransaction ? 'Chỉnh sửa giao dịch' : (newType === 'EXPENSE' ? 'Ghi nhận chi tiêu' : 'Thêm nguồn vốn')}
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"><X size={24}/></button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                            {/* ... (Existing form content unchanged) ... */}
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button 
                                    type="button" 
                                    onClick={() => setNewType('EXPENSE')} 
                                    className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${newType === 'EXPENSE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <TrendingDown size={18} className="mr-2"/> Chi phí (Expense)
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setNewType('ALLOCATION')} 
                                    className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${newType === 'ALLOCATION' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <TrendingUp size={18} className="mr-2"/> Cấp vốn (Income)
                                </button>
                            </div>

                            <div className="relative group">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Số tiền (VND)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        required
                                        autoFocus
                                        value={newAmount}
                                        onChange={handleAmountChange}
                                        className="w-full text-4xl font-black text-slate-800 border-b-2 border-slate-200 py-2 focus:border-blue-500 outline-none bg-transparent pl-8 transition-colors placeholder:text-slate-200"
                                        placeholder="0"
                                    />
                                    <span className="absolute left-0 top-3 text-2xl text-slate-400 font-light">₫</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Thời gian</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Danh mục</label>
                                        <div className="relative">
                                            <select 
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 appearance-none font-medium text-slate-700"
                                            >
                                                <option value="Ads">📢 Quảng cáo (Ads)</option>
                                                <option value="Production">🎬 Sản xuất (Production)</option>
                                                <option value="Tools">💻 Công cụ & Phần mềm</option>
                                                <option value="Seeding">💬 Seeding</option>
                                                <option value="Event">🎉 Sự kiện / Offline</option>
                                                <option value="Other">📦 Khác</option>
                                            </select>
                                            <Grid size={16} className="absolute right-4 top-4 text-slate-400 pointer-events-none"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Chiến dịch / Dự án</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={newCampaign}
                                                onChange={(e) => setNewCampaign(e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                                placeholder="VD: Tết 2024, Black Friday..."
                                                list="campaign-suggestions"
                                            />
                                            <Target size={16} className="absolute right-4 top-4 text-slate-400 pointer-events-none"/>
                                            <datalist id="campaign-suggestions">
                                                <option value="Tết 2024"/>
                                                <option value="Mùa Hè Xanh"/>
                                                <option value="Back to School"/>
                                            </datalist>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nội dung chi tiết</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                            placeholder="VD: Thanh toán tiền chạy ads FB..."
                                        />
                                    </div>

                                    <div className="relative" ref={dropdownRef}>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Liên kết công việc (Optional)</label>
                                        <div 
                                            onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
                                            className={`w-full border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors bg-slate-50 ${isTaskDropdownOpen ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-blue-400'}`}
                                        >
                                            {selectedTaskObj ? (
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <div className="bg-blue-100 p-1 rounded-md text-blue-600"><Briefcase size={14}/></div>
                                                    <span className="text-sm font-bold text-slate-700 truncate">{selectedTaskObj.title}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-400 flex items-center">Chọn công việc...</span>
                                            )}
                                            
                                            {selectedTaskObj ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setNewTaskId(''); }}
                                                    className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500"
                                                >
                                                    <X size={14}/>
                                                </button>
                                            ) : (
                                                <ArrowRight size={14} className="text-slate-400 rotate-90"/>
                                            )}
                                        </div>

                                        {isTaskDropdownOpen && (
                                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-fade-in">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14}/>
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            placeholder="Tìm kiếm công việc..."
                                                            value={taskSearch}
                                                            onChange={(e) => setTaskSearch(e.target.value)}
                                                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-400"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                                                    {filteredTasksForSelect.map(t => (
                                                        <div 
                                                            key={t.id}
                                                            onClick={() => { setNewTaskId(t.id); setIsTaskDropdownOpen(false); }}
                                                            className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-sm transition-colors ${newTaskId === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                        >
                                                            <span className="truncate font-medium flex-1">{t.title}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 whitespace-nowrap ${
                                                                t.status === 'DONE' ? 'bg-green-100 text-green-700' : 
                                                                t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                                            }`}>{t.status}</span>
                                                        </div>
                                                    ))}
                                                    {filteredTasksForSelect.length === 0 && (
                                                        <div className="text-center py-4 text-xs text-slate-400">Không tìm thấy công việc phù hợp</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex gap-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            <button
                                                type="button"
                                                onClick={() => { setAttachmentType('FILE'); setNewAttachment(''); }}
                                                className={`transition-colors ${attachmentType === 'FILE' ? 'text-blue-600' : 'hover:text-slate-700'}`}
                                            >
                                                Upload Ảnh
                                            </button>
                                            <span>/</span>
                                            <button
                                                type="button"
                                                onClick={() => { setAttachmentType('LINK'); setNewAttachment(''); }}
                                                className={`transition-colors ${attachmentType === 'LINK' ? 'text-blue-600' : 'hover:text-slate-700'}`}
                                            >
                                                Link Drive
                                            </button>
                                        </div>
                                        
                                        {attachmentType === 'FILE' ? (
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-white transition-colors relative cursor-pointer group bg-white/50">
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                                    <Upload size={16} className="mr-2" />
                                                    <span className="text-xs font-medium truncate max-w-[150px]">
                                                        {uploadFileName || "Chọn ảnh hóa đơn"}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input 
                                                    type="url" 
                                                    value={newAttachment}
                                                    onChange={(e) => setNewAttachment(e.target.value)}
                                                    placeholder="https://drive.google.com/..."
                                                    className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                />
                                                <LinkIcon size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button 
                                    type="submit"
                                    className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center ${newType === 'EXPENSE' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-green-600 hover:bg-green-700'}`}
                                >
                                    <CheckCircle2 size={20} className="mr-2" /> {editingTransaction ? 'Cập nhật' : 'Lưu giao dịch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ATTACHMENT VIEW MODAL */}
            {viewingAttachment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setViewingAttachment(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setViewingAttachment(null)}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors z-10"
                        >
                            <X size={20} />
                        </button>
                        <img src={viewingAttachment} alt="Attachment Preview" className="max-w-full max-h-[85vh] object-contain rounded-md" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetManager;
