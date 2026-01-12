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
        console.group('=== Fab Helper 页面状态诊断报告 ===');
        console.log(`页面: ${report.url}`);
        console.log(`标题: ${report.pageTitle}`);

        const visibleButtons = report.buttons.filter(b => b.isVisible);
        if (visibleButtons.length > 0) {
            console.log(`--- 可见按钮 (${visibleButtons.length}) ---`);
            visibleButtons.forEach(btn => {
                console.log(`  [${btn.index}] "${btn.text}" (禁用: ${btn.isDisabled}, 类: ${btn.classes.split(' ').slice(0, 2).join(' ')}...)`);
            });
        }

        const visibleLicenses = report.licenseOptions.filter(l => l.isVisible);
        if (visibleLicenses.length > 0) {
            console.log(`--- 可见许可选项 (${visibleLicenses.length}) ---`);
            visibleLicenses.forEach(opt => {
                console.log(`  [${opt.index}] "${opt.text}" (标签: ${opt.tagName}, 角色: ${opt.role || '无'})`);
            });
        }

        const visiblePrices = Object.values(report.priceInfo).filter(p => p.isVisible);
        if (visiblePrices.length > 0) {
            console.log(`--- 价格信息 (${visiblePrices.length}) ---`);
            visiblePrices.forEach(p => console.log(`  价格: "${p.text}"`));
        }

        const visibleOwned = Object.values(report.ownedStatus).filter(s => s.isVisible);
        if (visibleOwned.length > 0) {
            console.log(`--- 拥有状态 (${visibleOwned.length}) ---`);
            visibleOwned.forEach(s => console.log(`  状态: "${s.text}"`));
        }

        console.groupEnd();
    }
};
