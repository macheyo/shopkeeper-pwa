"use client";

import { getPurchasesDB } from "@/lib/databases";
import type { PurchaseDoc } from "@/types";
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import PurchaseDetails from "./PurchaseDetails";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  id: string;
}

async function getPurchaseDetails(id: string): Promise<PurchaseDoc> {
  try {
    const purchasesDB = await getPurchasesDB();

    // First try exact match on purchaseRunId
    let result = await purchasesDB.find({
      selector: {
        purchaseRunId: id,
      },
      limit: 1,
    });

    // If not found, try with the ID as is (might be _id field)
    if (!result.docs || result.docs.length === 0) {
      result = await purchasesDB.find({
        selector: {
          _id: id,
        },
        limit: 1,
      });
    }

    if (!result.docs || result.docs.length === 0) {
      console.error(`Purchase not found with ID: ${id}`);
      throw new Error(`Purchase with ID ${id} not found in database`);
    }

    return result.docs[0] as PurchaseDoc;
  } catch (error) {
    console.error("Error fetching purchase:", error);
    throw error;
  }
}

export default function PurchaseLoader({ id }: Props) {
  const [purchase, setPurchase] = useState<PurchaseDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadPurchase() {
      try {
        const data = await getPurchaseDetails(id);
        setPurchase(data);
      } catch (err) {
        console.error(`Failed to load purchase with ID ${id}:`, err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    loadPurchase();
  }, [id]);

  if (loading) {
    return <LoadingSpinner message="Loading purchase details..." size="md" />;
  }

  if (error || !purchase) {
    notFound();
  }

  return <PurchaseDetails purchase={purchase} />;
}
