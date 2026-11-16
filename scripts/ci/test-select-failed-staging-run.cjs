const { test } = require('node:test');
const assert = require('node:assert/strict');
const select = require('./select-failed-staging-run.cjs');

const sha = 'c'.repeat(40);
const run = {
    id: 7001,
    run_attempt: 1,
    path: '.github/workflows/deploy-staging.yml@refs/heads/develop',
    event: 'workflow_dispatch',
    head_branch: 'develop',
    head_repository: { full_name: 'leanderarya/dombi' },
    actor: { login: 'leanderarya' },
    head_sha: sha,
    conclusion: 'failure',
};

function fixture(overrides = {}, runId = '7001', attempt = '1') {
    const outputs = {};
    return {
        outputs,
        args: {
            github: { rest: { actions: {
                getWorkflowRun: async () => ({ data: { ...run, ...overrides } }),
            } } },
            context: { repo: { owner: 'leanderarya', repo: 'dombi' } },
            core: { setOutput: (key, value) => { outputs[key] = value; } },
            runId,
            attempt,
        },
    };
}

test('selects the exact failed staging run and attempt', async () => {
    const { args, outputs } = fixture();
    await select(args);
    assert.deepEqual(outputs, { transfer_id: '7001-1', workflow_sha: sha });
});

test('accepts a cancelled exact run so an owner can recover an interrupted deployment', async () => {
    for (const conclusion of ['cancelled', 'timed_out']) {
        const { args, outputs } = fixture({ conclusion });
        await select(args);
        assert.equal(outputs.transfer_id, '7001-1');
    }
});

test('rejects malformed, alternate, successful, or untrusted runs', async () => {
    for (const overrides of [
        { id: 7002 },
        { run_attempt: 2 },
        { path: '.github/workflows/deploy.yml' },
        { event: 'push' },
        { head_branch: 'main' },
        { head_repository: { full_name: 'fork/dombi' } },
        { actor: { login: 'other-user' } },
        { head_sha: 'bad' },
        { conclusion: 'success' },
        { conclusion: 'skipped' },
    ]) {
        await assert.rejects(select(fixture(overrides).args));
    }
    await assert.rejects(select(fixture({}, '0', '1').args), /Positive/);
    await assert.rejects(select(fixture({}, '7001', '0').args), /Positive/);
    await assert.rejects(select(fixture({}, '9007199254740993', '1').args), /Positive/);
    const wrongRepository = fixture().args;
    wrongRepository.context.repo.owner = 'fork';
    await assert.rejects(select(wrongRepository), /approved repository/);
});
