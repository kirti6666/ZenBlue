import dotenv from "dotenv";
import mongoose from "mongoose";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

async function main() {
  await mongoose.connect(uri);
  await SiteSettings.findOneAndUpdate(
    { singletonKey: "site" },
    { $set: { "brand.logoUrl": "/branding/zenblue-logo-ivory.png" } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  console.log("ZenBlue header logo updated");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
