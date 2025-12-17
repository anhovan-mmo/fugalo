
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Radio, Megaphone, CheckCircle2, AlertTriangle, AlertCircle, Info, X, Save, 
    ArrowRight, Monitor, Clock, CalendarClock, List, Plus, Trash2, Edit3, 
    Zap, PlayCircle, StopCircle, Timer, RefreshCw, LayoutTemplate, Target, Eye, Loader2,
    MessageSquare, Maximize2, Layout, Users
} from 'lucide-react';
import { View, TopBannerConfig, Member, SystemConfig, Role, Department } from '../types';
import { updateSystemConfigInDB, subscribeToSystemConfig } from '../services/firebase';

interface BroadcastManagerProps {
    currentUser: Member;
}

// --- CONSTANTS ---
const PRESETS = [
    { id: 'p1', name: 'Bảo trì hệ thống (Modal)', content: 'Hệ thống sẽ bảo trì nâng cấp trong 15 phút tới. Vui lòng lưu công việc.', type: 'WARNING', displayMode: 'MODAL' },
    { id: 'p2', name: 'Họp khẩn (Banner)', content: 'Yêu cầu toàn bộ nhân sự tập trung tại phòng họp lớn ngay lập tức.', type: 'ERROR', displayMode: 'BANNER' },
    { id: 'p3', name: 'Chúc mừng (Banner)', content: 'Chúc mừng team Sale đã đạt KPI tháng này! 🎉', type: 'SUCCESS', displayMode: 'BANNER' },
    { id: 'p4', name: 'Thông báo nghỉ (Modal)', content: 'Công ty sẽ nghỉ lễ vào ngày mai. Chúc mọi người kỳ nghỉ vui vẻ.', type: 'INFO', displayMode: 'MODAL' },
];

// Helper: Format DateTime for Input (YYYY-MM-DDTHH:mm)
const toInputDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
};

// Helper: Format Display Date
const formatDisplayDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('vi-VN', { 
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
    });
};

const BroadcastManager: React.FC<BroadcastManagerProps> = ({ currentUser }) => {
    // --- MAIN CONFIG STATE (Single Source of Truth) ---
    const [fullConfig, setFullConfig] = useState<SystemConfig | null>(null);
    
    // Derived state for templates to avoid desync
    const templates = useMemo(() => fullConfig?.broadcastTemplates || [], [fullConfig]);
    
    // --- UI STATE ---
    const [activeTemplateId, setActiveTemplateId] = useState<string | 'NEW'>('NEW');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'CONTENT' | 'TARGET' | 'PREVIEW'>('CONTENT');

    // --- FORM STATE ---
    const [formName, setFormName] = useState('Thông báo mới');
    const [formContent, setFormContent] = useState('');
    const [formType, setFormType] = useState<'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'>('INFO');
    const [formDisplayMode, setFormDisplayMode] = useState<'BANNER' | 'MODAL'>('BANNER');
    const [formActionLabel, setFormActionLabel] = useState('');
    const [formTargetView, setFormTargetView] = useState<View | ''>('');
    const [formVisibleFrom, setFormVisibleFrom] = useState('');
    const [formVisibleUntil, setFormVisibleUntil] = useState('');
    
    // TARGETING STATE
    const [formTargetRoles, setFormTargetRoles] = useState<Role[]>([]);
    const [formTargetDepts, setFormTargetDepts] = useState<Department[]>([]);
    const [formDisplayViews, setFormDisplayViews] = useState<View[]>([]);

    useEffect(() => {
        // Only update from subscription if we are NOT currently processing a save/delete
        const unsubscribe = subscribeToSystemConfig((config) => {
            if (!isProcessing) {
                setFullConfig(config);
            }
        });
        
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [isProcessing]);

    // --- ALGORITHM: CALCULATE SMART STATUS ---
    const getBroadcastStatus = (banner: TopBannerConfig | undefined) => {
        if (!banner || !banner.enabled) return 'IDLE'; 
        const now = currentTime.getTime();
        const start = banner.visibleFrom ? new Date(banner.visibleFrom).getTime() : 0;
        const end = banner.visibleUntil ? new Date(banner.visibleUntil).getTime() : Infinity;

        if (now < start) return 'SCHEDULED';
        if (now > end) return 'EXPIRED';    
        return 'LIVE';                      
    };

    const activeLiveBanner = fullConfig?.topBanner;
    const currentStatus = getBroadcastStatus(activeLiveBanner);

    // --- ACTIONS ---

    const loadTemplate = (template: TopBannerConfig | 'NEW', isPreset = false) => {
        if (template === 'NEW') {
            setActiveTemplateId('NEW');
            setFormName('Thông báo mới');
            setFormContent('');
            setFormType('INFO');
            setFormDisplayMode('BANNER');
            setFormActionLabel('');
            setFormTargetView('');
            setFormVisibleFrom('');
            setFormVisibleUntil('');
            setFormTargetRoles([]);
            setFormTargetDepts([]);
            setFormDisplayViews([]);
        } else {
            setActiveTemplateId(isPreset ? 'NEW' : (template.id || 'NEW')); 
            setFormName(isPreset ? template.name || 'Mẫu mới' : template.name || 'Bản nháp');
            setFormContent(template.content);
            setFormType(template.type);
            setFormDisplayMode(template.displayMode || 'BANNER');
            setFormActionLabel(template.actionLabel || '');
            setFormTargetView(template.targetView || '');
            setFormVisibleFrom(template.visibleFrom ? toInputDateTime(template.visibleFrom) : '');
            setFormVisibleUntil(template.visibleUntil ? toInputDateTime(template.visibleUntil) : '');
            setFormTargetRoles(template.targetRoles || []);
            setFormTargetDepts(template.targetDepartments || []);
            setFormDisplayViews(template.displayOnViews || []);
        }
        setActiveTab('CONTENT'); // Reset to first tab
    };

    const handleSaveTemplate = async (showFeedback = true) => {
        if (!fullConfig) return;
        if (!formContent.trim()) { alert("Nội dung không được để trống"); return; }
        
        setIsProcessing(true);
        try {
            const isoVisibleFrom = formVisibleFrom ? new Date(formVisibleFrom).toISOString() : undefined;
            const isoVisibleUntil = formVisibleUntil ? new Date(formVisibleUntil).toISOString() : undefined;

            const newTemplate: TopBannerConfig = {
                id: activeTemplateId === 'NEW' ? Date.now().toString() : activeTemplateId,
                name: formName,
                enabled: false,
                content: formContent,
                type: formType,
                displayMode: formDisplayMode,
                actionLabel: formActionLabel,
                targetView: formTargetView as View,
                visibleFrom: isoVisibleFrom,
                visibleUntil: isoVisibleUntil,
                targetRoles: formTargetRoles,
                targetDepartments: formTargetDepts,
                displayOnViews: formDisplayViews
            };

            // Update List
            let updatedTemplates = [...templates];
            const existingIndex = updatedTemplates.findIndex(t => t.id === newTemplate.id);
            if (existingIndex >= 0) {
                updatedTemplates[existingIndex] = newTemplate;
            } else {
                updatedTemplates.push(newTemplate);
            }

            const newConfig = {
                ...fullConfig,
                broadcastTemplates: updatedTemplates
            };

            // Optimistic UI Update
            setFullConfig(newConfig); 
            if (activeTemplateId === 'NEW') setActiveTemplateId(newTemplate.id!);

            // Sync to DB
            await updateSystemConfigInDB(newConfig);
            
            if (showFeedback) alert("Đã lưu bản nháp vào thư viện!");
        } catch (e) {
            console.error(e);
            if (showFeedback) alert("Lỗi khi lưu.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePublish = async () => {
        if (!fullConfig) return;
        if (!formContent.trim()) { alert("Nội dung trống!"); return; }

        let warningMsg = "";
        if (currentStatus === 'LIVE') {
            warningMsg = "⚠️ Đang có thông báo CHẠY TRỰC TIẾP.\nXuất bản tin mới sẽ thay thế tin hiện tại ngay lập tức.\n";
        } else if (currentStatus === 'SCHEDULED') {
            warningMsg = "⚠️ Đang có thông báo CHỜ LÊN SÓNG.\nXuất bản tin mới sẽ hủy lịch của tin đang chờ.\n";
        }

        if (!window.confirm(`${warningMsg}\nXác nhận XUẤT BẢN thông báo này?`)) return;

        setIsProcessing(true);
        try {
            const isoVisibleFrom = formVisibleFrom ? new Date(formVisibleFrom).toISOString() : undefined;
            const isoVisibleUntil = formVisibleUntil ? new Date(formVisibleUntil).toISOString() : undefined;

            const liveConfig: TopBannerConfig = {
                id: 'LIVE', 
                name: 'LIVE_BANNER',
                enabled: true, // Master Switch ON
                content: formContent,
                type: formType,
                displayMode: formDisplayMode,
                actionLabel: formActionLabel,
                targetView: formTargetView as View,
                visibleFrom: isoVisibleFrom,
                visibleUntil: isoVisibleUntil,
                targetRoles: formTargetRoles,
                targetDepartments: formTargetDepts,
                displayOnViews: formDisplayViews
            };

            // Auto-save as draft as well
            let updatedTemplates = [...templates];
            if (activeTemplateId !== 'NEW') {
                const idx = updatedTemplates.findIndex(t => t.id === activeTemplateId);
                if (idx >= 0) updatedTemplates[idx] = { ...liveConfig, id: activeTemplateId, enabled: false };
            } else {
                updatedTemplates.push({ ...liveConfig, id: Date.now().toString(), enabled: false });
            }

            const newConfig = {
                ...fullConfig,
                broadcastTemplates: updatedTemplates,
                topBanner: liveConfig
            };

            // Optimistic Update
            setFullConfig(newConfig);

            // DB Update
            await updateSystemConfigInDB(newConfig);

            alert("Đã xuất bản thành công! Thông báo đang chạy.");
        } catch (e) {
            console.error(e);
            alert("Lỗi khi xuất bản.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStopLive = async () => {
        if (!fullConfig) return;
        if (!window.confirm("Dừng phát và gỡ bỏ thông báo khỏi màn hình của toàn bộ nhân viên?")) return;
        
        setIsProcessing(true);
        try {
            const stoppedBanner: TopBannerConfig = { 
                ...(fullConfig.topBanner || { content: '', type: 'INFO' }), 
                enabled: false,
                content: fullConfig.topBanner?.content || '', 
                type: fullConfig.topBanner?.type || 'INFO'
            };

            const newConfig = { ...fullConfig, topBanner: stoppedBanner };
            
            // 1. Optimistic Update
            setFullConfig(newConfig);

            // 2. DB Update
            await updateSystemConfigInDB(newConfig);
        } catch (error) {
            console.error("Error stopping broadcast:", error);
            alert("Lỗi khi dừng phát.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!fullConfig) return;
        if (!window.confirm("Bạn có chắc chắn muốn xóa bản nháp này?")) return;

        setIsProcessing(true);
        try {
            // 1. Calculate new state
            const updatedTemplates = templates.filter(t => t.id !== id);
            const newConfig = { ...fullConfig, broadcastTemplates: updatedTemplates };

            // 2. Optimistic UI Update
            setFullConfig(newConfig); 

            // 3. DB Update
            await updateSystemConfigInDB(newConfig);
            
            // If deleting the currently active item, reset form
            if (activeTemplateId === id) {
                loadTemplate('NEW');
            }
        } catch (err) {
            console.error("Delete failed", err);
            alert("Lỗi khi xóa bản nháp.");
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleArrayItem = <T,>(item: T, list: T[], setList: (l: T[]) => void) => {
        if (list.includes(item)) setList(list.filter(i => i !== item));
        else setList([...list, item]);
    };

    // --- RENDER HELPERS ---
    
    const getStatusBadge = () => {
        switch (currentStatus) {
            case 'LIVE': return <span className="flex items-center text-green-600 bg-green-100 px-3 py-1 rounded-full text-xs font-bold border border-green-200 animate-pulse"><Radio size={14} className="mr-1.5"/> ĐANG PHÁT SÓNG</span>;
            case 'SCHEDULED': return <span className="flex items-center text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-xs font-bold border border-blue-200"><CalendarClock size={14} className="mr-1.5"/> ĐANG CHỜ LỊCH</span>;
            case 'EXPIRED': return <span className="flex items-center text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold border border-slate-200"><Clock size={14} className="mr-1.5"/> ĐÃ KẾT THÚC</span>;
            default: return <span className="flex items-center text-slate-400 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold border border-slate-200"><StopCircle size={14} className="mr-1.5"/> ĐANG TẮT</span>;
        }
    };

    const renderDevicePreview = () => (
        <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[400px] w-[600px] shadow-xl overflow-hidden flex flex-col">
            <div className="h-[32px] w-full bg-gray-800 flex items-center justify-center relative">
                <div className="h-[5px] w-[5px] bg-gray-500 rounded-full absolute left-4"></div>
            </div>
            <div className="flex-1 bg-slate-100 relative overflow-y-auto">
                {/* Simulated Header */}
                <div className="h-10 bg-white border-b border-slate-200 flex items-center px-4 justify-between">
                    <div className="w-20 h-3 bg-slate-200 rounded"></div>
                    <div className="flex gap-2">
                        <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                    </div>
                </div>
                
                {/* Simulated Content */}
                <div className="p-4 space-y-3">
                    <div className="h-20 bg-white rounded-xl border border-slate-200"></div>
                    <div className="h-20 bg-white rounded-xl border border-slate-200"></div>
                    <div className="h-40 bg-white rounded-xl border border-slate-200"></div>
                </div>

                {/* PREVIEW: BANNER MODE */}
                {formDisplayMode === 'BANNER' && (
                    <div className="absolute top-2 right-2 left-2 z-20 animate-slide-in-right">
                        <div className="bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden flex flex-col">
                            <div className="px-3 py-2 border-b border-slate-50 flex justify-between items-center bg-white">
                                <span className="text-[10px] font-bold text-slate-500 flex items-center"><Info size={10} className="mr-1"/> Thông báo</span>
                                <X size={10} className="text-slate-400"/>
                            </div>
                            <div className="p-2 flex gap-2 items-start">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center">
                                    {formType === 'ERROR' ? <AlertTriangle size={14} className="text-red-500"/> : 
                                     formType === 'WARNING' ? <AlertCircle size={14} className="text-orange-500"/> :
                                     formType === 'SUCCESS' ? <CheckCircle2 size={14} className="text-green-500"/> :
                                     <Info size={14} className="text-blue-500"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-800 line-clamp-2">{formContent || "Nội dung thông báo..."}</div>
                                    {formActionLabel && <div className="mt-1 text-[9px] text-blue-600 font-bold uppercase">{formActionLabel} &rarr;</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PREVIEW: MODAL MODE */}
                {formDisplayMode === 'MODAL' && (
                    <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-90">
                            <div className={`h-2 w-full ${formType === 'ERROR' ? 'bg-red-500' : formType === 'WARNING' ? 'bg-orange-500' : formType === 'SUCCESS' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            <div className="p-6 text-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${formType === 'ERROR' ? 'bg-red-100 text-red-600' : formType === 'WARNING' ? 'bg-orange-100 text-orange-600' : formType === 'SUCCESS' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {formType === 'ERROR' ? <AlertTriangle size={24}/> : 
                                     formType === 'WARNING' ? <AlertCircle size={24}/> :
                                     formType === 'SUCCESS' ? <CheckCircle2 size={24}/> :
                                     <Info size={24}/>}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm mb-2 uppercase">Thông báo từ hệ thống</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">{formContent || "Nội dung thông báo quan trọng..."}</p>
                                
                                {formActionLabel && (
                                    <button className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold">
                                        {formActionLabel}
                                    </button>
                                )}
                                <button className="mt-2 text-[10px] text-slate-400 hover:text-slate-600">Đóng lại</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col animate-fade-in pb-10">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Megaphone size={28} className="mr-3 text-indigo-600" />
                        Internal Comms Hub
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Trung tâm Điều phối & Truyền thông Nội bộ</p>
                </div>
                
                {/* LIVE STATUS CARD */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    {getStatusBadge()}
                    {currentStatus === 'LIVE' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleStopLive}
                                disabled={isProcessing}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center"
                            >
                                <StopCircle size={14} className="mr-1"/> Dừng
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 h-full min-h-0">
                
                {/* 1. LEFT SIDEBAR: LIST */}
                <div className="w-full xl:w-72 flex flex-col gap-4 flex-shrink-0">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden h-[600px]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 text-sm">Thư viện mẫu</h3>
                            <button onClick={() => loadTemplate('NEW')} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"><Plus size={16}/></button>
                        </div>
                        
                        <div className="p-2 border-b border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-2">Presets (Mẫu nhanh)</div>
                            <div className="space-y-1">
                                {PRESETS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => loadTemplate(p as any, true)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center"
                                    >
                                        <Zap size={12} className="mr-2 text-yellow-500"/>
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-2 mt-2">Bản nháp ({templates.length})</div>
                            {templates.map(t => (
                                <div key={t.id} onClick={() => loadTemplate(t)} className={`p-3 rounded-lg border cursor-pointer transition-all group ${activeTemplateId === t.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-xs text-slate-700 truncate">{t.name || "Không tên"}</div>
                                        {t.displayMode === 'MODAL' && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded font-bold">MODAL</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-500 line-clamp-2">{t.content}</div>
                                    <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => handleDeleteTemplate(t.id!, e)}
                                            className="text-red-400 hover:text-red-600 p-1"
                                        >
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. MAIN EDITOR (Tabbed Interface) */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    {/* Editor Tabs */}
                    <div className="flex border-b border-slate-100">
                        <button 
                            onClick={() => setActiveTab('CONTENT')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CONTENT' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            1. Soạn thảo
                        </button>
                        <button 
                            onClick={() => setActiveTab('TARGET')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TARGET' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            2. Phân khúc & Lịch
                        </button>
                        <button 
                            onClick={() => setActiveTab('PREVIEW')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PREVIEW' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            3. Xem trước (Live)
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        
                        {activeTab === 'CONTENT' && (
                            <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên chiến dịch (Internal)</label>
                                        <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Chế độ hiển thị</label>
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button onClick={() => setFormDisplayMode('BANNER')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formDisplayMode === 'BANNER' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>
                                                <LayoutTemplate size={14} className="inline mr-1"/> Banner (Top)
                                            </button>
                                            <button onClick={() => setFormDisplayMode('MODAL')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formDisplayMode === 'MODAL' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>
                                                <Maximize2 size={14} className="inline mr-1"/> Modal (Popup)
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Loại thông báo</label>
                                    <div className="flex gap-3">
                                        {[
                                            { id: 'INFO', icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
                                            { id: 'SUCCESS', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
                                            { id: 'WARNING', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
                                            { id: 'ERROR', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setFormType(t.id as any)}
                                                className={`flex-1 py-3 rounded-xl border flex flex-col items-center justify-center transition-all ${formType === t.id ? `${t.bg} ${t.border} ring-2 ring-offset-1 ${t.color}` : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                                            >
                                                <t.icon size={20} className="mb-1"/>
                                                <span className="text-xs font-bold">{t.id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nội dung hiển thị</label>
                                    <textarea 
                                        value={formContent} 
                                        onChange={(e) => setFormContent(e.target.value)}
                                        rows={4}
                                        className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium text-slate-700"
                                        placeholder="Nhập nội dung thông báo..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nút hành động (Optional)</label>
                                        <input type="text" value={formActionLabel} onChange={(e) => setFormActionLabel(e.target.value)} placeholder="VD: Xem ngay" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Điều hướng đến</label>
                                        <select value={formTargetView} onChange={(e) => setFormTargetView(e.target.value as View)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                            <option value="">-- Không liên kết --</option>
                                            <option value={View.TASKS}>Quản lý công việc</option>
                                            <option value={View.APPROVALS}>Kiểm duyệt</option>
                                            <option value={View.BUDGET}>Ngân sách</option>
                                            <option value={View.SCHEDULE}>Lịch trình</option>
                                            <option value={View.WORK_REPORTS}>Báo cáo ngày</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'TARGET' && (
                            <div className="space-y-8 max-w-3xl mx-auto animate-fade-in">
                                {/* Roles */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center">
                                        <Users size={18} className="mr-2 text-indigo-600"/> Nhóm người nhận (Role)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[Role.BOARD, Role.MANAGER, Role.DEPUTY_MANAGER, Role.MEDIA_LEADER, Role.SOCIAL_LEADER].map(role => (
                                            <button 
                                                key={role} 
                                                onClick={() => toggleArrayItem(role, formTargetRoles, setFormTargetRoles)} 
                                                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${formTargetRoles.includes(role) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 italic">* Để trống để gửi cho tất cả.</p>
                                </div>

                                {/* Departments */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center">
                                        <Layout size={18} className="mr-2 text-purple-600"/> Phòng ban (Department)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Media', 'Content', 'Seeding', 'DieuHanh'].map(dept => (
                                            <button 
                                                key={dept} 
                                                onClick={() => toggleArrayItem(dept as Department, formTargetDepts, setFormTargetDepts)} 
                                                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${formTargetDepts.includes(dept as Department) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}
                                            >
                                                {dept} Team
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Schedule */}
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center"><Clock size={16} className="mr-2"/> Lịch trình hiển thị</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bắt đầu từ</label>
                                            <input type="datetime-local" value={formVisibleFrom} onChange={(e) => setFormVisibleFrom(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tự động tắt sau</label>
                                            <input type="datetime-local" value={formVisibleUntil} onChange={(e) => setFormVisibleUntil(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'PREVIEW' && (
                            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                                <div className="mb-4 text-center">
                                    <h4 className="font-bold text-slate-700">Xem trước hiển thị</h4>
                                    <p className="text-xs text-slate-500">Mô phỏng giao diện trên màn hình nhân viên</p>
                                </div>
                                {renderDevicePreview()}
                            </div>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="text-xs text-slate-400 font-medium">
                            {isProcessing ? 'Đang đồng bộ...' : 'Sẵn sàng'}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleSaveTemplate(true)} 
                                disabled={isProcessing}
                                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-bold transition-all shadow-sm flex items-center disabled:opacity-50"
                            >
                                <Save size={16} className="mr-2"/> Lưu nháp
                            </button>
                            <button 
                                onClick={handlePublish} 
                                disabled={isProcessing}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center disabled:opacity-50 transform active:scale-95"
                            >
                                {isProcessing ? <Loader2 size={16} className="mr-2 animate-spin"/> : <Megaphone size={16} className="mr-2"/>}
                                Xuất bản ngay
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BroadcastManager;
