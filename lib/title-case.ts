const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to"]);

// Keeps existing capitals, so "PayPal" stays as it is.
export const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
