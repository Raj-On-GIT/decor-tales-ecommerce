import "./globals.css";
import Header from "../components/Header";
import { StoreProvider } from '@/context/StoreContext';  // Your existing context
import { AuthProvider } from '@/context/AuthContext';    // New auth context
import { Inter } from 'next/font/google';
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Decor Tales - Home Decor & Frames',
  description: 'Premium home decor and frames for your space',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>
            <StoreProvider>
              <Header />
              <main className="min-h-screen">{children}</main>
            </StoreProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
