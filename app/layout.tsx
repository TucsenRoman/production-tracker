import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Tracker — Milaca Meats",
  description:
    "Smokehouse and Packaging production tracking, inventory, scheduling, and product insights.",
  appleWebApp: {
    capable: true,
    title: "Production",
    statusBarStyle: "default",
  },
};

// viewport-fit=cover is what makes env(safe-area-inset-*) resolve to real values,
// so the fixed bottom tab bar clears the iPhone home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
