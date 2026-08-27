import dotenv from "dotenv";
import mongoose from "mongoose";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const reels = [
  { videoUrl: "/reels/zenblue-reel-1.mp4", poster: "", title: "ZenBlue look 01", link: "/shop" },
  { videoUrl: "/reels/zenblue-reel-2.mp4", poster: "", title: "ZenBlue look 02", link: "/shop" },
  { videoUrl: "/reels/zenblue-reel-3.mp4", poster: "", title: "ZenBlue look 03", link: "/shop" },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(uri);
  await SiteSettings.updateOne(
    { singletonKey: "site" },
    { $set: { "integrations.reelVideos": reels } },
    { upsert: true }
  );
  await mongoose.disconnect();
  console.log(`Configured ${reels.length} homepage reel videos`);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
