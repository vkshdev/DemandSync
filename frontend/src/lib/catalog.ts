import { StoreInfo, SKUInfo } from '@/types/api';

export const STORES: StoreInfo[] = [
  { store_id: 'STORE-001', name: 'Chicago Downtown', region: 'Midwest', type: 'Urban Flagship', size_sqft: 45000 },
  { store_id: 'STORE-002', name: 'Dallas Metro', region: 'South', type: 'Suburban Supercenter', size_sqft: 65000 },
  { store_id: 'STORE-003', name: 'New York Manhattan', region: 'Northeast', type: 'Metro Express', size_sqft: 25000 },
  { store_id: 'STORE-004', name: 'Denver Foothills', region: 'West', type: 'Neighborhood Center', size_sqft: 35000 },
  { store_id: 'STORE-005', name: 'Miami Coastal', region: 'Southeast', type: 'Coastal Boutique', size_sqft: 20000 },
];

export const SKUS: SKUInfo[] = [
  { sku_id: 'SKU-001', name: 'Winter Thermal Parka', department: 'Apparel', category: 'Outerwear', base_price: 120.00, unit_cost: 55.00, lead_time_days: 7, min_order_qty: 10 },
  { sku_id: 'SKU-002', name: 'Lightweight Running Tee', department: 'Apparel', category: 'Activewear', base_price: 32.00, unit_cost: 12.00, lead_time_days: 5, min_order_qty: 20 },
  { sku_id: 'SKU-003', name: 'Waterproof Rain Jacket', department: 'Apparel', category: 'Outerwear', base_price: 85.00, unit_cost: 38.00, lead_time_days: 6, min_order_qty: 15 },
  { sku_id: 'SKU-004', name: 'Organic Whole Milk 1 Gal', department: 'Grocery', category: 'Dairy', base_price: 4.80, unit_cost: 2.60, lead_time_days: 2, min_order_qty: 50 },
  { sku_id: 'SKU-005', name: 'Cold Brew Coffee 32oz', department: 'Grocery', category: 'Beverages', base_price: 6.50, unit_cost: 3.10, lead_time_days: 3, min_order_qty: 30 },
  { sku_id: 'SKU-006', name: 'Artisanal Sourdough Bread', department: 'Grocery', category: 'Bakery', base_price: 5.50, unit_cost: 2.10, lead_time_days: 1, min_order_qty: 40 },
  { sku_id: 'SKU-007', name: 'Organic Hass Avocados 4pk', department: 'Grocery', category: 'Produce', base_price: 5.99, unit_cost: 3.00, lead_time_days: 2, min_order_qty: 25 },
  { sku_id: 'SKU-008', name: 'Fresh Strawberries 1 lb', department: 'Grocery', category: 'Produce', base_price: 4.25, unit_cost: 2.20, lead_time_days: 2, min_order_qty: 30 },
  { sku_id: 'SKU-009', name: 'ANC Wireless Headphones', department: 'Electronics', category: 'Audio', base_price: 149.00, unit_cost: 75.00, lead_time_days: 14, min_order_qty: 5 },
  { sku_id: 'SKU-010', name: 'Smart LED Ambient Bulb', department: 'Home', category: 'Lighting', base_price: 18.50, unit_cost: 8.00, lead_time_days: 10, min_order_qty: 15 },
  { sku_id: 'SKU-011', name: 'Extra Virgin Olive Oil 750ml', department: 'Grocery', category: 'Pantry', base_price: 14.50, unit_cost: 7.50, lead_time_days: 7, min_order_qty: 10 },
  { sku_id: 'SKU-012', name: 'Merino Wool Sweater', department: 'Apparel', category: 'Knitwear', base_price: 95.00, unit_cost: 42.00, lead_time_days: 8, min_order_qty: 10 },
  { sku_id: 'SKU-013', name: 'Electrolyte Hydration 12pk', department: 'Grocery', category: 'Sports Nutrition', base_price: 16.00, unit_cost: 7.00, lead_time_days: 5, min_order_qty: 20 },
  { sku_id: 'SKU-014', name: 'Ceramic Space Heater', department: 'Home', category: 'Appliance', base_price: 45.00, unit_cost: 22.00, lead_time_days: 12, min_order_qty: 8 },
  { sku_id: 'SKU-015', name: 'Insulated Travel Tumbler', department: 'Home', category: 'Kitchen', base_price: 28.00, unit_cost: 11.00, lead_time_days: 6, min_order_qty: 15 },
];

export function getStoreById(storeId: string): StoreInfo {
  return STORES.find((s) => s.store_id === storeId) || STORES[0];
}

export function getSkuById(skuId: string): SKUInfo {
  return SKUS.find((s) => s.sku_id === skuId) || SKUS[0];
}
