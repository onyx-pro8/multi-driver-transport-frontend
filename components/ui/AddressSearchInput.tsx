"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PlaceResult,
  placeCategoryLabel,
  placeShortLabel,
  searchPlaces,
} from "@/lib/places";

export interface SelectedPlace {
  label: string;
  lat: number;
  lng: number;
  display_name: string;
  category: string;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onPick: (place: SelectedPlace) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  /** Optional disabled state (e.g. while saving). */
  disabled?: boolean;
}

/**
 * Address search that resolves to a precise POI (shop, cafe, building, etc.)
 * via OpenStreetMap Nominatim. Selecting a result auto-fills lat / lng on
 * the parent through `onPick`.
 */
export function AddressSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Search by name or address (e.g. 'Starbucks Soho')",
  id,
  required,
  disabled,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Suppress re-querying immediately after the user picks a result (we
  // intentionally write its full label into the input).
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const data = await searchPlaces(q, controller.signal);
        setResults(data);
        setOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as { name?: string } | null)?.name !== "AbortError") {
          setResults([]);
        }
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    }, 320);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectResult(result: PlaceResult) {
    const label = result.display_name;
    skipNextSearch.current = true;
    onChange(label);
    onPick({
      label,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      display_name: result.display_name,
      category: placeCategoryLabel(result),
    });
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center text-muted-foreground"
        >
          <Search className="h-4 w-4" />
        </span>
        <Input
          id={inputId}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {loading && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-[1100] mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-card-lg">
          <ul role="listbox" aria-labelledby={inputId} className="py-1">
            {results.map((r, idx) => {
              const short = placeShortLabel(r);
              const category = placeCategoryLabel(r);
              return (
                <li key={`${r.place_id}-${idx}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectResult(r)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors",
                      activeIndex === idx ? "bg-muted" : "hover:bg-muted"
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MapPin className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium truncate">{short}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground capitalize">
                          {category}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {r.display_name}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
            Results © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
}
