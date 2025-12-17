
import React, { useState } from 'react';
import { BookText, Film, DollarSign, FileCheck, ArrowRight, CheckCircle2, ChevronRight, PlayCircle, ShieldCheck, MessageSquare, Users, UserPlus, Stamp, Sparkles, Target, Zap, BrainCircuit } from 'lucide-react';
import { View } from '../types';

interface ProcessDocumentationProps {
    onNavigate: (view: View) => void;
}

type ProcessType = 'CONTENT' | 'BUDGET' | 'REPORT' | 'APPROVAL' | 'COLLAB' | 'HR' | 'CAMPAIGN' | 'AI';

const ProcessDocumentation: React.FC<ProcessDocumentationProps> = ({ onNavigate }) => {
    const [activeProcess, setActiveProcess] = useState<ProcessType>('CONTENT');

    const renderProcessStep = (number: number, title: string, desc: string, role: string, roleColor: string) => (
        <div className="flex gap-4 relative pb-8 last:pb-0">
            {/* Connector Line */}
            <div className="absolute top-8 left-4 bottom-0 w-0.5 bg-slate-200 last:hidden"></div>
            
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 z-10 ${number === 4 ? 'bg-green-500' : 'bg-slate-800'}`}>
                {number}
            </div>
            <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${roleColor}`}>
                        {role}
                    </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
        </div>
    );

    const menuItems = [
        { id: 'CONTENT', label: 'Sản xuất Content', sub: 'Quy trình Media & Social', icon: <Film size={18}/>, color: 'text-purple-600', bg: 'bg-purple-100', border: 'hover:border-purple-200', activeInfo: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' } },
        { id: 'CAMPAIGN', label: 'Triển khai Chiến dịch', sub: 'Quy trình tổng thể (A-Z)', icon: <Target size={18}/>, color: 'text-red-600', bg: 'bg-red-100', border: 'hover:border-red-200', activeInfo: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' } },
        { id: 'APPROVAL', label: 'Phê duyệt & Review', sub: 'Quy trình kiểm duyệt', icon: <Stamp size={18}/>, color: 'text-orange-600', bg: 'bg-orange-100', border: 'hover:border-orange-200', activeInfo: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' } },
        { id: 'BUDGET', label: 'Quản lý Ngân sách', sub: 'Thu chi & Thanh toán', icon: <DollarSign size={18}/>, color: 'text-green-600', bg: 'bg-green-100', border: 'hover:border-green-200', activeInfo: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' } },
        { id: 'AI', label: 'Ứng dụng AI', sub: 'Training & Prompting', icon: <Sparkles size={18}/>, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'hover:border-indigo-200', activeInfo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' } },
        { id: 'REPORT', label: 'Báo cáo Ngày/Tuần', sub: 'Quy chuẩn báo cáo', icon: <FileCheck size={18}/>, color: 'text-blue-600', bg: 'bg-blue-100', border: 'hover:border-blue-200', activeInfo: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' } },
        { id: 'COLLAB', label: 'Văn hóa Trao đổi', sub: 'Chat & Bình luận', icon: <MessageSquare size={18}/>, color: 'text-pink-600', bg: 'bg-pink-100', border: 'hover:border-pink-200', activeInfo: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900' } },
        { id: 'HR', label: 'Quản trị Nhân sự', sub: 'Dành cho Admin/HR', icon: <UserPlus size={18}/>, color: 'text-slate-600', bg: 'bg-slate-200', border: 'hover:border-slate-300', activeInfo: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-900' } },
    ];

    return (
        <div className="h-full flex flex-col animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <BookText size={24} className="mr-3 text-blue-600" />
                        Sổ tay vận hành (SOP)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Hướng dẫn chi tiết quy trình làm việc chuẩn cho toàn bộ hệ thống.</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                
                {/* Navigation (Left) */}
                <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 h-fit max-h-full">
                    {menuItems.map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveProcess(item.id as ProcessType)}
                            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${activeProcess === item.id ? `${item.activeInfo.bg} ${item.activeInfo.border} ring-1` : `bg-white border-slate-200 ${item.border}`}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${activeProcess === item.id ? item.bg + ' ' + item.color : 'bg-slate-100 text-slate-500'}`}>
                                    {item.icon}
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${activeProcess === item.id ? item.activeInfo.text : 'text-slate-700'}`}>{item.label}</div>
                                    <div className="text-xs text-slate-400">{item.sub}</div>
                                </div>
                            </div>
                            {activeProcess === item.id && <ChevronRight size={16} className={item.color}/>}
                        </button>
                    ))}
                </div>

                {/* Content Area (Right) */}
                <div className="flex-1 bg-slate-50 rounded-2xl p-6 border border-slate-200 overflow-y-auto custom-scrollbar">
                    
                    {activeProcess === 'CONTENT' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-purple-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-purple-900 flex items-center">
                                    <PlayCircle size={24} className="mr-2"/> Quy trình Sản xuất Nội dung
                                </h3>
                                <button onClick={() => onNavigate(View.TASKS)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Tạo công việc <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Lên ý tưởng & Giao việc", "Tạo Task trên hệ thống với trạng thái TODO. Mô tả rõ yêu cầu, deadline và đính kèm tài liệu tham khảo (nếu có).", "Planner / Social", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(2, "Thực thi sản xuất", "Nhân sự nhận việc chuyển trạng thái sang IN_PROGRESS. Thực hiện thiết kế/quay dựng/viết bài. Cập nhật link sản phẩm vào Task.", "Content / Designer / Media", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(3, "Gửi duyệt (Review)", "Chuyển trạng thái sang REVIEW. Tag Leader để thông báo hoặc tạo yêu cầu bên module Kiểm duyệt.", "Content / Designer", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(4, "Kiểm duyệt & Xuất bản", "Leader xem xét. Nếu OK -> DONE. Nếu cần sửa -> Comment & trả về IN_PROGRESS. Sau khi duyệt, tiến hành đăng tải.", "Leader / Manager", "bg-yellow-100 text-yellow-800")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'CAMPAIGN' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-red-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-red-900 flex items-center">
                                    <Target size={24} className="mr-2"/> Quy trình Triển khai Chiến dịch (Big Campaign)
                                </h3>
                                <button onClick={() => onNavigate(View.SCHEDULE)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Xem Lịch trình <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-red-100 mb-4 shadow-sm">
                                <h4 className="font-bold text-red-800 text-sm mb-2 flex items-center"><Zap size={16} className="mr-1"/> Nguyên tắc:</h4>
                                <p className="text-sm text-slate-600">Chiến dịch là tập hợp nhiều Task lớn nhỏ. Cần phối hợp giữa Plan, Budget và Task Management.</p>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Lập kế hoạch & Timeline", "Sử dụng module 'Lịch trình' để xác định thời gian chạy (Start - End). Tạo nhóm chat trong module 'Thảo luận' để brief team.", "Manager / Planner", "bg-yellow-100 text-yellow-800")}
                                {renderProcessStep(2, "Dự trù & Cấp vốn", "Vào module 'Ngân sách', tạo giao dịch 'ALLOCATION' (Cấp vốn) riêng cho chiến dịch này để theo dõi dòng tiền.", "Manager", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(3, "Phân bổ nhiệm vụ (Tasking)", "Tạo các Task chính, gắn thẻ 'High Priority'. Giao việc cho các Leader phụ trách từng mảng (Content, Media, Seeding).", "Manager / Leader", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(4, "Theo dõi & Tối ưu", "Hàng tuần xem 'Báo cáo tổng hợp' và 'Biểu đồ ngân sách' để điều chỉnh chi tiêu và tiến độ kịp thời.", "All Team", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'APPROVAL' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-orange-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-orange-900 flex items-center">
                                    <Stamp size={24} className="mr-2"/> Quy trình Phê duyệt & Review
                                </h3>
                                <button onClick={() => onNavigate(View.APPROVALS)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Đến mục Kiểm duyệt <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Gửi yêu cầu duyệt", "Nhân viên vào module 'Kiểm duyệt' -> Tạo yêu cầu mới. Đính kèm link ảnh/video/bài viết cần duyệt. Chọn mức độ ưu tiên.", "Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(2, "Tiếp nhận & Review", "Leader nhận thông báo. Xem chi tiết nội dung. Có thể xem trực tiếp ảnh/video trên hệ thống.", "Leader / Manager", "bg-yellow-100 text-yellow-800")}
                                {renderProcessStep(3, "Phản hồi (Feedback)", "Nếu chưa đạt: Nhấn 'Yêu cầu sửa' và ghi rõ lý do. Nếu đạt: Nhấn 'Duyệt ngay'.", "Leader / Manager", "bg-yellow-100 text-yellow-800")}
                                {renderProcessStep(4, "Hoàn tất & Lưu trữ", "Yêu cầu đã duyệt sẽ chuyển vào kho lưu trữ. Nhân viên tiến hành xuất bản nội dung.", "System", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'BUDGET' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-green-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-green-900 flex items-center">
                                    <DollarSign size={24} className="mr-2"/> Quy trình Quản lý Ngân sách
                                </h3>
                                <button onClick={() => onNavigate(View.BUDGET)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Quản lý chi tiêu <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Đề xuất chi tiêu", "Trước khi chạy Ads hoặc mua sắm, nhân sự phải báo cáo ước tính chi phí cho Leader/Manager qua Chat hoặc Task.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(2, "Phê duyệt hạn mức", "Trưởng phòng xem xét ngân sách còn lại. Nếu đồng ý, xác nhận thực hiện.", "Manager", "bg-yellow-100 text-yellow-800")}
                                {renderProcessStep(3, "Thực hiện & Lưu chứng từ", "Tiến hành chi tiêu. Chụp lại hóa đơn/màn hình thanh toán làm bằng chứng.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(4, "Ghi nhận hệ thống", "Truy cập module Ngân sách, tạo giao dịch loại 'EXPENSE'. Upload ảnh chứng từ đính kèm.", "Staff / Admin", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'AI' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-indigo-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-indigo-900 flex items-center">
                                    <Sparkles size={24} className="mr-2"/> Quy trình Ứng dụng AI
                                </h3>
                                <button onClick={() => onNavigate(View.AI_ASSISTANT)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Mở Trợ lý AI <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 mb-4 shadow-sm">
                                <h4 className="font-bold text-indigo-800 text-sm mb-2 flex items-center"><BrainCircuit size={16} className="mr-1"/> Mục tiêu:</h4>
                                <p className="text-sm text-slate-600">Biến AI thành nhân sự ảo am hiểu doanh nghiệp thông qua việc đào tạo dữ liệu (Knowledge Base).</p>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Đào tạo (Training)", "Truy cập tab 'Đào tạo'. Upload tài liệu quy trình, brand guideline hoặc paste nội dung bài viết mẫu để AI học phong cách.", "Leader / Admin", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(2, "Ra lệnh (Prompting)", "Chọn vai trò (Context) phù hợp (VD: Social Leader). Đặt câu hỏi cụ thể. VD: 'Dựa trên tài liệu đã học, viết kịch bản TikTok...'", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(3, "Tinh chỉnh (Refine)", "AI trả kết quả. Nếu chưa ưng ý, hãy yêu cầu sửa lại (VD: 'Làm ngắn gọn hơn', 'Vui vẻ hơn').", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(4, "Áp dụng", "Copy kết quả vào Task hoặc file làm việc. Đừng quên kiểm tra lại thông tin trước khi dùng.", "All Staff", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'REPORT' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-blue-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-blue-900 flex items-center">
                                    <FileCheck size={24} className="mr-2"/> Quy trình Báo cáo (Daily & Weekly)
                                </h3>
                                <button onClick={() => onNavigate(View.WORK_REPORTS)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Viết báo cáo <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Lập kế hoạch tuần (Thứ 2)", "Đầu tuần, truy cập 'Kế hoạch cá nhân' để liệt kê các đầu việc trọng tâm sẽ làm. Bấm 'Gửi kế hoạch' để chốt với quản lý.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(2, "Báo cáo ngày (17:30)", "Cuối mỗi ngày, vào 'Báo cáo ngày' -> Điền kết quả làm việc + Kế hoạch mai -> Gửi.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(3, "Review hàng ngày", "Leader/Manager vào mục 'Cần duyệt' để xem báo cáo nhân viên. Duyệt hoặc yêu cầu bổ sung thông tin.", "Leader / Manager", "bg-yellow-100 text-yellow-800")}
                                {renderProcessStep(4, "Tổng kết tuần (Thứ 6)", "Hệ thống tự động so sánh Kế hoạch đầu tuần vs Kết quả thực tế. Quản lý đánh giá KPI tuần.", "Manager", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'COLLAB' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-pink-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-pink-900 flex items-center">
                                    <MessageSquare size={24} className="mr-2"/> Văn hóa Trao đổi & Thảo luận
                                </h3>
                                <button onClick={() => onNavigate(View.COLLABORATION)} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Vào thảo luận <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-pink-100 shadow-sm mb-6">
                                <h4 className="font-bold text-pink-800 mb-3 text-sm">Nguyên tắc giao tiếp:</h4>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex items-start"><span className="text-pink-500 mr-2 font-bold">1.</span> <strong>Task Comment:</strong> Chỉ dùng để trao đổi về chi tiết công việc cụ thể đó (gửi file, cập nhật tiến độ).</li>
                                    <li className="flex items-start"><span className="text-pink-500 mr-2 font-bold">2.</span> <strong>Group Chat:</strong> Dùng cho thông báo chung, thảo luận ý tưởng, brainstorming hoặc các vấn đề cần phản hồi nhanh.</li>
                                    <li className="flex items-start"><span className="text-pink-500 mr-2 font-bold">3.</span> <strong>Direct Message:</strong> Dùng cho các vấn đề riêng tư, lương thưởng hoặc trao đổi 1-1 không liên quan đến người khác.</li>
                                </ul>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Khởi tạo thảo luận", "Chọn đúng kênh (Nhóm/Riêng tư). Đặt tiêu đề rõ ràng nếu là thảo luận nhóm.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(2, "Tương tác", "Sử dụng tính năng 'Reply' để trả lời đúng dòng tin nhắn. Thả tim để xác nhận đã đọc.", "All Staff", "bg-slate-200 text-slate-700")}
                                {renderProcessStep(3, "Chốt vấn đề", "Sau khi thảo luận xong, người chủ trì nên tổng kết lại các điểm chính (Action Items).", "Leader / Author", "bg-yellow-100 text-yellow-800")}
                            </div>
                        </div>
                    )}

                    {activeProcess === 'HR' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center">
                                    <Users size={24} className="mr-2"/> Quản trị Nhân sự (Admin/HR)
                                </h3>
                                <button onClick={() => onNavigate(View.TEAM)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center">
                                    Quản lý Team <ArrowRight size={16} className="ml-2"/>
                                </button>
                            </div>
                            <div className="space-y-0 pl-2">
                                {renderProcessStep(1, "Thêm nhân sự mới", "Vào 'Nhân sự' -> Chọn người cần thêm/sửa -> Cập nhật thông tin (Email, SĐT). Cấp mật khẩu mặc định.", "Admin", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(2, "Phân quyền (RBAC)", "Vào tab 'Phân quyền'. Cấu hình quyền hạn (Xem/Sửa/Xóa/Duyệt) cho từng vị trí (Role).", "Admin", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(3, "Reset mật khẩu", "Nếu nhân viên quên mật khẩu, Admin có thể xem mã bảo mật hiện tại hoặc đặt lại mật khẩu mới trong phần chỉnh sửa.", "Admin", "bg-blue-100 text-blue-700")}
                                {renderProcessStep(4, "Đánh giá & Thống kê", "Định kỳ xem báo cáo thống kê để đánh giá hiệu suất nhân sự dựa trên KPI hoàn thành task.", "Manager", "bg-green-100 text-green-700")}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default ProcessDocumentation;
