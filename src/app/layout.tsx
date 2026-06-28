import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Novel Agent",
  description: "Single-player agent-driven text role-play"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
