import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import BlogPost from "../models/BlogPost";
import { DEMO_BLOG_POSTS } from "../lib/blog";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  await connectDB();
  for (const post of DEMO_BLOG_POSTS) {
    await BlogPost.updateOne(
      { slug: post.slug },
      { $setOnInsert: { ...post, publishedAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`Blog seed complete (${DEMO_BLOG_POSTS.length} demo posts available).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
