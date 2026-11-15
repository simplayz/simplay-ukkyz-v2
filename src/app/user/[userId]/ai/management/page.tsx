import type { Metadata } from "next";
import { AiManagementApp } from "@/components/AiManagementApp";

export const metadata: Metadata = { title: "AI Management" };

export default async function AiManagementPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <AiManagementApp userId={userId} />;
}
