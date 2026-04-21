// Extracts the subdomain from the host header for multi-tenant routing
export const subdomainMiddleware = (req, res, next) => {
  const host = req.headers.host || "";
  // Remove port if testing locally
  const hostname = host.split(":")[0];

  const rootDomains = ["galibrand.cloud", "localhost"];
  const ignoredSubdomains = ["api", "dashboard", "www"];

  let subdomain = null;

  // Identify the subdomain based on configured root domains
  for (const domain of rootDomains) {
    if (hostname.endsWith(`.${domain}`)) {
      subdomain = hostname.replace(`.${domain}`, "");
      break;
    }
  }

  // Ignore specific subdomains (like api or dashboard) or if no subdomain exists
  req.subdomain = !subdomain || ignoredSubdomains.includes(subdomain) ? null : subdomain;
  next();
};