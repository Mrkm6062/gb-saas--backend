import { z } from "zod";

// Slug pattern: lowercase alphanumeric, dashes, underscores, and slashes for nesting (e.g. "/about-us" or "lp/promo")
const slugRegex = /^[a-z0-9\-_\/]+$/;

export const customPageSchemaVal = z.object({
  title: z.string().min(1, "Title is required").max(150, "Title is too long"),
  slug: z.string()
    .min(1, "Slug is required")
    .max(100, "Slug is too long")
    .regex(slugRegex, "Slug must be lowercase and contain only alphanumeric characters, dashes, underscores, or slashes"),
  pageType: z.string().optional().default("custom"),
  description: z.string().max(500, "Description too long").optional().default(""),
  isHomepage: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(false),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  headHTML: z.string().max(500 * 1024, "Head HTML exceeds maximum size of 500KB").optional().default(""),
  bodyHTML: z.string().max(2 * 1024 * 1024, "Body HTML exceeds maximum size of 2MB").optional().default(""),
  customCSS: z.string().max(500 * 1024, "Custom CSS exceeds maximum size of 500KB").optional().default(""),
  customJS: z.string().max(500 * 1024, "Custom JS exceeds maximum size of 500KB").optional().default(""),
  seo: z.object({
    metaTitle: z.string().max(150).optional().default(""),
    metaDescription: z.string().max(300).optional().default(""),
    keywords: z.string().max(200).optional().default(""),
    canonical: z.string().max(200).optional().default(""),
    robots: z.string().max(100).optional().default("index, follow"),
    ogTitle: z.string().max(150).optional().default(""),
    ogDescription: z.string().max(300).optional().default(""),
    ogImage: z.string().max(500).optional().default(""),
  }).optional(),
  favicon: z.string().max(500).optional().default(""),
  author: z.string().max(100).optional().default(""),
  pageIcon: z.string().max(100).optional().default(""),
  thumbnail: z.string().max(500).optional().default(""),
  sortOrder: z.number().optional().default(0),
});

export const customPageUpdateSchemaVal = customPageSchemaVal.partial();

const menuItemSchemaVal = z.lazy(() =>
  z.object({
    label: z.string().min(1, "Menu item label is required").max(100),
    url: z.string().max(500).optional().default(""),
    pageId: z.union([z.string(), z.object({ _id: z.string() })]).nullable().optional(),
    target: z.enum(["_self", "_blank"]).optional().default("_self"),
    order: z.number().optional().default(0),
    icon: z.string().optional().default(""),
    visible: z.boolean().optional().default(true),
    children: z.array(menuItemSchemaVal).optional().default([]),
  })
);

export const customMenuSchemaVal = z.object({
  menuName: z.string().min(1, "Menu name is required").max(100),
  menuItems: z.array(menuItemSchemaVal),
});
