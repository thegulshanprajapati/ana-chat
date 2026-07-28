'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Line, ArrowUpRight } from 'lucide-react';

export default function AnalyticsPage() {
    const [timeRange, setTimeRange] = useState('7days');

    const metrics = [
        { label: 'Total Sent', value: '125,430', change: '+12.5%', trend: 'up', icon: TrendingUp },
        { label: 'Delivered', value: '123,654', change: '+11.2%', trend: 'up', icon: TrendingUp },
        { label: 'Delivery Rate', value: '98.5%', change: '+2.1%', trend: 'up', icon: TrendingUp },
        { label: 'Bounce Rate', value: '1.2%', change: '-0.5%', trend: 'down', icon: TrendingDown },
        { label: 'Opened', value: '52,340', change: '+8.3%', trend: 'up', icon: TrendingUp },
        { label: 'Open Rate', value: '42.3%', change: '+5.2%', trend: 'up', icon: TrendingUp },
        { label: 'Clicked', value: '23,145', change: '+3.8%', trend: 'up', icon: TrendingUp },
        { label: 'Click Rate', value: '18.7%', change: '+2.1%', trend: 'up', icon: TrendingUp }
    ];

    const templatePerformance = [
        { name: 'Welcome Email', sent: 5240, delivered: 5158, opened: 2481, clicked: 826, openRate: 48.1, ctR: 16.0 },
        { name: 'Email Verification', sent: 3540, delivered: 3485, opened: 1394, clicked: 209, openRate: 40.0, ctR: 6.0 },
        { name: 'Newsletter', sent: 8530, delivered: 8398, opened: 3211, clicked: 824, openRate: 38.3, ctR: 9.8 },
        { name: 'Password Reset', sent: 2150, delivered: 2147, opened: 1721, clicked: 516, openRate: 80.2, ctR: 24.0 },
        { name: 'Promotional', sent: 4200, delivered: 4018, opened: 1450, clicked: 580, openRate: 36.1, ctR: 14.4 },
        { name: 'Invoice', sent: 1770, delivered: 1765, opened: 850, clicked: 190, openRate: 48.1, ctR: 10.8 }
    ];

    const providerPerformance = [
        { name: 'Gmail SMTP', sent: 45000, delivered: 44550, openRate: 42.5 },
        { name: 'Resend', sent: 35000, delivered: 34650, openRate: 41.2 },
        { name: 'SendGrid', sent: 30000, delivered: 29454, openRate: 43.1 },
        { name: 'AWS SES', sent: 15430, delivered: 15000, openRate: 40.8 }
    ];

    return (
        <>
            <Header
                title="Email Analytics"
                subtitle="Comprehensive email performance metrics and insights"
            />

            <main className="p-6 lg:p-8 space-y-8">
                {/* Time Range Selector */}
                <div className="flex gap-2">
                    {['24h', '7days', '30days', '90days', 'all'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${timeRange === range
                                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                                }`}
                        >
                            {range === '24h' ? '24 Hours' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : range === '90days' ? '90 Days' : 'All Time'}
                        </button>
                    ))}
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {metrics.map((metric, idx) => {
                        const Icon = metric.icon;
                        return (
                            <div key={idx} className="card">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-slate-400 text-sm font-medium">{metric.label}</p>
                                        <h3 className="text-2xl font-bold text-white mt-2">{metric.value}</h3>
                                        <p className={`text-xs mt-2 flex items-center gap-1 ${metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                            <Icon size={14} />
                                            {metric.change}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Charts Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Daily Emails Chart */}
                    <div className="card">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Line size={20} />
                            Daily Email Sent
                        </h3>
                        <div className="h-64 bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-lg border border-slate-700/30 flex items-center justify-center">
                            <p className="text-slate-400">📊 Chart visualization (integrate Chart.js or Recharts)</p>
                        </div>
                    </div>

                    {/* Email Status Distribution */}
                    <div className="card">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <PieChart size={20} />
                            Email Status Distribution
                        </h3>
                        <div className="h-64 bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-lg border border-slate-700/30 flex items-center justify-center">
                            <p className="text-slate-400">📊 Pie chart (integrate Chart.js or Recharts)</p>
                        </div>
                    </div>
                </div>

                {/* Template Performance */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-6">Template Performance</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Template</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Sent</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Delivered</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Opened</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Clicked</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">Open Rate</th>
                                    <th className="px-6 py-4 text-left font-semibold text-slate-300">CTR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templatePerformance.map((template, idx) => (
                                    <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{template.name}</td>
                                        <td className="px-6 py-4 text-slate-400">{template.sent.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-slate-400">{template.delivered.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-slate-400">{template.opened.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-slate-400">{template.clicked.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-cyan-400 font-medium">{template.openRate}%</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-purple-400 font-medium">{template.ctR}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Provider Performance */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-6">Provider Performance</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {providerPerformance.map((provider, idx) => (
                            <div key={idx} className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <h4 className="font-medium text-white mb-3">{provider.name}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Sent:</span>
                                        <span className="text-white font-medium">{provider.sent.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Delivered:</span>
                                        <span className="text-emerald-400 font-medium">{provider.delivered.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Open Rate:</span>
                                        <span className="text-cyan-400 font-medium">{provider.openRate}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </>
    );
}
