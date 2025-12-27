/**
 * Fab Helper - Page Diagnostics
 */

export const PageDiagnostics = {
    // 诊断商品详情页面状态
    diagnoseDetailPage: () => {
        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            pageTitle: document.title,
            buttons: [],
            licenseOptions: [],
            priceInfo: {},
            ownedStatus: {},
            dynamicContent: {}
        };

        // 检测所有按钮
        const buttons = document.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            const text = btn.textContent?.trim();
            const isVisible = btn.offsetParent !== null;
            const isDisabled = btn.disabled;
            const classes = btn.className;

            if (text) {
                report.buttons.push({
                    index,
                    text,
                    isVisible,
                    isDisabled,
                    classes,
                    hasClickHandler: btn.onclick !== null
                });
            }
        });

        // 检测许可选择相关元素
        const licenseElements = document.querySelectorAll('[class*="license"], [class*="License"], [role="option"]');
        licenseElements.forEach((elem, index) => {
            const text = elem.textContent?.trim();
            const isVisible = elem.offsetParent !== null;

            if (text) {
                report.licenseOptions.push({
                    index,
                    text,
                    isVisible,
                    tagName: elem.tagName,
                    classes: elem.className,
                    role: elem.getAttribute('role')
                });
            }
        });

        // 检测价格信息
        const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"]');
        priceElements.forEach((elem, index) => {
            const text = elem.textContent?.trim();
            if (text) {
                report.priceInfo[`price_${index}`] = {
                    text,
                    isVisible: elem.offsetParent !== null,
                    classes: elem.className
                };
            }
        });

        // 检测拥有状态相关元素
        const ownedElements = document.querySelectorAll('h2, [class*="owned"], [class*="library"]');
        ownedElements.forEach((elem, index) => {
            const text = elem.textContent?.trim();
            if (text && (text.includes('库') || text.includes('Library') || text.includes('拥有') || text.includes('Owned'))) {
                report.ownedStatus[`owned_${index}`] = {
                    text,
                    isVisible: elem.offsetParent !== null,
                    tagName: elem.tagName,
                    classes: elem.className
                };
            }
        });

        return report;
    },

    // 输出诊断报告到日志
    logDiagnosticReport: (report) => {
        console.log('=== 页面状态诊断报告 ===');
        console.log(`页面: ${report.url}`);
        console.log(`标题: ${report.pageTitle}`);

        console.log(`--- 按钮信息 (${report.buttons.length}个) ---`);
        report.buttons.forEach(btn => {
            if (btn.isVisible) {
                console.log(`按钮: "${btn.text}" (可见: ${btn.isVisible}, 禁用: ${btn.isDisabled})`);
            }
        });

        console.log(`--- 许可选项 (${report.licenseOptions.length}个) ---`);
        report.licenseOptions.forEach(opt => {
            if (opt.isVisible) {
                console.log(`许可: "${opt.text}" (可见: ${opt.isVisible}, 角色: ${opt.role})`);
            }
        });

        console.log(`--- 价格信息 ---`);
        Object.entries(report.priceInfo).forEach(([, price]) => {
            if (price.isVisible) {
                console.log(`价格: "${price.text}"`);
            }
        });

        console.log(`--- 拥有状态 ---`);
        Object.entries(report.ownedStatus).forEach(([, status]) => {
            if (status.isVisible) {
                console.log(`状态: "${status.text}"`);
            }
        });

        console.log('=== 诊断报告结束 ===');
    }
};
