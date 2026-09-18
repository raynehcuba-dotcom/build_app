export interface Database {
  public: {
    Tables: {
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, 'id' | 'created_at'>;
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, 'id' | 'created_at'>;
        Update: Partial<Omit<Sale, 'id' | 'created_at'>>;
      };
      sale_items: {
        Row: SaleItem;
        Insert: Omit<SaleItem, 'id'>;
        Update: Partial<Omit<SaleItem, 'id'>>;
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Omit<StockMovement, 'id' | 'created_at'>;
        Update: Partial<Omit<StockMovement, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithRelations extends Product {
  categories: Category | null;
  suppliers: Supplier | null;
}

export interface Sale {
  id: string;
  sale_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { products: Product })[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockMovementWithProduct extends StockMovement {
  products: Product;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  totalSalesToday: number;
  totalRevenue: number;
  totalSuppliers: number;
  totalCategories: number;
}
