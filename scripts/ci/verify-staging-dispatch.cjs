const fs = require('node:fs');

const expected = {
    repository: 'leanderarya/dombi',
    actor: 'leanderarya',
    ref: 'refs/heads/develop',
    workflowRefs: {
        deploy: 'leanderarya/dombi/.github/workflows/deploy-staging.yml@refs/heads/develop',
        rollback: 'leanderarya/dombi/.github/workflows/rollback-staging.yml@refs/heads/develop',
    },
};

function verifyDispatch(actual) {
    if (actual.eventName !== 'workflow_dispatch' ||
        actual.repository !== expected.repository ||
        actual.actor !== expected.actor ||
        actual.ref !== expected.ref ||
        !expected.workflowRefs[actual.workflowKind] ||
        actual.workflowRef !== expected.workflowRefs[actual.workflowKind] ||
        actual.runAttempt !== '1' ||
        !/^[a-f0-9]{40}$/.test(actual.sha) ||
        actual.workflowSha !== actual.sha) {
        throw new Error('Staging dispatch is not the owner-run approved develop workflow revision');
    }
    return { workflowSha: actual.workflowSha };
}

module.exports = verifyDispatch;

if (require.main === module) {
    try {
        const result = verifyDispatch({
            eventName: process.env.STAGING_EVENT_NAME,
            workflowKind: process.env.STAGING_WORKFLOW_KIND,
            repository: process.env.STAGING_REPOSITORY,
            actor: process.env.STAGING_ACTOR,
            ref: process.env.STAGING_REF,
            workflowRef: process.env.STAGING_WORKFLOW_REF,
            runAttempt: process.env.STAGING_RUN_ATTEMPT,
            sha: process.env.STAGING_SOURCE_SHA,
            workflowSha: process.env.STAGING_WORKFLOW_SHA,
        });
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `workflow_sha=${result.workflowSha}\n`);
        console.log('STAGING_DISPATCH_IDENTITY_PASS');
    } catch {
        console.error('STAGING_DISPATCH_IDENTITY_FAIL');
        process.exitCode = 1;
    }
}
