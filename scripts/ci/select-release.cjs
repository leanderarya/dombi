module.exports = async ({ github, context, core, runId, accepted }) => {
    if (!/^\d+$/.test(String(runId))) throw new Error('Numeric CI run ID required');
    const repo = context.repo;
    const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: Number(runId) });
    if (run.path !== '.github/workflows/tests.yml' || run.event !== 'push' ||
        run.head_branch !== 'develop' || run.conclusion !== 'success' ||
        run.head_repository.full_name !== `${repo.owner}/${repo.repo}` ||
        !/^[a-f0-9]{40}$/.test(run.head_sha)) {
        throw new Error('Release requires successful same-repository develop push CI');
    }
    const artifacts = await github.paginate(github.rest.actions.listArtifactsForRepo,
        { ...repo, name: `release-${run.head_sha}`, per_page: 100 });
    const available = artifacts.filter(a => !a.expired && a.workflow_run?.head_sha === run.head_sha);
    if (available.length !== 1) throw new Error('Exactly one unexpired release required');
    const artifact = available[0];
    const { data: origin } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: artifact.workflow_run.id });
    if (origin.path !== '.github/workflows/tests.yml' || origin.event !== 'push' ||
        origin.head_branch !== 'develop' || origin.conclusion !== 'success' ||
        origin.head_repository.full_name !== `${repo.owner}/${repo.repo}`) {
        throw new Error('Artifact origin is not trusted successful CI');
    }
    if (accepted && (accepted.release_sha !== run.head_sha ||
        accepted.artifact_id !== String(artifact.id) ||
        accepted.artifact_run_id !== String(origin.id))) {
        throw new Error('Artifact differs from staging acceptance');
    }
    core.setOutput('sha', run.head_sha);
    core.setOutput('artifact_id', String(artifact.id));
    core.setOutput('artifact_run_id', String(origin.id));
};
