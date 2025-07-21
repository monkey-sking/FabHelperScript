# Debugging Journey: Fab Helper Script v1.4.0

This document chronicles the extensive and challenging process of debugging the Fab Helper userscript, specifically addressing a persistent issue where the script stalls after processing an initial batch of 5 tasks.

## 1. Initial Problem Report

The user reported that the script, intended to process a queue of tasks concurrently using up to 5 worker tabs, would successfully dispatch the first 5 workers, but would fail to dispatch any further tasks after the initial batch completed. The "To-Do" list in the UI would still show remaining tasks, but the script would remain idle.

## 2. The Long Road of Failed Hypotheses

The debugging process was marked by a series of incorrect assumptions and failed fixes. This journey is documented here to provide a clear record of what was attempted and why it failed, ultimately leading to the correct diagnosis.

### Hypothesis #1: Worker UI Interaction Failure

**- Observation:** The script was stalling, and no success/failure updates were being registered. The user noted that for some items, a "paid" popup would appear.
**- Theory:** The worker tabs were clicking the wrong button (e.g., "Add to Cart" instead of "Add to my library"), causing them to get stuck waiting for a success indicator that would never appear. This would prevent them from ever reporting back to the main tab.
**- Action Taken:** The `processDetailPage` function was rewritten multiple times to use increasingly specific methods for finding the correct button, culminating in a version that searched for a button by its exact text content (`Config.ACQUISITION_TEXT_SET`).
**- Result: FAILURE.** The issue persisted. While the button-clicking logic was made more robust, it was not the root cause of the stall.

### Hypothesis #2: Faulty Inter-Tab Communication Protocol

**- Observation:** Even with robust UI interaction, the main "brain" tab did not seem to be receiving completion reports from the worker tabs.
**- Theory:** There was a fundamental flaw in the `GM_addValueChangeListener` communication channel. Several sub-theories were explored:
    1.  **Unique Report Keys:** I theorized that multiple workers reporting to the same key (`fab_worker_done_v8`) might be causing a race condition where reports were overwritten. I changed the logic to use a unique report key for each worker and a `key.startsWith()` check in the listener. This was a critical error, as `GM_addValueChangeListener` **does not support wildcard listeners**.
    2.  **The `remote` Flag:** I suspected the `remote` flag in the listener's callback was behaving unreliably, causing the brain to ignore legitimate reports from workers.
**- Action Taken:** I first implemented the faulty unique key system, which made things worse. I then reverted to a single, shared report key and added diagnostic probes to log the raw data received by the listener, including the `remote` flag. I also removed the check for the `remote` flag as a "just-in-case" fix.
**- Result: FAILURE.** The diagnostic probes provided invaluable information. They showed that the brain **was** receiving reports, the `remote` flag was working correctly, and the reports were being processed. However, the script still stalled. This definitively proved that the communication channel itself was not the problem.

### Hypothesis #3: Cached Script Execution

**- Observation:** A user-provided log file showed the script identifying itself as `v1.1.0`, while all recent edits were being made to a file versioned as `v1.3.0` and later `v1.4.0`.
**- Theory:** The browser's userscript manager (Tampermonkey) was aggressively caching an old version of the script. None of the recent fixes were actually being executed.
**- Action Taken:** The script's `@version` header and internal `SCRIPT_NAME` constant were forcefully bumped to `v1.4.0` to invalidate the cache. A small delay was also added before `window.close()` in the worker as a secondary safety measure.
**- Result: PARTIAL SUCCESS, BUT ULTIMATE FAILURE.** This was a genuine and serious issue. Forcing the version update ensured the user was running the latest code. The logs immediately reflected this, and our diagnostic probes started appearing. However, the core issue of stalling after 5 tasks remained, proving that while the caching was a real problem, it was masking a deeper, more fundamental bug.

### Hypothesis #4: UI Refresh Logic Disconnected

**- Observation:** The user reported that even when tasks were completing, the UI on the main page (checkmarks on cards, hiding, counter updates) was not refreshing.
**- Theory:** The logic connecting a successful task report to a UI refresh was missing.
**- Action Taken:** A call to `TaskRunner.runHideOrShow()` was added inside the listener, immediately after `Database.markAsDone()`. The `runHideOrShow` function itself was also rewritten to be more robust.
**- Result: PARTIAL SUCCESS, BUT ULTIMATE FAILURE.** This was another legitimate bug. Adding the refresh call correctly fixed the UI feedback loop. However, it did not fix the underlying stall.

## 3. The Final Diagnosis (Revealed by the Logs)

The diagnostic probes from our last attempt finally provided the "smoking gun." The user's final log file showed the following critical sequence:

1.  `[Listener] ... Active workers now: 4`
2.  `[Listener] ... Active workers now: 3`
3.  `[Listener] ... Active workers now: 2`
4.  `[Listener] ... Active workers now: 1`
5.  `[Listener] ... Active workers now: 0`
6.  `[智能追击] ... 自动触发新一轮扫描...`
7.  The scan finds new items and adds them to the `todo` queue.
8.  **The script stalls.**

The probes proved that `State.activeWorkers` **was being correctly decremented back to 0**. This invalidated my final hypothesis that the counter was stuck.

The true, undeniable root cause lies in the **Task Dispatcher (`executeBatch`)** and its interaction with the **Smart Pursuit (`智能追击`)** logic.

Here is the flawed logic in `executeBatch`:

```javascript
// This is the ONLY place where new workers are created.
while (State.activeWorkers < Config.MAX_WORKERS && State.db.todo.length > 0) {
    // ... dispatch logic ...
}

// This logic runs AFTER the while loop is finished.
if (State.db.todo.length === 0 && State.activeWorkers === 0) {
     if (State.isSmartPursuitEnabled && !State.isScanning) {
         
         // This is an ASYNCHRONOUS operation.
         TaskRunner.processPageWithApi({ autoAdd: true }).then(newTasksCount => {
             if (newTasksCount > 0) {
                 // *** THE FATAL FLAW ***
                 // By the time this runs, the parent executeBatch function
                 // has already finished. This re-call starts a new context,
                 // but nothing ever calls executeBatch again if this second
                 // batch finishes.
                 TaskRunner.executeBatch();
             } else {
                 TaskRunner.stopExecution(); 
             }
         });
     } // ...
}
```

**The Fatal Flaw Explained:**

1.  The script starts. `executeBatch` is called. The `while` loop dispatches 5 workers. `activeWorkers` becomes 5. The function's `while` loop ends. The `if` condition is not met. The function effectively goes to sleep, waiting for the listener to do its job.
2.  The 5 workers finish one by one. The listener correctly decrements `activeWorkers` from 5 down to 0.
3.  When the last worker reports and `activeWorkers` becomes 0, the listener **does not re-call `executeBatch`**.
4.  Instead, the **Smart Pursuit logic inside the original `executeBatch` call** is what gets triggered. It starts its *asynchronous* scan, finds new tasks, and calls `executeBatch` again.
5.  This second call to `executeBatch` correctly dispatches a new batch of workers.
6.  **BUT**, there is no mechanism to continue this loop. The logic is not a continuous "check-and-dispatch" loop. It's a one-shot `if` statement at the end of a function that has already run. When this second batch of workers completes, `activeWorkers` will go to 0, but the `if` condition that triggers Smart Pursuit will not be re-evaluated, because the listener never calls `executeBatch`.

The entire control flow is flawed. The dispatcher and the task completion listener are not correctly linked to form a continuous processing loop.

## 4. The Path to a True Solution

The fix is not a small tweak, but a fundamental change to the control flow. The `executeBatch` function needs to be redesigned to be the single source of truth for dispatching, and the listener's only job should be to decrement the counter and then immediately ask `executeBatch` to check if more work can be done.

**Proposed Correct Logic:**

```javascript
// In TaskRunner.init (The Listener)
GM_addValueChangeListener(..., async (..., newValue, ...) => {
    // ... (process the report, mark as done)
    
    if (State.runningWorkers[workerId]) {
        delete State.runningWorkers[workerId];
        State.activeWorkers--;
    }

    // *** THE CRITICAL CHANGE ***
    // After every single worker finishes, immediately ask the dispatcher
    // to check its work. This creates the continuous loop.
    TaskRunner.executeBatch(); 
});


// In TaskRunner.executeBatch
const TaskRunner = {
    executeBatch: async () => {
        if (!State.isExecuting) return;

        // 1. Dispatch new workers if there is capacity and tasks are available.
        while (State.activeWorkers < Config.MAX_WORKERS && State.db.todo.length > 0) {
            // ... dispatch logic ...
        }

        // 2. Check for completion and trigger Smart Pursuit if necessary.
        // This check will now run every time a worker finishes and calls executeBatch.
        if (State.db.todo.length === 0 && State.activeWorkers === 0) {
             if (State.isSmartPursuitEnabled && !State.isScanning) {
                 // Asynchronous, but that's okay. The next call to executeBatch
                 // will happen inside the .then() block.
                 TaskRunner.processPageWithApi({ autoAdd: true }).then(newTasksCount => {
                     if (newTasksCount > 0) {
                         // The loop continues.
                         TaskRunner.executeBatch();
                     } else {
                         // The loop terminates.
                         TaskRunner.stopExecution(); 
                     }
                 });
             } else if (!State.isScanning && !State.isSmartPursuitEnabled) {
                // If pursuit is off and we are out of tasks/workers, we are truly done.
                TaskRunner.stopExecution();
             }
        }
    }
}
```

This revised structure creates a robust, continuous loop where the dispatcher is constantly being re-evaluated, ensuring that as soon as a worker slot opens up, it is immediately filled if tasks are available. This is the correct way to solve the stall.
