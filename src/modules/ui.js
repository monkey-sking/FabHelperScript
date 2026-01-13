/**
 * Fab Helper - UI Module
 * 
 * This module handles:
 * - Creating the main UI container and styles
 * - Dashboard, Settings, and Debug tabs
 * - Status display updates
 * - Log panel management
 * - History display
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { PageDiagnostics } from './page-diagnostics.js';
import { Database } from './database.js';
import { RateLimitManager } from './rate-limit-manager.js';

// Forward declaration for TaskRunner (will be set via dependency injection)
let TaskRunner = null;

export function setTaskRunnerReference(taskRunnerModule) {
    TaskRunner = taskRunnerModule;
}

export const UI = {
    init: () => {
        return UI.create();
    },

    create: () => {
        // Detect detail page by presence of acquisition buttons
        const acquisitionButton = [...document.querySelectorAll('button')].find(btn =>
            [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
        );

        const downloadTexts = ['下载', 'Download'];
        const downloadButton = [...document.querySelectorAll('a[href*="/download/"], button')].find(btn =>
            downloadTexts.some(text => btn.textContent.includes(text))
        );

        if (acquisitionButton || downloadButton) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('workerId')) return false;
            Utils.logger('info', "On a detail page (detected by action buttons), skipping UI creation.");
            return false;
        }

        if (document.getElementById(Config.UI_CONTAINER_ID)) return true;

        // Style Injection
        const styles = `
            :root {
                --bg-color: rgba(28, 28, 30, 0.9);
                --border-color: rgba(255, 255, 255, 0.15);
                --text-color-primary: #f5f5f7;
                --text-color-secondary: #a0a0a5;
                --radius-l: 12px;
                --radius-m: 8px;
                --radius-s: 6px;
                --blue: #007aff; --pink: #ff2d55; --green: #34c759;
                --orange: #ff9500; --gray: #8e8e93; --dark-gray: #3a3a3c;
                --blue-bg: rgba(0, 122, 255, 0.2);
            }
            #${Config.UI_CONTAINER_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                background: var(--bg-color);
                backdrop-filter: blur(15px) saturate(1.8);
                -webkit-backdrop-filter: blur(15px) saturate(1.8);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-l);
                color: var(--text-color-primary);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                width: 300px;
                font-size: 14px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            #${Config.UI_CONTAINER_ID} *, #${Config.UI_CONTAINER_ID} *::before, #${Config.UI_CONTAINER_ID} *::after {
                box-sizing: border-box;
            }
            .fab-helper-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
            }
            .fab-helper-tabs button {
                flex: 1;
                padding: 10px 0;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                transition: color 0.2s, border-bottom 0.2s;
                border-bottom: 2px solid transparent;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .fab-helper-tabs button.active {
                color: var(--text-color-primary);
                border-bottom: 2px solid var(--blue);
            }
            .fab-helper-tab-content {
                padding: 12px;
            }
            .fab-helper-status-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .fab-helper-status-item {
                background: var(--dark-gray);
                padding: 8px 6px;
                border-radius: var(--radius-m);
                font-size: 12px;
                color: var(--text-color-secondary);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 2px;
                min-width: 0;
                flex-grow: 1;
                flex-basis: calc((100% - 12px) / 3);
            }
            .fab-helper-status-label {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                white-space: nowrap;
            }
            .fab-helper-status-item span {
                display: block;
                font-size: 18px;
                font-weight: 600;
                color: #fff;
                margin-top: 0;
            }
            .fab-helper-execute-btn {
                width: 100%;
                border: none;
                border-radius: var(--radius-m);
                padding: 12px 14px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #fff;
                background: var(--blue);
                margin-bottom: 12px;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
            }
            .fab-helper-execute-btn.executing {
                background: var(--pink);
            }
            .fab-helper-actions {
                display: flex;
                gap: 8px;
            }
            .fab-helper-actions button {
                flex: 1;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                background: var(--dark-gray);
                border: none;
                border-radius: var(--radius-m);
                color: var(--text-color-primary);
                padding: 8px 6px;
                cursor: pointer;
                transition: background-color 0.2s;
                white-space: nowrap;
                font-size: 13.5px;
                font-weight: normal;
            }
            .fab-helper-actions button:hover {
                background: #4a4a4c;
            }
            .fab-log-container {
                padding: 0 12px 12px 12px;
                border-bottom: 1px solid var(--border-color);
                margin-bottom: 12px;
            }
            .fab-log-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                margin-top: 8px;
            }
            .fab-log-header span {
                font-size: 14px;
                font-weight: 500;
                color: var(--text-color-secondary);
            }
            .fab-log-controls button {
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                cursor: pointer;
                padding: 4px;
                font-size: 18px;
                line-height: 1;
            }
            #${Config.UI_LOG_ID} {
                background: rgba(10,10,10,0.85);
                color: #ddd;
                font-size: 11px;
                line-height: 1.4;
                padding: 8px;
                border-radius: var(--radius-m);
                max-height: 150px;
                overflow-y: auto;
                min-height: 50px;
                display: flex;
                flex-direction: column-reverse;
                box-shadow: inset 0 1px 4px rgba(0,0,0,0.2);
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
            }
            #${Config.UI_LOG_ID}::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            #${Config.UI_LOG_ID}::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
            }
            #${Config.UI_LOG_ID}::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }
            .fab-setting-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-color);
            }
            .fab-setting-row:last-child {
                border-bottom: none;
            }
            .fab-setting-label {
                font-size: 14px;
            }
            .fab-toggle-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }
            .fab-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .fab-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--dark-gray);
                transition: .4s;
                border-radius: 24px;
            }
            .fab-toggle-slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .fab-toggle-slider {
                background-color: var(--blue);
            }
            input:checked + .fab-toggle-slider:before {
                transform: translateX(20px);
            }
            .fab-debug-history-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
            }
            .fab-debug-history-container::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            .fab-debug-history-container::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
            }
            .fab-debug-history-container::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const container = document.createElement('div');
        container.id = Config.UI_CONTAINER_ID;
        State.UI.container = container;

        // Header with Version
        const header = document.createElement('div');
        header.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
        const title = document.createElement('span');
        title.textContent = Utils.getText('app_title');
        title.style.fontWeight = '600';
        const version = document.createElement('span');
        version.textContent = `v${GM_info.script.version}`;
        version.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); background: var(--dark-gray); padding: 2px 5px; border-radius: var(--radius-s);';
        header.append(title, version);
        container.appendChild(header);

        // Tab Controls
        const tabContainer = document.createElement('div');
        tabContainer.className = 'fab-helper-tabs';
        const tabs = ['dashboard', 'settings', 'debug'];
        tabs.forEach(tabName => {
            const btn = document.createElement('button');
            btn.textContent = Utils.getText(`tab_${tabName}`);
            btn.onclick = () => UI.switchTab(tabName);
            if (tabName === 'dashboard') btn.classList.add('active');
            tabContainer.appendChild(btn);
            State.UI.tabs[tabName] = btn;
        });
        container.appendChild(tabContainer);

        // Dashboard Tab
        const dashboardContent = document.createElement('div');
        dashboardContent.className = 'fab-helper-tab-content';
        dashboardContent.style.display = 'block';
        State.UI.tabContents.dashboard = dashboardContent;

        const statusBar = document.createElement('div');
        statusBar.className = 'fab-helper-status-bar';

        const createStatusItem = (id, label, icon) => {
            const item = document.createElement('div');
            item.className = 'fab-helper-status-item';
            item.innerHTML = `<div class="fab-helper-status-label">${icon} ${label}</div><span id="${id}">0</span>`;
            return item;
        };

        State.UI.statusVisible = createStatusItem('fab-status-visible', Utils.getText('visible'), '👁️');
        State.UI.statusTodo = createStatusItem('fab-status-todo', Utils.getText('todo'), '📥');
        State.UI.statusDone = createStatusItem('fab-status-done', Utils.getText('added'), '✅');
        State.UI.statusFailed = createStatusItem('fab-status-failed', Utils.getText('failed'), '❌');
        State.UI.statusFailed.style.cursor = 'pointer';
        State.UI.statusFailed.title = Utils.getText('tooltip_open_failed');
        State.UI.statusFailed.onclick = () => {
            if (State.db.failed.length === 0) {
                Utils.logger('info', Utils.getText('failed_list_empty'));
                return;
            }
            if (window.confirm(Utils.getText('confirm_open_failed', State.db.failed.length))) {
                Utils.logger('info', Utils.getText('opening_failed_items', State.db.failed.length));
                State.db.failed.forEach(task => {
                    GM_openInTab(task.url, { active: false });
                });
            }
        };
        State.UI.statusHidden = createStatusItem('fab-status-hidden', Utils.getText('hidden'), '🙈');
        statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed, State.UI.statusVisible, State.UI.statusHidden);

        State.UI.execBtn = document.createElement('button');
        State.UI.execBtn.className = 'fab-helper-execute-btn';
        State.UI.execBtn.onclick = () => TaskRunner && TaskRunner.toggleExecution();

        if (State.isExecuting) {
            State.UI.execBtn.innerHTML = `<span>${Utils.getText('executing')}</span>`;
            State.UI.execBtn.classList.add('executing');
        } else {
            State.UI.execBtn.textContent = Utils.getText('execute');
            State.UI.execBtn.classList.remove('executing');
        }

        const actionButtons = document.createElement('div');
        actionButtons.className = 'fab-helper-actions';

        State.UI.syncBtn = document.createElement('button');
        State.UI.syncBtn.textContent = '🔄 ' + Utils.getText('sync');
        State.UI.syncBtn.onclick = () => TaskRunner && TaskRunner.refreshVisibleStates();

        State.UI.hideBtn = document.createElement('button');
        State.UI.hideBtn.onclick = () => TaskRunner && TaskRunner.toggleHideSaved();

        actionButtons.append(State.UI.syncBtn, State.UI.hideBtn);

        // Log Panel
        const logContainer = document.createElement('div');
        logContainer.className = 'fab-log-container';

        const logHeader = document.createElement('div');
        logHeader.className = 'fab-log-header';
        const logTitle = document.createElement('span');
        logTitle.textContent = Utils.getText('operation_log');
        const logControls = document.createElement('div');
        logControls.className = 'fab-log-controls';

        const copyLogBtn = document.createElement('button');
        copyLogBtn.innerHTML = '📄';
        copyLogBtn.title = Utils.getText('copyLog');
        copyLogBtn.onclick = () => {
            navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
                const originalText = copyLogBtn.textContent;
                copyLogBtn.textContent = '✅';
                setTimeout(() => { copyLogBtn.textContent = originalText; }, 1500);
            }).catch(err => Utils.logger('error', 'Failed to copy log:', err));
        };

        const clearLogBtn = document.createElement('button');
        clearLogBtn.innerHTML = '🗑️';
        clearLogBtn.title = Utils.getText('clearLog');
        clearLogBtn.onclick = () => { State.UI.logPanel.innerHTML = ''; };

        logControls.append(copyLogBtn, clearLogBtn);
        logHeader.append(logTitle, logControls);

        State.UI.logPanel = document.createElement('div');
        State.UI.logPanel.id = Config.UI_LOG_ID;

        logContainer.append(logHeader, State.UI.logPanel);

        // Position Display
        const positionContainer = document.createElement('div');
        positionContainer.className = 'fab-helper-position-container';
        positionContainer.style.cssText = 'margin: 8px 0; padding: 6px 8px; background-color: rgba(0,0,0,0.05); border-radius: 4px; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center;';

        const positionIcon = document.createElement('span');
        positionIcon.textContent = Utils.getText('position_indicator');
        positionIcon.style.marginRight = '4px';

        const positionInfo = document.createElement('span');
        positionInfo.textContent = Utils.decodeCursor(State.savedCursor);
        // Fix overflow: allow text to shrink and show ellipsis so the reset button stays visible
        positionInfo.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        State.UI.savedPositionDisplay = positionInfo;

        positionContainer.appendChild(positionIcon);
        positionContainer.appendChild(positionInfo);

        const clearPositionBtn = document.createElement('button');
        clearPositionBtn.textContent = '🔄';
        clearPositionBtn.title = Utils.getText('clear_position_tooltip');
        clearPositionBtn.style.cssText = 'background: none; border: none; cursor: pointer; margin-left: auto; font-size: 14px; padding: 0 4px; opacity: 0.7; transition: opacity 0.2s;';
        clearPositionBtn.onmouseover = () => { clearPositionBtn.style.opacity = '1'; };
        clearPositionBtn.onmouseout = () => { clearPositionBtn.style.opacity = '0.7'; };
        clearPositionBtn.onclick = async () => {
            if (State.savedCursor) {
                if (confirm(Utils.getText('confirm_reset_position'))) {
                    State.savedCursor = null;
                    await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                    State.UI.savedPositionDisplay.textContent = Utils.getText('no_saved_position');
                    window.location.reload();
                }
            } else {
                Utils.logger('info', Utils.getText('no_position_to_reset'));
            }
        };
        positionContainer.appendChild(clearPositionBtn);

        dashboardContent.append(logContainer, positionContainer, statusBar, State.UI.execBtn, actionButtons);
        container.appendChild(dashboardContent);

        // Settings Tab
        const settingsContent = document.createElement('div');
        settingsContent.className = 'fab-helper-tab-content';
        settingsContent.style.display = 'none';

        const createSettingRow = (labelText, stateKey) => {
            const row = document.createElement('div');
            row.className = 'fab-setting-row';

            const label = document.createElement('span');
            label.className = 'fab-setting-label';
            label.textContent = labelText;

            const switchContainer = document.createElement('label');
            switchContainer.className = 'fab-toggle-switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = State[stateKey];
            input.onchange = (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (!TaskRunner) return;

                if (stateKey === 'autoAddOnScroll') {
                    TaskRunner.toggleAutoAdd();
                } else if (stateKey === 'rememberScrollPosition') {
                    TaskRunner.toggleRememberPosition();
                } else if (stateKey === 'autoResumeAfter429') {
                    TaskRunner.toggleAutoResume();
                } else if (stateKey === 'autoRefreshEmptyPage') {
                    TaskRunner.toggleAutoRefreshEmpty();
                } else if (stateKey === 'hideDiscountedPaid') {
                    TaskRunner.toggleHideDiscountedPaid();
                } else if (stateKey === 'hidePaid') {
                    TaskRunner.toggleHidePaid();
                }
                e.target.checked = State[stateKey];
            };

            const slider = document.createElement('span');
            slider.className = 'fab-toggle-slider';

            switchContainer.append(input, slider);
            row.append(label, switchContainer);

            return row;
        };

        const autoAddSetting = createSettingRow(Utils.getText('setting_auto_add_scroll'), 'autoAddOnScroll');
        settingsContent.appendChild(autoAddSetting);

        const rememberPosSetting = createSettingRow(Utils.getText('setting_remember_position'), 'rememberScrollPosition');
        settingsContent.appendChild(rememberPosSetting);

        const autoResumeSetting = createSettingRow(Utils.getText('setting_auto_resume_429'), 'autoResumeAfter429');
        settingsContent.appendChild(autoResumeSetting);

        const autoRefreshEmptySetting = createSettingRow(Utils.getText('setting_auto_refresh'), 'autoRefreshEmptyPage');
        settingsContent.appendChild(autoRefreshEmptySetting);

        const hideDiscountedPaidSetting = createSettingRow(Utils.getText('setting_hide_discounted'), 'hideDiscountedPaid');
        settingsContent.appendChild(hideDiscountedPaidSetting);

        const hidePaidSetting = createSettingRow(Utils.getText('setting_hide_paid'), 'hidePaid');
        settingsContent.appendChild(hidePaidSetting);

        const resetButton = document.createElement('button');
        resetButton.textContent = Utils.getText('clear_all_data');
        resetButton.style.cssText = 'width: 100%; margin-top: 15px; background-color: var(--pink); color: white; padding: 10px; border-radius: var(--radius-m); border: none; cursor: pointer;';
        resetButton.onclick = Database.resetAllData;
        settingsContent.appendChild(resetButton);

        // Debug mode toggle
        const debugModeRow = document.createElement('div');
        debugModeRow.className = 'fab-setting-row';
        debugModeRow.title = Utils.getText('setting_debug_tooltip');

        const debugLabel = document.createElement('span');
        debugLabel.className = 'fab-setting-label';
        debugLabel.textContent = Utils.getText('debug_mode');
        debugLabel.style.color = '#ff9800';

        const debugSwitchContainer = document.createElement('label');
        debugSwitchContainer.className = 'fab-toggle-switch';

        const debugInput = document.createElement('input');
        debugInput.type = 'checkbox';
        debugInput.checked = State.debugMode;
        debugInput.onchange = (e) => {
            State.debugMode = e.target.checked;
            debugModeRow.classList.toggle('active', State.debugMode);
            Utils.logger('info', Utils.getText('log_debug_mode_toggle', State.debugMode ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
            GM_setValue('fab_helper_debug_mode', State.debugMode);
        };

        const debugSlider = document.createElement('span');
        debugSlider.className = 'fab-toggle-slider';

        debugSwitchContainer.append(debugInput, debugSlider);
        debugModeRow.append(debugLabel, debugSwitchContainer);
        debugModeRow.classList.toggle('active', State.debugMode);
        settingsContent.appendChild(debugModeRow);

        State.UI.tabContents.settings = settingsContent;
        container.appendChild(settingsContent);

        // Debug Tab
        const debugContent = document.createElement('div');
        debugContent.className = 'fab-helper-tab-content';
        debugContent.style.display = 'none';
        State.UI.debugContent = debugContent;

        const debugHeader = document.createElement('div');
        debugHeader.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;';

        const debugTitle = document.createElement('h4');
        debugTitle.textContent = Utils.getText('status_history');
        debugTitle.style.cssText = 'margin: 0; font-size: 14px; white-space: nowrap;';

        const debugControls = document.createElement('div');
        debugControls.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

        const copyHistoryBtn = document.createElement('button');
        copyHistoryBtn.textContent = Utils.getText('copy_btn');
        copyHistoryBtn.title = '复制详细历史记录';
        copyHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
        copyHistoryBtn.onclick = () => {
            if (State.statusHistory.length === 0) {
                Utils.logger('info', Utils.getText('no_history_to_copy'));
                return;
            }
            const formatEntry = (entry) => {
                const date = new Date(entry.endTime).toLocaleString();
                if (entry.type === 'STARTUP') {
                    return `🚀 ${Utils.getText('script_startup')}\n  - ${Utils.getText('time_label')}: ${date}\n  - ${Utils.getText('info_label')}: ${entry.message || ''}`;
                } else {
                    const type = entry.type === 'NORMAL' ? `✅ ${Utils.getText('normal_period')}` : `🚨 ${Utils.getText('rate_limited_period')}`;
                    let details = `${Utils.getText('duration_label')}: ${entry.duration !== undefined && entry.duration !== null ? entry.duration.toFixed(2) : Utils.getText('unknown_duration')}s`;
                    if (entry.requests !== undefined) {
                        details += `, ${Utils.getText('requests_label')}: ${entry.requests}${Utils.getText('requests_unit')}`;
                    }
                    return `${type}\n  - ${Utils.getText('ended_at')}: ${date}\n  - ${details}`;
                }
            };
            const fullLog = State.statusHistory.map(formatEntry).join('\n\n');
            navigator.clipboard.writeText(fullLog).then(() => {
                const originalText = copyHistoryBtn.textContent;
                copyHistoryBtn.textContent = Utils.getText('copied_success');
                setTimeout(() => { copyHistoryBtn.textContent = originalText; }, 2000);
            }).catch(err => Utils.logger('error', Utils.getText('log_copy_failed'), err));
        };

        const clearHistoryBtn = document.createElement('button');
        clearHistoryBtn.textContent = Utils.getText('clear_btn');
        clearHistoryBtn.title = '清空历史记录';
        clearHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
        clearHistoryBtn.onclick = async () => {
            if (window.confirm(Utils.getText('confirm_clear_history'))) {
                State.statusHistory = [];
                await GM_deleteValue(Config.DB_KEYS.STATUS_HISTORY);

                const currentSessionEntry = {
                    type: 'STARTUP',
                    duration: 0,
                    endTime: new Date().toISOString(),
                    message: Utils.getText('history_cleared_new_session')
                };
                await RateLimitManager.addToHistory(currentSessionEntry);

                UI.updateDebugTab();
                Utils.logger('info', Utils.getText('status_history_cleared'));
            }
        };

        const diagnosisBtn = document.createElement('button');
        diagnosisBtn.textContent = Utils.getText('page_diagnosis');
        diagnosisBtn.style.cssText = 'background: #2196F3; border: 1px solid #1976D2; color: white; padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer; white-space: nowrap;';
        diagnosisBtn.onclick = () => {
            try {
                const report = PageDiagnostics.diagnoseDetailPage();
                PageDiagnostics.logDiagnosticReport(report);
                Utils.logger('info', Utils.getText('page_diagnosis_complete'));
            } catch (error) {
                Utils.logger('error', Utils.getText('page_diagnosis_failed', error.message));
            }
        };

        debugControls.append(copyHistoryBtn, clearHistoryBtn, diagnosisBtn);
        debugHeader.append(debugTitle, debugControls);

        const historyListContainer = document.createElement('div');
        historyListContainer.style.cssText = 'max-height: 250px; overflow-y: auto; background: rgba(10,10,10,0.85); color: #ddd; padding: 8px; border-radius: var(--radius-m);';
        historyListContainer.className = 'fab-debug-history-container';
        State.UI.historyContainer = historyListContainer;

        debugContent.append(debugHeader, historyListContainer);
        State.UI.tabContents.debug = debugContent;
        container.appendChild(debugContent);

        document.body.appendChild(container);
        return true;
    },

    update: () => {
        if (!State.UI.container) return;

        // Update title
        const titleElement = State.UI.container.querySelector('span[style*="font-weight: 600"]');
        if (titleElement) {
            titleElement.textContent = Utils.getText('app_title');
        }

        // Update tab texts
        const tabs = ['dashboard', 'settings', 'debug'];
        tabs.forEach((tabName) => {
            const tabButton = State.UI.tabs[tabName];
            if (tabButton) {
                tabButton.textContent = Utils.getText(`tab_${tabName}`);
            }
        });

        // Update sync button text
        if (State.UI.syncBtn) {
            State.UI.syncBtn.textContent = '🔄 ' + Utils.getText('sync');
        }

        // Update Status Numbers
        const todoCount = State.db.todo.length;
        const doneCount = State.db.done.length;
        const failedCount = State.db.failed.length;
        const visibleCount = document.querySelectorAll(Config.SELECTORS.card).length - State.hiddenThisPageCount;

        if (State.UI.statusTodo) State.UI.statusTodo.querySelector('span').textContent = todoCount;
        if (State.UI.statusDone) State.UI.statusDone.querySelector('span').textContent = doneCount;
        if (State.UI.statusFailed) State.UI.statusFailed.querySelector('span').textContent = failedCount;
        if (State.UI.statusHidden) State.UI.statusHidden.querySelector('span').textContent = State.hiddenThisPageCount;
        if (State.UI.statusVisible) State.UI.statusVisible.querySelector('span').textContent = visibleCount;

        // Update status labels
        const statusLabelUpdates = [
            { element: State.UI.statusVisible, icon: '👁️', key: 'visible' },
            { element: State.UI.statusTodo, icon: '📥', key: 'todo' },
            { element: State.UI.statusDone, icon: '✅', key: 'added' },
            { element: State.UI.statusFailed, icon: '❌', key: 'failed' },
            { element: State.UI.statusHidden, icon: '🙈', key: 'hidden' }
        ];
        statusLabelUpdates.forEach(({ element, icon, key }) => {
            const labelDiv = element?.querySelector('.fab-helper-status-label');
            if (labelDiv) {
                labelDiv.textContent = `${icon} ${Utils.getText(key)}`;
            }
        });

        // Update Button States
        if (State.UI.execBtn) {
            if (State.isExecuting) {
                State.UI.execBtn.innerHTML = `<span>${Utils.getText('executing')}</span>`;
                State.UI.execBtn.classList.add('executing');
                if (State.executionTotalTasks > 0) {
                    const progress = State.executionCompletedTasks + State.executionFailedTasks;
                    const percentage = Math.round((progress / State.executionTotalTasks) * 100);
                    State.UI.execBtn.title = Utils.getText('tooltip_executing_progress', progress, State.executionTotalTasks, percentage);
                } else {
                    State.UI.execBtn.title = Utils.getText('tooltip_executing');
                }
            } else {
                State.UI.execBtn.textContent = Utils.getText('execute');
                State.UI.execBtn.classList.remove('executing');
                State.UI.execBtn.title = Utils.getText('tooltip_start_tasks');
            }
        }

        if (State.UI.hideBtn) {
            State.UI.hideBtn.textContent = (State.hideSaved ? '🙈 ' : '👁️ ') + (State.hideSaved ? Utils.getText('show') : Utils.getText('hide'));
        }


    },

    removeAllOverlays: () => {
        document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
            const overlay = card.querySelector('.fab-helper-overlay');
            if (overlay) overlay.remove();
            card.style.opacity = '1';
        });
    },

    switchTab: (tabName) => {
        for (const name in State.UI.tabs) {
            State.UI.tabs[name].classList.toggle('active', name === tabName);
            State.UI.tabContents[name].style.display = name === tabName ? 'block' : 'none';
        }
        if (tabName === 'debug') {
            UI.updateDebugTab();
        }
    },

    updateDebugTab: () => {
        if (!State.UI.historyContainer) return;

        State.UI.historyContainer.innerHTML = '';

        const createHistoryItem = (entry) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 8px; margin-bottom: 8px; background: rgba(50,50,55,0.5); border-radius: 6px; border-left: 3px solid;';

            if (entry.type === 'STARTUP') {
                item.style.borderLeftColor = '#2196F3';
                item.innerHTML = `
                    <div style="font-weight: 500; color: #fff;">🚀 ${Utils.getText('script_startup')}</div>
                    <div style="font-size: 12px; color: var(--text-color-secondary); padding-left: 22px;">
                        <div>${Utils.getText('time_label')}: ${new Date(entry.endTime).toLocaleString()}</div>
                        ${entry.message ? `<div>${Utils.getText('info_label')}: ${entry.message}</div>` : ''}
                    </div>
                `;
            } else {
                const isNormal = entry.type === 'NORMAL';
                item.style.borderLeftColor = isNormal ? 'var(--green)' : 'var(--orange)';
                const icon = isNormal ? '✅' : '🚨';
                const title = isNormal ? Utils.getText('normal_period') : Utils.getText('rate_limited_period');
                const durationText = entry.duration !== undefined && entry.duration !== null ? entry.duration.toFixed(2) : Utils.getText('unknown_duration');

                let detailsHtml = `<div>${Utils.getText('duration_label')}: <strong>${durationText}s</strong></div>`;
                if (entry.requests !== undefined) {
                    detailsHtml += `<div>${Utils.getText('requests_label')}: <strong>${entry.requests}</strong>${Utils.getText('requests_unit')}</div>`;
                }
                detailsHtml += `<div>${Utils.getText('ended_at')}: ${new Date(entry.endTime).toLocaleString()}</div>`;

                item.innerHTML = `
                    <div style="font-weight: 500; color: #fff;"><span style="font-size: 18px;">${icon}</span> ${title}</div>
                    <div style="font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;">${detailsHtml}</div>
                `;
            }

            return item;
        };

        // Current status item
        const createCurrentStatusItem = () => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 12px; margin-bottom: 10px; background: rgba(0,122,255,0.15); border-radius: 8px; border: 1px solid rgba(0,122,255,0.3);';

            const header = document.createElement('div');
            header.style.cssText = 'display: flex; align-items: center; gap: 8px;';

            const icon = State.appStatus === 'NORMAL' ? '✅' : '🚨';
            const color = State.appStatus === 'NORMAL' ? 'var(--green)' : 'var(--orange)';
            const titleText = State.appStatus === 'NORMAL' ? Utils.getText('current_normal') : Utils.getText('current_rate_limited');

            header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;

            const details = document.createElement('div');
            details.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;';

            const startTime = State.appStatus === 'NORMAL' ? State.normalStartTime : State.rateLimitStartTime;
            const duration = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : Utils.getText('status_unknown_duration');

            let detailsHtml = `<div>${Utils.getText('status_ongoing_label')}<strong>${duration}s</strong></div>`;
            if (State.appStatus === 'NORMAL') {
                detailsHtml += `<div>${Utils.getText('status_requests_label')}<strong>${State.successfulSearchCount}</strong></div>`;
            }
            const startTimeDisplay = startTime ? new Date(startTime).toLocaleString() : Utils.getText('status_unknown_time');
            detailsHtml += `<div>${Utils.getText('status_started_at_label')}${startTimeDisplay}</div>`;
            details.innerHTML = detailsHtml;

            item.append(header, details);
            State.UI.historyContainer.appendChild(item);
        };

        createCurrentStatusItem();

        if (State.statusHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.style.cssText = 'color: #888; text-align: center; padding: 20px;';
            emptyMessage.textContent = Utils.getText('no_history');
            State.UI.historyContainer.appendChild(emptyMessage);
            return;
        }

        const reversedHistory = [...State.statusHistory].reverse();
        reversedHistory.forEach(entry => State.UI.historyContainer.appendChild(createHistoryItem(entry)));
    }
};
