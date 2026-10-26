const HTML_TAG_PATTERN = /<\/?[A-Za-z][A-Za-z0-9:-]*(?=\s|\/?>)[^>]*>/;

export function containsRawHtml(markdown) {
  return HTML_TAG_PATTERN.test(markdown);
}
