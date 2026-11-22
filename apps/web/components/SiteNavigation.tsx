"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type NavigationLink = {
  href: string;
  label: string;
  active: (pathname: string) => boolean;
  className?: string;
};

const primary: NavigationLink[] = [
  { href: "/sesonger", label: "Sesonger", active: (path) => path === "/sesonger" || path.startsWith("/sesong/") },
  { href: "/motstandere", label: "Motstandere", active: (path) => path === "/motstandere" || path.startsWith("/motstander/") },
  { href: "/klubben", label: "Klubben", active: (path) => ["/klubben", "/personer", "/organisasjon", "/hjemmebaner"].some((root) => path === root || path.startsWith(`${root}/`)) },
  { href: "/kilder", label: "Kilder", active: (path) => path === "/kilder" || path.startsWith("/kilder/") },
  { href: "/bidra", label: "Bidra", active: (path) => path === "/bidra", className: "nav-cta" },
];

const project: NavigationLink[] = [
  { href: "/mangler", label: "Hva mangler?", active: (path) => path === "/mangler" || path.startsWith("/mangler/") },
  { href: "/data", label: "Datasettet", active: (path) => path === "/data" },
  { href: "/utviklere", label: "For utviklere", active: (path) => path === "/utviklere" },
  { href: "/om", label: "Om arkivet", active: (path) => path === "/om" },
];

function NavigationLinks({ links, pathname }: { links: NavigationLink[]; pathname: string }) {
  return links.map((link) => (
    <a
      className={link.className}
      href={link.href}
      key={link.href}
      aria-current={link.active(pathname) ? "page" : undefined}
    >
      {link.label}
    </a>
  ));
}

export function PrimaryNavigation() {
  const pathname = usePathname();
  return <nav className="primary-nav" aria-label="Hovedmeny"><NavigationLinks links={primary} pathname={pathname} /></nav>;
}

function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobilmeny">
      <NavigationLinks links={primary} pathname={pathname} />
      <span className="mobile-menu-divider">Prosjektet</span>
      <NavigationLinks links={project} pathname={pathname} />
    </nav>
  );
}

/**
 * Menyen på smale skjermer.
 *
 * `<details>` åpner og lukker seg selv uten skript, og gjør det fortsatt hvis
 * skriptet ikke lastes. Det den ikke gjør, er å lukke seg når leseren trykker
 * Escape eller et sted utenfor — menyen ble liggende over innholdet til man
 * traff knappen igjen. De to tingene legges på her, og bare dem.
 */
export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open) return;
      menu.open = false;
      // Fokus tilbake til knappen, så tastaturbrukeren ikke står igjen inne i
      // en meny som er borte.
      menu.querySelector("summary")?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const menu = ref.current;
      if (!menu?.open || !(event.target instanceof Node) || menu.contains(event.target)) return;
      menu.open = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <details className="mobile-menu" ref={ref}>
      <summary className="header-control" role="button">Meny</summary>
      <MobileNavigation />
    </details>
  );
}
