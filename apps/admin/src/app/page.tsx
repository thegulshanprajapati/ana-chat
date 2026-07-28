'use client';

import React from 'react';
import Header from '@/components/Header';
import {
  Users,
  Mail,
  BarChart3,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Eye,
  MessageSquare,
  Upload,
  Settings
} from 'lucide-react';

export default function AdminPage() {
  // Stats Cards Data
  const stats = [
    {
      id: 1,
      title: 'Total Users',
      value: '12,456',
      change: '+12.5%',
      icon: Users,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      id: 2,
      title: 'Active Sessions',
      value: '3,842',
      change: '+8.2%',
      icon: Activity,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      id: 3,
      title: 'Emails Sent',
      value: '45,231',
      change: '+23.1%',
      icon: Mail,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      id: 4,
      title: 'Support Tickets',
      value: '156',
      change: '-4.3%',
      icon: MessageSquare,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10'
    }
  ];

  // Recent Activities
  const activities = [
    {
      id: 1,
      type: 'user_signup',
      title: 'New User Registration',
      description: 'johndoe@example.com joined the platform',
      time: '2 minutes ago',
      icon: Users,
      color: 'text-blue-400'
    },
    {
      id: 2,
      type: 'email_sent',
      title: 'Email Campaign Sent',
      description: 'Welcome email to 1,245 new users',
      time: '15 minutes ago',
      icon: Mail,
      color: 'text-cyan-400'
    },
    {
      id: 3,
      type: 'system_alert',
      title: 'System Alert',
      description: 'Database backup completed successfully',
      time: '1 hour ago',
      icon: CheckCircle,
      color: 'text-emerald-400'
    },
    {
      id: 4,
      type: 'admin_action',
      title: 'Admin Action',
      description: 'User account suspended for violations',
      time: '3 hours ago',
      icon: AlertCircle,
      color: 'text-red-400'
    }
  ];

  // Quick Actions
  const quickActions = [
    {
      title: 'Email Templates',
      description: 'Manage and customize email templates',
      icon: Mail,
      href: '#'
    },
    {
      title: 'User Management',
      description: 'View and manage all users',
      icon: Users,
      href: '#'
    },
    {
      title: 'Reports',
      description: 'View analytics and reports',
      icon: BarChart3,
      href: '#'
    },
    {
      title: 'Settings',
      description: 'Configure system settings',
      icon: Settings,
      href: '#'
    }
  ];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your platform today."
      />

      <main className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.id} className="card group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{stat.value}</h3>
                    <p className="text-xs text-emerald-400 mt-2">{stat.change} from last month</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <Icon size={24} className={`bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Recent Activities */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="section-title">Recent Activities</h2>
                <button className="text-cyan-400 hover:text-cyan-300 text-sm font-medium flex items-center gap-2 transition-colors">
                  View All <ArrowRight size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {activities.map((activity) => {
                  const ActivityIcon = activity.icon;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-cyan-500/30 transition-all"
                    >
                      <div className={`p-2 rounded-lg bg-slate-800/50 ${activity.color}`}>
                        <ActivityIcon size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{activity.title}</h4>
                        <p className="text-sm text-slate-400 mt-1">{activity.description}</p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{activity.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* System Status */}
          <div>
            <div className="card">
              <h2 className="section-title mb-6">System Status</h2>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-800/30 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Server</span>
                    <span className="flex items-center gap-2 text-emerald-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Operational
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/30 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Database</span>
                    <span className="flex items-center gap-2 text-emerald-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Healthy
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/30 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">API</span>
                    <span className="flex items-center gap-2 text-emerald-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Running
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/30 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Storage</span>
                    <span className="flex items-center gap-2 text-amber-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      85% Used
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <p className="text-xs text-slate-400 mb-3">Last backup</p>
                <p className="text-sm font-medium text-white">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="section-title mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, idx) => {
              const ActionIcon = action.icon;
              return (
                <a
                  key={idx}
                  href={action.href}
                  className="card group cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 group-hover:from-cyan-500/30 group-hover:to-purple-500/30 transition-all">
                      <ActionIcon size={28} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{action.title}</h3>
                      <p className="text-xs text-slate-400 mt-2">{action.description}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
