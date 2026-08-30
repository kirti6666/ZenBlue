import mongoose, { Schema, models, model } from "mongoose";

export interface IBlogPost {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  isPublished: boolean;
  isFeatured: boolean;
  publishedAt: Date;
  metaTitle: string;
  metaDescription: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: "", maxlength: 500 },
    content: { type: String, default: "", maxlength: 100000 },
    coverImage: { type: String, default: "" },
    category: { type: String, default: "Style guide", trim: true, maxlength: 80 },
    author: { type: String, default: "ZenBlue Editorial", trim: true, maxlength: 100 },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
    metaTitle: { type: String, default: "", maxlength: 180 },
    metaDescription: { type: String, default: "", maxlength: 320 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

BlogPostSchema.index({ isPublished: 1, publishedAt: -1 });
BlogPostSchema.index({ category: 1, publishedAt: -1 });

export default models.BlogPost || model<IBlogPost>("BlogPost", BlogPostSchema);
