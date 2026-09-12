import type { ReactNode } from "react";

export const metadata = { title: "BridgeHub", description: "SEC company profiles through MCP." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
