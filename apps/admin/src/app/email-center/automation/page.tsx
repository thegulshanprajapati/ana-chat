'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Plus, Edit, Trash2, Play, Pause, Eye, TrendingUp, Users, Clock, Zap } from 'lucide-react';

interface Workflow {
    id: string;
    name: string;
    description: string;
    trigger: string;
    status: 'active' | 'paused' | 'draft';
    steps: number;
    totalExecuted: number;
    lastExecuted: string;
    createdBy: string;
    createdAt: string;
}

export default function AutomationPage() {
    const [workflows] = useState<Workflow[]>([
        {
            id: '1',
            name: 'Welcome Series',
            description: 'Send welcome email and follow-up sequence to new users',
            trigger: 'User Registration',
            status: 'active',
            steps: 4,
            totalExecuted: 2450,
            lastExecuted: '2 minutes ago',
            createdBy: 'Admin',
            createdAt: '2024-01-10'
        },
        {
            id: '2',
            name: 'Abandoned Cart Recovery',
            description: 'Remind users about items left in their cart',
            trigger: 'Cart Abandoned',
            status: 'active',
            steps: 3,
            totalExecuted: 1240,
            lastExecuted: '5 minutes ago',
            createdBy: 'Marketing',
            createdAt: '2024-01-15'
        },
        {
            id: '3',
            name: 'Trial Expiration Reminder',
            description: 'Notify users when trial is about to expire',
            trigger: 'Trial Ending',
            status: 'active',
            steps: 2,
            totalExecuted: 580,
            lastExecuted: '1 hour ago',
            createdBy: 'Admin',
            createdAt: '2024-01-20'
        },
        {
            id: '4',
            name: 'Post-Purchase Survey',
            description: 'Ask customers for feedback after purchase',
            trigger: 'Purchase Completed',
            status: 'paused',
            steps: 2,
            totalExecuted: 890,
            lastExecuted: '3 days ago',
            createdBy: 'Support',
            createdAt: '2024-01-25'
        },
        {
            id: '5',
            name: 'Re-engagement Campaign',
            description: 'Win back inactive users with special offers',
            trigger: 'User Inactive (30 days)',
            status: 'draft',
            steps: 5,
            totalExecuted: 0,
            lastExecuted: 'Never',
            createdBy: 'Marketing',
            createdAt: '2024-01-28'
        }
    ]);

    return (
        <>
            <Header
                title="Email Automation"
                subtitle="Create and manage automated email workflows"
            />

            <main className="p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="section-title text-2xl">Workflows</h2>
                        <p className="text-slate-400 text-sm mt-2">Total: {workflows.length} workflows</p>
                    </div>
                    <button className="btn-primary flex items-center gap-2 justify-center md:justify-start">
                        <Plus size={20} />
                        Create Workflow
                    </button>
                </div>

                {/* Workflow Cards */}
                <div className="space-y-4">
                    {workflows.map(workflow => (
                        <div key={workflow.id} className="card">
                            <div className="flex items-start justify-between gap-6 mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${workflow.status === 'active' ? 'badge-success' :
                                                workflow.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                                    'bg-slate-700/50 text-slate-400'
                                            }`}>
                                            {workflow.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-3">{workflow.description}</p>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Zap size={16} className="text-amber-400" />
                                            <div>
                                                <p className="text-slate-500">Trigger</p>
                                                <p className="text-white font-medium">{workflow.trigger}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-blue-400" />
                                            <div>
                                                <p className="text-slate-500">Steps</p>
                                                <p className="text-white font-medium">{workflow.steps}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users size={16} className="text-purple-400" />
                                            <div>
                                                <p className="text-slate-500">Executed</p>
                                                <p className="text-white font-medium">{workflow.totalExecuted.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Last Run</p>
                                            <p className="text-white font-medium text-sm">{workflow.lastExecuted}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 flex-shrink-0">
                                    {workflow.status === 'active' ? (
                                        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-yellow-400 transition-all" title="Pause">
                                            <Pause size={18} />
                                        </button>
                                    ) : (
                                        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-emerald-400 transition-all" title="Resume">
                                            <Play size={18} />
                                        </button>
                                    )}
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="View">
                                        <Eye size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Edit">
                                        <Edit size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Meta Info */}
                            <div className="pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                                <span>Created by {workflow.createdBy} • {workflow.createdAt}</span>
                                <span>📊 Performance →</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Workflow Builder Info */}
                <div className="card border-cyan-500/20 bg-cyan-500/10">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-3">Workflow Builder</h3>
                    <p className="text-sm text-cyan-200 mb-4">
                        Create powerful email automation workflows by connecting triggers, conditions, and actions.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="font-medium text-cyan-300 mb-2">🎯 Triggers</p>
                            <ul className="text-cyan-200/80 space-y-1">
                                <li>• User Registration</li>
                                <li>• Purchase Completed</li>
                                <li>• Trial Ending</li>
                            </ul>
                        </div>

                        <div>
                            <p className="font-medium text-cyan-300 mb-2">⚙️ Actions</p>
                            <ul className="text-cyan-200/80 space-y-1">
                                <li>• Send Email</li>
                                <li>• Wait/Delay</li>
                                <li>• Conditional Branch</li>
                            </ul>
                        </div>

                        <div>
                            <p className="font-medium text-cyan-300 mb-2">📊 Conditions</p>
                            <ul className="text-cyan-200/80 space-y-1">
                                <li>• User Properties</li>
                                <li>• Email Events</li>
                                <li>• Time Conditions</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Example Workflow Visual */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-6">Example: Welcome Series Workflow</h3>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-3 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium whitespace-nowrap">
                                🎯 Trigger
                            </div>
                            <svg className="w-8 h-1 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 flex-1">
                                User Registration Event
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-4 py-3 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                                Step 1
                            </div>
                            <svg className="w-8 h-1 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 flex-1">
                                Send Welcome Email (Immediately)
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-4 py-3 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                Step 2
                            </div>
                            <svg className="w-8 h-1 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 flex-1">
                                Wait 3 Days
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-4 py-3 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                Step 3
                            </div>
                            <svg className="w-8 h-1 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 flex-1">
                                Send Tips Email
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="px-4 py-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                Step 4
                            </div>
                            <svg className="w-8 h-1 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <div className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 flex-1">
                                Wait 7 Days → Send Feature Email
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
