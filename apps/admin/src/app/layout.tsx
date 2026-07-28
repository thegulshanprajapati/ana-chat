import "../styles/globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AnaChat Admin",
  description: "Administration panel for AnaChat"
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950">
        <Sidebar />
        <div className="lg:ml-64 min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
          {children}
        </div>
      </body>
    </html>
  );
}
