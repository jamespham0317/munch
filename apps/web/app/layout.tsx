import "./globals.css";

import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "./providers";

/**
 * Quicksand is the brand typeface (design-system.md §5). Loaded with the three
 * weights the type scale uses (500 body, 600 titles, 700 headings) and exposed
 * as a CSS variable so globals.css can map it onto --font-sans.
 */
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Munch",
  description:
    "Swipe through nearby restaurants with friends until everyone likes the same place.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
