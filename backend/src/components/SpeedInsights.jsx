import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function SpeedInsightsInjector() {
  const [route, setRoute] = useState(() => {
    return typeof window !== "undefined" ? window.location.pathname : null;
  });

  useEffect(() => {
    const updateRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", updateRoute);

    return () => {
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  if (!route) return null;

  return (
    <SpeedInsights
      route={route}
      debug={import.meta.env.DEV}
      sampleRate={1}
    />
  );
}
