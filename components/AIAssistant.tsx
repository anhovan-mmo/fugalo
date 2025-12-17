
import React, { useState, useEffect, useRef } from 'react';
import { generateMarketingIdeas } from '../services/geminiService';
import { subscribeToChatHistory, addChatMessageToDB, subscribeToChatSessions, addChatSessionToDB, deleteChatSessionFromDB, subscribeToKnowledge, addKnowledgeToDB, deleteKnowledgeFromDB } from '../services/firebase';
import { Sparkles, Send, Bot, User, Trash2, History, Lock, Shield, Plus, MessageSquare, Menu, X, ArrowLeft, BookOpen, Database, Upload, FileText, CheckCircle2, Link as LinkIcon, FileCode, AlertCircle } from 'lucide-react';
import { Role, Member, ChatMessage, ChatSession, AIKnowledge } from '../types';

interface AIAssistantProps {
    currentUser: Member;
    members: Member[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ currentUser, members }) => {
  const [prompt, setPrompt] = useState('');
  const [roleContext, setRoleContext] = useState<string>(currentUser.role || Role.SOCIAL_LEADER);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For mobile/desktop toggle

  // Knowledge Base State
  const [activeTab, setActiveTab] = useState<'CHAT' | 'TRAINING'>('CHAT');
  const [knowledgeList, setKnowledgeList] = useState<AIKnowledge[]>([]);
  
  // Adding Knowledge State
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [inputType, setInputType] = useState<'TEXT' | 'FILE' | 'LINK'>('TEXT');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [fileName, setFileName] = useState('');

  // Admin View State
  const isManager = currentUser.roleType === Role.MANAGER;
  const [viewUserId, setViewUserId] = useState<string>(currentUser.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to Session List
  useEffect(() => {
      const targetUserId = isManager ? viewUserId : currentUser.id;
      const unsubscribe = subscribeToChatSessions(targetUserId, (data) => {
          setSessions(data);
      });
      return () => unsubscribe();
  }, [viewUserId, isManager, currentUser.id]);

  // Subscribe to Knowledge Base
  useEffect(() => {
      const unsubscribe = subscribeToKnowledge((data) => {
          setKnowledgeList(data);
      });
      return () => unsubscribe();
  }, []);

  // Subscribe to Messages of Active Session
  useEffect(() => {
      if (!activeSessionId) {
          setMessages([]);
          return;
      }

      const unsubscribe = subscribeToChatHistory(activeSessionId, (history) => {
          setMessages(history);
          setTimeout(() => {
              if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
          }, 100);
      });

      return () => unsubscribe();
  }, [activeSessionId]);

  const handleCreateNewSession = () => {
      setActiveSessionId(null);
      setMessages([]);
      setIsSidebarOpen(false); // Close sidebar on mobile
      setActiveTab('CHAT');
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Bạn có chắc muốn xóa đoạn hội thoại này?")) {
          await deleteChatSessionFromDB(sessionId);
          if (activeSessionId === sessionId) {
              setActiveSessionId(null);
          }
      }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (viewUserId !== currentUser.id) {
        alert("Bạn đang xem lịch sử của người khác. Vui lòng chuyển về 'Của tôi' để chat.");
        return;
    }

    const userMsgContent = prompt;
    setPrompt('');
    setLoading(true);

    try {
        let currentSessionId = activeSessionId;

        // 1. If New Chat -> Create Session First
        if (!currentSessionId) {
            const newSessionId = Date.now().toString();
            // Generate title from first few words
            const title = userMsgContent.split(' ').slice(0, 6).join(' ') + '...';
            
            const newSession: ChatSession = {
                id: newSessionId,
                userId: currentUser.id,
                title: title,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await addChatSessionToDB(newSession);
            currentSessionId = newSessionId;
            setActiveSessionId(newSessionId);
        }

        const timestamp = new Date().toISOString();

        // 2. Save User Message
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            sessionId: currentSessionId,
            userId: currentUser.id,
            sender: 'user',
            content: userMsgContent,
            timestamp: timestamp,
            roleContext: roleContext
        };
        await addChatMessageToDB(userMessage);

        // 3. Call AI with Full Knowledge Base Object
        const aiResponseText = await generateMarketingIdeas(userMsgContent, roleContext, knowledgeList);
        
        // 4. Save AI Response
        const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            sessionId: currentSessionId,
            userId: currentUser.id,
            sender: 'ai',
            content: aiResponseText,
            timestamp: new Date().toISOString(),
            roleContext: roleContext
        };
        await addChatMessageToDB(aiMessage);

    } catch (error) {
       console.error("AI Error", error);
       alert("Có lỗi xảy ra khi kết nối với AI.");
    } finally {
      setLoading(false);
    }
  };

  const resetKnowledgeForm = () => {
      setNewTitle('');
      setNewContent('');
      setNewUrl('');
      setFileName('');
      setInputType('TEXT');
      setIsAddingKnowledge(false);
  };

  const handleSaveKnowledge = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!newTitle.trim()) {
          alert("Vui lòng nhập tiêu đề.");
          return;
      }
      if (!newContent.trim()) {
          alert("Nội dung không được để trống.");
          return;
      }

      const newItem: AIKnowledge = {
          id: Date.now().toString(),
          title: newTitle,
          content: newContent,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          type: inputType,
          sourceUrl: inputType === 'LINK' ? newUrl : undefined,
          fileName: inputType === 'FILE' ? fileName : undefined
      };

      await addKnowledgeToDB(newItem);
      resetKnowledgeForm();
  };

  const handleDeleteKnowledge = async (id: string) => {
      if (window.confirm("Xóa dữ liệu đào tạo này?")) {
          await deleteKnowledgeFromDB(id);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setFileName(file.name);
          if (!newTitle) setNewTitle(file.name);

          // Supported Text Types
          const textTypes = ['text/plain', 'text/csv', 'application/json', 'text/markdown', 'text/html', 'application/xml', 'text/javascript', 'application/typescript'];
          
          if (textTypes.some(type => file.type.includes(type) || file.name.endsWith('.md') || file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
              const reader = new FileReader();
              reader.onload = (event) => {
                  setNewContent(event.target?.result as string);
              };
              reader.readAsText(file);
          } else {
              // Fallback for unsupported types (PDF, Word)
              // Since we don't have backend, we just ask user to copy paste but we fill title.
              setNewContent("Đây là file nhị phân (PDF/Word/Excel) chưa được trích xuất text. Vui lòng copy nội dung văn bản vào đây để AI học tốt hơn.");
              alert("Lưu ý: Hệ thống hiện tại hỗ trợ đọc trực tiếp file văn bản (.txt, .md, .csv, .json). Với file PDF/Word, để đảm bảo độ chính xác, vui lòng copy nội dung text và dán vào ô Nội dung.");
          }
      }
  };

  const viewingMember = members.find(m => m.id === viewUserId);

  return (
    <div className="h-full flex gap-4 animate-fade-in relative overflow-hidden">
      
      {/* --- SIDEBAR (Session List & Tools) --- */}
      <div className={`
          absolute md:static inset-y-0 left-0 z-20 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 flex flex-col shadow-xl md:shadow-none md:transform-none rounded-xl md:rounded-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-1/3 lg:w-1/4'}
      `}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center">
                      <Bot size={24} className="mr-2 text-purple-600"/> Trợ lý AI
                  </h3>
                  <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400">
                      <X size={20} />
                  </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                      onClick={() => setActiveTab('CHAT')}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'CHAT' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <MessageSquare size={14} className="mr-1.5"/> Chat
                  </button>
                  <button 
                      onClick={() => setActiveTab('TRAINING')}
                      className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'TRAINING' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Database size={14} className="mr-1.5"/> Đào tạo
                  </button>
              </div>

              {/* Admin User Selector (Only in Chat Mode) */}
              {isManager && activeTab === 'CHAT' && (
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <Shield size={14} className="text-yellow-600 flex-shrink-0" />
                    <select 
                        value={viewUserId} 
                        onChange={(e) => { setViewUserId(e.target.value); setActiveSessionId(null); }}
                        className="text-xs bg-transparent outline-none font-bold text-slate-700 cursor-pointer w-full"
                    >
                        <option value={currentUser.id}>Của tôi (Admin)</option>
                        {members.filter(m => m.id !== currentUser.id).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
              )}

              {activeTab === 'CHAT' && (
                  <button 
                      onClick={handleCreateNewSession}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg text-sm font-bold shadow-md hover:bg-purple-700 transition-colors"
                  >
                      <Plus size={16} /> Chat mới
                  </button>
              )}
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {activeTab === 'CHAT' ? (
                  sessions.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs italic">
                          Chưa có hội thoại nào.
                      </div>
                  ) : (
                      sessions.map(session => (
                          <div 
                              key={session.id}
                              onClick={() => { setActiveSessionId(session.id); setIsSidebarOpen(false); }}
                              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent ${
                                  activeSessionId === session.id 
                                  ? 'bg-purple-50 border-purple-200 text-purple-800' 
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                          >
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <MessageSquare size={16} className={`flex-shrink-0 ${activeSessionId === session.id ? 'text-purple-600' : 'text-slate-400'}`}/>
                                  <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate">{session.title}</span>
                                      <span className="text-[10px] text-slate-400 truncate">
                                          {new Date(session.createdAt).toLocaleDateString('vi-VN')}
                                      </span>
                                  </div>
                              </div>
                              
                              {viewUserId === currentUser.id && (
                                  <button 
                                      onClick={(e) => handleDeleteSession(session.id, e)}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              )}
                          </div>
                      ))
                  )
              ) : (
                  // Training List
                  <div>
                      <div className="px-2 mb-2 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                          <span>Dữ liệu đã học ({knowledgeList.length})</span>
                      </div>
                      {knowledgeList.length === 0 ? (
                          <div className="text-center py-10 text-slate-400 text-xs italic px-4">
                              Chưa có dữ liệu. <br/> Thêm thông tin để AI hiểu rõ hơn về doanh nghiệp.
                          </div>
                      ) : (
                          knowledgeList.map(item => (
                              <div key={item.id} className="p-3 rounded-lg border border-slate-100 bg-white mb-2 shadow-sm hover:shadow-md transition-shadow group">
                                  <div className="flex justify-between items-start mb-1">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                          {item.type === 'LINK' && <LinkIcon size={12} className="text-blue-500 flex-shrink-0" />}
                                          {item.type === 'FILE' && <FileCode size={12} className="text-orange-500 flex-shrink-0" />}
                                          {item.type === 'TEXT' && <FileText size={12} className="text-slate-500 flex-shrink-0" />}
                                          <h4 className="font-bold text-slate-800 text-xs truncate" title={item.title}>{item.title}</h4>
                                      </div>
                                      <button 
                                          onClick={() => handleDeleteKnowledge(item.id)}
                                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                          <Trash2 size={12} />
                                      </button>
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-2">{item.content}</p>
                                  {item.sourceUrl && <p className="text-[9px] text-blue-400 mt-1 truncate">{item.sourceUrl}</p>}
                              </div>
                          ))
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* --- MAIN AREA --- */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                  <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-500 hover:text-slate-800">
                      <Menu size={20} />
                  </button>
                  {activeTab === 'CHAT' ? (
                      <>
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600 hidden sm:block">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-sm sm:text-base truncate max-w-[200px] sm:max-w-md">
                                {activeSessionId 
                                    ? sessions.find(s => s.id === activeSessionId)?.title || 'Đoạn chat' 
                                    : 'Cuộc trò chuyện mới'}
                            </h2>
                            <p className="text-xs text-slate-500 hidden sm:block">Trợ lý AI Marketing Fugalo</p>
                        </div>
                      </>
                  ) : (
                      <>
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600 hidden sm:block">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 text-sm sm:text-base">Đào tạo AI (Knowledge Base)</h2>
                            <p className="text-xs text-slate-500 hidden sm:block">Nạp thông tin nội bộ để AI tư vấn chính xác hơn</p>
                        </div>
                      </>
                  )}
              </div>

              {/* Context Selector (Chat Mode) */}
              {activeTab === 'CHAT' && (
                  <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 hidden sm:inline">Vai trò:</span>
                      <select 
                          value={roleContext} 
                          onChange={(e) => setRoleContext(e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                          disabled={viewUserId !== currentUser.id}
                      >
                          {Object.values(Role).map(r => (
                              <option key={r} value={r}>{r}</option>
                          ))}
                      </select>
                  </div>
              )}
          </div>

          {/* MAIN CONTENT AREA */}
          {activeTab === 'CHAT' ? (
              <>
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30 custom-scrollbar scroll-smooth"
                >
                    {!activeSessionId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70 p-8 text-center">
                            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                                <Sparkles size={40} className="text-purple-400 animate-pulse" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-600 mb-2">Bắt đầu dự án mới</h3>
                            <p className="text-sm max-w-md mb-6">Hãy đặt một câu hỏi hoặc yêu cầu để bắt đầu một đoạn hội thoại mới. Hệ thống sẽ tự động lưu lại thành một chủ đề riêng biệt.</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                                <button onClick={() => setPrompt("Lên kế hoạch content tuần tới cho Fanpage")} className="p-3 bg-white border border-slate-200 rounded-lg text-xs hover:border-purple-300 hover:text-purple-700 text-left transition-colors">
                                    💡 Lên kế hoạch content tuần tới...
                                </button>
                                <button onClick={() => setPrompt("Viết kịch bản video TikTok viral về sản phẩm")} className="p-3 bg-white border border-slate-200 rounded-lg text-xs hover:border-purple-300 hover:text-purple-700 text-left transition-colors">
                                    🎬 Viết kịch bản TikTok...
                                </button>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Đang tải tin nhắn...
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} group/msg animate-fade-in`}>
                                <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mx-2 shadow-sm border border-white mb-4
                                        ${msg.sender === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                        {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className="flex flex-col relative min-w-[200px]">
                                        <div className={`p-3.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed
                                            ${msg.sender === 'user' 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}`}>
                                            {msg.content}
                                        </div>
                                        <span className={`text-[10px] text-slate-400 mt-1 px-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            {msg.roleContext && msg.sender === 'ai' && ` • via ${msg.roleContext}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {loading && (
                    <div className="flex justify-start">
                        <div className="flex max-w-[80%]">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mx-2 animate-pulse border border-white shadow-sm">
                                <Bot size={16} />
                            </div>
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none text-slate-500 text-sm border border-slate-200 shadow-sm flex items-center">
                                <span className="mr-2 text-xs font-semibold">Gemini đang suy nghĩ</span>
                                <span className="animate-bounce mx-0.5">.</span>
                                <span className="animate-bounce mx-0.5 delay-75">.</span>
                                <span className="animate-bounce mx-0.5 delay-150">.</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100">
                    {viewUserId === currentUser.id ? (
                        <form onSubmit={handleSend} className="relative">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={activeSessionId ? "Nhập tin nhắn..." : "Nhập câu hỏi để bắt đầu chủ đề mới..."}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner text-sm"
                            disabled={loading}
                        />
                        <button 
                            type="submit" 
                            disabled={loading || !prompt.trim()}
                            className="absolute right-2 top-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-sm"
                        >
                            <Send size={16} />
                        </button>
                        </form>
                    ) : (
                        <div className="flex items-center justify-center p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
                            <Lock size={16} className="mr-2" />
                            Chế độ xem: Bạn không thể gửi tin nhắn vào hộp thoại của {viewingMember?.name}.
                        </div>
                    )}
                </div>
              </>
          ) : (
              // TRAINING MODE
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                  {!isAddingKnowledge ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                          <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4">
                              <BookOpen size={40} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">Đào tạo kiến thức cho AI</h3>
                          <p className="text-slate-500 max-w-lg mb-8 text-sm">
                              Cung cấp thông tin nội bộ (file, link, văn bản) để AI có thể đưa ra câu trả lời chính xác và phù hợp với doanh nghiệp.
                          </p>
                          <button 
                              onClick={() => setIsAddingKnowledge(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center"
                          >
                              <Plus size={20} className="mr-2" />
                              Thêm dữ liệu mới
                          </button>
                      </div>
                  ) : (
                      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-fade-in">
                          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                              <h3 className="font-bold text-lg text-slate-800 flex items-center">
                                  <FileText size={20} className="mr-2 text-blue-600" /> Thêm kiến thức mới
                              </h3>
                              <button onClick={resetKnowledgeForm} className="text-slate-400 hover:text-slate-600">
                                  <X size={20} />
                              </button>
                          </div>
                          
                          <form onSubmit={handleSaveKnowledge} className="space-y-4">
                              {/* INPUT TYPE TABS */}
                              <div className="flex bg-slate-50 p-1 rounded-lg mb-4 border border-slate-100">
                                  <button
                                      type="button"
                                      onClick={() => setInputType('TEXT')}
                                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center ${inputType === 'TEXT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      <FileText size={14} className="mr-1.5"/> Văn bản
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setInputType('FILE')}
                                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center ${inputType === 'FILE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      <FileCode size={14} className="mr-1.5"/> Tải File
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setInputType('LINK')}
                                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center ${inputType === 'LINK' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      <LinkIcon size={14} className="mr-1.5"/> Link / URL
                                  </button>
                              </div>

                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tiêu đề / Chủ đề</label>
                                  <input 
                                      type="text" 
                                      value={newTitle}
                                      onChange={(e) => setNewTitle(e.target.value)}
                                      placeholder="VD: Quy trình seeding 2024..."
                                      className="w-full border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                  />
                              </div>

                              {inputType === 'LINK' && (
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Đường dẫn (URL)</label>
                                      <input 
                                          type="url" 
                                          value={newUrl}
                                          onChange={(e) => setNewUrl(e.target.value)}
                                          placeholder="https://example.com/tai-lieu"
                                          className="w-full border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-blue-600"
                                      />
                                  </div>
                              )}

                              {inputType === 'FILE' && (
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Tải file lên (Text, CSV, JSON, MD...)</label>
                                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer group">
                                          <input 
                                              type="file" 
                                              onChange={handleFileUpload}
                                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                          />
                                          <div className="flex flex-col items-center">
                                              <Upload size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors mb-2" />
                                              <span className="text-sm font-medium text-slate-600">
                                                  {fileName || "Kéo thả hoặc nhấn để chọn file"}
                                              </span>
                                              <p className="text-xs text-slate-400 mt-1">Hỗ trợ tốt nhất cho file văn bản (.txt, .md, .csv). File PDF/Word vui lòng copy text.</p>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex justify-between">
                                      <span>{inputType === 'TEXT' ? 'Nội dung văn bản' : inputType === 'FILE' ? 'Nội dung trích xuất (Có thể chỉnh sửa)' : 'Nội dung tóm tắt từ Link'}</span>
                                  </label>
                                  <textarea 
                                      value={newContent}
                                      onChange={(e) => setNewContent(e.target.value)}
                                      placeholder={inputType === 'LINK' ? "Copy nội dung quan trọng từ website vào đây..." : "Nhập hoặc dán nội dung văn bản mà bạn muốn AI học..."}
                                      rows={10}
                                      className="w-full border border-slate-200 rounded-lg p-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50"
                                  />
                                  {inputType === 'FILE' && !newContent && (
                                      <p className="text-[10px] text-orange-500 mt-1 flex items-center">
                                          <AlertCircle size={10} className="mr-1"/> 
                                          Nếu nội dung không tự động hiện, vui lòng copy paste thủ công.
                                      </p>
                                  )}
                              </div>

                              <div className="flex justify-end gap-3 pt-2">
                                  <button 
                                      type="button" 
                                      onClick={resetKnowledgeForm}
                                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                  >
                                      Hủy
                                  </button>
                                  <button 
                                      type="submit"
                                      className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-md"
                                  >
                                      Lưu dữ liệu
                                  </button>
                              </div>
                          </form>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default AIAssistant;
