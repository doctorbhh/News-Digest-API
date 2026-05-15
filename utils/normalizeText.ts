export function normalizeText(
    text: string
): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}