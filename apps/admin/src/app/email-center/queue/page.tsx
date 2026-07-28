'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Search, Filter, Repeat, Pause, Trash2, Eye, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface QueueItem {
    id: string;
    recipient: string;
    template: string;
    subject: string;
    status: 'queued' | 'sending' | 'sent' | 'failed' | 'retrying' | 'cancelled';
    priority: 'low' | 'normal' | 'high';
    attempts: number;
    maxAttempts: number;
    createdAt: string;
    scheduledFor?: string;
    error?: string;
}

export default function EmailQueuePage() {
    const [queueItems] = useState<QueueItem[]>([
        {
            id: '1',
            recipient: 'john.doe@example.com',
            template: 'Welcome Email',
            subject: 'Welcome to AnaChat!',
            status: 'sending',
            priority: 'high',
            attempts: 1,
            maxAttempts: 3,
            createdAt: '2 minutes ago'
        },
        {
            id: '2',
            recipient: 'jane.smith@example.com',
            template: 'Email Verification',
            subject: 'Verify Your Email',
            status: 'queued',
            priority: 'normal',
            attempts: 0,
            maxAttempts: 3,
            createdAt: '5 minutes ago',
            scheduledFor: '2:30 PM'
        },
        {
            id: '3',
            recipient: 'mike@example.com',
            template: 'Password Reset',
            subject: 'Reset Your Password',
            status: 'failed',
            priority: 'high',
            attempts: 3,
            maxAttempts: 3,
            createdAt: '15 minutes ago',
            error: 'Connection timeout'
        },
        {
            id: '4',
            recipient: 'sarah@example.com',
            template: 'Newsletter',
            subject: 'Weekly Newsletter',
            status: 'sent',
            priority: 'low',
            attempts: 1,
            maxAttempts: 1,
            createdAt: '30 minutes ago'
        },
        {
            id: '5',
            recipient: 'tom.brown@example.com',
            template: 'OTP Verification',
            subject: 'Your OTP: 123456',
            status: 'retrying',
            priority: 'high',
            attempts: 2,
            maxAttempts: 3,
            createdAt: '20 minutes ago',
            error: 'Network error - Retrying...'
        }
    ]);

    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    const statusCounts = {
        all: queueItems.length,
        queued: queueItems.filter(q => q.status === 'queued').length,
        sending: queueItems.filter(q => q.status === 'sending').length,
        sent: queueItems.filter(q => q.status === 'sent').length,
        failed: queueItems.filter(q => q.status === 'failed').length,
        retrying: queueItems.filter(q => q.status === 'retrying').length,
        cancelled: queueItems.filter(q => q.status === 'cancelled').length
    };

    const filteredItems = selectedStatus === 'all'
        ? queueItems
        : queueItems.filter(q => q.status === selectedStatus);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'queued': return <Clock size={18} />;
            case 'sending': return <Zap size={18} />;
            case 'sent': return <CheckCircle size={18} />;
            case 'failed': return <AlertCircle size={18} />;
            case 'retrying': return <Repeat size={18} />;
            default: return <Clock size={18} />;
        }
    };

    return (
        <>
            <Header
                title="Email Queue"
                subtitle="Monitor and manage queued emails"
            />

            <main className="p-6 lg:p-8 space-y-6">
                {/* Status Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${selectedStatus === status
                                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                        </button>
                    ))}
                </div>

                {/* Search & Filter */}
                <div className="card p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by recipient or template..."
                                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                            />
                        </div>
                        <select className="input-field w-full lg:w-40">
                            <option>All Priorities</option>
                            <option>High</option>
                            <option>Normal</option>
                            <option>Low</option>
                        </select>
                    </div>
                </div>

                {/* Queue Items */}
                <div className="space-y-3">
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <div key={item.id} className="card">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400">
                                            {getStatusIcon(item.status)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="font-medium text-white truncate">{item.recipient}</p>
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${item.status === 'queued' ? 'bg-blue-500/20 text-blue-300' :
                                                        item.status === 'sending' ? 'bg-purple-500/20 text-purple-300' :
                                                            item.status === 'sent' ? 'badge-success' :
                                                                item.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                                                    'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded ${item.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                        item.priority === 'normal' ? 'bg-slate-700/50 text-slate-300' :
                                                            'bg-blue-500/20 text-blue-300'
                                                    }`}>
                                                    {item.priority}
                                                </span>
                                            </div>

                                            <p className="text-sm text-slate-400 mb-2">{item.template}: {item.subject}</p>

                                            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                <span>Attempts: {item.attempts}/{item.maxAttempts}</span>
                                                <span>Created: {item.createdAt}</span>
                                                {item.scheduledFor && <span>Scheduled: {item.scheduledFor}</span>}
                                                {item.error && <span className="text-red-400">Error: {item.error}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0">
                                        {item.status === 'failed' && (
                                            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Retry">
                                                <Repeat size={18} />
                                            </button>
                                        )}
                                        {item.status === 'queued' && (
                                            <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-yellow-400 transition-all" title="Pause">
                                                <Pause size={18} />
                                            </button>
                                        )}
                                        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="View Details">
                                            <Eye size={18} />
                                        </button>
                                        <button className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Cancel">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="card text-center py-12">
                            <p className="text-slate-400">No emails in queue</p>
                        </div>
                    )}
                </div>

                {/* Bulk Actions */}
                {filteredItems.length > 0 && (
                    <div className="card bg-slate-800/30 border border-slate-700/30">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">
                                {filteredItems.length} emails selected
                            </p>
                            <div className="flex gap-2">
                                <button className="btn-secondary text-sm">Retry Failed</button>
                                <button className="btn-secondary text-sm">Pause All</button>
                                <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-medium">
                                    Delete All
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
