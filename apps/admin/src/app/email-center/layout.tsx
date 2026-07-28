'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Mail,
    Settings,
    Database,
    Zap,
    Layers,
    BarChart3,
    Send,
    Palette,
    Variable,
    Automation,
    TestTube,
    ChevronRight
} from 'lucide-react';

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    href: string;
    badge?: string;
    description: string;
}

export default function EmailCenterLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const navItems: NavItem[] = [
        {
            id: 'overview',
            label: 'Overview',
            icon: <Mail size={20} />,
            href: '/email-center',
            description: 'Email Center dashboard'
        },
        {
            id: 'templates',
            label: 'Templates',
            icon: <Layers size={20} />,
            href: '/email-center/templates',
            badge: '24',
            description: 'Manage email templates'
        },
        {
            id: 'providers',
            label: 'Providers',
            icon: <Settings size={20} />,
            href: '/email-center/providers',
            badge: '5',
            description: 'Configure email providers'
        },
        {
            id: 'queue',
            label: 'Email Queue',
            icon: <Database size={20} />,
            href: '/email-center/queue',
            badge: '3',
            description: 'Manage email queue'
        },
        {
            id: 'logs',
            label: 'Email Logs',
            icon: <Send size={20} />,
            href: '/email-center/logs',
            description: 'View email history'
        },
        {
            id: 'analytics',
            label: 'Analytics',
            icon: <BarChart3 size={20} />,
            href: '/email-center/analytics',
            description: 'Email performance metrics'
        },
        {
            id: 'test',
            label: 'Test Email',
            icon: <TestTube size={20} />,
            href: '/email-center/test',
            description: 'Send test emails'
        },
        {
            id: 'branding',
            label: 'Branding',
            icon: <Palette size={20} />,
            href: '/email-center/branding',
            description: 'Global branding settings'
        },
        {
            id: 'variables',
            label: 'Variables',
            icon: <Variable size={20} />,
            href: '/email-center/variables',
            description: 'Manage merge tags'
        },
        {
            id: 'automation',
            label: 'Automation',
            icon: <Automation size={20} />,
            href: '/email-center/automation',
            description: 'Email workflows'
        }
    ];

    const isActive = (href: string) => {
        if (href === '/email-center') {
            return pathname === '/email-center';
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="flex gap-0">
            {/* Email Center Sidebar */}
            <aside className={`fixed left-64 top-0 h-screen border-r border-slate-700/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 transition-all duration-300 overflow-y-auto ${collapsed ? 'w-20' : 'w-64'}`}>
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
                                <Mail size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Email Center</h3>
                                <p className="text-xs text-slate-400">Manage communications</p>
                            </div>
                        </div>
                    )}
                </div>

                <nav className="p-3 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${isActive(item.href)
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border-l-4 border-cyan-500'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                }`}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {!collapsed && (
                                <>
                                    <span className="flex-1 font-medium text-sm">{item.label}</span>
                                    {item.badge && (
                                        <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium">
                                            {item.badge}
                                        </span>
                                    )}
                                </>
                            )}
                            {collapsed && item.badge && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Quick Stats */}
                {!collapsed && (
                    <div className="p-4 border-t border-slate-700/50 space-y-3">
                        <div className="px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                            <p className="text-xs text-slate-400">Emails Sent Today</p>
                            <p className="text-lg font-bold text-cyan-400 mt-1">2,450</p>
                        </div>
                        <div className="px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                            <p className="text-xs text-slate-400">Delivery Rate</p>
                            <p className="text-lg font-bold text-emerald-400 mt-1">98.5%</p>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="ml-64 w-full lg:ml-80">
                {children}
            </main>
        </div>
    );
}
