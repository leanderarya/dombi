module.exports = async ({ github, context, core, runId, attempt }) => {
    if (!/^[1-9]\d*$/.test(String(runId)) || !/^[1-9]\d*$/.test(String(attempt)) ||
        !Number.isSafeInteger(Number(runId)) || !Number.isSafeInteger(Number(attempt))) {
        throw new Error('Positive staging run ID and attempt are required');
    }
    const repo = context.repo;
    if (`${repo.owner}/${repo.repo}` !== 'leanderarya/dombi') {
        throw new Error('Rollback selection is restricted to the approved repository');
    }
    const { data: run } = await github.rest.actions.getWorkflowRun({
        ...repo, run_id: Number(runId),
    });
    const workflowPath = '.github/workflows/deploy-staging.yml';
    const pathMatches = run.path === workflowPath ||
        run.path === `${workflowPath}@refs/heads/develop`;
    if (run.id !== Number(runId) || run.run_attempt !== Number(attempt) ||
        !pathMatches ||
        run.event !== 'workflow_dispatch' || run.head_branch !== 'develop' ||
        run.head_repository.full_name !== `${repo.owner}/${repo.repo}` ||
        run.actor?.login !== 'leanderarya' ||
        !/^[a-f0-9]{40}$/.test(run.head_sha) ||
        !['failure', 'cancelled', 'timed_out'].includes(run.conclusion)) {
        throw new Error('Rollback requires the exact failed or interrupted owner staging dispatch');
    }
    core.setOutput('transfer_id', `${run.id}-${run.run_attempt}`);
    core.setOutput('workflow_sha', run.head_sha);
};
