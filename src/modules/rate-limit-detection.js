/** Only transport status or an error envelope is evidence of throttling.
 * Product descriptions, tags and identifiers may legitimately contain these words/numbers.
 */
const isLimitMessage = value => typeof value === 'string' && /^(?:(?:error|http)\s*[:\s-]*)?(?:429\b|too\s+many\s+requests\b|requests?\s+(?:was|were|has been)\s+throttled\b|rate[ _-]*limit(?:ed|[ _-]*(?:exceeded|reached))?(?:[.!:\s]|$)|请求过于频繁|请求被限流|请求次数过多)/i.test(value.trim());

export function isRateLimitedResponse(status, body) {
    if (Number(status) === 429) return true;
    let value = body;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); }
        catch { return value.length < 2000 && isLimitMessage(value); }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (['results', 'items', 'listings', 'offers'].some(key => Array.isArray(value[key]))) return false;
    return ['detail', 'message', 'error', 'code'].some(key => isLimitMessage(value[key]));
}

export function isRateLimitedPage(title = '', text = '') {
    if (/^(?:(?:error|http)\s*)?429(?:\s*[-:]?\s*too many requests)?(?:\s*[|–-]\s*(?:fab|nginx|cloudflare))?$/i.test(title.trim())
        || /^too many requests(?:\s*[|–-]\s*(?:fab|nginx|cloudflare))?$/i.test(title.trim())) return true;
    return text.length < 2000 && isRateLimitedResponse(0, text);
}
