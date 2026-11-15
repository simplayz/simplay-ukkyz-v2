import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : "The request could not be completed";
  const safeStatus = message.includes("not found") || message.includes("not hold") ? 404 : status;
  return NextResponse.json({ error: message }, { status: safeStatus });
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A JSON object is required");
  return value as Record<string, unknown>;
}

export function requiredString(value: unknown, label: string, max = 80): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim().slice(0, max);
}

export function finiteNumber(value: unknown, label: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`);
  return number;
}

export function validLocation(latValue: unknown, lonValue: unknown): { lat: number; lon: number } {
  const lat = finiteNumber(latValue, "Latitude");
  const lon = finiteNumber(lonValue, "Longitude");
  if (lat < -85 || lat > 85 || lon < -180 || lon > 180) throw new Error("Location is outside the supported world bounds");
  return { lat, lon };
}
