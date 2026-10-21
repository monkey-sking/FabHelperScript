/**
 * Fab Helper - Captcha Detection Module
 *
 * 集中识别页面或结算 iframe 中是否出现了人机验证（Cloudflare Turnstile, ArkoseLabs, hCaptcha, reCAPTCHA 等）。
 */
const CAPTCHA_IFRAME_SELECTORS = [
    'iframe[src*="hcaptcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="captcha"]',
    'iframe[src*="turnstile"]',
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="arkoselabs"]',
    'iframe[title*="challenge" i]',
    'iframe[src*="frame=challenge" i]',
    'iframe[title*="reCAPTCHA" i]',
    'iframe[title*="Cloudflare" i]'
];

const CAPTCHA_TEXT_REGEX = /(?:人机验证|确认您是真人|请完成安全验证|我不是机器人|安全检查|verify (?:that )?you are human|i(?:'m| am) not a robot|checking your browser|complete the security check|unusual traffic|challenge-running|cf-turnstile)/i;

/**
 * 判断指定文档中是否存在可见的人机验证组件或验证文案。
 *
 * @param {Document} doc
 * @returns {boolean}
 */
export function isCaptchaPresent(doc) {
    if (!doc) return false;
    try {
        const frames = doc.querySelectorAll(CAPTCHA_IFRAME_SELECTORS.join(', '));
        for (const frame of frames) {
            const rect = frame.getBoundingClientRect ? frame.getBoundingClientRect() : { width: 0, height: 0 };
            const win = frame.ownerDocument?.defaultView || doc.defaultView;
            const style = win?.getComputedStyle ? win.getComputedStyle(frame) : null;
            const isVisible = rect.width > 0 && rect.height > 0 && style?.visibility !== 'hidden' && style?.display !== 'none';
            if (isVisible) return true;
        }
        const text = (doc.body && doc.body.innerText) || '';
        return CAPTCHA_TEXT_REGEX.test(text);
    } catch {
        return false;
    }
}
