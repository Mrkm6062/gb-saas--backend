import https from "https";

export const checkSSL = (domain) => {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: "HEAD",
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      // A successful response means the SSL handshake completed
      resolve("active");
    });

    req.on("error", (e) => {
      // Distinguish between actual SSL errors and general connectivity/timeout errors
      if (e.code === "CERT_HAS_EXPIRED" || e.code === "DEPTH_ZERO_SELF_SIGNED_CERT" || e.code === "ERR_TLS_CERT_ALTNAME_INVALID") {
        resolve("failed");
      } else {
        resolve("pending");
      }
    });

    req.on("timeout", () => {
      req.destroy();
      resolve("pending");
    });

    req.end();
  });
};