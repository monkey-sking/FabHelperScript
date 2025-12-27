// 精简示例代码 - 展示如何应用代码精简建议

// ========== 1. 通用工具函数 ==========

const UtilsEnhanced = {
    ...Utils, // 继承原有的 Utils
    
    // 统一的 CSRF Token 获取
    getCsrfTokenOrFail: () => {
        const token = Utils.getCookie('fab_csrftoken');
        if (!token) {
            Utils.checkAuthentication();
            throw new Error("CSRF token not found");
        }
        return token;
    },
    
    // 通用延时函数
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // 批量处理函数
    processInChunks: async (items, chunkSize, processor, delayMs = 0) => {
        const results = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const chunkResults = await processor(chunk);
            results.push(...chunkResults);
            
            if (i + chunkSize < items.length && delayMs > 0) {
                await UtilsEnhanced.delay(delayMs);
            }
        }
        return results;
    },
    
    // 统一错误处理
    handleError: (error, context, shouldStop = false) => {
        Utils.logger('error', `[${context}] ${error.message}`);
        
        if (shouldStop && State.isExecuting) {
            State.isExecuting = false;
            GM_setValue(Config.DB_KEYS.IS_EXECUTING, false);
            UI.updateExecutionButton?.();
        }
        
        if (error.message.includes('CSRF token')) {
            Utils.checkAuthentication();
        }
    }
};

// ========== 2. API 请求优化 ==========

const APIEnhanced = {
    ...API, // 继承原有的 API
    
    // 统一的认证请求
    makeAuthenticatedRequest: async (url, params = {}) => {
        const csrfToken = UtilsEnhanced.getCsrfTokenOrFail();
        const defaultHeaders = {
            'x-csrftoken': csrfToken,
            'x-requested-with': 'XMLHttpRequest',
            'accept': 'application/json, text/plain, */*'
        };
        
        return API.gmFetch({
            method: 'GET',
            url: url,
            headers: { ...defaultHeaders, ...params.headers },
            ...params
        });
    },
    
    // 批量获取商品状态 - 精简版
    batchCheckOwnership: async (uids) => {
        if (!uids || uids.length === 0) return [];
        
        return UtilsEnhanced.processInChunks(
            uids,
            24, // API_CHUNK_SIZE
            async (chunk) => {
                const url = new URL('https://www.fab.com/i/users/me/listings-states');
                chunk.forEach(uid => url.searchParams.append('listing_ids', uid));
                
                try {
                    const response = await APIEnhanced.makeAuthenticatedRequest(url.href);
                    const data = JSON.parse(response.responseText);
                    return API.extractStateData(data, 'BatchCheck');
                } catch (e) {
                    UtilsEnhanced.handleError(e, 'BatchCheckOwnership');
                    return [];
                }
            },
            250 // 延时
        );
    }
};

// ========== 3. 拆分后的 processDetailPage ==========

const WorkerTasks = {
    // 验证工作标签页
    validateWorker: async (workerId) => {
        if (!workerId) return null;
        
        const payload = await GM_getValue(workerId);
        if (!payload || !payload.task) {
            Utils.logger('info', '任务数据已被清理，工作标签页将关闭。');
            return null;
        }
        
        const activeInstance = await GM_getValue('fab_active_instance', null);
        if (activeInstance && activeInstance.id !== payload.instanceId) {
            Utils.logger('warn', `实例不匹配，将关闭此标签页。`);
            await GM_deleteValue(workerId);
            return null;
        }
        
        return payload;
    },
    
    // 执行页面诊断
    performDiagnosis: (logBuffer) => {
        logBuffer.push(`=== 页面状态诊断开始 ===`);
        const report = PageDiagnostics.diagnoseDetailPage();
        
        logBuffer.push(`页面标题: ${report.pageTitle}`);
        logBuffer.push(`可见按钮数量: ${report.buttons.filter(btn => btn.isVisible).length}`);
        
        report.buttons
            .filter(btn => btn.isVisible)
            .forEach(btn => logBuffer.push(`按钮: "${btn.text}" (禁用: ${btn.isDisabled})`));
        
        Object.values(report.priceInfo)
            .filter(price => price.isVisible)
            .forEach(price => logBuffer.push(`价格显示: "${price.text}"`));
        
        report.licenseOptions
            .filter(opt => opt.isVisible)
            .forEach(opt => logBuffer.push(`许可选项: "${opt.text}"`));
        
        logBuffer.push(`=== 页面状态诊断结束 ===`);
        return report;
    },
    
    // API 检查拥有状态
    checkOwnershipAPI: async (uid, logBuffer) => {
        try {
            const url = new URL('https://www.fab.com/i/users/me/listings-states');
            url.searchParams.append('listing_ids', uid);
            
            const response = await APIEnhanced.makeAuthenticatedRequest(url.href);
            const statesData = API.extractStateData(JSON.parse(response.responseText), 'SingleItemCheck');
            
            const isOwned = Array.isArray(statesData) && 
                           statesData.some(s => s?.uid === uid && s.acquired);
            
            logBuffer.push(`API check: item is ${isOwned ? 'already' : 'not'} owned.`);
            return isOwned;
        } catch (e) {
            logBuffer.push(`API ownership check failed: ${e.message}`);
            return false;
        }
    },
    
    // 精简后的主函数
    processDetailPage: async () => {
        if (!UtilsEnhanced.checkAuthentication()) return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const workerId = urlParams.get('workerId');
        if (!workerId) return;
        
        State.isWorkerTab = true;
        State.workerTaskId = workerId;
        
        const startTime = Date.now();
        const forceCloseTimer = setTimeout(() => window.close(), 60000);
        
        try {
            // 验证工作标签页
            const payload = await WorkerTasks.validateWorker(workerId);
            if (!payload) {
                window.close();
                return;
            }
            
            const currentTask = payload.task;
            const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
            
            // 等待页面加载
            await UtilsEnhanced.delay(3000);
            
            // 执行诊断
            WorkerTasks.performDiagnosis(logBuffer);
            
            // API 检查
            const success = await WorkerTasks.checkOwnershipAPI(currentTask.uid, logBuffer);
            
            if (!success) {
                // UI 交互逻辑...（省略）
            }
            
            // 报告结果
            const executionTime = Date.now() - startTime;
            await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                workerId,
                success,
                task: currentTask,
                logs: logBuffer,
                instanceId: payload.instanceId,
                executionTime
            });
            
        } catch (e) {
            UtilsEnhanced.handleError(e, 'ProcessDetailPage', true);
        } finally {
            clearTimeout(forceCloseTimer);
            setTimeout(() => window.close(), 2000);
        }
    }
};

// ========== 4. 状态管理优化 ==========

const StateManager = {
    // 批量加载初始状态
    loadInitialState: async () => {
        const keys = [
            Config.DB_KEYS.APP_STATUS,
            Config.DB_KEYS.LAST_CURSOR,
            Config.DB_KEYS.AUTO_ADD,
            Config.DB_KEYS.REMEMBER_POS,
            Config.DB_KEYS.IS_EXECUTING,
            Config.DB_KEYS.AUTO_RESUME
        ];
        
        const values = await Promise.all(keys.map(key => GM_getValue(key)));
        const [appStatus, lastCursor, autoAdd, rememberPos, isExecuting, autoResume] = values;
        
        Object.assign(State, {
            appStatus: appStatus?.status || 'NORMAL',
            rateLimitStartTime: appStatus?.startTime,
            lastCursor,
            autoAdd: autoAdd || false,
            rememberPos: rememberPos || false,
            isExecuting: isExecuting || false,
            autoResumeEnabled: autoResume !== false
        });
    },
    
    // 批量保存状态
    saveState: async (updates) => {
        const promises = Object.entries(updates).map(([key, value]) => 
            GM_setValue(Config.DB_KEYS[key], value)
        );
        await Promise.all(promises);
    }
};

// ========== 5. UI 创建优化示例 ==========

const UIEnhanced = {
    // 将原来的大函数拆分成多个小函数
    createMainPanel: () => {
        const container = document.createElement('div');
        container.id = Config.UI_CONTAINER_ID;
        container.className = 'fab-helper-container';
        return container;
    },
    
    createTabs: (container) => {
        const tabsHtml = `
            <div class="tabs">
                <button class="tab active" data-tab="dashboard">${Utils.getText('tab_dashboard')}</button>
                <button class="tab" data-tab="settings">${Utils.getText('tab_settings')}</button>
                <button class="tab" data-tab="debug">${Utils.getText('tab_debug')}</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', tabsHtml);
    },
    
    createDashboard: () => {
        const dashboard = document.createElement('div');
        dashboard.id = 'dashboard';
        dashboard.className = 'tab-content active';
        // 仪表板内容...
        return dashboard;
    },
    
    create: () => {
        // 检查是否在详情页
        if (UIEnhanced.isDetailPage()) return false;
        
        const container = UIEnhanced.createMainPanel();
        UIEnhanced.createTabs(container);
        
        container.appendChild(UIEnhanced.createDashboard());
        container.appendChild(UIEnhanced.createSettings());
        container.appendChild(UIEnhanced.createDebug());
        
        document.body.appendChild(container);
        UIEnhanced.attachEventListeners();
        
        return true;
    }
};

// ========== 使用示例 ==========

// 原来的代码：
// const csrfToken = Utils.getCookie('fab_csrftoken');
// if (!csrfToken) {
//     Utils.checkAuthentication();
//     throw new Error("CSRF token not found");
// }

// 精简后：
const csrfToken = UtilsEnhanced.getCsrfTokenOrFail();

// 原来的延时：
// await new Promise(r => setTimeout(r, 250));

// 精简后：
await UtilsEnhanced.delay(250);

// 原来的批量处理：
// 复杂的循环和错误处理...

// 精简后：
const results = await UtilsEnhanced.processInChunks(items, 24, async (chunk) => {
    // 处理逻辑
});
