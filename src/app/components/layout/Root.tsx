import { Outlet, ScrollRestoration, useLocation } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import CookieConsent from "./CookieConsent";
import OctopusPets from "../../features/octopus/OctopusPets";
import NeuralBackground from "./NeuralBackground";

export default function Root() {
  const home = useLocation().pathname === "/";
  return (
    <div className={`site-shell ${home ? "site-shell--home" : ""} min-h-screen flex flex-col bg-background`} style={{ fontFamily: "var(--font-body)" }}>
      <Header />
      <main className="site-main flex-1">
        <NeuralBackground contours={home} />
        <div className="site-page-content"><Outlet /></div>
      </main>
      <Footer />
      <CookieConsent />
      <OctopusPets />
      <ScrollRestoration />
    </div>
  );
}
