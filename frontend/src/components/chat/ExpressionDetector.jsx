/**
 * ExpressionDetector
 * ───────────────────
 * Opt-in, local-only facial expression detector.
 *
 * ⚠️  Privacy guarantees:
 *   - Raw video frames are NEVER sent to any server
 *   - face-api.js models run entirely in the browser
 *   - Detection runs at most every 3 seconds
 *   - Detects expressions (happy, sad, etc.) — NOT identity
 *   - Models are loaded lazily only when user explicitly opts in
 *   - All processing stops and refs are cleared on unmount
 *
 * Props
 * ─────
 * videoRef       React ref pointing to the local <video> element
 * enabled        boolean  — user must opt in (default false)
 * onExpression   (expressionType: string) => void
 */
import { useCallback, useEffect, useRef, useState } from "react";

const MODEL_URL    = "/models"; // place face-api.js models in /public/models/
const POLL_MS      = 3000;
const MIN_CONF     = 0.65;

export default function ExpressionDetector({ videoRef, enabled, onExpression }) {
  const [status, setStatus]   = useState("idle"); // idle | loading | ready | error | unsupported
  const apiRef                = useRef(null);
  const intervalRef           = useRef(null);
  const mountedRef            = useRef(true);

  const loadModels = useCallback(async () => {
    setStatus("loading");
    try {
      // Safely load face-api.js at runtime without breaking Rollup build if uninstalled
      let faceApi = window.faceapi;
      if (!faceApi) {
        const pkgName = "face-api.js";
        faceApi = await import(/* @vite-ignore */ pkgName);
      }
      apiRef.current = faceApi;
      await Promise.all([
        faceApi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceApi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      if (mountedRef.current) setStatus("ready");
    } catch (err) {
      console.warn("[ExpressionDetector] face-api.js unavailable or models missing:", err?.message || err);
      if (mountedRef.current) setStatus("error");
    }
  }, []);

  const runDetection = useCallback(async () => {
    if (!apiRef.current || !videoRef?.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused) return;

    try {
      const faceApi = apiRef.current;
      const options = typeof faceApi.TinyFaceDetectorOptions === "function"
        ? new faceApi.TinyFaceDetectorOptions()
        : undefined;
      const result  = await faceApi.detectSingleFace(
        video,
        options
      ).withFaceExpressions();

      if (!result?.expressions) return;

      const exps   = result.expressions;
      const sorted = Object.entries(exps).sort((a, b) => b[1] - a[1]);
      const top    = sorted[0];
      if (!top || top[1] < MIN_CONF) return;

      const [rawExpr] = top;
      // Normalize face-api expression names to our engine keys
      const normalize = {
        happy:     "happy",
        angry:     "angry",
        sad:       "sad",
        surprised: "surprised",
        disgusted: "angry",
        fearful:   "sad",
        neutral:   "neutral",
        laughing:  "laughing",
      };
      const normalized = normalize[rawExpr] || rawExpr;
      if (mountedRef.current && normalized !== "neutral") {
        onExpression?.(normalized);
      }
    } catch {
      // Ignore individual frame errors
    }
  }, [videoRef, onExpression]);

  // Load when enabled for first time
  useEffect(() => {
    if (!enabled) return;
    if (status === "idle") loadModels();
  }, [enabled, status, loadModels]);

  // Start / stop polling
  useEffect(() => {
    if (!enabled || status !== "ready") {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(runDetection, POLL_MS);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [enabled, status, runDetection]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, []);

  // Non-rendering component — only shows a tiny indicator if there's an error
  if (status === "error") {
    return (
      <div
        title="Expression detection unavailable"
        className="absolute bottom-16 right-3 z-30 text-[10px] text-rose-400/60 pointer-events-none"
        aria-hidden="true"
      >
        expr error
      </div>
    );
  }

  return null; // renders nothing when working normally
}
