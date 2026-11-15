import type { Metadata } from "next";
import { BuildingApp } from "@/components/BuildingApp";

export const metadata: Metadata = { title: "Building Site" };

export default async function BuildingSitePage({ params }: { params: Promise<{ userId: string; areaId: string; buildingId: string }> }) {
  const { userId, areaId, buildingId } = await params;
  return <BuildingApp userId={userId} areaId={areaId} buildingId={buildingId} />;
}
