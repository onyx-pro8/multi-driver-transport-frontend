"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStep } from "@/types";

const steps = [
  { id: 1 as DashboardStep, title: "Convert Locations", subtitle: "Pickup & drop-off to H3" },
  { id: 2 as DashboardStep, title: "Create Driver Zones", subtitle: "Define driver coverage" },
  { id: 3 as DashboardStep, title: "Review & Save", subtitle: "Validate and save zones" },
];

export function StepIndicator({
  activeStep,
  onStepChange,
}: {
  activeStep: DashboardStep;
  onStepChange: (step: DashboardStep) => void;
}) {
  return (
    <div className="px-6 pb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((step, index) => {
          const done = step.id < activeStep;
          const active = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-all",
                active
                  ? "border-primary bg-accent shadow-card"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold",
                    done || active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <span className="sr-only">Step {step.id}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
