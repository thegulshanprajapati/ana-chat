'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Plus, Search, Filter, Edit, Trash2, Copy, Eye, Download, Upload, ChevronDown, Tag, Calendar } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    slug: string;
    category: string;
    subject: string;
    status: 'active' | 'inactive' | 'draft';
    version: number;
    language: string;
    lastEdited: string;
    createdBy: string;
}

export default function EmailTemplatesPage() {
    const [templates] = useState<Template[]>([
        {
            id: '1',
            name: 'Welcome Email',
            slug: 'welcome-email',
            category: 'Authentication',
            subject: 'Welcome to {{app.name}}!',
            status: 'active',
            version: 3,
            language: 'English',
            lastEdited: '2 days ago',
            createdBy: 'Admin'
        },
        {
            id: '2',
            name: 'Email Verification',
            slug: 'email-verification',
            category: 'Authentication',
            subject: 'Verify Your Email Address',
            status: 'active',
            version: 5,
            language: 'English',
            lastEdited: '1 week ago',
            createdBy: 'Admin'
        },
        {
            id: '3',
            name: 'Password Reset',
            slug: 'password-reset',
            category: 'Security',
            subject: 'Reset Your {{app.name}} Password',
            status: 'active',
            version: 2,
            language: 'English',
            lastEdited: '5 days ago',
            createdBy: 'Admin'
        },
        {
            id: '4',
            name: 'OTP Verification',
            slug: 'otp-verification',
            category: 'Authentication',
            subject: 'Your OTP Code: {{otp}}',
            status: 'active',
            version: 1,
            language: 'English',
            lastEdited: '3 days ago',
            createdBy: 'Admin'
        },
        {
            id: '5',
            name: 'Newsletter',
            slug: 'newsletter',
            category: 'Marketing',
            subject: 'Weekly Newsletter - {{current_date}}',
            status: 'inactive',
            version: 8,
            language: 'English',
            lastEdited: '2 weeks ago',
            createdBy: 'Marketing'
        },
        {
            id: '6',
            name: 'Invoice',
            slug: 'invoice',
            category: 'Billing',
            subject: 'Invoice #{{invoice_number}}',
            status: 'active',
            version: 4,
            language: 'English',
            lastEdited: '1 day ago',
            createdBy: 'Admin'
        }
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

    const categories = ['all', 'Authentication', 'Security', 'Messaging', 'Notifications', 'Subscription', 'Billing', 'Support', 'Marketing', 'Admin'];
    const languages = ['all', 'English', 'Spanish', 'French', 'German', 'Hindi'];

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.slug.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
        const matchesLanguage = selectedLanguage === 'all' || t.language === selectedLanguage;
        return matchesSearch && matchesCategory && matchesLanguage;
    });

    return (
        <>
            <Header
                title="Email Templates"
                subtitle="Create and manage all email templates"
            />

            <main className="p-6 lg:p-8 space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="section-title text-2xl">Templates</h2>
                        <p className="text-slate-400 text-sm mt-2">Total: {templates.length} templates</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn-secondary flex items-center gap-2">
                            <Upload size={20} />
                            Import
                        </button>
                        <button className="btn-primary flex items-center gap-2">
                            <Plus size={20} />
                            New Template
                        </button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="card p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                            />
                        </div>

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="input-field w-full lg:w-48"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="input-field w-full lg:w-40"
                        >
                            {languages.map(lang => (
                                <option key={lang} value={lang}>
                                    {lang === 'all' ? 'All Languages' : lang}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="grid gap-4">
                    {filteredTemplates.map(template => (
                        <div key={template.id} className="card">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${template.status === 'active' ? 'badge-success' :
                                            template.status === 'inactive' ? 'bg-slate-700/50 text-slate-400' :
                                                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            }`}>
                                            {template.status}
                                        </span>
                                        <span className="text-xs text-slate-400">v{template.version}</span>
                                    </div>

                                    <p className="text-sm text-slate-400 mb-3">{template.subject}</p>

                                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <Tag size={14} />
                                            {template.category}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {template.language}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            Updated {template.lastEdited}
                                        </div>
                                        <div>By {template.createdBy}</div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Preview">
                                        <Eye size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Edit">
                                        <Edit size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Duplicate">
                                        <Copy size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Export">
                                        <Download size={18} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredTemplates.length === 0 && (
                    <div className="card text-center py-12">
                        <p className="text-slate-400">No templates found</p>
                    </div>
                )}
            </main>
        </>
    );
}
