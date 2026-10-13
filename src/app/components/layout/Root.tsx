import { Outlet, ScrollRestoration } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import CookieConsent from "./CookieConsent";
import OctopusPets from "../../features/octopus/OctopusPets";

export default function Root() {
  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieConsent />
      <OctopusPets />
      <ScrollRestoration />
    </div>
  );
}
