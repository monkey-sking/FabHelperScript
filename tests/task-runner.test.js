import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskRunner } from '../src/modules/task-runner.js';
import { Database } from '../src/modules/database.js';
import { State } from '../src/state.js';

function createAnchor({ text, href, visible = true }) {
    return {
        textContent: text,
        href,
        getBoundingClientRect: () => visible ? { width: 120, height: 40 } : { width: 0, height: 0 }
    };
}

test('detects external website CTA as a handled terminal state', () => {
    const root = {
        querySelectorAll: (selector) => {
            assert.equal(selector, 'a[href]');
            return [
                createAnchor({
                    text: '在外部网站查看',
                    href: 'https://odininspector.com/?utm_source=fabstore'
                })
            ];
        }
    };

    const result = TaskRunner.getExternalProductState(root);

    assert.deepEqual(result, {
        handled: true,
        reason: 'External CTA "在外部网站查看"',
        href: 'https://odininspector.com/?utm_source=fabstore'
    });
});

test('markAsDone clears stale failed entries for the same uid', async () => {
    const saved = [];
    globalThis.GM_setValue = async (key, value) => {
        saved.push({ key, value });
    };

    State.db.todo = [{
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector'
    }];
    State.db.done = [];
    State.db.failed = [{
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector',
        retryCount: 2
    }];

    await Database.markAsDone({
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector'
    });

    assert.equal(State.db.todo.length, 0);
    assert.equal(State.db.failed.length, 0);
    assert.deepEqual(State.db.done, ['https://www.fab.com/listings/listing-1']);
    assert.ok(saved.some(entry => entry.value === State.db.failed));
});

function createLicenseNode(options) {
    return {
        querySelectorAll: (selector) => {
            assert.equal(selector, 'span, div');
            return options.map(option => ({
                childNodes: [{ nodeType: 3, textContent: option.text }],
                textContent: option.text,
                closest: (closestSelector) => {
                    assert.equal(closestSelector, '[role="option"], button, label, input[type="radio"]');
                    return option.clickTarget;
                }
            }));
        }
    };
}

test('prefers explicit free license over paid personal option', () => {
    const paidPersonal = { id: 'paid-personal' };
    const freeProfessional = { id: 'free-professional' };
    const node = createLicenseNode([
        { text: 'Personal $29.99', clickTarget: paidPersonal },
        { text: 'Professional Free', clickTarget: freeProfessional }
    ]);

    const result = TaskRunner.findFreeLicenseOption(node);

    assert.equal(result, freeProfessional);
});
