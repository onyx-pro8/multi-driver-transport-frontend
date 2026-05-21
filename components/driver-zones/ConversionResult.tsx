"use client";

import { CheckCircle2, Copy, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText } from "@/lib/utils";
import type { ConvertH3Response } from "@/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm font-mono break-all">{value}</code>
        <Button type="button" variant="ghost" size="sm" onClick={handleCopy} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {copied && <p className="text-xs text-success mt-1">Copied</p>}
    </div>
  );
}

export function ConversionResult({
  result,
  error,
}: {
  result: ConvertH3Response | null;
  error: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Conversion Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !error && (
          <p className="text-sm text-muted-foreground">
            Convert pickup and drop-off coordinates to see H3 cell IDs here.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <>
            <CopyField label="Pickup H3 Cell" value={result.pickup_h3} />
            <CopyField label="Drop-off H3 Cell" value={result.dropoff_h3} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Resolution</p>
                <p className="font-semibold">{result.resolution}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Cell Type</p>
                <p className="font-semibold">{result.cell_type}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Conversion Successful — Locations have been converted to H3 cells.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
