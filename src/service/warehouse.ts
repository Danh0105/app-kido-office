import api from "./api";
import type {
  WarehouseItem,
  WarehouseReceipt,
  WarehouseReceiptType,
} from "@/types/warehouse";

const BASE = "/warehouse";

export type CreateWarehouseItemPayload = {
  name: string;
  unit?: string;
  imei?: string;
  initialQuantity?: number;
  note?: string;
};

export type UpdateWarehouseItemPayload = {
  name?: string;
  unit?: string;
  imei?: string;
  note?: string;
};

export type CreateWarehouseReceiptPayload = {
  type: WarehouseReceiptType;
  items: {
    warehouseItemId: number;
    quantity: number;
    serial?: string;
    unitPrice?: number;
    note?: string;
  }[];
  note?: string;
};

export const warehouseApi = {
  listItems: async (): Promise<WarehouseItem[]> => {
    const res = await api.get(`${BASE}/items`);
    return res.data;
  },

  getItem: async (id: number): Promise<WarehouseItem> => {
    const res = await api.get(`${BASE}/items/${id}`);
    return res.data;
  },

  createItem: async (
    data: CreateWarehouseItemPayload,
  ): Promise<WarehouseItem> => {
    const res = await api.post(`${BASE}/items`, data);
    return res.data;
  },

  updateItem: async (
    id: number,
    data: UpdateWarehouseItemPayload,
  ): Promise<WarehouseItem> => {
    const res = await api.patch(`${BASE}/items/${id}`, data);
    return res.data;
  },

  uploadItemImage: async (id: number, image: Blob): Promise<WarehouseItem> => {
    const form = new FormData();
    form.append("image", image, "device.jpg");
    const res = await api.post(`${BASE}/items/${id}/image`, form);
    return res.data;
  },

  listReceipts: async (): Promise<WarehouseReceipt[]> => {
    const res = await api.get(`${BASE}/receipts`);
    return res.data;
  },

  createReceipt: async (
    data: CreateWarehouseReceiptPayload,
  ): Promise<WarehouseReceipt> => {
    const res = await api.post(`${BASE}/receipts`, data);
    return res.data;
  },
};
