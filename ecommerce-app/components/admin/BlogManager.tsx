"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { SingleImageUpload } from "./SingleImageUpload";

type Post = {
  _id: string; title: string; slug: string; excerpt: string; content: string;
  coverImage: string; category: string; author: string; isPublished: boolean;
  isFeatured: boolean; publishedAt: string; metaTitle: string; metaDescription: string;
};

const empty = { title: "", slug: "", excerpt: "", content: "", coverImage: "", category: "Style guide", author: "ZenBlue Editorial", isPublished: true, isFeatured: false, publishedAt: new Date().toISOString().slice(0, 16), metaTitle: "", metaDescription: "" };

export function BlogManager({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function start(post?: Post) {
    setEditing(post ?? null);
    setForm(post ? { ...post, publishedAt: new Date(post.publishedAt).toISOString().slice(0, 16) } : empty);
    setError(""); setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const res = await fetch(editing ? `/api/blogs/${editing._id}` : "/api/blogs", {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, publishedAt: new Date(form.publishedAt).toISOString() }),
    });
    const data = await res.json(); setBusy(false);
    if (!res.ok) return setError(data.error || "Could not save post");
    const saved = data.post as Post;
    setPosts((current) => editing ? current.map((p) => p._id === saved._id ? saved : p) : [saved, ...current]);
    setOpen(false);
  }

  async function remove(post: Post) {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    const res = await fetch(`/api/blogs/${post._id}`, { method: "DELETE" });
    if (res.ok) setPosts((current) => current.filter((p) => p._id !== post._id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold text-heading">Blog</h1><p className="mt-1 text-sm text-muted">Create and edit the journal shown on the storefront.</p></div>
        <button onClick={() => start()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>New post</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {posts.map((post) => <div key={post._id} className="flex items-center gap-4 border-b border-line p-4 last:border-0">
          <div className="aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-md bg-surface-alt">{post.coverImage && <img src={post.coverImage} alt="" className="h-full w-full object-cover"/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate font-medium text-heading">{post.title}</p><p className="text-xs text-muted">{post.category} · {post.isPublished ? "Published" : "Draft"}</p></div>
          <Link href={`/blog/${post.slug}`} target="_blank" className="hidden text-sm text-link sm:block">View</Link>
          <button onClick={() => start(post)} aria-label="Edit" className="rounded-md border border-line p-2"><Edit3 size={16}/></button>
          <button onClick={() => remove(post)} aria-label="Delete" className="rounded-md border border-line p-2 text-red-600"><Trash2 size={16}/></button>
        </div>)}
        {!posts.length && <p className="p-8 text-center text-sm text-muted">No blog posts yet.</p>}
      </div>

      {open && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-3 sm:p-8">
        <form onSubmit={save} className="mx-auto max-w-3xl rounded-xl bg-background p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{editing ? "Edit post" : "New post"}</h2><button type="button" onClick={() => setOpen(false)}><X/></button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm">Title<input required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="text-sm">URL slug<input value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value})} placeholder="generated from title" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="text-sm">Category<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="text-sm">Author<input value={form.author} onChange={(e)=>setForm({...form,author:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="text-sm">Publish date<input type="datetime-local" value={form.publishedAt} onChange={(e)=>setForm({...form,publishedAt:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="sm:col-span-2 text-sm">Short description<textarea required rows={3} value={form.excerpt} onChange={(e)=>setForm({...form,excerpt:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <div className="sm:col-span-2"><SingleImageUpload label="Cover image (3:2 recommended)" aspect="blog" value={form.coverImage} onChange={(coverImage)=>setForm({...form,coverImage})}/></div>
            <label className="sm:col-span-2 text-sm">Article content (Markdown)<textarea required rows={12} value={form.content} onChange={(e)=>setForm({...form,content:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 font-mono text-sm"/></label>
            <label className="text-sm">SEO title<input value={form.metaTitle} onChange={(e)=>setForm({...form,metaTitle:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="text-sm">SEO description<input value={form.metaDescription} onChange={(e)=>setForm({...form,metaDescription:e.target.value})} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5"/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(e)=>setForm({...form,isPublished:e.target.checked})}/>Published</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e)=>setForm({...form,isFeatured:e.target.checked})}/>Featured</label>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setOpen(false)} className="rounded-md border border-line px-4 py-2">Cancel</button><button disabled={busy} className="rounded-md bg-primary px-5 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save post"}</button></div>
        </form>
      </div>}
    </div>
  );
}
