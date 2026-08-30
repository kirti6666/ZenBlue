import { Product } from "@/models";

export interface CatalogueFilterParams {
  fabric?: string;
  colour?: string;
  size?: string;
  inStock?: string;
}

export interface ProductFacets {
  fabrics: string[];
  colours: string[];
  sizes: string[];
}

export function applyCatalogueFilters(
  filter: Record<string, unknown>,
  params: CatalogueFilterParams
) {
  if (params.fabric) filter.fabric = params.fabric;

  const and: Record<string, unknown>[] = [];
  if (params.colour) {
    and.push({
      variants: {
        $elemMatch: { name: { $regex: "colou?r", $options: "i" }, options: params.colour },
      },
    });
  }
  if (params.size) {
    and.push({
      variants: { $elemMatch: { name: { $regex: "size", $options: "i" }, options: params.size } },
    });
  }
  if (params.inStock === "1") {
    and.push({
      $or: [
        { variantCombinations: { $elemMatch: { stock: { $gt: 0 } } } },
        { $and: [{ "variantCombinations.0": { $exists: false } }, { stock: { $gt: 0 } }] },
      ],
    });
  }
  if (and.length) filter.$and = and;
  return filter;
}

export async function getProductFacets(baseFilter: Record<string, unknown>): Promise<ProductFacets> {
  const products = await Product.find(baseFilter).select("fabric variants").lean<any[]>();
  const fabrics = new Set<string>();
  const colours = new Set<string>();
  const sizes = new Set<string>();

  for (const product of products) {
    if (product.fabric?.trim()) fabrics.add(product.fabric.trim());
    for (const variant of product.variants ?? []) {
      const target = /colou?r/i.test(variant.name)
        ? colours
        : /size/i.test(variant.name)
          ? sizes
          : null;
      if (target) for (const option of variant.options ?? []) if (option?.trim()) target.add(option.trim());
    }
  }

  const alpha = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b));
  return { fabrics: alpha(fabrics), colours: alpha(colours), sizes: alpha(sizes) };
}
