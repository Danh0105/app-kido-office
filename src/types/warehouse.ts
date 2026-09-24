// Types cho module quản lý kho thiết bị (1 kho duy nhất, phòng kỹ thuật quản lý).

export type WarehouseItem = {
  id: number;
  code: string; // TB-xxxx
  name: string;
  unit: string;
  imei?: string | null;
  quantity: number;
  note?: string | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
  updatedAt?: string;
};

export type WarehouseReceiptType = "IN" | "OUT";

export type WarehouseReceiptItem = {
  warehouseItemId: number;
  name: string;
  quantity: number;
  unit?: string | null;
};

export type WarehouseReceipt = {
  id: number;
  code: string; // PNK-YYYYMM-xxxx | PXK-YYYYMM-xxxx
  type: WarehouseReceiptType;
  items: WarehouseReceiptItem[];
  note?: string | null;
  relatedSuggestId?: number | null;
  createdBy?: number;
  creator?: { id: number; name?: string };
  createdAt?: string;
};
