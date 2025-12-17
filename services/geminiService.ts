
import { GoogleGenAI } from "@google/genai";
import { Task, Member, AIKnowledge, WorkReport, TaskStatus, BudgetTransaction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMarketingIdeas = async (topic: string, role: string, knowledgeBase: AIKnowledge[] = []): Promise<string> => {
  try {
    let baseInstruction = `
      Bạn là một chuyên gia Marketing AI hỗ trợ cho phòng Marketing của công ty Fugalo.
      Người dùng đang giữ vai trò: ${role}.
      Ngôn ngữ: Tiếng Việt.
      Trình bày rõ ràng, gạch đầu dòng hoặc bảng biểu nếu cần.
      Tập trung vào tính thực tế và hiệu quả (KPIs).
    `;

    if (knowledgeBase.length > 0) {
        const formattedKnowledge = knowledgeBase.map(k => {
            const source = k.type === 'LINK' ? `(Nguồn: ${k.sourceUrl})` : k.type === 'FILE' ? `(File: ${k.fileName})` : '(Nguồn: Văn bản)';
            return `--- [${k.type}] ${k.title} ${source} ---\n${k.content}\n`;
        }).join('\n');

        baseInstruction += `
        \n==================================================
        KNOWLEDGE BASE (THÔNG TIN NỘI BỘ ĐÃ HỌC):
        Dưới đây là các tài liệu, liên kết và thông tin quan trọng của công ty. 
        HÃY ƯU TIÊN SỬ DỤNG thông tin này để trả lời câu hỏi nếu phù hợp.
        NẾU câu trả lời dựa trên Knowledge Base, hãy trích dẫn nguồn.
        
        ${formattedKnowledge}
        ==================================================
        `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: topic,
      config: {
        systemInstruction: baseInstruction
      }
    });

    return response.text || "Xin lỗi, tôi không thể tạo nội dung lúc này.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Đã xảy ra lỗi khi kết nối với AI. Vui lòng kiểm tra API Key.";
  }
};

export const analyzeTask = async (taskDescription: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Phân tích nhiệm vụ marketing sau đây và đề xuất các bước thực hiện chi tiết (Checklist):\n"${taskDescription}"\n\nTrả về kết quả dưới dạng danh sách các bước cần làm.`,
        });
    
        return response.text || "Không thể phân tích nhiệm vụ.";
      } catch (error) {
        console.error("Gemini API Error:", error);
        return "Lỗi kết nối AI.";
      }
}

export const generatePerformanceReport = async (tasks: Task[], members: Member[]): Promise<string> => {
    try {
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'DONE').length;
        const overdueTasks = tasks.filter(t => {
            if(t.status === 'DONE') return false;
            return new Date(t.deadline) < new Date();
        }).length;
        
        const memberStats = members.map(m => {
            const mTasks = tasks.filter(t => t.assigneeId === m.id);
            return `${m.name}: ${mTasks.filter(t => t.status === 'DONE').length}/${mTasks.length} hoàn thành`;
        }).join('; ');

        const prompt = `
            Dữ liệu báo cáo:
            - Tổng công việc: ${totalTasks}
            - Hoàn thành: ${doneTasks}
            - Quá hạn: ${overdueTasks}
            - Hiệu suất nhân sự: ${memberStats}

            Yêu cầu:
            1. Đánh giá chung về tiến độ.
            2. Chỉ ra điểm nóng (bottleneck) nếu có việc quá hạn.
            3. Khen ngợi nhân sự có hiệu suất tốt.
            4. Đề xuất hành động cải thiện trong tuần tới.
            Viết ngắn gọn, chuyên nghiệp, format Markdown.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Bạn là AI quản lý của phòng Marketing."
            }
        });

        return response.text || "Không thể tạo báo cáo.";
    } catch (error) {
        console.error("Gemini Report Error:", error);
        return "Lỗi khi tạo báo cáo AI.";
    }
};

export const summarizeWorkReports = async (
    reports: WorkReport[], 
    periodLabel: string, 
    role: string = 'Manager',
    stats: any = null
): Promise<string> => {
    try {
        if (reports.length === 0) return "Không có dữ liệu báo cáo để tổng hợp.";

        const reportContent = reports.map(r => `
            - [${r.date}] ${r.userId} (Mood: ${r.mood}, Score: ${r.selfScore}):
              + Done: ${r.completedWork}
              + Issues: ${r.issues}
        `).join('\n');

        let systemPrompt = "";
        let userPrompt = "";
        
        if (role === 'Manager') {
            systemPrompt = "BẠN LÀ: Trưởng phòng Marketing (Manager) đang viết báo cáo gửi Ban Giám Đốc (Board of Directors). MỤC TIÊU: Tạo một báo cáo quản trị cấp cao.";
            userPrompt = `
                Kỳ báo cáo: ${periodLabel}.
                
                DỮ LIỆU THỐNG KÊ (KPIs):
                - Tổng số báo cáo nhân viên nộp: ${stats?.totalReports || 0}
                - Điểm đánh giá nhân sự trung bình: ${stats?.avgScore || 0}/5
                - Số giờ làm việc trung bình: ${stats?.avgHours || 0}h/ngày
                
                DỮ LIỆU CHI TIẾT TỪ NHÂN VIÊN:
                ${reportContent}

                YÊU CẦU ĐẦU RA (Format Markdown chuyên nghiệp):
                
                # BÁO CÁO HOẠT ĐỘNG PHÒNG MARKETING - ${periodLabel}
                
                ## 1. TỔNG QUAN HIỆU SUẤT (EXECUTIVE SUMMARY)
                (Viết một đoạn văn ngắn gọn tổng kết tình hình tuần/tháng vừa qua, nhận định chung về tinh thần làm việc dựa trên Mood và KPIs).

                ## 2. CÁC HẠNG MỤC TRỌNG TÂM ĐÃ HOÀN THÀNH
                (Tổng hợp từ phần "Done" của nhân viên, nhưng NHÓM lại thành các đầu việc lớn, bỏ qua các chi tiết vụn vặt).

                ## 3. VẤN ĐỀ & GIẢI PHÁP (ISSUES & RISKS)
                (Phân tích từ phần "Issues" của nhân viên. Nếu có vấn đề lặp lại, hãy đánh dấu là rủi ro. Đề xuất hướng giải quyết).

                ## 4. KẾ HOẠCH TRỌNG TÂM TIẾP THEO
                (Dựa trên dòng chảy công việc, đề xuất hướng đi cho giai đoạn tới).

                *Lưu ý: Văn phong lãnh đạo, quyết đoán, súc tích, tập trung vào kết quả.*
            `;
        } else {
            systemPrompt = "Bạn là thư ký AI. Hãy tổng hợp báo cáo công việc cá nhân/nhóm.";
            userPrompt = `
                Kỳ báo cáo: ${periodLabel}.
                
                DỮ LIỆU:
                ${reportContent}

                YÊU CẦU (Format Markdown):
                1. **Các đầu việc chính đã hoàn thành:** Tóm tắt súc tích.
                2. **Vấn đề tồn đọng:** Liệt kê khó khăn.
                3. **Đánh giá chung:** Nhận xét tiến độ.
            `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt
            }
        });

        return response.text || "Không thể tổng hợp báo cáo.";
    } catch (error) {
        console.error("Gemini Summary Error:", error);
        return "Lỗi khi tổng hợp báo cáo bằng AI.";
    }
};

export const analyzeProjectBottlenecks = async (tasks: Task[], members: Member[]): Promise<string> => {
    try {
        const stalledTasks = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.REVIEW);
        
        if (stalledTasks.length === 0) {
            return "Hiện tại không có công việc nào đang bị Tạm hoãn (Pending) hoặc Chờ duyệt (Review). Mọi thứ đang diễn ra suôn sẻ!";
        }

        const taskDetails = stalledTasks.map(t => {
            const assignee = members.find(m => m.id === t.assigneeId)?.name || 'Unknown';
            const assigner = members.find(m => m.id === t.assignerId)?.name || 'Unknown';
            return `- [${t.status}] "${t.title}" (Ưu tiên: ${t.priority}). Người làm: ${assignee}. Người giao: ${assigner}. Hạn chót: ${t.deadline}`;
        }).join('\n');

        const prompt = `
            DANH SÁCH CÔNG VIỆC CẦN XỬ LÝ:
            ${taskDetails}

            YÊU CẦU ĐẦU RA (Format Markdown):
            
            ### 1. PHÂN TÍCH TÌNH HÌNH
            - Tóm tắt nhanh số lượng việc đang Pending/Review.
            - Nhận định sơ bộ về mức độ nghiêm trọng.

            ### 2. GIẢI PHÁP CỤ THỂ (Action Plan)
            (Đối với từng nhóm công việc hoặc công việc cụ thể, hãy đưa ra hành động).
            - **Với việc Chờ duyệt (REVIEW):** Đề xuất cách đẩy nhanh (VD: Nhắc người giao việc, tổ chức họp review nhanh).
            - **Với việc Tạm hoãn (PENDING):** Phân tích nguyên nhân khả thi và đề xuất hướng gỡ rối.

            ### 3. LỜI KHUYÊN CHO QUẢN LÝ
            - Một câu lời khuyên ngắn gọn để tránh tình trạng này lặp lại.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Bạn là một chuyên gia Quản lý Dự án (Project Manager) cấp cao. Văn phong: Quyết đoán, hướng giải quyết vấn đề (Solution-oriented)."
            }
        });

        return response.text || "Không thể phân tích điểm nghẽn.";
    } catch (error) {
        console.error("Gemini Bottleneck Analysis Error:", error);
        return "Lỗi kết nối AI khi phân tích điểm nghẽn.";
    }
};

export const analyzeBudget = async (transactions: BudgetTransaction[], monthlyLimit: number, currentMonth: string): Promise<string> => {
    try {
        const expenses = transactions.filter(t => t.type === 'EXPENSE');
        const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
        
        // Group by Category
        const catMap: Record<string, number> = {};
        expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
        const topCategories = Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => `- ${cat}: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}`)
            .join('\n');

        // Group by Campaign
        const campMap: Record<string, number> = {};
        expenses.forEach(t => { 
            const c = t.campaign || 'Không có chiến dịch';
            campMap[c] = (campMap[c] || 0) + t.amount; 
        });
        const topCampaigns = Object.entries(campMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cam, amount]) => `- ${cam}: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}`)
            .join('\n');

        const prompt = `
            Phân tích tình hình ngân sách tháng ${currentMonth}:

            - Hạn mức ngân sách (Budget Limit): ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(monthlyLimit)}
            - Tổng đã chi (Total Spent): ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalSpent)}
            - % Đã dùng: ${((totalSpent/monthlyLimit)*100).toFixed(1)}%
            
            TOP DANH MỤC CHI TIẾU:
            ${topCategories}

            TOP CHIẾN DỊCH TỐN KÉM NHẤT:
            ${topCampaigns}

            YÊU CẦU ĐẦU RA (Format Markdown, ngắn gọn, súc tích):
            1. **Nhận định chung**: Tình hình tài chính hiện tại (An toàn / Cảnh báo / Nguy hiểm). Tốc độ đốt tiền (burn rate) có hợp lý không?
            2. **Phân tích cơ cấu**: Nhận xét về việc phân bổ ngân sách.
            3. **Lời khuyên hành động**: Đề xuất 1-2 hành động cụ thể.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Bạn là một Giám đốc Tài chính (CFO) chuyên về Marketing (Fractional CMO). Văn phong: Chuyên nghiệp, khách quan, dựa trên số liệu."
            }
        });

        return response.text || "Không thể phân tích ngân sách.";
    } catch (error) {
        console.error("Gemini Budget Analysis Error:", error);
        return "Lỗi kết nối AI khi phân tích ngân sách.";
    }
};
