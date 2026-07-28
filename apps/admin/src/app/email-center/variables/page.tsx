'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Copy, Search, Filter, Plus } from 'lucide-react';

interface Variable {
    id: string;
    tag: string;
    description: string;
    category: string;
    example: string;
    scope: 'global' | 'user' | 'email' | 'system';
}

export default function VariablesPage() {
    const [variables] = useState<Variable[]>([
        // App Variables
        { id: '1', tag: '{{app.name}}', description: 'Application name', category: 'App', example: 'AnaChat', scope: 'global' },
        { id: '2', tag: '{{app.logo}}', description: 'Application logo URL', category: 'App', example: 'https://anachat.com/logo.png', scope: 'global' },
        { id: '3', tag: '{{app.website}}', description: 'Application website URL', category: 'App', example: 'https://anachat.com', scope: 'global' },

        // Company Variables
        { id: '4', tag: '{{company.name}}', description: 'Company name', category: 'Company', example: 'AnaChat Inc.', scope: 'global' },
        { id: '5', tag: '{{company.address}}', description: 'Company address', category: 'Company', example: '123 Main St, City, State 12345', scope: 'global' },
        { id: '6', tag: '{{company.phone}}', description: 'Company phone', category: 'Company', example: '+1-800-123-4567', scope: 'global' },
        { id: '7', tag: '{{company.email}}', description: 'Company email', category: 'Company', example: 'info@anachat.com', scope: 'global' },

        // Support Variables
        { id: '8', tag: '{{support.email}}', description: 'Support email address', category: 'Support', example: 'support@anachat.com', scope: 'global' },
        { id: '9', tag: '{{support.phone}}', description: 'Support phone number', category: 'Support', example: '+1-800-SUPPORT', scope: 'global' },
        { id: '10', tag: '{{support.url}}', description: 'Support center URL', category: 'Support', example: 'https://help.anachat.com', scope: 'global' },

        // User Variables
        { id: '11', tag: '{{user.name}}', description: 'User full name', category: 'User', example: 'John Doe', scope: 'user' },
        { id: '12', tag: '{{user.username}}', description: 'User username', category: 'User', example: 'johndoe', scope: 'user' },
        { id: '13', tag: '{{user.email}}', description: 'User email address', category: 'User', example: 'john@example.com', scope: 'user' },
        { id: '14', tag: '{{user.avatar}}', description: 'User avatar URL', category: 'User', example: 'https://anachat.com/avatars/user123.jpg', scope: 'user' },
        { id: '15', tag: '{{user.id}}', description: 'User unique ID', category: 'User', example: 'usr_1234567890', scope: 'user' },
        { id: '16', tag: '{{user.firstName}}', description: 'User first name', category: 'User', example: 'John', scope: 'user' },
        { id: '17', tag: '{{user.lastName}}', description: 'User last name', category: 'User', example: 'Doe', scope: 'user' },

        // Authentication Variables
        { id: '18', tag: '{{otp}}', description: 'One-time password', category: 'Auth', example: '123456', scope: 'email' },
        { id: '19', tag: '{{verification_link}}', description: 'Email verification link', category: 'Auth', example: 'https://anachat.com/verify/token123', scope: 'email' },
        { id: '20', tag: '{{reset_link}}', description: 'Password reset link', category: 'Auth', example: 'https://anachat.com/reset/token456', scope: 'email' },
        { id: '21', tag: '{{magic_link}}', description: 'Magic authentication link', category: 'Auth', example: 'https://anachat.com/auth/token789', scope: 'email' },
        { id: '22', tag: '{{confirmation_code}}', description: 'Confirmation code', category: 'Auth', example: 'CONF-12345', scope: 'email' },

        // Login Variables
        { id: '23', tag: '{{login_device}}', description: 'Device information', category: 'Login', example: 'Chrome on Windows 10', scope: 'email' },
        { id: '24', tag: '{{login_location}}', description: 'Login location', category: 'Login', example: 'New York, USA', scope: 'email' },
        { id: '25', tag: '{{login_ip}}', description: 'Login IP address', category: 'Login', example: '192.168.1.1', scope: 'email' },
        { id: '26', tag: '{{browser}}', description: 'Browser information', category: 'Login', example: 'Chrome 120.0', scope: 'email' },
        { id: '27', tag: '{{os}}', description: 'Operating system', category: 'Login', example: 'Windows 11', scope: 'email' },

        // Date & Time Variables
        { id: '28', tag: '{{current_date}}', description: 'Current date', category: 'System', example: '2024-01-15', scope: 'system' },
        { id: '29', tag: '{{current_time}}', description: 'Current time', category: 'System', example: '14:30:00', scope: 'system' },
        { id: '30', tag: '{{current_year}}', description: 'Current year', category: 'System', example: '2024', scope: 'system' },

        // Subscription Variables
        { id: '31', tag: '{{subscription_name}}', description: 'Subscription plan name', category: 'Subscription', example: 'Premium', scope: 'email' },
        { id: '32', tag: '{{subscription_price}}', description: 'Subscription price', category: 'Subscription', example: '$99.99/month', scope: 'email' },
        { id: '33', tag: '{{expiry_date}}', description: 'Subscription expiration date', category: 'Subscription', example: '2024-12-31', scope: 'email' },
        { id: '34', tag: '{{trial_days_left}}', description: 'Trial days remaining', category: 'Subscription', example: '14', scope: 'email' },

        // Billing Variables
        { id: '35', tag: '{{invoice_number}}', description: 'Invoice number', category: 'Billing', example: 'INV-2024-001', scope: 'email' },
        { id: '36', tag: '{{amount}}', description: 'Amount due/paid', category: 'Billing', example: '99.99', scope: 'email' },
        { id: '37', tag: '{{currency}}', description: 'Currency code', category: 'Billing', example: 'USD', scope: 'email' },

        // Ticket Variables
        { id: '38', tag: '{{ticket_id}}', description: 'Support ticket ID', category: 'Support', example: 'TKT-2024-001', scope: 'email' },
        { id: '39', tag: '{{ticket_status}}', description: 'Ticket status', category: 'Support', example: 'Open', scope: 'email' },

        // Group/Channel Variables
        { id: '40', tag: '{{group_name}}', description: 'Group name', category: 'Messaging', example: 'Frontend Team', scope: 'email' },
        { id: '41', tag: '{{channel_name}}', description: 'Channel name', category: 'Messaging', example: 'general', scope: 'email' },
        { id: '42', tag: '{{sender_name}}', description: 'Message sender name', category: 'Messaging', example: 'Jane Smith', scope: 'email' },
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [copiedTag, setCopiedTag] = useState<string | null>(null);

    const categories = ['all', 'App', 'Company', 'Support', 'User', 'Auth', 'Login', 'System', 'Subscription', 'Billing', 'Support', 'Messaging'];

    const uniqueCategories = Array.from(new Set(variables.map(v => v.category)));

    const filteredVariables = variables.filter(v => {
        const matchesSearch = v.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleCopyTag = (tag: string) => {
        navigator.clipboard.writeText(tag);
        setCopiedTag(tag);
        setTimeout(() => setCopiedTag(null), 2000);
    };

    return (
        <>
            <Header
                title="Email Variables"
                subtitle="Manage dynamic variables and merge tags for email templates"
            />

            <main className="p-6 lg:p-8 space-y-6">
                {/* Info Banner */}
                <div className="card border-blue-500/20 bg-blue-500/10">
                    <p className="text-sm text-blue-300">
                        <strong>💡 Tip:</strong> Use these merge tags in your email templates. They will be automatically replaced with actual values when emails are sent.
                    </p>
                </div>

                {/* Search & Filter */}
                <div className="card p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search variables..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                            />
                        </div>

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="input-field w-full lg:w-44"
                        >
                            {['all', ...uniqueCategories].map(cat => (
                                <option key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat}
                                </option>
                            ))}
                        </select>

                        <button className="btn-primary flex items-center gap-2 justify-center whitespace-nowrap">
                            <Plus size={18} />
                            Custom Variable
                        </button>
                    </div>
                </div>

                {/* Variables Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVariables.map(variable => (
                        <div key={variable.id} className="card">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <code className="px-3 py-1 rounded bg-slate-900 text-cyan-400 font-mono text-sm break-all">
                                            {variable.tag}
                                        </code>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${variable.scope === 'global' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                                variable.scope === 'user' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                                    variable.scope === 'email' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                                        'bg-slate-700/50 text-slate-300'
                                            }`}>
                                            {variable.scope}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-300 mb-2">{variable.description}</p>
                                    <p className="text-xs text-slate-500">Example: <span className="text-slate-400">{variable.example}</span></p>
                                </div>

                                <button
                                    onClick={() => handleCopyTag(variable.tag)}
                                    className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all"
                                    title="Copy tag"
                                >
                                    {copiedTag === variable.tag ? (
                                        <span className="text-xs text-emerald-400">✓</span>
                                    ) : (
                                        <Copy size={18} />
                                    )}
                                </button>
                            </div>

                            <div className="px-3 py-2 rounded bg-slate-900/50 border border-slate-700/30">
                                <p className="text-xs text-slate-400">Category: <span className="text-slate-300 font-medium">{variable.category}</span></p>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredVariables.length === 0 && (
                    <div className="card text-center py-12">
                        <p className="text-slate-400">No variables found</p>
                    </div>
                )}

                {/* Variable Reference */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Variable Syntax</h3>
                    <div className="space-y-3 text-sm text-slate-400">
                        <p>Use double curly braces to insert variables in your templates:</p>
                        <div className="bg-slate-900/50 rounded border border-slate-700/30 p-4 font-mono">
                            <p className="text-cyan-400">{"Hello {{ user.name }}!"}</p>
                            <p className="text-slate-500 mt-2">→ Hello John Doe!</p>
                        </div>
                        <p className="mt-4">
                            <strong className="text-white">Note:</strong> Variables are case-sensitive and must match exactly as shown above.
                        </p>
                    </div>
                </div>
            </main>
        </>
    );
}
