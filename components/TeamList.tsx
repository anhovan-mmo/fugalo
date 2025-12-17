
import React, { useState, useEffect } from 'react';
import { Member, Role, Department, checkPermission, RoleConfig, getRoleLevel, ROLE_DEFINITIONS } from '../types';
import { Mail, Phone, ShieldCheck, Users, Camera, Share2, Network, Crown, ClipboardList, Pencil, X, Save, LayoutList, GitFork, Upload, Lock, Unlock, Info, Check, Ban, RotateCcw, Shield, Eye, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Briefcase, Settings as SettingsIcon, PieChart, History, Wallet, Key, EyeOff, LogIn } from 'lucide-react';

interface TeamListProps {
  members: Member[];
  currentUser: Member;
  onAssignTask?: (memberId: string) => void;
  onUpdateMember?: (updatedMember: Member) => void;
  rolePermissions: Record<Role, RoleConfig>;
  onUpdatePermissions: (config: Record<Role, RoleConfig>) => void;
  onSwitchUser?: (member: Member) => void; 
  logoUrl?: string; // New Prop
}

// --- CONSTANTS: HIERARCHY ORDER ---
const ROLE_DISPLAY_ORDER: Role[] = [
    // --- BOARD (Ban Giám Đốc) ---
    Role.BOARD,             // 0. Ban Giám Đốc
    Role.MANAGER,           // 1. Trưởng phòng
    Role.DEPUTY_MANAGER,    // 2. Phó phòng
    
    // --- LEADERS (Quản lý cấp trung) ---
    Role.DOP,               // 3. Art Director
    Role.MEDIA_LEADER,      // 4. Trưởng nhóm Media
    Role.SOCIAL_LEADER,     // 5. Trưởng nhóm Content
    Role.SEEDING_LEADER,    // 6. Trưởng nhóm Seeding
    
    // --- SPECIALISTS (Chuyên viên) ---
    Role.PLANNER,           // 7. Planner (New)
    Role.DESIGNER,          // 8. Designer (New)
    Role.MEDIA,             // 9. Media Editor
    Role.PHOTO,             // 10. Photographer
    Role.SOCIAL,            // 11. Content Creator
    Role.SEEDING            // 12. Seeding Staff
];

const getRoleCategory = (role: Role): string | null => {
    if (role === Role.BOARD) return "HỘI ĐỒNG QUẢN TRỊ (BOARD)";
    if (role === Role.MANAGER) return "BAN QUẢN LÝ (MANAGEMENT)";
    if (role === Role.DOP) return "QUẢN LÝ CẤP TRUNG (LEADERS)";
    if (role === Role.PLANNER) return "CHUYÊN VIÊN & NHÂN SỰ (STAFF)";
    return null;
}

// --- HELPER: RESIZE IMAGE TO BASE64 ---
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        const MAX_HEIGHT = 300;
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
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
            resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// --- ORG CHART COMPONENTS ---
const OrgNode: React.FC<{ member: Member; isRoot?: boolean; colorClass: string }> = ({ member, isRoot, colorClass }) => (
  <div className={`flex flex-col items-center bg-white border-2 rounded-xl p-3 shadow-sm hover:shadow-md transition-all relative z-10 w-48 ${colorClass}`}>
    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden mb-2 border border-slate-200">
         {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-500">
                {member.name.charAt(0)}
            </div>
        )}
    </div>
    <div className="text-center">
        <h4 className="font-bold text-slate-800 text-xs truncate w-full">{member.name}</h4>
        <p className="text-[10px] font-semibold text-slate-500 truncate w-40">{member.role}</p>
    </div>
    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-slate-300"></div>
    {!isRoot && (
         <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-slate-300"></div>
    )}
  </div>
);

const OrgChart: React.FC<{ members: Member[]; logoUrl?: string }> = ({ members, logoUrl }) => {
    const board = members.find(m => m.roleType === Role.BOARD);
    const manager = members.find(m => m.roleType === Role.MANAGER);
    const deputy = members.find(m => m.roleType === Role.DEPUTY_MANAGER);
    
    const leaders = [
        members.find(m => m.roleType === Role.DOP),
        members.find(m => m.roleType === Role.MEDIA_LEADER),
        members.find(m => m.roleType === Role.SOCIAL_LEADER),
        members.find(m => m.roleType === Role.SEEDING_LEADER),
    ].filter(Boolean) as Member[];

    const getStaff = (leader: Member) => {
        let candidates = members.filter(m => m.department === leader.department && m.id !== leader.id);
        candidates = candidates.filter(m => 
            m.roleType !== Role.BOARD &&
            m.roleType !== Role.MANAGER &&
            m.roleType !== Role.DEPUTY_MANAGER &&
            m.roleType !== Role.DOP &&
            m.roleType !== Role.MEDIA_LEADER &&
            m.roleType !== Role.SOCIAL_LEADER &&
            m.roleType !== Role.SEEDING_LEADER
        );
        if (leader.department === 'Media') {
            if (leader.roleType === Role.MEDIA_LEADER) {
                return candidates.filter(c => !c.reportsTo.includes('DOP'));
            }
            if (leader.roleType === Role.DOP) {
                return candidates.filter(c => c.reportsTo.includes('DOP') || c.reportsTo.includes('Art'));
            }
        }
        return candidates;
    };

    const getColor = (dept: Department) => {
        switch(dept) {
            case 'Board': return 'border-red-500';
            case 'DieuHanh': return 'border-yellow-400';
            case 'Media': return 'border-purple-200';
            case 'Content': return 'border-pink-200';
            case 'Seeding': return 'border-teal-200';
            default: return 'border-slate-200';
        }
    };

    return (
        <div className="overflow-x-auto p-10 flex justify-center bg-slate-50 rounded-xl border border-slate-200 min-h-[600px] custom-scrollbar">
            <div className="flex flex-col items-center space-y-8 min-w-max">
                
                {/* --- BAN GIÁM ĐỐC (BOARD) NODE --- */}
                {board ? (
                    <div className="relative">
                        <OrgNode member={board} isRoot={true} colorClass="border-red-500 ring-4 ring-red-50" />
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0.5 h-8 bg-slate-300"></div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="flex flex-col items-center bg-white border-4 border-red-500 rounded-2xl p-6 shadow-2xl z-20 w-72 ring-4 ring-orange-100 relative">
                            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-3 shadow-md overflow-hidden relative border border-slate-100">
                                <img src={logoUrl || "https://i.imgur.com/KzXj0XJ.png"} alt="FUGALO BGĐ" className="w-full h-full object-contain p-1" />
                            </div>
                            <div className="text-center">
                                <h4 className="font-extrabold text-red-700 text-xl uppercase tracking-widest">Ban Giám Đốc</h4>
                                <p className="text-xs text-slate-500 font-bold tracking-wide mt-1 uppercase">Board of Directors</p>
                            </div>
                            <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0.5 h-8 bg-slate-300"></div>
                        </div>
                    </div>
                )}

                {/* MANAGER NODE */}
                {manager && (
                    <div className="relative">
                        {/* Connector up to Board */}
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                        <OrgNode member={manager} isRoot={false} colorClass="border-yellow-400 ring-2 ring-yellow-50" />
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0.5 h-8 bg-slate-300"></div>
                    </div>
                )}

                {deputy && (
                    <div className="relative">
                        <OrgNode member={deputy} colorClass="border-blue-300 ring-2 ring-blue-50" />
                         <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0.5 h-8 bg-slate-300"></div>
                    </div>
                )}
                
                <div className="relative pt-4">
                    <div className="absolute top-0 left-10 right-10 h-4 border-t-2 border-l-2 border-r-2 border-slate-300 rounded-t-xl"></div>
                    <div className="flex space-x-8 items-start">
                        {leaders.map((leader, idx) => {
                            const staff = getStaff(leader);
                            return (
                                <div key={leader.id} className="flex flex-col items-center relative">
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-slate-300"></div>
                                    <OrgNode member={leader} colorClass={getColor(leader.department)} />
                                    {staff.length > 0 && (
                                        <div className="flex flex-col items-center mt-8 space-y-4 relative">
                                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                                            {staff.map(s => (
                                                <div key={s.id} className="relative">
                                                    <OrgNode member={s} colorClass={getColor(s.department).replace('200', '100')} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (Rest of component remains same) ...
// --- HELPER COMPONENTS ---
const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button 
        onClick={onChange} 
        disabled={disabled}
        className={`transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
    >
        {checked ? (
            <ToggleRight size={32} className="text-blue-600 fill-blue-50" />
        ) : (
            <ToggleLeft size={32} className="text-slate-300" />
        )}
    </button>
);

// --- MAIN COMPONENT ---

const TeamList: React.FC<TeamListProps> = ({ 
    members, 
    currentUser, 
    onAssignTask, 
    onUpdateMember, 
    rolePermissions, 
    onUpdatePermissions,
    onSwitchUser, 
    logoUrl
}) => {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'CHART' | 'PERMISSIONS'>('LIST');

  // Permission Matrix State
  const [localPermissionState, setLocalPermissionState] = useState(rolePermissions);
  const isAdmin = currentUser.roleType === Role.MANAGER || currentUser.roleType === Role.BOARD;

  // Sync local state when prop updates
  useEffect(() => {
    setLocalPermissionState(rolePermissions);
  }, [rolePermissions]);

  // Edit Form State
  const [formData, setFormData] = useState<Partial<Member>>({});
  
  // Password Change & View State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleEditClick = (member: Member) => {
    const isSelf = currentUser.id === member.id;
    // Board members can edit everyone
    const isBoard = currentUser.roleType === Role.BOARD;
    const hasManagePermission = checkPermission(currentUser, 'manageTeam', rolePermissions);

    if (isSelf || isBoard || hasManagePermission) {
        setEditingMember(member);
        setFormData({ ...member });
        // Reset password fields
        setShowPasswordChange(false);
        setShowCurrentPassword(false); // Reset visibility
        setNewPassword('');
        setConfirmPassword('');
    } else {
        alert("⛔ Bạn không có quyền chỉnh sửa thông tin của thành viên này.");
    }
  };

  const handleSwitchUser = (member: Member) => {
      if (onSwitchUser) {
          if (window.confirm(`Xác nhận đăng nhập với tư cách: ${member.name}?`)) {
              onSwitchUser(member);
          }
      }
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      
      let updatedData = { ...formData };

      // Handle Password Change
      if (showPasswordChange) {
          if (!newPassword) {
              alert("Vui lòng nhập mật khẩu mới.");
              return;
          }
          if (newPassword.length < 6) {
              alert("Mật khẩu phải có ít nhất 6 ký tự.");
              return;
          }
          if (newPassword !== confirmPassword) {
              alert("Mật khẩu xác nhận không khớp.");
              return;
          }
          updatedData.password = newPassword;
      }

      if (editingMember && onUpdateMember && updatedData.name) {
          onUpdateMember({ ...editingMember, ...updatedData } as Member);
          setEditingMember(null);
          // Optional alert
          if(showPasswordChange) alert("Đã cập nhật mật khẩu và thông tin thành công!");
      }
  };

  const handleInputChange = (field: keyof Member, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (field === 'roleType') {
          const config = rolePermissions[value as Role]; 
          if (config) {
             setFormData(prev => ({ ...prev, roleType: value as Role, role: config.label })); 
          }
      }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const base64String = await resizeImage(file);
            handleInputChange('avatar', base64String);
        } catch (error) {
            console.error("Error resizing image", error);
            alert("Lỗi xử lý ảnh, vui lòng thử lại ảnh khác.");
        }
    }
  };
  
  const handlePermissionToggle = (roleKey: string, permissionKey: keyof RoleConfig['permissions']) => {
      if (!isAdmin) return;
      setLocalPermissionState(prev => {
          const role = roleKey as Role;
          const currentConfig = prev[role];
          return {
              ...prev,
              [role]: {
                  ...currentConfig,
                  permissions: {
                      ...currentConfig.permissions,
                      [permissionKey]: !currentConfig.permissions[permissionKey]
                  }
              }
          };
      });
  };

  const savePermissions = () => {
      onUpdatePermissions(localPermissionState);
      alert("Đã lưu cấu hình phân quyền thành công! Hệ thống sẽ cập nhật ngay lập tức.");
  };

  const resetPermissions = () => {
      if(window.confirm("Bạn có chắc chắn muốn khôi phục cấu hình phân quyền về mặc định?")) {
          setLocalPermissionState(ROLE_DEFINITIONS);
          onUpdatePermissions(ROLE_DEFINITIONS);
      }
  };

  const groupedMembers = {
    Board: members.filter(m => m.department === 'Board'),
    DieuHanh: members.filter(m => m.department === 'DieuHanh'),
    Content: members.filter(m => m.department === 'Content'),
    Media: members.filter(m => m.department === 'Media'),
    Seeding: members.filter(m => m.department === 'Seeding'),
  };

  const getGroupInfo = (dept: Department) => {
    switch (dept) {
      case 'Board':
        return {
            title: 'Hội Đồng Quản Trị',
            desc: 'Lãnh đạo cấp cao nhất.',
            icon: <Crown className="text-red-600" size={24} />,
            bg: 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100',
            headerColor: 'text-red-800'
        };
      case 'DieuHanh':
        return { 
          title: 'Ban Quản Lý & Điều Hành', 
          desc: 'Quản lý vận hành và chiến lược Marketing.', 
          icon: <ShieldCheck className="text-yellow-600" size={24} />,
          bg: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-100',
          headerColor: 'text-yellow-800'
        };
      case 'Content':
        return { 
          title: 'Content & Social', 
          desc: 'Sáng tạo nội dung và quản lý kênh truyền thông xã hội.', 
          icon: <Share2 className="text-pink-600" size={24} />,
          bg: 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-100',
          headerColor: 'text-pink-800'
        };
      case 'Media':
        return { 
          title: 'Media & Production', 
          desc: 'Sản xuất hình ảnh, video và tư liệu truyền thông.', 
          icon: <Camera className="text-purple-600" size={24} />,
          bg: 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100',
          headerColor: 'text-purple-800'
        };
      case 'Seeding':
        return { 
          title: 'Seeding & Community', 
          desc: 'Lan tỏa thông điệp và quản lý cộng đồng.', 
          icon: <Network className="text-teal-600" size={24} />,
          bg: 'bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-100',
          headerColor: 'text-teal-800'
        };
    }
  };

  const renderMemberCard = (member: Member) => {
    // Board members and Managers are leaders
    const isLeader = rolePermissions[member.roleType]?.permissions.manageTeam;
    const isSelf = currentUser.id === member.id;
    // Admin (Board/Manager) can edit everyone
    const canEditThisMember = isSelf || isAdmin;
    
    const canImpersonate = isAdmin && !isSelf;

    const canAssign = () => {
        if (!checkPermission(currentUser, 'assignTasks', rolePermissions)) return false;
        const myLevel = getRoleLevel(currentUser.roleType);
        const targetLevel = getRoleLevel(member.roleType);
        if (member.id === currentUser.id) return true;
        return myLevel >= targetLevel;
    };

    return (
      <div key={member.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all group relative flex flex-col">
        {isLeader && (
            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm z-10 flex items-center">
                <ShieldCheck size={10} className="mr-1" />
                Quản lý
            </div>
        )}
        
        <div className="absolute top-2 right-2 flex gap-1 z-20">
            {canImpersonate && (
                <button
                    onClick={() => handleSwitchUser(member)}
                    className="p-1.5 bg-purple-100 text-purple-600 rounded-full shadow-sm hover:bg-purple-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title={`Đăng nhập với tư cách: ${member.name}`}
                >
                    <LogIn size={14} />
                </button>
            )}
            {canEditThisMember && (
                <button 
                    onClick={() => handleEditClick(member)}
                    className="p-1.5 bg-white/90 rounded-full shadow-sm text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={isSelf ? "Cập nhật thông tin cá nhân" : "Chỉnh sửa thông tin nhân sự"}
                >
                    <Pencil size={14} />
                </button>
            )}
        </div>

        <div className="p-4 flex items-start gap-4">
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-slate-100 p-0.5 shadow-sm overflow-hidden border border-slate-100">
                    {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                            {member.name.charAt(0)}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                    {member.name}
                </h3>
                <p className="text-xs font-semibold text-blue-600 mb-1 truncate" title={member.role}>{member.role}</p>
                
                <div className="flex items-center text-[10px] text-slate-500 bg-slate-50 rounded px-1.5 py-0.5 w-fit border border-slate-100" title="Báo cáo cho">
                    <span className="mr-1 text-slate-400">Reports to:</span>
                    <span className="font-bold text-slate-700">{member.reportsTo}</span>
                </div>
            </div>
        </div>

        <div className="mt-auto px-4 pb-4 pt-0">
            <div className="flex flex-col gap-1.5 border-t border-slate-50 pt-3">
                <a href={`mailto:${member.email}`} className="flex items-center text-xs text-slate-500 hover:text-blue-600 transition-colors truncate">
                    <Mail size={12} className="mr-2 flex-shrink-0" />
                    {member.email}
                </a>
                <a href={`tel:${member.phone}`} className="flex items-center text-xs text-slate-500 hover:text-green-600 transition-colors truncate">
                    <Phone size={12} className="mr-2 flex-shrink-0" />
                    {member.phone}
                </a>
            </div>

            {onAssignTask && canAssign() && (
                <button 
                    onClick={() => onAssignTask(member.id)}
                    className="w-full mt-3 bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-bold py-1.5 rounded-lg shadow-sm flex items-center justify-center transition-all"
                >
                    <ClipboardList size={14} className="mr-1.5" />
                    Giao việc
                </button>
            )}
        </div>
      </div>
    );
  };

  const getSelectedRolePermissions = () => {
      if (!formData.roleType) return null;
      return rolePermissions[formData.roleType];
  };

  const selectedRoleConfig = getSelectedRolePermissions();

  // ... (Permission Tab Rendering Logic - kept same)
  const renderPermissionsTab = () => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col animate-fade-in">
          {/* ... existing headers ... */}
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-50 to-white rounded-t-xl">
              <div>
                  <h3 className="font-bold text-slate-800 text-xl flex items-center">
                      <Shield size={24} className="mr-2 text-blue-600" />
                      Ma trận Phân quyền (RBAC Matrix)
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                      Kiểm soát chi tiết quyền truy cập Module và Thao tác của 12 chức danh.
                  </p>
              </div>
              
              {isAdmin ? (
                  <div className="flex items-center gap-3">
                      <button 
                          onClick={resetPermissions}
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 flex items-center shadow-sm"
                      >
                          <RotateCcw size={16} className="mr-2"/> Khôi phục
                      </button>
                      <button 
                          onClick={savePermissions}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md flex items-center"
                      >
                          <Save size={16} className="mr-2"/> Lưu thay đổi
                      </button>
                  </div>
              ) : (
                  <div className="flex items-center text-orange-600 bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 shadow-sm">
                      <Lock size={16} className="mr-2"/>
                      <span className="text-sm font-bold">Chế độ Xem (Chỉ Admin được sửa)</span>
                  </div>
              )}
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      {/* ... existing headers ... */}
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                          <th className="p-4 border-r border-slate-200 min-w-[250px] bg-slate-50 sticky left-0 z-20">Vai trò / Chức danh</th>
                          
                          {/* Data Permissions Group */}
                          <th className="p-2 text-center min-w-[80px] bg-white/50 border-r border-dashed border-slate-200 group relative">
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                  <Eye size={16} className="text-slate-400"/>
                                  <span className="text-[10px]">Xem</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[80px] bg-white/50 border-r border-dashed border-slate-200 group relative">
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                  <Plus size={16} className="text-green-500"/>
                                  <span className="text-[10px]">Tạo</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[80px] bg-white/50 border-r border-dashed border-slate-200 group relative">
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                  <Edit size={16} className="text-blue-500"/>
                                  <span className="text-[10px]">Sửa</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[80px] bg-white/50 border-r border-slate-200 group relative">
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                  <Trash2 size={16} className="text-red-500"/>
                                  <span className="text-[10px]">Xóa</span>
                              </div>
                          </th>

                          {/* Management Permissions Group */}
                          <th className="p-2 text-center min-w-[100px] bg-blue-50/30 border-r border-dashed border-blue-100 group relative">
                              <div className="flex flex-col items-center gap-1 text-blue-700 cursor-help">
                                  <ClipboardList size={16}/>
                                  <span className="text-[10px]">Giao việc</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[100px] bg-blue-50/30 border-r border-dashed border-blue-100 group relative">
                              <div className="flex flex-col items-center gap-1 text-blue-700 cursor-help">
                                  <ShieldCheck size={16}/>
                                  <span className="text-[10px]">Quản lý Team</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[100px] bg-blue-50/30 border-r border-blue-200 group relative">
                              <div className="flex flex-col items-center gap-1 text-blue-700 cursor-help">
                                  <Check size={16}/>
                                  <span className="text-[10px]">Duyệt Bài</span>
                              </div>
                          </th>

                          {/* Menu Access Group */}
                          <th className="p-2 text-center min-w-[100px] bg-purple-50/30 border-r border-dashed border-purple-100 group relative">
                              <div className="flex flex-col items-center gap-1 text-purple-700 cursor-help">
                                  <PieChart size={16}/>
                                  <span className="text-[10px]">Menu Báo cáo</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[100px] bg-purple-50/30 border-r border-dashed border-purple-100 group relative">
                              <div className="flex flex-col items-center gap-1 text-purple-700 cursor-help">
                                  <History size={16}/>
                                  <span className="text-[10px]">Menu Lịch sử</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[100px] bg-purple-50/30 border-r border-dashed border-purple-100 group relative">
                              <div className="flex flex-col items-center gap-1 text-purple-700 cursor-help">
                                  <Wallet size={16}/>
                                  <span className="text-[10px]">Ngân sách</span>
                              </div>
                          </th>
                          <th className="p-2 text-center min-w-[100px] bg-purple-50/30 group relative">
                              <div className="flex flex-col items-center gap-1 text-purple-700 cursor-help">
                                  <SettingsIcon size={16}/>
                                  <span className="text-[10px]">Menu Cấu hình</span>
                              </div>
                          </th>
                      </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                      {ROLE_DISPLAY_ORDER.map((role) => {
                          const config = localPermissionState[role];
                          const header = getRoleCategory(role);
                          
                          if (!config) return null; // Safety check

                          return (
                              <React.Fragment key={role}>
                                  {header && (
                                      <tr className="bg-slate-100 border-y border-slate-200">
                                          <td colSpan={12} className="px-4 py-2 font-black text-xs text-slate-500 uppercase tracking-widest sticky left-0 z-10 bg-slate-100">
                                              {header}
                                          </td>
                                      </tr>
                                  )}
                                  <tr className="hover:bg-slate-50 transition-colors group">
                                      <td className="p-4 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                          <div className="font-bold text-slate-800 text-sm">{config.label}</div>
                                          <div className="text-[10px] text-slate-400 font-mono mt-1">{role}</div>
                                      </td>
                                      
                                      {/* Data Toggles */}
                                      <td className="p-2 text-center border-r border-dashed border-slate-200"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.view} onChange={() => handlePermissionToggle(role, 'view')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-dashed border-slate-200"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.create} onChange={() => handlePermissionToggle(role, 'create')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-dashed border-slate-200"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.edit} onChange={() => handlePermissionToggle(role, 'edit')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-slate-200 bg-red-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.delete} onChange={() => handlePermissionToggle(role, 'delete')} disabled={!isAdmin} /></div></td>
                                      
                                      {/* Management Toggles */}
                                      <td className="p-2 text-center border-r border-dashed border-blue-100 bg-blue-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.assignTasks} onChange={() => handlePermissionToggle(role, 'assignTasks')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-dashed border-blue-100 bg-blue-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.manageTeam} onChange={() => handlePermissionToggle(role, 'manageTeam')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-blue-200 bg-blue-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.approveAssets} onChange={() => handlePermissionToggle(role, 'approveAssets')} disabled={!isAdmin} /></div></td>

                                      {/* Menu Access Toggles */}
                                      <td className="p-2 text-center border-r border-dashed border-purple-100 bg-purple-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.viewReports} onChange={() => handlePermissionToggle(role, 'viewReports')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-dashed border-purple-100 bg-purple-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.viewHistory} onChange={() => handlePermissionToggle(role, 'viewHistory')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center border-r border-dashed border-purple-100 bg-purple-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.manageBudget} onChange={() => handlePermissionToggle(role, 'manageBudget')} disabled={!isAdmin} /></div></td>
                                      <td className="p-2 text-center bg-purple-50/10"><div className="flex justify-center"><ToggleSwitch checked={config.permissions.configureSystem} onChange={() => handlePermissionToggle(role, 'configureSystem')} disabled={!isAdmin} /></div></td>
                                  </tr>
                              </React.Fragment>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
  );

  // ... (Render Section logic - kept same) ...
  const renderSection = (dept: keyof typeof groupedMembers) => {
    const groupMembers = groupedMembers[dept];
    if (!groupMembers || groupMembers.length === 0) return null;

    const info = getGroupInfo(dept as Department);

    return (
      <div key={dept} className={`rounded-xl border shadow-sm overflow-hidden ${info.bg}`}>
        <div className="p-4 border-b border-white/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                    {info.icon}
                </div>
                <div>
                    <h3 className={`font-bold text-lg ${info.headerColor}`}>{info.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{info.desc}</p>
                </div>
            </div>
            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-slate-500 shadow-sm border border-slate-100">
                {groupMembers.length} nhân sự
            </span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupMembers.map(renderMemberCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Quản lý Nhân sự</h2>
            <p className="text-sm text-slate-500 mt-1">
                {viewMode === 'LIST' && 'Danh sách thành viên và thông tin liên hệ.'}
                {viewMode === 'CHART' && 'Sơ đồ tổ chức phòng Marketing.'}
                {viewMode === 'PERMISSIONS' && 'Cấu hình phân quyền hệ thống (RBAC).'}
            </p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setViewMode('LIST')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        viewMode === 'LIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <LayoutList size={14} className="mr-2"/> Danh sách
                </button>
                <button
                    onClick={() => setViewMode('CHART')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        viewMode === 'CHART' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <GitFork size={14} className="mr-2"/> Sơ đồ
                </button>
                <button
                    onClick={() => setViewMode('PERMISSIONS')}
                    className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${
                        viewMode === 'PERMISSIONS' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <ShieldCheck size={14} className="mr-2"/> Phân quyền
                </button>
            </div>
        </div>
      </div>

      {viewMode === 'LIST' && (
          <div className="space-y-8 animate-fade-in">
             {renderSection('Board')}
             {renderSection('DieuHanh')}
             {renderSection('Content')}
             {renderSection('Media')}
             {renderSection('Seeding')}
          </div>
      )}

      {viewMode === 'CHART' && (
          <div className="animate-fade-in">
              <OrgChart members={members} logoUrl={logoUrl} />
          </div>
      )}

      {viewMode === 'PERMISSIONS' && renderPermissionsTab()}

      {/* MODAL: Edit Member */}
      {editingMember && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
                      <h3 className="font-bold text-slate-800 flex items-center">
                          <Pencil size={18} className="mr-2 text-blue-600" />
                          {isAdmin ? 'Chỉnh sửa nhân sự' : 'Cập nhật thông tin cá nhân'}
                      </h3>
                      <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                      {/* ... (Existing form content unchanged) ... */}
                      <div className="flex justify-center mb-6">
                        <div className="relative group cursor-pointer">
                            <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                                {formData.avatar ? (
                                    <img src={formData.avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-3xl font-bold text-slate-400">{formData.name?.charAt(0)}</div>
                                )}
                            </div>
                            <label className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer backdrop-blur-sm">
                                <Camera size={24} className="mb-1" />
                                <span className="text-[10px] font-bold">Đổi ảnh</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleImageChange}
                                />
                            </label>
                            <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm border-2 border-white group-hover:opacity-0 transition-opacity">
                                <Upload size={12} />
                            </div>
                        </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Họ và tên</label>
                          <input 
                            type="text" 
                            required
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                            <input 
                                type="email" 
                                required
                                value={formData.email || ''}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Số điện thoại</label>
                            <input 
                                type="text" 
                                required
                                value={formData.phone || ''}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                         </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                              <span>Vị trí (Role) {isAdmin ? '' : '(Chỉ đọc)'}</span>
                              {isAdmin && (
                                  <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Admin Only</span>
                              )}
                          </label>
                          <select 
                             value={formData.roleType}
                             onChange={(e) => handleInputChange('roleType', e.target.value)}
                             disabled={!isAdmin}
                             className={`w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!isAdmin ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                          >
                              {Object.keys(rolePermissions).map(r => (
                                  <option key={r} value={r}>{rolePermissions[r as Role].label}</option>
                              ))}
                          </select>
                      </div>

                      {/* Permission Preview Block */}
                      {selectedRoleConfig && (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-slate-700 flex items-center">
                                      <ShieldCheck size={12} className="mr-1 text-blue-600"/>
                                      Quyền hạn của Role:
                                  </span>
                                  {isAdmin && (
                                      <button 
                                          type="button"
                                          onClick={() => {
                                              setEditingMember(null);
                                              setViewMode('PERMISSIONS');
                                          }}
                                          className="text-blue-600 hover:underline flex items-center font-semibold"
                                      >
                                          Sửa quyền <Share2 size={10} className="ml-1"/>
                                      </button>
                                  )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <div className="flex items-center">
                                      {selectedRoleConfig.permissions.view ? <Check size={14} className="text-green-600 mr-1"/> : <Ban size={14} className="text-slate-400 mr-1"/>}
                                      <span>Xem dữ liệu</span>
                                  </div>
                                  <div className="flex items-center">
                                      {selectedRoleConfig.permissions.create ? <Check size={14} className="text-green-600 mr-1"/> : <Ban size={14} className="text-slate-400 mr-1"/>}
                                      <span>Tạo mới</span>
                                  </div>
                                  <div className="flex items-center">
                                      {selectedRoleConfig.permissions.manageTeam ? <Check size={14} className="text-blue-600 mr-1"/> : <Ban size={14} className="text-slate-400 mr-1"/>}
                                      <span className={selectedRoleConfig.permissions.manageTeam ? "font-bold text-blue-700" : ""}>Quản trị hệ thống</span>
                                  </div>
                              </div>
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Chức danh hiển thị</label>
                             <input 
                                type="text" 
                                required
                                value={formData.role || ''}
                                onChange={(e) => handleInputChange('role', e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                             />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Bộ phận {isAdmin ? '' : '(Chỉ đọc)'}</label>
                            <select 
                                value={formData.department}
                                onChange={(e) => handleInputChange('department', e.target.value)}
                                disabled={!isAdmin}
                                className={`w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!isAdmin ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                            >
                                <option value="Board">Ban Giám Đốc</option>
                                <option value="DieuHanh">Điều Hành</option>
                                <option value="Media">Media</option>
                                <option value="Content">Content</option>
                                <option value="Seeding">Seeding</option>
                            </select>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Báo cáo cho (Reports To) {isAdmin ? '' : '(Chỉ đọc)'}</label>
                          <input 
                            type="text" 
                            value={formData.reportsTo || ''}
                            onChange={(e) => handleInputChange('reportsTo', e.target.value)}
                            disabled={!isAdmin}
                            className={`w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${!isAdmin ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                          />
                      </div>

                      {/* --- ADMIN ONLY: VIEW CURRENT SECURITY CODE --- */}
                      {isAdmin && editingMember?.password && (
                          <div className="bg-red-50 p-4 rounded-xl border border-red-200 mb-4 animate-fade-in">
                              <div className="flex justify-between items-center">
                                  <div>
                                      <label className="block text-xs font-bold text-red-800 uppercase mb-1 flex items-center">
                                          <ShieldCheck size={12} className="mr-1"/> Mã bảo mật hiện tại (Admin View)
                                      </label>
                                      <div className="font-mono text-lg font-bold text-red-600 tracking-wider">
                                          {showCurrentPassword ? editingMember.password : '••••••••'}
                                      </div>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                      className="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
                                      title={showCurrentPassword ? "Ẩn mã" : "Xem mã"}
                                  >
                                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                              </div>
                              <p className="text-[10px] text-red-600/70 mt-2 italic">
                                  * Chỉ Admin mới thấy thông tin này. Hãy bảo mật cẩn thận.
                              </p>
                          </div>
                      )}

                      {/* --- SECURITY SECTION (CHANGE PASSWORD) --- */}
                      <div className="pt-4 border-t border-slate-100">
                          <button
                              type="button"
                              onClick={() => setShowPasswordChange(!showPasswordChange)}
                              className="text-sm font-bold text-blue-600 flex items-center hover:underline"
                          >
                              <Key size={16} className="mr-2"/> {showPasswordChange ? 'Hủy đổi mật khẩu' : 'Đổi mật khẩu đăng nhập'}
                          </button>
                          
                          {showPasswordChange && (
                              <div className="mt-3 space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1">Mật khẩu mới</label>
                                      <input 
                                          type="password"
                                          placeholder="••••••"
                                          value={newPassword}
                                          onChange={(e) => setNewPassword(e.target.value)}
                                          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-600 mb-1">Xác nhận mật khẩu</label>
                                      <input 
                                          type="password"
                                          placeholder="••••••"
                                          value={confirmPassword}
                                          onChange={(e) => setConfirmPassword(e.target.value)}
                                          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                  </div>
                              </div>
                          )}
                      </div>

                  </form>
                  
                  <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
                      <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Hủy</button>
                      <button type="button" onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center">
                          <Save size={16} className="mr-2" /> Lưu thay đổi
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TeamList;
