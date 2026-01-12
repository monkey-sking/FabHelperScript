/**
 * Fab Helper - Configuration and Constants
 */
import { en } from './i18n/en.js';
import { zh } from './i18n/zh.js';

export const Config = {
    SCRIPT_NAME: 'Fab Helper (优化版)',
    DB_VERSION: 3,
    DB_NAME: 'fab_helper_db',
    MAX_CONCURRENT_WORKERS: 7, // 最大并发工作标签页数量
    WORKER_TIMEOUT: 30000, // 工作标签页超时时间
    UI_CONTAINER_ID: 'fab-helper-container',
    UI_LOG_ID: 'fab-helper-log',
    DB_KEYS: {
        DONE: 'fab_done_v8',
        FAILED: 'fab_failed_v8',
        TODO: 'fab_todo_v1', // 用于永久存储待办列表
        HIDE: 'fab_hide_v8',
        AUTO_ADD: 'fab_autoAdd_v8', // 自动添加设置键
        REMEMBER_POS: 'fab_rememberPos_v8',
        LAST_CURSOR: 'fab_lastCursor_v8', // Store only the cursor string
        WORKER_DONE: 'fab_worker_done_v8', // This is the ONLY key workers use to report back.
        APP_STATUS: 'fab_app_status_v1', // For tracking 429 rate limiting
        STATUS_HISTORY: 'fab_status_history_v1', // 状态历史记录持久化
        AUTO_RESUME: 'fab_auto_resume_v1', // 自动恢复功能设置
        IS_EXECUTING: 'fab_is_executing_v1', // 执行状态保存
        AUTO_REFRESH_EMPTY: 'fab_auto_refresh_empty_v1', // 无商品可见时自动刷新
        // 其他键值用于会话或主标签页持久化
    },
    SELECTORS: {
        card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
        cardLink: 'a[href*="/listings/"]',
        addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
        rootElement: '#root',
        successBanner: 'div[class*="Toast-root"]',
        freeStatus: '.csZFzinF',
        ownedStatus: '.cUUvxo_s'
    },
    TEXTS: {
        en,
        zh
    },
    // Centralized keyword sets, based STRICTLY on the rules in FAB_HELPER_RULES.md
    OWNED_SUCCESS_CRITERIA: {
        // Check for an H2 tag with the specific success text.
        h2Text: ['已保存在我的库中', 'Saved in My Library'],
        // Check for buttons/links with these texts.
        buttonTexts: ['在我的库中查看', 'View in My Library'],
        // Check for the temporary success popup (snackbar).
        snackbarText: ['产品已添加至您的库中', 'Product added to your library'],
    },
    ACQUISITION_TEXT_SET: new Set(['添加到我的库', 'Add to my library']),

    // Kept for backward compatibility with recon logic.
    SAVED_TEXT_SET: new Set(['已保存在我的库中', 'Saved in My Library', '在我的库中', 'In My Library']),
    FREE_TEXT_SET: new Set(['免费', 'Free', '起始价格 免费', 'Starting at Free']),
    // 添加一个实例ID，用于防止多实例运行
    INSTANCE_ID: 'fab_instance_id_' + Math.random().toString(36).substring(2, 15),
    STATUS_CHECK_INTERVAL: 3000, // Status check interval in ms (throttled to reduce log spam)
};
