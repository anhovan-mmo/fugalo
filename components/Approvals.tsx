
import React, { useState, useEffect, useMemo } from 'react';
import { ApprovalRequest, ApprovalStatus, ApprovalType, Member, Role, Task, ApprovalLog, PersonalTask, getRoleLevel } from '../types';
import { addApprovalToDB, updateApprovalInDB, subscribeToApprovals } from '../services/firebase';
import { 
    FileText, Video, PenTool, CheckCircle2, XCircle, Clock, Plus, ExternalLink, 
    Send, Search, ShieldCheck, User,
    AlertTriangle, Briefcase, ChevronRight, File, Link as LinkIcon, History, ArrowUp, ArrowDown, Minus, RefreshCw, Upload, MoreHorizontal,
    Check, X, Inbox, Filter, ChevronLeft, Layout, Calendar, MessageSquare, Zap, UserCheck
} from 'lucide-react';

interface ApprovalsProps {
    currentUser: Member;
    members: Member[];
    tasks: Task[];
    personalTasks: PersonalTask[];
}

type TabType = 'NEEDS_REVIEW' | 'MY_REQUESTS' | 'HISTORY';

const Approvals: React.FC<ApprovalsProps> = ({ currentUser, members, tasks, personalTasks }) => {
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('NEEDS_REVIEW');
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');

    // Review & Create State
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [resubmitNote, setResubmitNote] = useState('');
    
    // Create Form State
    const [importSource, setImportSource] = useState<'NONE' | 'PROJECT' | 'PERSONAL'>('NONE');
    
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newType, setNewType] = useState<ApprovalType>('CONTENT');
    const [newLink, setNewLink] = useState('');
    const [inputType, setInputType] = useState<'LINK' | 'FILE'>('LINK');
    const [newTaskId, setNewTaskId] = useState('');
    const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [uploadFileName, setUploadFileName] = useState('');

    const isManagerOrLeader = currentUser.roleType !== Role.SOCIAL && currentUser.roleType !== Role.MEDIA && currentUser.roleType !== Role.SEEDING && currentUser.roleType !== Role.PHOTO;

    useEffect(() => {
        // Default tab based on role
        if (!isManagerOrLeader) setActiveTab('MY_REQUESTS');
        
        const unsubscribe = subscribeToApprovals((data) => {
            setApprovals(data);
        });
        return () => unsubscribe();
    }, [isManagerOrLeader]);

    // Derived Data
    const filteredList = useMemo(() => {
        let list = approvals;

        // --- BOARD VIEW LOGIC START ---
        if (currentUser.roleType === Role.BOARD) {
            // Ban Giám Đốc chỉ thấy yêu cầu từ Manager (Level 4) hoặc Deputy Manager (Level 3)
            const managerIds = members.filter(m => getRoleLevel(m.roleType) >= 3).map(m => m.id);
            list = list.filter(r => managerIds.includes(r.requesterId));
        }
        // --- BOARD VIEW LOGIC END ---

        // 1. Tab Logic
        if (activeTab === 'NEEDS_REVIEW') {
            list = list.filter(r => r.status === 'PENDING');
        } else if (activeTab === 'MY_REQUESTS') {
            list = list.filter(r => r.requesterId === currentUser.id && (r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED'));
        } else if (activeTab === 'HISTORY') {
            if (isManagerOrLeader) {
                list = list.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED');
            } else {
                list = list.filter(r => r.requesterId === currentUser.id && (r.status === 'APPROVED' || r.status === 'REJECTED'));
            }
        }

        // 2. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(r => r.title.toLowerCase().includes(q) || members.find(m => m.id === r.requesterId)?.name.toLowerCase().includes(q));
        }

        // 3. Type Filter
        if (filterType !== 'ALL') {
            list = list.filter(r => r.type === filterType);
        }

        return list;
    }, [approvals, activeTab, searchQuery, filterType, currentUser.id, isManagerOrLeader, members, currentUser.roleType]);

    const selectedRequest = useMemo(() => 
        approvals.find(r => r.id === selectedRequestId), 
    [approvals, selectedRequestId]);

    // Select first item if nothing selected and list not empty (Desktop UX)
    useEffect(() => {
        if (!selectedRequestId && filteredList.length > 0 && window.innerWidth >= 1024) {
            setSelectedRequestId(filteredList[0].id);
        }
    }, [activeTab, filteredList.length]);

    // Logic to determine WHO will receive the request
    const myApprover = useMemo(() => {
        const myRoleLevel = getRoleLevel(currentUser.roleType);
        
        // 1. Try to find direct report based on 'reportsTo' string mapping (Exact Match)
        let found = members.find(m => m.role === currentUser.reportsTo);
        
        // 2. If not found or generic, fall back to hierarchy logic
        if (!found) {
             if (myRoleLevel === 1) { 
                 // Staff -> Send to Leader of same department
                 found = members.find(m => m.department === currentUser.department && getRoleLevel(m.roleType) === 2);
             } 
             
             if (!found && myRoleLevel <= 2) { 
                 // Leader/Staff -> Send to Deputy Manager or Manager
                 found = members.find(m => m.roleType === Role.DEPUTY_MANAGER) || members.find(m => m.roleType === Role.MANAGER);
             }
        }
        return found;
    }, [members, currentUser]);

    // Task Import Helpers
    const myProjectTasks = useMemo(() => 
        tasks.filter(t => (t.assigneeId === currentUser.id || t.supporterIds?.includes(currentUser.id)) && t.status !== 'DONE' && t.status !== 'CANCELLED'), 
    [tasks, currentUser.id]);

    const myPersonalTasks = useMemo(() => 
        personalTasks.filter(t => t.userId === currentUser.id && !t.completed), 
    [personalTasks, currentUser.id]);

    const handleImportTask = (id: string) => {
        if (!id) return;
        
        if (importSource === 'PROJECT') {
            const task = tasks.find(t => t.id === id);
            if (task) {
                setNewTaskId(task.id);
                setNewTitle(task.title);
                const extraDesc = task.contentDraft ? `\n\nNội dung nháp:\n${task.contentDraft}` : '';
                setNewDesc(task.description + extraDesc);
                if (task.mediaUrl) {
                    setNewLink(task.mediaUrl);
                    setInputType('LINK');
                }
                if (task.taskType === 'MEDIA') setNewType('VIDEO');
                else if (task.taskType === 'CONTENT') setNewType('CONTENT');
                else setNewType('CONTENT');
                
                setNewPriority(task.priority);
            }
        } else if (importSource === 'PERSONAL') {
            const task = personalTasks.find(t => t.id === id);
            if (task) {
                setNewTitle(task.content);
                setNewDesc(task.notes || '');
                setNewTaskId(''); 
            }
        }
    };

    // --- ACTIONS ---

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newLink.trim()) {
            alert("Vui lòng nhập đủ thông tin.");
            return;
        }

        const newRequest: ApprovalRequest = {
            id: Date.now().toString(),
            requesterId: currentUser.id,
            type: newType,
            title: newTitle,
            description: newDesc,
            contentUrl: newLink,
            attachmentType: inputType,
            taskId: newTaskId || undefined,
            priority: newPriority,
            status: 'PENDING',
            logs: [{
                id: Date.now().toString(),
                actorId: currentUser.id,
                action: 'SUBMIT',
                comment: newDesc,
                timestamp: new Date().toISOString()
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await addApprovalToDB(newRequest);
        setIsCreateModalOpen(false);
        setNewTitle(''); setNewLink(''); setNewDesc(''); setUploadFileName(''); setNewTaskId('');
        setImportSource('NONE');
        if (!isManagerOrLeader) setActiveTab('MY_REQUESTS');
    };

    const handleReviewAction = async (status: ApprovalStatus) => {
        if (!selectedRequest) return;
        
        const actionType = status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : 'REQUEST_CHANGE';
        
        await updateApprovalInDB({
            ...selectedRequest,
            status,
            feedback: reviewFeedback,
            reviewerId: currentUser.id,
            logs: [...(selectedRequest.logs || []), {
                id: Date.now().toString(),
                actorId: currentUser.id,
                action: actionType,
                comment: reviewFeedback,
                timestamp: new Date().toISOString()
            }],
            updatedAt: new Date().toISOString()
        });
        setReviewFeedback('');
    };

    const handleResubmit = async () => {
        if (!selectedRequest) return;
        await updateApprovalInDB({
            ...selectedRequest,
            status: 'PENDING',
            logs: [...(selectedRequest.logs || []), {
                id: Date.now().toString(),
                actorId: currentUser.id,
                action: 'RESUBMIT',
                comment: resubmitNote,
                timestamp: new Date().toISOString()
            }],
            updatedAt: new Date().toISOString()
        });
        setResubmitNote('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => setNewLink(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    // --- UI HELPERS ---
    const getStatusInfo = (status: ApprovalStatus) => {
        switch (status) {
            case 'PENDING': return { label: 'Chờ duyệt', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Clock };
            case 'APPROVED': return { label: 'Đã duyệt', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2 };
            case 'REJECTED': return { label: 'Đã từ chối', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle };
            case 'CHANGES_REQUESTED': return { label: 'Cần sửa', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: RefreshCw };
        }
    };

    const getTypeIcon = (type: ApprovalType) => {
        switch(type) {
            case 'VIDEO': return <Video size={14}/>;
            case 'DESIGN': return <PenTool size={14}/>;
            default: return <FileText size={14}/>;
        }
    };

    const getLogActionDisplay = (log: ApprovalLog) => {
        switch (log.action) {
            case 'SUBMIT': return { text: 'Gửi yêu cầu', color: 'text-blue-600', bg: 'bg-blue-100', icon: Send };
            case 'APPROVE': return { text: 'Đã duyệt', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 };
            case 'REJECT': return { text: 'Từ chối', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle };
            case 'REQUEST_CHANGE': return { text: 'Yêu cầu sửa', color: 'text-orange-600', bg: 'bg-orange-100', icon: RefreshCw };
            case 'RESUBMIT': return { text: 'Gửi lại', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: Upload };
            default: return { text: 'Cập nhật', color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock };
        }
    };

    const pendingCount = filteredList.filter(r => r.status === 'PENDING').length;
    const myCount = approvals.filter(r => r.requesterId === currentUser.id && (r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED')).length;

    return (
        <div className="h-full flex flex-col animate-fade-in pb-0 bg-slate-50">
            {/* --- HEADER --- */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white shadow-md">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-none">Trung tâm Kiểm duyệt</h1>
                        <p className="text-xs text-slate-500 mt-1">Quản lý và phê duyệt nội dung tập trung</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transition-all text-sm font-bold active:scale-95"
                    >
                        <Plus size={18} className="mr-2" /> Tạo yêu cầu mới
                    </button>
                </div>
            </div>

            {/* --- MAIN LAYOUT (3 PANES) --- */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* PANE 1: NAVIGATION & FILTERS (Left Sidebar) */}
                <div className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col hidden lg:flex">
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                            <input 
                                type="text" placeholder="Tìm kiếm nhanh..." 
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {isManagerOrLeader && (
                            <button 
                                onClick={() => setActiveTab('NEEDS_REVIEW')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'NEEDS_REVIEW' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Inbox size={18} /> Cần duyệt
                                </div>
                                {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>}
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab('MY_REQUESTS')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'MY_REQUESTS' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Send size={18} /> Gửi đi
                            </div>
                            {myCount > 0 && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{myCount}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('HISTORY')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <History size={18} /> Kho lưu trữ
                            </div>
                        </button>

                        <div className="pt-4 mt-2 border-t border-slate-100">
                            <label className="px-3 text-xs font-bold text-slate-400 uppercase mb-2 block">Lọc theo loại</label>
                            {['ALL', 'CONTENT', 'VIDEO', 'DESIGN'].map(type => (
                                <button 
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`w-full flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all ${filterType === type ? 'text-slate-900 bg-slate-100 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full mr-3 ${type === 'ALL' ? 'bg-slate-400' : type === 'VIDEO' ? 'bg-red-400' : type === 'DESIGN' ? 'bg-purple-400' : 'bg-blue-400'}`}></div>
                                    {type === 'ALL' ? 'Tất cả' : type}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* PANE 2: LIST (Middle Column) */}
                <div className={`flex-shrink-0 w-full lg:w-80 xl:w-96 bg-white border-r border-slate-200 flex flex-col ${selectedRequestId ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center lg:hidden">
                        <span className="font-bold text-slate-700 text-sm">Danh sách ({filteredList.length})</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                                <Inbox size={40} className="mb-2 opacity-20"/>
                                <span className="text-xs">Không có yêu cầu nào</span>
                            </div>
                        ) : (
                            filteredList.map(req => {
                                const requester = members.find(m => m.id === req.requesterId);
                                const isSelected = selectedRequestId === req.id;
                                const statusInfo = getStatusInfo(req.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <div 
                                        key={req.id} 
                                        onClick={() => setSelectedRequestId(req.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md relative group ${
                                            isSelected 
                                            ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200' 
                                            : 'bg-white border-slate-100 hover:border-blue-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`p-1.5 rounded-md ${req.type === 'VIDEO' ? 'bg-red-100 text-red-600' : req.type === 'DESIGN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {getTypeIcon(req.type)}
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                                                    <StatusIcon size={10} /> {statusInfo.label}
                                                </span>
                                            </div>
                                            {req.priority === 'High' && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center animate-pulse"><AlertTriangle size={10} className="mr-1"/> GẤP</span>}
                                        </div>
                                        
                                        <h4 className={`font-bold text-sm mb-1 line-clamp-2 leading-snug ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>{req.title}</h4>
                                        
                                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-50">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                                                {requester?.avatar ? <img src={requester.avatar} className="w-full h-full object-cover"/> : <div className="text-[9px] flex items-center justify-center h-full font-bold text-slate-500">{requester?.name.charAt(0)}</div>}
                                            </div>
                                            <div className="flex-1 text-xs text-slate-500 truncate flex justify-between items-center">
                                                <span className="font-semibold text-slate-700">{requester?.name}</span> 
                                                <span className="text-[10px]">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* PANE 3: DETAIL VIEW (Right Column) */}
                {selectedRequest ? (
                    <div className={`flex-1 bg-slate-50 flex flex-col overflow-hidden h-full ${!selectedRequestId ? 'hidden lg:flex' : 'flex'} relative`}>
                        {/* Detail Header */}
                        <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-start shadow-sm z-10">
                            <div className="flex items-start gap-4">
                                <button onClick={() => setSelectedRequestId(null)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                                    <ChevronLeft size={20} />
                                </button>
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="font-bold text-xl text-slate-800 leading-tight">{selectedRequest.title}</h2>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                                            <User size={12}/> {members.find(m => m.id === selectedRequest.requesterId)?.name}
                                        </span>
                                        <span>•</span>
                                        {/* FIX: 24h format */}
                                        <span>{new Date(selectedRequest.createdAt).toLocaleString('vi-VN', {hour12: false})}</span>
                                        {selectedRequest.taskId && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer">
                                                    <Briefcase size={12}/> Link Task
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getStatusInfo(selectedRequest.status).bg} ${getStatusInfo(selectedRequest.status).color} ${getStatusInfo(selectedRequest.status).border}`}>
                                {React.createElement(getStatusInfo(selectedRequest.status).icon, { size: 14 })}
                                {getStatusInfo(selectedRequest.status).label}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="max-w-4xl mx-auto space-y-6">
                                
                                {/* 1. PREVIEW SECTION */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-xs text-slate-500 uppercase flex items-center">
                                            <Layout size={14} className="mr-1.5"/> Nội dung cần duyệt
                                        </h3>
                                        <a href={selectedRequest.contentUrl} target="_blank" className="text-blue-600 text-xs font-bold flex items-center hover:underline">
                                            Mở tab mới <ExternalLink size={12} className="ml-1"/>
                                        </a>
                                    </div>
                                    <div className="bg-slate-100 min-h-[300px] flex items-center justify-center p-4">
                                        {selectedRequest.attachmentType === 'FILE' ? (
                                            selectedRequest.contentUrl.startsWith('data:image') ? (
                                                <img src={selectedRequest.contentUrl} className="max-w-full max-h-[500px] object-contain rounded shadow-lg" alt="Preview"/>
                                            ) : (
                                                <video controls src={selectedRequest.contentUrl} className="max-w-full max-h-[500px] rounded shadow-lg bg-black" />
                                            )
                                        ) : (
                                            <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 max-w-md">
                                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <LinkIcon size={32} />
                                                </div>
                                                <h4 className="font-bold text-slate-800 mb-2 truncate px-4">{selectedRequest.contentUrl}</h4>
                                                <p className="text-xs text-slate-500 mb-4">Link Google Drive / Docs / Sheet</p>
                                                <a href={selectedRequest.contentUrl} target="_blank" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-all inline-flex items-center">
                                                    Truy cập liên kết
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {selectedRequest.description && (
                                        <div className="p-6 border-t border-slate-100">
                                            <h4 className="font-bold text-sm text-slate-700 mb-2">Mô tả / Ghi chú:</h4>
                                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedRequest.description}</p>
                                        </div>
                                    )}
                                </div>

                                {/* 2. TIMELINE / AUDIT TRAIL */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                        <h3 className="font-bold text-xs text-slate-500 uppercase flex items-center">
                                            <History size={14} className="mr-1.5"/> Lịch sử hoạt động
                                        </h3>
                                    </div>
                                    <div className="p-6">
                                        <div className="space-y-6 relative pl-2">
                                            {/* Vertical Line */}
                                            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

                                            {selectedRequest.logs?.map((log, index) => {
                                                const actor = members.find(m => m.id === log.actorId);
                                                const info = getLogActionDisplay(log);
                                                const LogIcon = info.icon;
                                                return (
                                                    <div key={log.id} className="relative flex gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10 ${info.bg} ${info.color}`}>
                                                            <LogIcon size={16} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`font-bold text-sm ${info.color}`}>{info.text}</span>
                                                                {/* FIX: 24h format */}
                                                                <span className="text-xs text-slate-400">• {new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', hour12: false})}, {new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                                                                    {actor?.avatar ? <img src={actor.avatar} className="w-full h-full object-cover"/> : <div className="flex items-center justify-center h-full text-[8px] font-bold text-slate-500">{actor?.name.charAt(0)}</div>}
                                                                </div>
                                                                <span className="text-xs font-medium text-slate-700">{actor?.name}</span>
                                                            </div>
                                                            {log.comment && (
                                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700 relative">
                                                                    <div className="absolute top-3 -left-1.5 w-3 h-3 bg-slate-50 border-l border-b border-slate-100 transform rotate-45"></div>
                                                                    {log.comment}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-32"></div> {/* Spacer for bottom bar */}
                            </div>
                        </div>

                        {/* Sticky Action Bar */}
                        <div className="bg-white border-t border-slate-200 p-4 absolute bottom-0 left-0 right-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                            {/* CASE 1: MANAGER REVIEW */}
                            {isManagerOrLeader && selectedRequest.status === 'PENDING' && (
                                <div className="flex flex-col gap-3">
                                    <textarea 
                                        value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)}
                                        placeholder="Nhập nhận xét (Bắt buộc nếu từ chối hoặc yêu cầu sửa)..."
                                        className="w-full border border-slate-300 rounded-lg p-3 text-sm h-16 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => handleReviewAction('REJECTED')} className="flex items-center px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold text-sm transition-colors">
                                            <XCircle size={18} className="mr-2"/> Từ chối
                                        </button>
                                        <button onClick={() => handleReviewAction('CHANGES_REQUESTED')} className="flex items-center px-4 py-2 border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg font-bold text-sm transition-colors">
                                            <RefreshCw size={18} className="mr-2"/> Yêu cầu sửa
                                        </button>
                                        <button onClick={() => handleReviewAction('APPROVED')} className="flex items-center px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold text-sm shadow-md transition-colors">
                                            <CheckCircle2 size={18} className="mr-2"/> Duyệt ngay
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* CASE 2: REQUESTER RESUBMIT */}
                            {currentUser.id === selectedRequest.requesterId && selectedRequest.status === 'CHANGES_REQUESTED' && (
                                <div className="flex flex-col gap-3">
                                    <div className="text-xs text-orange-700 font-bold bg-orange-50 p-2 rounded mb-1 flex items-center">
                                        <AlertTriangle size={14} className="mr-1"/> Quản lý yêu cầu chỉnh sửa. Vui lòng cập nhật và gửi lại.
                                    </div>
                                    <textarea 
                                        value={resubmitNote} onChange={(e) => setResubmitNote(e.target.value)}
                                        placeholder="Nhập ghi chú hoặc link mới..."
                                        className="w-full border border-orange-300 rounded-lg p-3 text-sm h-16 resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                    <div className="flex justify-end">
                                        <button onClick={handleResubmit} className="flex items-center px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-sm shadow-md transition-colors">
                                            <Upload size={18} className="mr-2"/> Gửi lại duyệt
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* CASE 3: READ ONLY */}
                            {selectedRequest.status !== 'PENDING' && !(currentUser.id === selectedRequest.requesterId && selectedRequest.status === 'CHANGES_REQUESTED') && (
                                <div className="text-center text-slate-400 text-sm italic py-2">
                                    Quy trình phê duyệt đã hoàn tất hoặc bạn không có quyền thao tác.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-slate-50 text-slate-400">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <ShieldCheck size={48} className="text-slate-300"/>
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">Chọn một yêu cầu để xem chi tiết</h3>
                        <p className="text-sm mt-1">Duyệt nhanh nội dung, video và thiết kế.</p>
                    </div>
                )}
            </div>

            {/* CREATE MODAL (Standardized) */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center text-lg">
                                <Plus size={20} className="mr-2 text-blue-600"/> Tạo phiếu duyệt mới
                            </h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                            
                            {/* APPROVER PREVIEW */}
                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center">
                                        <UserCheck size={12} className="mr-1"/> Người duyệt
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 border border-white shadow-sm overflow-hidden">
                                            {myApprover?.avatar ? <img src={myApprover.avatar} className="w-full h-full object-cover"/> : myApprover?.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">
                                            {myApprover ? myApprover.name : 'Quản lý trực tiếp'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[10px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                                    Tự động điều phối
                                </div>
                            </div>

                            {/* IMPORT SELECTOR */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button type="button" onClick={() => setImportSource('NONE')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${importSource === 'NONE' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tạo mới</button>
                                <button type="button" onClick={() => setImportSource('PROJECT')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${importSource === 'PROJECT' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Từ Dự án</button>
                                <button type="button" onClick={() => setImportSource('PERSONAL')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${importSource === 'PERSONAL' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}>Từ Việc riêng</button>
                            </div>

                            {importSource === 'PROJECT' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn công việc dự án</label>
                                    <select 
                                        onChange={(e) => handleImportTask(e.target.value)} 
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Chọn công việc --</option>
                                        {myProjectTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                    </select>
                                </div>
                            )}

                            {importSource === 'PERSONAL' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn việc cá nhân</label>
                                    <select 
                                        onChange={(e) => handleImportTask(e.target.value)} 
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Chọn công việc --</option>
                                        {myPersonalTasks.map(t => <option key={t.id} value={t.id}>{t.content}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề yêu cầu <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    required
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="VD: Duyệt bài content Fanpage 20/10..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loại nội dung</label>
                                    <select 
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value as ApprovalType)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="CONTENT">📝 Bài viết (Content)</option>
                                        <option value="VIDEO">🎬 Video / Clip</option>
                                        <option value="DESIGN">🎨 Hình ảnh / Design</option>
                                        <option value="OTHER">📦 Khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mức độ ưu tiên</label>
                                    <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200">
                                        {['Low', 'Medium', 'High'].map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setNewPriority(p as any)}
                                                className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all ${
                                                    newPriority === p 
                                                    ? (p === 'High' ? 'bg-red-500 text-white' : p === 'Medium' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white')
                                                    : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                {p === 'High' ? 'Gấp' : p === 'Medium' ? 'Vừa' : 'Thấp'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Content Input Switcher */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Nội dung đính kèm <span className="text-red-500">*</span></label>
                                    <div className="flex text-[10px] font-bold bg-slate-100 rounded p-0.5">
                                        <button type="button" onClick={() => setInputType('LINK')} className={`px-2 py-0.5 rounded ${inputType === 'LINK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Link</button>
                                        <button type="button" onClick={() => setInputType('FILE')} className={`px-2 py-0.5 rounded ${inputType === 'FILE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>File</button>
                                    </div>
                                </div>
                                
                                {inputType === 'LINK' ? (
                                    <input 
                                        type="url" 
                                        required={inputType === 'LINK'}
                                        value={newLink}
                                        onChange={(e) => setNewLink(e.target.value)}
                                        placeholder="https://docs.google.com/..."
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-blue-600"
                                    />
                                ) : (
                                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                                        <input 
                                            type="file" 
                                            accept="image/*,video/*"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="flex flex-col items-center">
                                            <Upload size={20} className="text-slate-400 mb-1" />
                                            <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]">
                                                {uploadFileName || "Chọn ảnh hoặc video"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mô tả / Ghi chú thêm</label>
                                <textarea 
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    placeholder="Ghi chú cho người duyệt..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Hủy</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold shadow-md flex items-center">
                                    <Send size={16} className="mr-2" /> Gửi duyệt ngay
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Approvals;
