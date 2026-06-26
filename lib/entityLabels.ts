export interface EntityLabels {
  lowercase: string;
  capitalized: string;
  indefiniteArticle: "a" | "an";
}

/** User-facing label for orders/shipments across the logistics workflow. */
export function getShipmentEntityLabels(): EntityLabels {
  return {
    lowercase: "shipment",
    capitalized: "Shipment",
    indefiniteArticle: "a",
  };
}

export function shipmentRef(id: number): string {
  return `Shipment #${id}`;
}
