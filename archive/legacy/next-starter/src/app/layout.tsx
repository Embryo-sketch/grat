import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Grat", template: "%s · Grat" },
  description: "Customer profiles and manually reviewed transfer requests.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
