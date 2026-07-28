'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Plus, Settings, Trash2, Edit, Check, X, Link as LinkIcon, ToggleRight, ToggleLeft, TestTube } from 'lucide-react';

interface Provider {
    id: string;
    name: string;
    type: 'smtp' | 'resend' | 'sendgrid' | 'ses' | 'mailgun' | 'postmark' | 'brevo';
    status: 'connected' | 'configured' | 'error';
    isDefault: boolean;
    isEnabled: boolean;
    priority: number;
    failover: boolean;
    lastTested: string;
}

export default function ProvidersPage() {
    const [providers] = useState<Provider[]>([
        {
            id: '1',
            name: 'Gmail SMTP',
            type: 'smtp',
            status: 'connected',
            isDefault: true,
            isEnabled: true,
            priority: 1,
            failover: true,
            lastTested: '5 minutes ago'
        },
        {
            id: '2',
            name: 'Resend',
            type: 'resend',
            status: 'configured',
            isDefault: false,
            isEnabled: true,
            priority: 2,
            failover: false,
            lastTested: '2 hours ago'
        },
        {
            id: '3',
            name: 'SendGrid',
            type: 'sendgrid',
            status: 'connected',
            isDefault: false,
            isEnabled: true,
            priority: 3,
            failover: false,
            lastTested: '1 day ago'
        },
        {
            id: '4',
            name: 'AWS SES',
            type: 'ses',
            status: 'error',
            isDefault: false,
            isEnabled: false,
            priority: 4,
            failover: false,
            lastTested: '3 days ago'
        }
    ]);

    const getProviderIcon = (type: string) => {
        switch (type) {
            case 'smtp':
                return '📧';
            case 'resend':
                return '✉️';
            case 'sendgrid':
                return '📮';
            case 'ses':
                return '☁️';
            case 'mailgun':
                return '🎯';
            case 'postmark':
                return '📬';
            case 'brevo':
                return '🚀';
            default:
                return '📧';
        }
    };

    return (
        <>
            <Header
                title="Email Providers"
                subtitle="Configure and manage multiple email service providers"
            />

            <main className="p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="section-title text-2xl">Providers</h2>
                        <p className="text-slate-400 text-sm mt-2">Connected: {providers.filter(p => p.status === 'connected').length} of {providers.length}</p>
                    </div>
                    <button className="btn-primary flex items-center gap-2 justify-center md:justify-start">
                        <Plus size={20} />
                        Add Provider
                    </button>
                </div>

                {/* Failover Info */}
                <div className="card border-blue-500/20 bg-blue-500/10">
                    <p className="text-sm text-blue-300">
                        <strong>Automatic Failover:</strong> Emails will automatically be sent through the next enabled provider if the current one fails.
                    </p>
                </div>

                {/* Providers List */}
                <div className="space-y-4">
                    {providers.map((provider) => (
                        <div key={provider.id} className="card">
                            <div className="flex items-start justify-between gap-6">
                                {/* Provider Info */}
                                <div className="flex-1 flex gap-4">
                                    <div className="text-4xl">{getProviderIcon(provider.type)}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${provider.status === 'connected' ? 'badge-success' :
                                                    provider.status === 'configured' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                                        'bg-red-500/20 text-red-300 border border-red-500/30'
                                                }`}>
                                                {provider.status}
                                            </span>
                                            {provider.isDefault && (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                    DEFAULT
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-slate-400">Type</p>
                                                <p className="font-medium text-white mt-1 capitalize">{provider.type}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400">Priority</p>
                                                <p className="font-medium text-white mt-1">#{provider.priority}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400">Failover</p>
                                                <p className="font-medium text-white mt-1">{provider.failover ? '✓ Enabled' : '✗ Disabled'}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400">Last Tested</p>
                                                <p className="font-medium text-white mt-1">{provider.lastTested}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    <button className={`p-2 rounded-lg transition-all ${provider.isEnabled
                                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                                            : 'text-slate-400 hover:bg-slate-700/50'
                                        }`} title={provider.isEnabled ? 'Disable' : 'Enable'}>
                                        {provider.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Test Connection">
                                        <TestTube size={20} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all" title="Edit">
                                        <Edit size={20} />
                                    </button>
                                    <button className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Delete">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Priority Management */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Failover Priority Order</h3>
                    <p className="text-sm text-slate-400 mb-4">Drag to reorder. Emails will be sent through providers in this order.</p>

                    <div className="space-y-2">
                        {providers
                            .filter(p => p.isEnabled)
                            .sort((a, b) => a.priority - b.priority)
                            .map((provider, idx) => (
                                <div key={provider.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-medium">
                                        {idx + 1}
                                    </div>
                                    <span className="flex-1 font-medium text-white">{provider.name}</span>
                                    <span className="text-xs text-slate-400">::: Drag to reorder</span>
                                </div>
                            ))}
                    </div>
                </div>
            </main>
        </>
    );
}
