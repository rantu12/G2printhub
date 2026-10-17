"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { PRODUCT_SIZES } from "@/lib/product-variants";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type FormData = {
  name: string;
  title: string;
  slug: string;
  sku: string;
  categoryId: string;
  description: string;
  image: string;
  colors: string[];
  sizes: string[];
  price: string;
  discountPrice: string;
  stock: string;
  availability: boolean;
  codEnabled: boolean;
  customerArtworkEnabled: boolean;
  status: string;
  featured: boolean;
};

const initialForm: FormData = {
  name: "",
  title: "",
  slug: "",
  sku: "",
  categoryId: "",
  description: "",
  image: "",
  colors: [],
  sizes: [],
  price: "",
  discountPrice: "",
  stock: "0",
  availability: true,
  codEnabled: true,
  customerArtworkEnabled: true,
  status: "ACTIVE",
  featured: false,
};

type GalleryImage = {
  id: string;
  src: string;
  file?: File;
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AddProductPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const productId = params.id;
  const isEditing = Boolean(productId);

  const [form, setForm] = useState<FormData>(initialForm);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [draggingGalleryIndex, setDraggingGalleryIndex] = useState<number | null>(
    null
  );
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const galleryObjectUrls = useRef(new Set<string>());
  const nextGalleryImageId = useRef(0);
  const [imagePreview, setImagePreview] = useState("");
  const imagePreviewUrl = useRef("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">(
    "error"
  );

  useEffect(
    () => () => {
      if (imagePreviewUrl.current) {
        URL.revokeObjectURL(imagePreviewUrl.current);
      }
      for (const url of galleryObjectUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/admin/categories", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Unable to load categories.");
          setMessageType("error");
          return;
        }

        setCategories(data.categories || []);
      } catch {
        setMessage("Unable to connect to the server.");
        setMessageType("error");
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    if (!productId) {
      return;
    }

    async function loadProduct() {
      try {
        const response = await fetch(
          `/api/admin/products/${productId}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load product.");
        }

        const product = data.product;
        setForm({
          name: product.name || "",
          title: product.title || "",
          slug: product.slug || "",
          sku: product.sku || "",
          categoryId: product.categoryId || product.category?.id || "",
          description: product.description || "",
          image: product.image || "",
          colors: Array.isArray(product.colors) ? product.colors : [],
          sizes: Array.isArray(product.sizes) ? product.sizes : [],
          price: String(product.price ?? ""),
          discountPrice:
            product.discountPrice === null ||
            product.discountPrice === undefined
              ? ""
              : String(product.discountPrice),
          stock: String(product.stock ?? 0),
          availability: product.availability ?? true,
          codEnabled: product.codEnabled ?? true,
          customerArtworkEnabled: product.customerArtworkEnabled ?? true,
          status: product.status || "ACTIVE",
          featured: product.featured ?? false,
        });
        setGalleryImages(
          (Array.isArray(product.images) ? product.images : []).map(
            (src: string) => ({
              id: `saved-${nextGalleryImageId.current++}`,
              src,
            })
          )
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load product."
        );
        setMessageType("error");
      } finally {
        setLoadingProduct(false);
      }
    }

    loadProduct();
  }, [productId]);

  function updateField<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function moveGalleryImage(fromIndex: number, toIndex: number) {
    setGalleryImages((current) => {
      if (
        toIndex < 0 ||
        toIndex >= current.length ||
        fromIndex < 0 ||
        fromIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return current;
      }
      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  }

  function removeGalleryImage(index: number) {
    const image = galleryImages[index];
    if (image?.file) {
      URL.revokeObjectURL(image.src);
      galleryObjectUrls.current.delete(image.src);
    }
    setGalleryImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: current.slug ? current.slug : makeSlug(value),
    }));
  }

  function handleSlugChange(value: string) {
    updateField("slug", makeSlug(value));
  }

  function handleSkuChange(value: string) {
    updateField("sku", value.toUpperCase().replace(/\s+/g, "-"));
  }

  const selectedCategory = useMemo(() => {
    return categories.find(
      (category) => category.id === form.categoryId
    );
  }, [categories, form.categoryId]);

  const finalPrice = Number(form.price || 0);
  const finalDiscountPrice =
    form.discountPrice === "" ? null : Number(form.discountPrice);

  const discountPercent =
    finalDiscountPrice !== null &&
    finalPrice > 0 &&
    finalDiscountPrice < finalPrice
      ? Math.round(
          ((finalPrice - finalDiscountPrice) / finalPrice) * 100
        )
      : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    if (!form.name.trim()) {
      setMessage("Product name is required.");
      setMessageType("error");
      return;
    }

    if (!form.slug.trim()) {
      setMessage("Product slug is required.");
      setMessageType("error");
      return;
    }

    if (!form.sku.trim()) {
      setMessage("SKU is required.");
      setMessageType("error");
      return;
    }

    if (!form.categoryId) {
      setMessage("Please select a category.");
      setMessageType("error");
      return;
    }

    if (!form.price || Number(form.price) < 0) {
      setMessage("Please enter a valid price.");
      setMessageType("error");
      return;
    }

    if (
      form.discountPrice !== "" &&
      Number(form.discountPrice) < 0
    ) {
      setMessage("Please enter a valid discount price.");
      setMessageType("error");
      return;
    }

    if (
      form.discountPrice !== "" &&
      Number(form.discountPrice) > Number(form.price)
    ) {
      setMessage(
        "Discount price cannot be higher than the regular price."
      );
      setMessageType("error");
      return;
    }

    if (Number(form.stock) < 0) {
      setMessage("Stock cannot be negative.");
      setMessageType("error");
      return;
    }

    setSaving(true);

    try {
      let image = form.image;

      if (selectedImage) {
        const uploadData = new FormData();
        uploadData.append("image", selectedImage);

        const uploadResponse = await fetch(
          "/api/admin/products/upload-image",
          {
            method: "POST",
            body: uploadData,
          }
        );
        const uploaded = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploaded.message || "Unable to upload product image.");
        }

        image = uploaded.image;
      }

      const images: string[] = [];
      for (const galleryImage of galleryImages) {
        if (!galleryImage.file) {
          images.push(galleryImage.src);
          continue;
        }
        const uploadData = new FormData();
        uploadData.append("image", galleryImage.file);

        const uploadResponse = await fetch(
          "/api/admin/products/upload-image",
          { method: "POST", body: uploadData }
        );
        const uploaded = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploaded.message || "Unable to upload gallery image.");
        }
        images.push(uploaded.image);
      }

      const response = await fetch(
        isEditing
          ? `/api/admin/products/${productId}`
          : "/api/admin/products",
        {
          method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title.trim(),
          slug: form.slug.trim(),
          sku: form.sku.trim(),
          categoryId: form.categoryId,
          description: form.description.trim(),
          image,
          images,
          colors: form.colors,
          sizes: form.sizes,
          price: Number(form.price),
          discountPrice:
            form.discountPrice === ""
              ? null
              : Number(form.discountPrice),
          stock: Number(form.stock),
          availability: form.availability,
          codEnabled: form.codEnabled,
          customerArtworkEnabled: form.customerArtworkEnabled,
          status: form.status,
          featured: form.featured,
        }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            (isEditing
              ? "Unable to update product."
              : "Unable to create product.")
        );
        setMessageType("error");
        return;
      }

      setMessage(
        isEditing
          ? "Product updated successfully."
          : "Product created successfully."
      );
      setMessageType("success");

      setTimeout(() => {
        router.push("/admin/products");
        router.refresh();
      }, 700);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="product-page">
      <div className="product-page-header">
        <div>
          <div className="admin-breadcrumb product-breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/products">Products</Link>
            <span>/</span>
            <span>{isEditing ? "Edit Product" : "Add Product"}</span>
          </div>

          <h1>{isEditing ? "Edit Product" : "Add Product"}</h1>

          <p>
            {isEditing
              ? "Update product details in your PrintHub store."
              : "Create and publish a new product in your PrintHub store."}
          </p>
        </div>

        <button
          type="button"
          className="product-back-btn"
          onClick={() => router.push(isEditing ? "/admin/products" : "/admin")}
        >
          {isEditing ? "← Back to Products" : "← Dashboard"}
        </button>
      </div>

      <form
        className="product-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-main">
          {/* BASIC INFORMATION */}

          <section className="product-card">
            <div className="product-card-header">
              <div>
                <h2>Basic Information</h2>
                <p>
                  Add the main information customers will see.
                </p>
              </div>
            </div>

            <div className="product-grid">
              <div className="product-field product-field-full">
                <label htmlFor="product-name">
                  Product Name *
                </label>

                <input
                  id="product-name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    handleNameChange(event.target.value)
                  }
                  placeholder="Example: PVC ID Card"
                  required
                />
              </div>

              <div className="product-field product-field-full">
                <label htmlFor="product-title">
                  Product Title
                </label>

                <input
                  id="product-title"
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateField(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Premium PVC ID Card Printing"
                />
              </div>

              <div className="product-field">
                <label htmlFor="product-slug">
                  Product Slug *
                </label>

                <input
                  id="product-slug"
                  type="text"
                  value={form.slug}
                  onChange={(event) =>
                    handleSlugChange(event.target.value)
                  }
                  placeholder="pvc-id-card"
                  required
                />

                <small className="product-help">
                  URL: /products/{form.slug || "product-slug"}
                </small>
              </div>

              <div className="product-field">
                <label htmlFor="product-sku">
                  SKU *
                </label>

                <input
                  id="product-sku"
                  type="text"
                  value={form.sku}
                  onChange={(event) =>
                    handleSkuChange(event.target.value)
                  }
                  placeholder="PVC-ID-001"
                  required
                />
              </div>

              <div className="product-field product-field-full">
                <label htmlFor="product-category">
                  Category *
                </label>

                <select
                  id="product-category"
                  value={form.categoryId}
                  onChange={(event) =>
                    updateField(
                      "categoryId",
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    {loadingCategories
                      ? "Loading categories..."
                      : "Select a category"}
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>

                {!loadingCategories &&
                  categories.length === 0 && (
                    <small className="product-help">
                      No categories found. Please create a
                      category first.
                    </small>
                  )}
              </div>

              <div className="product-field product-field-full">
                <label htmlFor="product-description">
                  Description
                </label>

                <textarea
                  id="product-description"
                  rows={7}
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="Write a detailed description of your product..."
                />

                <small className="product-help">
                  Explain size, material, printing quality,
                  features and other important details.
                </small>
              </div>
            </div>
          </section>

          {/* PRICING */}

          <section className="product-card">
            <div className="product-card-header">
              <div>
                <h2>Pricing & Inventory</h2>
                <p>
                  Configure your product price and stock.
                </p>
              </div>
            </div>

            <div className="product-grid">
              <div className="product-field">
                <label htmlFor="product-price">
                  Regular Price (₹) *
                </label>

                <div className="price-input">
                  <span>₹</span>

                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      updateField(
                        "price",
                        event.target.value
                      )
                    }
                    placeholder="299.00"
                    required
                  />
                </div>
              </div>

              <div className="product-field">
                <label htmlFor="product-discount">
                  Sale Price (₹)
                </label>

                <div className="price-input">
                  <span>₹</span>

                  <input
                    id="product-discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountPrice}
                    onChange={(event) =>
                      updateField(
                        "discountPrice",
                        event.target.value
                      )
                    }
                    placeholder="249.00"
                  />
                </div>

                {discountPercent > 0 && (
                  <small className="product-discount-note">
                    {discountPercent}% discount
                  </small>
                )}
              </div>

              <div className="product-field">
                <label htmlFor="product-stock">
                  Stock Quantity *
                </label>

                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) =>
                    updateField(
                      "stock",
                      event.target.value
                    )
                  }
                  required
                />
              </div>
            </div>
          </section>

          {/* IMAGE */}

          <section className="product-card">
            <div className="product-card-header">
              <div>
                <h2>Product Image</h2>
                <p>
                  Add the main image for this product.
                </p>
              </div>
            </div>

            <div className="product-field">
              <label htmlFor="product-image">Upload image from device</label>

              <input
                id="product-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;

                  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                    setMessage("Choose a JPG, PNG, or WebP image.");
                    setMessageType("error");
                    event.target.value = "";
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setMessage("Image must be 5 MB or smaller.");
                    setMessageType("error");
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
            </div>
          </section>

          <section className="product-card">
            <div className="product-card-header">
              <div>
                <h2>Gallery & Product Variants</h2>
                <p>
                  Add product photos, colors, and optional size choices.
                </p>
              </div>
            </div>

            <div className="product-field">
              <small className="product-help">
                Up to five gallery images total. The main product image is shown first.
              </small>
              <input
                ref={galleryInputRef}
                className="product-gallery-file-input"
                id="product-gallery"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-label="Choose gallery images"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 5 - galleryImages.length) {
                    setMessage("A product can have at most five gallery images.");
                    setMessageType("error");
                    return;
                  }
                  if (
                    files.some(
                      (file) =>
                        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                        file.size > 5 * 1024 * 1024
                    )
                  ) {
                    setMessage("Gallery images must be JPG, PNG, or WebP files up to 5 MB each.");
                    setMessageType("error");
                    return;
                  }
                  setMessage("");
                  setGalleryImages((current) => [
                    ...current,
                    ...files.map((file) => {
                      const src = URL.createObjectURL(file);
                      galleryObjectUrls.current.add(src);
                      return {
                        id: `new-${nextGalleryImageId.current++}`,
                        src,
                        file,
                      };
                    }),
                  ]);
                }}
              />
              <div className="product-gallery-toolbar">
                <button
                  type="button"
                  className="product-gallery-add-button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={galleryImages.length >= 5}
                >
                  Add screenshots
                </button>
                <span>Drag images to change order</span>
                <span className="product-gallery-count">
                  {galleryImages.length}/5
                </span>
              </div>
              {galleryImages.length > 0 && (
                <div className="product-gallery-grid">
                  {galleryImages.map((image, index) => (
                    <div
                      className={`product-gallery-item${draggingGalleryIndex === index ? " is-dragging" : ""}`}
                      key={image.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggingGalleryIndex(index);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(index));
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const fromIndex = Number(
                          event.dataTransfer.getData("text/plain")
                        );
                        moveGalleryImage(fromIndex, index);
                        setDraggingGalleryIndex(null);
                      }}
                      onDragEnd={() => setDraggingGalleryIndex(null)}
                    >
                      <div className="product-gallery-thumbnail">
                        <Image
                          src={image.src}
                          alt={`Product gallery image ${index + 1}`}
                          fill
                          sizes="(max-width: 700px) 40vw, 160px"
                          unoptimized
                        />
                      </div>
                      <div className="product-gallery-item-actions">
                        <span>Image {index + 1}</span>
                        <div>
                          <button
                            type="button"
                            aria-label={`Move image ${index + 1} earlier`}
                            onClick={() => moveGalleryImage(index, index - 1)}
                            disabled={index === 0}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            aria-label={`Move image ${index + 1} later`}
                            onClick={() => moveGalleryImage(index, index + 1)}
                            disabled={index === galleryImages.length - 1}
                          >
                            →
                          </button>
                          <button
                            type="button"
                            className="product-gallery-remove"
                            aria-label={`Remove image ${index + 1}`}
                            onClick={() => removeGalleryImage(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="product-field product-color-options">
              <label className="product-switch-row">
                <input
                  type="checkbox"
                  role="switch"
                  checked={form.colors.length > 0}
                  onChange={(event) =>
                    updateField(
                      "colors",
                      event.target.checked ? ["Black"] : []
                    )
                  }
                />
                <span>
                  <strong>
                    {form.colors.length > 0
                      ? "Color options enabled"
                      : "Color options disabled"}
                  </strong>
                  <small>
                    {form.colors.length > 0
                      ? "Customers can select a color on the product card."
                      : "Turn this on to show color choices to customers."}
                  </small>
                </span>
              </label>

              {form.colors.length > 0 && (
                <fieldset className="product-color-options-list">
                  <legend>Available colors</legend>
                  <div>
                    {["Black", "White", "Red", "Blue", "Pink", "Green"].map((color) => (
                      <label key={color}>
                        <input
                          type="checkbox"
                          checked={form.colors.includes(color)}
                          onChange={(event) =>
                            updateField(
                              "colors",
                              event.target.checked
                                ? [...form.colors, color]
                                : form.colors.filter((item) => item !== color)
                            )
                          }
                        />
                        {color}
                      </label>
                    ))}
                  </div>
                  <small className="product-help">
                    Place the main image first, then additional photos in the same
                    order as the remaining selected colors for variant previews.
                  </small>
                </fieldset>
              )}
            </div>

            <div className="product-field product-color-options">
              <label className="product-switch-row">
                <input
                  type="checkbox"
                  role="switch"
                  checked={form.sizes.length > 0}
                  onChange={(event) =>
                    updateField(
                      "sizes",
                      event.target.checked ? ["S", "M", "L", "XL"] : []
                    )
                  }
                />
                <span>
                  <strong>
                    {form.sizes.length > 0
                      ? "Size options enabled"
                      : "Size options disabled"}
                  </strong>
                  <small>
                    {form.sizes.length > 0
                      ? "Customers must select a size before adding this product to cart."
                      : "Turn this on for T-shirts and other products with size variants."}
                  </small>
                </span>
              </label>

              {form.sizes.length > 0 && (
                <fieldset className="product-color-options-list">
                  <legend>Available sizes</legend>
                  <div>
                    {PRODUCT_SIZES.map((size) => (
                      <label key={size}>
                        <input
                          type="checkbox"
                          checked={form.sizes.includes(size)}
                          onChange={(event) =>
                            updateField(
                              "sizes",
                              event.target.checked
                                ? [...form.sizes, size]
                                : form.sizes.filter((item) => item !== size)
                            )
                          }
                        />
                        {size}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </section>

          {/* SETTINGS */}

          <section className="product-card">
            <div className="product-card-header">
              <div>
                <h2>Product Settings</h2>
                <p>
                  Control visibility and store status.
                </p>
              </div>
            </div>

            <div className="product-settings">
              <label className="product-switch-row">
                <input
                  type="checkbox"
                  checked={form.codEnabled}
                  onChange={(event) =>
                    updateField("codEnabled", event.target.checked)
                  }
                />

                <span>
                  <strong>
                    {form.codEnabled
                      ? "Cash on Delivery available"
                      : "Cash on Delivery unavailable"}
                  </strong>

                  <small>
                    {form.codEnabled
                      ? "Customers can use COD for this product when the store-wide COD setting is enabled."
                      : "If this product is in the cart, checkout requires online payment."}
                  </small>
                </span>
              </label>

              <label className="product-switch-row">
                <input
                  type="checkbox"
                  checked={form.status === "ACTIVE"}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.checked ? "ACTIVE" : "DISABLED"
                    )
                  }
                />

                <span>
                  <strong>
                    {form.status === "ACTIVE"
                      ? "Visible on storefront"
                      : "Hidden from storefront"}
                  </strong>

                  <small>
                    {form.status === "ACTIVE"
                      ? "Customers can see this product in the store."
                      : "This product is not shown in the store."}
                  </small>
                </span>
              </label>

              <label className="product-switch-row">
                <input
                  type="checkbox"
                  checked={form.customerArtworkEnabled}
                  onChange={(event) =>
                    updateField(
                      "customerArtworkEnabled",
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>
                    {form.customerArtworkEnabled
                      ? "Customer uploads visible"
                      : "Customer uploads hidden"}
                  </strong>

                  <small>
                    {form.customerArtworkEnabled
                      ? "Customers can upload JPG or PDF files and add a PDF password."
                      : "Hide the customer artwork upload option on this product."}
                  </small>
                </span>
              </label>

              <label className="product-switch-row">
                <input
                  type="checkbox"
                  checked={form.availability}
                  onChange={(event) =>
                    updateField(
                      "availability",
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>
                    Available for purchase
                  </strong>

                  <small>
                    Customers can purchase this product.
                  </small>
                </span>
              </label>

              <label className="product-switch-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    updateField(
                      "featured",
                      event.target.checked
                    )
                  }
                />

                <span>
                  <strong>
                    Featured Product
                  </strong>

                  <small>
                    Show this product in featured sections.
                  </small>
                </span>
              </label>

              <div className="product-field">
                <label htmlFor="product-status">
                  Product Status
                </label>

                <select
                  id="product-status"
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value
                    )
                  }
                >
                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="DRAFT">
                    Draft
                  </option>

                  <option value="DISABLED">
                    Disabled
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* MESSAGE */}

          {message && (
            <div
              className={
                messageType === "success"
                  ? "product-success"
                  : "product-error"
              }
            >
              {messageType === "success" ? "✓ " : "⚠ "}
              {message}
            </div>
          )}

          {/* ACTIONS */}

          <div className="product-actions">
            <button
              type="button"
              className="product-cancel-btn"
              onClick={() =>
                router.push(isEditing ? "/admin/products" : "/admin")
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="product-save-btn"
              disabled={saving || loadingProduct || categories.length === 0}
            >
              {saving
                ? isEditing
                  ? "Updating Product..."
                  : "Saving Product..."
                : isEditing
                  ? "✓ Update Product"
                  : "✓ Save Product"}
            </button>
          </div>
        </div>

        {/* PREVIEW */}

        <aside className="product-preview-card">
          <div className="preview-title">
            Product Preview
          </div>

          <div className="preview-image">
            {imagePreview || form.image ? (
              <img
                src={imagePreview || form.image}
                alt={form.name || "Product preview"}
              />
            ) : (
              <div className="preview-placeholder">
                <span>🖼️</span>
                <p>Product image</p>
              </div>
            )}
          </div>

          <div className="preview-content">
            <div className="preview-top-row">
              <span className="preview-category">
                {selectedCategory?.name || "Category"}
              </span>

              {form.featured && (
                <span className="preview-featured">
                  ★ Featured
                </span>
              )}
            </div>

            <h3>
              {form.name || "Product Name"}
            </h3>

            <p>
              {form.title ||
                "Your product title will appear here."}
            </p>

            <div className="preview-price">
              {finalDiscountPrice !== null &&
              finalDiscountPrice < finalPrice ? (
                <>
                  <strong>
                    ₹
                    {finalDiscountPrice.toFixed(2)}
                  </strong>

                  <del>
                    ₹{finalPrice.toFixed(2)}
                  </del>
                </>
              ) : (
                <strong>
                  ₹{finalPrice.toFixed(2)}
                </strong>
              )}
            </div>

            {discountPercent > 0 && (
              <span className="preview-discount">
                Save {discountPercent}%
              </span>
            )}

            <div className="preview-meta">
              <span>
                SKU: {form.sku || "—"}
              </span>

              <span>
                Stock: {form.stock || "0"}
              </span>
            </div>

            <div
              className={
                form.availability
                  ? "preview-available"
                  : "preview-unavailable"
              }
            >
              <span className="preview-dot" />

              {form.availability
                ? "Available"
                : "Unavailable"}
            </div>
          </div>
        </aside>
      </form>
    </main>
  );
}