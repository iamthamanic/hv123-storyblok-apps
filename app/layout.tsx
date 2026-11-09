import type { Metadata } from "next";
import "@/styles/seitencheck.css";
import "@/styles/scriptverwaltung.css";
import "@/styles/table-tools.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halteverbot123 Website-Tools",
  description: "Storyblok Space Apps Seiten-Check und Scriptverwaltung",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
