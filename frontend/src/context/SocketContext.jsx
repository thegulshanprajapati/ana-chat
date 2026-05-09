import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE_URL } from "../api/client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

// Connection states
const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// Event types for monitoring
const MONITORING_EVENTS = {
  CONNECT: 'socket_connect',
  DISCONNECT: 'socket_disconnect',
  RECONNECT: 'socket_reconnect',
  RECONNECT_ATTEMPT: 'socket_reconnect_attempt',
  RECONNECT_ERROR: 'socket_reconnect_error',
  ERROR: 'socket_error',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  CALL_STARTED: 'call_started',
  CALL_ENDED: 'call_ended'
};

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.DISCONNECTED);
  const [connectionMetrics, setConnectionMetrics] = useState({
    connectCount: 0,
    disconnectCount: 0,
    reconnectCount: 0,
    lastConnectTime: null,
    lastDisconnectTime: null,
    uptime: 0
  });

  // Refs for managing socket lifecycle
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const eventListenersRef = useRef(new Map());
  const roomsRef = useRef(new Set());
  const metricsRef = useRef(connectionMetrics);

  // Update metrics ref
  useEffect(() => {
    metricsRef.current = connectionMetrics;
  }, [connectionMetrics]);

  // Heartbeat system
  const startHeartbeat = useCallback((socketInstance) => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (socketInstance && socketInstance.connected) {
        const pingTime = Date.now();
        socketInstance.emit('ping', { timestamp: pingTime });

        // Set timeout for pong response
        const pongTimeout = setTimeout(() => {
          console.warn('[Socket] Heartbeat timeout - no pong received');
          // Force reconnection if heartbeat fails
          socketInstance.disconnect();
        }, 5000);

        // Listen for pong once
        const pongHandler = (data) => {
          clearTimeout(pongTimeout);
          const latency = Date.now() - data.timestamp;
          socketInstance.off('pong', pongHandler);

          // Update metrics
          setConnectionMetrics(prev => ({
            ...prev,
            uptime: prev.uptime + 1
          }));
        };

        socketInstance.once('pong', pongHandler);
      }
    }, 30000); // Heartbeat every 30 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Room management
  const joinRoom = useCallback((roomName) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_room', roomName);
      roomsRef.current.add(roomName);
    }
  }, []);

  const leaveRoom = useCallback((roomName) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave_room', roomName);
      roomsRef.current.delete(roomName);
    }
  }, []);

  const leaveAllRooms = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      roomsRef.current.forEach(room => {
        socketRef.current.emit('leave_room', room);
      });
      roomsRef.current.clear();
    }
  }, []);

  // Event listener management with cleanup
  const addEventListener = useCallback((event, handler) => {
    if (!socketRef.current) return;

    const wrappedHandler = (...args) => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[Socket] Error in event handler for ${event}:`, error);
        // Log error for monitoring
        logMonitoringEvent(MONITORING_EVENTS.ERROR, {
          event,
          error: error.message,
          stack: error.stack
        });
      }
    };

    socketRef.current.on(event, wrappedHandler);
    eventListenersRef.current.set(event, wrappedHandler);
  }, []);

  const removeEventListener = useCallback((event) => {
    if (!socketRef.current) return;

    const handler = eventListenersRef.current.get(event);
    if (handler) {
      socketRef.current.off(event, handler);
      eventListenersRef.current.delete(event);
    }
  }, []);

  const removeAllEventListeners = useCallback(() => {
    if (!socketRef.current) return;

    eventListenersRef.current.forEach((handler, event) => {
      socketRef.current.off(event, handler);
    });
    eventListenersRef.current.clear();
  }, []);

  // Monitoring and logging
  const logMonitoringEvent = useCallback((eventType, data = {}) => {
    const eventData = {
      type: eventType,
      timestamp: new Date().toISOString(),
      userId: user?.id,
      connectionState,
      ...data
    };

    // Send to admin monitoring if connected
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('monitoring_event', eventData);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Socket Monitoring]', eventData);
    }
  }, [user?.id, connectionState]);

  // Enhanced socket initialization
  const initializeSocket = useCallback(() => {
    if (!user) return;

    setConnectionState(CONNECTION_STATES.CONNECTING);

    try {
      const socketInstance = io(SOCKET_BASE_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'], // Prefer websocket, fallback to polling
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        autoConnect: true,
        forceNew: true,
        upgrade: true
      });

      // Connection event handlers
      socketInstance.on('connect', () => {
        console.log('[Socket] Connected successfully');
        setConnectionState(CONNECTION_STATES.CONNECTED);
        setConnectionMetrics(prev => ({
          ...prev,
          connectCount: prev.connectCount + 1,
          lastConnectTime: new Date().toISOString()
        }));
        logMonitoringEvent(MONITORING_EVENTS.CONNECT);

        // Start heartbeat
        startHeartbeat(socketInstance);

        // Rejoin rooms
        roomsRef.current.forEach(room => {
          socketInstance.emit('join_room', room);
        });
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        setConnectionState(reason === 'io server disconnect' ? CONNECTION_STATES.ERROR : CONNECTION_STATES.DISCONNECTED);
        setConnectionMetrics(prev => ({
          ...prev,
          disconnectCount: prev.disconnectCount + 1,
          lastDisconnectTime: new Date().toISOString()
        }));
        logMonitoringEvent(MONITORING_EVENTS.DISCONNECT, { reason });
        stopHeartbeat();
      });

      socketInstance.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        setConnectionState(CONNECTION_STATES.ERROR);
        logMonitoringEvent(MONITORING_EVENTS.ERROR, {
          error: error.message,
          type: 'connection_error'
        });
      });

      socketInstance.on('reconnect', (attemptNumber) => {
        console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
        setConnectionState(CONNECTION_STATES.CONNECTED);
        setConnectionMetrics(prev => ({
          ...prev,
          reconnectCount: prev.reconnectCount + 1
        }));
        logMonitoringEvent(MONITORING_EVENTS.RECONNECT, { attemptNumber });
      });

      socketInstance.on('reconnect_attempt', (attemptNumber) => {
        console.log('[Socket] Reconnection attempt', attemptNumber);
        setConnectionState(CONNECTION_STATES.RECONNECTING);
        logMonitoringEvent(MONITORING_EVENTS.RECONNECT_ATTEMPT, { attemptNumber });
      });

      socketInstance.on('reconnect_error', (error) => {
        console.error('[Socket] Reconnection error:', error);
        logMonitoringEvent(MONITORING_EVENTS.RECONNECT_ERROR, {
          error: error.message
        });
      });

      // Heartbeat response
      socketInstance.on('pong', (data) => {
        // Handled in heartbeat function
      });

      // Store socket instance
      socketRef.current = socketInstance;
      setSocket(socketInstance);

    } catch (error) {
      console.error('[Socket] Initialization failed:', error);
      setConnectionState(CONNECTION_STATES.ERROR);
      logMonitoringEvent(MONITORING_EVENTS.ERROR, {
        error: error.message,
        type: 'initialization_error'
      });
      setSocket(null);
    }
  }, [user, startHeartbeat, stopHeartbeat, logMonitoringEvent]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (socketRef.current) {
      removeAllEventListeners();
      leaveAllRooms();
      stopHeartbeat();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setConnectionState(CONNECTION_STATES.DISCONNECTED);

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, [removeAllEventListeners, leaveAllRooms, stopHeartbeat]);

  // Initialize socket when user changes
  useEffect(() => {
    cleanup();
    if (user) {
      // Small delay to ensure auth is ready
      reconnectTimerRef.current = setTimeout(initializeSocket, 100);
    }

    return cleanup;
  }, [user, initializeSocket, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Enhanced socket object with utilities
  const enhancedSocket = useMemo(() => {
    if (!socket) return null;

    return {
      ...socket,
      // Connection state
      connectionState,
      isConnected: connectionState === CONNECTION_STATES.CONNECTED,
      metrics: connectionMetrics,

      // Room management
      joinRoom,
      leaveRoom,
      leaveAllRooms,

      // Event management
      addEventListener,
      removeEventListener,
      removeAllEventListeners,

      // Monitoring
      logMonitoringEvent,

      // Utility methods
      emitWithMonitoring: (event, data) => {
        logMonitoringEvent(event, data);
        socket.emit(event, data);
      }
    };
  }, [
    socket,
    connectionState,
    connectionMetrics,
    joinRoom,
    leaveRoom,
    leaveAllRooms,
    addEventListener,
    removeEventListener,
    removeAllEventListeners,
    logMonitoringEvent
  ]);

  const value = useMemo(() => enhancedSocket, [enhancedSocket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
