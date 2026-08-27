import dotenv from "dotenv";
import mongoose from "mongoose";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

async function main() {
  await mongoose.connect(uri);
  await SiteSettings.findOneAndUpdate(
    {},
    {
      $set: {
        "contact.phone": "+91 74878 59546",
        "contact.whatsapp": "917487859546",
        "integrations.whatsappNumber": "917487859546",
        "integrations.whatsappPrefillMessage": "Hi ZEN BLUE, I have a question about your products.",
      },
    },
    { upsert: true }
  );
  console.log("WhatsApp contact configured for +91 74878 59546");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
