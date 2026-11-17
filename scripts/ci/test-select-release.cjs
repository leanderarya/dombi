const { test } = require('node:test');
const assert = require('node:assert/strict');
const select = require('./select-release.cjs');

const sha = '220a0190ec57c8ed64f5792dcaa10c7ca906f2b7';
const runId = 44032192481;
const artifactId = 14305937487;
const archiveSha256 = 'f48b68fb0678df3c752fe3ce600709bda7f706ccda0570e447d5fcda834598fd';
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
