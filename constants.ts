
import { Member, Role, Task, TaskStatus, PersonalTask } from './types';

// Helper for dynamic dates to ensure demo data is relevant
const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

export const MEMBERS: Member[] = [
  // --- BAN GIÁM ĐỐC (BOARD) ---
  {
    id: '0',
    name: 'Ban Giám Đốc',
    role: 'CEO / Board of Directors',
    roleType: Role.BOARD,
    department: 'Board',
    reportsTo: 'Shareholders',
    email: 'board@fugalo.vn',
    password: 'admin',
    phone: '0909 000 000',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King'
  },

  // --- NHÓM ĐIỀU HÀNH ---
  { 
    id: '1', 
    name: 'Hồ Văn An', 
    role: 'Trưởng phòng Marketing', 
    roleType: Role.MANAGER, 
    department: 'DieuHanh',
    reportsTo: 'Ban Giám Đốc',
    email: 'an.hv@fugalo.vn', 
    password: '123456',
    phone: '0939 81 00 86',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
  },
  { 
    id: '2', 
    name: 'Nguyễn Huy Thông', 
    role: 'Phó phòng Marketing', 
    roleType: Role.DEPUTY_MANAGER, 
    department: 'DieuHanh',
    reportsTo: 'TP.MKT',
    email: 'thong.nh@fugalo.vn', 
    password: '123456',
    phone: '0984 964 745',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka'
  },

  // --- NHÓM MEDIA (HÌNH ẢNH & VIDEO) ---
  { 
    id: '3', 
    name: 'Lê Hoàn Kiếm', 
    role: 'Trưởng bộ phận Hình ảnh (Art Director)', 
    roleType: Role.DOP, 
    department: 'Media',
    reportsTo: 'TP.MKT/PP',
    email: 'kiem.lh@fugalo.vn', 
    password: '123456',
    phone: '0933 338 648',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack'
  },
  { 
    id: '4', 
    name: 'Lê Thanh Duy', 
    role: 'Trưởng nhóm Media', 
    roleType: Role.MEDIA_LEADER, 
    department: 'Media',
    reportsTo: 'PP. MKT',
    email: 'duy.lt@fugalo.vn', 
    password: '123456',
    phone: '0911 046 073',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Precious'
  },
  { 
    id: '5', 
    name: 'Trần Nhật Tân', 
    role: 'Chuyên viên Dựng phim', 
    roleType: Role.MEDIA, 
    department: 'Media',
    reportsTo: 'Media Lead',
    email: 'tan.tn@fugalo.vn', 
    password: '123456',
    phone: '0908 905 565',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Midnight'
  },
  { 
    id: '6', 
    name: 'Phạm Lê Nhật Trường', 
    role: 'Chuyên viên Dựng phim', 
    roleType: Role.MEDIA, 
    department: 'Media',
    reportsTo: 'Media Lead',
    email: 'truong.pln@fugalo.vn', 
    password: '123456',
    phone: '0786 255 969',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Brian'
  },
  { 
    id: '7', 
    name: 'Phạm Minh Long', 
    role: 'Nhiếp ảnh gia', 
    roleType: Role.PHOTO, 
    department: 'Media',
    reportsTo: 'Media Lead',
    email: 'long.pm@fugalo.vn', 
    password: '123456',
    phone: '0343 098 873',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=George'
  },

  // --- NHÓM CONTENT & SOCIAL ---
  { 
    id: '10', 
    name: 'Nguyễn Hồ Á Châu', 
    role: 'Trưởng nhóm Content/Social', 
    roleType: Role.SOCIAL_LEADER, 
    department: 'Content',
    reportsTo: 'TP.MKT',
    email: 'chau.nha@fugalo.vn', 
    password: '123456',
    phone: '0889 805 815',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mimi'
  },
  { 
    id: '11', 
    name: 'Lê Thị Thuý Liên', 
    role: 'Nhân viên Content – Social', 
    roleType: Role.SOCIAL, 
    department: 'Content',
    reportsTo: 'Social Lead',
    email: 'lien.ltt@fugalo.vn', 
    password: '123456',
    phone: '0366 801 722',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'
  },
  { 
    id: '12', 
    name: 'Phạm Hồng Thái', 
    role: 'Nhân viên Content – Social', 
    roleType: Role.SOCIAL, 
    department: 'Content',
    reportsTo: 'Social Lead',
    email: 'thai.ph@fugalo.vn', 
    password: '123456',
    phone: '0707 530 682',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo'
  },

  // --- NHÓM SEEDING ---
  { 
    id: '8', 
    name: 'Võ Trọng Nhân', 
    role: 'Trưởng nhóm Seeding', 
    roleType: Role.SEEDING_LEADER, 
    department: 'Seeding',
    reportsTo: 'PP. MKT',
    email: 'nhan.vt@fugalo.vn', 
    password: '123456',
    phone: '0587 958 126',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ginger'
  },
  { 
    id: '9', 
    name: 'Vũ Thị Phương Anh', 
    role: 'Nhân viên Seeding', 
    roleType: Role.SEEDING, 
    department: 'Seeding',
    reportsTo: 'Seeding Lead',
    email: 'anh.vtp@fugalo.vn', 
    password: '123456',
    phone: '0342 659 358',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Annie'
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Lên kế hoạch Content Tháng tới',
    description: 'Xây dựng content pillar và timeline chi tiết cho fanpage chính.',
    assignerId: '1', // An HV giao
    assigneeId: '10', // Á Châu nhận
    supporterIds: ['11', '12'], // Liên, Thái hỗ trợ
    status: TaskStatus.IN_PROGRESS,
    startDate: getRelativeDate(0),
    deadline: getRelativeDate(3),
    priority: 'High',
    notes: 'Đã họp với team Design, chốt concept chủ đạo là "Mùa lễ hội". Cần gửi bản draft trước ngày 20.',
    taskType: 'CONTENT',
    subtasks: [
        { id: 'st1', content: 'Nghiên cứu trend thị trường', completed: true },
        { id: 'st2', content: 'Họp brainstorming với team', completed: true },
        { id: 'st3', content: 'Lên khung Content Pillar', completed: false },
        { id: 'st4', content: 'Viết timeline chi tiết từng ngày', completed: false },
        { id: 'st5', content: 'Review và chỉnh sửa lần cuối', completed: false }
    ]
  },
  {
    id: 't2',
    title: 'Quay video Viral Tiktok #1',
    description: 'Kịch bản hài hước văn phòng, cần DOP và Media hỗ trợ.',
    assignerId: '2', // Thông NH giao
    assigneeId: '4', // Duy nhận
    supporterIds: ['3', '5', '6'], // Kiếm, Tân, Trường hỗ trợ
    status: TaskStatus.TODO,
    startDate: getRelativeDate(1),
    deadline: getRelativeDate(5),
    priority: 'Medium',
    notes: 'Cần mượn thêm 1 máy quay Sony A7S3.',
    taskType: 'MEDIA',
    subtasks: [
        { id: 'st1', content: 'Chốt kịch bản chi tiết', completed: false },
        { id: 'st2', content: 'Chuẩn bị đạo cụ, bối cảnh', completed: false },
        { id: 'st3', content: 'Quay source (Shooting)', completed: false },
        { id: 'st4', content: 'Dựng thô (Rough cut)', completed: false }
    ]
  },
  {
    id: 't3',
    title: 'Chụp ảnh sản phẩm bộ sưu tập mới',
    description: 'Concept: Minimalist. Địa điểm: Studio A.',
    assignerId: '3', // Kiếm giao
    assigneeId: '7', // Long nhận
    supporterIds: [],
    status: TaskStatus.DONE,
    startDate: getRelativeDate(-4),
    deadline: getRelativeDate(-2),
    priority: 'High',
    taskType: 'MEDIA',
    subtasks: [
        { id: 'st1', content: 'Setup ánh sáng studio', completed: true },
        { id: 'st2', content: 'Chụp Packshot', completed: true },
        { id: 'st3', content: 'Chụp Lookbook model', completed: true },
        { id: 'st4', content: 'Retouch hình ảnh', completed: true }
    ]
  },
  {
    id: 't4',
    title: 'Seeding Group Review',
    description: 'Tăng tương tác cho bài post ra mắt sản phẩm.',
    assignerId: '8', // Nhân giao
    assigneeId: '9', // Phương Anh nhận
    supporterIds: [],
    status: TaskStatus.REVIEW,
    startDate: getRelativeDate(-3),
    deadline: getRelativeDate(-1),
    priority: 'Low',
    notes: 'Link các group đã seeding cập nhật trong file sheet chung.',
    taskType: 'GENERAL',
    subtasks: [
        { id: 'st1', content: 'Lên danh sách 20 Group mục tiêu', completed: true },
        { id: 'st2', content: 'Soạn 5 kịch bản comment khác nhau', completed: true },
        { id: 'st3', content: 'Thực hiện seeding', completed: true },
        { id: 'st4', content: 'Báo cáo nghiệm thu link', completed: false }
    ]
  }
];

export const INITIAL_PERSONAL_TASKS: PersonalTask[] = [
  { id: 'p1', userId: '1', content: 'Gửi báo cáo tuần cho Manager', day: 'T6', completed: false },
  { id: 'p2', userId: '1', content: 'Họp briefing sáng thứ 2', day: 'T2', completed: true },
  { id: 'p3', userId: '4', content: 'Kiểm tra mail đối tác', day: 'T2', completed: true },
  { id: 'p4', userId: '10', content: 'Đặt lịch studio', day: 'T4', completed: false },
];
