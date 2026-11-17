const { test } = require('node:test');
const assert = require('node:assert/strict');
const select = require('./select-release.cjs');

const sha = 'dbfe218de8cc3ae49796524007e214ec8dfe464a';
const runId = 43720516972;
const artifactId = 14164321503;
const archiveSha256 = '16f7aa17486f7264da7e8d25110eb5dad8358ff1e42c2352f91e6ba329ed8f8b';
const run = { id: runId, path: '.github/workflows/tests.yml@refs/heads/develop', event: 'push', head_branch: 'develop',
    conclusion: 'success', head_sha: sha, head_repository: { full_name: 'leanderarya/dombi' } };
const artifact = { id: artifactId, name: `release-${sha}`, expired: false,
    workflow_run: { id: runId, head_sha: sha } };
function fixture(runOverrides = {}, artifacts = [artifact], selectedRunId = String(runId),
    originOverrides = {}) {
    const outputs = {};
    let lookupCount = 0;
    return { outputs, args: {
        github: { rest: { actions: {
            getWorkflowRun: async () => ({ data: {
                ...run, ...(lookupCount++ === 0 ? runOverrides : originOverrides),
            } }),
            listArtifactsForRepo: () => {},
        } }, paginate: async () => artifacts },
            context: { repo: { owner: 'leanderarya', repo: 'dombi' } },
        core: { setOutput: (key, value) => { outputs[key] = value; } }, runId: selectedRunId,
    } };
}
test('select exact trusted artifact', async () => {
    const { args, outputs } = fixture();
    await select(args);
    assert.deepEqual(outputs, {
        sha, artifact_id: String(artifactId), artifact_run_id: String(runId), archive_sha256: archiveSha256,
    });
});
test('reject untrusted CI, alternate run/artifact, and missing or expired artifact', async () => {
    for (const overrides of [{ event: 'pull_request' }, { head_branch: 'main' }, { conclusion: 'failure' },
        { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fork/dombi' } },
        { head_sha: 'a'.repeat(40) }, { id: 7 }]) {
        await assert.rejects(select(fixture(overrides).args));
    }
    for (const artifacts of [[], [{ ...artifact, expired: true }],
        [{ ...artifact, id: artifactId + 1 }], [{ ...artifact, workflow_run: { id: runId + 1, head_sha: sha } }],
        [artifact, artifact]]) {
        await assert.rejects(select(fixture({}, artifacts).args));
    }
    await assert.rejects(select(fixture({}, [artifact], String(runId + 1)).args), /approved/);
    await assert.rejects(select(fixture({}, [artifact], String(runId), { head_sha: 'a'.repeat(40) }).args));
    const wrongRepository = fixture().args;
    wrongRepository.context.repo.owner = 'fork';
    await assert.rejects(select(wrongRepository));
});
