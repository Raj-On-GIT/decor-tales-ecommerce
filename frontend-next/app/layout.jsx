import "./globals.css";
import Header from "../components/Header";
import { StoreProvider } from "@/context/StoreContext";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { Inter } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Decor Tales - Home Decor & Frames",
  description: "Premium home decor and frames for your space",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        >
          <ToastProvider>
            <AuthProvider>
              <StoreProvider>
                <Header />
                <main className="min-h-screen">{children}</main>
              </StoreProvider>
            </AuthProvider>
          </ToastProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
