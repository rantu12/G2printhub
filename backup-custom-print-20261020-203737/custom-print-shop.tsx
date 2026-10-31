"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
};

type OptionChoice = {
  label: string;
  value: string;
  priceAdjustment: number;
};

type ProductOption = {
  name: string;
  label: string;
  required: boolean;
  choices: OptionChoice[];
};

type PrintArea = {
  name: string;
  width: number;
  height: number;
  unit: string;
  additionalCharge: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  options: ProductOption[] | null;
  printAreas: PrintArea[] | null;
  customizationSettings: {
    allowArtwork?: boolean;
    allowText?: boolean;
    maxArtworkFileSize?: number;
    acceptedArtworkTypes?: string[];
    maxTextLength?: number;
  } | null;
  price: string;
  salePrice: string | null;
  stock: number;
  category: { id: string; name: string; slug: string };
  angleImages: { id: string; url: string; label: string | null }[];
};

type Placement = { x: number; y: number; scale: number; rotation: number };
type SavedArtwork = {
  id: string;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
};
type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type DragLayer = "artwork" | "text" | null;

const initialPlacement: Placement = {
  x: 50,
  y: 50,
  scale: 1,
  rotation: 0,
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getOptions(value: unknown): ProductOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ProductOption =>
      record(item) &&
      typeof item.name === "string" &&
      typeof item.label === "string" &&
      typeof item.required === "boolean" &&
      Array.isArray(item.choices) &&
      item.choices.every(
        (choice) =>
          record(choice) &&
          typeof choice.label === "string" &&
          typeof choice.value === "string" &&
          typeof choice.priceAdjustment === "number"
      )
  );
}

function getPrintAreas(value: unknown): PrintArea[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (area): area is PrintArea =>
      record(area) &&
      typeof area.name === "string" &&
      typeof area.width === "number" &&
      typeof area.height === "number" &&
      typeof area.unit === "string" &&
      typeof area.additionalCharge === "number"
  );
}

function getSettings(value: unknown): Product["customizationSettings"] {
  if (!record(value)) return null;
  return {
    allowArtwork:
      typeof value.allowArtwork === "boolean" ? value.allowArtwork : true,
    allowText: typeof value.allowText === "boolean" ? value.allowText : true,
    maxArtworkFileSize:
      typeof value.maxArtworkFileSize === "number"
        ? value.maxArtworkFileSize
        : 10 * 1024 * 1024,
    acceptedArtworkTypes: Array.isArray(value.acceptedArtworkTypes)
      ? value.acceptedArtworkTypes.filter(
          (item): item is string => typeof item === "string"
        )
      : ["image/jpeg", "application/pdf"],
    maxTextLength:
      typeof value.maxTextLength === "number" ? value.maxTextLength : 200,
  };
}

function formatPrice(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
      }).format(amount)
    : "Price unavailable";
}

function readProduct(value: unknown): Product | null {
  if (!record(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.price !== "string" ||
    !record(value.category) ||
    typeof value.category.id !== "string" ||
    typeof value.category.name !== "string" ||
    typeof value.category.slug !== "string"
  ) {
    return null;
  }
  const angles = Array.isArray(value.angleImages)
    ? value.angleImages.filter(
        (angle) =>
          record(angle) &&
          typeof angle.id === "string" &&
          typeof angle.url === "string" &&
          (angle.label === null || typeof angle.label === "string")
      )
    : [];
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description: typeof value.description === "string" ? value.description : null,
    image: typeof value.image === "string" ? value.image : null,
    images: Array.isArray(value.images)
      ? value.images.filter((item): item is string => typeof item === "string")
      : [],
    colors: Array.isArray(value.colors)
      ? value.colors.filter((item): item is string => typeof item === "string")
      : [],
    sizes: Array.isArray(value.sizes)
      ? value.sizes.filter((item): item is string => typeof item === "string")
      : [],
    options: getOptions(value.options),
    printAreas: getPrintAreas(value.printAreas),
    customizationSettings: getSettings(value.customizationSettings),
    price: value.price,
    salePrice: typeof value.salePrice === "string" ? value.salePrice : null,
    stock: typeof value.stock === "number" ? value.stock : 0,
    category: {
      id: value.category.id,
      name: value.category.name,
      slug: value.category.slug,
    },
    angleImages: angles as Product["angleImages"],
  };
}

function imageList(product: Product) {
  return Array.from(new Set([product.image, ...product.images].filter(
    (image): image is string => Boolean(image)
  )));
}

export default function CustomPrintShop() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 0,
  });
  const [categorySlug, setCategorySlug] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedPrintArea, setSelectedPrintArea] = useState("");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState("");
  const [savedArtwork, setSavedArtwork] = useState<SavedArtwork | null>(null);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [artworkMessage, setArtworkMessage] = useState("");
  const [customText, setCustomText] = useState("");
  const [textColor, setTextColor] = useState("#1f2937");
  const [textFontSize, setTextFontSize] = useState(28);
  const [artworkPlacement, setArtworkPlacement] = useState(initialPlacement);
  const [textPlacement, setTextPlacement] = useState(initialPlacement);
  const [dragLayer, setDragLayer] = useState<DragLayer>(null);
  const [savingDesign, setSavingDesign] = useState(false);
  const [designMessage, setDesignMessage] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/custom-print/categories", {
      cache: "no-store",
    });
    const body: unknown = await response.json();
    if (!response.ok || !record(body) || body.success !== true) {
      throw new Error(
        record(body) && typeof body.message === "string"
          ? body.message
          : "Unable to load custom print categories."
      );
    }
    setCategories(
      Array.isArray(body.categories)
        ? body.categories.filter(
            (item): item is Category =>
              record(item) &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.slug === "string" &&
              (item.description === null ||
                typeof item.description === "string") &&
              (item.image === null || typeof item.image === "string")
          )
        : []
    );
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pagination.page) });
      if (categorySlug) params.set("category", categorySlug);
      if (search) params.set("search", search);
      const response = await fetch(`/api/custom-print/products?${params}`, {
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok || !record(body) || body.success !== true) {
        throw new Error(
          record(body) && typeof body.message === "string"
            ? body.message
            : "Unable to load custom print products."
        );
      }
      const fetchedProducts = Array.isArray(body.products)
        ? body.products.map(readProduct).filter(
            (product): product is Product => product !== null
          )
        : [];
      setProducts(fetchedProducts);
      const pageInfo = body.pagination;
      if (record(pageInfo)) {
        setPagination((current) => ({
          ...current,
          ...(typeof pageInfo.page === "number"
            ? { page: pageInfo.page }
            : {}),
          ...(typeof pageInfo.pageSize === "number"
            ? { pageSize: pageInfo.pageSize }
            : {}),
          ...(typeof pageInfo.total === "number"
            ? { total: pageInfo.total }
            : {}),
          ...(typeof pageInfo.totalPages === "number"
            ? { totalPages: pageInfo.totalPages }
            : {}),
        }));
      }
    } catch (loadError) {
      setProducts([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load custom print products."
      );
    } finally {
      setLoading(false);
    }
  }, [categorySlug, pagination.page, search]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadCategories().catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load custom print categories."
          );
        }
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const displayedPrice = useMemo(() => {
    if (!selected) return null;
    const base = Number(selected.salePrice ?? selected.price);
    const optionAdjustment = selected.options?.reduce((sum, option) => {
      const choice = option.choices.find(
        (item) => item.value === selectedOptions[option.name]
      );
      return sum + (choice?.priceAdjustment ?? 0);
    }, 0) ?? 0;
    const areaAdjustment =
      selected.printAreas?.find((area) => area.name === selectedPrintArea)
        ?.additionalCharge ?? 0;
    return base + optionAdjustment + areaAdjustment;
  }, [selected, selectedOptions, selectedPrintArea]);

  const clearSelectedArtwork = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
    setArtworkPreview("");
    setArtworkFile(null);
    setSavedArtwork(null);
    setArtworkMessage("");
    setCustomText("");
    setArtworkPlacement(initialPlacement);
    setTextPlacement(initialPlacement);
    setDesignMessage("");
  }, []);

  const openProduct = useCallback(async (slug: string) => {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    clearSelectedArtwork();
    try {
      const response = await fetch(
        `/api/custom-print/products/${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const body: unknown = await response.json();
      if (!response.ok || !record(body) || body.success !== true) {
        throw new Error(
          record(body) && typeof body.message === "string"
            ? body.message
            : "Unable to load product details."
        );
      }
      const product = readProduct(body.product);
      if (!product) throw new Error("The product details response was invalid.");
      setSelected(product);
      setSelectedImage(imageList(product)[0] ?? "");
      setSelectedColor(product.colors[0] ?? "");
      setSelectedSize(product.sizes[0] ?? "");
      setSelectedOptions(
        Object.fromEntries(
          (product.options ?? []).map((option) => [
            option.name,
            option.required ? option.choices[0]?.value ?? "" : "",
          ])
        )
      );
      setSelectedPrintArea(product.printAreas?.[0]?.name ?? "");
    } catch (loadError) {
      setDetailError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load product details."
      );
    } finally {
      setDetailLoading(false);
    }
  }, [clearSelectedArtwork]);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("product");
    if (!slug) return;
    const timer = window.setTimeout(() => void openProduct(slug), 0);
    return () => window.clearTimeout(timer);
  }, [openProduct]);

  function closeProduct() {
    setSelected(null);
    clearSelectedArtwork();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setArtworkMessage("");
    if (!file || !selected) return;
    const acceptedTypes =
      selected.customizationSettings?.acceptedArtworkTypes ?? [
        "image/jpeg",
        "application/pdf",
      ];
    const maxFileSize =
      selected.customizationSettings?.maxArtworkFileSize ?? 10 * 1024 * 1024;
    if (!acceptedTypes.includes(file.type)) {
      setArtworkMessage("This product accepts JPG or PDF artwork only.");
      event.target.value = "";
      return;
    }
    if (!file.size || file.size > maxFileSize) {
      setArtworkMessage(
        `Artwork must be smaller than ${(maxFileSize / (1024 * 1024)).toFixed(1)} MB.`
      );
      event.target.value = "";
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = file.type === "image/jpeg" ? URL.createObjectURL(file) : "";
    setArtworkPreview(objectUrlRef.current);
    setArtworkFile(file);
    setSavedArtwork(null);
  }

  function designConfiguration() {
    const elements: Record<string, string | number>[] = [];
    if (artworkFile || savedArtwork) {
      elements.push({
        type: "image",
        ...artworkPlacement,
      });
    }
    if (customText.trim()) {
      elements.push({
        type: "text",
        ...textPlacement,
        text: customText.trim(),
        color: textColor,
        fontSize: textFontSize,
      });
    }
    return { elements };
  }

  async function saveDesign() {
    if (!selected || (!artworkFile && !savedArtwork)) {
      setArtworkMessage("Choose artwork before saving the design.");
      return;
    }
    setUploadingArtwork(true);
    setArtworkMessage("");
    try {
      const formData = new FormData();
      if (artworkFile) formData.append("file", artworkFile);
      formData.append("productId", selected.id);
      if (savedArtwork) formData.append("existingId", savedArtwork.id);
      formData.append(
        "designConfiguration",
        JSON.stringify(designConfiguration())
      );
      const response = await fetch("/api/customer/custom-print-artwork", {
        method: "POST",
        body: formData,
      });
      const body: unknown = await response.json();
      if (!response.ok || !record(body) || body.success !== true || !record(body.artwork)) {
        throw new Error(
          record(body) && typeof body.message === "string"
            ? body.message
            : "Unable to save artwork."
        );
      }
      const artwork = body.artwork;
      if (typeof artwork.id !== "string") {
        throw new Error("The artwork response was invalid.");
      }
      setSavedArtwork({
        id: artwork.id,
        fileName: typeof artwork.fileName === "string" ? artwork.fileName : null,
        contentType:
          typeof artwork.contentType === "string" ? artwork.contentType : null,
        fileSize: typeof artwork.fileSize === "number" ? artwork.fileSize : null,
      });
      setArtworkFile(null);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
      const savedPreview =
        artwork.contentType === "image/jpeg"
          ? `/api/customer/custom-print-artwork/${artwork.id}?inline=1`
          : "";
      setArtworkPreview(savedPreview);
      setArtworkMessage("Private artwork and design saved to your account.");
    } catch (uploadError) {
      setArtworkMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to save artwork."
      );
    } finally {
      setUploadingArtwork(false);
    }
  }

  async function saveDesignConfiguration() {
    if (!selected || !savedArtwork) return;
    setSavingDesign(true);
    setDesignMessage("");
    try {
      const formData = new FormData();
      formData.append("productId", selected.id);
      formData.append("existingId", savedArtwork.id);
      formData.append(
        "designConfiguration",
        JSON.stringify(designConfiguration())
      );
      const response = await fetch("/api/customer/custom-print-artwork", {
        method: "POST",
        body: formData,
      });
      const body: unknown = await response.json();
      if (!response.ok || !record(body) || body.success !== true) {
        throw new Error(
          record(body) && typeof body.message === "string"
            ? body.message
            : "Unable to update the saved design."
        );
      }
      setDesignMessage("Design changes saved.");
    } catch (saveError) {
      setDesignMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the saved design."
      );
    } finally {
      setSavingDesign(false);
    }
  }

  async function removeArtwork() {
    if (savedArtwork) {
      const response = await fetch(
        `/api/customer/custom-print-artwork/${savedArtwork.id}`,
        { method: "DELETE" }
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        setArtworkMessage(
          record(body) && typeof body.message === "string"
            ? body.message
            : "Unable to remove saved artwork."
        );
        return;
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    clearSelectedArtwork();
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    layer: Exclude<DragLayer, null>
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragLayer(layer);
  }

  function moveDesign(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragLayer || !previewRef.current) return;
    const bounds = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    if (dragLayer === "artwork") {
      setArtworkPlacement((current) => ({ ...current, x, y }));
    } else {
      setTextPlacement((current) => ({ ...current, x, y }));
    }
  }

  function productImage(product: Product) {
    const image = imageList(product)[0];
    return image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={product.name} />
    ) : (
      <span className="custom-print-placeholder" aria-hidden="true">✦</span>
    );
  }

  return (
    <main className="custom-print-page">
      <section className="custom-print-hero">
        <div className="custom-print-hero-inner">
          <span className="custom-print-eyebrow">PRINTED YOUR WAY</span>
          <h1>Make it unmistakably yours.</h1>
          <p>
            Explore custom-print products, choose your options, and create a
            private artwork preview before you order.
          </p>
          <a href="#custom-print-catalog" className="custom-print-hero-link">
            Explore the collection <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section id="custom-print-catalog" className="custom-print-catalog">
        <header className="custom-print-heading">
          <div>
            <span className="custom-print-eyebrow">CUSTOM PRINT COLLECTION</span>
            <h2>Find the right canvas</h2>
            <p>Only products from our independent Custom Print collection appear here.</p>
          </div>
          <label className="custom-print-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search custom print products"
              placeholder="Search custom prints"
              value={searchInput}
              onChange={(event) => {
                setPagination((current) => ({ ...current, page: 1 }));
                setSearchInput(event.target.value);
              }}
            />
          </label>
        </header>

        <nav className="custom-print-categories" aria-label="Custom Print categories">
          <button
            type="button"
            className={!categorySlug ? "is-selected" : ""}
            onClick={() => {
              setCategorySlug("");
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            All custom prints
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={categorySlug === category.slug ? "is-selected" : ""}
              onClick={() => {
                setCategorySlug(category.slug);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            >
              {category.name}
            </button>
          ))}
        </nav>

        {error && <p className="custom-print-alert" role="alert">{error}</p>}
        {loading ? (
          <div className="custom-print-empty" role="status">
            <span className="custom-print-spinner" />
            <p>Loading custom prints…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="custom-print-empty">
            <span aria-hidden="true">✧</span>
            <h3>{error ? "Collection unavailable" : "Nothing here just yet"}</h3>
            <p>
              {error
                ? "Please try again in a moment."
                : "Try another category or search, or check back soon for new custom-print products."}
            </p>
            {error && (
              <button type="button" onClick={() => void loadProducts()}>
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="custom-print-grid">
              {products.map((product) => (
                <article className="custom-print-card" key={product.id}>
                  <button
                    type="button"
                    className="custom-print-card-image"
                    onClick={() => void openProduct(product.slug)}
                    aria-label={`View ${product.name}`}
                  >
                    {productImage(product)}
                    {product.angleImages.length > 0 && (
                      <span className="custom-print-angle-count">
                        {product.angleImages.length + 1} views
                      </span>
                    )}
                  </button>
                  <div className="custom-print-card-copy">
                    <span>{product.category.name}</span>
                    <h3>{product.name}</h3>
                    <div className="custom-print-card-price">
                      {product.salePrice && (
                        <del>{formatPrice(product.price)}</del>
                      )}
                      <strong>{formatPrice(product.salePrice ?? product.price)}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openProduct(product.slug)}
                    >
                      Customize product <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <nav className="custom-print-pagination" aria-label="Product pages">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                >
                  Previous
                </button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {(selected || detailLoading || detailError) && (
        <div className="custom-print-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeProduct();
        }}>
          <section
            className="custom-print-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-print-product-title"
          >
            <button type="button" className="custom-print-modal-close" onClick={closeProduct} aria-label="Close product details">×</button>
            {detailLoading ? (
              <div className="custom-print-empty" role="status"><span className="custom-print-spinner" /><p>Loading product details…</p></div>
            ) : detailError ? (
              <div className="custom-print-alert" role="alert">{detailError}</div>
            ) : selected ? (
              <div className="custom-print-detail-layout">
                <div className="custom-print-preview-column">
                  <div
                    ref={previewRef}
                    className="custom-print-live-preview"
                    onPointerMove={moveDesign}
                    onPointerUp={() => setDragLayer(null)}
                    onPointerCancel={() => setDragLayer(null)}
                  >
                    {selectedImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="custom-print-base-image" src={selectedImage} alt={`${selected.name} preview`} />
                    ) : (
                      <div className="custom-print-preview-placeholder"><span>✦</span><small>Product preview</small></div>
                    )}
                    {artworkPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="custom-print-design-artwork"
                        src={artworkPreview}
                        alt="Uploaded design"
                        draggable={false}
                        onPointerDown={(event) => beginDrag(event, "artwork")}
                        style={{
                          left: `${artworkPlacement.x}%`,
                          top: `${artworkPlacement.y}%`,
                          width: `${22 * artworkPlacement.scale}%`,
                          transform: `translate(-50%, -50%) rotate(${artworkPlacement.rotation}deg)`,
                        }}
                      />
                    )}
                    {customText.trim() && (
                      <span
                        className="custom-print-design-text"
                        onPointerDown={(event) => beginDrag(event, "text")}
                        style={{
                          left: `${textPlacement.x}%`,
                          top: `${textPlacement.y}%`,
                          color: textColor,
                          fontSize: `${textFontSize * textPlacement.scale}px`,
                          transform: `translate(-50%, -50%) rotate(${textPlacement.rotation}deg)`,
                        }}
                      >
                        {customText}
                      </span>
                    )}
                    <span className="custom-print-preview-hint">Drag your design to position it</span>
                  </div>
                  {(imageList(selected).length > 1 || selected.angleImages.length > 0) && (
                    <div className="custom-print-thumbnails" aria-label="Product images">
                      {imageList(selected).map((image, index) => (
                        <button type="button" key={`${image}-${index}`} className={selectedImage === image ? "is-selected" : ""} onClick={() => setSelectedImage(image)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt={`${selected.name} product image ${index + 1}`} />
                          <span>Image {index + 1}</span>
                        </button>
                      ))}
                      {selected.angleImages.map((angle) => (
                        <button type="button" key={angle.id} className={selectedImage === angle.url ? "is-selected" : ""} onClick={() => setSelectedImage(angle.url)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={angle.url} alt={angle.label || `${selected.name} angle`} />
                          <span>{angle.label || "Additional angle"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selected.angleImages.length > 0 && (
                    <p className="custom-print-angle-note">Showing supplied product-angle images. This is not a simulated 360° view.</p>
                  )}
                </div>

                <div className="custom-print-detail-copy">
                  <span className="custom-print-eyebrow">{selected.category.name}</span>
                  <h2 id="custom-print-product-title">{selected.name}</h2>
                  {selected.description && <p className="custom-print-description">{selected.description}</p>}
                  <div className="custom-print-detail-price">
                    {selected.salePrice && <del>{formatPrice(selected.price)}</del>}
                    <strong>{formatPrice(displayedPrice ?? selected.salePrice ?? selected.price)}</strong>
                    <small>Price updates with selected options</small>
                  </div>
                  {selected.colors.length > 0 && (
                    <label className="custom-print-field">
                      <span>Color</span>
                      <select value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}>
                        {selected.colors.map((color) => <option key={color}>{color}</option>)}
                      </select>
                    </label>
                  )}
                  {selected.sizes.length > 0 && (
                    <label className="custom-print-field">
                      <span>Size</span>
                      <select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
                        {selected.sizes.map((size) => <option key={size}>{size}</option>)}
                      </select>
                    </label>
                  )}
                  {selected.options?.map((option) => (
                    <label className="custom-print-field" key={option.name}>
                      <span>{option.label}{option.required ? " *" : ""}</span>
                      <select
                        required={option.required}
                        value={selectedOptions[option.name] ?? ""}
                        onChange={(event) => setSelectedOptions((current) => ({ ...current, [option.name]: event.target.value }))}
                      >
                        {!option.required && <option value="">Choose {option.label.toLowerCase()}</option>}
                        {option.choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}{choice.priceAdjustment > 0 ? ` (+${formatPrice(choice.priceAdjustment)})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {selected.printAreas && selected.printAreas.length > 0 && (
                    <label className="custom-print-field">
                      <span>Print area</span>
                      <select value={selectedPrintArea} onChange={(event) => setSelectedPrintArea(event.target.value)}>
                        {selected.printAreas.map((area) => (
                          <option key={area.name} value={area.name}>
                            {area.name} · {area.width} × {area.height} {area.unit}{area.additionalCharge ? ` (+${formatPrice(area.additionalCharge)})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {selected.customizationSettings?.allowArtwork !== false && (
                    <section className="custom-print-editor-section">
                      <h3>Add your artwork</h3>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={(selected.customizationSettings?.acceptedArtworkTypes ?? ["image/jpeg", "application/pdf"]).join(",")}
                        onChange={handleFileChange}
                      />
                      <small>Private upload · JPG or PDF · Up to {((selected.customizationSettings?.maxArtworkFileSize ?? 10 * 1024 * 1024) / (1024 * 1024)).toFixed(1)} MB</small>
                      {artworkFile && <p className="custom-print-file-name">Selected: {artworkFile.name}</p>}
                      {savedArtwork && <p className="custom-print-file-name">Saved privately: {savedArtwork.fileName || "Artwork"}{savedArtwork.contentType === "application/pdf" ? " (PDF preview unavailable)" : ""}</p>}
                      {artworkPreview && (
                        <div className="custom-print-placement-controls">
                          <label>Artwork size <input type="range" min="0.25" max="3" step="0.05" value={artworkPlacement.scale} onChange={(event) => setArtworkPlacement((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
                          <label>Rotation <input type="range" min="-180" max="180" value={artworkPlacement.rotation} onChange={(event) => setArtworkPlacement((current) => ({ ...current, rotation: Number(event.target.value) }))} /></label>
                        </div>
                      )}
                    </section>
                  )}

                  {selected.customizationSettings?.allowText !== false && (
                    <section className="custom-print-editor-section">
                      <h3>Add custom text</h3>
                      <label className="custom-print-field">
                        <span>Your text</span>
                        <input
                          type="text"
                          maxLength={selected.customizationSettings?.maxTextLength ?? 200}
                          value={customText}
                          onChange={(event) => setCustomText(event.target.value)}
                          placeholder="Type your message"
                        />
                      </label>
                      {customText.trim() && (
                        <>
                          <div className="custom-print-inline-controls">
                            <label>Text color <input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label>
                            <label>Text size <input type="range" min="12" max="72" value={textFontSize} onChange={(event) => setTextFontSize(Number(event.target.value))} /></label>
                          </div>
                          <div className="custom-print-placement-controls">
                            <label>Text scale <input type="range" min="0.5" max="3" step="0.05" value={textPlacement.scale} onChange={(event) => setTextPlacement((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
                            <label>Text rotation <input type="range" min="-180" max="180" value={textPlacement.rotation} onChange={(event) => setTextPlacement((current) => ({ ...current, rotation: Number(event.target.value) }))} /></label>
                          </div>
                        </>
                      )}
                    </section>
                  )}

                  <div className="custom-print-editor-actions">
                    <button type="button" className="custom-print-button-secondary" onClick={() => {
                      setArtworkPlacement(initialPlacement);
                      setTextPlacement(initialPlacement);
                      setCustomText("");
                      setTextColor("#1f2937");
                      setTextFontSize(28);
                      setDesignMessage("");
                    }}>
                      Reset design
                    </button>
                    {selected.customizationSettings?.allowArtwork !== false && (
                      <button type="button" className="custom-print-button-primary" onClick={() => void saveDesign()} disabled={uploadingArtwork || (!artworkFile && !savedArtwork)}>
                        {uploadingArtwork ? "Saving privately…" : savedArtwork ? "Upload / save design" : "Save private artwork"}
                      </button>
                    )}
                  </div>
                  {savedArtwork && <button type="button" className="custom-print-text-button" onClick={() => void saveDesignConfiguration()} disabled={savingDesign}>{savingDesign ? "Saving…" : "Save design adjustments"}</button>}
                  {artworkMessage && <p className="custom-print-inline-message" role="status">{artworkMessage}</p>}
                  {designMessage && <p className="custom-print-inline-message" role="status">{designMessage}</p>}
                  {savedArtwork && <button type="button" className="custom-print-remove-artwork" onClick={() => void removeArtwork()}>Remove saved artwork</button>}
                  <p className="custom-print-no-cart-note">Preview only — cart and checkout are not connected in this stage.</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
