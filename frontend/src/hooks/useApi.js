import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Custom hook for API requests with loading states, error handling, and cancellation
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoCancel - Whether to auto-cancel previous requests (default: true)
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @returns {Object} - { data, loading, error, execute, cancel }
 */
export function useApiRequest(options = {}) {
  const { autoCancel = true, timeout = 30000 } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const execute = useCallback(async (config) => {
    if (!mountedRef.current) return null;

    // Cancel previous request if autoCancel is enabled
    if (autoCancel && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await api({
        ...config,
        signal: abortControllerRef.current.signal,
        timeout
      });

      if (mountedRef.current) {
        setData(response.data);
        setLoading(false);
      }

      return response.data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[useApiRequest] Request cancelled');
        return null;
      }

      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }

      throw err;
    }
  }, [autoCancel, timeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, [cancel]);

  return {
    data,
    loading,
    error,
    execute,
    cancel,
    reset: () => {
      setData(null);
      setError(null);
      setLoading(false);
    }
  };
}

/**
 * Hook for managing chat data with socket updates
 */
export function useChatData() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  const loadChats = useCallback(async (force = false) => {
    if (loadedRef.current && !force) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/chats');
      setChats(response.data || []);
      loadedRef.current = true;
    } catch (err) {
      setError(err);
      console.error('[useChatData] Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateChat = useCallback((chatId, updates) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatId ? { ...chat, ...updates } : chat
    ));
  }, []);

  const addChat = useCallback((newChat) => {
    setChats(prev => [newChat, ...prev]);
  }, []);

  const removeChat = useCallback((chatId) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
  }, []);

  const reset = useCallback(() => {
    setChats([]);
    setError(null);
    setLoading(false);
    loadedRef.current = false;
  }, []);

  return {
    chats,
    loading,
    error,
    loadChats,
    updateChat,
    addChat,
    removeChat,
    reset
  };
}

/**
 * Hook for managing messages with pagination and socket updates
 */
export function useMessages(chatId, options = {}) {
  const { pageSize = 50, autoLoad = true } = options;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const loadingRef = useRef(false);

  const loadMessages = useCallback(async (reset = false) => {
    if (!chatId || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const params = {
        limit: pageSize,
        offset: reset ? 0 : page * pageSize
      };

      const response = await api.get(`/messages/${chatId}`, { params });

      if (reset) {
        setMessages(response.data || []);
        setPage(1);
      } else {
        setMessages(prev => [...(response.data || []), ...prev]);
        setPage(prev => prev + 1);
      }

      setHasMore((response.data || []).length === pageSize);
    } catch (err) {
      setError(err);
      console.error('[useMessages] Failed to load messages:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [chatId, pageSize, page]);

  const addMessage = useCallback((newMessage) => {
    setMessages(prev => [newMessage, ...prev]);
  }, []);

  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setLoading(false);
    setHasMore(true);
    setPage(0);
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    if (autoLoad && chatId) {
      loadMessages(true);
    } else {
      reset();
    }
  }, [chatId, autoLoad, loadMessages, reset]);

  return {
    messages,
    loading,
    error,
    hasMore,
    loadMore: () => loadMessages(false),
    addMessage,
    updateMessage,
    reset
  };
}

/**
 * Hook for debounced search
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}