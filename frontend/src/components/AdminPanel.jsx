import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";

export default function AdminPanel({ users: initialUsers, onReload }) {
  const socket = useSocket();
  const [users, setUsers] = useState(initialUsers || []);
  const [monitoringData, setMonitoringData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const loadMonitoringData = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/monitoring');
      setMonitoringData(data);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUsers(initialUsers || []);
  }, [initialUsers]);

  useEffect(() => {
    loadMonitoringData();
    // Refresh monitoring data every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [loadMonitoringData]);

  // Listen for real-time monitoring events
  useEffect(() => {
    if (!socket || !socket.addEventListener || !socket.emit) return;

    const handleMonitoringUpdate = (eventData) => {
      setMonitoringData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recentEvents: [eventData, ...(prev.recentEvents || []).slice(0, 99)]
        };
      });
    };

    socket.addEventListener('monitoring_update', handleMonitoringUpdate);
    socket.emit('monitoring_subscribe');

    return () => {
      socket.removeEventListener('monitoring_update');
    };
  }, [socket]);

  async function remove(id) {
    await api.delete(`/users/${id}`);
    setUsers((u) => u.filter((x) => x.id !== id));
    onReload?.();
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventSeverityColor = (type) => {
    if (type.includes('error') || type.includes('fail')) return 'text-red-600 dark:text-red-400';
    if (type.includes('disconnect')) return 'text-orange-600 dark:text-orange-400';
    if (type.includes('connect')) return 'text-green-600 dark:text-green-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Admin Panel</div>
        <div className="text-center py-8">Loading monitoring data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin Monitoring Dashboard</div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-neutral-800 p-1 rounded-lg">
        {['overview', 'connections', 'events', 'users'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-black text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && monitoringData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-slate-500 dark:text-neutral-400">Active Connections</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {monitoringData.connectionMetrics?.activeConnections || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-slate-500 dark:text-neutral-400">Total Connections</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {monitoringData.connectionMetrics?.totalConnections || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-slate-500 dark:text-neutral-400">Connection Errors</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {monitoringData.connectionMetrics?.connectionErrors || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-slate-500 dark:text-neutral-400">Reconnects</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {monitoringData.connectionMetrics?.totalReconnects || 0}
            </div>
          </div>
        </div>
      )}

      {/* Connections Tab */}
      {activeTab === 'connections' && monitoringData?.activeSockets && (
        <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800">
          <div className="p-4 border-b border-slate-200 dark:border-neutral-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Active Socket Connections</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-neutral-800">
            {monitoringData.activeSockets.map((socket) => (
              <div key={socket.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      User ID: {socket.userId}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-neutral-400">
                      Socket: {socket.id}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-neutral-400">
                      Connected: {formatTimestamp(socket.connectedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-600 dark:text-green-400">Connected</div>
                  </div>
                </div>
              </div>
            ))}
            {!monitoringData.activeSockets.length && (
              <div className="p-4 text-center text-slate-500 dark:text-neutral-500">
                No active connections
              </div>
            )}
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && monitoringData?.recentEvents && (
        <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800">
          <div className="p-4 border-b border-slate-200 dark:border-neutral-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Events</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-neutral-800 max-h-96 overflow-y-auto">
            {monitoringData.recentEvents.map((event) => (
              <div key={event.id || event.timestamp} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className={`font-medium ${getEventSeverityColor(event.type)}`}>
                      {event.type}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {event.message || JSON.stringify(event)}
                    </div>
                    {event.userId && (
                      <div className="text-xs text-slate-500 dark:text-neutral-500 mt-1">
                        User: {event.userId}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-neutral-500">
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {!monitoringData.recentEvents.length && (
              <div className="p-4 text-center text-slate-500 dark:text-neutral-500">
                No recent events
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-neutral-800">
          <div className="p-4 border-b border-slate-200 dark:border-neutral-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">User Management</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-neutral-800">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</div>
                  <div className="text-sm text-slate-500 dark:text-neutral-400">{u.email}</div>
                  <div className="text-xs text-slate-400 dark:text-neutral-600">
                    ID: {u.id} | Status: {u.status || 'unknown'}
                  </div>
                </div>
                <button
                  onClick={() => remove(u.id)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-3 py-1 border border-red-200 dark:border-red-800 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
            {!users.length && (
              <div className="p-4 text-slate-500 dark:text-neutral-500">No users.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
