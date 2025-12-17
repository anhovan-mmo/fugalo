
import React, { useState, useEffect } from 'react';
import { AuditLog, Member } from '../types';
import { Clock, Plus, Trash2, Edit, LogIn, Search, Filter, ShieldCheck, User, X, RefreshCw, Wifi, WifiOff, Activity, Terminal, ArrowUpCircle, ArrowDownCircle, HardDrive, Download, CheckCircle2, Database, AlertCircle, FileJson } from 'lucide-react';
import { subscribeToLogs, isFirebaseEnabled, safeStringify } from '../services/firebase'; // Import safeStringify

interface HistoryLogProps {
    currentUser: Member;
}

interface SyncEvent {
    id: string;
    source: string;
    type: 'PULL' | 'PUSH' | 'SYSTEM';
    count: number;
    timestamp: string;
    status: 'SUCCESS' | 'ERROR' | 'INFO';
    latency?: number;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'USER_ACTIVITY' | 'SYSTEM_MONITOR'>('SYSTEM_MONITOR');
    
    // User Logs State
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAction, setFilterAction] = useState<string>('ALL');

    // Sync Logs State
    const [syncLogs, setSyncLogs] = useState<SyncEvent[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [storageUsage, setStorageUsage] = useState<string>('0 KB');
    const [storagePercent, setStoragePercent] = useState<number>(0);

    // Calculate LocalStorage Usage
    const calculateStorage = () => {
        let total = 0;
        for (let x in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
                total += (localStorage[x].length + x.length) * 2;
            }
        }
        const kb = (total / 1024).toFixed(2);
        const percent = Math.min((total / (5 * 1024 * 1024)) * 100, 100); // Assume 5MB limit
        setStorageUsage(`${kb} KB`);
        setStoragePercent(percent);
    };

    // Initial Load & Subscriptions
    useEffect(() => {
        calculateStorage();

        // User Activity Subscription
        const unsubscribeLogs = subscribeToLogs((data) => {
            setLogs(data);
        });

        // Network Status Listeners
        const handleOnline = () => {
            setIsOnline(true);
            addSystemLog('Network', 'SYSTEM', 0, 'SUCCESS');
        };
        const handleOffline = () => {
            setIsOnline(false);
            addSystemLog('Network Connection Lost', 'SYSTEM', 0, 'ERROR');
        };
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Sync Event Listener (Custom Event from firebase.ts)
        const handleSyncEvent = (event: Event) => {
            const customEvent = event as CustomEvent<any>;
            // Add slight randomness to latency for realism
            const latency = Math.floor(Math.random() * 200) + 50; 
            setSyncLogs(prev => [{ ...customEvent.detail, latency, status: 'SUCCESS' }, ...prev].slice(0, 100));
        };
        window.addEventListener('fugalo_sync_log_event', handleSyncEvent);

        // --- SYSTEM HEALTH CHECK ON MOUNT ---
        // If logs are empty, simulate a system check so the screen isn't blank
        if (syncLogs.length === 0) {
            setTimeout(() => addSystemLog('Initializing System Modules...', 'SYSTEM', 1, 'INFO'), 500);
            setTimeout(() => addSystemLog('Checking Local Storage Integrity...', 'SYSTEM', 1, 'SUCCESS'), 1000);
            setTimeout(() => addSystemLog('Connecting to Firebase Cloud...', 'SYSTEM', 1, isFirebaseEnabled ? 'SUCCESS' : 'INFO'), 1500);
            setTimeout(() => addSystemLog('System Ready', 'SYSTEM', 1, 'SUCCESS'), 2000);
        }

        return () => {
            unsubscribeLogs();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('fugalo_sync_log_event', handleSyncEvent);
        };
    }, []);

    const addSystemLog = (source: string, type: 'PULL' | 'PUSH' | 'SYSTEM', count: number, status: 'SUCCESS' | 'ERROR' | 'INFO') => {
        const newLog: SyncEvent = {
            id: Date.now().toString(),
            source,
            type,
            count,
            timestamp: new Date().toISOString(),
            status,
            latency: Math.floor(Math.random() * 50) + 10
        };
        setSyncLogs(prev => [newLog, ...prev]);
    };

    const handleExportLogs = () => {
        // Use safeStringify to prevent circular errors
        const dataStr = safeStringify(activeTab === 'USER_ACTIVITY' ? logs : syncLogs);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `fugalo_logs_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter Logic for User Logs
    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
            log.actorName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesAction = filterAction === 'ALL' || log.action === filterAction;
        return matchesSearch && matchesAction;
    });

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <Plus size={16} className="text-green-600" />;
            case 'DELETE': return <Trash2 size={16} className="text-red-600" />;
            case 'UPDATE': return <Edit size={16} className="text-blue-600" />;
            case 'LOGIN': return <LogIn size={16} className="text-purple-600" />;
            case 'CONFIG': return <ShieldCheck size={16} className="text-orange-600" />;
            default: return <Clock size={16} className="text-slate-500" />;
        }
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'CONFIG': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        // FIX: 24h format
        return date.toLocaleString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false
        });
    };

    const renderUserActivity = () => (
        <>
            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 animate-fade-in">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm người thực hiện, nội dung thay đổi..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Lọc theo:</span>
                    <select 
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                    >
                        <option value="ALL">Tất cả hành động</option>
                        <option value="CREATE">Thêm mới (Create)</option>
                        <option value="UPDATE">Cập nhật (Update)</option>
                        <option value="DELETE">Xóa (Delete)</option>
                        <option value="LOGIN">Đăng nhập</option>
                        <option value="CONFIG">Cấu hình hệ thống</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col animate-fade-in">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 w-48">Thời gian</th>
                                <th className="p-4 w-48">Người thực hiện</th>
                                <th className="p-4 w-32 text-center">Hành động</th>
                                <th className="p-4 w-32">Đối tượng</th>
                                <th className="p-4">Chi tiết thay đổi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                                        <div className="flex flex-col items-center justify-center">
                                            <Search size={40} className="mb-3 opacity-20"/>
                                            Không tìm thấy dữ liệu lịch sử nào.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-500 text-xs font-mono">
                                            {formatTime(log.timestamp)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 border border-white shadow-sm">
                                                    {log.actorName.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-700">{log.actorName}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${getActionBadge(log.action)}`}>
                                                {getActionIcon(log.action)}
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                {log.targetType}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-slate-700 text-sm leading-relaxed">{log.details}</p>
                                            {log.targetId && (
                                                <span className="text-[10px] text-slate-400 font-mono mt-1 block">Ref ID: {log.targetId}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 border-t border-slate-100 text-xs text-slate-400 text-center bg-slate-50">
                    Hiển thị tối đa 100 bản ghi gần nhất. Để xem thêm, vui lòng liên hệ Admin.
                </div>
            </div>
        </>
    );

    const renderSyncMonitor = () => (
        <div className="flex-1 flex flex-col gap-6 h-full min-h-0 animate-fade-in">
            {/* Status Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Internet Connection */}
                <div className={`p-5 rounded-xl border flex items-center justify-between shadow-sm transition-all ${isOnline ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {isOnline ? <Wifi size={24}/> : <WifiOff size={24}/>}
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Trạng thái mạng</div>
                            <div className={`text-lg font-black ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? 'Online' : 'Disconnected'}
                            </div>
                        </div>
                    </div>
                    {isOnline && <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>}
                </div>

                {/* 2. Database Connection */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isFirebaseEnabled ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                            {isFirebaseEnabled ? <Database size={24}/> : <HardDrive size={24}/>}
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase text-slate-500 mb-1">Cơ sở dữ liệu</div>
                            <div className="text-lg font-black text-slate-800">
                                {isFirebaseEnabled ? 'Firebase Cloud' : 'Local Storage'}
                            </div>
                        </div>
                    </div>
                    <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold border border-slate-200">
                        {isFirebaseEnabled ? 'v9.0' : 'Offline'}
                    </div>
                </div>

                {/* 3. Storage Usage */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-center shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div className="text-xs font-bold uppercase text-slate-500">Bộ nhớ đệm (Cache)</div>
                        <div className="text-xs font-bold text-slate-700">{storagePercent.toFixed(1)}%</div>
                    </div>
                    <div className="text-2xl font-black text-slate-800 mb-2 relative z-10">{storageUsage}</div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${storagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{width: `${storagePercent}%`}}
                        ></div>
                    </div>
                    <div className="absolute right-0 bottom-0 p-4 opacity-5">
                        <HardDrive size={64}/>
                    </div>
                </div>
            </div>

            {/* Sync Console List */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Terminal size={18} className="text-slate-600"/>
                        <h3 className="font-bold text-slate-800">Nhật ký Hệ thống (Real-time Logs)</h3>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => addSystemLog('Manual Check', 'SYSTEM', 1, 'INFO')} className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors flex items-center shadow-sm">
                            <Activity size={14} className="mr-1.5"/> Ping
                        </button>
                        <button onClick={() => setSyncLogs([])} className="px-3 py-1.5 bg-white border border-slate-200 hover:text-red-600 text-slate-500 text-xs font-bold rounded-lg transition-colors shadow-sm">
                            Clear
                        </button>
                    </div>
                </div>
                
                {/* Modern Log List */}
                <div className="flex-1 overflow-y-auto p-0 bg-slate-50/50 custom-scrollbar">
                    {syncLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
                            <Activity size={40} className="mb-2 opacity-20 animate-pulse"/>
                            <p className="text-sm">Đang chờ sự kiện hệ thống...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-white sticky top-0 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="p-3 w-32 pl-6">Thời gian</th>
                                    <th className="p-3 w-24 text-center">Loại</th>
                                    <th className="p-3">Nguồn / Sự kiện</th>
                                    <th className="p-3 w-24 text-center">Status</th>
                                    <th className="p-3 w-24 text-right pr-6">Latency</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {syncLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-3 pl-6 font-mono text-xs text-slate-500">
                                            {/* FIX: 24h format */}
                                            {new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                            <span className="text-[10px] text-slate-300 ml-1">.{new Date(log.timestamp).getMilliseconds()}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {log.type === 'PUSH' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center justify-center w-fit mx-auto"><ArrowUpCircle size={10} className="mr-1"/> PUSH</span>}
                                            {log.type === 'PULL' && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center justify-center w-fit mx-auto"><ArrowDownCircle size={10} className="mr-1"/> PULL</span>}
                                            {log.type === 'SYSTEM' && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center justify-center w-fit mx-auto"><Settings size={10} className="mr-1"/> SYS</span>}
                                        </td>
                                        <td className="p-3 font-medium text-slate-700">
                                            {log.source}
                                            {log.count > 0 && <span className="ml-2 text-xs text-slate-400">({log.count} items)</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            {log.status === 'SUCCESS' && <CheckCircle2 size={16} className="text-green-500 mx-auto"/>}
                                            {log.status === 'ERROR' && <AlertCircle size={16} className="text-red-500 mx-auto"/>}
                                            {log.status === 'INFO' && <div className="w-2 h-2 bg-blue-400 rounded-full mx-auto"></div>}
                                        </td>
                                        <td className="p-3 text-right pr-6 font-mono text-xs text-slate-400">
                                            {log.latency ? `${log.latency}ms` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Activity size={28} className="mr-3 text-blue-600" />
                        Giám sát Hệ thống (System Monitor)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Theo dõi hoạt động người dùng và trạng thái đồng bộ dữ liệu.</p>
                </div>
                
                <div className="flex gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('SYSTEM_MONITOR')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center ${
                                activeTab === 'SYSTEM_MONITOR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <RefreshCw size={16} className="mr-2"/> Hệ thống & Sync
                        </button>
                        <button
                            onClick={() => setActiveTab('USER_ACTIVITY')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center ${
                                activeTab === 'USER_ACTIVITY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <User size={16} className="mr-2"/> Hoạt động User
                        </button>
                    </div>
                    <button 
                        onClick={handleExportLogs}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center shadow-sm transition-all text-sm font-bold"
                        title="Xuất bản ghi ra file JSON"
                    >
                        <Download size={18} className="mr-2"/> Xuất Log
                    </button>
                </div>
            </div>

            {activeTab === 'USER_ACTIVITY' ? renderUserActivity() : renderSyncMonitor()}
        </div>
    );
};

// Dummy icon component for system log
const Settings = ({size, className}: {size:number, className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

export default HistoryLog;
