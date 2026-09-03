import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ListingSource,
    SearchError,
    FREE_POLICY,
    SEARCH_PATH
} from '../src/modules/listing-source.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));

const PAGE1 = read('fab-search-page1.json');
const LAST_PAGE = read('fab-search-last-page.json');

function fresh() {
    ListingSource.reset();
    ListingSource.configure({
        fetchImpl: null, buildUrl: null, getBaseParams: null, getHeaders: null,
        baseParams: { is_free: '1', sort_by: 'title' },
        freePolicy: FREE_POLICY.FLAG_OR_PRICE
    });
    return ListingSource;
}

/** 用夹具伪造搜索接口。多页时按顺序出页，可注入 429。 */
function fakeFetch(pages, { failAt = -1, status = 429, headers = '' } = {}) {
    let n = 0;
    return async (url) => {
        if (n === failAt) {
            return { status, responseText: '{}', responseHeaders: headers };
        }
        const payload = pages[n] !== undefined ? pages[n] : LAST_PAGE;
        n += 1;
        return { status: 200, responseText: JSON.stringify(payload) };
    };
}

test('normalize 从真实抓包样本中还原出任务对象', () => {
    fresh();
    const raw = PAGE1.results[0];
    const item = ListingSource.normalize(raw);

    assert.equal(item.uid, 'f32c6ac7-ae94-4fd5-be5a-0d9985b99917');
    assert.equal(item.url, 'https://www.fab.com/listings/f32c6ac7-ae94-4fd5-be5a-0d9985b99917');
    assert.equal(item.name, '"Preservons la Creation" (giant mural)');
    assert.equal(item.price, 0);
    assert.equal(item.currency, 'USD');
    assert.equal(item.listingType, '3d-model');
    assert.equal(item.seller, 'Austin Beaulier');
    assert.deepEqual(item.licenses.map(l => l.name), ['Personal', 'Professional']);
    assert.equal(item.isFreeFlag, false);
});

test('normalize 汇总 offerId 供后续价格复查使用', () => {
    fresh();
    const item = ListingSource.normalize(PAGE1.results[0]);
    // startingPrice.offerId 在前，许可证 uid 在后
    assert.equal(item.offerId, '6d30ae93f19647ee8c276d855edcee89');
    assert.equal(item.offerIds.length, 3);
    assert.ok(item.offerIds.includes('6d30ae93f19647ee8c276d855edcee89'));
});

test('真实样本中 isFree 与 price 的矛盾被如实保留（防止有人"修正"夹具掩盖问题）', () => {
    fresh();
    const items = PAGE1.results.map(ListingSource.normalize);
    const flagFalse = items.filter(i => i.isFreeFlag === false);
    const flagTrue = items.filter(i => i.isFreeFlag === true);

    assert.equal(flagFalse.length, 2, '样本应有 2 条 isFree=false');
    assert.equal(flagTrue.length, 2, '样本应有 2 条 isFree=true');

    // 矛盾点：即便 isFree=false 的两条，价格同样是 0
    flagFalse.forEach(i => assert.equal(i.price, 0, `isFree=false 的 ${i.uid} 价格也是 0`));

    // 且 isFree=true 的均为 CC0 类许可，isFree=false 的均为 Personal/Professional
    flagTrue.forEach(i => assert.ok(i.licenses.some(l => l.isCc0)));
    flagFalse.forEach(i => assert.ok(i.licenses.some(l => l.name === 'Personal')));
});

test('FLAG_ONLY 策略会漏掉一半真实商品（这是默认走并集的理由）', () => {
    fresh();
    const items = PAGE1.results.map(ListingSource.normalize);

    ListingSource.freePolicy = FREE_POLICY.FLAG_ONLY;
    const byFlag = items.filter(ListingSource.isClaimable);
    assert.equal(byFlag.length, 2, '只认 isFree 标记时仅命中 2 条');

    ListingSource.freePolicy = FREE_POLICY.FLAG_OR_PRICE;
    const byUnion = items.filter(ListingSource.isClaimable);
    assert.equal(byUnion.length, 4, '并集策略命中全部 4 条，与现行 DOM 判据行为一致');
});

test('parsePage 解析真实首页：4 条商品、游标非空、未到底', () => {
    fresh();
    const page = ListingSource.parsePage(PAGE1);
    assert.equal(page.items.length, 4);
    assert.equal(page.isEnd, false);
    assert.equal(page.nextCursor, PAGE1.cursors.next);
    assert.equal(page.malformed, false);
});

test('parsePage 解析真实末页：cursors.next === null 是到底的唯一权威信号', () => {
    fresh();
    const page = ListingSource.parsePage(LAST_PAGE);
    assert.equal(page.items.length, 0);
    assert.equal(page.nextCursor, null);
    assert.equal(page.isEnd, true);
});

test('parsePage 在 cursors 缺失时能从顶层 next URL 抠出游标', () => {
    fresh();
    const page = ListingSource.parsePage({
        next: 'https://www.fab.com/i/listings/search?cursor=ABC123&is_free=1&sort_by=title',
        results: []
    });
    assert.equal(page.nextCursor, 'ABC123');
    assert.equal(page.isEnd, false);
});

test('parsePage 对垃圾输入不抛错，一律收敛为「空页 + 到底」', () => {
    fresh();
    [null, undefined, 42, 'oops', [], {}].forEach(bad => {
        const page = ListingSource.parsePage(bad);
        assert.deepEqual(page.items, []);
        assert.equal(page.isEnd, true);
    });
    // 只有非对象才算畸形；空数组/空对象是合法的「空页」形态
    assert.equal(ListingSource.stats.malformedPages, 4);
});

test('响应体直接是数组时按 results 处理（与 index.js extractStateData 口径一致）', () => {
    fresh();
    const page = ListingSource.parsePage(PAGE1.results);
    assert.equal(page.items.length, 4);
    assert.equal(page.isEnd, true, '裸数组没有游标，只能视为末页');
    assert.equal(page.malformed, false);
});

test('normalize 丢弃无 uid 的脏数据而不是让整页作废', () => {
    fresh();
    const items = [null, {}, { title: 'no uid' }, PAGE1.results[1]]
        .map(ListingSource.normalize)
        .filter(Boolean);
    assert.equal(items.length, 1);
    assert.equal(items[0].uid, '20121d20-b012-4f32-adb7-9c7e9c482373');
});

test('effectivePrice 优先取折扣价，未知价格返回 null 而不是 0', () => {
    fresh();
    assert.equal(ListingSource.effectivePrice({ price: 10, discountedPrice: 3 }), 3);
    assert.equal(ListingSource.effectivePrice({ price: 0, discountedPrice: null }), 0);
    assert.equal(ListingSource.effectivePrice({ price: null, discountedPrice: null }), null);
    // 关键：价格未知绝不能被当成免费
    assert.equal(ListingSource.isClaimable({ uid: 'x', price: null, isFreeFlag: false }), false);
});

test('buildUrl 首页不带 cursor，后续页带；与抓包原文的参数顺序无关', () => {
    fresh();
    const first = ListingSource.buildUrl(null);
    assert.ok(first.startsWith(`https://www.fab.com${SEARCH_PATH}?`));
    assert.ok(first.includes('is_free=1'));
    assert.ok(first.includes('sort_by=title'));
    assert.ok(!first.includes('cursor='));

    const second = ListingSource.buildUrl('cD0lMjhGUkVF');
    assert.ok(second.includes('cursor=cD0lMjhGUkVF'));
});

test('fetchPage 走通完整链路并累计统计', async () => {
    fresh();
    ListingSource.configure({ fetchImpl: fakeFetch([PAGE1, LAST_PAGE]) });

    const page = await ListingSource.fetchPage(null);
    assert.equal(page.items.length, 4);
    assert.equal(page.isEnd, false);
    assert.equal(ListingSource.stats.pagesFetched, 1);
    assert.equal(ListingSource.stats.itemsSeen, 4);
});

test('翻页链路：连续拉取直到 cursors.next 为 null 才停', async () => {
    fresh();
    ListingSource.configure({ fetchImpl: fakeFetch([PAGE1, PAGE1, LAST_PAGE]) });

    let cursor = null, pages = 0, total = 0;
    for (;;) {
        const page = await ListingSource.fetchPage(cursor);
        pages += 1;
        total += page.items.length;
        if (page.isEnd) break;
        cursor = page.nextCursor;
        assert.ok(pages < 10, '不应无限翻页');
    }
    assert.equal(pages, 3);
    assert.equal(total, 8);
});

test('429 抛 SearchError 并带上 retryAfterMs（毫秒）', async () => {
    fresh();
    ListingSource.configure({ fetchImpl: fakeFetch([PAGE1], { failAt: 0, headers: 'retry-after: 7' }) });

    await assert.rejects(
        () => ListingSource.fetchPage(null),
        (err) => {
            assert.ok(err instanceof SearchError);
            assert.equal(err.status, 429);
            assert.equal(err.retryAfterMs, 7000);
            return true;
        }
    );
});

test('429 无响应头时 retryAfterMs 为 null，由上层退避策略兜底', async () => {
    fresh();
    ListingSource.configure({ fetchImpl: fakeFetch([PAGE1], { failAt: 0 }) });

    await assert.rejects(
        () => ListingSource.fetchPage(null),
        (err) => err instanceof SearchError && err.status === 429 && err.retryAfterMs === null
    );
});

test('5xx 与非 2xx 抛 SearchError，且不计入已抓取页数', async () => {
    fresh();
    ListingSource.configure({ fetchImpl: fakeFetch([PAGE1], { failAt: 0, status: 500 }) });

    await assert.rejects(
        () => ListingSource.fetchPage(null),
        (err) => err instanceof SearchError && err.status === 500
    );
    assert.equal(ListingSource.stats.pagesFetched, 0);
});

test('非法 JSON 抛 SearchError 而不是返回空页（静默空页会被误判成"到底"）', async () => {
    fresh();
    ListingSource.configure({
        fetchImpl: async () => ({ status: 200, responseText: '<html>oops</html>' })
    });

    await assert.rejects(
        () => ListingSource.fetchPage(null),
        (err) => err instanceof SearchError && /JSON/.test(err.message)
    );
});

test('未配置 fetchImpl 时明确报错，而不是静默返回空页', async () => {
    fresh();
    await assert.rejects(
        () => ListingSource.fetchPage(null),
        (err) => err instanceof SearchError && err.status === 0
    );
});

test('configure 可整体替换基础参数（跟随用户页面筛选条件）', () => {
    fresh();
    ListingSource.configure({ baseParams: { is_free: '1', sort_by: 'relevance', category: '3d' } });
    const url = ListingSource.buildUrl(null);
    assert.ok(url.includes('sort_by=relevance'));
    assert.ok(url.includes('category=3d'));
    assert.ok(!url.includes('title'));
});

test('reset 只清统计，不重置已注入的依赖与策略', () => {
    fresh();
    const impl = fakeFetch([PAGE1]);
    ListingSource.configure({ fetchImpl: impl, freePolicy: FREE_POLICY.PRICE_ONLY });
    ListingSource.stats.pagesFetched = 9;

    ListingSource.reset();

    assert.equal(ListingSource.stats.pagesFetched, 0);
    assert.equal(ListingSource.deps.fetchImpl, impl, '依赖不应被 reset 清掉');
    assert.equal(ListingSource.freePolicy, FREE_POLICY.PRICE_ONLY, '策略不应被 reset 清掉');
});
