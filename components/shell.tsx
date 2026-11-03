"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { post, useApi } from "@/lib/use-api";

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
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const source = useRef<HTMLDivElement>(null);
  const { data, reload } = useApi<{ source: "prepared" | "own"; connected: boolean }>("/api/connect");
  const video = useRef<HTMLVideoElement>(null);
  const home = path === "/";
  const current = (href: string) => path === href || path.startsWith(href + "/") || (href === "/story" && path.startsWith("/buy"));

  useEffect(() => {
    setOpen(false);
    setMenu(false);
    reload();
  }, [path, reload]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => !source.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenu(false);
      }
    };
    const onResize = () => window.innerWidth > 720 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.current?.pause();
      setPaused(true);
    }
  }, []);

  const closeAll = async () => {
    setMenu(false);
    setOpen(false);
    await reload();
    router.push("/story");
  };
  const choose = async (next: "prepared" | "own") => {
    await post("/api/connect", { source: next });
    await closeAll();
  };
  const logOut = async () => {
    await fetch("/api/connect", { method: "DELETE" });
    await closeAll();
  };
  const toggleVideo = () => {
    if (paused) video.current?.play();
    else video.current?.pause();
    setPaused(!paused);
  };
  const own = data?.source === "own";
  const mark = (on: boolean) => <i className={`fa-solid fa-check${on ? "" : " off"}`} aria-hidden="true" />;
  const choices = (
    <>
      <button onClick={() => choose("prepared")} aria-current={!own || undefined}>{mark(!own)} Prepared Data</button>
      {data?.connected ? (
        <>
          <button onClick={() => choose("own")} aria-current={own || undefined}>{mark(own)} My Sandbox</button>
          <button onClick={logOut}>{mark(false)} Log Out of My Sandbox</button>
        </>
      ) : (
        <Link href="/connect">{mark(false)} Log In With PayPal <span className="sbx">Sandbox</span></Link>
      )}
    </>
  );

  return (
    <div className={`app${open ? " menu-open" : ""}${home ? " home" : ""}`}>
      <a className="skip" href="#main">Skip to Content</a>
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
          {!home && (
            <div className="source" ref={source}>
              <button className="sign-in" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                {own ? "Using My Sandbox" : "Using Prepared Data"} <i className="fa-solid fa-chevron-down" aria-hidden="true" />
              </button>
              {menu && <div className="source-menu">{choices}</div>}
            </div>
          )}
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
              {!home && <div className="sheet-source">{choices}</div>}
            </div>
          </>
        )}
        <main id="main" className="main" tabIndex={-1}>{children}</main>
      </div>
      <button className={`video-toggle${path === "/chat" ? " raised" : ""}`} onClick={toggleVideo} aria-label={paused ? "Play Background Video" : "Pause Background Video"}>
        <i className={`fa-solid fa-${paused ? "play" : "pause"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
