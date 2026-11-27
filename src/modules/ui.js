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
import { KeepAlive } from './keepalive.js';
import { VerificationNotifications } from './verification-notifications.js';
import { PagePatcher } from './page-patcher.js';
import { FastScanner } from './fast-scanner.js';

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
                --bg-color: rgba(20, 21, 26, 0.92);
                --card-bg: rgba(255, 255, 255, 0.04);
                --card-bg-recessed: rgba(0, 0, 0, 0.28);
                --card-border: rgba(255, 255, 255, 0.075);
                --border-color: rgba(255, 255, 255, 0.11);
                --text-color-primary: #f5f5f7;
                --text-color-secondary: #8e8e96;
                --radius-l: 14px;
                --radius-m: 9px;
                --radius-s: 6px;
                --blue: #0a84ff; --pink: #ff453a; --green: #32d74b;
                --orange: #ffd60a; --gray: #8e8e93; --dark-gray: #3a3a3c;
                --blue-bg: rgba(10, 132, 255, 0.18);
            }
            #${Config.UI_CONTAINER_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                background: var(--bg-color);
                backdrop-filter: blur(20px) saturate(1.8);
                -webkit-backdrop-filter: blur(20px) saturate(1.8);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-l);
                color: var(--text-color-primary);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                width: 336px;
                max-width: calc(100vw - 24px);
                font-size: 13px;
                font-variant-numeric: tabular-nums;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.09);
            }
            #${Config.UI_CONTAINER_ID} *, #${Config.UI_CONTAINER_ID} *::before, #${Config.UI_CONTAINER_ID} *::after {
                box-sizing: border-box;
            }
            #${Config.UI_CONTAINER_ID} button:focus-visible,
            #${Config.UI_CONTAINER_ID} input:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-tabs,
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-tab-content {
                display: none !important;
            }
            .fab-helper-header {
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-header {
                border-bottom: none;
            }
            .fab-header-brand {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            .fab-header-version {
                font-size: 11px;
                color: var(--text-color-secondary);
                background: rgba(255, 255, 255, 0.07);
                padding: 1px 5px;
                border-radius: var(--radius-s);
            }
            .fab-header-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .fab-header-live-badge {
                display: none;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-color-primary);
                background: var(--blue-bg);
                border: 1px solid rgba(10, 132, 255, 0.4);
                padding: 2px 7px;
                border-radius: 999px;
                white-space: nowrap;
            }
            .fab-collapse-btn {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-s);
                border: 1px solid var(--card-border);
                background: var(--card-bg);
                color: var(--text-color-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                line-height: 1;
                padding: 0;
                transition: background-color 0.15s, color 0.15s;
            }
            .fab-collapse-btn:hover {
                background: rgba(255, 255, 255, 0.12);
                color: var(--text-color-primary);
            }
            .fab-helper-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
            }
            .fab-helper-tabs button {
                flex: 1;
                padding: 8px 0;
                font-size: 13px;
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
                padding: 10px 12px 12px;
                max-height: min(72vh, 540px);
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
            }
            .fab-helper-tab-content::-webkit-scrollbar {
                width: 6px;
            }
            .fab-helper-tab-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .fab-helper-tab-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.22);
                border-radius: 3px;
            }
            .fab-helper-owned-inline {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #30d158;
                font-weight: 600;
                font-size: 12px;
                line-height: 1.3;
            }
            .fab-primary-action-row {
                display: flex;
                gap: 6px;
                align-items: stretch;
                margin-bottom: 9px;
            }
            .fab-reset-checkpoint-btn {
                flex: 0 0 auto;
                padding: 0 12px;
                border-radius: var(--radius-m);
                border: 1px solid var(--card-border);
                background: var(--card-bg);
                color: var(--text-color-primary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                transition: background-color 0.15s, border-color 0.15s;
            }
            .fab-reset-checkpoint-btn:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .fab-reset-checkpoint-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }
            .fab-progress-card {
                background: rgba(255, 255, 255, 0.035);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                padding: 9px 11px;
                margin-bottom: 9px;
            }
            .fab-progress-head {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: 8px;
            }
            .fab-progress-title {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-color-primary);
                font-variant-numeric: tabular-nums;
            }
            .fab-progress-pct {
                font-size: 13px;
                font-weight: 700;
                color: #fff;
                font-variant-numeric: tabular-nums;
                flex-shrink: 0;
            }
            .fab-progress-pct.is-success {
                color: var(--green);
            }
            .fab-progress-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                font-size: 11.5px;
                color: var(--text-color-secondary);
                margin-top: 2px;
            }
            .fab-progress-meta-left.is-warn {
                color: var(--orange);
                font-weight: 500;
            }
            .fab-progress-meta-right {
                font-variant-numeric: tabular-nums;
            }
            .fab-progress-meta-right.is-success {
                color: var(--green);
                font-weight: 600;
            }
            .fab-quick-pills {
                display: flex;
                gap: 6px;
                margin-bottom: 10px;
            }
            .fab-pill-btn {
                flex: 1;
                min-width: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 7px 6px;
                border-radius: var(--radius-m);
                border: 1px solid var(--card-border);
                background: rgba(255, 255, 255, 0.025);
                color: var(--text-color-secondary);
                font-size: 11.5px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: background-color 0.15s, border-color 0.15s, color 0.15s;
            }
            .fab-pill-btn:hover {
                color: var(--text-color-primary);
                background: rgba(255, 255, 255, 0.07);
            }
            .fab-pill-btn.active {
                background: rgba(255, 255, 255, 0.085);
                border-color: rgba(255, 255, 255, 0.18);
                color: var(--text-color-primary);
                font-weight: 600;
            }
            .fab-pill-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.22);
                flex-shrink: 0;
                transition: background-color 0.15s, box-shadow 0.15s;
            }
            .fab-pill-btn.active .fab-pill-dot {
                background: var(--green);
                box-shadow: 0 0 6px rgba(50, 215, 75, 0.65);
            }
            .fab-pill-text {
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .fab-retry-inline-btn {
                display: none;
                align-items: center;
                justify-content: center;
                padding: 1px 6px;
                border-radius: 999px;
                border: 1px solid rgba(255, 69, 58, 0.38);
                background: rgba(255, 69, 58, 0.18);
                color: #ff6961;
                font-size: 10.5px;
                font-weight: 600;
                line-height: 1.3;
                cursor: pointer;
                flex-shrink: 0;
                transition: background-color 0.15s;
            }
            .fab-retry-inline-btn:hover {
                background: rgba(255, 69, 58, 0.3);
            }
            .fab-helper-status-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 9px;
            }
            .fab-helper-status-item {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                padding: 8px 10px;
                border-radius: var(--radius-m);
                font-size: 11px;
                color: var(--text-color-secondary);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: flex-start;
                gap: 4px;
                min-width: 0;
                transition: border-color 0.2s, background-color 0.2s;
            }
            .fab-helper-status-item.grid-3 {
                flex-grow: 1;
                flex-basis: calc((100% - 12px) / 3);
            }
            .fab-helper-status-item.grid-2 {
                flex-grow: 1;
                flex-basis: calc((100% - 6px) / 2);
            }
            .fab-helper-status-item.has-failed {
                border-color: rgba(255, 69, 58, 0.36);
                background: rgba(255, 69, 58, 0.07);
            }
            .fab-status-head {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 4px;
            }
            .fab-helper-status-label {
                display: flex;
                align-items: center;
                gap: 4px;
                white-space: nowrap;
                font-size: 11px;
                color: var(--text-color-secondary);
            }
            .fab-helper-status-item > span {
                display: block;
                font-size: 17px;
                font-weight: 650;
                color: #fff;
                line-height: 1.15;
                font-variant-numeric: tabular-nums;
            }
            .fab-helper-execute-btn {
                flex: 1;
                min-width: 0;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: var(--radius-m);
                padding: 9px 14px;
                font-size: 13.5px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
                color: #fff;
                background: linear-gradient(180deg, #1f8fff 0%, #0071e3 100%);
                margin-bottom: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 7px;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 2px 8px rgba(0, 113, 227, 0.28);
            }
            .fab-helper-execute-btn:hover {
                filter: brightness(1.06);
            }
            .fab-helper-execute-btn.executing {
                background: rgba(255, 69, 58, 0.14);
                border-color: rgba(255, 69, 58, 0.38);
                color: #ff6961;
                box-shadow: none;
                animation: none;
            }
            .fab-helper-execute-btn.executing::before {
                content: '';
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #ff6961;
                flex-shrink: 0;
            }
            .fab-progress-track {
                width: 100%;
                height: 5px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 999px;
                margin: 7px 0 6px;
                overflow: hidden;
                display: none;
            }
            .fab-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #0a84ff, #32ade6);
                width: 0%;
                transition: width 0.3s ease;
                border-radius: 999px;
            }
            .fab-helper-actions {
                display: flex;
                gap: 6px;
                margin-bottom: 8px;
            }
            .fab-helper-actions button {
                flex: 1;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                color: var(--text-color-primary);
                padding: 7px 6px;
                cursor: pointer;
                transition: background-color 0.2s, border-color 0.2s;
                white-space: nowrap;
                font-size: 12px;
                font-weight: normal;
            }
            .fab-helper-actions button:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.18);
            }
            .fab-helper-actions button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .fab-helper-position-container {
                margin-top: 4px;
                padding: 4px 7px;
                background: var(--card-bg-recessed);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: var(--radius-s);
                font-size: 11.5px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .fab-helper-keepalive-status {
                font-size: 11px;
                opacity: 0.85;
                margin: 0 2px 6px 2px;
                display: none;
            }
            .fab-log-container {
                margin-top: 6px;
                border-top: 1px solid var(--border-color);
                padding-top: 6px;
            }
            .fab-log-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                cursor: pointer;
                user-select: none;
            }
            .fab-log-header span {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-color-secondary);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .fab-log-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .fab-log-controls button {
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                cursor: pointer;
                padding: 2px 5px;
                border-radius: 4px;
                font-size: 11px;
                line-height: 1.2;
                transition: color 0.15s, background-color 0.15s;
            }
            .fab-log-controls button:hover {
                color: var(--text-color-primary);
                background: rgba(255, 255, 255, 0.08);
            }
            #${Config.UI_LOG_ID} {
                background: rgba(10, 10, 12, 0.85);
                color: #e0e0e4;
                font-size: 11px;
                line-height: 1.4;
                padding: 7px 8px;
                border-radius: var(--radius-m);
                max-height: 120px;
                overflow-y: auto;
                min-height: 44px;
                display: flex;
                flex-direction: column-reverse;
                box-shadow: inset 0 1px 4px rgba(0,0,0,0.3);
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.2) rgba(0,0,0,0.2);
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
                gap: 8px;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            .fab-setting-row:last-child {
                border-bottom: none;
            }
            .fab-setting-label {
                font-size: 12.5px;
                color: var(--text-color-primary);
            }
            .fab-card-group {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                padding: 8px 10px;
                margin-bottom: 8px;
            }
            .fab-card-group:last-child {
                margin-bottom: 0;
            }
            .fab-card-group-title {
                font-size: 11px;
                font-weight: 600;
                color: var(--text-color-secondary);
                margin-bottom: 6px;
            }
            .fab-collapsible-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                overflow: hidden;
            }
            .fab-collapsible-toggle {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                border: none;
                background: transparent;
                color: var(--text-color-secondary);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                text-align: left;
            }
            .fab-collapsible-toggle:hover {
                color: var(--text-color-primary);
            }
            .fab-collapsible-body {
                padding: 0 10px 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            .fab-stepper-btn {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-s);
                border: 1px solid var(--border-color);
                background: var(--dark-gray);
                color: var(--text-color-primary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                line-height: 1;
                transition: background 0.15s;
            }
            .fab-stepper-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            .fab-stepper-input {
                width: 40px;
                height: 24px;
                text-align: center;
                border-radius: var(--radius-s);
                border: 1px solid var(--border-color);
                background: rgba(0, 0, 0, 0.3);
                color: var(--text-color-primary);
                font-weight: 600;
                font-size: 13px;
                -moz-appearance: textfield;
            }
            .fab-danger-btn {
                width: 100%;
                margin-top: 6px;
                background-color: rgba(255, 55, 95, 0.16);
                color: var(--pink);
                border: 1px solid rgba(255, 55, 95, 0.4);
                padding: 7px 10px;
                border-radius: var(--radius-m);
                font-size: 12.5px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            .fab-danger-btn:hover {
                background-color: var(--pink);
                color: #fff;
            }
            .fab-toggle-switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 22px;
                flex-shrink: 0;
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
                transition: .25s;
                border-radius: 22px;
            }
            .fab-toggle-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .25s;
                border-radius: 50%;
            }
            input:checked + .fab-toggle-slider {
                background-color: var(--blue);
            }
            input:checked + .fab-toggle-slider:before {
                transform: translateX(18px);
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
            .fab-helper-toast-container {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .fab-helper-toast {
                pointer-events: auto;
                background: var(--bg-color);
                backdrop-filter: blur(15px) saturate(1.8);
                -webkit-backdrop-filter: blur(15px) saturate(1.8);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-m);
                padding: 12px 16px;
                color: var(--text-color-primary);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                min-width: 250px;
                max-width: 350px;
                animation: fab-helper-slide-in 0.3s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .fab-helper-toast-content {
                flex: 1;
                font-size: 13px;
                line-height: 1.4;
            }
            .fab-helper-toast-close {
                cursor: pointer;
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                font-size: 18px;
                font-weight: bold;
                padding: 0 4px;
                line-height: 1;
                transition: color 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .fab-helper-toast-close:hover {
                color: var(--pink);
            }
            @keyframes fab-helper-slide-in {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @media (prefers-reduced-motion: reduce) {
                #${Config.UI_CONTAINER_ID} *,
                .fab-helper-toast {
                    animation: none !important;
                    transition: none !important;
                }
            }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const container = document.createElement('div');
        container.id = Config.UI_CONTAINER_ID;
        State.UI.container = container;
        State.UI.i18nBindings = [];

        const bindText = (el, key, prefix = '', suffix = '') => {
            State.UI.i18nBindings.push({ el, key, prefix, suffix });
            el.textContent = `${prefix}${Utils.getText(key)}${suffix}`;
            return el;
        };

        const createSettingRow = (labelKey, stateKey, tooltipKey = null, uiRefKey = null) => {
            const row = document.createElement('div');
            row.className = 'fab-setting-row';
            if (tooltipKey) row.title = Utils.getText(tooltipKey);

            const label = document.createElement('span');
            label.className = 'fab-setting-label';
            bindText(label, labelKey);

            const switchContainer = document.createElement('label');
            switchContainer.className = 'fab-toggle-switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(State[stateKey]);
            input.onchange = async (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (!TaskRunner) return;

                if (stateKey === 'domFallbackMode') {
                    await TaskRunner.setDomFallbackMode(!State.domFallbackMode);
                } else if (stateKey === 'autoAddOnScroll') {
                    TaskRunner.toggleAutoAdd();
                } else if (stateKey === 'autoScroll') {
                    TaskRunner.toggleAutoScroll();
                } else if (stateKey === 'rememberScrollPosition') {
                    await TaskRunner.toggleRememberPosition();
                } else if (stateKey === 'autoResumeAfter429') {
                    TaskRunner.toggleAutoResume();
                } else if (stateKey === 'autoRefreshEmptyPage') {
                    TaskRunner.toggleAutoRefreshEmpty();
                } else if (stateKey === 'hideDiscountedPaid') {
                    TaskRunner.toggleHideDiscountedPaid();
                } else if (stateKey === 'hidePaid') {
                    TaskRunner.toggleHidePaid();
                } else if (stateKey === 'blockLargeResources') {
                    TaskRunner.toggleBlockResources();
                }
                e.target.checked = Boolean(State[stateKey]);
                UI.update();
            };

            const slider = document.createElement('span');
            slider.className = 'fab-toggle-slider';

            if (uiRefKey) {
                State.UI[uiRefKey] = input;
            }

            switchContainer.append(input, slider);
            row.append(label, switchContainer);

            return row;
        };

        const createNumberSettingRow = (labelKey, stateKey, min, max, tooltipKey, options = {}) => {
            const { onChange, uiRefKey, defaultValue } = options;
            const row = document.createElement('div');
            row.className = 'fab-setting-row';
            if (tooltipKey) row.title = Utils.getText(tooltipKey);

            const label = document.createElement('span');
            label.className = 'fab-setting-label';
            bindText(label, labelKey);

            const controlContainer = document.createElement('div');
            controlContainer.style.cssText = 'display: flex; align-items: center; gap: 6px;';

            const minusBtn = document.createElement('button');
            minusBtn.type = 'button';
            minusBtn.className = 'fab-stepper-btn';
            minusBtn.textContent = '−';

            const valueInput = document.createElement('input');
            valueInput.type = 'number';
            valueInput.min = String(min);
            valueInput.max = String(max);
            valueInput.value = State[stateKey] ?? defaultValue ?? min;
            valueInput.className = 'fab-stepper-input';

            const plusBtn = document.createElement('button');
            plusBtn.type = 'button';
            plusBtn.className = 'fab-stepper-btn';
            plusBtn.textContent = '+';

            const applyVal = async (val) => {
                const parsed = Math.floor(Number(val));
                const target = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min));
                valueInput.value = target;
                if (typeof onChange === 'function') {
                    await onChange(target);
                } else {
                    State[stateKey] = target;
                }
            };

            minusBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                applyVal((Number(valueInput.value) || min) - 1);
            };

            plusBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                applyVal((Number(valueInput.value) || min) + 1);
            };

            valueInput.onchange = (e) => {
                e.stopPropagation();
                applyVal(Number(e.target.value) || min);
            };

            if (uiRefKey) {
                State.UI[uiRefKey] = valueInput;
            }

            controlContainer.append(minusBtn, valueInput, plusBtn);
            row.append(label, controlContainer);
            return row;
        };

        const createCardGroup = (titleKey) => {
            const card = document.createElement('div');
            card.className = 'fab-card-group';
            const cardTitle = document.createElement('div');
            cardTitle.className = 'fab-card-group-title';
            bindText(cardTitle, titleKey);
            card.appendChild(cardTitle);
            return card;
        };

        // Header with Version & Collapse Toggle
        const header = document.createElement('div');
        header.className = 'fab-helper-header';

        const brand = document.createElement('div');
        brand.className = 'fab-header-brand';
        const title = document.createElement('span');
        bindText(title, 'app_title');
        title.style.fontWeight = '600';
        const version = document.createElement('span');
        version.className = 'fab-header-version';
        const scriptVersion = globalThis.GM_info?.script?.version || '';
        version.textContent = scriptVersion ? `v${scriptVersion}` : '';
        brand.append(title, version);

        const headerActions = document.createElement('div');
        headerActions.className = 'fab-header-actions';

        const headerLiveBadge = document.createElement('span');
        headerLiveBadge.className = 'fab-header-live-badge';
        State.UI.headerLiveBadge = headerLiveBadge;

        const collapseBtn = document.createElement('button');
        collapseBtn.type = 'button';
        collapseBtn.className = 'fab-collapse-btn';
        collapseBtn.onclick = () => {
            State.uiExpanded = !State.uiExpanded;
            Database.saveUiExpandedPref();
            UI.update();
        };
        State.UI.collapseBtn = collapseBtn;

        headerActions.append(headerLiveBadge, collapseBtn);
        header.append(brand, headerActions);
        container.appendChild(header);

        // Tab Controls
        const tabContainer = document.createElement('div');
        tabContainer.className = 'fab-helper-tabs';
        State.UI.tabsContainer = tabContainer;
        const tabs = ['dashboard', 'settings', 'debug'];
        State.activeTab = State.activeTab || 'dashboard';
        tabs.forEach(tabName => {
            const btn = document.createElement('button');
            btn.type = 'button';
            bindText(btn, `tab_${tabName}`);
            btn.onclick = () => UI.switchTab(tabName);
            if (tabName === State.activeTab) btn.classList.add('active');
            tabContainer.appendChild(btn);
            State.UI.tabs[tabName] = btn;
        });
        container.appendChild(tabContainer);

        // Dashboard Tab (Mode-Free Unified Workbench)
        const dashboardContent = document.createElement('div');
        dashboardContent.className = 'fab-helper-tab-content';
        dashboardContent.style.display = 'block';
        State.UI.tabContents.dashboard = dashboardContent;

        // 1. Primary Action Row (Execute / Resume + optional Restart Checkpoint)
        const primaryRow = document.createElement('div');
        primaryRow.className = 'fab-primary-action-row';

        State.UI.execBtn = document.createElement('button');
        State.UI.execBtn.type = 'button';
        State.UI.execBtn.className = 'fab-helper-execute-btn';
        State.UI.execBtn.onclick = () => TaskRunner && TaskRunner.toggleExecution();

        State.UI.resetCheckpointBtn = document.createElement('button');
        State.UI.resetCheckpointBtn.type = 'button';
        State.UI.resetCheckpointBtn.className = 'fab-reset-checkpoint-btn';
        bindText(State.UI.resetCheckpointBtn, 'reset_checkpoint');
        State.UI.resetCheckpointBtn.style.display = 'none';
        State.UI.resetCheckpointBtn.onclick = async () => {
            if (State.isExecuting || FastScanner.isRunning()) return;
            if (!State.hasFastScanCheckpoint && !State.fastScanStatus) return;
            if (window.confirm(Utils.getText('confirm_reset_checkpoint'))) {
                await FastScanner.clearCheckpoint();
                State.fastScanStatus = null;
                State.fastScanCheckpointMeta = null;
                State.hasFastScanCheckpoint = false;
                Utils.logger('info', Utils.getText('log_checkpoint_cleared'));
                UI.update();
            }
        };

        primaryRow.append(State.UI.execBtn, State.UI.resetCheckpointBtn);

        // 2. Structured Progress Card (hidden cleanly when idle without checkpoint)
        const progressCard = document.createElement('div');
        progressCard.className = 'fab-progress-card';
        progressCard.style.display = 'none';

        const progressHead = document.createElement('div');
        progressHead.className = 'fab-progress-head';
        const progressTitle = document.createElement('span');
        progressTitle.className = 'fab-progress-title';
        const progressPct = document.createElement('span');
        progressPct.className = 'fab-progress-pct';
        progressHead.append(progressTitle, progressPct);

        const progressTrack = document.createElement('div');
        progressTrack.className = 'fab-progress-track';
        const progressBar = document.createElement('div');
        progressBar.className = 'fab-progress-bar';
        progressTrack.appendChild(progressBar);
        State.UI.progressTrack = progressTrack;
        State.UI.progressBar = progressBar;

        const progressMeta = document.createElement('div');
        progressMeta.className = 'fab-progress-meta';
        const progressMetaLeft = document.createElement('span');
        progressMetaLeft.className = 'fab-progress-meta-left';
        const progressMetaRight = document.createElement('span');
        progressMetaRight.className = 'fab-progress-meta-right';
        progressMeta.append(progressMetaLeft, progressMetaRight);

        progressCard.append(progressHead, progressTrack, progressMeta);
        progressCard._titleEl = progressTitle;
        progressCard._pctEl = progressPct;
        progressCard._metaLeftEl = progressMetaLeft;
        progressCard._metaRightEl = progressMetaRight;
        State.UI.fastScanStatusDisplay = progressCard;

        State.UI.statusKeepAlive = document.createElement('div');
        State.UI.statusKeepAlive.className = 'fab-helper-keepalive-status';
        State.UI.statusKeepAlive.title = '后台保活：♥心跳(Worker,不被节流) + ❄️防冻结(WebRTC)。后台/锁屏时应持续刷新；若显示未启动说明 Worker 被页面 CSP 拦截';

        // 3. Unified 3-Metric Status Bar (待入库 / 已入库 / 失败 + 内联重试)
        const statusBar = document.createElement('div');
        statusBar.className = 'fab-helper-status-bar';

        const createStatusItem = (id, labelKey, gridClass = 'grid-3') => {
            const item = document.createElement('div');
            item.className = `fab-helper-status-item ${gridClass}`;
            const headDiv = document.createElement('div');
            headDiv.className = 'fab-status-head';
            const labelDiv = document.createElement('div');
            labelDiv.className = 'fab-helper-status-label';
            bindText(labelDiv, labelKey);
            headDiv.appendChild(labelDiv);
            const valSpan = document.createElement('span');
            valSpan.id = id;
            valSpan.textContent = '0';
            item.append(headDiv, valSpan);
            item._headEl = headDiv;
            item._valueEl = valSpan;
            return item;
        };

        State.UI.statusTodo = createStatusItem('fab-status-todo', 'todo', 'grid-3');
        State.UI.statusDone = createStatusItem('fab-status-done', 'added', 'grid-3');
        State.UI.statusFailed = createStatusItem('fab-status-failed', 'failed', 'grid-3');
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

        State.UI.retryFailedBtn = document.createElement('button');
        State.UI.retryFailedBtn.type = 'button';
        State.UI.retryFailedBtn.className = 'fab-retry-inline-btn';
        State.UI.retryFailedBtn.style.display = 'none';
        bindText(State.UI.retryFailedBtn, 'retry_failed');
        State.UI.retryFailedBtn.onclick = (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            if (TaskRunner) TaskRunner.retryFailedTasks();
        };
        State.UI.statusFailed._headEl.appendChild(State.UI.retryFailedBtn);

        statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed);

        // 4. Quick LED Switches Row (Auto-Claim / Hide Owned / Hide Paid)
        const quickPills = document.createElement('div');
        quickPills.className = 'fab-quick-pills';

        const makeQuickPill = (labelKey, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fab-pill-btn';
            const dot = document.createElement('span');
            dot.className = 'fab-pill-dot';
            const textSpan = document.createElement('span');
            textSpan.className = 'fab-pill-text';
            bindText(textSpan, labelKey);
            btn.append(dot, textSpan);
            btn._textEl = textSpan;
            btn.onclick = onClick;
            return btn;
        };

        State.UI.quickAutoClaimBtn = makeQuickPill('pill_auto_claim', () => TaskRunner && TaskRunner.toggleAutoClaimVisible());
        State.UI.quickHideSavedBtn = makeQuickPill('pill_hide_saved', () => TaskRunner && TaskRunner.toggleHideSaved());
        State.UI.quickHidePaidBtn = makeQuickPill('pill_hide_paid', () => TaskRunner && TaskRunner.toggleHidePaid());
        quickPills.append(State.UI.quickAutoClaimBtn, State.UI.quickHideSavedBtn, State.UI.quickHidePaidBtn);

        // 5. Collapsible Operation Log Panel
        const logContainer = document.createElement('div');
        logContainer.className = 'fab-log-container';

        const logHeader = document.createElement('div');
        logHeader.className = 'fab-log-header';
        const logTitle = document.createElement('span');
        const toggleArrow = document.createElement('span');
        toggleArrow.textContent = '▾';
        toggleArrow.style.transition = 'transform 0.2s';
        const logTitleText = document.createElement('span');
        bindText(logTitleText, 'operation_log');
        logTitle.append(toggleArrow, logTitleText);
        const logControls = document.createElement('div');
        logControls.className = 'fab-log-controls';

        const copyLogBtn = document.createElement('button');
        copyLogBtn.type = 'button';
        bindText(copyLogBtn, 'copyLog');
        copyLogBtn.title = Utils.getText('copyLog');
        copyLogBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
                copyLogBtn.textContent = Utils.getText('copied');
                setTimeout(() => { copyLogBtn.textContent = Utils.getText('copyLog'); }, 1500);
            }).catch(err => Utils.logger('error', 'Failed to copy log:', err));
        };

        const clearLogBtn = document.createElement('button');
        clearLogBtn.type = 'button';
        bindText(clearLogBtn, 'clearLog');
        clearLogBtn.title = Utils.getText('clearLog');
        clearLogBtn.onclick = (e) => {
            e.stopPropagation();
            State.UI.logPanel.innerHTML = '';
        };

        logControls.append(copyLogBtn, clearLogBtn);
        logHeader.append(logTitle, logControls);

        State.UI.logPanel = document.createElement('div');
        State.UI.logPanel.id = Config.UI_LOG_ID;

        let isLogOpen = true;
        logHeader.onclick = () => {
            isLogOpen = !isLogOpen;
            State.UI.logPanel.style.display = isLogOpen ? 'flex' : 'none';
            toggleArrow.style.transform = isLogOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        };

        logContainer.append(logHeader, State.UI.logPanel);

        dashboardContent.append(
            primaryRow,
            progressCard,
            State.UI.statusKeepAlive,
            statusBar,
            quickPills,
            logContainer
        );
        container.appendChild(dashboardContent);

        // Settings Tab (Slimmed: 4 visible controls + collapsed Advanced & Fallback drawer)
        const settingsContent = document.createElement('div');
        settingsContent.className = 'fab-helper-tab-content';
        settingsContent.style.display = 'none';

        // Card 1: 常规与过滤
        const groupGeneralFilter = createCardGroup('settings_group_general_filter');
        groupGeneralFilter.appendChild(createSettingRow('setting_hide_discounted', 'hideDiscountedPaid'));
        groupGeneralFilter.appendChild(createNumberSettingRow(
            'setting_api_scan_concurrency',
            'apiScanConcurrency',
            1,
            Config.MAX_API_SCAN_CONCURRENCY || 6,
            'setting_api_scan_concurrency_tooltip',
            {
                onChange: (v) => TaskRunner && TaskRunner.setApiScanConcurrency(v),
                uiRefKey: 'apiScanConcurrencyInput',
                defaultValue: Config.DEFAULT_API_SCAN_CONCURRENCY || 4
            }
        ));
        groupGeneralFilter.appendChild(createSettingRow('setting_block_large_resources', 'blockLargeResources'));

        const notificationRow = document.createElement('div');
        notificationRow.className = 'fab-setting-row';
        const notificationLabel = document.createElement('span');
        notificationLabel.className = 'fab-setting-label';
        bindText(notificationLabel, 'setting_verification_notify');
        const notificationButton = document.createElement('button');
        notificationButton.type = 'button';
        notificationButton.style.cssText = 'padding: 4px 8px; font-size: 12px; cursor: pointer; border-radius: var(--radius-m); border: 1px solid var(--border-color); background: var(--dark-gray); color: var(--text-color-primary);';
        const renderNotificationPermission = (permission = VerificationNotifications.permission()) => {
            const zh = State.lang === 'zh';
            const labels = zh
                ? { granted: '测试通知', default: '开启并测试', denied: '已被阻止', unsupported: '不支持', unavailable: '重试' }
                : { granted: 'Test alert', default: 'Enable & test', denied: 'Blocked', unsupported: 'Unsupported', unavailable: 'Retry' };
            notificationButton.textContent = labels[permission] || labels.unavailable;
            notificationButton.disabled = permission === 'unsupported';
            notificationButton.title = zh
                ? '允许通知后，遇到验证会提醒您。若被阻止，请在网站设置中允许通知。'
                : 'Allow notifications for verification alerts. If blocked, enable notifications in site settings.';
        };
        renderNotificationPermission();
        notificationButton.onclick = async () => {
            const permission = await VerificationNotifications.enableAndTest(State.lang);
            renderNotificationPermission(permission);
            if (permission !== 'granted') Utils.logger('warn', notificationButton.title);
        };
        notificationRow.append(notificationLabel, notificationButton);
        groupGeneralFilter.appendChild(notificationRow);
        settingsContent.appendChild(groupGeneralFilter);

        // Card 2: Collapsible Advanced & Fallback
        const advancedCard = document.createElement('div');
        advancedCard.className = 'fab-collapsible-card';

        const advancedToggle = document.createElement('button');
        advancedToggle.type = 'button';
        advancedToggle.className = 'fab-collapsible-toggle';
        const advancedTitle = document.createElement('span');
        bindText(advancedTitle, 'settings_group_advanced_fallback');
        const advancedChevron = document.createElement('span');
        advancedChevron.textContent = State.settingsAdvancedOpen ? '▾' : '▸';
        advancedToggle.append(advancedTitle, advancedChevron);
        advancedToggle.setAttribute('aria-expanded', State.settingsAdvancedOpen ? 'true' : 'false');

        const advancedBody = document.createElement('div');
        advancedBody.className = 'fab-collapsible-body';
        advancedBody.style.display = State.settingsAdvancedOpen ? 'block' : 'none';

        advancedBody.appendChild(createSettingRow(
            'setting_dom_fallback',
            'domFallbackMode',
            'setting_dom_fallback_tooltip',
            'domFallbackCheckbox'
        ));

        const fallbackControls = document.createElement('div');
        fallbackControls.style.display = State.domFallbackMode ? 'block' : 'none';
        fallbackControls.appendChild(createSettingRow(
            'setting_remember_position',
            'rememberScrollPosition',
            'setting_page_only_tooltip',
            'rememberPositionCheckbox'
        ));

        const positionContainer = document.createElement('div');
        positionContainer.className = 'fab-helper-position-container';

        const positionIcon = document.createElement('span');
        positionIcon.textContent = Utils.getText('position_indicator');
        positionIcon.style.marginRight = '2px';

        const positionInfo = document.createElement('span');
        positionInfo.textContent = Utils.decodeCursor(State.savedCursor);
        positionInfo.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        State.UI.savedPositionDisplay = positionInfo;

        const clearPositionBtn = document.createElement('button');
        clearPositionBtn.type = 'button';
        clearPositionBtn.textContent = '↺';
        clearPositionBtn.title = Utils.getText('clear_position_tooltip');
        clearPositionBtn.style.cssText = 'background: none; border: none; cursor: pointer; margin-left: auto; font-size: 14px; padding: 0 4px; opacity: 0.7; transition: opacity 0.2s; color: var(--text-color-primary);';
        clearPositionBtn.onmouseover = () => { clearPositionBtn.style.opacity = '1'; };
        clearPositionBtn.onmouseout = () => { clearPositionBtn.style.opacity = '0.7'; };
        clearPositionBtn.onclick = async () => {
            const hasRecoveryCursor = typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('fab_helper_recovery_cursor') || sessionStorage.getItem('fab_helper_last_recovery_cursor'));
            if (State.savedCursor || PagePatcher._lastSeenCursor || hasRecoveryCursor) {
                PagePatcher.lockCursorSaving();
                if (confirm(Utils.getText('confirm_reset_position'))) {
                    await PagePatcher.clearSavedPosition('User UI Reset');

                    // 刷新后浏览器可能还原旧滚动深度并触发深游标回放，先立守卫挡掉回放写入
                    PagePatcher.armResetGuard();

                    // 交还给浏览器还原滚动位置等于把刚清掉的位置又滚回去，这里从顶部开始加载
                    try {
                        window.scrollTo(0, 0);
                    } catch (e) { }

                    try {
                        const url = new URL(window.location.href);
                        if (url.searchParams.has('cursor')) {
                            url.searchParams.delete('cursor');
                            window.location.href = url.toString();
                            return;
                        }
                    } catch (e) { }

                    window.location.reload();
                } else {
                    PagePatcher.unlockCursorSaving();
                }
            } else {
                Utils.logger('info', Utils.getText('no_position_to_reset'));
            }
        };
        positionContainer.append(positionIcon, positionInfo, clearPositionBtn);
        fallbackControls.appendChild(positionContainer);
        State.UI.domFallbackControls = fallbackControls;
        advancedBody.appendChild(fallbackControls);

        advancedBody.appendChild(createNumberSettingRow(
            'setting_max_workers',
            'maxWorkers',
            1,
            15,
            'setting_max_workers_desc_tooltip',
            {
                onChange: (v) => TaskRunner && TaskRunner.setMaxWorkers(v),
                uiRefKey: 'maxWorkersInput',
                defaultValue: 7
            }
        ));
        advancedBody.appendChild(createSettingRow('setting_auto_resume_429', 'autoResumeAfter429'));
        advancedBody.appendChild(createSettingRow('setting_auto_refresh', 'autoRefreshEmptyPage'));

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.className = 'fab-danger-btn';
        bindText(resetButton, 'clear_all_data');
        resetButton.onclick = Database.resetAllData;
        advancedBody.appendChild(resetButton);

        advancedToggle.onclick = () => {
            State.settingsAdvancedOpen = !State.settingsAdvancedOpen;
            advancedBody.style.display = State.settingsAdvancedOpen ? 'block' : 'none';
            advancedChevron.textContent = State.settingsAdvancedOpen ? '▾' : '▸';
            advancedToggle.setAttribute('aria-expanded', State.settingsAdvancedOpen ? 'true' : 'false');
        };

        State.UI.settingsAdvancedToggle = advancedToggle;
        State.UI.settingsAdvancedBody = advancedBody;
        advancedCard.append(advancedToggle, advancedBody);
        settingsContent.appendChild(advancedCard);

        State.UI.tabContents.settings = settingsContent;
        container.appendChild(settingsContent);

        // Debug Tab (includes relocated Debug Mode toggle)
        const debugContent = document.createElement('div');
        debugContent.className = 'fab-helper-tab-content';
        debugContent.style.display = 'none';
        State.UI.debugContent = debugContent;
        State.UI.tabContents.debug = debugContent;

        const debugModeCard = document.createElement('div');
        debugModeCard.className = 'fab-card-group';
        const debugModeRow = document.createElement('div');
        debugModeRow.className = 'fab-setting-row';
        debugModeRow.title = Utils.getText('setting_debug_tooltip');

        const debugLabel = document.createElement('span');
        debugLabel.className = 'fab-setting-label';
        bindText(debugLabel, 'debug_mode');
        debugLabel.style.color = '#ff9f0a';

        const debugSwitchContainer = document.createElement('label');
        debugSwitchContainer.className = 'fab-toggle-switch';

        const debugInput = document.createElement('input');
        debugInput.type = 'checkbox';
        debugInput.checked = Boolean(State.debugMode);
        debugInput.onchange = (e) => {
            State.debugMode = e.target.checked;
            debugModeRow.classList.toggle('active', State.debugMode);
            Utils.logger(
                'info',
                Utils.getText(
                    'log_debug_mode_toggled',
                    State.debugMode ? Utils.getText('status_enabled') : Utils.getText('status_disabled'),
                    State.debugMode ? Utils.getText('log_debug_mode_detail_info') : ''
                )
            );
            GM_setValue('fab_helper_debug_mode', State.debugMode);
        };
        State.UI.debugModeCheckbox = debugInput;

        const debugSlider = document.createElement('span');
        debugSlider.className = 'fab-toggle-slider';
        debugSwitchContainer.append(debugInput, debugSlider);
        debugModeRow.append(debugLabel, debugSwitchContainer);
        debugModeRow.classList.toggle('active', Boolean(State.debugMode));
        debugModeCard.appendChild(debugModeRow);
        debugContent.appendChild(debugModeCard);

        const debugHeader = document.createElement('div');
        debugHeader.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;';

        const debugTitle = document.createElement('h4');
        bindText(debugTitle, 'status_history');
        debugTitle.style.cssText = 'margin: 0; font-size: 14px; white-space: nowrap;';

        const debugControls = document.createElement('div');
        debugControls.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

        const copyHistoryBtn = document.createElement('button');
        copyHistoryBtn.type = 'button';
        bindText(copyHistoryBtn, 'copy_btn');
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
        clearHistoryBtn.type = 'button';
        bindText(clearHistoryBtn, 'clear_btn');
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
        diagnosisBtn.type = 'button';
        bindText(diagnosisBtn, 'page_diagnosis');
        diagnosisBtn.style.cssText = 'background: var(--blue); border: 1px solid rgba(255,255,255,0.18); color: white; padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer; white-space: nowrap;';
        diagnosisBtn.onclick = () => {
            try {
                const report = PageDiagnostics.diagnoseDetailPage();
                PageDiagnostics.logDiagnosticReport(report);
                Utils.logger('info', Utils.getText('log_diagnosis_complete'));
            } catch (error) {
                Utils.logger('error', Utils.getText('log_diagnosis_failed', error.message));
            }
        };

        debugControls.append(copyHistoryBtn, clearHistoryBtn, diagnosisBtn);
        debugHeader.append(debugTitle, debugControls);

        const historyListContainer = document.createElement('div');
        historyListContainer.style.cssText = 'max-height: 250px; overflow-y: auto; background: rgba(10,10,10,0.85); color: #ddd; padding: 8px; border-radius: var(--radius-m);';
        historyListContainer.className = 'fab-debug-history-container';
        State.UI.historyContainer = historyListContainer;

        debugContent.append(debugHeader, historyListContainer);
        container.appendChild(debugContent);

        document.body.appendChild(container);
        UI.update();
        return true;
    },

    update: () => {
        if (!State.UI.container) return;

        // Refresh static i18n text bindings
        if (Array.isArray(State.UI.i18nBindings)) {
            State.UI.i18nBindings.forEach(({ el, key, prefix = '', suffix = '' }) => {
                if (el) el.textContent = `${prefix}${Utils.getText(key)}${suffix}`;
            });
        }

        const isFallback = Boolean(State.domFallbackMode);
        const isRunning = Boolean(State.isExecuting || FastScanner.isRunning());
        const fs = State.fastScanStatus;
        const expanded = Boolean(State.uiExpanded);
        const hasCheckpoint = !isFallback && Boolean(
            State.hasFastScanCheckpoint || fs?.phase === 'paused' || fs?.phase === 'partial'
        );

        const getCheckpointPct = () => {
            if (fs && fs.totalEstimated > 0 && Number.isFinite(fs.itemsScanned)) {
                return Math.min(99, Math.max(1, Math.round((fs.itemsScanned / fs.totalEstimated) * 100)));
            }
            if (State.fastScanCheckpointMeta && Number.isFinite(State.fastScanCheckpointMeta.pct)) {
                return State.fastScanCheckpointMeta.pct;
            }
            return null;
        };

        // Collapsed / expanded chrome
        State.UI.container.classList.toggle('fab-helper-collapsed', !expanded);
        if (State.UI.tabsContainer) {
            State.UI.tabsContainer.style.display = expanded ? 'flex' : 'none';
        }
        const activeTab = State.activeTab || 'dashboard';
        for (const name in State.UI.tabContents) {
            if (State.UI.tabContents[name]) {
                State.UI.tabContents[name].style.display = (expanded && name === activeTab) ? 'block' : 'none';
            }
        }
        if (State.UI.collapseBtn) {
            State.UI.collapseBtn.textContent = expanded ? '−' : '+';
            State.UI.collapseBtn.title = Utils.getText(expanded ? 'tooltip_collapse_ui' : 'tooltip_expand_ui');
            State.UI.collapseBtn.setAttribute('aria-label', State.UI.collapseBtn.title);
            State.UI.collapseBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
        if (State.UI.headerLiveBadge) {
            let badgeText = '';
            const fastRunning = FastScanner.isRunning() || Boolean(fs?.running);
            if (!expanded) {
                if (fastRunning && fs) {
                    if (fs.totalEstimated > 0) {
                        const pct = Math.min(100, Math.round((fs.itemsScanned / fs.totalEstimated) * 100));
                        badgeText = `⚡ ${pct}%`;
                    } else {
                        badgeText = `⚡ ${fs.itemsScanned.toLocaleString()}`;
                    }
                } else if (isRunning) {
                    badgeText = State.executionTotalTasks > 0
                        ? `${State.executionCompletedTasks + State.executionFailedTasks}/${State.executionTotalTasks}`
                        : (State.lang === 'zh' ? '执行中' : 'Running');
                } else if (hasCheckpoint) {
                    const pct = getCheckpointPct();
                    badgeText = pct != null ? `▶ ${pct}%` : (State.lang === 'zh' ? '⚡ 断点' : '⚡ Paused');
                }
            }
            State.UI.headerLiveBadge.textContent = badgeText;
            State.UI.headerLiveBadge.style.display = badgeText ? 'inline-flex' : 'none';
        }

        // Structured progress micro-card (hidden cleanly when idle without checkpoint)
        if (State.UI.fastScanStatusDisplay) {
            const card = State.UI.fastScanStatusDisplay;
            const titleEl = card._titleEl;
            const pctEl = card._pctEl;
            const metaLeftEl = card._metaLeftEl;
            const metaRightEl = card._metaRightEl;
            const zh = State.lang === 'zh';

            const setTrack = (show, pct) => {
                if (!State.UI.progressTrack || !State.UI.progressBar) return;
                State.UI.progressTrack.style.display = show ? 'block' : 'none';
                State.UI.progressBar.style.width = show ? `${Math.min(100, Math.max(0, pct || 0))}%` : '0%';
            };

            const setClaimedMeta = (claimedCount) => {
                if (!metaRightEl) return;
                const n = Number(claimedCount) || 0;
                metaRightEl.textContent = zh
                    ? (n > 0 ? `新入库 +${n}` : '新入库 0')
                    : (n > 0 ? `+${n} claimed` : '0 claimed');
                metaRightEl.classList.toggle('is-success', n > 0);
            };

            if (pctEl) pctEl.classList.remove('is-success');
            if (metaLeftEl) metaLeftEl.classList.remove('is-warn');
            if (metaRightEl) metaRightEl.classList.remove('is-success');

            if (isFallback) {
                card.style.display = 'block';
                const total = State.executionTotalTasks;
                const done = State.executionCompletedTasks + State.executionFailedTasks;
                if (isRunning && total > 0) {
                    const pct = Math.min(100, Math.round((done / total) * 100));
                    if (titleEl) titleEl.textContent = `${done.toLocaleString()} / ${total.toLocaleString()}`;
                    if (pctEl) pctEl.textContent = `${pct}%`;
                    setTrack(true, pct);
                } else if (isRunning) {
                    if (titleEl) titleEl.textContent = zh ? '正在滚页扫描当前列表' : 'Scrolling list';
                    if (pctEl) pctEl.textContent = '';
                    setTrack(false, 0);
                } else {
                    if (titleEl) titleEl.textContent = Utils.getText('status_idle_fallback');
                    if (pctEl) pctEl.textContent = '';
                    setTrack(false, 0);
                }
                if (metaLeftEl) metaLeftEl.textContent = zh ? '应急滚页备用模式' : 'DOM scroll fallback';
                if (metaRightEl) metaRightEl.textContent = '';
            } else if (fs && fs.running) {
                card.style.display = 'block';
                const hasTotal = fs.totalEstimated > 0;
                const pct = hasTotal ? Math.min(100, Math.round((fs.itemsScanned / fs.totalEstimated) * 100)) : null;
                if (titleEl) {
                    titleEl.textContent = hasTotal
                        ? `${fs.itemsScanned.toLocaleString()} / ${fs.totalEstimated.toLocaleString()}`
                        : fs.itemsScanned.toLocaleString();
                }
                if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : '';
                setTrack(pct != null, pct || 0);
                const rateLimited = fs.rateLimitedUntil > Date.now();
                if (metaLeftEl) {
                    metaLeftEl.textContent = rateLimited
                        ? (zh ? '限速等待中' : 'Rate limited')
                        : (zh ? `${fs.itemsPerSec} 件/秒` : `${fs.itemsPerSec}/s`);
                    metaLeftEl.classList.toggle('is-warn', rateLimited);
                }
                setClaimedMeta(fs.claimedDirect);
            } else if (fs && fs.phase === 'completed') {
                card.style.display = 'block';
                if (titleEl) titleEl.textContent = Utils.getText('status_scan_done', fs.claimedDirect, fs.itemsScanned.toLocaleString());
                if (pctEl) {
                    pctEl.textContent = '100%';
                    pctEl.classList.add('is-success');
                }
                setTrack(true, 100);
                if (metaLeftEl) {
                    metaLeftEl.textContent = fs.failed > 0
                        ? (zh ? `失败 ${fs.failed} 项` : `${fs.failed} failed`)
                        : (zh ? '全部核对完毕' : 'All verified');
                }
                setClaimedMeta(fs.claimedDirect);
            } else if (fs && fs.phase === 'partial') {
                card.style.display = 'block';
                const pct = getCheckpointPct();
                if (titleEl) {
                    titleEl.textContent = Utils.getText(
                        'status_scan_partial',
                        fs.claimedDirect,
                        fs.itemsScanned.toLocaleString(),
                        fs.incompleteSlices || 1
                    );
                }
                if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : '';
                setTrack(pct != null, pct || 0);
                if (metaLeftEl) metaLeftEl.textContent = zh ? '已保存断点，可继续补扫' : 'Checkpoint saved';
                setClaimedMeta(fs.claimedDirect);
            } else if (hasCheckpoint) {
                card.style.display = 'block';
                const pct = getCheckpointPct();
                const scanned = fs?.itemsScanned ?? State.fastScanCheckpointMeta?.itemsScanned ?? 0;
                const total = fs?.totalEstimated ?? State.fastScanCheckpointMeta?.totalEstimated ?? 0;
                if (titleEl) {
                    titleEl.textContent = total > 0
                        ? Utils.getText('status_checkpoint_pct', pct || 0, Number(scanned).toLocaleString(), Number(total).toLocaleString())
                        : Utils.getText('status_checkpoint_generic');
                }
                if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : '';
                setTrack(pct != null, pct || 0);
                if (metaLeftEl) metaLeftEl.textContent = zh ? '可继续或点右侧重扫' : 'Resume or restart';
                if (metaRightEl) metaRightEl.textContent = '';
            } else {
                card.style.display = 'none';
                setTrack(false, 0);
            }
        }

        // Update Unified Status Numbers (single source of truth)
        const todoCount = State.db.todo.length + (fs && fs.running ? (fs.pendingCount || 0) : 0);
        const doneCount = State.db.done.length;
        const failedCount = State.db.failed.length;

        const setStatusCount = (item, val) => {
            if (!item) return;
            const span = item._valueEl || item.querySelector('span');
            if (span) span.textContent = Number(val || 0).toLocaleString();
        };
        setStatusCount(State.UI.statusTodo, todoCount);
        setStatusCount(State.UI.statusDone, doneCount);
        setStatusCount(State.UI.statusFailed, failedCount);

        if (State.UI.statusFailed) {
            State.UI.statusFailed.classList.toggle('has-failed', failedCount > 0);
        }

        // Update Primary Execute Button & Checkpoint Reset Button
        if (State.UI.execBtn) {
            if (isRunning) {
                State.UI.execBtn.textContent = Utils.getText(isFallback ? 'exec_fallback_stop' : 'exec_full_stop');
                State.UI.execBtn.classList.add('executing');
                if (!isFallback && FastScanner.isRunning() && fs && fs.totalEstimated > 0) {
                    const percentage = Math.min(100, Math.round((fs.itemsScanned / fs.totalEstimated) * 100));
                    State.UI.execBtn.title = Utils.getText('tooltip_executing_progress', fs.itemsScanned, fs.totalEstimated, percentage);
                } else if (State.executionTotalTasks > 0) {
                    const progress = State.executionCompletedTasks + State.executionFailedTasks;
                    const percentage = Math.round((progress / State.executionTotalTasks) * 100);
                    State.UI.execBtn.title = Utils.getText('tooltip_executing_progress', progress, State.executionTotalTasks, percentage);
                } else {
                    State.UI.execBtn.title = Utils.getText('tooltip_executing');
                }
            } else {
                if (isFallback) {
                    State.UI.execBtn.textContent = Utils.getText('exec_fallback_start');
                } else if (hasCheckpoint) {
                    const pct = getCheckpointPct();
                    State.UI.execBtn.textContent = pct != null
                        ? Utils.getText('exec_full_resume_pct', pct)
                        : Utils.getText('exec_full_resume');
                } else {
                    State.UI.execBtn.textContent = Utils.getText('exec_full_start');
                }
                State.UI.execBtn.classList.remove('executing');
                State.UI.execBtn.title = Utils.getText('tooltip_start_tasks');
            }
        }

        if (State.UI.resetCheckpointBtn) {
            const showRestart = !isRunning && !isFallback && hasCheckpoint;
            State.UI.resetCheckpointBtn.style.display = showRestart ? '' : 'none';
            State.UI.resetCheckpointBtn.disabled = !showRestart;
        }

        // 后台保活状态(实测用)：执行时显示心跳/防冻结状态，非执行时隐藏
        if (State.UI.statusKeepAlive) {
            if (!isRunning) {
                State.UI.statusKeepAlive.style.display = 'none';
            } else {
                State.UI.statusKeepAlive.style.display = '';
                const ka = KeepAlive.getStatus();
                if (!ka.heartbeatAlive) {
                    State.UI.statusKeepAlive.textContent = `🛡️ ${Utils.getText('keepalive_label')}: ${Utils.getText('keepalive_dead')}`;
                } else {
                    const ago = ka.lastTickAgoMs == null ? '?' : Math.round(ka.lastTickAgoMs / 1000);
                    const fg = ka.freezeGuard === 'open' ? '❄️on' : (ka.freezeGuard === 'off' ? '❄️off' : '❄️…');
                    State.UI.statusKeepAlive.textContent = `🛡️ ${Utils.getText('keepalive_label')}: ♥${ago}s · ${fg}`;
                }
            }
        }

        // Conditional inline retry pill inside Failed metric card
        if (State.UI.retryFailedBtn) {
            State.UI.retryFailedBtn.style.display = failedCount > 0 ? 'inline-flex' : 'none';
            State.UI.retryFailedBtn.textContent = Utils.getText('retry_failed');
            State.UI.retryFailedBtn.disabled = failedCount === 0;
            State.UI.retryFailedBtn.title = failedCount > 0
                ? `${Utils.getText('retry_failed')} (${failedCount})`
                : Utils.getText('no_failed_tasks');
        }

        // Quick Pills
        const syncPill = (btn, active) => {
            if (!btn) return;
            const on = Boolean(active);
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        };
        syncPill(State.UI.quickAutoClaimBtn, State.autoClaimVisible);
        syncPill(State.UI.quickHideSavedBtn, State.hideSaved);
        syncPill(State.UI.quickHidePaidBtn, State.hidePaid);

        // Sync Settings inputs & fallback controls
        if (State.UI.domFallbackCheckbox) {
            State.UI.domFallbackCheckbox.checked = isFallback;
        }
        if (State.UI.domFallbackControls) {
            State.UI.domFallbackControls.style.display = isFallback ? 'block' : 'none';
        }
        if (State.UI.savedPositionDisplay) {
            State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
        }
        if (State.UI.maxWorkersInput && document.activeElement !== State.UI.maxWorkersInput) {
            State.UI.maxWorkersInput.value = State.maxWorkers;
        }
        if (State.UI.apiScanConcurrencyInput && document.activeElement !== State.UI.apiScanConcurrencyInput) {
            State.UI.apiScanConcurrencyInput.value = State.apiScanConcurrency;
        }
        if (State.UI.rememberPositionCheckbox) {
            State.UI.rememberPositionCheckbox.checked = Boolean(State.rememberScrollPosition);
        }
        if (State.UI.debugModeCheckbox) {
            State.UI.debugModeCheckbox.checked = Boolean(State.debugMode);
        }
    },

    removeAllOverlays: () => {
        document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
            const overlay = card.querySelector('.fab-helper-overlay');
            if (overlay) overlay.remove();
            card.style.opacity = '1';
        });
    },

    showToast: (message, isPersistent = false) => {
        let container = document.getElementById('fab-helper-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'fab-helper-toast-container';
            container.className = 'fab-helper-toast-container';
            document.body.appendChild(container);
        }

        // 避免重复弹出相同内容的长久提示
        const existingToasts = container.querySelectorAll('.fab-helper-toast');
        for (const existing of existingToasts) {
            if (existing.querySelector('.fab-helper-toast-content')?.textContent === message) {
                return; // 已经有相同的气泡了，不再重复弹
            }
        }

        const toast = document.createElement('div');
        toast.className = 'fab-helper-toast';
        
        const content = document.createElement('div');
        content.className = 'fab-helper-toast-content';
        content.textContent = message;
        toast.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'fab-helper-toast-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = Utils.getText('close') || 'Close';
        closeBtn.onclick = () => {
            toast.style.animation = 'none';
            toast.style.transition = 'opacity 0.2s, transform 0.2s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 200);
        };
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        if (!isPersistent) {
            setTimeout(() => {
                if (toast.parentNode) {
                    closeBtn.click();
                }
            }, 5000); // 5秒后自动关闭
        }
    },

    switchTab: (tabName) => {
        State.activeTab = tabName;
        if (!State.uiExpanded) {
            State.uiExpanded = true;
            Database.saveUiExpandedPref();
        }
        for (const name in State.UI.tabs) {
            if (State.UI.tabs[name]) {
                State.UI.tabs[name].classList.toggle('active', name === tabName);
            }
            if (State.UI.tabContents[name]) {
                State.UI.tabContents[name].style.display = name === tabName ? 'block' : 'none';
            }
        }
        if (tabName === 'debug') {
            UI.updateDebugTab();
        }
        UI.update();
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
