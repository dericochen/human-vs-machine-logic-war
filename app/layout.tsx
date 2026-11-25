import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AudioProvider } from "@/components/AudioProvider";

export const metadata: Metadata = {
  title: "HUMAN VS MACHINE: LOGIC WAR",
  description:
    "YOUR BRAIN VS MY ALGORITHM. Face M.A.X. — Machine Algorithm X — in a 5-minute race to spot the different emoji. Who thinks faster?",
  applicationName: "Logic War",
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AudioProvider>{children}</AudioProvider>
      </body>
    </html>
  );
}
