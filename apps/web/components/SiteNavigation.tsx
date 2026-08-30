"use client";

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

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobilmeny">
      <NavigationLinks links={primary} pathname={pathname} />
      <span className="mobile-menu-divider">Prosjektet</span>
      <NavigationLinks links={project} pathname={pathname} />
    </nav>
  );
}
