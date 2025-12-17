
import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Save, ToggleLeft, ToggleRight, Download, CheckCircle2, Settings as SettingsIcon, Globe, Database, Upload, AlertCircle, Bell, BellOff, Info, Image as ImageIcon, Share, PlusSquare, ArrowUpRight, Zap, Volume2, X, Lock, MoreVertical, Chrome, Menu, Key, ShieldCheck, RefreshCw, Megaphone, Flag, Link as LinkIcon } from 'lucide-react';
import { Member, SystemConfig, View } from '../types';
import { updateSystemConfigInDB, saveFirebaseConfig, clearFirebaseConfig, isFirebaseEnabled, subscribeToSystemConfig } from '../services/firebase';

interface SettingsProps {
  installPrompt: any;
  onInstall: () => void;
  onRequestNotification: () => Promise<boolean>;
  onBackup?: () => void;
  onRestore?: (file: File) => void;
  currentUser: Member;
  onUpdateMember: (updatedMember: Member) => void;
  onUpdateLogo?: (newLogo: string) => void; 
}

// Helper: Resize Image
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256; 
        const MAX_HEIGHT = 256;
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
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
            resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const Settings: React.FC<SettingsProps> = ({ installPrompt, onInstall, onRequestNotification, onBackup, onRestore, currentUser, onUpdateMember, onUpdateLogo }) => {
  const [appName, setAppName] = useState('Fugalo CRM');
  const [themeColor, setThemeColor] = useState('#0f172a');
  
  // --- LOAD SETTINGS ---
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [currentLogo, setCurrentLogo] = useState(() => localStorage.getItem('fugalo_app_logo') || 'https://i.imgur.com/KzXj0XJ.png');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSaved, setIsSaved] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  // Firebase Config State
  const [showConfig, setShowConfig] = useState(false);
  const [configMode, setConfigMode] = useState<'SIMPLE' | 'JSON'>('SIMPLE');
  
  // Announcement Config State
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementBullets, setAnnouncementBullets] = useState('');

  // Simple Mode Inputs
  const [simpleProjectId, setSimpleProjectId] = useState('');
  const [simpleApiKey, setSimpleApiKey] = useState('');

  // JSON Mode Input
  const [configInput, setConfigInput] = useState('');

  // Device Detection
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check Installation Status
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Check OS / Device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);
    setIsIOS(ios);
    setIsAndroid(android);

    // Check Notification Permission
    if ("Notification" in window) {
        setPermissionStatus(Notification.permission);
        setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Load System Config
    const unsubscribe = subscribeToSystemConfig((config) => {
        setAppName(config.appName);
        setThemeColor(config.themeColor);
        if (config.logoUrl) setCurrentLogo(config.logoUrl);
        if (config.announcement) {
            setAnnouncementEnabled(config.announcement.enabled);
            setAnnouncementTitle(config.announcement.title);
            setAnnouncementMessage(config.announcement.message);
            setAnnouncementBullets(config.announcement.bullets);
        }
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    try {
        await updateSystemConfigInDB({
            appName,
            themeColor,
            logoUrl: currentLogo,
            announcement: {
                enabled: announcementEnabled,
                title: announcementTitle,
                message: announcementMessage,
                bullets: announcementBullets
            }
            // Note: Top Banner Config is now handled in BroadcastManager, so we don't overwrite it here. 
            // The updateSystemConfigInDB function does a merge (setDoc with {merge: true}), 
            // but for local state safety, ideally we should read the full object before saving.
            // However, since we are using a dedicated module now, removing it from here prevents accidental overwrites.
        });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
        console.error("Failed to sync system config", e);
    }
  };

  const handleSaveFirebaseConfig = () => {
      let finalConfigStr = '';

      if (configMode === 'SIMPLE') {
          if (!simpleProjectId.trim() || !simpleApiKey.trim()) {
              alert("Vui lòng nhập đầy đủ Project ID và API Key.");
              return;
          }
          // Construct standard Firebase config object
          const config = {
              apiKey: simpleApiKey.trim(),
              authDomain: `${simpleProjectId.trim()}.firebaseapp.com`,
              projectId: simpleProjectId.trim(),
              storageBucket: `${simpleProjectId.trim()}.firebasestorage.app`,
              // Note: messagingSenderId and appId are optional for basic Firestore/Auth but recommended for full features.
              // For simple setup, this often suffices.
          };
          finalConfigStr = JSON.stringify(config);
      } else {
          // JSON MODE
          // PRE-VALIDATION: Check if user pasted "rules_version = '2'"
          if (configInput.trim().startsWith("rules_version") || configInput.includes("service cloud.firestore")) {
              alert("❌ BẠN ĐÃ DÁN NHẦM 'FIRESTORE RULES'!\n\nVui lòng làm theo hướng dẫn:\n1. Vào Firebase Console -> Project Settings\n2. Cuộn xuống phần 'Your apps' -> chọn Web App\n3. Copy đoạn mã 'const firebaseConfig = { ... }' hoặc chỉ phần nội dung trong ngoặc nhọn JSON.");
              return;
          }
          finalConfigStr = configInput;
      }

      const result = saveFirebaseConfig(finalConfigStr);
      if (result.success) {
          alert("✅ Lưu cấu hình thành công! Ứng dụng sẽ tải lại để kết nối Firebase.");
          window.location.reload();
      } else {
          alert(`❌ Cấu hình không hợp lệ.\n\nChi tiết lỗi: ${result.error}\n\nVui lòng kiểm tra lại.`);
      }
  };

  const handleResetFirebaseConfig = () => {
      if(window.confirm("Bạn có chắc chắn muốn xóa cấu hình và quay về mặc định?")) {
          clearFirebaseConfig();
          window.location.reload();
      }
  };

  const requestNotificationPermission = async () => {
      if (!("Notification" in window)) {
          alert("Trình duyệt này không hỗ trợ thông báo.");
          return;
      }

      // NẾU ĐÃ BỊ CHẶN: Không thể gọi hàm request được nữa, phải hiện hướng dẫn.
      if (permissionStatus === 'denied') {
          // Không làm gì ở đây, UI sẽ hiển thị box hướng dẫn màu đỏ
          return;
      }

      const granted = await onRequestNotification();
      if (granted) {
          setNotificationsEnabled(true);
          setPermissionStatus('granted');
          new Notification("Fugalo CRM", { body: "Đã bật thông báo thành công!", icon: currentLogo });
      } else {
          setPermissionStatus('denied');
          setNotificationsEnabled(false);
      }
  };

  const testNotification = () => {
      if (permissionStatus === 'granted') {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(e => console.log("Audio play prevented"));
          
          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification("Kiểm tra thông báo", {
                      body: "Hệ thống thông báo hoạt động tốt! 🚀",
                      icon: currentLogo,
                      vibrate: [200, 100, 200]
                  } as any);
              });
          } else {
              new Notification("Kiểm tra thông báo", { body: "Hệ thống thông báo hoạt động tốt! 🚀", icon: currentLogo });
          }
      } else {
          alert("Vui lòng cấp quyền thông báo trước.");
      }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const base64 = await resizeImage(file);
              setCurrentLogo(base64);
              if (onUpdateLogo) onUpdateLogo(base64);
              localStorage.setItem('fugalo_app_logo', base64);
          } catch (err) {
              alert("Lỗi xử lý ảnh.");
          }
      }
  };

  // Fallback Logo handler
  const handleImageError = () => {
      if (currentLogo !== 'https://fugalo.com.vn/uploads/logo-fugalo.png') {
          const fallback = 'https://fugalo.com.vn/uploads/logo-fugalo.png';
          setCurrentLogo(fallback);
          if (onUpdateLogo) onUpdateLogo(fallback);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      <div className="flex items-center gap-3 mb-4">
         <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-lg shadow-slate-200">
            <SettingsIcon size={24} />
         </div>
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Cấu hình Hệ thống</h2>
            <p className="text-slate-500 text-sm">Quản lý giao diện, thông báo và ứng dụng</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. APP INSTALLATION & PWA */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden flex flex-col h-full">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Smartphone size={120} />
              </div>
              
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4 border-b border-slate-50 pb-2">
                  <Download size={20} className="mr-2 text-purple-600"/>
                  Cài đặt Ứng dụng (App)
              </h3>

              <div className="space-y-4 relative z-10 flex-1">
                  {/* Status Box */}
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${isInstalled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isInstalled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                              {isInstalled ? <CheckCircle2 size={20}/> : <Smartphone size={20}/>}
                          </div>
                          <div>
                              <div className={`font-bold text-sm ${isInstalled ? 'text-green-800' : 'text-slate-800'}`}>{isInstalled ? 'Đã cài đặt' : 'Chưa cài đặt'}</div>
                              <div className="text-xs text-slate-500">{isInstalled ? 'Ứng dụng đang chạy độc lập' : 'Cài đặt để dùng mượt hơn'}</div>
                          </div>
                      </div>
                  </div>

                  {!isInstalled && (
                      <div className="space-y-3">
                          {installPrompt ? (
                              <button 
                                  onClick={onInstall}
                                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-200 transition-all flex items-center justify-center active:scale-95 animate-pulse"
                              >
                                  <Download size={18} className="mr-2" /> Cài đặt App ngay
                              </button>
                          ) : (
                              // MANUAL INSTRUCTIONS IF PROMPT IS MISSING
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-900">
                                  <div className="font-bold mb-3 flex items-center border-b border-blue-200 pb-2">
                                      <Info size={16} className="mr-2 text-blue-600"/> 
                                      Hướng dẫn cài thủ công:
                                  </div>
                                  
                                  {isIOS ? (
                                      // iOS Instruction
                                      <ol className="list-decimal pl-5 space-y-2 text-xs">
                                          <li>Nhấn nút <strong>Chia sẻ (Share)</strong> <Share size={12} className="inline mx-1 text-blue-600"/> trên thanh công cụ Safari.</li>
                                          <li>Cuộn xuống chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong> <PlusSquare size={12} className="inline mx-1 text-slate-600"/>.</li>
                                          <li>Nhấn <strong>Thêm (Add)</strong> ở góc trên cùng bên phải.</li>
                                      </ol>
                                  ) : isAndroid ? (
                                      // Android Instruction
                                      <ol className="list-decimal pl-5 space-y-2 text-xs">
                                          <li>Nhấn nút <strong>Menu (3 chấm)</strong> <MoreVertical size={12} className="inline mx-1 text-slate-600"/> ở góc trên bên phải Chrome.</li>
                                          <li>Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.</li>
                                          <li>Xác nhận <strong>Cài đặt</strong>.</li>
                                      </ol>
                                  ) : (
                                      // Desktop Instruction
                                      <ol className="list-decimal pl-5 space-y-2 text-xs">
                                          <li>
                                              Trên trình duyệt Chrome/Edge, nhìn lên thanh địa chỉ (góc phải).
                                          </li>
                                          <li>
                                              Tìm biểu tượng <Download size={12} className="inline mx-1 text-slate-600"/> hoặc nhấn vào <strong>Menu (3 chấm)</strong> <MoreVertical size={12} className="inline text-slate-600"/>.
                                          </li>
                                          <li>
                                              Chọn <strong>Cài đặt Fugalo CRM</strong> hoặc <strong>Lưu và chia sẻ</strong> &gt; <strong>Cài đặt</strong>.
                                          </li>
                                      </ol>
                                  )}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

          {/* 2. NOTIFICATIONS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4 border-b border-slate-50 pb-2">
                  <Bell size={20} className="mr-2 text-orange-500"/>
                  Thông báo & Âm thanh
              </h3>

              <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                      <div>
                          <div className="font-bold text-sm text-slate-800">Thông báo đẩy (Push)</div>
                          <div className="text-xs text-slate-500">Nhận tin khi có việc mới/quá hạn</div>
                      </div>
                      <button 
                          onClick={requestNotificationPermission}
                          disabled={permissionStatus === 'denied'} // Disable if denied
                          className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${notificationsEnabled ? 'bg-green-500' : 'bg-slate-300'} ${permissionStatus === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={permissionStatus === 'denied' ? "Bị chặn - Xem hướng dẫn bên dưới" : "Bật/Tắt thông báo"}
                      >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                  </div>

                  {/* INFO BOX FOR DENIED PERMISSION */}
                  {permissionStatus === 'denied' && (
                      <div className="bg-red-50 p-4 rounded-xl border border-red-200 animate-fade-in">
                          <div className="flex items-start gap-2">
                              <Lock size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                              <div>
                                  <h4 className="text-xs font-bold text-red-800 uppercase mb-1">Đã bị chặn bởi trình duyệt</h4>
                                  <p className="text-xs text-red-700 leading-relaxed mb-2">
                                      Bạn không thể bật lại nút này vì bạn đã chọn "Chặn" trước đó.
                                  </p>
                                  <div className="text-xs font-bold text-slate-700 mb-1">Cách mở lại:</div>
                                  <ol className="list-decimal pl-4 text-xs text-slate-600 space-y-1">
                                      <li>Bấm vào biểu tượng <strong>Ổ khóa (🔒)</strong> hoặc <strong>Cài đặt</strong> ngay bên trái thanh địa chỉ web.</li>
                                      <li>Tìm mục <strong>Quyền / Thông báo</strong>.</li>
                                      <li>Gạt công tắc sang <strong>Cho phép (Allow)</strong> hoặc nhấn nút <strong>Đặt lại (Reset)</strong>.</li>
                                      <li><strong>Tải lại trang này</strong> để áp dụng.</li>
                                  </ol>
                              </div>
                          </div>
                      </div>
                  )}

                  {notificationsEnabled && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                          <div className="flex items-center gap-2 mb-2 text-green-700 font-bold text-xs">
                              <CheckCircle2 size={14}/> Trạng thái: Đang hoạt động
                          </div>
                          <button 
                              onClick={testNotification}
                              className="w-full py-2 bg-white text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                          >
                              <Volume2 size={14} className="mr-1.5"/> Gửi thông báo thử
                          </button>
                      </div>
                  )}
              </div>
          </div>

          {/* 3. BRANDING */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4 border-b border-slate-50 pb-2">
                  <ImageIcon size={20} className="mr-2 text-blue-600"/>
                  Thương hiệu (Branding)
              </h3>
              
              <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-sm p-2">
                      <img 
                        src={currentLogo} 
                        onError={handleImageError} 
                        alt="Logo" 
                        className="w-full h-full object-contain" 
                      />
                  </div>
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Logo Hệ thống</label>
                      <div className="flex gap-2">
                          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center shadow-md">
                              <Upload size={14} className="mr-1.5"/> Tải ảnh mới
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange}/>
                          </label>
                          <button 
                              onClick={() => { const def = 'https://i.imgur.com/KzXj0XJ.png'; setCurrentLogo(def); if(onUpdateLogo) onUpdateLogo(def); }}
                              className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                          >
                              Mặc định
                          </button>
                      </div>
                  </div>
              </div>
              <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên ứng dụng</label>
                  <input 
                      type="text" 
                      value={appName} 
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
              </div>
          </div>

          {/* 4. ANNOUNCEMENT CONFIGURATION */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4 border-b border-slate-50 pb-2">
                  <Megaphone size={20} className="mr-2 text-red-600"/>
                  Cấu hình Bảng tin
              </h3>
              
              <div className="space-y-6">
                  {/* Login Welcome Modal Config */}
                  <div className="border-b border-slate-100 pb-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                          <div>
                              <div className="font-bold text-sm text-slate-800">1. Thông báo khi đăng nhập</div>
                              <div className="text-xs text-slate-500">Hiển thị popup chào mừng</div>
                          </div>
                          <button 
                              onClick={() => setAnnouncementEnabled(!announcementEnabled)}
                              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${announcementEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                          >
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${announcementEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </button>
                      </div>

                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu đề bảng tin</label>
                              <input 
                                  type="text" 
                                  value={announcementTitle} 
                                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                                  placeholder="Bảng Tin Nội Bộ"
                                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                              />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lời nhắn chào mừng</label>
                              <textarea 
                                  rows={2}
                                  value={announcementMessage} 
                                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                                  placeholder="Lời nhắn hiển thị đầu tiên..."
                                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu điểm tuần (Mỗi dòng 1 ý)</label>
                              <textarea 
                                  rows={3}
                                  value={announcementBullets} 
                                  onChange={(e) => setAnnouncementBullets(e.target.value)}
                                  placeholder="- Mục tiêu 1\n- Mục tiêu 2..."
                                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                              />
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* 5. DATA & DATABASE MANAGEMENT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2 lg:col-span-1">
              <h3 className="font-bold text-lg text-slate-800 flex items-center mb-4 border-b border-slate-50 pb-2">
                  <Database size={20} className="mr-2 text-green-600"/>
                  Dữ liệu & Cơ sở dữ liệu
              </h3>
              
              <div className="space-y-4">
                  
                  {/* Database Status Indicator */}
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${isFirebaseEnabled ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                      <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${isFirebaseEnabled ? 'bg-green-200 text-green-700' : 'bg-orange-200 text-orange-700'}`}>
                              <Database size={16} />
                          </div>
                          <div>
                              <div className={`text-xs font-bold ${isFirebaseEnabled ? 'text-green-800' : 'text-orange-800'}`}>
                                  {isFirebaseEnabled ? 'Đã kết nối Firebase' : 'Đang chạy Offline'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                  {isFirebaseEnabled ? 'Dữ liệu đang được đồng bộ' : 'Dữ liệu chỉ lưu trên máy này'}
                              </div>
                          </div>
                      </div>
                      <button 
                          onClick={() => setShowConfig(!showConfig)}
                          className="text-xs text-blue-600 font-bold hover:underline"
                      >
                          {showConfig ? 'Ẩn cấu hình' : 'Cấu hình'}
                      </button>
                  </div>

                  {/* DYNAMIC CONFIG INPUT */}
                  {showConfig && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fade-in">
                          <div className="flex bg-white p-1 rounded-lg border border-slate-200 mb-4 w-fit">
                              <button 
                                  onClick={() => setConfigMode('SIMPLE')}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${configMode === 'SIMPLE' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                              >
                                  Nhập cơ bản
                              </button>
                              <button 
                                  onClick={() => setConfigMode('JSON')}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${configMode === 'JSON' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}
                              >
                                  Dán JSON (Nâng cao)
                              </button>
                          </div>

                          {configMode === 'SIMPLE' ? (
                              <div className="space-y-3 mb-3">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1">Project ID <span className="text-red-500">*</span></label>
                                      <input 
                                          type="text" 
                                          value={simpleProjectId}
                                          onChange={(e) => setSimpleProjectId(e.target.value)}
                                          placeholder="VD: my-crm-project-123"
                                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                      />
                                      <p className="text-[10px] text-slate-400 mt-1">Tìm thấy trong Project Settings {'>'} General</p>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1">API Key <span className="text-red-500">*</span></label>
                                      <input 
                                          type="text" 
                                          value={simpleApiKey}
                                          onChange={(e) => setSimpleApiKey(e.target.value)}
                                          placeholder="VD: AIzaSyD..."
                                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                      />
                                  </div>
                              </div>
                          ) : (
                              <>
                                  <div className="flex items-start gap-2 mb-3 bg-blue-50 p-2 rounded-lg border border-blue-100">
                                      <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0"/>
                                      <p className="text-[10px] text-blue-800">
                                          Để kết nối Online, hãy vào <b>Firebase Console {'>'} Project Settings {'>'} General {'>'} Your apps</b> và copy đoạn mã <code>const firebaseConfig = {'{...}'}</code>.
                                      </p>
                                  </div>
                                  <label className="block text-xs font-bold text-slate-600 mb-2">
                                      Dán mã JSON Config (Không phải Rules!):
                                  </label>
                                  <textarea 
                                      rows={6}
                                      value={configInput}
                                      onChange={(e) => setConfigInput(e.target.value)}
                                      placeholder='{ "apiKey": "AIzaSy...", "authDomain": "...", ... }'
                                      className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                                  />
                              </>
                          )}

                          <div className="flex gap-2 justify-end">
                              <button 
                                  onClick={handleResetFirebaseConfig}
                                  className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                              >
                                  Reset Mặc định
                              </button>
                              <button 
                                  onClick={handleSaveFirebaseConfig}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center"
                              >
                                  <Save size={14} className="mr-1.5"/> Lưu & Kết nối
                              </button>
                          </div>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                          onClick={onBackup}
                          className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center transition-all"
                      >
                          <Download size={14} className="mr-1.5"/> Backup
                      </button>
                      
                      <div className="relative">
                          <input 
                              type="file" 
                              accept=".json"
                              onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if(file && onRestore) {
                                      if(window.confirm("Dữ liệu hiện tại sẽ bị ghi đè. Tiếp tục?")) onRestore(file);
                                  }
                                  e.target.value = '';
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center transition-all">
                              <Upload size={14} className="mr-1.5"/> Restore
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* FOOTER SAVE BUTTON */}
      <div className="fixed bottom-6 right-6 z-30">
          <button 
            onClick={handleSave}
            className={`flex items-center px-6 py-3 rounded-full text-white font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95 ${isSaved ? 'bg-green-600' : 'bg-slate-900'}`}
          >
              {isSaved ? <CheckCircle2 size={20} className="mr-2"/> : <Save size={20} className="mr-2"/>}
              {isSaved ? 'Đã lưu cấu hình' : 'Lưu thay đổi'}
          </button>
      </div>
    </div>
  );
};

export default Settings;
