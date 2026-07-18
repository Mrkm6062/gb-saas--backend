/**
 * Sanitizes HTML input to prevent XSS attacks.
 * It strips out script tags, on* event handlers, javascript: URIs,
 * and forces sandboxing on iframe tags.
 */
export const sanitizeHTML = (html) => {
  if (!html) return "";

  // 1. Remove script tags and their contents
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Remove on* event handlers (e.g. onload, onclick, onerror)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // 3. Prevent javascript: protocol links
  clean = clean.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');

  // 4. Sandbox all iframes (force allow-scripts only, preventing top-navigation hijacking or cookie theft)
  clean = clean.replace(/<iframe\b([^>]*)>/gi, (match, attrs) => {
    if (/sandbox/i.test(attrs)) {
      // Restrict existing sandbox attribute to allow-scripts only
      return `<iframe ${attrs.replace(/sandbox\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, 'sandbox="allow-scripts"')}>`;
    } else {
      return `<iframe sandbox="allow-scripts" ${attrs}>`;
    }
  });

  // 5. Strip other unsafe tags (object, embed, applet, meta, frame, frameset)
  clean = clean.replace(/<(object|embed|applet|meta|frame|frameset)\b[^>]*>/gi, "");
  clean = clean.replace(/<\/(object|embed|applet|meta|frame|frameset)>/gi, "");

  return clean;
};
