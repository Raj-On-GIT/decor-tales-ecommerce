import "./globals.css";
import Providers from "../components/Providers";
import Header from "../components/Header";

export const metadata = {
  title: "LuxeFrames Storefront",
  description: "Premium photo frames ecommerce site",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
