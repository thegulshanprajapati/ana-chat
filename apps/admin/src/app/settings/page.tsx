'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Settings, Save, RotateCcw, Bell, Shield, Database, Mail as MailIcon } from 'lucide-react';

export default function SettingsPage() {
    const [formData, setFormData] = useState({
        siteName: 'AnaChat',
        siteUrl: 'https://anachat.com',
        adminEmail: 'admin@ana.chat',
        timezone: 'UTC',
        language: 'English',
        maintenanceMode: false,
        allowRegistration: true,
        emailNotifications: true
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleReset = () => {
        setFormData({
            siteName: 'AnaChat',
            siteUrl: 'https://anachat.com',
            adminEmail: 'admin@ana.chat',
            timezone: 'UTC',
            language: 'English',
            maintenanceMode: false,
            allowRegistration: true,
            emailNotifications: true
        });
    };

    return (
        <>
            <Header
                title="Settings"
                subtitle="Configure and manage system-wide settings"
            />

            <main className="p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Settings Sections */}
                <div className="grid gap-8">
                    {/* General Settings */}
                    <div className="card">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-slate-800/50">
                                <Settings size={24} className="text-cyan-400" />
                            </div>
                            <h2 className="section-title text-xl">General Settings</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Site Name</label>
                                    <input
                                        type="text"
                                        name="siteName"
                                        value={formData.siteName}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Site URL</label>
                                    <input
                                        type="url"
                                        name="siteUrl"
                                        value={formData.siteUrl}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Admin Email</label>
                                    <input
                                        type="email"
                                        name="adminEmail"
                                        value={formData.adminEmail}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Timezone</label>
                                    <select
                                        name="timezone"
                                        value={formData.timezone}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    >
                                        <option>UTC</option>
                                        <option>EST</option>
                                        <option>CST</option>
                                        <option>MST</option>
                                        <option>PST</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Language</label>
                                <select
                                    name="language"
                                    value={formData.language}
                                    onChange={handleInputChange}
                                    className="input-field"
                                >
                                    <option>English</option>
                                    <option>Spanish</option>
                                    <option>French</option>
                                    <option>German</option>
                                    <option>Chinese</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Security Settings */}
                    <div className="card">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-slate-800/50">
                                <Shield size={24} className="text-purple-400" />
                            </div>
                            <h2 className="section-title text-xl">Security Settings</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <div>
                                    <h3 className="font-medium text-white">Maintenance Mode</h3>
                                    <p className="text-sm text-slate-400 mt-1">Disable access for all users except admins</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="maintenanceMode"
                                        checked={formData.maintenanceMode}
                                        onChange={handleInputChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <div>
                                    <h3 className="font-medium text-white">Allow User Registration</h3>
                                    <p className="text-sm text-slate-400 mt-1">Enable new user signups</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="allowRegistration"
                                        checked={formData.allowRegistration}
                                        onChange={handleInputChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="card">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-slate-800/50">
                                <Bell size={24} className="text-amber-400" />
                            </div>
                            <h2 className="section-title text-xl">Notifications</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <div>
                                    <h3 className="font-medium text-white">Email Notifications</h3>
                                    <p className="text-sm text-slate-400 mt-1">Receive system and user alerts</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="emailNotifications"
                                        checked={formData.emailNotifications}
                                        onChange={handleInputChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="card border-red-500/20">
                        <h2 className="section-title text-xl text-red-400 mb-6">Danger Zone</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div>
                                    <h3 className="font-medium text-white">Clear Cache</h3>
                                    <p className="text-sm text-slate-400 mt-1">Clear all application cache</p>
                                </div>
                                <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-medium">
                                    Clear Cache
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div>
                                    <h3 className="font-medium text-white">Reset Database</h3>
                                    <p className="text-sm text-slate-400 mt-1">Reset all data (cannot be undone)</p>
                                </div>
                                <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-medium">
                                    Reset All
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 sticky bottom-6">
                        <button className="btn-primary flex items-center gap-2">
                            <Save size={20} />
                            Save Changes
                        </button>
                        <button
                            onClick={handleReset}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <RotateCcw size={20} />
                            Reset
                        </button>
                    </div>
                </div>
            </main>
        </>
    );
}
