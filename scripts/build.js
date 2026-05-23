import { build, context } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// 读取 package.json 获取版本号
const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf-8'));

// 生成构建时间戳
const buildTime = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '');
const version = `${pkg.version}-${buildTime}`;

// UserScript 元数据头
const userscriptBanner = `// ==UserScript==
// @name         Fab Helper
// @name:zh-CN   Fab Helper
// @name:en      Fab Helper
// @namespace    https://www.fab.com/
// @version      ${version}
// @description  Fab Helper 优化版 - 自动领取免费商品，已拥有自动隐藏，后台多标签处理，智能限速处理
// @description:zh-CN  Fab Helper 优化版 - 自动领取免费商品，已拥有自动隐藏，后台多标签处理，智能限速处理
// @description:en  Fab Helper Optimized - Auto-claim free items, auto-hide owned items, background multi-tab processing, smart rate-limit handling
// @author       RunKing
// @match        https://www.fab.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fab.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @connect      fab.com
// @connect      www.fab.com
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/541307/Fab%20Helper%20%28%E4%BC%98%E5%8C%96%E7%89%88%29.user.js
// @updateURL https://update.greasyfork.org/scripts/541307/Fab%20Helper%20%28%E4%BC%98%E5%8C%96%E7%89%88%29.meta.js
// ==/UserScript==
`;

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: [resolve(projectRoot, 'src/index.js')],
    bundle: true,
    outfile: resolve(projectRoot, 'dist/fab_helper.user.js'),
    format: 'iife',
    target: 'es2020',
    minify: false, // 保持可读性，便于调试
    keepNames: true,
    banner: {
        js: userscriptBanner
    },
    define: {
        '__VERSION__': JSON.stringify(version),
        '__BUILD_TIME__': JSON.stringify(buildTime)
    }
};

async function runBuild() {
    try {
        if (isWatch) {
            const ctx = await context(buildOptions);
            await ctx.watch();
            console.log('👀 Watching for changes...');
        } else {
            await build(buildOptions);
            console.log(`✅ Build complete: dist/fab_helper.user.js (v${version})`);
        }
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

runBuild();
