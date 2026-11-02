"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { post } from "@/lib/use-api";

const NAV = [
  { label: "Story", href: "/story" },
  { label: "Memory", href: "/memory" },
  { label: "Chat", href: "/chat" },
  { label: "About", href: "/about" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const home = path === "/";
  const current = (href: string) => path === href || path.startsWith(href + "/") || (href === "/story" && path.startsWith("/buy"));

  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 720 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) video.current?.pause();
  }, []);

  const reset = async () => {
    await post("/api/reset");
    setOpen(false);
    router.push("/");
  };

  return (
    <div className={`app${open ? " menu-open" : ""}${home ? " home" : ""}`}>
      <div className="bg">
        <video ref={video} className="bg-video" autoPlay muted loop playsInline aria-hidden="true">
          <source src="/assets/bg.mp4" type="video/mp4" />
        </video>
        <div className={`fade${home ? "" : " dim"}`} />
      </div>
      <div className="page">
        <header className="header">
          <Link className="logo" href="/" aria-label="Soul home">
            <img className="logo-mark" src="/assets/logo.webp" alt="" width={52} height={52} />
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={current(n.href) ? "active" : ""} aria-current={current(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button className="sign-in" onClick={reset} title="Start the demo over">
            Reset demo
          </button>
          <button className="burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            <span />
            <span />
            <span />
          </button>
        </header>
        {open && (
          <>
            <div className="overlay" onClick={() => setOpen(false)} />
            <div className="sheet-menu">
              {NAV.map((n, i) => (
                <Link key={n.href} href={n.href} className={current(n.href) ? "active" : ""} style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
                  {n.label}
                </Link>
              ))}
              <button className="sheet-sign" onClick={reset} style={{ animationDelay: "0.25s" }}>
                Reset demo
              </button>
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
