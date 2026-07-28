'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Save, RotateCcw, Upload, Palette, Settings, Eye } from 'lucide-react';

export default function BrandingPage() {
    const [branding, setBranding] = useState({
        companyName: 'AnaChat',
        website: 'https://anachat.com',
        supportEmail: 'support@anachat.com',
        supportPhone: '+1-800-123-4567',
        primaryColor: '#06b6d4',
        secondaryColor: '#8b5cf6',
        fontFamily: 'Inter',
        emailWidth: '600px',
        footerText: '© 2024 AnaChat. All rights reserved.',
        copyrightText: '© 2024 AnaChat Corp.',
        socialLinks: {
            twitter: 'https://twitter.com/anachat',
            facebook: 'https://facebook.com/anachat',
            linkedin: 'https://linkedin.com/company/anachat',
            instagram: 'https://instagram.com/anachat'
        }
    });

    const fonts = ['Inter', 'Segoe UI', 'Arial', 'Helvetica', 'Georgia', 'Courier New'];
    const emailWidths = ['600px', '650px', '700px', 'auto'];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setBranding(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSocialChange = (platform: string, value: string) => {
        setBranding(prev => ({
            ...prev,
            socialLinks: {
                ...prev.socialLinks,
                [platform]: value
            }
        }));
    };

    return (
        <>
            <Header
                title="Email Branding"
                subtitle="Configure global branding settings for all emails"
            />

            <main className="p-6 lg:p-8 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Company Details */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                <Settings size={20} />
                                Company Details
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Company Name</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={branding.companyName}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
                                    <input
                                        type="url"
                                        name="website"
                                        value={branding.website}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Support Email</label>
                                        <input
                                            type="email"
                                            name="supportEmail"
                                            value={branding.supportEmail}
                                            onChange={handleInputChange}
                                            className="input-field"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Support Phone</label>
                                        <input
                                            type="tel"
                                            name="supportPhone"
                                            value={branding.supportPhone}
                                            onChange={handleInputChange}
                                            className="input-field"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Colors & Fonts */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                <Palette size={20} />
                                Colors & Fonts
                            </h3>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Primary Color</label>
                                        <div className="flex gap-2">
                                            <div
                                                className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer"
                                                style={{ backgroundColor: branding.primaryColor }}
                                            />
                                            <input
                                                type="text"
                                                name="primaryColor"
                                                value={branding.primaryColor}
                                                onChange={handleInputChange}
                                                className="input-field flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Color</label>
                                        <div className="flex gap-2">
                                            <div
                                                className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer"
                                                style={{ backgroundColor: branding.secondaryColor }}
                                            />
                                            <input
                                                type="text"
                                                name="secondaryColor"
                                                value={branding.secondaryColor}
                                                onChange={handleInputChange}
                                                className="input-field flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Font Family</label>
                                        <select
                                            name="fontFamily"
                                            value={branding.fontFamily}
                                            onChange={handleInputChange}
                                            className="input-field"
                                        >
                                            {fonts.map(font => (
                                                <option key={font} value={font}>{font}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Email Width</label>
                                        <select
                                            name="emailWidth"
                                            value={branding.emailWidth}
                                            onChange={handleInputChange}
                                            className="input-field"
                                        >
                                            {emailWidths.map(width => (
                                                <option key={width} value={width}>{width}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Text */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-6">Footer & Copyright</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Footer Text</label>
                                    <textarea
                                        name="footerText"
                                        value={branding.footerText}
                                        onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
                                        rows={3}
                                        className="input-field w-full"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">Displayed at the bottom of emails</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Copyright Text</label>
                                    <input
                                        type="text"
                                        name="copyrightText"
                                        value={branding.copyrightText}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-6">Social Links</h3>

                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(branding.socialLinks).map(([platform, url]) => (
                                    <div key={platform}>
                                        <label className="block text-sm font-medium text-slate-300 mb-2 capitalize">{platform}</label>
                                        <input
                                            type="url"
                                            placeholder={`https://${platform}.com/anachat`}
                                            value={url}
                                            onChange={(e) => handleSocialChange(platform, e.target.value)}
                                            className="input-field"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                                <Save size={20} />
                                Save Branding
                            </button>
                            <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                                <RotateCcw size={20} />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="sticky top-32 h-fit">
                        <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                                <Eye size={20} />
                                Preview
                            </h3>

                            {/* Email Preview */}
                            <div className="bg-white rounded-lg overflow-hidden border border-slate-700/50">
                                <div style={{ fontFamily: branding.fontFamily, maxWidth: branding.emailWidth, margin: '0 auto' }}>
                                    {/* Header */}
                                    <div
                                        style={{ backgroundColor: branding.primaryColor }}
                                        className="p-6 text-center text-white"
                                    >
                                        <h1 className="text-2xl font-bold">{branding.companyName}</h1>
                                    </div>

                                    {/* Body */}
                                    <div className="p-6 text-slate-800">
                                        <p>Sample email content with your branding settings.</p>
                                        <p className="mt-4 text-sm text-slate-600">
                                            Click buttons will use your primary color: <span style={{ color: branding.primaryColor }}>({branding.primaryColor})</span>
                                        </p>
                                    </div>

                                    {/* Footer */}
                                    <div className="border-t border-slate-300 p-6 bg-slate-100 text-xs text-slate-600">
                                        <p>{branding.footerText}</p>
                                        <p className="mt-3">
                                            {branding.supportEmail} | {branding.supportPhone}
                                        </p>
                                        <div className="mt-4 flex gap-3 justify-center">
                                            {branding.socialLinks.twitter && <a href="#" className="text-xs hover:underline">Twitter</a>}
                                            {branding.socialLinks.facebook && <a href="#" className="text-xs hover:underline">Facebook</a>}
                                            {branding.socialLinks.linkedin && <a href="#" className="text-xs hover:underline">LinkedIn</a>}
                                            {branding.socialLinks.instagram && <a href="#" className="text-xs hover:underline">Instagram</a>}
                                        </div>
                                        <p className="mt-4 text-center">{branding.copyrightText}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
