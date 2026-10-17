import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/admin-image-upload";

export const runtime = "nodejs";

const maxReviewImages = 3;
const reviewImagePathPattern =
  /^\/uploads\/reviews\/[0-9a-f-]+\.(jpg|png|webp)$/;

class InvalidReviewImageError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Sign in to submit a product review." },
      { status: 401 }
    );
  }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const product = await prisma.product.findFirst({
      where: { slug, availability: true, status: "ACTIVE" },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const user = await getCurrentUser();
    const [reviews, aggregate, userReview] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          rating: true,
          comment: true,
          images: true,
          createdAt: true,
        },
      }),
      prisma.productReview.aggregate({
        where: { productId: product.id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      user
        ? prisma.productReview.findUnique({
            where: {
              userId_productId: {
                userId: user.id,
                productId: product.id,
              },
            },
            select: {
              name: true,
              email: true,
              rating: true,
              comment: true,
              images: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      reviews,
      averageRating: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count._all,
      userReview,
      userProfile: user
        ? { name: user.name, email: user.email }
        : null,
    });
  } catch (error) {
    console.error("Product reviews GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load product reviews." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;
    const formData = await request.formData();
    const ratingValue = formData.get("rating");
    const rating =
      typeof ratingValue === "string" ? Number(ratingValue) : Number.NaN;
    const commentValue = formData.get("comment");
    const comment =
      typeof commentValue === "string" ? commentValue.trim() : "";
    const nameValue = formData.get("name");
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const emailValue = formData.get("email");
    const email =
      typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    const imageFiles = formData.getAll("images");
    const removeImages = formData.get("removeImages") === "true";
    const uploadedFiles = imageFiles.filter(
      (file): file is File => file instanceof File && file.size > 0
    );

    if (imageFiles.some((file) => !(file instanceof File))) {
      return NextResponse.json(
        { success: false, message: "Choose valid image files." },
        { status: 400 }
      );
    }

    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Choose a rating from 1 to 5 stars." },
        { status: 400 }
      );
    }
    if (uploadedFiles.length > maxReviewImages) {
      return NextResponse.json(
        { success: false, message: `Upload up to ${maxReviewImages} images per review.` },
        { status: 400 }
      );
    }
    if (comment.length < 10 || comment.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Review text must be between 10 and 1,000 characters." },
        { status: 400 }
      );
    }
    if (!name || name.length > 120) {
      return NextResponse.json(
        { success: false, message: "Enter a name no longer than 120 characters." },
        { status: 400 }
      );
    }
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: { slug, availability: true, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const existingReview = await prisma.productReview.findUnique({
      where: {
        userId_productId: { userId: user.id, productId: product.id },
      },
      select: { images: true },
    });

    const newImagePaths: string[] = [];
    try {
      for (const file of uploadedFiles) {
        const result = await saveUploadedImage(file, "reviews");
        if (!result.success) {
          throw new InvalidReviewImageError(result.message, result.status);
        }
        newImagePaths.push(result.image);
      }

      const images = uploadedFiles.length
        ? newImagePaths
        : removeImages
          ? []
          : existingReview?.images ?? [];
      const review = await prisma.productReview.upsert({
        where: {
          userId_productId: { userId: user.id, productId: product.id },
        },
        create: {
          userId: user.id,
          productId: product.id,
          name,
          email,
          rating,
          comment,
          images,
        },
        update: { name, email, rating, comment, images },
        select: { name: true, rating: true, comment: true, images: true },
      });

      if ((uploadedFiles.length || removeImages) && existingReview) {
        const cleanupResults = await Promise.allSettled(
          existingReview.images
            .filter((image) => reviewImagePathPattern.test(image))
            .map((image) =>
              unlink(
                path.join(
                  process.cwd(),
                  "public",
                  image.replaceAll("/", path.sep)
                )
              )
            )
        );
        for (const result of cleanupResults) {
          if (result.status === "rejected") {
            console.error("Unable to remove a replaced review image:", result.reason);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Your review has been saved.",
        review,
      });
    } catch (error) {
      await Promise.all(
        newImagePaths.map((image) =>
          unlink(
            path.join(process.cwd(), "public", image.replaceAll("/", path.sep))
          ).catch((cleanupError: unknown) => {
            console.error("Unable to clean up an uploaded review image:", cleanupError);
          })
        )
      );
      if (error instanceof InvalidReviewImageError) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: error.status }
        );
      }
      throw error;
    }
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Product reviews POST error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save your product review." },
      { status: 500 }
    );
  }
}
