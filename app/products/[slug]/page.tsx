"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import WishlistButton from "@/app/components/wishlist-button";
import ProductColorSelector from "@/components/products/ProductColorSelector";
import { getProductColors } from "@/components/products/types";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  sku: string;
  description: string | null;
  image: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  price: string;
  discountPrice: string | null;
  stock: number;
  availability: boolean;
  customerArtworkEnabled: boolean;
  status: string;
  featured: boolean;
  category: Category;
};

type ProductReview = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: string;
};

function formatPrice(value: string | null) {
  if (!value) {
    return "₹0.00";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "₹0.00";
  }

  return `₹${amount.toFixed(2)}`;
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart, items: cartItems, updateArtwork, ready: cartReady } =
    useCart();

  const slug =
    typeof params.slug === "string"
      ? params.slug
      : "";

  const [product, setProduct] =
    useState<Product | null>(null);

  const [relatedProducts, setRelatedProducts] =
    useState<Product[]>([]);

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [userReview, setUserReview] = useState<{
    name: string;
    email: string;
    rating: number;
    comment: string;
    images: string[];
  } | null>(null);
  const [reviewsSlug, setReviewsSlug] = useState("");
  const reviewsLoading = reviewsSlug !== slug;
  const [reviewsError, setReviewsError] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewName, setReviewName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImageFiles, setReviewImageFiles] = useState<File[]>([]);
  const [removeReviewImages, setRemoveReviewImages] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewNeedsSignIn, setReviewNeedsSignIn] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [artwork, setArtwork] = useState<{
    id: string;
    fileName: string | null;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [customizationDirty, setCustomizationDirty] = useState(false);
  const [loadingArtworkDetails, setLoadingArtworkDetails] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [artworkMessage, setArtworkMessage] = useState("");
  const [artworkError, setArtworkError] = useState(false);
  const [artworkNeedsSignIn, setArtworkNeedsSignIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const loadedArtworkId = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) {
      return;
    }

    async function loadProduct() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/products/${encodeURIComponent(slug)}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message || "Product not found."
          );
        }

        setProduct(data.product);
        setSelectedColor(data.product.colors?.[0] ?? "");
        setSelectedSize("");
        setActiveImageIndex(0);
        setRelatedProducts(
          data.relatedProducts || []
        );
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load product."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    let active = true;

    fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load product reviews.");
        }
        if (!active) return;

        setReviewsSlug(slug);
        setReviewsError("");
        setReviews(data.reviews);
        setAverageRating(data.averageRating);
        setReviewCount(data.reviewCount);
        setUserReview(data.userReview);
        setReviewImageFiles([]);
        setRemoveReviewImages(false);
        if (data.userReview) {
          setReviewName(data.userReview.name);
          setReviewEmail(data.userReview.email);
          setReviewRating(data.userReview.rating);
          setReviewComment(data.userReview.comment);
        } else {
          setReviewName(data.userProfile?.name ?? "");
          setReviewEmail(data.userProfile?.email ?? "");
          setReviewRating(5);
          setReviewComment("");
        }
      })
      .catch((loadError: unknown) => {
        console.error("Load product reviews error:", loadError);
        if (active) {
          setReviewsSlug(slug);
          setReviewsError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load product reviews."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product) return;

    const savedArtwork = cartItems.find(
      (item) => item.product.id === product.id
    )?.artwork;

    if (!savedArtwork) {
      if (loadedArtworkId.current !== null) {
        loadedArtworkId.current = null;
        setArtwork(null);
        setSelectedFile(null);
        setPdfPassword("");
        setCustomizationDirty(false);
        setLoadingArtworkDetails(false);
      }
      return;
    }

    if (loadedArtworkId.current === savedArtwork.id) return;
    const savedArtworkId = savedArtwork.id;
    loadedArtworkId.current = savedArtworkId;
    setArtwork(savedArtwork);
    setLoadingArtworkDetails(true);

    let active = true;
    async function loadSavedDetails() {
      try {
        const response = await fetch(
          `/api/customer/artwork/${encodeURIComponent(savedArtworkId)}/details`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load saved personalization.");
        }

        if (active) {
          setPdfPassword(data.artwork.pdfPassword);
          setCustomizationDirty(false);
        }
      } catch (loadError) {
        if (active) {
          setArtworkMessage(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load saved personalization."
          );
          setArtworkError(true);
        }
      } finally {
        if (active) setLoadingArtworkDetails(false);
      }
    }

    void loadSavedDetails();
    return () => {
      active = false;
    };
  }, [cartItems, product]);

  function increaseQuantity() {
    if (!product) {
      return;
    }

    setQuantity((current) =>
      Math.min(current + 1, Math.max(product.stock, 1))
    );
  }

  function decreaseQuantity() {
    setQuantity((current) =>
      Math.max(current - 1, 1)
    );
  }

  function handleArtworkChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setSelectedFile(file);
    setCustomizationDirty(true);
    setArtworkMessage("");
    setArtworkError(false);
  }

  async function handleSaveArtwork() {
    if (!product) return;

    if (
      !selectedFile &&
      !artwork &&
      !pdfPassword
    ) {
      setArtworkMessage("Choose a JPG or PDF file first.");
      setArtworkError(true);
      return;
    }

    setUploadingArtwork(true);
    setArtworkMessage("");
    setArtworkError(false);
    setArtworkNeedsSignIn(false);

    try {
      const upload = new FormData();
      if (selectedFile) upload.append("file", selectedFile);
      upload.append("productId", product.id);
      if (artwork) upload.append("existingId", artwork.id);
      upload.append("pdfPassword", pdfPassword);

      const response = await fetch("/api/customer/artwork", {
        method: "POST",
        body: upload,
      });
      const data = await response.json();

      if (response.status === 401) {
        setArtworkNeedsSignIn(true);
        throw new Error("Sign in to attach a file to your order.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to upload this file.");
      }

      setArtwork(data.artwork);
      loadedArtworkId.current = data.artwork.id;
      updateArtwork(product.id, data.artwork);
      setSelectedFile(null);
      setCustomizationDirty(false);
      setArtworkMessage("Personalization saved and ready for your cart.");
    } catch (uploadError) {
      setArtworkMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload this file."
      );
      setArtworkError(true);
    } finally {
      setUploadingArtwork(false);
    }
  }

  async function handleRemoveArtwork() {
    if (!artwork || !product) return;

    const productId = product.id;
    setUploadingArtwork(true);
    setArtworkMessage("");
    setArtworkError(false);

    try {
      const response = await fetch(
        `/api/customer/artwork/${encodeURIComponent(artwork.id)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to remove the uploaded file.");
      }

      setArtwork(null);
      loadedArtworkId.current = null;
      updateArtwork(productId, null);
      setSelectedFile(null);
      setPdfPassword("");
      setCustomizationDirty(false);
      setLoadingArtworkDetails(false);
      setArtworkMessage("Personalization removed.");
    } catch (removeError) {
      setArtworkMessage(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove the uploaded file."
      );
      setArtworkError(true);
    } finally {
      setUploadingArtwork(false);
    }
  }

  function handleAddToCart() {
    if (customizationDirty) {
      setCartMessage("Save your personalization before adding this product.");
      return;
    }

    if (!product || !cartReady) {
      setCartMessage("Your cart is loading. Please try again in a moment.");
      return;
    }
    if (product.sizes.length > 0 && !selectedSize) {
      setCartMessage("Choose a size before adding this product to your cart.");
      return;
    }

    if (
      addToCart(
        product,
        quantity,
        artwork ?? undefined,
        selectedColor || undefined,
        selectedSize || undefined
      )
    ) {
      setCartMessage(
        `${quantity} ${quantity === 1 ? "item" : "items"} added to your cart.`
      );
      return;
    }

    setCartMessage("Unable to add this product to your cart.");
  }

  function handleBuyNow() {
    if (customizationDirty) {
      setCartMessage("Save your personalization before checking out.");
      return;
    }

    if (!product || !cartReady) {
      setCartMessage("Your cart is loading. Please try again in a moment.");
      return;
    }
    if (product.sizes.length > 0 && !selectedSize) {
      setCartMessage("Choose a size before continuing to checkout.");
      return;
    }

    if (
      addToCart(
        product,
        quantity,
        artwork ?? undefined,
        selectedColor || undefined,
        selectedSize || undefined
      )
    ) {
      router.push("/checkout");
      return;
    }

    setCartMessage("Unable to add this product to your cart.");
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    setSavingReview(true);
    setReviewMessage("");
    setReviewNeedsSignIn(false);

    try {
      const formData = new FormData();
      formData.set("rating", String(reviewRating));
      formData.set("name", reviewName);
      formData.set("email", reviewEmail);
      formData.set("comment", reviewComment);
      formData.set("removeImages", String(removeReviewImages));
      for (const file of reviewImageFiles) {
        formData.append("images", file);
      }

      const response = await fetch(
        `/api/products/${encodeURIComponent(product.slug)}/reviews`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();

      if (response.status === 401) {
        setReviewNeedsSignIn(true);
        throw new Error("Sign in to submit your review.");
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save your review.");
      }

      const reviewsResponse = await fetch(
        `/api/products/${encodeURIComponent(product.slug)}/reviews`,
        { cache: "no-store" }
      );
      const reviewsData = await reviewsResponse.json();
      if (!reviewsResponse.ok || !reviewsData.success) {
        throw new Error(reviewsData.message || "Your review was saved, but reviews could not be refreshed.");
      }

      setReviews(reviewsData.reviews);
      setAverageRating(reviewsData.averageRating);
      setReviewCount(reviewsData.reviewCount);
      setUserReview(reviewsData.userReview);
      setReviewImageFiles([]);
      setRemoveReviewImages(false);
      setReviewMessage(data.message);
      setShowReviewForm(false);
    } catch (submitError) {
      console.error("Submit product review error:", submitError);
      setReviewMessage(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save your review."
      );
    } finally {
      setSavingReview(false);
    }
  }

  if (loading) {
    return (
      <main className="product-details-page">
        <div className="product-details-state">
          <div className="shop-spinner" />
          <h3>Loading product...</h3>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="product-details-page">
        <div className="product-details-state">
          <div className="shop-state-icon">
            📦
          </div>

          <h1>Product Not Found</h1>

          <p>
            {error ||
              "The product you are looking for does not exist."}
          </p>

          <Link
            href="/products"
            className="product-primary-button"
          >
            ← Back to Products
          </Link>
        </div>
      </main>
    );
  }

  const currentPrice =
    product.discountPrice ?? product.price;

  const hasDiscount =
    product.discountPrice !== null &&
    Number(product.discountPrice) <
      Number(product.price);
  const productColors = getProductColors(product);
  const productImages =
    product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];
  const currentImageIndex = Math.min(
    activeImageIndex,
    Math.max(0, productImages.length - 1)
  );
  const selectedImage = productImages[currentImageIndex] ?? null;

  return (
    <main className="product-details-page">
      <div className="shop-container">
        <div className="product-details-breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/products">Products</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <section className="product-details-card">
          <div className="product-details-image">
            <div className="product-details-image-viewport">
              {selectedImage ? (
                <Image
                  src={selectedImage}
                  alt={`${product.name}${selectedColor ? ` in ${selectedColor}` : ""}`}
                  fill
                  sizes="(max-width: 1000px) 100vw, 50vw"
                  unoptimized
                  priority
                />
              ) : (
                <div className="product-large-placeholder">📦</div>
              )}
              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="product-details-gallery-arrow previous"
                    aria-label="Show previous product image"
                    onClick={() =>
                      setActiveImageIndex(
                        (currentImageIndex - 1 + productImages.length) %
                          productImages.length
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="product-details-gallery-arrow next"
                    aria-label="Show next product image"
                    onClick={() =>
                      setActiveImageIndex(
                        (currentImageIndex + 1) % productImages.length
                      )
                    }
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {productImages.length > 1 && (
              <div
                className="product-details-gallery-thumbnails"
                aria-label="Choose a product image"
              >
                {productImages.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    aria-label={`Show product image ${index + 1}`}
                    aria-current={currentImageIndex === index}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="72px"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}
            <WishlistButton
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                image: product.image,
                price: product.price,
                discountPrice: product.discountPrice,
                categoryName: product.category.name,
              }}
            />

            {product.featured && (
              <span className="product-featured-label">
                Featured
              </span>
            )}
          </div>

          <div className="product-details-info">
            <span className="product-details-category">
              {product.category.name}
            </span>

            <h1>{product.name}</h1>

            {product.title && (
              <p className="product-details-title">
                {product.title}
              </p>
            )}

            <div className="product-details-rating">
              <span className="product-rating-stars" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    className={index < Math.round(averageRating) ? "is-filled" : ""}
                    aria-hidden="true"
                  >
                    ★
                  </span>
                ))}
              </span>
              <span>
                {reviewCount > 0
                  ? `${averageRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
                  : "No reviews yet"}
              </span>
              <button
                type="button"
                className="product-review-trigger"
                onClick={() => {
                  setShowReviewForm(true);
                  document.getElementById("product-reviews")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                {userReview ? "Edit your review" : "Write a review"}
              </button>
            </div>

            <div className="product-details-price">
              <strong>
                {formatPrice(currentPrice)}
              </strong>

              {hasDiscount && (
                <del>
                  {formatPrice(product.price)}
                </del>
              )}
            </div>

            {hasDiscount && (
              <span className="product-save">
                Special offer
              </span>
            )}

            {productColors.length > 0 && (
              <ProductColorSelector
                colors={productColors}
                selectedColor={selectedColor}
                onSelect={(color) => {
                  setSelectedColor(color);
                  const colorImageIndex = product.colors.indexOf(color);
                  if (colorImageIndex >= 0 && colorImageIndex < productImages.length) {
                    setActiveImageIndex(colorImageIndex);
                  }
                }}
              />
            )}

            {product.sizes.length > 0 && (
              <fieldset className="product-size-selector">
                <legend>
                  Size: <strong>{selectedSize || "Choose size"}</strong>
                </legend>
                <div>
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={selectedSize === size ? "is-selected" : ""}
                      aria-pressed={selectedSize === size}
                      onClick={() => {
                        setSelectedSize(size);
                        setCartMessage("");
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="product-details-divider" />

            {product.customerArtworkEnabled && (
            <section className="product-artwork-upload">
              <label htmlFor="product-artwork">
                Personalize this product <span>(optional)</span>
              </label>
              <label
                htmlFor="product-artwork"
                className="product-artwork-file-box"
              >
                <span className="product-artwork-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="product-artwork-file-copy">
                  <strong>Choose a JPG or PDF file</strong>
                  <small>Up to 10 MB</small>
                </span>
                <input
                  id="product-artwork"
                  type="file"
                  accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
                  onChange={handleArtworkChange}
                  disabled={uploadingArtwork}
                />
              </label>
              {selectedFile && (
                <p className="product-artwork-selected-name">
                  Selected file: {selectedFile.name}
                </p>
              )}
              <label htmlFor="product-pdf-password">
                PDF password <span>(if the uploaded PDF is protected)</span>
              </label>
              <input
                id="product-pdf-password"
                type="password"
                value={pdfPassword}
                maxLength={256}
                autoComplete="new-password"
                onChange={(event) => {
                  setPdfPassword(event.target.value);
                  setCustomizationDirty(true);
                }}
                placeholder="Password to open your PDF (optional)"
                disabled={uploadingArtwork}
              />
              <p className="product-artwork-notice">
                Passwords are encrypted before being stored and are available only to you and authorized order staff.
              </p>
              <div className="product-artwork-actions">
                <button
                  type="button"
                  onClick={handleSaveArtwork}
                  disabled={
                    uploadingArtwork ||
                    loadingArtworkDetails ||
                    (!customizationDirty && !artwork)
                  }
                >
                  {uploadingArtwork ? "Saving..." : "Save personalization"}
                </button>
                {artwork && (
                  <button
                    type="button"
                    className="product-artwork-remove"
                    onClick={handleRemoveArtwork}
                    disabled={uploadingArtwork}
                  >
                    Remove saved details
                  </button>
                )}
              </div>
              {uploadingArtwork && (
                <p className="product-artwork-status" role="status">
                  Saving personalization...
                </p>
              )}
              {loadingArtworkDetails && (
                <p className="product-artwork-status" role="status">
                  Loading saved personalization...
                </p>
              )}
              {artwork && (
                <div className="product-artwork-selected">
                  <span>
                    {artwork.fileName
                      ? `Saved file: ${artwork.fileName}`
                      : "Personalization details saved"}
                  </span>
                </div>
              )}
              {artworkMessage && (
                <p
                  className={
                    artworkError
                      ? "product-artwork-message product-artwork-error"
                      : "product-artwork-message"
                  }
                  role={artworkError ? "alert" : "status"}
                >
                  {artworkMessage}{" "}
                  {artworkNeedsSignIn && <Link href="/login">Sign in</Link>}
                </p>
              )}
            </section>
            )}

            <div className="product-details-description">
              <h3>Description</h3>

              <p>
                {product.description ||
                  "Create a beautiful custom printed product with G2 PrintHub."}
              </p>
            </div>

            <div className="product-details-meta">
              <div>
                <span>SKU</span>
                <strong>{product.sku}</strong>
              </div>

              <div>
                <span>Category</span>
                <strong>
                  {product.category.name}
                </strong>
              </div>

              <div>
                <span>Availability</span>
                <strong
                  className={
                    product.stock > 0
                      ? "details-stock"
                      : "details-out-stock"
                  }
                >
                  {product.stock > 0
                    ? `${product.stock} available`
                    : "Out of stock"}
                </strong>
              </div>
            </div>

            {product.stock > 0 && (
              <div className="product-purchase-area">
                <div className="quantity-control">
                  <button
                    type="button"
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>

                  <span>{quantity}</span>

                  <button
                    type="button"
                    onClick={increaseQuantity}
                    disabled={
                      quantity >= product.stock
                    }
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="product-primary-button product-add-cart"
                  disabled={!cartReady || uploadingArtwork}
                  onClick={handleAddToCart}
                >
                  {cartReady ? "Add to Cart" : "Loading Cart..."}
                </button>
              </div>
            )}

            {cartMessage && (
              <p className="product-cart-feedback" role="status">
                {cartMessage}{" "}
                {cartMessage.includes("added") && (
                  <Link href="/cart">View cart</Link>
                )}
              </p>
            )}

            <button
              type="button"
              className="product-buy-button"
              disabled={product.stock <= 0 || !cartReady || uploadingArtwork}
              onClick={handleBuyNow}
            >
              {product.stock <= 0
                ? "Out of Stock"
                : cartReady
                  ? uploadingArtwork
                    ? "Uploading File..."
                    : "Buy Now"
                  : "Loading Cart..."}
            </button>
          </div>
        </section>

        <section className="product-reviews-section" id="product-reviews">
          <div className="product-reviews-heading">
            <div>
              <span>CUSTOMER FEEDBACK</span>
              <h2>Reviews {reviewCount > 0 && `(${reviewCount})`}</h2>
            </div>
            {!showReviewForm && (
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => setShowReviewForm(true)}
              >
                {userReview ? "Edit your review" : "Write a review"}
              </button>
            )}
          </div>

          {showReviewForm && (
            <form className="product-review-form" onSubmit={handleReviewSubmit}>
              <h3>{userReview ? "Update your review" : "Share your review"}</h3>
              <fieldset disabled={savingReview}>
                <legend>Your rating</legend>
                <div className="product-review-rating-input">
                  {Array.from({ length: 5 }, (_, index) => {
                    const rating = index + 1;
                    return (
                      <button
                        key={rating}
                        type="button"
                        aria-label={`${rating} out of 5 stars`}
                        aria-pressed={reviewRating === rating}
                        onClick={() => setReviewRating(rating)}
                      >
                        {rating <= reviewRating ? "★" : "☆"}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label>
                Name *
                <input
                  type="text"
                  value={reviewName}
                  onChange={(event) => setReviewName(event.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  required
                  disabled={savingReview}
                />
              </label>
              <label>
                Email *
                <input
                  type="email"
                  value={reviewEmail}
                  onChange={(event) => setReviewEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  required
                  disabled={savingReview}
                />
                <small>Your email is kept private and won’t appear with your review.</small>
              </label>
              <label>
                Your review
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  placeholder="Tell other customers what you think (10–1,000 characters)."
                  required
                  disabled={savingReview}
                />
              </label>
              <div className="product-review-upload">
                <label htmlFor="product-review-images">
                  Add photos <span>(optional, up to 3)</span>
                </label>
                <input
                  id="product-review-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={savingReview}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";

                    if (files.length > 3) {
                      setReviewMessage("Choose up to 3 images.");
                      return;
                    }
                    const invalidFile = files.find(
                      (file) =>
                        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                        file.size === 0 ||
                        file.size > 5 * 1024 * 1024
                    );
                    if (invalidFile) {
                      setReviewMessage(
                        "Review photos must be JPG, PNG, or WebP images no larger than 5 MB each."
                      );
                      return;
                    }

                    setReviewMessage("");
                    setReviewImageFiles(files);
                    setRemoveReviewImages(false);
                  }}
                />
                <small>JPG, PNG, or WebP. Maximum 5 MB per image.</small>
                {userReview?.images.length && !removeReviewImages ? (
                  <div className="product-review-upload-current">
                    <span>Current review photos</span>
                    <div className="product-review-images">
                      {userReview.images.map((image) => (
                        <img key={image} src={image} alt="Your current review upload" />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="product-review-cancel"
                      onClick={() => setRemoveReviewImages(true)}
                      disabled={savingReview}
                    >
                      Remove current photos
                    </button>
                  </div>
                ) : null}
                {reviewImageFiles.length > 0 && (
                  <div className="product-review-selected-files">
                    <span>Selected photos (will replace current photos)</span>
                    {reviewImageFiles.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            setReviewImageFiles((current) =>
                              current.filter((_, fileIndex) => fileIndex !== index)
                            )
                          }
                          disabled={savingReview}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {removeReviewImages && (
                  <p className="product-review-upload-note">
                    Current review photos will be removed when you save.
                  </p>
                )}
              </div>
              <div className="product-review-form-actions">
                <button
                  type="submit"
                  className="product-primary-button"
                  disabled={savingReview}
                >
                  {savingReview
                    ? "Saving review..."
                    : userReview
                      ? "Update review"
                      : "Submit review"}
                </button>
                <button
                  type="button"
                  className="product-review-cancel"
                  onClick={() => setShowReviewForm(false)}
                  disabled={savingReview}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {reviewMessage && (
            <p className="product-review-feedback" role={reviewNeedsSignIn ? "alert" : "status"}>
              {reviewMessage}{" "}
              {reviewNeedsSignIn && (
                <Link href={`/login?redirect=${encodeURIComponent(`/products/${product.slug}`)}`}>
                  Sign in
                </Link>
              )}
            </p>
          )}

          {reviewsError && <p className="product-review-feedback" role="alert">{reviewsError}</p>}
          {reviewsLoading ? (
            <p className="product-review-empty">Loading reviews...</p>
          ) : reviews.length > 0 ? (
            <div className="product-review-list">
              {reviews.map((review) => (
                <article key={review.id} className="product-review-card">
                  <div className="product-review-card-heading">
                    <strong>{review.name}</strong>
                    <span aria-label={`${review.rating} out of 5 stars`}>
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                    <time dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <p>{review.comment}</p>
                  {review.images.length > 0 && (
                    <div className="product-review-images">
                      {review.images.map((image) => (
                        <img
                          key={image}
                          src={image}
                          alt="Photo shared with this review"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="product-review-empty">No reviews yet. Be the first to share your experience.</p>
          )}
        </section>

        {relatedProducts.length > 0 && (
          <section className="related-products-section">
            <div className="related-products-heading">
              <div>
                <span>YOU MAY ALSO LIKE</span>
                <h2>Related Products</h2>
              </div>

              <Link href="/products">
                View All →
              </Link>
            </div>

            <div className="shop-grid related-products-grid">
              {relatedProducts.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.slug}`}
                  className="shop-product-card"
                >
                  <div className="shop-product-image">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                      />
                    ) : (
                      <div className="shop-image-placeholder">
                        📦
                      </div>
                    )}
                  </div>

                  <div className="shop-product-info">
                    <span className="shop-product-category">
                      {item.category.name}
                    </span>

                    <h2>{item.name}</h2>

                    <div className="shop-product-price">
                      <strong>
                        {formatPrice(
                          item.discountPrice ??
                            item.price
                        )}
                      </strong>

                      {item.discountPrice && (
                        <del>
                          {formatPrice(item.price)}
                        </del>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}