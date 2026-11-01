import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { ProjectPaths } from "../shared/index.ts";
export declare const contextIndexTemplate = "# Project context\n\nRead this shared index first, then open only the context files needed for the task. Coordinator and Workers maintain reusable project knowledge here. Workers contribute valuable reusable findings; the Coordinator primarily organizes, consolidates and prunes context. Keep each entry's path and short description current.\n\n## Context files\n";
export declare const contextIndexPath: (paths: ProjectPaths) => string;
/** Backfill only a missing index through the acting Agent's native filesystem. */
export declare function ensureContextIndex(ctx: Context, agent: Agent, project: {
    workspacePath: string;
    paths: ProjectPaths;
}, signal: AbortSignal): Promise<void>;
