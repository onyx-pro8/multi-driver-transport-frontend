"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Inbox,
  MapPin,
  Plane,
  Send,
  Ship,
  Truck,
} from "lucide-react";
import { PublicNav } from "./PublicNav";
import { ThemedImage } from "./ThemedImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Truck,
    title: "Drivers",
    description:
      "Register with phone, company, and transport mode. Define zones with H3 cells or geofences, set rates, availability, and payment-forwarder trust.",
  },
  {
    icon: Send,
    title: "Senders",
    description:
      "Browse receivers and create orders. Pick a destination receiver and their location & phone fill in automatically.",
  },
  {
    icon: Inbox,
    title: "Receivers",
    description:
      "Get notified of incoming orders and confirm delivery when the package arrives.",
  },
];

const steps = [
  {
    step: "01",
    title: "Driver defines zones",
    text: "Each driver creates one or more zones with H3 cells / geofence, rate, transport mode, and availability.",
  },
  {
    step: "02",
    title: "Sender submits an order",
    text: "Sender selects a receiver — phone and destination address are pre-filled — and submits the order.",
  },
  {
    step: "03",
    title: "Status flow: submitted → delivering → received",
    text: "Sender marks delivering; receiver confirms received. Trustworthiness grows as followers add up.",
  },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent to-background animate-gradient-shift" />
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 h-56 w-56 rounded-full bg-primary/10 blur-2xl animate-float-delayed" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
                <Boxes className="h-3.5 w-3.5" />
                H3-powered multi-driver logistics
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance leading-[1.1]">
                One platform for{" "}
                <span className="text-primary">drivers, senders &amp; receivers</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-lg text-balance">
                Drivers define H3-powered coverage zones with their own rates, transport mode, and
                availability. Senders create orders to receivers and watch deliveries move through
                submitted → delivering → received.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button size="lg" className="shadow-card-lg">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    Sign in
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Plane className="h-4 w-4 text-primary" /> Air
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" /> Land
                </span>
                <span className="flex items-center gap-1.5">
                  <Ship className="h-4 w-4 text-primary" /> Sea
                </span>
              </div>
            </div>

            <div className="relative animate-fade-in-up [animation-delay:150ms]">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 to-transparent blur-2xl" />
              <ThemedImage
                lightSrc="/home-hero.png"
                darkSrc="/home-hero-dark.png"
                alt="H3 driver zones and multi-mode transport routes on a world map"
                width={1200}
                height={675}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="relative rounded-2xl border border-border shadow-card-lg w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fade-in-up">
          <h2 className="text-3xl font-bold tracking-tight">Three roles, one workflow</h2>
          <p className="mt-3 text-muted-foreground">
            Pick the role that fits — driver, sender, or receiver — and start moving packages.
          </p>
        </div>

        <div className="mb-12 rounded-2xl overflow-hidden border border-border shadow-card animate-fade-in-up [animation-delay:100ms]">
          <ThemedImage
            lightSrc="/home-features.png"
            darkSrc="/home-features-dark.png"
            alt="Driver zones, transfer areas, and multi-mode transport"
            width={1200}
            height={400}
            sizes="(min-width: 1024px) 1100px, 100vw"
            loading="lazy"
            className="w-full h-auto"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.title}
                className="animate-fade-in-up hover:shadow-card-lg transition-shadow"
                style={{ animationDelay: `${150 + i * 80}ms` }}
              >
                <CardContent className="p-6">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              From defining coverage to confirming delivery — every step has a clear owner.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div
                key={s.step}
                className="relative animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="text-5xl font-bold text-primary/15">{s.step}</span>
                <h3 className="text-lg font-semibold mt-2">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent animate-fade-in-up">
          <CardContent className="p-10 sm:p-14 text-center">
            <MapPin className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to join — as a driver, sender, or receiver?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Create an account in seconds. Pick your role and start moving orders from pickup to
              delivery.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register">
                <Button size="lg">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Multi-Driver Transport. H3 zone management platform.</p>
      </footer>
    </div>
  );
}
