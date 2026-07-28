'use client';

import React from 'react';
import Header from '@/components/Header';
import { ArrowRight, TrendingUp, Mail, CheckCircle, AlertCircle, Clock, Activity, Zap } from 'lucide-react';

export default function EmailCenterPage() {
    const stats = [
        {
            title: 'Total Emails Sent',
            value: '125,430',
            change: '+12.5%',
            icon: Mail,
            color: 'from-cyan-500 to-blue-500'
        },
        {
            title: 'Delivery Rate',
            value: '98.5%',
            change: '+2.1%',
            icon: CheckCircle,
            color: 'from-emerald-500 to-teal-500'
        },
        {
            title: 'Open Rate',
            value: '42.3%',
            change: '+5.2%',
            icon: Activity,
            color: 'from-purple-500 to-pink-500'
        },
        {
            title: 'Click Rate',
            value: '18.7%',
            change: '+3.8%',
            icon: TrendingUp,
            color: 'from-amber-500 to-orange-500'
        }
    ];

    const recentActivity = [
        { id: 1, action: 'Welcome Email', status: 'Sent', count: '2,450', time: '5 minutes ago' },
        { id: 2, action: 'Password Reset', status: 'Queued', count: '145', time: '2 minutes ago' },
        { id: 3, action: 'Newsletter', status: 'Failed', count: '12', time: '15 minutes ago' },
        { id: 4, action: 'OTP Verification', status: 'Sent', count: '3,200', time: '1 hour ago' }
    ];

    const providers = [
        { name: 'SMTP (Primary)', status: 'Connected', color: 'emerald' },
        { name: 'Resend', status: 'Connected', color: 'emerald' },
        { name: 'SendGrid', status: 'Configured', color: 'blue' },
        { name: 'AWS SES', status: 'Disconnected', color: 'red' }
    ];

    return (
        <>
            <Header
                title="Email Center"
                subtitle="Manage email templates, providers, and communications"
            />

            <main className="p-6 lg:p-8 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, idx) => {
                        const Icon = stat.icon;
                        return (
                            <div key={idx} className="card">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                                        <h3 className="text-3xl font-bold text-white mt-2">{stat.value}</h3>
                                        <p className="text-xs text-emerald-400 mt-2">{stat.change} this month</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900">
                                        <Icon size={24} className={`bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Activity */}
                    <div className="lg:col-span-2">
                        <div className="card">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="section-title">Recent Activity</h2>
                                <a href="/email-center/logs" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium flex items-center gap-2">
                                    View All <ArrowRight size={16} />
                                </a>
                            </div>

                            <div className="space-y-3">
                                {recentActivity.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-cyan-500/30 transition-all">
                                        <div className="flex-1">
                                            <p className="font-medium text-white">{item.action}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.count} emails • {item.time}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === 'Sent' ? 'badge-success' :
                                                item.status === 'Queued' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                                    'bg-red-500/20 text-red-300 border border-red-500/30'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Provider Status */}
                    <div>
                        <div className="card">
                            <h2 className="section-title mb-6">Provider Status</h2>

                            <div className="space-y-3">
                                {providers.map((provider, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${provider.color === 'emerald' ? 'bg-emerald-500 animate-pulse' :
                                                    provider.color === 'blue' ? 'bg-blue-500' :
                                                        'bg-red-500'
                                                }`} />
                                            <span className="text-sm font-medium text-white">{provider.name}</span>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${provider.color === 'emerald' ? 'text-emerald-300' :
                                                provider.color === 'blue' ? 'text-blue-300' :
                                                    'text-red-300'
                                            }`}>
                                            {provider.status}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button className="mt-6 w-full btn-primary text-sm flex items-center justify-center gap-2">
                                <Zap size={16} />
                                Configure Providers
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Links */}
                <div>
                    <h2 className="section-title mb-6">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { title: 'Create Template', icon: Mail },
                            { title: 'Send Test Email', icon: TestTube },
                            { title: 'View Queue', icon: Clock },
                            { title: 'Check Analytics', icon: BarChart3 },
                            { title: 'Setup Automation', icon: Zap }
                        ].map((action, idx) => (
                            <div key={idx} className="card text-center hover:scale-105 transition-transform cursor-pointer">
                                <action.icon size={32} className="text-cyan-400 mx-auto mb-3" />
                                <p className="font-medium text-white">{action.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </>
    );
}

import { TestTube, BarChart3 } from 'lucide-react';
