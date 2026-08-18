import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CRM Probel",
  description: "CRM de WhatsApp da Probel",
  // Permite "adicionar à tela de início" no celular com cara de app.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CRM Probel" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // cover: deixa o app desenhar sob o notch/barra inferior; o padding de área
  // segura fica por conta dos componentes (barra inferior, menus).
  viewportFit: "cover",
  themeColor: "#0b141a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
