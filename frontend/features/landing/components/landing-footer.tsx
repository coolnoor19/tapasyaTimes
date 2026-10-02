import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/ui/logo";
import { siteConfig } from "@/config/site";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "#how-it-works", label: "How it works" },
      { href: "#seats", label: "Seats & prices" },
      { href: "#hours", label: "Hours" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create an account" },
      { href: "/verify-email", label: "Verify your email" },
    ],
  },
];

export function LandingFooter() {
  const showDesign = process.env.NODE_ENV !== "production" || process.env.ENABLE_DESIGN_PAGE === "1";

  return (
    <footer className="border-t border-line bg-surface">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">{siteConfig.tagline}</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-ink">{column.title}</h2>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("#") ? (
                    <a href={link.href} className="text-[0.9375rem] text-muted transition-colors hover:text-brand-700">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-[0.9375rem] text-muted transition-colors hover:text-brand-700">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-[0.8125rem] text-subtle sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          {showDesign && (
            <Link href="/design" className="hover:text-brand-700">
              Style guide
            </Link>
          )}
        </Container>
      </div>
    </footer>
  );
}
