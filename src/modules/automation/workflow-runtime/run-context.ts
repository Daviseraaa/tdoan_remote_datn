import {
  buildRunScope,
  mergeScopes,
  type WorkflowRunScope,
} from '../workflow-variables';

export type StepContext = {
  exitCode: number | null;
  failed: boolean;
  scope: WorkflowRunScope;
};

export function mergeStepContexts(ctxs: StepContext[]): StepContext {
  if (!ctxs.length) {
    return {
      exitCode: 0,
      failed: false,
      scope: buildRunScope({}),
    };
  }
  const failed = ctxs.some((c) => c.failed);
  const withExit = ctxs.filter(
    (c) => c.exitCode !== null && c.exitCode !== undefined,
  );
  const lastExit = withExit.length
    ? withExit[withExit.length - 1]!.exitCode
    : undefined;
  const exitCode = failed
    ? ctxs.find((c) => c.failed)?.exitCode ?? lastExit ?? -1
    : lastExit ?? 0;
  const mergedScope = mergeScopes(ctxs.map((c) => c.scope));
  return { failed, exitCode, scope: mergedScope };
}

export function emptyCtx(runVars: Record<string, unknown>): StepContext {
  return {
    exitCode: 0,
    failed: false,
    scope: buildRunScope(runVars),
  };
}
