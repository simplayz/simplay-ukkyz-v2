import type { Metadata } from "next";
import { AreaApp } from "@/components/AreaApp";

export const metadata: Metadata = { title: "Player Area" };

export default async function PlayerAreaPage({ params }: { params: Promise<{ userId: string; areaId: string }> }) {
  const { userId, areaId } = await params;
  return <AreaApp userId={userId} areaId={areaId} />;
}
