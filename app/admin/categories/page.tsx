"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  active: boolean;
  createdAt: string;
  _count?: {
    products: number;
  };
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
};

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  image: "",
  active: true,
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const imagePreviewUrl = useRef("");

  useEffect(
    () => () => {
      if (imagePreviewUrl.current) {
        URL.revokeObjectURL(imagePreviewUrl.current);
      }
    },
    []
  );

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/admin/categories", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to load categories.");
        return;
      }

      setCategories(data.categories || []);
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCategories]);

  function updateField(
    field: keyof CategoryForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setSelectedImage(null);
    setImagePreview(category.image || "");
    if (imagePreviewUrl.current) {
      URL.revokeObjectURL(imagePreviewUrl.current);
      imagePreviewUrl.current = "";
    }

    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      active: category.active,
    });

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setEditingId(null);
    setSelectedImage(null);
    setImagePreview("");
    if (imagePreviewUrl.current) {
      URL.revokeObjectURL(imagePreviewUrl.current);
      imagePreviewUrl.current = "";
    }
    setForm(emptyForm);
    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setMessage("Category name is required.");
      return;
    }

    if (!form.slug.trim()) {
      setMessage("Category slug is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let image = form.image;

      if (selectedImage) {
        const uploadData = new FormData();
        uploadData.append("image", selectedImage);

        const uploadResponse = await fetch(
          "/api/admin/categories/upload-image",
          {
            method: "POST",
            body: uploadData,
          }
        );
        const uploaded = await uploadResponse.json();

        if (!uploadResponse.ok || !uploaded.success) {
          throw new Error(uploaded.message || "Unable to upload category image.");
        }

        image = uploaded.image;
      }

      const url = editingId
        ? `/api/admin/categories/${editingId}`
        : "/api/admin/categories";

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: makeSlug(form.slug),
          description: form.description.trim(),
          image,
          active: form.active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            `Unable to ${
              editingId ? "update" : "create"
            } category.`
        );
        return;
      }

      setMessage(
        editingId
          ? "Category updated successfully."
          : "Category created successfully."
      );

      resetForm();
      await loadCategories();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    const productCount = category._count?.products || 0;
    if (productCount > 0) {
      setMessage(
        `${category.name} has ${productCount} product(s). Move those products before deleting.`
      );
      return;
    }

    const confirmation = window.confirm(
      `Delete "${category.name}"?`
    );

    if (!confirmation) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/categories/${category.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Unable to delete category."
        );
        return;
      }

      setMessage("Category deleted successfully.");
      await loadCategories();
    } catch {
      setMessage("Unable to delete category.");
    }
  }

  const activeCategoryCount = categories.filter(
    (category) => category.active
  ).length;
  const productCount = categories.reduce(
    (total, category) => total + (category._count?.products || 0),
    0
  );
  const filteredCategories = categories.filter((category) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${category.name} ${category.slug} ${category.description || ""}`
        .toLowerCase()
        .includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? category.active : !category.active);

    return matchesSearch && matchesStatus;
  });

  return (
    <main className="admin-products-page categories-page">
      <div className="admin-page-shell">
        <header className="admin-page-header categories-header">
          <div>
            <div className="admin-breadcrumb categories-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Categories</span>
            </div>
            <h1>Categories</h1>
            <p>Organize your catalog and control which categories appear in your store.</p>
          </div>
          <div className="categories-header-actions">
            <Link href="/admin" className="admin-secondary-button">
              ← Dashboard
            </Link>
          </div>
        </header>

        <section className="category-overview" aria-label="Category overview">
          <article className="category-overview-card">
            <span className="category-overview-icon">▦</span>
            <div>
              <span>Total categories</span>
              <strong>{categories.length}</strong>
            </div>
          </article>
          <article className="category-overview-card">
            <span className="category-overview-icon is-active">✓</span>
            <div>
              <span>Active in store</span>
              <strong>{activeCategoryCount}</strong>
            </div>
          </article>
          <article className="category-overview-card">
            <span className="category-overview-icon is-products">▣</span>
            <div>
              <span>Products organized</span>
              <strong>{productCount}</strong>
            </div>
          </article>
        </section>

        <div className="categories-layout">
        <section className="category-form-card">
          <div className="category-card-title">
            <div>
              <h2>
                {editingId
                  ? "Edit Category"
                  : "Add Category"}
              </h2>

              <p>
                {editingId
                  ? "Update category information."
                  : "Create a new main product category."}
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                className="category-reset-btn"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="category-field">
              <label>Category Name *</label>

              <input
                type="text"
                value={form.name}
                onChange={(event) => {
                  const value = event.target.value;

                  setForm((current) => ({
                    ...current,
                    name: value,
                    slug: current.slug
                      ? current.slug
                      : makeSlug(value),
                  }));
                }}
                placeholder="Example: PVC Cards"
                required
              />
            </div>

            <div className="category-field">
              <label>Slug *</label>

              <input
                type="text"
                value={form.slug}
                onChange={(event) =>
                  updateField(
                    "slug",
                    makeSlug(event.target.value)
                  )
                }
                placeholder="pvc-cards"
                required
              />
            </div>

            <div className="category-field">
              <label>Description</label>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
                placeholder="Describe this category..."
                rows={5}
              />
            </div>

            <div className="category-field">
              <label htmlFor="category-image">Upload image from device</label>
              <input
                id="category-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;

                  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                    setMessage("Choose a JPG, PNG, or WebP image.");
                    event.target.value = "";
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setMessage("Image must be 5 MB or smaller.");
                    event.target.value = "";
                    return;
                  }

                  if (imagePreviewUrl.current) {
                    URL.revokeObjectURL(imagePreviewUrl.current);
                  }
                  imagePreviewUrl.current = URL.createObjectURL(file);
                  setMessage("");
                  setSelectedImage(file);
                  setImagePreview(imagePreviewUrl.current);
                }}
              />
              <small className="product-help">
                JPG, PNG, or WebP. Maximum file size: 5 MB.
                {selectedImage
                  ? ` Selected: ${selectedImage.name}`
                  : form.image
                    ? " Choose a new file to replace the current image."
                    : ""}
              </small>
              {imagePreview && (
                <div className="category-upload-preview">
                  <img src={imagePreview} alt="Category image preview" />
                </div>
              )}
            </div>

            <label className="category-active-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  updateField(
                    "active",
                    event.target.checked
                  )
                }
              />

              <span>
                <strong>Active Category</strong>
                <small>
                  Show this category in your store.
                </small>
              </span>
            </label>

            {message && (
              <div className="category-message">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="category-save-btn"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "✓ Update Category"
                : "＋ Add Category"}
            </button>
          </form>
        </section>

        <section className="category-list-card">
          <div className="category-list-header">
            <div>
              <div>
                <h2>Category directory</h2>
                <span>
                  Showing {filteredCategories.length} of {categories.length}
                </span>
              </div>
            </div>
            <div className="category-list-controls">
              <label className="category-search-wrap">
                <span aria-hidden="true">⌕</span>
                <input
                  className="category-search"
                  type="search"
                  aria-label="Search categories"
                  placeholder="Search name, slug or description..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                className="category-status-filter"
                aria-label="Filter categories by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="category-empty">
              <span className="category-loading-spinner" aria-hidden="true" />
              <strong>Loading categories</strong>
              <p>Your catalog is being fetched.</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="category-empty">
              <div className="category-empty-icon">
                {categories.length === 0 ? "＋" : "⌕"}
              </div>

              <h3>{categories.length === 0 ? "No categories yet" : "No matching categories"}</h3>

              <p>
                {categories.length === 0
                  ? "Create a category to start organizing your products."
                  : "Try a different search term or status filter."}
              </p>
            </div>
          ) : (
            <div className="category-table-wrap">
              <table className="category-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Slug</th>
                    <th>Products</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className="category-name-cell">
                          <div className="category-thumb">
                            {category.image ? (
                              <img
                                src={category.image}
                                alt={category.name}
                              />
                            ) : (
                              "📁"
                            )}
                          </div>

                          <div>
                            <strong>
                              {category.name}
                            </strong>

                            {category.description && (
                              <small>
                                {category.description}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <code>{category.slug}</code>
                      </td>

                      <td>
                        <span className="product-count">
                          {category._count?.products || 0}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            category.active
                              ? "category-status active"
                              : "category-status inactive"
                          }
                        >
                          {category.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="category-actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(category)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete"
                            onClick={() =>
                              deleteCategory(category)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}