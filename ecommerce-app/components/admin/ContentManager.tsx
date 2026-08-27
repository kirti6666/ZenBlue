"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Lock, Plus, Trash2, X } from "lucide-react";
import { Card, EmptyState, Pill, TableWrap, Th, Td } from "./AdminPage";

interface Page {
  _id: string;
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
  isSystem: boolean;
  updatedAt: string;
}

interface FaqEntry {
  _id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

/**
 * Two tabs over one screen: the CMS pages and the FAQ list.
 *
 * The page body is a plain textarea taking light Markdown rather than a rich
 * text editor. It keeps the stored content portable and safe to render
 * (see components/storefront/RichText.tsx, which escapes before formatting),
 * and a shop owner writing a returns policy needs headings and lists, not a
 * toolbar.
 */
export function ContentManager({
  initialPages,
  initialFaqs,
}: {
  initialPages: Page[];
  initialFaqs: FaqEntry[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pages" | "faqs">("pages");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPage, setNewPage] = useState({ title: "", slug: "", subtitle: "", body: "" });

  const [editingFaq, setEditingFaq] = useState<FaqEntry | null>(null);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "", category: "General" });

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["pages", "faqs"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-line text-body hover:border-primary"
            }`}
          >
            {t === "pages" ? `Pages (${initialPages.length})` : `FAQ (${initialFaqs.length})`}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {/* ---------- Pages ---------- */}
      {tab === "pages" && (
        <>
          {editingPage ? (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium text-heading">
                  Editing “{editingPage.title}”
                </h2>
                <button type="button" onClick={() => setEditingPage(null)} aria-label="Close editor">
                  <X size={18} className="text-muted" />
                </button>
              </div>

              <div className="space-y-4">
                <Field
                  label="Title"
                  value={editingPage.title}
                  onChange={(v) => setEditingPage({ ...editingPage, title: v })}
                />
                <Field
                  label="Subtitle"
                  value={editingPage.subtitle}
                  onChange={(v) => setEditingPage({ ...editingPage, subtitle: v })}
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-heading">Body</span>
                  <textarea
                    rows={18}
                    value={editingPage.body}
                    onChange={(e) => setEditingPage({ ...editingPage, body: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-heading"
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Markdown: <code>## Heading</code>, <code>- bullet</code>,{" "}
                    <code>**bold**</code>, <code>[link](https://…)</code>
                  </span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Meta title"
                    value={editingPage.metaTitle}
                    onChange={(v) => setEditingPage({ ...editingPage, metaTitle: v })}
                  />
                  <Field
                    label="Meta description"
                    value={editingPage.metaDescription}
                    onChange={(v) => setEditingPage({ ...editingPage, metaDescription: v })}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    checked={editingPage.isPublished}
                    onChange={(e) =>
                      setEditingPage({ ...editingPage, isPublished: e.target.checked })
                    }
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Published
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await call(`/api/content/${editingPage._id}`, "PATCH", {
                        title: editingPage.title,
                        subtitle: editingPage.subtitle,
                        body: editingPage.body,
                        metaTitle: editingPage.metaTitle,
                        metaDescription: editingPage.metaDescription,
                        isPublished: editingPage.isPublished,
                      });
                      if (ok) setEditingPage(null);
                    }}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save page"}
                  </button>
                  <Link
                    href={`/pages/${editingPage.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm text-heading"
                  >
                    Preview <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCreatingPage((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  {creatingPage ? <X size={15} /> : <Plus size={15} />}
                  {creatingPage ? "Cancel" : "New page"}
                </button>
              </div>

              {creatingPage && (
                <Card>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Title"
                        value={newPage.title}
                        onChange={(v) => setNewPage({ ...newPage, title: v })}
                      />
                      <Field
                        label="URL slug (optional)"
                        value={newPage.slug}
                        onChange={(v) => setNewPage({ ...newPage, slug: v })}
                        placeholder="size-guide"
                      />
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-heading">Body</span>
                      <textarea
                        rows={10}
                        value={newPage.body}
                        onChange={(e) => setNewPage({ ...newPage, body: e.target.value })}
                        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] text-heading"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || !newPage.title.trim()}
                      onClick={async () => {
                        const ok = await call("/api/content", "POST", newPage);
                        if (ok) {
                          setCreatingPage(false);
                          setNewPage({ title: "", slug: "", subtitle: "", body: "" });
                        }
                      }}
                      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Create page
                    </button>
                  </div>
                </Card>
              )}

              {initialPages.length === 0 ? (
                <EmptyState message="No pages yet. Run the seed script or create one above." />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Page</Th>
                      <Th>URL</Th>
                      <Th>Status</Th>
                      <Th>Updated</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {initialPages.map((page) => (
                      <tr key={page._id} className="hover:bg-surface-alt">
                        <Td>
                          <span className="flex items-center gap-2 font-medium">
                            {page.title}
                            {page.isSystem && (
                              <span title="Linked from the footer — cannot be deleted">
                                <Lock size={11} className="text-muted" />
                              </span>
                            )}
                          </span>
                        </Td>
                        <Td className="text-xs text-muted">/pages/{page.slug}</Td>
                        <Td>
                          {page.isPublished ? (
                            <Pill tone="success">Live</Pill>
                          ) : (
                            <Pill>Draft</Pill>
                          )}
                        </Td>
                        <Td className="text-xs text-muted">
                          {new Date(page.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Td>
                        <Td>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingPage(page)}
                              className="text-sm text-link hover:underline"
                            >
                              Edit
                            </button>
                            {!page.isSystem && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => call(`/api/content/${page._id}`, "DELETE")}
                                aria-label={`Delete ${page.title}`}
                                className="text-error"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </>
          )}
        </>
      )}

      {/* ---------- FAQs ---------- */}
      {tab === "faqs" && (
        <>
          <Card>
            <p className="mb-3 text-sm font-medium text-heading">Add an FAQ entry</p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <Field
                  label="Question"
                  value={newFaq.question}
                  onChange={(v) => setNewFaq({ ...newFaq, question: v })}
                />
                <Field
                  label="Category"
                  value={newFaq.category}
                  onChange={(v) => setNewFaq({ ...newFaq, category: v })}
                  placeholder="Orders"
                />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-heading">Answer</span>
                <textarea
                  rows={3}
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
                />
              </label>
              <button
                type="button"
                disabled={busy || !newFaq.question.trim() || !newFaq.answer.trim()}
                onClick={async () => {
                  const ok = await call("/api/faqs", "POST", newFaq);
                  if (ok) setNewFaq({ question: "", answer: "", category: newFaq.category });
                }}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Add entry
              </button>
            </div>
          </Card>

          {initialFaqs.length === 0 ? (
            <EmptyState message="No FAQ entries yet." />
          ) : (
            <div className="space-y-3">
              {initialFaqs.map((faq) => (
                <Card key={faq._id}>
                  {editingFaq?._id === faq._id ? (
                    <div className="space-y-3">
                      <Field
                        label="Question"
                        value={editingFaq.question}
                        onChange={(v) => setEditingFaq({ ...editingFaq, question: v })}
                      />
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-heading">Answer</span>
                        <textarea
                          rows={4}
                          value={editingFaq.answer}
                          onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Category"
                          value={editingFaq.category}
                          onChange={(v) => setEditingFaq({ ...editingFaq, category: v })}
                        />
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium text-heading">
                            Sort order
                          </span>
                          <input
                            type="number"
                            value={editingFaq.sortOrder}
                            onChange={(e) =>
                              setEditingFaq({ ...editingFaq, sortOrder: Number(e.target.value) })
                            }
                            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await call(`/api/faqs/${faq._id}`, "PATCH", {
                              question: editingFaq.question,
                              answer: editingFaq.answer,
                              category: editingFaq.category,
                              sortOrder: editingFaq.sortOrder,
                            });
                            if (ok) setEditingFaq(null);
                          }}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFaq(null)}
                          className="rounded-lg border border-line px-4 py-2 text-sm text-heading"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-heading">
                          {faq.question}
                          <Pill>{faq.category}</Pill>
                          {!faq.isPublished && <Pill tone="warning">Hidden</Pill>}
                        </p>
                        <p className="mt-1 text-sm text-body">{faq.answer}</p>
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingFaq(faq)}
                          className="text-sm text-link hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => call(`/api/faqs/${faq._id}`, "DELETE")}
                          aria-label="Delete entry"
                          className="text-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-heading">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted"
      />
    </label>
  );
}
