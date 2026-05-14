import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';

const OfflineQueueContext = createContext(null);

export function OfflineQueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const isOnline = useOnlineStatus();
  const { info, error: showError } = useToast();

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('offline_queue');
      if (saved) {
        setQueue(JSON.parse(saved));
      }
    } catch (err) {
      console.error('[OfflineQueue] Failed to load queue:', err);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(queue));
    } catch (err) {
      console.error('[OfflineQueue] Failed to save queue:', err);
    }
  }, [queue]);

  // Process queue when coming online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !processing) {
      processQueue();
    }
  }, [isOnline, queue.length, processing]);

  const addToQueue = useCallback((item) => {
    const queueItem = {
      id: Date.now() + Math.random(),
      ...item,
      timestamp: Date.now(),
      retries: 0
    };

    setQueue(prev => [...prev, queueItem]);

    if (!isOnline) {
      info('Message queued for sending when online');
    }

    return queueItem.id;
  }, [isOnline, info]);

  const removeFromQueue = useCallback((id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQueueItem = useCallback((id, updates) => {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const processQueue = useCallback(async () => {
    if (processing || !isOnline || queue.length === 0) return;

    setProcessing(true);
    info(`Sending ${queue.length} queued message${queue.length > 1 ? 's' : ''}...`);

    const itemsToProcess = [...queue];

    for (const item of itemsToProcess) {
      try {
        await api(item.config);
        removeFromQueue(item.id);
      } catch (err) {
        console.error('[OfflineQueue] Failed to send queued item:', err);

        // Increment retry count
        const newRetries = item.retries + 1;

        if (newRetries >= 3) {
          // Remove after 3 failed attempts
          removeFromQueue(item.id);
          showError('Failed to send message after multiple attempts');
        } else {
          // Update retry count
          updateQueueItem(item.id, { retries: newRetries });
        }
      }
    }

    setProcessing(false);

    if (queue.length > itemsToProcess.length) {
      // More items were added while processing
      setTimeout(processQueue, 1000);
    }
  }, [processing, isOnline, queue, info, removeFromQueue, updateQueueItem, showError]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const value = {
    queue,
    processing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    queueLength: queue.length
  };

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
}

// Hook for queuing API requests
export function useQueuedApi() {
  const { addToQueue } = useOfflineQueue();
  const isOnline = useOnlineStatus();

  const queuedRequest = useCallback((config, options = {}) => {
    const { immediate = true } = options;

    if (isOnline && immediate) {
      // Send immediately if online
      return api(config);
    } else {
      // Queue for later
      return new Promise((resolve, reject) => {
        addToQueue({
          config,
          resolve,
          reject
        });
      });
    }
  }, [isOnline, addToQueue]);

  return { queuedRequest };
}