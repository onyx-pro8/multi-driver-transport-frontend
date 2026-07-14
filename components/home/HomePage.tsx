"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Globe2,
  Hexagon,
  MapPin,
  Network,
  Plane,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { PublicNav } from "./PublicNav";
import { ThemedImage } from "./ThemedImage";
import { LiveRouteDashboard } from "./LiveRouteDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const featurePills = [
  { icon: Hexagon, label: "H3 Routing" },
  { icon: Plane, label: "Air • Land • Sea" },
  { icon: ArrowLeftRight, label: "Smart Transfers" },
  { icon: MapPin, label: "Real-time Tracking" },
];

const stats = [
  {
    icon: Globe2,
    value: "150+",
    label: "Countries Covered",
    iconWrap: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Users,
    value: "25+",
    label: "Route Options Per Order",
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Truck,
    value: "10K+",
    label: "Active Transporters",
    iconWrap: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: ShieldCheck,
    value: "99.8%",
    label: "Successful Deliveries",
    iconWrap: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
];

const steps = [
  {
    step: "1",
    icon: ClipboardList,
    title: "Create Order",
    text: "Add pickup, drop-off, and package details in seconds.",
  },
  {
    step: "2",
    icon: Network,
    title: "Smart Routing",
    text: "H3 matching finds multi-mode paths across the network.",
  },
  {
    step: "3",
    icon: UserRound,
    title: "Confirm Route",
    text: "Compare time, cost, and transfers — then lock it in.",
  },
  {
    step: "4",
    icon: Truck,
    title: "In Transit",
    text: "Track live handoffs between drivers, hubs, and ports.",
  },
  {
    step: "5",
    icon: CheckCircle2,
    title: "Delivered",
    text: "Receiver confirms arrival and trust signals update.",
  },
];

const audiences = [
  {
    title: "For Drivers",
    description:
      "Define coverage zones, set your rates, and earn on routes that match your mode and schedule.",
    lightSrc: "/home-drivers.png",
    darkSrc: "/home-drivers-dark.png",
    href: "/register",
  },
  {
    title: "For Senders",
    description:
      "Ship packages anywhere. Compare smart routes across air, land, and sea in one checkout.",
    lightSrc: "/home-senders.png",
    darkSrc: "/home-senders-dark.png",
    href: "/register",
  },
  {
    title: "For Receivers",
    description:
      "Follow inbound shipments in real time and confirm delivery the moment they arrive.",
    lightSrc: "/home-receivers.png",
    darkSrc: "/home-receivers-dark.png",
    href: "/register",
  },
];

const footerLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "Pricing" },
  { href: "#about", label: "About" },
  { href: "/login", label: "Help Center" },
  { href: "/register", label: "Contact" },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero — page-colored surface + right-side illustration (no black plate) */}
      <section className="relative overflow-hidden min-h-[560px] sm:min-h-[620px] lg:min-h-[660px] bg-background">
        {/* Textured map surface (CSS) — replaces flat black image fill */}
        {/* <div
          className="absolute inset-0 hero-dot-map opacity-70 dark:opacity-90"
          aria-hidden
        /> */}
        {/* <div
          className="absolute inset-0 bg-gradient-to-br from-background via-background to-indigo-50/40 dark:from-background dark:via-[#070a12] dark:to-[#0c1224]"
          aria-hidden
        /> */}

        {/* Illustration sits on the right only, faded into page bg on the left */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-full"
          aria-hidden
        >
          <ThemedImage
            lightSrc="/home-hero.png"
            darkSrc="/home-hero-dark.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 100vw, 100vw"
            className="object-contain object-right-top h-full w-full"
            priority
          />
          <div className="absolute left-[35%] inset-0 bg-gradient-to-r w-[40%] from-background via-background/70 to-[transparent]" />
          {/* Soft bottom blend into feature section */}
          <div className="absolute top-[50%] inset-0 bg-gradient-to-t h-[50%] from-background via-background/10 to-[transparent]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-20 lg:pt-24 lg:pb-28">
          <div className="max-w-xl animate-fade-in-up">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/90 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-violet-700 mb-6 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
              <span aria-hidden>🚀</span>
              H3-Powered Multi-Transport Logistics
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-bold tracking-tight leading-[1.1]">
              Smarter routes.
              <br />
              More connections.
              <br />
              <span className="text-gradient-brand">Delivered anywhere.</span>
            </h1>
            <p className="mt-5 text-[15px] sm:text-base text-muted-foreground max-w-md leading-relaxed">
              Plan multi-driver routes across land, air, and sea on one
              H3-powered network — smarter connections, clearer handoffs,
              delivered anywhere.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 px-6 rounded-xl bg-gradient-brand text-white border-0 shadow-card-lg hover:opacity-95 text-sm"
                >
                  Ship a Package
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 rounded-xl text-sm bg-card/80 backdrop-blur-sm dark:bg-white/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Become a Driver
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bar + stats */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-16 -mt-6 sm:-mt-8"
      >
        <div className="rounded-2xl border border-border/80 bg-card/80 dark:bg-white/[0.04] dark:border-white/10 backdrop-blur-md shadow-card px-2 py-3 sm:px-2 sm:py-3.5 mb-5">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {featurePills.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 sm:px-5",
                    i > 0 &&
                      "lg:border-l border-border/70 dark:border-white/10",
                    i === 2 &&
                      "border-t lg:border-t-0 border-border/70 dark:border-white/10",
                    i === 3 &&
                      "border-t lg:border-t-0 border-border/70 dark:border-white/10",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Card className="rounded-2xl shadow-card-lg dark:bg-white/[0.04] dark:border-white/10 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-2">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex items-center gap-3.5 px-2 py-1.5",
                      i > 0 &&
                        "lg:border-l border-border/60 dark:border-white/10 lg:pl-5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                        stat.iconWrap,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xl font-bold tracking-tight leading-none">
                        {stat.value}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-y border-border bg-muted/35 dark:bg-muted/20"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="text-center max-w-xl mx-auto mb-12 lg:mb-14">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              From creating an order to confirming delivery — five clear steps
              on one multi-driver network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="relative text-center px-2">
                  {i < steps.length - 1 && (
                    <div
                      className="hidden lg:block absolute top-[34px] left-[calc(50%+36px)] right-[-36px] h-0 border-t-2 border-dashed border-primary/35"
                      aria-hidden
                    />
                  )}
                  <div className="relative mx-auto mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-full border border-border bg-card shadow-card">
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[15px]">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {s.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live dashboard — coded UI matching design */}
      {/* <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <LiveRouteDashboard />
      </section> */}

      {/* Audience segments */}
      <section
        id="for-drivers"
        className="border-y border-border border-t-0 bg-muted/30 dark:bg-muted/15"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {audiences.map((item) => (
              <Card
                key={item.title}
                className="overflow-hidden rounded-2xl hover:shadow-card-lg transition-shadow"
              >
                <CardContent className="flex items-stretch p-0 min-h-[168px]">
                  <div className="relative w-[44%] shrink-0 self-stretch overflow-hidden bg-muted/40 dark:bg-white/[0.04]">
                    <ThemedImage
                      lightSrc={item.lightSrc}
                      darkSrc={item.darkSrc}
                      alt={item.title}
                      fill
                      sizes="(min-width: 768px) 200px, 45vw"
                      className="object-cover object-center"
                    />
                    {/* Soft blend from image into card text background */}
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-r from-transparent via-card/55 to-card"
                      aria-hidden
                    />
                  </div>
                  <div className="relative z-[1] -ml-3 flex flex-1 flex-col justify-center bg-card py-5 pl-4 pr-5 sm:py-6 sm:pl-5 sm:pr-6">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                    <Link
                      href={item.href}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-80"
                    >
                      Learn more
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="about" className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="relative overflow-hidden rounded-[1.75rem] min-h-[280px] flex items-center">
          <Image
            src="/home-cta.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 1100px, 100vw"
            className="object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-[#0b0e14]/78" />
          <div className="relative w-full px-8 py-16 sm:px-14 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to move your world?
            </h2>
            <p className="mt-3 text-white/70 max-w-md mx-auto">
              Create a free account and start shipping — or talk with sales
              about fleet onboarding.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 px-6 rounded-xl shadow-card-lg"
                >
                  Create Free Account
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="lg"
                  className="h-12 px-6 rounded-xl bg-white text-[#0b0e14] hover:bg-white/90"
                >
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 bg-muted/40 dark:bg-muted/25">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:py-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 shrink-0">
              <Image
                src="/logo.png"
                alt="Multi-Driver Transport"
                width={32}
                height={32}
                className="rounded-lg mt-0.5"
              />
              <div>
                <Link
                  href="/"
                  className="text-sm font-semibold text-foreground hover:opacity-80"
                >
                  Multi-Driver Transport
                </Link>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  &copy; {new Date().getFullYear()} Multi-Driver Transport. All
                  rights reserved.
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground lg:justify-center">
              {footerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2.5 shrink-0 lg:justify-end">
              {[
                {
                  label: "Facebook",
                  path: "M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.01 3.66 9.16 8.44 9.93v-7.02H7.9v-2.91h2.4V9.85c0-2.37 1.41-3.68 3.57-3.68 1.03 0 2.11.18 2.11.18v2.32h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.77 8.44-4.92 8.44-9.93z",
                },
                {
                  label: "LinkedIn",
                  path: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.56V9h3.55v11.45z",
                },
                {
                  label: "Twitter",
                  path: "M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 0 0 1.88-2.38 8.59 8.59 0 0 1-2.72 1.04A4.28 4.28 0 0 0 11.1 8.03c0 .34.04.67.11.98A12.15 12.15 0 0 1 3.15 5.16a4.28 4.28 0 0 0 1.32 5.71 4.25 4.25 0 0 1-1.94-.54v.05a4.28 4.28 0 0 0 3.43 4.19 4.3 4.3 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.97A8.6 8.6 0 0 1 2 18.41a12.13 12.13 0 0 0 6.56 1.92c7.88 0 12.2-6.53 12.2-12.2v-.56A8.7 8.7 0 0 0 22.46 6z",
                },
                {
                  label: "YouTube",
                  path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.57V8.43L15.82 12l-6.07 3.57z",
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/15 hover:text-blue-700 dark:bg-blue-400/15 dark:text-blue-400 dark:hover:bg-blue-400/25 dark:hover:text-blue-300 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden
                  >
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
