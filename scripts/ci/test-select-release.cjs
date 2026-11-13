const { test } = require('node:test');
const assert = require('node:assert/strict');
const select = require('./select-release.cjs');

const sha = 'a'.repeat(40);
const run = { id: 1, path: '.github/workflows/tests.yml', event: 'push', head_branch: 'develop',
    conclusion: 'success', head_sha: sha, head_repository: { full_name: 'owner/dombi' } };
const artifact = { id: 2, expired: false, workflow_run: { id: 1, head_sha: sha } };
function fixture(runOverrides = {}, artifacts = [artifact]) {
    const outputs = {};
    return { outputs, args: {
        github: { rest: { actions: { getWorkflowRun: async () => ({ data: { ...run, ...runOverrides } }),
            listArtifactsForRepo: () => {} } }, paginate: async () => artifacts },
        context: { repo: { owner: 'owner', repo: 'dombi' } },
        core: { setOutput: (key, value) => { outputs[key] = value; } }, runId: '1',
    } };
}
test('select exact trusted artifact', async () => {
    const { args, outputs } = fixture();
    await select(args);
    assert.deepEqual(outputs, { sha, artifact_id: '2', artifact_run_id: '1' });
});
test('reject untrusted CI, missing/expired/ambiguous artifacts and acceptance mismatch', async () => {
    for (const overrides of [{ event: 'pull_request' }, { head_branch: 'main' }, { conclusion: 'failure' },
        { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fork/dombi' } }]) {
        await assert.rejects(select(fixture(overrides).args));
    }
    for (const artifacts of [[], [{ ...artifact, expired: true }], [artifact, artifact]]) {
        await assert.rejects(select(fixture({}, artifacts).args));
    }
    const { args } = fixture();
    args.accepted = { release_sha: sha, artifact_id: '3', artifact_run_id: '1' };
    await assert.rejects(select(args), /differs/);
});
