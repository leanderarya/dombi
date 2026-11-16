const { test } = require('node:test');
const assert = require('node:assert/strict');
const verify = require('./verify-staging-dispatch.cjs');

const revision = 'c'.repeat(40);
const valid = {
    eventName: 'workflow_dispatch',
    workflowKind: 'deploy',
    repository: 'leanderarya/dombi',
    actor: 'leanderarya',
    ref: 'refs/heads/develop',
    workflowRef: 'leanderarya/dombi/.github/workflows/deploy-staging.yml@refs/heads/develop',
    runAttempt: '1',
    sha: revision,
    workflowSha: revision,
};

test('accepts only the owner dispatching the exact develop workflow revision', () => {
    assert.deepEqual(verify(valid), { workflowSha: revision });
    assert.deepEqual(verify({
        ...valid,
        workflowKind: 'rollback',
        workflowRef: 'leanderarya/dombi/.github/workflows/rollback-staging.yml@refs/heads/develop',
    }), { workflowSha: revision });
});

test('rejects other events, actors, repositories, refs, revisions and reruns', () => {
    for (const override of [
        { eventName: 'push' },
        { repository: 'fork/dombi' },
        { actor: 'another-maintainer' },
        { ref: 'refs/heads/feature' },
        { workflowRef: 'leanderarya/dombi/.github/workflows/deploy-staging.yml@refs/heads/main' },
        { workflowKind: 'unknown' },
        { runAttempt: '2' },
        { sha: 'bad' },
        { workflowSha: 'd'.repeat(40) },
    ]) {
        assert.throws(() => verify({ ...valid, ...override }));
    }
});
