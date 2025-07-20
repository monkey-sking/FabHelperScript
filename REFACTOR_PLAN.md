# Refactoring and Feature Plan

This document outlines the plan for refactoring the Fab Helper userscript and adding new features.

## Phase 1: Hot Reload Feature

### Goal
Implement a "hot-reloading" feature to allow updating the script's code and functionality in-place, without requiring a full page refresh. This will significantly speed up development and testing.

### UI Implementation
-   A new button labeled "🔥 热更新脚本" (Hot-reload Script) will be added to the "Basic Functions" section of the control panel.

### Technical Implementation
1.  **Add UI Button**: Create the button and link it to a new `TaskRunner.hotReloadScript` function.

2.  **Enhance Cleanup Logic**: Create a comprehensive `Utils.cleanup` function that will be responsible for tearing down the currently running script instance. This involves:
    -   Removing all UI elements (control panel, overlays, styles).
    -   Disconnecting all `MutationObserver` instances.
    -   Removing all `GM_addValueChangeListener` listeners.
    -   Clearing any active timers (`setInterval`).
    -   Removing any properties added to `unsafeWindow`.
    -   Removing any document-level event listeners.

3.  **Implement Hot Reload Function (`TaskRunner.hotReloadScript`)**:
    -   This function will be triggered by the new button.
    -   It will first ask for user confirmation.
    -   It will fetch the latest script content from the URL specified in the `@downloadURL` metadata field. We'll add a fallback or a development URL for local testing.
    -   Upon successful fetch, it will call the `Utils.cleanup` function.
    -   Finally, it will execute the new script code using `eval()`, effectively replacing the old script with the new one. A `try...catch` block will be used to handle potential errors during execution of the new script.