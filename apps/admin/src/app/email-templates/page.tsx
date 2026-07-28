'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Mail, Plus, Edit, Trash2, Eye, Copy, Search } from 'lucide-react';

export default function EmailTemplatesPage() {
    const [templates] = useState([
        {
            id: 1,
            name: 'Welcome Email',
            description: 'Sent to new users on account creation',
            subject: 'Welcome to AnaChat!',
            lastEdited: '2 days ago',
            status: 'active'
        },
        {
            id: 2,
            name: 'Password Reset',
            description: 'For password reset requests',
            subject: 'Reset Your AnaChat Password',
            lastEdited: '1 week ago',
            status: 'active'
        },
        {
            id: 3,
            name: 'Email Verification',
            description: 'Email verification on registration',
            subject: 'Verify Your Email Address',
            lastEdited: '5 days ago',
            status: 'active'
        },
        {
            id: 4,
            name: 'Account Deleted',
            description: 'Confirmation when account is deleted',
            subject: 'Your AnaChat Account Has Been Deleted',
            lastEdited: '3 weeks ago',
            status: 'inactive'
        }
    ]);

    return (
        <>
            <Header
                title="Email Templates"
                subtitle="Manage and customize all outgoing email templates"
            />

            <main className="p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h2 className="section-title text-2xl">Email Templates</h2>
                        <p className="text-slate-400 text-sm mt-2">Customize all outgoing emails from one place</p>
                    </div>
                    <button className="btn-primary flex items-center gap-2 justify-center md:justify-start">
                        <Plus size={20} />
                        Create Template
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-4 mb-6">
                    <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                        <Search size={18} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                        />
                    </div>
                    <select className="input-field w-40">
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                    </select>
                </div>

                {/* Templates Grid */}
                <div className="grid gap-6">
                    {templates.map((template) => (
                        <div key={template.id} className="card">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-4 flex-1">
                                    <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 h-fit">
                                        <Mail size={24} className="text-cyan-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="font-semibold text-white text-lg">{template.name}</h3>
                                                <p className="text-slate-400 text-sm mt-1">{template.description}</p>
                                                <p className="text-xs text-slate-500 mt-2">Subject: {template.subject}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="flex gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${template.status === 'active'
                                                ? 'badge-success'
                                                : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                                            }`}>
                                            {template.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">Edited {template.lastEdited}</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600 transition-all text-sm font-medium">
                                    <Eye size={16} />
                                    Preview
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all text-sm font-medium">
                                    <Edit size={16} />
                                    Edit
                                </button>
                                <button className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </>
    );
}
