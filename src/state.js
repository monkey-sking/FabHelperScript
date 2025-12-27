/**
 * Fab Helper - Global State Management
 */

export const State = {
    db: {
        todo: [],   // 待办任务列表
        done: [],   // 已完成任务列表
        failed: [], // 失败任务列表
    },
    hideSaved: false, // 是否隐藏已保存项目
    autoAddOnScroll: false, // 是否在滚动时自动添加任务
    rememberScrollPosition: false, // 是否记住滚动位置
    autoResumeAfter429: false, // 是否在429后自动恢复
    autoRefreshEmptyPage: true, // 新增：无商品可见时自动刷新（默认开启）
    debugMode: false, // 是否启用调试模式
    lang: 'zh', // 当前语言，默认中文，会在detectLanguage中更新
    isExecuting: false, // 是否正在执行任务
    isRefreshScheduled: false, // 新增：标记是否已经安排了页面刷新
    isWorkerTab: false, // 是否是工作标签页
    totalTasks: 0, // API扫描的总任务数
    completedTasks: 0, // API扫描的已完成任务数
    isDispatchingTasks: false, // 新增：标记是否正在派发任务
    savedCursor: null, // Holds the loaded cursor for hijacking
    // --- NEW: State for 429 monitoring ---
    appStatus: 'NORMAL', // 'NORMAL' or 'RATE_LIMITED'
    rateLimitStartTime: null,
    normalStartTime: Date.now(),
    successfulSearchCount: 0,
    statusHistory: [], // Holds the history of NORMAL/RATE_LIMITED periods
    // --- 限速恢复相关状态 ---
    consecutiveSuccessCount: 0, // 连续成功请求计数
    requiredSuccessCount: 3, // 退出限速需要的连续成功请求数
    lastLimitSource: '', // 最后一次限速的来源
    isCheckingRateLimit: false, // 是否正在检查限速状态
    // --- End New State ---
    showAdvanced: false,
    activeWorkers: 0,
    runningWorkers: {}, // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
    lastKnownHref: null, // To detect SPA navigation
    hiddenThisPageCount: 0,
    executionTotalTasks: 0, // For execution progress
    executionCompletedTasks: 0, // For execution progress
    executionFailedTasks: 0, // For execution progress
    watchdogTimer: null,
    // UI-related state
    uiExpanded: true,
    logs: [],
    valueChangeListeners: [],
    // For remembering scroll position
    knownCursors: new Set(),
    lastSortMethod: null,
    // Session-level tracking (not persisted)
    sessionCompleted: new Set(),
    sessionFailed: new Set(),
    // 工作线程标签页任务ID
    workerTaskId: null,
    // 是否显示状态历史表格
    showStatusHistory: false,
    // Launcher flag
    hasRunDomPart: false,
    // Observer debounce timer
    observerDebounceTimer: null,
    // UI element references - populated by UI.create()
    UI: {
        container: null,
        tabs: {},
        tabContents: {},
        statusVisible: null,
        statusTodo: null,
        statusDone: null,
        statusFailed: null,
        statusHidden: null,
        execBtn: null,
        syncBtn: null,
        hideBtn: null,
        logPanel: null,
        savedPositionDisplay: null,
        debugContent: null,
        historyContainer: null,
    },
};
