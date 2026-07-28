'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Users, Plus, Search, Filter, MoreVertical, Shield, UserX, Mail as MailIcon } from 'lucide-react';

export default function UsersPage() {
    const [users] = useState([
        {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            joinDate: '2024-01-15',
            status: 'active',
            role: 'User',
            lastActive: '5 minutes ago',
            avatar: 'JD'
        },
        {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            joinDate: '2024-01-20',
            status: 'active',
            role: 'Premium',
            lastActive: '2 hours ago',
            avatar: 'JS'
        },
        {
            id: 3,
            name: 'Mike Johnson',
            email: 'mike@example.com',
            joinDate: '2024-02-01',
            status: 'inactive',
            role: 'User',
            lastActive: '3 days ago',
            avatar: 'MJ'
        },
        {
            id: 4,
            name: 'Sarah Williams',
            email: 'sarah@example.com',
            joinDate: '2024-02-10',
            status: 'active',
            role: 'Premium',
            lastActive: '1 hour ago',
            avatar: 'SW'
        },
        {
            id: 5,
            name: 'Tom Brown',
            email: 'tom@example.com',
            joinDate: '2024-02-15',
            status: 'active',
            role: 'User',
            lastActive: '15 minutes ago',
            avatar: 'TB'
        }
    ]);

    return (
        <>
            <Header
                title="User Management"
                subtitle="Manage, monitor, and moderate all platform users"
            />

            <main className="p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h2 className="section-title text-2xl">Users</h2>
                        <p className="text-slate-400 text-sm mt-2">Total users: {users.length}</p>
                    </div>
                    <button className="btn-primary flex items-center gap-2 justify-center md:justify-start">
                        <Plus size={20} />
                        Add User
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-4 mb-6 flex-wrap">
                    <div className="flex-1 min-w-64 flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus-within:border-cyan-500 transition-all">
                        <Search size={18} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
                        />
                    </div>
                    <button className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all flex items-center gap-2">
                        <Filter size={18} />
                        Filter
                    </button>
                </div>

                {/* Users Table */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50 bg-slate-800/30">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Joined</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Last Active</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user, idx) => (
                                    <tr key={user.id} className={`border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors ${idx === users.length - 1 ? 'border-b-0' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                                                    {user.avatar}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{user.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-400 text-sm">{user.email}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${user.role === 'Premium'
                                                    ? 'badge-primary'
                                                    : 'bg-slate-700/50 text-slate-300'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-400 text-sm">{user.joinDate}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${user.status === 'active'
                                                    ? 'badge-success'
                                                    : 'bg-slate-700/50 text-slate-400'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-400 text-sm">{user.lastActive}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-cyan-400 transition-all">
                                                    <MailIcon size={18} />
                                                </button>
                                                <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-yellow-400 transition-all">
                                                    <Shield size={18} />
                                                </button>
                                                <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition-all">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 bg-slate-800/20">
                        <p className="text-sm text-slate-400">Showing 1 to 5 of {users.length} users</p>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 transition-all text-sm">Previous</button>
                            <button className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm">1</button>
                            <button className="px-3 py-1 rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 transition-all text-sm">Next</button>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
