'use client';

import React from 'react';
import { Search, Bell, Settings, User } from 'lucide-react';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    return (
        <header className="sticky top-0 z-20 border-b border-slate-700/50 bg-gradient-to-b from-slate-900/95 to-slate-900/80 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4 lg:pl-72">
                <div>
                    <h1 className="text-2xl font-bold text-white">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                        <Search size={18} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="bg-transparent text-white placeholder-slate-500 outline-none w-48"
                        />
                    </div>

                    {/* Icons */}
                    <button className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                    </button>

                    <button className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all">
                        <Settings size={20} />
                    </button>

                    {/* Profile */}
                    <button className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                            <User size={18} className="text-white" />
                        </div>
                    </button>
                </div>
            </div>
        </header>
    );
}
