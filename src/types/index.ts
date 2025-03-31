import { Money } from "./money";

// Define the structure for a Product document stored in PouchDB
// Explicitly include _id and _rev for clarity, though they come from PouchDB.Core.Document
export interface ProductDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "product";
  code: string; // unique
  name: string;
  price: Money; // Using Money type instead of number
  barcode?: string; // optional
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

// Define the structure for a Sale document stored in PouchDB
// Explicitly include _id and _rev for clarity
export interface SaleDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "sale";
  productId: string; // Corresponds to ProductDoc._id
  qty: number;
  price: Money; // Price at the time of sale using Money type
  total: Money; // Total using Money type
  cashReceived?: Money; // Optional for non-cash or later payment
  change?: Money; // Optional
  timestamp: string; // ISO 8601 format
  status: "pending" | "synced" | "failed"; // Sync status
}
