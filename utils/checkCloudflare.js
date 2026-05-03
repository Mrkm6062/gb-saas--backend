import dns from "dns/promises";
import https from "https";

export const checkCloudflare = async (domain) => {
  try {
    // Step 1: Check IP ranges
    const addresses = await dns.resolve4(domain);

    const isCloudflareIP = addresses.some(ip =>
      ip.startsWith("104.") || ip.startsWith("172.") || ip.startsWith("188.")
    );

    // Step 2: Check headers
    const isCloudflareHeader = await new Promise((resolve) => {
      const req = https.get(`https://${domain}`, (res) => {
        const server = res.headers["server"];
        const cfRay = res.headers["cf-ray"];

        if (server?.includes("cloudflare") || cfRay) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      req.on("error", () => resolve(false));
      req.end();
    });

    return isCloudflareIP || isCloudflareHeader;

  } catch (err) {
    return false;
  }
};