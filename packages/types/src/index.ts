export type UserRole = "customer" | "merchant" | "admin" | "super_admin";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceNgn: number;
  stock: number;
  categoryId: string;
  merchantId?: string;
  isApproved: boolean;
}
