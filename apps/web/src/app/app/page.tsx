'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  Shield, 
  CheckCheck, 
  ArrowLeft,
  Circle,
  MoreVertical,
  Phone,
  Video,
  Info,
  Lock
} from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  lastMessage: string;
  time: string;
  unread: number;
}

interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  status: 'sent' | 'delivered' | 'read';
}

export default function WebClientPage() {
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'settings'>('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messageText, setMessageText] = useState('');
  
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '1',
      name: 'Aditya Sharma',
      avatar: 'AS',
      status: 'online',
      lastMessage: 'Sure, let\'s meet at 5 PM today.',
      time: '12:30 PM',
      unread: 2
    },
    {
      id: '2',
      name: 'Priya Patel',
      avatar: 'PP',
      status: 'online',
      lastMessage: 'Did you review the database design?',
      time: '10:45 AM',
      unread: 0
    },
    {
      id: '3',
      name: 'Rohit Verma',
      avatar: 'RV',
      status: 'offline',
      lastMessage: 'The build is successful on desktop client.',
      time: 'Yesterday',
      unread: 0
    },
    {
      id: '4',
      name: 'AnaChat Team',
      avatar: 'AT',
      status: 'online',
      lastMessage: 'Security patch v4.0 has been deployed.',
      time: '2 days ago',
      unread: 0
    }
  ]);

  const [messages, setMessages] = useState<Record<string, Message[]>>({
    '1': [
      { id: '101', sender: 'them', text: 'Hey, are we still on for the review?', time: '12:20 PM', status: 'read' },
      { id: '102', sender: 'me', text: 'Yes! Absolutely. I have prepared the UI demo.', time: '12:25 PM', status: 'read' },
      { id: '103', sender: 'them', text: 'Sure, let\'s meet at 5 PM today.', time: '12:30 PM', status: 'read' }
    ],
    '2': [
      { id: '201', sender: 'them', text: 'Hi! Can you share the schema file?', time: '10:40 AM', status: 'read' },
      { id: '202', sender: 'them', text: 'Did you review the database design?', time: '10:45 AM', status: 'read' }
    ]
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    setMessages(prev => ({
      ...prev,
      [selectedChat.id]: [...(prev[selectedChat.id] || []), newMsg]
    }));

    // Update last message in chat list
    setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, lastMessage: messageText, time: 'Just now' } : c));
    setMessageText('');

    // Simulate auto reply
    setTimeout(() => {
      const replyMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'them',
        text: 'This is an end-to-end encrypted simulated response! 🔒',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };
      setMessages(prev => ({
        ...prev,
        [selectedChat.id]: [...(prev[selectedChat.id] || []), replyMsg]
      }));
      setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, lastMessage: replyMsg.text, time: 'Just now' } : c));
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* 1. Global Navigation Sidebar */}
      <div className="w-16 md:w-20 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 justify-between flex-shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo */}
          <Link href="/">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 cursor-pointer">
              <span className="font-bold text-white text-lg">A</span>
            </div>
          </Link>

          {/* Navigation Items */}
          <div className="flex flex-col gap-4 w-full px-2">
            <button 
              onClick={() => setActiveTab('chats')} 
              className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${activeTab === 'chats' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Chats"
            >
              <MessageSquare size={22} />
            </button>
            <button 
              onClick={() => setActiveTab('contacts')} 
              className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${activeTab === 'contacts' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Contacts"
            >
              <Users size={22} />
            </button>
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${activeTab === 'settings' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Settings"
            >
              <Settings size={22} />
            </button>
          </div>
        </div>

        {/* Security Shield Indicator */}
        <div className="flex flex-col items-center gap-4 text-emerald-400" title="End-to-End Encrypted">
          <Shield size={20} className="animate-pulse" />
        </div>
      </div>

      {/* 2. List Sidebar (Chats or Contacts) */}
      <div className={`w-80 bg-slate-900/50 border-r border-white/5 flex flex-col flex-shrink-0 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white capitalize">{activeTab}</h2>
          <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-400 font-mono">v4.0</span>
        </div>

        {activeTab === 'chats' && (
          <>
            {/* Search Bar */}
            <div className="p-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search chats..." 
                  className="w-full bg-slate-950 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto space-y-1 p-2">
              {chats.map(chat => (
                <div 
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedChat?.id === chat.id ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-semibold text-sm">
                      {chat.avatar}
                    </div>
                    {chat.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-semibold text-sm text-slate-200 truncate">{chat.name}</h4>
                      <span className="text-xs text-slate-500 font-mono">{chat.time}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{chat.lastMessage}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'contacts' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Contacts (Sync via Local-first)</p>
            {chats.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-slate-800/40 rounded-lg cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">{c.avatar}</div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200">{c.name}</h4>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Circle size={8} fill="currentColor" /> {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
              <h3 className="font-semibold text-white">Local Storage Settings</h3>
              <p className="text-xs text-slate-400">Database status: Connected (OPFS SQLite)</p>
              <button className="w-full bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 py-2 rounded-lg font-medium transition-all text-xs">
                Export Local DB (Encrypted)
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-3">
              <h3 className="font-semibold text-white">Sync Status</h3>
              <p className="text-xs text-slate-400">Last Synced: Just now</p>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Shield size={14} /> End-to-end Encrypted
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Conversation Window */}
      <div className={`flex-1 flex flex-col bg-slate-950 relative ${!selectedChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        
        {selectedChat ? (
          <>
            {/* Chat Room Header */}
            <div className="h-16 border-b border-white/5 px-4 md:px-6 flex items-center justify-between bg-slate-900/20 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-1 text-slate-400 hover:text-white cursor-pointer mr-1">
                  <ArrowLeft size={20} />
                </button>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm">{selectedChat.avatar}</div>
                  {selectedChat.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm md:text-base text-slate-200 truncate">{selectedChat.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">E2E Session ID: e2e-{selectedChat.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-4 text-slate-400">
                <button className="p-2 hover:bg-white/5 rounded-lg hover:text-white cursor-pointer"><Phone size={18} /></button>
                <button className="p-2 hover:bg-white/5 rounded-lg hover:text-white cursor-pointer"><Video size={18} /></button>
                <button className="p-2 hover:bg-white/5 rounded-lg hover:text-white cursor-pointer"><Info size={18} /></button>
              </div>
            </div>

            {/* Chat Security banner */}
            <div className="bg-slate-900/40 py-2 px-4 border-b border-white/5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Lock size={12} className="text-sky-400" />
              <span>Messages are end-to-end encrypted. No third party can read them.</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {(messages[selectedChat.id] || []).map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-md relative ${msg.sender === 'me' ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 border border-white/5 text-slate-100 rounded-tl-none'}`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <div className="flex justify-end items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-white/60 font-mono">{msg.time}</span>
                      {msg.sender === 'me' && (
                        <CheckCheck size={12} className={msg.status === 'read' ? 'text-sky-200' : 'text-white/40'} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Message Input */}
            <div className="p-4 border-t border-white/5 bg-slate-900/10 backdrop-blur-md">
              <div className="flex items-center gap-2 max-w-5xl mx-auto bg-slate-900 border border-white/5 rounded-2xl px-4 py-2">
                <button className="p-2 text-slate-400 hover:text-slate-200 cursor-pointer"><Paperclip size={20} /></button>
                <input 
                  type="text" 
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a secure message..." 
                  className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm text-slate-200 placeholder-slate-500 py-2"
                />
                <button className="p-2 text-slate-400 hover:text-slate-200 cursor-pointer"><Smile size={20} /></button>
                <button 
                  onClick={handleSendMessage}
                  className="p-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-white/5 flex items-center justify-center text-sky-400 mx-auto mb-6 shadow-xl">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Your Secure Workspace</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Select a contact to begin an end-to-end encrypted conversation. All messages are persisted locally.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
