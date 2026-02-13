"use client";

import { StoreProvider } from "../context/StoreContext";

export default function Providers({ children }) {
  return <StoreProvider>{children}</StoreProvider>;
}
