// Define the structure for a Product document stored in PouchDB
// Explicitly include _id and _rev for clarity, though they come from PouchDB.Core.Document
export interface ProductDoc extends PouchDB.Core.Document<object> {
  _id: string;
  _rev: string;
  type: "product";
  code: string; // unique
  name: string;
  price: number;
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
  price: number; // Price at the time of sale
  total: number;
  cashReceived?: number; // Optional for non-cash or later payment
  change?: number; // Optional
  timestamp: string; // ISO 8601 format
  status: "pending" | "synced" | "failed"; // Sync status
}
