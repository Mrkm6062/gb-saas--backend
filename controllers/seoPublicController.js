import Domain from "../models/Domain.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Policy from "../models/Policy.js";

// Helper to resolve store canonical or fallback domain
const resolveStoreDomain = async (store, req) => {
  if (store.seoSettings?.canonicalDomain) {
    let domain = store.seoSettings.canonicalDomain.trim();
    if (!/^https?:\/\//i.test(domain)) {
      domain = `https://${domain}`;
    }
    return domain.replace(/\/+$/, ''); // Remove trailing slashes
  }

  // Fallback to custom domain record
  const domainRecord = await Domain.findOne({ storeId: store._id, status: "connected" });
  if (domainRecord) {
    return `https://${domainRecord.domain}`;
  }

  // Fallback to subdomain
  if (store.subdomain) {
    return `https://${store.subdomain}`;
  }

  if (store.storeSlug) {
    return `https://${store.storeSlug}.galibrand.cloud`;
  }

  // Final fallback to request host
  const scheme = req.secure ? 'https' : 'http';
  return `${scheme}://${req.headers.host}`;
};

// GET /robots.txt
export const getRobotsText = async (req, res) => {
  res.type("text/plain");
  res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour Cache

  try {
    if (!req.store) {
      // Fallback for platform root
      return res.send("User-agent: *\nDisallow: /api\nDisallow: /dashboard\nSitemap: https://galibrand.cloud/sitemap.xml");
    }

    const seo = req.store.seoSettings || {};
    const storeDomain = await resolveStoreDomain(req.store, req);

    let robotsContent = "";

    // 1. General Indexing Policy
    if (seo.indexWebsite === false) {
      robotsContent += "User-agent: *\nDisallow: /\n";
    } else {
      robotsContent += "User-agent: *\nAllow: /\nDisallow: /track\nDisallow: /cart\n";
    }

    // 2. Specific AI Bots block directives
    const aiBots = [
      { key: "blockGPTBot", name: "GPTBot" },
      { key: "blockClaudeBot", name: "ClaudeBot" },
      { key: "blockGoogleExtended", name: "Google-Extended" },
      { key: "blockMetaExternalAgent", name: "MetaExternalAgent" },
      { key: "blockAmazonBot", name: "AmazonBot" },
      { key: "blockApplebotExtended", name: "Applebot-Extended" }
    ];

    aiBots.forEach(bot => {
      if (seo[bot.key] === true) {
        robotsContent += `\nUser-agent: ${bot.name}\nDisallow: /\n`;
      }
    });

    // 3. Custom Robots Content
    if (seo.customRobotsContent) {
      robotsContent += `\n# Custom Rules\n${seo.customRobotsContent}\n`;
    }

    // 4. Sitemap URL
    if (seo.generateSitemap !== false) {
      robotsContent += `\nSitemap: ${storeDomain}/sitemap.xml\n`;
    }

    res.send(robotsContent.trim());
  } catch (error) {
    console.error("robots.txt generation error:", error);
    res.status(500).send("Internal Server Error");
  }
};

// GET /llms.txt
export const getLlmsText = async (req, res) => {
  res.type("text/plain");
  res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour Cache

  try {
    if (!req.store) {
      return res.send("# Galibrand Cloud Platform\nAI Agent directives not configured for root platform.");
    }

    const seo = req.store.seoSettings || {};
    const storeDomain = await resolveStoreDomain(req.store, req);

    let llmsContent = `# ${req.store.storeName || 'Store'} AI & LLM Policy\n`;
    llmsContent += `Canonical Domain: ${storeDomain}\n\n`;

    llmsContent += `## AI Crawling & Scraping Permissions\n`;
    llmsContent += `- **AI Search & Answer Retrieval** (e.g. Perplexity, ChatGPT Search): ${seo.allowAiSearch !== false ? 'Allowed' : 'Disallowed'}\n`;
    llmsContent += `- **Direct Assistant Input Retrieval** (e.g. Chat context fetching): ${seo.allowAiInput !== false ? 'Allowed' : 'Disallowed'}\n`;
    llmsContent += `- **Model Training Scrapes** (e.g. training datasets): ${seo.allowAiTraining === true ? 'Allowed' : 'Disallowed'}\n\n`;

    if (seo.customLlmsContent) {
      llmsContent += `## Custom AI & LLM Instructions\n`;
      llmsContent += `${seo.customLlmsContent}\n`;
    }

    res.send(llmsContent.trim());
  } catch (error) {
    console.error("llms.txt generation error:", error);
    res.status(500).send("Internal Server Error");
  }
};

// GET /sitemap.xml
export const getSitemapXml = async (req, res) => {
  res.type("application/xml");
  res.setHeader("Cache-Control", "public, max-age=21600"); // 6 hours Cache

  try {
    if (!req.store) {
      // Fallback for platform root
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://galibrand.cloud/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
    }

    const seo = req.store.seoSettings || {};

    // Check if sitemap generation is disabled for this store
    if (seo.generateSitemap === false) {
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`);
    }

    const storeDomain = await resolveStoreDomain(req.store, req);

    // Initial Homepage URL
    let urls = [
      {
        loc: `${storeDomain}/`,
        lastmod: req.store.updatedAt ? req.store.updatedAt.toISOString() : new Date().toISOString(),
        changefreq: 'daily',
        priority: '1.0'
      }
    ];

    // Queries to fetch items concurrently
    const queries = [];

    // Products (exclude deleted/hidden product files. Mongoose doesn't have soft delete but has isActive flag)
    const includeProducts = seo.sitemapIncludeProducts !== false;
    if (includeProducts) {
      queries.push(
        Product.find({ storeId: req.store._id, isActive: true })
          .select("slug updatedAt")
          .lean()
          .then(products => {
            return products.map(prod => {
              const prodSlug = prod.slug || prod._id.toString();
              return {
                loc: `${storeDomain}/product/${prodSlug}`,
                lastmod: prod.updatedAt ? new Date(prod.updatedAt).toISOString() : new Date().toISOString(),
                changefreq: 'weekly',
                priority: '0.7'
              };
            });
          })
      );
    }

    // Categories
    const includeCategories = seo.sitemapIncludeCategories !== false;
    if (includeCategories) {
      queries.push(
        Category.find({ store: req.store._id, status: "active" })
          .select("slug updatedAt")
          .lean()
          .then(categories => {
            return categories.map(cat => {
              const catSlug = cat.slug || cat._id.toString();
              return {
                loc: `${storeDomain}/category/${catSlug}`,
                lastmod: cat.updatedAt ? new Date(cat.updatedAt).toISOString() : new Date().toISOString(),
                changefreq: 'weekly',
                priority: '0.8'
              };
            });
          })
      );
    }

    // Policies/Static Pages
    const includePages = seo.sitemapIncludePages !== false;
    if (includePages) {
      queries.push(
        Policy.find({ storeId: req.store._id })
          .select("title updatedAt")
          .lean()
          .then(policies => {
            return policies.map(policy => {
              const policySlug = policy.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return {
                loc: `${storeDomain}/policy/${policySlug}`,
                lastmod: policy.updatedAt ? new Date(policy.updatedAt).toISOString() : new Date().toISOString(),
                changefreq: 'monthly',
                priority: '0.5'
              };
            });
          })
      );
    }

    // Await all queries and aggregate URLs
    const queryResults = await Promise.all(queries);
    queryResults.forEach(resultSet => {
      urls = urls.concat(resultSet);
    });

    // Build sitemap XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    urls.forEach(urlObj => {
      xml += `  <url>\n`;
      xml += `    <loc>${urlObj.loc}</loc>\n`;
      xml += `    <lastmod>${urlObj.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${urlObj.changefreq}</changefreq>\n`;
      xml += `    <priority>${urlObj.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.send(xml);
  } catch (error) {
    console.error("sitemap.xml generation error:", error);
    res.status(500).send("Internal Server Error");
  }
};
