
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Member, Discussion, Comment, Role } from '../types';
import { addDiscussionToDB, updateDiscussionInDB, db, isFirebaseEnabled } from '../services/firebase';
import { collection, addDoc, onSnapshot, setDoc, doc, updateDoc, getDoc, deleteDoc, query, where, arrayUnion, arrayRemove } from 'firebase/firestore'; 
import { 
    Send, Image as ImageIcon, MessageSquare, Heart, MoreHorizontal, User, 
    ThumbsUp, Users, Lock, Unlock, Plus, X, Pencil, Save, Check, 
    ShieldAlert, CornerDownRight, Bell, BellOff, Search, Hash, 
    MoreVertical, Paperclip, Smile, Phone, Video, Info, Pin, ArrowLeft,
    Mic, MicOff, VideoOff, PhoneOff, Maximize2, Minimize2, FileText, Download,
    File as FileIcon, PlayCircle, Grid
} from 'lucide-react';

interface CollaborationProps {
  currentUser: Member;
  members: Member[];
  discussions: Discussion[];
}

const STORAGE_KEY_READS = 'fugalo_discussion_reads';

// Common Emojis
const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '🚀', '✅', '👀', '🤝', '💯', '🤔', '😅', '🙏'];

// WebRTC Config
const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Helper: Resize Image to Base64
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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

const Collaboration: React.FC<CollaborationProps> = ({ currentUser, members, discussions }) => {
  // --- STATE ---
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'GROUP' | 'DIRECT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Inputs
  const [messageInput, setMessageInput] = useState('');
  const [pendingFile, setPendingFile] = useState<{ content: string, name: string, type: 'IMAGE' | 'VIDEO' | 'FILE' } | null>(null);
  
  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'GROUP' | 'DIRECT'>('GROUP');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // --- WEBRTC STATE ---
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');
  const [incomingCallData, setIncomingCallData] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const unsubSignalsRef = useRef<(() => void) | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
              setShowEmojiPicker(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- HELPERS ---
  const getMember = (id: string) => members.find(m => m.id === id);
  
  const getTimeString = (isoString: string) => {
      return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // --- DERIVED STATE ---
  const activeDiscussion = useMemo(() => 
      discussions.find(d => d.id === selectedDiscussionId), 
  [discussions, selectedDiscussionId]);

  const sidebarList = useMemo(() => {
      let list = discussions;
      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          list = list.filter(d => 
              (d.title && d.title.toLowerCase().includes(q)) || 
              d.content.toLowerCase().includes(q) ||
              (d.memberIds && d.memberIds.some(mid => getMember(mid)?.name.toLowerCase().includes(q)))
          );
      }
      if (filterType === 'GROUP') list = list.filter(d => d.type === 'GROUP');
      if (filterType === 'DIRECT') list = list.filter(d => d.type === 'DIRECT');
      
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [discussions, searchQuery, filterType, members]);

  // --- LISTENER FOR INCOMING CALLS ---
  useEffect(() => {
      if (!isFirebaseEnabled || !db) return;

      const q = query(collection(db, 'calls'), where('status', '==', 'ACTIVE'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              
              const isMyDiscussion = discussions.some(d => d.id === data.discussionId && d.memberIds.includes(currentUser.id));
              const isDirectCall = data.receiverId === currentUser.id;
              
              if (change.type === 'added') {
                  if ((isMyDiscussion || isDirectCall) && data.initiatorId !== currentUser.id && !activeCallId) {
                      setIncomingCallData({ id: change.doc.id, ...data });
                      setCallStatus('receiving');
                  }
              }
              if (change.type === 'removed') {
                  if (activeCallId === change.doc.id || (incomingCallData && incomingCallData.id === change.doc.id)) {
                      hangupCall();
                  }
              }
          });
      });

      return () => unsubscribe();
  }, [currentUser.id, activeCallId, discussions, isFirebaseEnabled]);

  // Setup Local Stream in UI
  useEffect(() => {
      if (localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
      }
  }, [localStream]);

  // --- WEBRTC CORE FUNCTIONS ---
  const setupMedia = async (video: boolean = true) => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
          setLocalStream(stream);
          return stream;
      } catch (err: any) {
          console.error("Error accessing media devices.", err);
          alert("Lỗi truy cập thiết bị. Vui lòng kiểm tra quyền Camera/Mic.");
          return null;
      }
  };

  const createPC = (targetUserId: string, stream: MediaStream) => {
      const peer = new RTCPeerConnection(servers);
      
      stream.getTracks().forEach(track => {
          peer.addTrack(track, stream);
      });

      peer.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
              setRemoteStreams(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
          }
      };

      peer.onicecandidate = (event) => {
          if (event.candidate && activeCallId) {
              const signalRef = collection(db, 'calls', activeCallId, 'signals');
              addDoc(signalRef, {
                  type: 'CANDIDATE',
                  from: currentUser.id,
                  to: targetUserId,
                  candidate: event.candidate.toJSON()
              });
          }
      };

      peersRef.current.set(targetUserId, peer);
      return peer;
  };

  const startCall = async (isVideo: boolean) => {
      if (!isFirebaseEnabled) { alert("Tính năng gọi chỉ hoạt động Online."); return; }
      if (!activeDiscussion) return;

      const stream = await setupMedia(isVideo);
      if (!stream) return;

      setCallStatus('calling');
      setIsCameraOff(!isVideo);

      const callDoc = doc(collection(db, 'calls'));
      setActiveCallId(callDoc.id);

      const isGroup = activeDiscussion.type === 'GROUP';
      const receiverId = isGroup ? null : (activeDiscussion.memberIds.find(id => id !== currentUser.id) || activeDiscussion.authorId);

      await setDoc(callDoc, {
          discussionId: activeDiscussion.id,
          initiatorId: currentUser.id,
          receiverId: receiverId,
          type: isVideo ? 'VIDEO' : 'AUDIO',
          participants: [currentUser.id],
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
      });

      listenToSignals(callDoc.id, stream);
  };

  const joinCall = async () => {
      if (!incomingCallData) return;
      const callId = incomingCallData.id;
      const isVideo = incomingCallData.type === 'VIDEO';

      const stream = await setupMedia(isVideo);
      if (!stream) return;

      setActiveCallId(callId);
      setCallStatus('connected');
      setIsCameraOff(!isVideo);

      const callRef = doc(db, 'calls', callId);
      await updateDoc(callRef, {
          participants: arrayUnion(currentUser.id)
      });

      const callSnapshot = await getDoc(callRef);
      if (callSnapshot.exists()) {
          const data = callSnapshot.data();
          const participants = data.participants || [];
          
          participants.forEach(async (pId: string) => {
              if (pId !== currentUser.id) {
                  const peer = createPC(pId, stream);
                  const offer = await peer.createOffer();
                  await peer.setLocalDescription(offer);
                  
                  addDoc(collection(db, 'calls', callId, 'signals'), {
                      type: 'OFFER',
                      from: currentUser.id,
                      to: pId,
                      sdp: offer.sdp,
                      sdpType: offer.type
                  });
              }
          });
      }

      listenToSignals(callId, stream);
  };

  const listenToSignals = (callId: string, stream: MediaStream) => {
      const q = query(collection(db, 'calls', callId, 'signals'), where('to', '==', currentUser.id));
      
      const unsub = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                  const data = change.doc.data();
                  const senderId = data.from;
                  
                  if (data.type === 'OFFER') {
                      const peer = createPC(senderId, stream);
                      await peer.setRemoteDescription(new RTCSessionDescription({ type: data.sdpType, sdp: data.sdp }));
                      const answer = await peer.createAnswer();
                      await peer.setLocalDescription(answer);
                      
                      addDoc(collection(db, 'calls', callId, 'signals'), {
                          type: 'ANSWER',
                          from: currentUser.id,
                          to: senderId,
                          sdp: answer.sdp,
                          sdpType: answer.type
                      });
                  } 
                  else if (data.type === 'ANSWER') {
                      const peer = peersRef.current.get(senderId);
                      if (peer) {
                          await peer.setRemoteDescription(new RTCSessionDescription({ type: data.sdpType, sdp: data.sdp }));
                      }
                  }
                  else if (data.type === 'CANDIDATE') {
                      const peer = peersRef.current.get(senderId);
                      if (peer) {
                          await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                      }
                  }
              }
          });
      });
      unsubSignalsRef.current = unsub;
  };

  const hangupCall = async () => {
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
      }
      
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      setRemoteStreams({});

      if (unsubSignalsRef.current) unsubSignalsRef.current();

      if (activeCallId && isFirebaseEnabled) {
          const callRef = doc(db, 'calls', activeCallId);
          try {
              const snap = await getDoc(callRef);
              if (snap.exists()) {
                  const data = snap.data();
                  if (data.initiatorId === currentUser.id) {
                      await deleteDoc(callRef); 
                  } else {
                      await updateDoc(callRef, {
                          participants: arrayRemove(currentUser.id)
                      });
                  }
              }
          } catch(e) { console.error("Hangup DB error", e); }
      }

      setActiveCallId(null);
      setIncomingCallData(null);
      setCallStatus('idle');
  };

  const toggleMute = () => {
      if (localStream) {
          localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
          setIsMuted(!isMuted);
      }
  };

  const toggleVideo = () => {
      if (localStream) {
          localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
          setIsCameraOff(!isCameraOff);
      }
  };

  // --- SCROLL LOGIC ---
  useEffect(() => {
      if (selectedDiscussionId) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [selectedDiscussionId, discussions]);

  // --- HELPERS ---
  const markAsRead = (discussionId: string) => {
      try {
          const reads = JSON.parse(localStorage.getItem(STORAGE_KEY_READS) || '{}');
          reads[discussionId] = new Date().toISOString();
          localStorage.setItem(STORAGE_KEY_READS, JSON.stringify(reads));
          window.dispatchEvent(new Event('fugalo_discussion_read_updated'));
      } catch (e) { console.error(e); }
  };

  const isUnread = (discussion: Discussion) => {
      try {
          const reads = JSON.parse(localStorage.getItem(STORAGE_KEY_READS) || '{}');
          const lastActivity = new Date(discussion.timestamp).getTime();
          const lastRead = reads[discussion.id] ? new Date(reads[discussion.id]).getTime() : 0;
          return lastActivity > lastRead;
      } catch { return true; }
  };

  // --- ACTION HANDLERS ---
  const handleCreateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newContent.trim()) return;
      if (createType === 'GROUP' && !newTitle.trim()) { alert("Vui lòng nhập tên nhóm"); return; }
      if (selectedMembers.length === 0 && createType === 'DIRECT') { alert("Vui lòng chọn người nhận"); return; }

      const memberIds = Array.from(new Set([...selectedMembers, currentUser.id]));
      
      const newDisc: Discussion = {
          id: Date.now().toString(),
          type: createType,
          title: createType === 'GROUP' ? newTitle : undefined,
          content: newContent,
          authorId: currentUser.id,
          memberIds: memberIds,
          timestamp: new Date().toISOString(),
          likes: [],
          comments: []
      };

      await addDiscussionToDB(newDisc);
      setIsCreating(false);
      setNewTitle(''); setNewContent(''); setSelectedMembers([]);
      setSelectedDiscussionId(newDisc.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeDiscussion || (!messageInput.trim() && !pendingFile)) return;

      const newComment: Comment = {
          id: Date.now().toString(),
          authorId: currentUser.id,
          content: messageInput,
          image: pendingFile ? pendingFile.content : null,
          timestamp: new Date().toISOString(),
          replies: [],
          ...(pendingFile ? { attachmentName: pendingFile.name } : {})
      };

      const updatedDiscussion = {
          ...activeDiscussion,
          timestamp: new Date().toISOString(),
          comments: [...activeDiscussion.comments, newComment]
      };

      await updateDiscussionInDB(updatedDiscussion);
      setMessageInput('');
      setPendingFile(null); 
      markAsRead(activeDiscussion.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      // Increased limit to 5MB for videos
      if (file.size > 5 * 1024 * 1024) {
          alert("File đính kèm phải nhỏ hơn 5MB.");
          return;
      }

      if (file.type.startsWith('image/')) {
          try {
              const base64 = await resizeImage(file);
              setPendingFile({ content: base64, name: file.name, type: 'IMAGE' });
          } catch (err) { alert("Lỗi xử lý ảnh."); }
      } else {
          const reader = new FileReader();
          reader.onload = (event) => {
              if (event.target?.result) {
                  const content = event.target.result as string;
                  // Improved Video Detection: Type OR Extension
                  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(file.name);
                  setPendingFile({ 
                      content: content, 
                      name: file.name, 
                      type: isVideo ? 'VIDEO' : 'FILE' 
                  });
              }
          };
          reader.readAsDataURL(file);
      }
      if (e.target) e.target.value = '';
  };

  const addEmoji = (emoji: string) => { setMessageInput(prev => prev + emoji); };

  const renderSidebarItem = (item: Discussion) => {
      const isSelected = item.id === selectedDiscussionId;
      const unread = isUnread(item);
      const isGroup = item.type === 'GROUP';
      let title = item.title;
      let avatar = null;
      if (!isGroup) {
          const partnerId = (item.memberIds || []).find(id => id !== currentUser.id) || item.authorId;
          const partner = getMember(partnerId);
          title = partner?.name || 'Unknown User';
          avatar = partner?.avatar;
      }
      let lastMsgContent = item.content;
      if (item.comments.length > 0) {
          const lastComment = item.comments[item.comments.length - 1];
          if (lastComment.image) {
              // Enhanced Sidebar Preview Detection
              const isVideo = lastComment.image.startsWith('data:video') || (lastComment.attachmentName && /\.(mp4|webm|ogg|mov)$/i.test(lastComment.attachmentName));
              const isImage = lastComment.image.startsWith('data:image') || lastComment.image.startsWith('https://');
              
              const prefix = isVideo ? '[Video]' : isImage ? '[Ảnh]' : '[Tệp]';
              lastMsgContent = lastComment.content ? `${prefix} ${lastComment.content}` : `${prefix} Đính kèm`;
          } else { lastMsgContent = lastComment.content; }
      }
      return (
          <div 
              key={item.id}
              onClick={() => { setSelectedDiscussionId(item.id); markAsRead(item.id); }}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'}`}
          >
              <div className="relative">
                  {isGroup ? (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm ${isSelected ? 'bg-blue-600' : 'bg-slate-400'}`}><Hash size={20} /></div>
                  ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
                          {avatar ? <img src={avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">{title?.charAt(0)}</div>}
                      </div>
                  )}
                  {unread && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                      <h4 className={`text-sm font-bold truncate ${unread ? 'text-slate-900' : 'text-slate-600'}`}>{title}</h4>
                      <span className="text-[10px] text-slate-400">{getTimeString(item.timestamp)}</span>
                  </div>
                  <p className={`text-xs truncate ${unread ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{lastMsgContent}</p>
              </div>
          </div>
      );
  };

  return (
    <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-6rem)] flex bg-slate-50 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
        
        {/* --- LEFT SIDEBAR (Unchanged) --- */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex flex-col ${selectedDiscussionId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Thảo luận</h2>
                    <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white p-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors"><Plus size={20} /></button>
                </div>
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="Tìm nhóm hoặc người..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['ALL', 'GROUP', 'DIRECT'].map(type => (
                        <button key={type} onClick={() => setFilterType(type as any)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${filterType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{type === 'ALL' ? 'Tất cả' : type === 'GROUP' ? 'Nhóm' : 'Tin nhắn'}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {sidebarList.length === 0 ? <div className="text-center py-10 text-slate-400 text-xs italic">Không tìm thấy cuộc hội thoại nào.</div> : sidebarList.map(renderSidebarItem)}
            </div>
        </div>

        {/* --- RIGHT MAIN AREA --- */}
        {selectedDiscussionId && activeDiscussion ? (
            <div className="flex-1 flex flex-col bg-slate-50 relative w-full overflow-hidden">
                
                {/* INCOMING CALL OVERLAY */}
                {callStatus === 'receiving' && incomingCallData && (
                    <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center animate-fade-in">
                        <div className="bg-slate-900 rounded-2xl p-8 text-center border border-slate-700 shadow-2xl max-w-sm w-full">
                            <div className="w-24 h-24 rounded-full bg-slate-800 mx-auto mb-6 flex items-center justify-center animate-pulse border-4 border-slate-700">
                                {incomingCallData.discussionId && <Users size={40} className="text-blue-400"/>}
                                {!incomingCallData.discussionId && <User size={48} className="text-slate-400"/>}
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">
                                {incomingCallData.receiverId ? "Cuộc gọi đến..." : "Cuộc gọi nhóm..."}
                            </h3>
                            <p className="text-slate-400 mb-8 flex items-center justify-center">
                                {incomingCallData.type === 'VIDEO' ? <Video size={16} className="mr-2"/> : <Phone size={16} className="mr-2"/>} 
                                {getMember(incomingCallData.initiatorId)?.name || 'Unknown'} đang gọi
                            </p>
                            <div className="flex justify-center gap-8">
                                <button onClick={hangupCall} className="p-4 bg-red-600 rounded-full text-white hover:bg-red-700 transition-transform hover:scale-110 shadow-lg">
                                    <PhoneOff size={32}/>
                                </button>
                                <button onClick={joinCall} className="p-4 bg-green-500 rounded-full text-white hover:bg-green-600 transition-transform hover:scale-110 shadow-lg animate-bounce">
                                    <Phone size={32}/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVE CALL UI */}
                {(callStatus === 'calling' || callStatus === 'connected') && (
                    <div className="absolute inset-0 z-[50] bg-slate-900 flex flex-col animate-fade-in">
                        <div className="flex-1 relative overflow-hidden flex flex-wrap bg-black p-2 gap-2 content-center justify-center">
                            
                            {Object.keys(remoteStreams).map(userId => (
                                <div key={userId} className="relative bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-sm flex-1 min-w-[300px] max-w-[600px] aspect-video">
                                    <video 
                                        autoPlay playsInline 
                                        className="w-full h-full object-cover"
                                        ref={(el) => { if(el) el.srcObject = remoteStreams[userId] }} 
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs font-bold">
                                        {getMember(userId)?.name || 'User'}
                                    </div>
                                </div>
                            ))}

                            {Object.keys(remoteStreams).length === 0 && callStatus === 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center text-white">
                                    <div className="text-center">
                                        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4 mx-auto animate-pulse">
                                            <Users size={48} className="text-slate-500"/>
                                        </div>
                                        <p>Đang chờ người khác tham gia...</p>
                                    </div>
                                </div>
                            )}

                            <div className="absolute top-4 right-4 w-32 h-24 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl z-20">
                                <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`} />
                                {isCameraOff && <div className="w-full h-full flex items-center justify-center text-slate-500"><VideoOff size={24}/></div>}
                                <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/50 px-1 rounded">Bạn</div>
                            </div>
                        </div>

                        <div className="bg-slate-800/80 backdrop-blur-md p-6 flex justify-center gap-6 absolute bottom-6 left-1/2 transform -translate-x-1/2 rounded-full border border-slate-700 shadow-2xl z-30">
                            <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>{isMuted ? <MicOff size={24}/> : <Mic size={24}/>}</button>
                            <button onClick={hangupCall} className="p-4 px-8 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg transform hover:scale-105 transition-all"><PhoneOff size={32} /></button>
                            <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isCameraOff ? 'bg-white text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>{isCameraOff ? <VideoOff size={24}/> : <Video size={24}/>}</button>
                        </div>
                    </div>
                )}

                {/* --- CHAT HEADER --- */}
                <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedDiscussionId(null)} className="md:hidden text-slate-500 hover:text-blue-600">
                            <ArrowLeft size={20}/>
                        </button>
                        {activeDiscussion.type === 'GROUP' ? (
                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                <Hash size={20} />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                                {(() => {
                                    const partnerId = (activeDiscussion.memberIds || []).find(id => id !== currentUser.id) || activeDiscussion.authorId;
                                    const partner = getMember(partnerId);
                                    return partner?.avatar ? <img src={partner.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">{partner?.name.charAt(0)}</div>
                                })()}
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">
                                {activeDiscussion.type === 'GROUP' 
                                    ? activeDiscussion.title 
                                    : getMember((activeDiscussion.memberIds || []).find(id => id !== currentUser.id) || activeDiscussion.authorId)?.name || "Unknown"}
                            </h3>
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                {activeDiscussion.type === 'GROUP' ? (
                                    <>
                                        <Users size={12}/> {(activeDiscussion.memberIds || []).length} thành viên
                                    </>
                                ) : (
                                    <span className="flex items-center text-green-600"><div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>Online</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                        <button onClick={() => startCall(false)} className="hover:text-blue-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-blue-50" title="Gọi thoại"><Phone size={20}/></button>
                        <button onClick={() => startCall(true)} className="hover:text-blue-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-blue-50" title="Gọi Video"><Video size={20}/></button>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <button className="hover:text-blue-600 transition-colors"><Info size={20}/></button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <div className="flex justify-center my-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 max-w-2xl w-full text-center">
                            <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-100 px-2 py-1 rounded-full mb-2 inline-block">Chủ đề thảo luận</span>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                {activeDiscussion.content}
                            </p>
                            <div className="mt-2 text-xs text-slate-400">
                                Tạo bởi <b>{getMember(activeDiscussion.authorId)?.name}</b> • {new Date(activeDiscussion.timestamp).toLocaleDateString('vi-VN')}
                            </div>
                        </div>
                    </div>

                    {activeDiscussion.comments.map((comment) => {
                        const isMe = comment.authorId === currentUser.id;
                        const author = getMember(comment.authorId);
                        
                        // ENHANCED VIDEO DETECTION LOGIC
                        const isVideo = comment.image && (
                            comment.image.startsWith('data:video') || 
                            comment.image.endsWith('.mp4') ||
                            (comment.attachmentName && /\.(mp4|webm|ogg|mov)$/i.test(comment.attachmentName))
                        );
                        
                        const isImage = comment.image && !isVideo && (
                            comment.image.startsWith('data:image') || 
                            comment.image.startsWith('https://')
                        );
                        
                        const isFile = comment.image && !isImage && !isVideo;
                        
                        return (
                            <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                <div className={`flex max-w-[85%] md:max-w-[70%] items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {!isMe && (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-white shadow-sm mb-1">
                                            {author?.avatar ? <img src={author.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-xs">{author?.name.charAt(0)}</div>}
                                        </div>
                                    )}
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            {!isMe && <span className="text-[10px] font-bold text-slate-600">{author?.name}</span>}
                                            <span className="text-[10px] text-slate-400">{getTimeString(comment.timestamp)}</span>
                                        </div>
                                        <div className={`p-3 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                                            isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-none'
                                        }`}>
                                            {isImage && (
                                                <div className="mb-2 group/image relative cursor-zoom-in" onClick={() => setLightboxImage(comment.image!)}>
                                                    <img 
                                                        src={comment.image!} 
                                                        alt="Attachment" 
                                                        className="max-w-full rounded-lg max-h-64 object-contain bg-white/10 transition-transform hover:scale-[1.02]" 
                                                    />
                                                </div>
                                            )}
                                            {isVideo && (
                                                <div className="mb-2">
                                                    <video 
                                                        src={comment.image!} 
                                                        controls 
                                                        className="max-w-full rounded-lg max-h-64 bg-black w-full" 
                                                    />
                                                </div>
                                            )}
                                            {isFile && (
                                                <div className={`mb-2 p-2 rounded-lg flex items-center gap-3 ${isMe ? 'bg-white/20' : 'bg-slate-100'}`}>
                                                    <div className="bg-white p-2 rounded text-slate-600">
                                                        <FileIcon size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-xs truncate max-w-[150px]">{comment.attachmentName || "Tệp tin đính kèm"}</div>
                                                        <a href={comment.image!} download={comment.attachmentName || "download"} className={`text-[10px] underline ${isMe ? 'text-white/80 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}>
                                                            Tải xuống
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                            {comment.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200 relative">
                    {showEmojiPicker && (
                        <div ref={emojiRef} className="absolute bottom-20 right-4 bg-white shadow-2xl border border-slate-200 rounded-2xl p-3 grid grid-cols-4 gap-2 z-50 animate-fade-in w-48">
                            {COMMON_EMOJIS.map(e => (
                                <button 
                                    key={e} 
                                    type="button" 
                                    onClick={() => addEmoji(e)} 
                                    className="text-xl p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}

                    {pendingFile && (
                        <div className="absolute bottom-full left-4 mb-2 bg-white p-3 rounded-xl shadow-lg border border-slate-200 animate-fade-in flex items-center gap-3 z-10 max-w-sm">
                            {pendingFile.type === 'IMAGE' ? (
                                <img src={pendingFile.content} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-slate-100" />
                            ) : pendingFile.type === 'VIDEO' ? (
                                <div className="h-16 w-16 bg-slate-900 rounded-lg flex items-center justify-center text-white border border-slate-700">
                                    <PlayCircle size={24} />
                                </div>
                            ) : (
                                <div className="h-16 w-16 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 border border-blue-100">
                                    <FileIcon size={24} />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-700 truncate">{pendingFile.name}</div>
                                <div className="text-[10px] text-slate-500">
                                    {pendingFile.type === 'IMAGE' ? 'Hình ảnh' : pendingFile.type === 'VIDEO' ? 'Video' : 'Tập tin'}
                                </div>
                            </div>
                            <button onClick={() => setPendingFile(null)} className="bg-red-50 text-red-500 rounded-full p-1.5 hover:bg-red-100 transition-colors"><X size={14} /></button>
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
                        <div className="flex-1 bg-slate-100 rounded-xl flex items-center px-2 py-1 border border-transparent focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()} 
                                className={`p-2 rounded-full transition-colors ${pendingFile ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-200'}`}
                                title="Đính kèm ảnh hoặc tệp tin"
                            >
                                <Paperclip size={20} />
                            </button>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden" 
                            />
                            
                            <input 
                                type="text" 
                                value={messageInput} 
                                onChange={(e) => setMessageInput(e.target.value)} 
                                placeholder={pendingFile ? "Thêm chú thích (Tùy chọn)..." : "Nhập tin nhắn..."} 
                                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 px-2 py-3"
                            />
                            
                            <button 
                                type="button" 
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:text-yellow-500 hover:bg-slate-200'}`}
                                title="Biểu cảm"
                            >
                                <Smile size={20} />
                            </button>
                        </div>
                        <button type="submit" disabled={!messageInput.trim() && !pendingFile} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-md flex-shrink-0"><Send size={20} /></button>
                    </form>
                </div>
            </div>
        ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 text-slate-400">
                <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <MessageSquare size={64} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-600 mb-2">Chào mừng đến với Work Chat</h3>
                <p className="text-sm max-w-xs text-center text-slate-500">
                    Chọn một cuộc hội thoại từ danh sách bên trái hoặc tạo nhóm mới để bắt đầu thảo luận công việc.
                </p>
                <button onClick={() => setIsCreating(true)} className="mt-6 px-6 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
                    Tạo cuộc trò chuyện mới
                </button>
            </div>
        )}

        {/* --- LIGHTBOX MODAL --- */}
        {lightboxImage && (
            <div 
                className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" 
                onClick={() => setLightboxImage(null)}
            >
                <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X size={32} />
                </button>
                <img 
                    src={lightboxImage} 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                    onClick={e => e.stopPropagation()} 
                    alt="Zoomed"
                />
            </div>
        )}

        {/* --- CREATE MODAL --- */}
        {isCreating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800 text-lg">Tạo cuộc hội thoại mới</h3>
                        <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                        <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                            <button type="button" onClick={() => setCreateType('GROUP')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${createType === 'GROUP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Nhóm mới</button>
                            <button type="button" onClick={() => setCreateType('DIRECT')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${createType === 'DIRECT' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>Tin nhắn riêng</button>
                        </div>
                        {createType === 'GROUP' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tên nhóm</label>
                                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="VD: Team Marketing, Chiến dịch A..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Thành viên</label>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-slate-50 custom-scrollbar">
                                {members.filter(m => m.id !== currentUser.id).map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                            if (createType === 'DIRECT') setSelectedMembers([m.id]);
                                            else setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                                        }}
                                        className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedMembers.includes(m.id) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}
                                    >
                                        {m.name}
                                        {selectedMembers.includes(m.id) && <Check size={12} className="ml-1"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tin nhắn đầu tiên</label>
                            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Xin chào mọi người..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center">
                                <Send size={16} className="mr-2" /> Bắt đầu trò chuyện
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default Collaboration;
