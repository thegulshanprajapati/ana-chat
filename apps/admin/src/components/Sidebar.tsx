'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    LayoutDashboard,
    Users,
    Mail,
    Megaphone,
    Settings,
    Shield,
    LogOut,
    Menu,
    X,
    ChevronDown
} from 'lucide-react';

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(true);
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/' },
        { id: 'users', icon: Users, label: 'Users', href: '/users' },
        { id: 'email-center', icon: Mail, label: 'Email Center', href: '/email-center' },
        {
            id: 'communication',
            icon: Mail,
            label: 'Communication',
            submenu: [
                { label: 'Email Templates', href: '/email-templates' },
                { label: 'Notifications', href: '#' },
                { label: 'Broadcast', href: '#' }
            ]
        },
        { id: 'broadcast', icon: Megaphone, label: 'Broadcast', href: '#' },
        {
            id: 'admin',
            icon: Shield,
            label: 'Admin',
            submenu: [
                { label: 'Admins', href: '#' },
                { label: 'Roles', href: '#' }
            ]
        },
        { id: 'settings', icon: Settings, label: 'Settings', href: '/settings' }

    return (
        <>
            {/* Mobile Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 transition-all"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-700/50 transition-all duration-300 z-40 overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    }`}
            >
                {/* Logo Section */}
                <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                            <Shield size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">AnaChat</h1>
                            <p className="text-xs text-slate-400">Admin Panel</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 px-4 py-6">
                    <div className="space-y-2">
                        {menuItems.map((item) => (
                            <div key={item.id}>
                                {item.submenu ? (
                                    <button
                                        onClick={() => setExpandedMenu(expandedMenu === item.id ? null : item.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white transition-all duration-200 hover:bg-slate-800/50"
                                    >
                                        <item.icon size={20} />
                                        <span className="flex-1 text-left font-medium">{item.label}</span>
                                        <ChevronDown
                                            size={18}
                                            className={`transition-transform ${expandedMenu === item.id ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white transition-all duration-200 hover:bg-slate-800/50 group"
                                    >
                                        <item.icon size={20} className="group-hover:text-cyan-400 transition-colors" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                )}

                                {/* Submenu */}
                                {item.submenu && expandedMenu === item.id && (
                                    <div className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-4">
                                        {item.submenu.map((subitem, idx) => (
                                            <Link
                                                key={idx}
                                                href={subitem.href}
                                                className="block px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-cyan-300 transition-all duration-200 hover:bg-slate-800/30"
                                            >
                                                {subitem.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700/50 space-y-2">
                    <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <p className="text-xs text-slate-400">Logged in as</p>
                        <p className="text-sm font-medium text-white mt-1">Super Admin</p>
                        <p className="text-xs text-slate-500">admin@ana.chat</p>
                    </div>
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all duration-200 hover:text-red-300">
                        <LogOut size={20} />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
