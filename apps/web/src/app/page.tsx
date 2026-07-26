import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-glass backdrop-blur-xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl font-semibold tracking-tight">AnaChat</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            A privacy-first messaging platform with local-first chat storage, real-time delivery, and cross-platform clients.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/app">Open Web App</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/admin">Admin Panel</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
