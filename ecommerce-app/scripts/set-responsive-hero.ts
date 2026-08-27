import dotenv from "dotenv";
import mongoose from "mongoose";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

const desktopImage = "/banners/men-women-desktop-hero.png";
const mobileImage = "/banners/men-women-mobile-tablet-hero.png";

async function main() {
  await mongoose.connect(uri);

  const settings = await SiteSettings.findOne({ singletonKey: "site" });
  if (!settings) throw new Error("Site settings document was not found");

  settings.home.heroSlides.splice(0, settings.home.heroSlides.length, {
    image: desktopImage,
    mobileImage,
    videoUrl: "",
    heading: "",
    subheading: "",
    link: "/shop",
  });

  await settings.save();
  console.log("Hero reset to one responsive slide with separate mobile and tablet/desktop images.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
