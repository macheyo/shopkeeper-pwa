import { Metadata } from "next";
import PurchaseLoader from "./PurchaseLoader";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Purchase Details #${id}`,
    description: `View details for purchase ${id}`,
  };
}

export default async function PurchaseDetailsPage({ params }: Props) {
  const { id } = await params;
  return <PurchaseLoader id={id} />;
}
