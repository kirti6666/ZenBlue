"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { SingleImageUpload } from "@/components/admin/SingleImageUpload";

interface Category {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  isActive: boolean;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCategories() {
    setLoading(true)
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false)
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create category");
        return;
      }
      setName("");
      loadCategories();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to delete category");
      return;
    }
    loadCategories();
  }

  async function toggleActive(cat: Category) {
    await fetch(`/api/categories/${cat._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    loadCategories();
  }

  async function updateImage(id: string, image: string) {
    setError("");
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update category image");
      return;
    }
    setCategories((current) =>
      current.map((cat) => (cat._id === id ? { ...cat, image: data.category.image || "" } : cat))
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-6 max-w-md">
        <input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border-b">Name</th>
              <th className="p-2 border-b">Circle image</th>
              <th className="p-2 border-b">Slug</th>
              <th className="p-2 border-b">Status</th>
              <th className="p-2 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat._id} className="border-b">
                <td className="p-2">{cat.name}</td>
                <td className="p-2">
                  <div className="flex min-w-[260px] items-center gap-3">
                    <SingleImageUpload
                      label=""
                      value={cat.image || ""}
                      onChange={(url) => updateImage(cat._id, url)}
                    />
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-[11px] text-gray-500">Image URL or local path</span>
                      <input
                        value={cat.image || ""}
                        onChange={(e) =>
                          setCategories((current) =>
                            current.map((item) =>
                              item._id === cat._id ? { ...item, image: e.target.value } : item
                            )
                          )
                        }
                        onBlur={(e) => updateImage(cat._id, e.target.value.trim())}
                        placeholder="/products/category.jpg"
                        className="w-full rounded-md border px-2.5 py-2 text-xs"
                      />
                    </label>
                  </div>
                </td>
                <td className="p-2 text-gray-500">{cat.slug}</td>
                <td className="p-2">
                  <button
                    onClick={() => toggleActive(cat)}
                    className={`text-xs px-2 py-1 rounded-full ${cat.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                      }`}
                  >
                    {cat.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => handleDelete(cat._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
