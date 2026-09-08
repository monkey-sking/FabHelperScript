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
    // API 优先流水线总开关：开启后用「cursor 分页 + 单标签页 + 速率令牌桶」取代
    // 旧的「滚动 DOM 骗请求 + 7 个 worker 标签页」枚举/领取路径。领取端点
    // POST /i/listings/{uid}/add-to-library 已于 2026-09-08 在登录态下实测确认
    // 返回 204（startingPrice.offerId 与 licenses[].offerId 两种来源均成功入库），
    // 故默认开启。DomClaim（iframe）回落仍由 CLAIM_TRANSPORT 单独控制，未配置时
    // 不注入；ApiClaim 单独即可作为领取后端，hasClaimBackend() 据此放行启动。
    USE_API_PIPELINE: true,
    // 新流水线跑完一程后，是否周期性重新枚举。默认 0 = 不自动重扫：
    // 执行开关保持开启时若自动重扫，脚本会在几秒内把整个免费列表重新翻一遍，
    // 既无意义地反复请求接口，也放大被风控的概率。需要无人值守巡检时
    // 把它配成毫秒数（例如 30 * 60 * 1000 表示每半小时重扫一次）。
    PIPELINE_RESCAN_INTERVAL_MS: 0,
    // 领取传输层：新流水线用哪种方式把商品详情页「送到眼前」（即 DOM 回落路径）。
    //   'none'   —— 不注入 DomClaim。注意：即便为 'none'，ApiClaim（基于已确认端点）
    //               仍作为领取后端，流水线照常启动、走接口领取。
    //   'iframe' —— 额外启用同源隐藏 iframe 的 DOM 领取作为回落。该路径尚未经过线上验证，
    //               所以刻意保持默认关闭：它一旦不工作会把整份列表标成「领取失败」并定型。
    //   （在主标签页里挂同源隐藏 iframe 加载详情页，由主标签页直接驱动其 DOM 完成领取；
    //    www.fab.com 返回 x-frame-options: SAMEORIGIN，同源 iframe 是允许的。）
    // 之所以要单独一个开关而不是跟着 USE_API_PIPELINE 一起开：iframe 领取一旦
    // 不工作，整份免费列表会被逐条标记成「领取失败」且在事件日志里定型，
    // 之后再修好也不会重试。未经线上验证的后端不该由总开关顺带激活。
    CLAIM_TRANSPORT: 'none',
    // 领取 iframe 的标记参数。带这个参数的详情页是流水线自己塞进隐藏 iframe 的，
    // 脚本在该帧里必须立刻退出，否则会二次初始化（实例抢占 / UI 重复 / 任务派发），
    // 与主标签页互相打架。
    CLAIM_FRAME_PARAM: 'fab_claim_frame',
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
        // 事件日志：唯一真相源。按规范 uid 追加写入状态事件，
        // todo / done / failed 全部由它派生，取代多份并行数组手工互清。
        EVENT_LOG: 'fab_event_log_v1',
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
        h2Text: ['已保存在我的库中', 'Saved in My Library', 'Saved in Library', '已保存在库中'],
        // Check for buttons/links with these texts.
        buttonTexts: ['在我的库中查看', 'View in My Library', 'View in Library', '在库中查看', 'View in Account', '在账户中查看', 'View in library'],
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
};
