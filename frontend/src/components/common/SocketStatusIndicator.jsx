import { useSocket } from '../../context/SocketContext';
import { useOnlineStatus } from '../../hooks/useApi';
import { useMemo } from 'react';

const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

export function SocketStatusIndicator() {
  const socket = useSocket();
  const isOnline = useOnlineStatus();

  const status = useMemo(() => {
    if (!isOnline) return { state: 'offline', label: 'Offline', color: 'bg-gray-500' };
    if (!socket) return { state: 'disconnected', label: 'Disconnected', color: 'bg-red-500' };

    switch (socket.connectionState) {
      case CONNECTION_STATES.CONNECTED:
        return { state: 'connected', label: 'Connected', color: 'bg-green-500' };
      case CONNECTION_STATES.CONNECTING:
        return { state: 'connecting', label: 'Connecting...', color: 'bg-yellow-500 animate-pulse' };
      case CONNECTION_STATES.RECONNECTING:
        return { state: 'reconnecting', label: 'Reconnecting...', color: 'bg-orange-500 animate-pulse' };
      case CONNECTION_STATES.ERROR:
        return { state: 'error', label: 'Connection Error', color: 'bg-red-500' };
      default:
        return { state: 'disconnected', label: 'Disconnected', color: 'bg-red-500' };
    }
  }, [socket, isOnline]);

  const handleReconnect = () => {
    if (socket?.reconnect) {
      socket.reconnect();
    }
  };

  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full shadow-sm border">
      <div className={`w-2 h-2 rounded-full ${status.color}`} />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {status.label}
      </span>
      {(status.state === 'error' || status.state === 'disconnected') && isOnline && (
        <button
          onClick={handleReconnect}
          className="text-xs text-blue-500 hover:text-blue-600 underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function ConnectionBanner() {
  const socket = useSocket();
  const isOnline = useOnlineStatus();

  const showBanner = useMemo(() => {
    if (!isOnline) return true;
    if (!socket) return false;
    return socket.connectionState === CONNECTION_STATES.ERROR ||
           socket.connectionState === CONNECTION_STATES.DISCONNECTED;
  }, [socket, isOnline]);

  if (!showBanner) return null;

  const message = !isOnline
    ? "You're offline. Some features may not work."
    : "Connection lost. Attempting to reconnect...";

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {message}
          </span>
        </div>
        {isOnline && socket?.reconnect && (
          <button
            onClick={socket.reconnect}
            className="text-sm text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
          >
            Retry now
          </button>
        )}
      </div>
    </div>
  );
}
