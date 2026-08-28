import { Schema, models, model } from "mongoose";

export interface IErpSkuMapping {
  erpItemId: string;
  websiteSku: string;
  createdAt: Date;
  updatedAt: Date;
}

const ErpSkuMappingSchema = new Schema<IErpSkuMapping>(
  {
    erpItemId: { type: String, required: true, unique: true, trim: true },
    websiteSku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  },
  { timestamps: true }
);

export default models.ErpSkuMapping || model<IErpSkuMapping>("ErpSkuMapping", ErpSkuMappingSchema);
