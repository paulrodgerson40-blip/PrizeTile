import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PrizeTile — The Engine That Removes the Ceiling",
    template: "%s | PrizeTile",
  },
  description:
    "PrizeTile is a live monthly prize engine built for the next generation of promotional membership.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
