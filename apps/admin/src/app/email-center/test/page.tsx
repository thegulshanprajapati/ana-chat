'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Send, Eye, Download, AlertCircle, CheckCircle } from 'lucide-react';

export default function TestEmailPage() {
    const [template, setTemplate] = useState('welcome-email');
    const [recipient, setRecipient] = useState('');
    const [variables, setVariables] = useState({
        name: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        otp: '123456',
        verification_link: 'https://anachat.com/verify/abc123',
        reset_link: 'https://anachat.com/reset/xyz789'
    });
    const [testResult, setTestResult] = useState<any>(null);

    const templates = [
        { id: 'welcome-email', name: 'Welcome Email', category: 'Authentication' },
        { id: 'email-verification', name: 'Email Verification', category: 'Authentication' },
        { id: 'password-reset', name: 'Password Reset', category: 'Security' },
        { id: 'otp-verification', name: 'OTP Verification', category: 'Authentication' },
        { id: 'newsletter', name: 'Newsletter', category: 'Marketing' },
        { id: 'invoice', name: 'Invoice', category: 'Billing' }
    ];

    const handleSendTest = () => {
        setTestResult({
            status: 'success',
            message: 'Test email sent successfully',
            details: {
                provider: 'Gmail SMTP',
                messageId: 'msg_1234567890',
                timestamp: new Date().toLocaleString(),
                recipient: recipient,
                template: template,
                retries: 0
            }
        });
    };

    return (
        <>
            <Header
                title="Test Email"
                subtitle="Preview and send test emails before sending to users"
            />

            <main className="p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Test Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Template Selection */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-4">Select Template</h3>

                            <select
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                className="input-field w-full"
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.category})
                                    </option>
                                ))}
                            </select>

                            <p className="text-sm text-slate-400 mt-3">
                                Currently selected: <span className="font-medium text-white">{templates.find(t => t.id === template)?.name}</span>
                            </p>
                        </div>

                        {/* Recipient Email */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-4">Recipient Email</h3>

                            <input
                                type="email"
                                placeholder="Enter recipient email"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                className="input-field w-full"
                            />

                            <p className="text-xs text-slate-400 mt-3">Test email will be sent to this address</p>
                        </div>

                        {/* Variable Overrides */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-4">Variable Overrides</h3>
                            <p className="text-sm text-slate-400 mb-4">Customize merge tags for this test</p>

                            <div className="space-y-3">
                                {Object.entries(variables).map(([key, value]) => (
                                    <div key={key}>
                                        <label className="block text-sm font-medium text-slate-300 mb-2 capitalize">
                                            {key}
                                        </label>
                                        <input
                                            type="text"
                                            value={value as string}
                                            onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                                            className="input-field w-full"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                                <Eye size={20} />
                                Preview
                            </button>
                            <button
                                onClick={handleSendTest}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                <Send size={20} />
                                Send Test Email
                            </button>
                        </div>
                    </div>

                    {/* Result Panel */}
                    <div className="sticky top-32 h-fit">
                        {testResult ? (
                            <div className={`card ${testResult.status === 'success'
                                    ? 'border-emerald-500/20 bg-emerald-500/10'
                                    : 'border-red-500/20 bg-red-500/10'
                                }`}>
                                <div className="flex items-center gap-3 mb-4">
                                    {testResult.status === 'success' ? (
                                        <CheckCircle className="text-emerald-400" size={24} />
                                    ) : (
                                        <AlertCircle className="text-red-400" size={24} />
                                    )}
                                    <h3 className={`font-semibold text-lg ${testResult.status === 'success' ? 'text-emerald-300' : 'text-red-300'
                                        }`}>
                                        {testResult.message}
                                    </h3>
                                </div>

                                <div className="space-y-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
                                    {Object.entries(testResult.details).map(([key, value]) => (
                                        <div key={key} className="flex justify-between gap-4">
                                            <span className="text-slate-400 capitalize text-sm">{key.replace(/_/g, ' ')}:</span>
                                            <span className="text-white font-mono text-sm text-right break-all">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>

                                <button className="w-full mt-4 px-4 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-all text-sm font-medium flex items-center justify-center gap-2">
                                    <Download size={16} />
                                    Download Full Response
                                </button>
                            </div>
                        ) : (
                            <div className="card border-dashed">
                                <div className="text-center py-8">
                                    <p className="text-slate-400">Test results will appear here</p>
                                    <p className="text-xs text-slate-500 mt-2">Fill in the form and click "Send Test Email"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
