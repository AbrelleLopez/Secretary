import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Library, 
  Filter, 
  Loader2, 
  LogOut, 
  Languages, 
  User as UserIcon, 
  Calendar, 
  Star,
  Info,
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  BookOpen,
  ArrowUpAz,
  ArrowDownAz,
  PlusCircle,
  XCircle,
  Plus,
  MinusCircle,
  RefreshCw,
  Edit3,
  AlertTriangle,
  Bell,
  CheckCircle2,
  MessageCircle,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { 
  saveRecentRead, 
  getCollection, 
  toggleDropStatus, 
  deleteComic,
  updateComic
} from './services/firestoreService';
import { 
  getNotifications, 
  markAsRead, 
  checkForUpdates,
  deleteNotification 
} from './services/notificationService';
import { sendMessage, subscribeToChat } from './services/chatService';
import { ComicInfo, ComicType, ComicStatus, Notification, ChatMessage } from './types';

type Tab = 'explore' | 'secretary' | 'dropped';
type SortOrder = 'recent' | 'oldest' | 'az' | 'za';

interface SearchResult {
  title: string;
  options: ComicInfo[];
  selectedInfo?: ComicInfo;
  isCustom?: boolean;
  duplicate?: boolean;
}

interface ComicCardProps {
  key?: React.Key;
  comic: ComicInfo;
  onDropToggle?: (id: string, status: boolean) => void;
  onDelete?: (id: string) => void;
  onEdit?: (comic: ComicInfo) => void;
  isDroppedView?: boolean;
}

function ComicCard({ 
  comic, 
  onDropToggle,
  onDelete,
  onEdit,
  isDroppedView = false 
}: ComicCardProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!comic.id) return;
    
    if (confirmDeleteId === comic.id) {
      onDelete?.(comic.id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(comic.id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="bg-[#0f172a] border border-slate-800/80 rounded-3xl p-6 hover:border-[#ec4899]/50 hover:bg-[#111a2e] transition-all group relative shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ec4899]/5 to-transparent -mr-16 -mt-16 rounded-full blur-2xl group-hover:from-[#ec4899]/10 transition-all" />
      
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="flex-1 pr-6">
          <h3 className="text-xl font-black text-white mb-2 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#a855f7] group-hover:to-[#ec4899] transition-all">{comic.title}</h3>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] ${
              comic.type === 'manga' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' :
              comic.type === 'manhwa' ? 'bg-[#ec4899]/20 text-[#ec4899] border border-[#ec4899]/30' :
              comic.type === 'manhua' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {comic.type}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] bg-slate-900/60 text-slate-500 border border-slate-800">
              {comic.status}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 relative z-20">
          {(onDropToggle || onDelete || onEdit) && (
            <div className="flex flex-col gap-2 bg-slate-950/40 backdrop-blur-md rounded-2xl p-1.5 border border-slate-800/50 shadow-xl lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
              {onEdit && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(comic);
                  }}
                  className="p-2.5 rounded-xl text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all transition-colors"
                  title="Edit Record"
                >
                  <Edit3 size={18} />
                </button>
              )}

              {onDropToggle && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (comic.id) onDropToggle(comic.id, !isDroppedView);
                  }}
                  className={`p-2.5 rounded-xl transition-all ${
                    isDroppedView 
                      ? 'text-purple-400 hover:bg-purple-500 hover:text-white' 
                      : 'text-[#ec4899] hover:bg-[#ec4899] hover:text-white'
                  }`}
                  title={isDroppedView ? "Recover to Secretary" : "Move to Dropped"}
                >
                  {isDroppedView ? <RefreshCw size={18} /> : <MinusCircle size={18} />}
                </button>
              )}

              {onDelete && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!comic.id) return;
                    
                    if (confirmDeleteId === comic.id) {
                      await onDelete(comic.id);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(comic.id);
                      // Auto-cancel after 5 seconds to give more time
                      setTimeout(() => setConfirmDeleteId(null), 5000);
                    }
                  }}
                  className={`p-2.5 rounded-xl transition-all border flex items-center gap-2 ${
                    confirmDeleteId === comic.id 
                      ? 'bg-red-600 text-white border-red-500 scale-110 shadow-lg shadow-red-500/40 z-30' 
                      : 'text-red-500 hover:bg-red-500 hover:text-white bg-red-500/5 border-transparent'
                  }`}
                  title={confirmDeleteId === comic.id ? "Click AGAIN to confirm permanent purge" : "Permanent Erase"}
                >
                  <Trash2 size={18} />
                  {confirmDeleteId === comic.id && <span className="text-[9px] font-black uppercase tracking-widest pr-1">Confirm?</span>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>


      <p className="text-sm text-slate-400 mb-6 line-clamp-3 leading-relaxed h-[4.5rem]">
        {comic.synopsis}
      </p>

      <div className="grid grid-cols-1 gap-y-2 mb-6">
        <div className="flex items-center gap-3 text-slate-500">
          <UserIcon size={14} />
          <span className="text-[11px] font-bold truncate">{comic.author}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <Calendar size={14} />
          <span className="text-[11px] font-bold">{comic.releaseYear}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <Languages size={14} />
          <span className="text-[11px] font-bold uppercase">{comic.originalLanguage}</span>
        </div>
        {comic.timestamp && (
          <div className="flex items-center gap-3 text-[#ec4899]/60 mt-1">
            <Info size={12} />
            <span className="text-[9px] font-black uppercase tracking-[0.1em]">
              Added {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(comic.timestamp)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-4 border-t border-slate-800/50">
        {comic.genres.slice(0, 3).map(genre => (
          <span key={genre} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-950/50 text-slate-500 rounded border border-slate-900 border-dashed">
            {genre}
          </span>
        ))}
        {comic.genres.length > 3 && (
          <span className="text-[10px] px-2 py-0.5 text-slate-600">+{comic.genres.length - 3}</span>
        )}
      </div>
    </motion.div>
  );
}


function NotificationArea({ 
  notifications, 
  onMarkRead, 
  onClose,
  onClear
}: { 
  notifications: Notification[], 
  onMarkRead: (id: string) => void, 
  onClose: () => void,
  onClear: (id: string) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="absolute top-full right-0 mt-4 w-80 sm:w-96 bg-[#0a1229] border border-[#3d0a1e] rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-[120] overflow-hidden backdrop-blur-2xl"
    >
      <div className="p-6 border-b border-[#3d0a1e] flex items-center justify-between bg-gradient-to-r from-[#3d0a1e]/20 to-transparent">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white italic">Intelligence.</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <XCircle size={20} />
        </button>
      </div>
      
      <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="mx-auto mb-4 text-slate-800" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">No Intelligence Data</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-5 border-b border-[#3d0a1e]/50 transition-all relative group ${n.read ? 'opacity-60' : 'bg-[#ec4899]/5'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                    n.type === 'status_change' ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {n.type.replace('_', ' ')}
                  </span>
                  {!n.read && (
                    <button 
                      onClick={() => n.id && onMarkRead(n.id)}
                      className="text-[#ec4899] hover:text-emerald-400 transition-colors"
                      title="Mark as Seen"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                  {n.read && (
                    <button 
                      onClick={() => n.id && onClear(n.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <h4 className="text-[11px] font-black text-white mb-1 uppercase tracking-tight">{n.title}</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">{n.message}</p>
                <span className="text-[8px] font-bold text-slate-600 mt-3 block uppercase">
                  {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' }).format(n.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GroupChat({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChat(setMessages);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 300, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.95 }}
      className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-[#0a1229] border-l border-[#3d0a1e] shadow-[-20px_0_100px_rgba(0,0,0,0.8)] z-[200] flex flex-col pt-24 md:pt-0"
    >
      <div className="p-8 border-b border-[#3d0a1e] flex items-center justify-between bg-gradient-to-r from-[#3d0a1e]/20 to-transparent">
        <div>
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white italic flex items-center gap-3">
            Intelligence Mesh.
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[8px] font-black text-emerald-400 tracking-widest animate-pulse">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              LIVE
            </span>
          </h3>
          <p className="text-[10px] font-bold text-[#ec4899] uppercase tracking-widest mt-1">Direct Secure Line</p>
        </div>
        <button onClick={onClose} className="p-3 rounded-2xl bg-[#3d0a1e]/30 text-slate-500 hover:text-white transition-all hover:scale-110">
          <XCircle size={24} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.userId === user?.uid ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-3xl p-5 border ${
              m.userId === user?.uid 
                ? 'bg-[#ec4899]/10 border-[#ec4899]/30 rounded-tr-none' 
                : 'bg-[#1e293b]/40 border-[#3d0a1e] rounded-tl-none'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-tighter text-[#ec4899]">{m.userName}</span>
                <span className="text-[8px] font-bold text-slate-600 uppercase">
                  {m.timestamp instanceof Date ? m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200 leading-relaxed break-words">{m.message}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-[#0a1229] border-t border-[#3d0a1e]">
        <form onSubmit={handleSend} className="relative">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Relay message to the network..."
            className="w-full bg-[#1e293b]/50 border border-[#3d0a1e] rounded-2xl py-5 pl-6 pr-20 text-sm font-medium text-white focus:outline-none focus:border-[#ec4899]/50 transition-all placeholder:text-slate-700"
          />
          <button 
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-[#ec4899] text-white hover:bg-[#d946ef] transition-all disabled:opacity-50 disabled:grayscale"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function MainContent() {
  const { user, logout, login } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiExhausted, setIsAiExhausted] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('explore');
  
  // Data States
  const [collection, setCollection] = useState<ComicInfo[]>([]);
  const [droppedList, setDroppedList] = useState<ComicInfo[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [editingComic, setEditingComic] = useState<ComicInfo | null>(null);

  // Notification States
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  // Filter States
  const [filterType, setFilterType] = useState<ComicType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ComicStatus | 'all'>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'info' | 'success' | 'warn' } | null>(null);

  useEffect(() => {
    // Check if AI is configured on mount
    import('./services/geminiService').then(m => {
      if (!m.isAIConfigured()) {
        setIsAiExhausted(true);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      loadAllData();
      loadNotifications();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && collection.length > 0 && !isCheckingUpdates) {
      const lastCheck = localStorage.getItem('last_intelligence_check');
      const now = Date.now();
      const COOLDOWN = 30 * 60 * 1000; // 30 minutes

      if (!lastCheck || (now - parseInt(lastCheck)) > COOLDOWN) {
        performBackgroundCheck();
        localStorage.setItem('last_intelligence_check', now.toString());
      }
    }
  }, [user, collection.length > 0]);

  const loadNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  const performBackgroundCheck = async () => {
    if (isCheckingUpdates || collection.length === 0) return;
    setIsCheckingUpdates(true);
    showToast("Background Check Initiated...", "info");
    try {
      await checkForUpdates(collection);
      await loadNotifications();
      await loadAllData();
      showToast("Intelligence Sync Complete", "success");
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const loadAllData = async () => {
    const [c, d] = await Promise.all([
      getCollection(false),
      getCollection(true)
    ]);
    setCollection(c);
    setDroppedList(d);
  };

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleBatchLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTitles = inputText.split('\n').map(t => t.trim()).filter(t => t !== '');
    if (allTitles.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setResults([]);
    let duplicatesFound = 0;

    try {
      const resultsAccumulator: SearchResult[] = [];
      const titlesToSearch: string[] = [];
      
      // Reset exhaustion status on new attempt
      setIsAiExhausted(false);

      // 1. Initial Duplicate Filtering
      for (const title of allTitles) {
        const cleanSearchTitle = title.replace(/['’]/g, '').toLowerCase();
        const exists = [...collection, ...droppedList].find(item => {
          const itemTitleClean = item.title.replace(/['’]/g, '').toLowerCase();
          const itemAltTitlesClean = item.altTitles?.map(at => at.replace(/['’]/g, '').toLowerCase()) || [];
          return itemTitleClean === cleanSearchTitle || itemAltTitlesClean.includes(cleanSearchTitle);
        });

        if (exists) {
          duplicatesFound++;
          resultsAccumulator.push({ title, options: [exists], duplicate: true });
        } else {
          titlesToSearch.push(title);
        }
      }

      // 2. Execute Lookups in Small Chunks
      if (titlesToSearch.length > 0) {
        const { lookupComicsBatchHybrid } = await import('./services/geminiService');
        for (let i = 0; i < titlesToSearch.length; i += 10) { // Larger chunk size
          const chunk = titlesToSearch.slice(i, i + 10);
          
          try {
            const batchData = await lookupComicsBatchHybrid(chunk);
            
            chunk.forEach(query => {
              const options = batchData[query] || [];
              if (options.length > 0) {
                resultsAccumulator.push({ title: query, options });
              } else {
                // If no results, still add the search result entry with empty options
                // so the user can see the "No Matches Found" UI and use the "Manual Entry" button.
                resultsAccumulator.push({ title: query, options: [] });
                console.log(`[Search] No relevant results found for: ${query}. Entry added for manual fallback.`);
              }
            });
          } catch (err: any) {
            console.error("[Search] Batch chunk failure:", err);
            const errStr = JSON.stringify(err).toLowerCase();
            const isQuotaError = errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted');
            
            chunk.forEach(query => {
              // On error, we still want to inform them but maybe not occupy the UI if they want "no results"
              if (isQuotaError) {
                const fallback: ComicInfo = {
                  title: query,
                  type: 'unknown',
                  status: 'unknown',
                  genres: ['API Limit'],
                  synopsis: 'API quota reached. Please wait a minute.',
                  author: 'System',
                  releaseYear: 'N/A',
                  originalLanguage: 'N/A'
                };
                resultsAccumulator.push({ title: query, options: [fallback], isCustom: true });
              }
            });
            
            if (isQuotaError) {
              setIsAiExhausted(true);
              showToast("API Quota Reached. Slowing down...", "warn");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }

          // Minimal cooling gap to keep it fast
          if (i + 10 < titlesToSearch.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      setResults(resultsAccumulator);
      
      if (duplicatesFound > 0) {
        showToast(`${duplicatesFound} title(s) already exist in your records.`, "info");
      }
      setInputText('');
    } catch (error) {
      console.error("[Search] Critical failure:", error);
      showToast("Sync failure. Node unstable.", "warn");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmSelection = async (resultIndex: number, optionIndex: number, customComic?: ComicInfo) => {
    const result = results[resultIndex];
    const selection = customComic || result.options[optionIndex];
    if (!selection || savingId) return;
    
    // Final duplicate check before saving
    const isDuplicate = [...collection, ...droppedList].some(item => 
      item.title.toLowerCase() === selection.title.toLowerCase() ||
      item.altTitles?.some(at => at.toLowerCase() === selection.title.toLowerCase())
    );

    if (isDuplicate) {
      showToast("Identity conflict: Record already exists.", "warn");
      return;
    }

    const uniqueId = `${resultIndex}-${optionIndex}`;
    console.log(`[Save] Intent: ${selection.title} (ID: ${uniqueId})`);
    setSavingId(uniqueId);
    
    try {
      await saveRecentRead(selection);
      showToast(`Saved: ${selection.title}`, "success");
      await loadAllData();
    } catch (err: any) {
      console.error("[Save] Failure:", err);
      // Attempt to parse FirestoreErrorInfo
      try {
        const errInfo = JSON.parse(err.message);
        showToast(`Save Denied: ${errInfo.error.substring(0, 40)}`, "warn");
      } catch {
        showToast("Save failure. Permission denied.", "warn");
      }
    } finally {
      setSavingId(null);
    }
  };

  const onDropToggle = async (id: string, status: boolean) => {
    await toggleDropStatus(id, status);
    showToast(status ? "Transferred to Waste" : "Restored to Secretary");
    loadAllData();
  };

  const onDelete = async (id: string) => {
    if (!id) {
      showToast("Purge Failed: Missing Identifier", "warn");
      return;
    }
    try {
      await deleteComic(id);
      showToast("Record Purged Eternally", "warn");
      loadAllData();
    } catch (err: any) {
      console.error("Purge failure:", err);
      // Detailed error for user diagnosis
      const msg = err?.message || "Unknown access error";
      showToast(`Purge Error: ${msg.substring(0, 30)}...`, "warn");
    }
  };

  const handleUpdateComic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComic || !editingComic.id) return;

    try {
      const { id, timestamp, userId, ...dataToUpdate } = editingComic as any;
      await updateComic(id, dataToUpdate);
      showToast("Record Modified", "success");
      setEditingComic(null);
      loadAllData();
    } catch (err) {
      console.error(err);
      showToast("Update Failed", "warn");
    }
  };

  const filteredItems = useMemo(() => {
    let items = activeTab === 'secretary' ? [...collection] : [...droppedList];

    // Apply Filters
    if (filterType !== 'all') items = items.filter(i => i.type === filterType);
    if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus);
    if (filterGenre !== 'all') items = items.filter(i => i.genres.includes(filterGenre));

    // Apply Search
    if (searchTerm.trim()) {
      const lowSearch = searchTerm.toLowerCase();
      items = items.filter(i => 
        i.title.toLowerCase().includes(lowSearch) || 
        i.altTitles?.some(at => at.toLowerCase().includes(lowSearch))
      );
    }

    // Apply Sorting
    items.sort((a, b) => {
      if (sortOrder === 'recent') return (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0);
      if (sortOrder === 'oldest') return (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0);
      if (sortOrder === 'az') return a.title.localeCompare(b.title);
      if (sortOrder === 'za') return b.title.localeCompare(a.title);
      return 0;
    });

    return items;
  }, [collection, droppedList, activeTab, filterType, filterStatus, filterGenre, sortOrder, searchTerm]);

  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    collection.concat(droppedList).forEach(i => i.genres.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [collection, droppedList]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(61,10,30,0.4)_0%,rgba(2,6,23,1)_100%)] z-0" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-2xl w-full"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-[#a855f7] to-[#ec4899] rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(236,72,153,0.3)]">
            <LayoutGrid size={48} className="text-white" />
          </div>
          <h1 className="text-7xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] to-[#ec4899]">Secretary.</h1>
          <p className="text-slate-400 mb-12 leading-relaxed text-xl font-medium">
            Your personal manga, manhwa, and manhua architect. Categorize your reads, 
            manage your collection, and track your journey with AI-powered precision.
          </p>
          <button 
            onClick={() => login()}
            className="w-full bg-white text-[#020617] font-black py-5 rounded-3xl hover:bg-slate-100 transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95 group"
          >
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col md:flex-row">
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl ${
              toast.type === 'warn' ? 'bg-[#e5492a]/90 border-[#e5492a] text-white' : 
              toast.type === 'success' ? 'bg-[#ec4899]/90 border-[#ec4899] text-white' : 
              'bg-[#a855f7]/90 border-[#a855f7] text-white'
            }`}
          >
            <Info size={18} />
            <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-24 bg-[#0a1229] border-r border-[#3d0a1e] flex-col items-center py-10 gap-12 z-50">
        <div className="w-12 h-12 bg-gradient-to-br from-[#a855f7] to-[#ec4899] rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
          <BookOpen size={24} className="text-white" />
        </div>
        
        <div className="flex flex-col gap-8">
          <button 
            onClick={() => setActiveTab('explore')}
            className={`p-4 rounded-2xl transition-all relative group ${activeTab === 'explore' ? 'bg-[#3d0a1e] text-[#ec4899] shadow-lg' : 'text-slate-600 hover:text-slate-300'}`}
          >
            <PlusCircle size={24} />
            <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Input</span>
          </button>

          <button 
            onClick={() => setActiveTab('secretary')}
            className={`p-4 rounded-2xl transition-all relative group ${activeTab === 'secretary' ? 'bg-[#3d0a1e] text-[#ec4899] shadow-lg' : 'text-slate-600 hover:text-slate-300'}`}
          >
            <LayoutGrid size={24} />
            <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Secretary</span>
          </button>

          <button 
            onClick={() => setActiveTab('dropped')}
            className={`p-4 rounded-2xl transition-all relative group ${activeTab === 'dropped' ? 'bg-[#3d0a1e] text-[#ec4899] shadow-lg' : 'text-slate-600 hover:text-slate-300'}`}
          >
            <XCircle size={24} />
            <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Dropped</span>
          </button>
        </div>

        <div className="mt-auto flex flex-col items-center gap-8">
          <div className="w-12 h-12 rounded-full border-2 border-[#3d0a1e] overflow-hidden shadow-lg p-0.5 bg-[#3d0a1e]">
            <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full object-cover rounded-full" />
          </div>
          <button onClick={logout} className="text-slate-700 hover:text-[#e5492a] transition-colors p-3">
            <LogOut size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 bg-[#0a1229]/80 backdrop-blur-xl border border-[#3d0a1e] rounded-[2.5rem] flex items-center justify-around px-8 z-50 shadow-2xl">
        <button onClick={() => setActiveTab('explore')} className={`p-4 rounded-2xl ${activeTab === 'explore' ? 'text-[#ec4899] bg-[#3d0a1e]' : 'text-slate-500'}`}>
          <PlusCircle size={24} />
        </button>
        <button onClick={() => setActiveTab('secretary')} className={`p-4 rounded-2xl ${activeTab === 'secretary' ? 'text-[#ec4899] bg-[#3d0a1e]' : 'text-slate-500'}`}>
          <LayoutGrid size={24} />
        </button>
        <button onClick={() => setActiveTab('dropped')} className={`p-4 rounded-2xl ${activeTab === 'dropped' ? 'text-[#ec4899] bg-[#3d0a1e]' : 'text-slate-500'}`}>
          <XCircle size={24} />
        </button>
        <button onClick={logout} className="p-4 text-slate-500">
          <LogOut size={24} />
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen md:pl-24 pb-32 md:pb-0">
        <div className="max-w-7xl mx-auto p-6 sm:p-12 lg:p-16 relative">
          
          {/* Global Notification & Chat Trigger */}
          <div className="absolute top-6 right-6 sm:top-12 sm:right-12 flex items-center gap-4 z-[105]">
            <div className="relative">
              <button 
                onClick={() => setShowChat(true)}
                className="p-3 rounded-2xl border border-[#3d0a1e] bg-[#0a1229]/80 backdrop-blur-md text-slate-500 hover:text-[#ec4899] hover:border-[#ec4899] transition-all"
                title="Intelligence Mesh Chat"
              >
                <MessageCircle size={20} />
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className={`p-3 rounded-2xl border border-[#3d0a1e] bg-[#0a1229]/80 backdrop-blur-md transition-all hover:bg-[#3d0a1e]/40 relative ${showNotifs ? 'border-[#ec4899] text-[#ec4899] shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'text-slate-500'}`}
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-[#ec4899] rounded-full border-2 border-[#0a1229] animate-pulse" />
                )}
              </button>
              
              <AnimatePresence>
                {showNotifs && (
                  <NotificationArea 
                    notifications={notifications}
                    onClose={() => setShowNotifs(false)}
                    onMarkRead={async (id) => {
                      await markAsRead(id);
                      loadNotifications();
                    }}
                    onClear={async (id) => {
                      await deleteNotification(id);
                      loadNotifications();
                    }}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {showChat && <GroupChat onClose={() => setShowChat(false)} />}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {editingComic && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-[#020617]/90 backdrop-blur-md flex items-center justify-center p-6"
              >
                <div className="bg-[#0a1229] border border-[#3d0a1e] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ec4899]/5 to-transparent rounded-full blur-3xl" />
                   
                   <div className="flex justify-between items-center mb-8 relative z-10">
                     <h3 className="text-2xl font-black text-white italic">Edit Entry.</h3>
                     <button onClick={() => setEditingComic(null)} className="text-slate-500 hover:text-white"><XCircle size={24} /></button>
                   </div>

                   <form onSubmit={handleUpdateComic} className="space-y-6 relative z-10">
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#ec4899]/60">Title</label>
                       <input 
                         type="text" 
                         value={editingComic.title}
                         onChange={(e) => setEditingComic({...editingComic, title: e.target.value})}
                         className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ec4899] transition-all"
                       />
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#ec4899]/60">Type</label>
                         <select 
                           value={editingComic.type}
                           onChange={(e) => setEditingComic({...editingComic, type: e.target.value as ComicType})}
                           className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-slate-300 font-bold text-xs uppercase tracking-widest focus:outline-none"
                         >
                           <option value="manga">Manga</option>
                           <option value="manhwa">Manhwa</option>
                           <option value="manhua">Manhua</option>
                           <option value="unknown">Unknown</option>
                         </select>
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#ec4899]/60">Status</label>
                         <select 
                           value={editingComic.status}
                           onChange={(e) => setEditingComic({...editingComic, status: e.target.value as ComicStatus})}
                           className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-slate-300 font-bold text-xs uppercase tracking-widest focus:outline-none"
                         >
                           <option value="ongoing">Ongoing</option>
                           <option value="finished">Finished</option>
                           <option value="hiatus">Hiatus</option>
                           <option value="cancelled">Cancelled</option>
                           <option value="discontinued">Discontinued</option>
                         </select>
                       </div>
                     </div>

                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#ec4899]/60">Synopsis</label>
                       <textarea 
                         rows={4}
                         value={editingComic.synopsis}
                         onChange={(e) => setEditingComic({...editingComic, synopsis: e.target.value})}
                         className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#ec4899] transition-all resize-none"
                       />
                     </div>

                     <button 
                       type="submit"
                       className="w-full bg-[#ec4899] text-white font-black py-4 rounded-2xl hover:bg-[#d946ef] transition-all shadow-xl active:scale-95"
                     >
                       Persist Changes
                     </button>
                   </form>
                </div>
              </motion.div>
            )}

            {activeTab === 'explore' ? (
              <motion.div 
                key="explore"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-12"
              >
                <header>
                  <h2 className="text-xs font-black uppercase tracking-[0.4em] text-[#ec4899]/60 mb-3">Synchronization Hub</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <h1 className="text-4xl sm:text-7xl font-black text-white tracking-tighter">Input Terminal.</h1>
                    
                    {isAiExhausted && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                      >
                        <AlertTriangle className="text-amber-500" size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">AI Search Exhausted (Quota)</span>
                      </motion.div>
                    )}
                    
                    {!isAiExhausted && !isProcessing && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">AI Search Ready</span>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 mt-4 text-base sm:text-lg font-medium max-w-xl">
                    Enter one or more titles. AI will search for matches; you can select the correct comic to store in the secretary.
                  </p>
                </header>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#a855f7] to-[#ec4899] rounded-[2.5rem] blur opacity-10 group-focus-within:opacity-20 transition-opacity" />
                  <form onSubmit={handleBatchLookup} className="relative flex flex-col gap-4 bg-[#0a1229] border border-[#3d0a1e] rounded-[2.5rem] p-4 sm:p-6 shadow-2xl">
                    <textarea 
                       rows={6}
                       placeholder="Enter titles...&#10;One per line..."
                       value={inputText}
                       onChange={(e) => setInputText(e.target.value)}
                       className="w-full bg-transparent p-2 sm:p-4 text-lg sm:text-xl font-medium focus:outline-none resize-none placeholder:text-slate-800 text-white"
                    />
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#3d0a1e] gap-4">
                      <span className="text-[10px] font-black text-[#ec4899]/60 uppercase tracking-[0.3em] sm:pl-4">
                        {isProcessing ? 'Syncing with AI Core...' : 'Batch processing active'}
                      </span>
                      <button 
                        type="submit"
                        disabled={isProcessing || !inputText.trim()}
                        className="w-full sm:w-auto bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white font-black px-12 py-4 rounded-2xl transition-all disabled:opacity-20 flex items-center justify-center gap-3 shadow-xl active:scale-95"
                      >
                        {isProcessing ? <Loader2 size={24} className="animate-spin" /> : 'Execute Sync'}
                      </button>
                    </div>
                  </form>
                </div>

                {results.length > 0 && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-[#3d0a1e] pb-6">
                      <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3 italic">
                        Potential Matches.
                      </h3>
                      <button onClick={() => setResults([])} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Clean Hub</button>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {results.map((res, resIdx) => (
                        <div key={resIdx} className="bg-[#0f172a] border border-slate-800/80 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#ec4899]/5 to-transparent rounded-full blur-2xl" />
                          
                          <div className="flex items-start gap-4 relative z-10 border-b border-slate-800/50 pb-4 mb-4">
                            <span className="text-[10px] font-black text-[#ec4899]/60 uppercase tracking-[0.3em] whitespace-nowrap mt-0.5">Query</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight leading-tight">{res.title}</span>
                          </div>

                          <div className="space-y-4 relative z-10">
                            {res.options.length > 0 ? (
                              res.options.map((opt, optIdx) => {
                                const isSaved = [...collection, ...droppedList].some(item => 
                                  item.title.toLowerCase().trim() === opt.title.toLowerCase().trim() ||
                                  item.altTitles?.some(at => at.toLowerCase().trim() === opt.title.toLowerCase().trim())
                                );
                                
                                return (
                                  <button 
                                    key={optIdx}
                                    disabled={isSaved || savingId === `${resIdx}-${optIdx}`}
                                    onClick={() => !isSaved && confirmSelection(resIdx, optIdx)}
                                    className={`w-full text-left p-5 border rounded-2xl transition-all relative overflow-hidden group/opt ${
                                      isSaved 
                                        ? 'bg-emerald-500/5 border-emerald-500/20 cursor-default' 
                                        : savingId === `${resIdx}-${optIdx}`
                                          ? 'bg-[#ec4899]/5 border-[#ec4899]/30 border-animate'
                                          : 'bg-slate-900/40 border-slate-800 hover:border-[#ec4899]/40 hover:bg-slate-800/40'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className={`font-bold truncate pr-4 ${isSaved ? 'text-emerald-400' : 'text-slate-200 group-hover/opt:text-white'}`}>{opt.title}</h4>
                                      {isSaved ? (
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400">
                                          <span>Shelved</span>
                                        </div>
                                      ) : savingId === `${resIdx}-${optIdx}` ? (
                                        <Loader2 size={18} className="text-[#ec4899] animate-spin" />
                                      ) : (
                                        <Plus size={18} className="text-[#ec4899] opacity-40 group-hover/opt:opacity-100 transition-all transform translate-x-1 group-hover/opt:translate-x-0" />
                                      )}
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                      <span className={`text-[9px] font-black uppercase py-0.5 px-2 rounded-md border ${isSaved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{opt.type}</span>
                                      <span className="text-[9px] font-black uppercase py-0.5 px-2 bg-slate-800 text-slate-400 rounded-md border border-slate-700">{opt.status}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{opt.synopsis}</p>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="py-8 text-center bg-slate-900/20 border border-slate-800 border-dashed rounded-2xl">
                                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">No Matches Found</p>
                              </div>
                            )}
                            
                            <button 
                              disabled={savingId === `${resIdx}--1`}
                              onClick={() => {
                                const fallback: ComicInfo = {
                                  title: res.title,
                                  type: 'unknown',
                                  status: 'unknown',
                                  genres: ['Manual'],
                                  synopsis: 'Self-documented entry.',
                                  author: 'Unknown',
                                  releaseYear: 'Unknown',
                                  originalLanguage: 'Unknown'
                                };
                                confirmSelection(resIdx, -1, fallback);
                              }}
                              className="w-full h-12 flex items-center justify-center border border-dashed border-slate-800 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-[#ec4899] hover:border-[#ec4899]/50 hover:bg-[#ec4899]/5 rounded-2xl transition-all disabled:opacity-50"
                            >
                              {savingId === `${resIdx}--1` ? <Loader2 size={16} className="animate-spin" /> : 'Manual Entry'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-[0.4em] text-[#ec4899]/60 mb-3">Archive Control</h2>
                    <h1 className="text-4xl sm:text-7xl font-black text-white tracking-tighter italic">
                      {activeTab === 'secretary' ? 'Secretary.' : 'The Waste.'}
                    </h1>
                    <div className="flex items-center gap-3 mt-6 text-slate-500 bg-[#0a1229] w-fit px-5 py-2.5 rounded-2xl border border-[#3d0a1e] shadow-lg">
                      <Library size={16} className="text-[#ec4899]" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{filteredItems.length} Comics Shelved</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full xl:w-auto">
                    {/* Search Field */}
                    <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                      <input 
                        type="text"
                        placeholder="SEARCH ARCHIVE..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a1229] border border-[#3d0a1e] rounded-2xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] text-white focus:outline-none focus:border-[#ec4899]/50 transition-colors placeholder:text-slate-700 shadow-xl"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>

                    {/* Sort */}
                    <div className="flex bg-[#0a1229] p-1 rounded-2xl border border-[#3d0a1e] shadow-xl overflow-hidden">
                      <button 
                        onClick={() => setSortOrder('recent')}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sortOrder === 'recent' ? 'bg-[#3d0a1e] text-[#ec4899]' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        Recent
                      </button>
                      <button 
                        onClick={() => setSortOrder('oldest')}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sortOrder === 'oldest' ? 'bg-[#3d0a1e] text-[#ec4899]' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        Oldest
                      </button>
                      <div className="w-[1px] bg-[#3d0a1e] mx-1 sm:mx-2 self-stretch" />
                      <button 
                        onClick={() => setSortOrder(sortOrder === 'az' ? 'za' : 'az')}
                        className="p-2 sm:p-3 text-slate-400 hover:text-white transition-colors"
                        title={sortOrder === 'az' ? "A-Z" : "Z-A"}
                      >
                        {sortOrder === 'az' ? <ArrowUpAz size={18} /> : <ArrowDownAz size={18} />}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <select 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="bg-[#0a1229] text-slate-400 font-black text-[10px] uppercase tracking-widest px-4 sm:px-6 py-3.5 rounded-2xl border border-[#3d0a1e] focus:outline-none focus:border-[#ec4899] transition-all shadow-xl"
                      >
                        <option value="all">Types</option>
                        <option value="manga">Manga</option>
                        <option value="manhwa">Manhwa</option>
                        <option value="manhua">Manhua</option>
                        <option value="unknown">Unknown</option>
                      </select>

                      <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="bg-[#0a1229] text-slate-400 font-black text-[10px] uppercase tracking-widest px-4 sm:px-6 py-3.5 rounded-2xl border border-[#3d0a1e] focus:outline-none focus:border-[#ec4899] transition-all shadow-xl"
                      >
                        <option value="all">Status</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="finished">Finished</option>
                        <option value="hiatus">Hiatus</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="discontinued">Discontinued</option>
                      </select>

                      <select 
                        value={filterGenre}
                        onChange={(e) => setFilterGenre(e.target.value)}
                        className="bg-[#0a1229] text-slate-400 font-black text-[10px] uppercase tracking-widest px-4 sm:px-6 py-3.5 rounded-2xl border border-[#3d0a1e] focus:outline-none focus:border-[#ec4899] transition-all shadow-xl max-w-[150px]"
                      >
                        <option value="all">Genres</option>
                        {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pb-32">
                      <AnimatePresence initial={false} mode="popLayout">
                        {filteredItems.map((comic) => (
                          <ComicCard 
                            key={comic.id} 
                            comic={comic} 
                            isDroppedView={activeTab === 'dropped'}
                            onDropToggle={onDropToggle}
                            onDelete={onDelete}
                            onEdit={(c) => setEditingComic(c)}
                          />
                        ))}
                      </AnimatePresence>
                </div>

                {filteredItems.length === 0 && (
                  <div className="py-40 text-center flex flex-col items-center gap-6">
                    <div className="w-24 h-24 bg-[#0a1229] border border-[#3d0a1e] rounded-[2.5rem] flex items-center justify-center text-slate-800">
                      <LayoutGrid size={40} />
                    </div>
                    <div className="space-y-4">
                       <p className="text-2xl font-black text-slate-600 uppercase tracking-tighter">Void Detected.</p>
                       <p className="text-[10px] font-black text-[#ec4899]/40 uppercase tracking-[0.5em]">Adjust filters or synchronize new data nodes.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
