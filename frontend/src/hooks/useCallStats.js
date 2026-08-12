/**
 * useCallStats
 * ─────────────
 * Polls RTCPeerConnection.getStats() during an active call to track:
 *   • bytesSent / bytesReceived
 *   • networkType (inferred from ICE candidate type)
 *   • callQuality  (inferred from packet-loss / jitter)
 *   • reconnectCount / interruptionCount
 *
 * Returns null values when stats are genuinely unavailable —
 * never fabricates numbers.
 */
import { useCallback, useEffect, useRef, useState } from "react";

function classifyQuality(packetLossRatio, jitter) {
  if (packetLossRatio === null && jitter === null) return null;
  const loss  = packetLossRatio ?? 0;
  const jit   = jitter ?? 0;
  if (loss < 0.01 && jit < 20)  return "excellent";
  if (loss < 0.03 && jit < 50)  return "good";
  if (loss < 0.08 && jit < 100) return "fair";
  return "poor";
}

function formatBytes(bytes) {
  if (bytes == null) return null;
  return Math.round(bytes);
}

export default function useCallStats(peerConnection, isLive) {
  const [stats, setStats] = useState({
    bytesSent:          null,
    bytesReceived:      null,
    networkType:        null,
    callQuality:        null,
    reconnectCount:     0,
    interruptionCount:  0,
  });

  const reconnectCountRef    = useRef(0);
  const interruptCountRef    = useRef(0);
  const prevStateRef         = useRef("new");
  const intervalRef          = useRef(null);

  const collectStats = useCallback(async () => {
    if (!peerConnection || peerConnection.connectionState === "closed") return;

    try {
      const report = await peerConnection.getStats();
      let bytesSent       = 0;
      let bytesReceived   = 0;
      let packetsSent     = 0;
      let packetsLost     = 0;
      let jitter          = 0;
      let networkType     = null;
      let jitterCount     = 0;

      report.forEach((item) => {
        // Outbound RTP — bytes sent
        if (item.type === "outbound-rtp") {
          bytesSent     += item.bytesSent    || 0;
          packetsSent   += item.packetsSent  || 0;
        }
        // Inbound RTP — bytes received, jitter, packet loss
        if (item.type === "inbound-rtp") {
          bytesReceived += item.bytesReceived || 0;
          packetsLost   += item.packetsLost   || 0;
          if (item.jitter != null) {
            jitter      += item.jitter * 1000; // convert to ms
            jitterCount++;
          }
        }
        // ICE candidate pair (active) — derive network type
        if (item.type === "candidate-pair" && item.state === "succeeded") {
          const localId = item.localCandidateId;
          if (localId) {
            const localCandidate = report.get(localId);
            if (localCandidate) {
              const ctype = localCandidate.candidateType;
              if (ctype === "relay")  networkType = "cellular"; // TURN relay
              else if (ctype === "srflx") networkType = networkType || "wifi";
              else if (ctype === "host")  networkType = networkType || "wifi";
            }
          }
        }
      });

      // Try navigator.connection as a better signal when available
      try {
        const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
        if (conn) {
          const ct = (conn.effectiveType || conn.type || "").toLowerCase();
          if (ct.includes("wifi") || ct.includes("ethernet")) networkType = "wifi";
          else if (ct.includes("4g") || ct.includes("3g") || ct.includes("2g") || ct.includes("cellular")) networkType = "cellular";
        }
      } catch { /* unavailable on this browser */ }

      const packetLossRatio = packetsSent > 0 ? packetsLost / packetsSent : null;
      const avgJitter       = jitterCount > 0 ? jitter / jitterCount : null;
      const callQuality     = classifyQuality(packetLossRatio, avgJitter);

      setStats((prev) => ({
        bytesSent:         formatBytes(bytesSent),
        bytesReceived:     formatBytes(bytesReceived),
        networkType:       networkType || prev.networkType,
        callQuality:       callQuality || prev.callQuality,
        reconnectCount:    reconnectCountRef.current,
        interruptionCount: interruptCountRef.current,
      }));
    } catch {
      // getStats() unavailable or call closed — leave existing values
    }
  }, [peerConnection]);

  // Track connection state changes → interruptions & reconnections
  useEffect(() => {
    if (!peerConnection) return;
    const handleStateChange = () => {
      const state = peerConnection.connectionState;
      const prev  = prevStateRef.current;
      if ((state === "disconnected" || state === "failed") && prev === "connected") {
        interruptCountRef.current += 1;
      }
      if (state === "connected" && (prev === "disconnected" || prev === "failed")) {
        reconnectCountRef.current += 1;
      }
      prevStateRef.current = state;
    };
    peerConnection.addEventListener("connectionstatechange", handleStateChange);
    return () => peerConnection.removeEventListener("connectionstatechange", handleStateChange);
  }, [peerConnection]);

  // Poll stats every 5 seconds while live
  useEffect(() => {
    if (!isLive || !peerConnection) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    collectStats(); // immediate first read
    intervalRef.current = setInterval(collectStats, 5000);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isLive, peerConnection, collectStats]);

  return stats;
}

/**
 * Format bytes to human-readable string (e.g. "12.3 MB")
 * Returns "Unavailable" if value is null.
 */
export function formatDataUsage(bytes) {
  if (bytes == null) return "Unavailable";
  if (bytes < 1024)                         return `${bytes} B`;
  if (bytes < 1024 * 1024)                  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)           return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
