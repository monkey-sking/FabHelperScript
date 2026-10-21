/** Browser permission belongs to the Fab origin; request it only from a settings click. */
export const VerificationNotifications = {
    sent: new Set(),
    permission: () => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,

    enableAndTest: async (lang = 'zh') => {
        if (typeof Notification === 'undefined') return 'unsupported';
        try {
            // Keep requestPermission directly in the user gesture call chain.
            const permission = Notification.permission === 'default'
                ? await Notification.requestPermission() : Notification.permission;
            if (permission === 'granted') {
                VerificationNotifications.show({ lang, test: true });
            }
            return permission;
        } catch { return 'unavailable'; }
    },

    show: ({ task, workerId, lang = 'zh', test = false, win = globalThis.window } = {}) => {
        if (VerificationNotifications.permission() !== 'granted') return false;
        const key = workerId || task?.uid;
        if (!test && key && VerificationNotifications.sent.has(key)) return false;
        const zh = lang === 'zh';
        try {
            const notification = new Notification(
                test ? (zh ? 'Fab Helper：通知已开启' : 'Fab Helper: notifications enabled')
                    : (zh ? 'Fab Helper：需要手动验证' : 'Fab Helper: verification needed'),
                {
                    body: test ? (zh ? '遇到人机验证时会在此提醒您。' : 'You will be notified when manual verification is needed.')
                        : `${task?.name || 'Fab'}\n${zh ? '请切换到标题含【需验证】的标签页，手动完成验证，再回主面板继续。' : 'The verification tab is kept open. Complete it manually, then resume from the main panel.'}`,
                    tag: test ? 'fab-helper-notification-test' : `fab-helper-verify-${key || Date.now()}`,
                    requireInteraction: !test
                }
            );
            notification.onclick = () => {
                try { win?.focus(); } catch { /* Browser may refuse tab activation. */ }
                notification.close();
            };
            if (!test && key) {
                VerificationNotifications.sent.add(key);
                if (VerificationNotifications.sent.size > 100) {
                    VerificationNotifications.sent.delete(VerificationNotifications.sent.values().next().value);
                }
            }
            return true;
        } catch { return false; }
    }
};
