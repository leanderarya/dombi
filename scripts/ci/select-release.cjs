const expected = {
    repository: 'leanderarya/dombi',
    sha: 'dbfe218de8cc3ae49796524007e214ec8dfe464a',
    ciRunId: '43720516972',
    artifactId: '14164321503',
    archiveSha256: '16f7aa17486f7264da7e8d25110eb5dad8358ff1e42c2352f91e6ba329ed8f8b',
};

const isWorkflowPath = (path, expectedPath) =>
    path === expectedPath || path === `${expectedPath}@refs/heads/develop`;

module.exports = async ({ github, context, core, runId }) => {
    if (String(runId) !== expected.ciRunId) throw new Error('Only the approved Quality Gate run is accepted');
    const repo = context.repo;
    if (`${repo.owner}/${repo.repo}` !== expected.repository) {
        throw new Error('Release selection is restricted to the approved repository');
    }
    const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: Number(expected.ciRunId) });
    if (!isWorkflowPath(run.path, '.github/workflows/tests.yml') || run.event !== 'push' ||
        run.head_branch !== 'develop' || run.conclusion !== 'success' ||
        run.head_repository.full_name !== `${repo.owner}/${repo.repo}` ||
        run.id !== Number(expected.ciRunId) || run.head_sha !== expected.sha) {
        throw new Error('Release requires the exact approved successful develop Quality Gate');
    }
    const artifacts = await github.paginate(github.rest.actions.listArtifactsForRepo,
        { ...repo, name: `release-${expected.sha}`, per_page: 100 });
    const available = artifacts.filter(a => !a.expired &&
        a.id === Number(expected.artifactId) &&
        a.name === `release-${expected.sha}` &&
        a.workflow_run?.id === Number(expected.ciRunId) &&
        a.workflow_run?.head_sha === expected.sha);
    if (available.length !== 1) throw new Error('Exactly one unexpired release required');
    const artifact = available[0];
    const { data: origin } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: artifact.workflow_run.id });
    if (!isWorkflowPath(origin.path, '.github/workflows/tests.yml') || origin.event !== 'push' ||
        origin.head_branch !== 'develop' || origin.conclusion !== 'success' ||
        origin.head_repository.full_name !== `${repo.owner}/${repo.repo}` ||
        origin.id !== Number(expected.ciRunId) || origin.head_sha !== expected.sha) {
        throw new Error('Artifact origin is not trusted successful CI');
    }
    core.setOutput('sha', expected.sha);
    core.setOutput('artifact_id', String(artifact.id));
    core.setOutput('artifact_run_id', String(origin.id));
    core.setOutput('archive_sha256', expected.archiveSha256);
};
