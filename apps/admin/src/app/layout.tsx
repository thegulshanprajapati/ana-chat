import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AnaChat Admin",
  description: "Administration panel for AnaChat"
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
