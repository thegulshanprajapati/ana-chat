import { createContext, useContext, useCallback, useState, useEffect } from 'react';

// Toast types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Toast context
const ToastContext = createContext(null);

// Toast deduplication cache
const toastCache = new Map();
const TOAST_CACHE_TTL = 5000; // 5 seconds

function generateToastKey(type, message) {
  return `${type}_${message}`;
}

function isToastDuplicate(key) {
  const now = Date.now();
  const cached = toastCache.get(key);

  if (cached && (now - cached.timestamp) < TOAST_CACHE_TTL) {
    return true;
  }

  toastCache.set(key, { timestamp: now });
  return false;
}

// Cleanup old cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of toastCache.entries()) {
    if (now - value.timestamp > TOAST_CACHE_TTL) {
      toastCache.delete(key);
    }
  }
}, 60000); // Clean every minute

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = TOAST_TYPES.INFO, duration = 5000) => {
    const key = generateToastKey(type, message);

    // Prevent duplicate toasts
    if (isToastDuplicate(key)) {
      console.log('[Toast] Duplicate toast suppressed:', message);
      return null;
    }

    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type,
      duration,
      timestamp: Date.now()
    };

    setToasts(prev => [...prev, toast]);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Success toast
  const success = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.SUCCESS, duration);
  }, [addToast]);

  // Error toast
  const error = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.ERROR, duration);
  }, [addToast]);

  // Warning toast
  const warning = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.WARNING, duration);
  }, [addToast]);

  // Info toast
  const info = useCallback((message, duration) => {
    return addToast(message, TOAST_TYPES.INFO, duration);
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Global error handler hook
export function useGlobalErrorHandler() {
  const { error: showError } = useToast();

  const handleError = useCallback((error, context = '') => {
    console.error(`[Error${context ? ` ${context}` : ''}]:`, error);

    let message = 'An unexpected error occurred';

    if (error?.response?.data?.message) {
      message = error.response.data.message;
    } else if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Don't show auth errors as toasts (handled by auth flow)
    if (error?.response?.status === 401) {
      return;
    }

    // Network errors
    if (!navigator.onLine) {
      message = 'You appear to be offline. Please check your connection.';
    } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
      message = 'Network connection failed. Please try again.';
    }

    showError(message);
  }, [showError]);

  return handleError;
}

// API error interceptor
export function setupGlobalApiErrorHandler(api, handleError) {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      handleError(error, 'API');
      return Promise.reject(error);
    }
  );
}