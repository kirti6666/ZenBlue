/**
 * Product fields required by ProductCard. Catalogue queries must not ship full
 * descriptions, media galleries, size charts and packaging data in the RSC
 * payload when a card only uses this compact subset.
 */
export const PRODUCT_CARD_FIELDS = [
  "title",
  "slug",
  "price",
  "discountPrice",
  "images",
  "category",
  "ratingsAverage",
  "ratingsCount",
  "stock",
  "variants",
  "variantCombinations.stock",
  "publishedAt",
].join(" ");
