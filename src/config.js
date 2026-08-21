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
    WORKER_TIMEOUT: 90000, // 工作标签页超时时间(watchdog 判定卡死)。领取一般 <1min，留足余量避免误杀慢任务
    KEEPALIVE_TICK_MS: 2000, // 后台保活心跳间隔(Web Worker postMessage 频率)
    ENABLE_FREEZE_GUARD: true, // 是否启用 WebRTC 防整页冻结(锁屏/最小化场景需要)
    UI_CONTAINER_ID: 'fab-helper-container',
    UI_LOG_ID: 'fab-helper-log',
    DB_KEYS: {
        DONE: 'fab_done_v8',
        FAILED: 'fab_failed_v8',
        TODO: 'fab_todo_v1', // 用于永久存储待办列表
        HIDE: 'fab_hide_v8',
        AUTO_ADD: 'fab_autoAdd_v8', // 自动添加设置键
        AUTO_SCROLL: 'fab_autoScroll_v1', // 自动滚动页面（自动扫描全部）开关键
        REMEMBER_POS: 'fab_rememberPos_v8',
        LAST_CURSOR: 'fab_lastCursor_v8', // Store only the cursor string
        // 每个 worker 使用独立的回传键（前缀 + workerId），避免多标签页并发完成时
        // 后者覆盖前者导致报告丢失 / 重复加库的竞态（旧版单键 WORKER_DONE 的 P0 根因）。
        WORKER_DONE_PREFIX: 'fab_worker_done_v8_',
        // 历史遗留键，保留以兼容残存的旧值读取。
        WORKER_DONE: 'fab_worker_done_v8',
        APP_STATUS: 'fab_app_status_v1', // For tracking 429 rate limiting
        STATUS_HISTORY: 'fab_status_history_v1', // 状态历史记录持久化
        AUTO_RESUME: 'fab_auto_resume_v1', // 自动恢复功能设置
        IS_EXECUTING: 'fab_is_executing_v1', // 执行状态保存
        AUTO_REFRESH_EMPTY: 'fab_auto_refresh_empty_v1', // 无商品可见时自动刷新
        HIDE_DISCOUNTED: 'fab_hideDiscounted_v8', // 隐藏打折的付费商品
        HIDE_PAID: 'fab_hidePaid_v8', // 隐藏所有付费商品
        BLOCK_RESOURCES: 'fab_block_resources_v1', // 禁用大资源设置键
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
        h2Text: ['已保存在我的库中', 'Saved in My Library', 'Saved in Library', '已保存在库中', '已保存在账户中', '已在库中'],
        // Check for buttons/links with these texts.
        buttonTexts: ['在我的库中查看', 'View in My Library', 'View in Library', '在库中查看', 'View in Account', '在账户中查看', '已在库中', '已拥有'],
        // Check for the temporary success popup (snackbar).
        snackbarText: ['产品已添加至您的库中', 'Product added to your library', 'Added to library', '已添加至您的库中', '已加入您的库中'],
    },
    ACQUISITION_TEXT_SET: new Set([
        '添加到我的库', 'Add to my library',
        '添加到库', 'Add to Library', 'Add to library',
        '加入购物车', 'Add to cart', 'Add to Cart',
        '结账', 'Checkout',
        '立即获取', 'Get it', 'Get It',
        '免费获取', 'Get for free', 'Get for Free', 'Get Free', 'Get free',
        '免费领取', '领取', '获取',
        '完成订单', 'Complete order', 'Complete Order',
        '立即购买', 'Buy now', 'Buy Now',
        '获取资源', 'Get asset', 'Get Asset',
        'Place order', 'Place Order', '确认订单', '下单', '免费下单',
        'Claim', 'Claim for free', 'Claim Item', 'Claim item', 'Claim free',
        'Add to Account', 'Add to account', '添加到账户'
    ]),

    // Kept for backward compatibility with recon logic.
    SAVED_TEXT_SET: new Set([
        '已保存在我的库中', 'Saved in My Library', 'Saved in my library',
        '已保存在库中', 'Saved in Library', 'Saved in library',
        '在我的库中', 'In My Library', 'In my library',
        '在库中', 'In Library', 'In library',
        '已在库中', 'In Account', 'In account', '已在账户中', '已拥有', '已保存'
    ]),
    FREE_TEXT_SET: new Set(['免费', 'Free', 'Free*', '0.00', '起始价格 免费', 'Starting at Free', '低至 免费']),
    EXTERNAL_CTA_TEXT_SET: new Set([
        '在外部网站查看',
        'View on external website'
    ]),
    // 添加一个实例ID，用于防止多实例运行
    INSTANCE_ID: 'fab_instance_id_' + Math.random().toString(36).substring(2, 15),
    STATUS_CHECK_INTERVAL: 3000, // Status check interval in ms (throttled to reduce log spam)
};
