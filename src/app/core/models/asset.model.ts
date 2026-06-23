export interface Asset {
  id: string;
  assetId?: string; // optional for backward compatibility with existing static data
  assetTag: string;
  name: string;
  type: AssetType | string;
  category: string;
  subCategory: string;
  status: string; // Changed from AssetStatus to string for dynamic values
  assignedTo?: string;
  assignedToName?: string;
  department?: string;
  team?: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  vendor: string;
  serialNumber: string;
  specifications?: string;
  cost: number;
  condition: AssetCondition;
  notes?: string;
  requestId?: string;
  reminderDays?: number;
  allocatedDate?: string;
  temp3?: string;
  temp5?: string;
  temp6?: string;
  temp7?: string;
}

export enum AssetType {
  HARDWARE = 'Hardware',
  SOFTWARE = 'Software',
  NETWORK = 'Network',
  PERIPHERAL = 'Peripheral',
  FURNITURE = 'Furniture'
}

// Keeping the enum for common internal states but the model now supports arbitrary strings
export enum AssetStatus {
  AVAILABLE = 'Available',
  ALLOCATED = 'Allocated',
  IN_REPAIR = 'In Repair',
  RETIRED = 'Retired',
  RESERVED = 'Reserved'
}

export enum AssetCondition {
  NEW = 'New',
  GOOD = 'Good',
  FAIR = 'Fair',
  POOR = 'Poor',
  DAMAGED = 'Damaged'
}

export interface AssetCategory {
  id: string;
  name: string;
  type: AssetType | string;
  subCategories: string[];
  icon: string;
}
