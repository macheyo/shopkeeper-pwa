import { getPurchasesDB } from "@/lib/databases";
import type { PurchaseDoc } from "@/types";
import PurchaseDetails from "./PurchaseDetails";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";
import { Loader, Stack, Text } from "@mantine/core";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const purchasesDB = await getPurchasesDB();
    const { id } = await params;
    const result = await purchasesDB.find({
      selector: {
        purchaseRunId: id,
      },
      fields: ["purchaseRunId", "timestamp"],
    });

    if (!result.docs || result.docs.length === 0) {
      return {
        title: "Purchase Not Found",
      };
    }

    const purchase = result.docs[0] as unknown as Pick<
      PurchaseDoc,
      "purchaseRunId" | "timestamp"
    >;
    const date = new Date(purchase.timestamp).toLocaleDateString();
    const purchaseNumber = purchase.purchaseRunId.split("_")[1];

    return {
      title: `Purchase #${purchaseNumber} - ${date}`,
      description: `Purchase details for run #${purchaseNumber} made on ${date}`,
    };
  } catch {
    return {
      title: "Purchase Details",
    };
  }
}

async function getPurchaseDetails(id: string): Promise<PurchaseDoc> {
  try {
    const purchasesDB = await getPurchasesDB();
    const result = await purchasesDB.find({
      selector: {
        purchaseRunId: id,
      },
    });

    if (!result.docs || result.docs.length === 0) {
      throw new Error("Purchase not found");
    }

    return result.docs[0] as PurchaseDoc;
  } catch (error) {
    console.error("Error fetching purchase:", error);
    throw error;
  }
}

function LoadingState() {
  return (
    <Stack align="center" justify="center" h="100vh" gap="md">
      <Loader size="xl" />
      <Text size="lg">Loading purchase details...</Text>
    </Stack>
  );
}

export default async function PurchaseDetailsPage({ params }: Props) {
  try {
    const { id } = await params;
    const purchase = await getPurchaseDetails(id);

    return (
      <Suspense fallback={<LoadingState />}>
        <PurchaseDetails purchase={purchase} />
      </Suspense>
    );
  } catch {
    notFound();
  }
}
