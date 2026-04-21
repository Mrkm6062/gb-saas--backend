// Extracts the subdomain from the host header for multi-tenant routing
export const subdomainMiddleware = (req, res, next) => {
  // 1. Prioritize Origin header for cross-origin AJAX requests from the storefront
  let host = req.headers.host || "";
  
  if (req.headers.origin) {
    try {
      const originUrl = new URL(req.headers.origin);
      host = originUrl.host;
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Remove port if testing locally
  const hostname = host.split(":")[0];

  // Allow dynamic domain from env, and add support for nip.io testing
  const rootDomains = ["galibrand.cloud", "localhost"];
  if (process.env.ROOT_DOMAIN) rootDomains.push(process.env.ROOT_DOMAIN);

  const ignoredSubdomains = ["api", "dashboard", "www"];

  let subdomain = null;

  // Identify the subdomain based on configured root domains
  for (const domain of rootDomains) {
    if (hostname.endsWith(`.${domain}`)) {
      subdomain = hostname.replace(`.${domain}`, "");
      break;
    }
  }

  // Fallback for nip.io testing on VPS (e.g., sabjiwala.123.45.67.89.nip.io)
  if (!subdomain && hostname.endsWith(".nip.io")) {
    subdomain = hostname.split(".")[0];
  }

  // Ignore specific subdomains (like api or dashboard) or if no subdomain exists
  req.subdomain = !subdomain || ignoredSubdomains.includes(subdomain) ? null : subdomain;

  console.log(`[Subdomain] Host: ${host} | Hostname: ${hostname} | Detected: ${req.subdomain}`);

  next();
};