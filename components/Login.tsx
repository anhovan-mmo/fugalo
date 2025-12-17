
import React, { useState } from 'react';
import { Member } from '../types';
import { MEMBERS } from '../constants';
import { ShieldCheck, Mail, AlertTriangle, Lock, Terminal, X } from 'lucide-react';

interface LoginProps {
  onLogin: (member: Member) => void;
  logoUrl?: string; // New Prop
}

const Login: React.FC<LoginProps> = ({ onLogin, logoUrl }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // State to control visibility of Debug section
  const [showDebug, setShowDebug] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // --- SECRET KEY CHECK ---
    // Nếu nhập đúng mã bí mật, bật chế độ Debug và không thực hiện đăng nhập
    if (password === 'An@091287') {
        setShowDebug(true);
        setError('');
        setPassword(''); // Xóa mật khẩu để bảo mật
        return;
    }
    
    // 1. DETERMINE SOURCE OF TRUTH (LocalStorage > Static Constants)
    let currentMembers = MEMBERS;
    try {
        const storedMembers = localStorage.getItem('fugalo_db_members');
        if (storedMembers) {
            // If local data exists, it overrides the static list completely
            currentMembers = JSON.parse(storedMembers) as Member[];
        }
    } catch (e) {
        console.error("Error reading local member data", e);
    }

    // 2. Find user in the DETERMINED list
    const member = currentMembers.find(m => m.email.toLowerCase() === email.trim().toLowerCase());
    
    if (!member) {
      setError('Email không tồn tại trong hệ thống.');
      return;
    }

    // 3. Validate Password
    const validPassword = member.password || '123456';
    
    if (password === validPassword) {
      onLogin(member);
      setError('');
    } else {
      setError('Mật khẩu không chính xác.');
    }
  };

  const handleQuickLogin = (staticMember: Member) => {
    setEmail(staticMember.email);
    
    // Attempt to find the REAL current password for convenience
    let currentPassword = '123456';
    try {
        const storedMembers = localStorage.getItem('fugalo_db_members');
        if (storedMembers) {
            const members = JSON.parse(storedMembers) as Member[];
            const found = members.find(m => m.id === staticMember.id);
            if (found && found.password) {
                currentPassword = found.password;
            }
        }
    } catch (e) {
        console.error(e);
    }
    
    setPassword(currentPassword);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="p-8 bg-gradient-to-br from-blue-600 to-teal-500 text-white text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg p-1">
             <img src={logoUrl || "https://i.imgur.com/KzXj0XJ.png"} alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="text-3xl font-bold mb-2">FUGALO CRM</h1>
          <p className="text-blue-100 text-sm">Hệ thống quản trị nội bộ</p>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Đăng nhập</h2>
              <p className="text-xs text-slate-500 mt-1">Sử dụng tài khoản công ty được cấp</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email nội bộ</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name.role@fugalo.vn"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  // Removed required to allow typing secret key without email
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã bảo mật</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                  required
                />
              </div>
            </div>
            
            {error && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 animate-fade-in">
                    <p className="text-red-600 text-xs font-bold flex items-center"><AlertTriangle size={12} className="mr-1"/> {error}</p>
                </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
            >
              Truy cập hệ thống
            </button>
          </form>

          {/* DEBUG SECTION - HIDDEN BY DEFAULT */}
          {showDebug && (
              <div className="mt-8 animate-fade-in">
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink-0 mx-4 text-green-600 text-xs font-bold uppercase flex items-center">
                        <Terminal size={12} className="mr-1"/> Admin Mode Unlocked
                    </span>
                    <button 
                        onClick={() => setShowDebug(false)}
                        className="absolute right-0 p-1 text-slate-400 hover:text-red-500"
                        title="Close Debug"
                    >
                        <X size={14} />
                    </button>
                    <div className="flex-grow border-t border-slate-100"></div>
                </div>
                <p className="text-[10px] text-center text-slate-400 mb-2 italic">Click để điền nhanh thông tin (Tự động lấy mật khẩu mới nhất)</p>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {MEMBERS.map(m => (
                        <button
                            key={m.id}
                            onClick={() => handleQuickLogin(m)}
                            className="w-full flex items-center p-2 hover:bg-white rounded-lg transition-colors text-left group border border-transparent hover:border-slate-100 hover:shadow-sm"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mr-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {m.name.charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700">{m.name}</div>
                                <div className="text-[10px] text-slate-500">{m.email}</div>
                            </div>
                        </button>
                    ))}
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
