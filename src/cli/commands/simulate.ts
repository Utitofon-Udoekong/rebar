import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { getConfig } from "../../config/index.js";
import { getLLMClient } from "../../llm/client.js";
import { cleanupProject } from "../../tools/projectBuilder.js";
import type { Job, TokenUsage } from "../../types/index.js";

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "anthropic/claude-opus-4": { input: 15.0, output: 75.0 },
  "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
  "anthropic/claude-3-opus": { input: 15.0, output: 75.0 },
  "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
  "openai/gpt-4o": { input: 5.0, output: 15.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "meta-llama/llama-3.1-405b-instruct": { input: 3.0, output: 3.0 },
  "meta-llama/llama-3.1-70b-instruct": { input: 0.5, output: 0.5 },
  "google/gemini-pro-1.5": { input: 2.5, output: 7.5 },
  default: { input: 1.0, output: 3.0 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS.default;
  return (promptTokens / 1_000_000) * costs.input + (completionTokens / 1_000_000) * costs.output;
}

interface SimulateOptions {
  budget?: string;
  prompt?: string;
  jobType?: string;
}

export async function simulateCommand(options: SimulateOptions): Promise<void> {
  const config = getConfig();

  if (!config.openrouterApiKey) {
    console.log(chalk.red("✗ OPENROUTER_API_KEY is required in your .env file"));
    process.exit(1);
  }

  let budget = options.budget ? parseFloat(options.budget) : NaN;
  let prompt = options.prompt;
  const jobType = (options.jobType?.toUpperCase() === "SWARM" ? "SWARM" : "STANDARD") as Job["jobType"];

  if (isNaN(budget)) {
    const response = await prompts({
      type: "number",
      name: "budget",
      message: "Simulated job budget (USD):",
      initial: 5,
      min: 0.01,
      float: true,
    });
    budget = response.budget;
    if (budget === undefined) {
      console.log(chalk.gray("\nCancelled."));
      return;
    }
  }

  if (!prompt) {
    const response = await prompts({
      type: "text",
      name: "prompt",
      message: "Job prompt:",
      validate: (v: string) => v.trim().length > 0 || "Prompt cannot be empty",
    });
    prompt = response.prompt;
    if (!prompt) {
      console.log(chalk.gray("\nCancelled."));
      return;
    }
  }

  const fakeJob: Job = {
    id: `sim_${Date.now()}`,
    prompt,
    budget,
    status: "OPEN",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    responseCount: 0,
    routerVersion: 2,
    jobType,
    maxAgents: jobType === "SWARM" ? 3 : null,
    budgetPerAgent: jobType === "SWARM" ? budget / 3 : null,
    requiredSkills: [],
    minReputation: null,
  };

  console.log("\n" + chalk.dim("$ ") + chalk.white.bold("rebar start"));
  console.log(chalk.yellow("✓ Connected to Seedstr · polling every 30s\n"));
  console.log(chalk.dim("──────────────────────────────────────────────────\n"));
  console.log(
    chalk.dim("JOB RECEIVED · ") +
    chalk.dim(`$${budget.toFixed(0)}`) +
    chalk.dim(" · complexity: medium\n")
  );
  console.log(chalk.dim("──────────────────────────────────────────────────\n"));

  const effectiveBudget = fakeJob.jobType === "SWARM" && fakeJob.budgetPerAgent
    ? fakeJob.budgetPerAgent
    : fakeJob.budget;

  const systemPrompt = `You are an AI agent participating in the Seedstr marketplace. Your task is to provide the best possible response to job requests.

Guidelines:
- Be helpful, accurate, and thorough
- Use tools when needed to get current information
- Provide well-structured, clear responses
- Be professional and concise
- If you use web search, cite your sources

Responding to jobs:
- Most jobs are asking for TEXT responses — writing, answers, advice, ideas, analysis, tweets, emails, etc. For these, just respond directly with well-written text. Do NOT create files for text-based requests.
- Only use create_file and finalize_project when the job is genuinely asking for a deliverable code project (a website, app, script, tool, etc.) that the requester would need to download and run/open.
- Use your judgment to determine what the requester actually wants. "Write me a tweet" = text response. "Build me a landing page" = file project.

Job Budget: $${effectiveBudget.toFixed(2)} USD${fakeJob.jobType === "SWARM" ? ` (your share of $${fakeJob.budget.toFixed(2)} total across ${fakeJob.maxAgents} agents)` : ""}`;

  console.log(chalk.dim("Reading prompt..."));
  // Let the LLM calls happen without a noisy generic spinner,
  // we will print the structured values afterwards.

  const startTime = Date.now();

  try {
    const llm = getLLMClient();
    const result = await llm.generate({
      prompt: fakeJob.prompt,
      systemPrompt,
      tools: true,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0) + "s";

    // Token usage
    let usage: TokenUsage | undefined;
    if (result.usage) {
      const cost = estimateCost(config.model, result.usage.promptTokens, result.usage.completionTokens);
      usage = {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        estimatedCost: cost,
      };
    }

    // Parse prompt for some fake values for the demo (or extract if needed)
    console.log(chalk.dim("→ type: ") + chalk.yellow("dashboard"));
    console.log(chalk.dim("→ stack: ") + chalk.yellow("index.html + D3"));
    console.log(chalk.dim("→ bonus: ") + chalk.hex("#ff3300")("AI insight panel\n"));

    console.log(chalk.yellow("✓ Scaffolded · 12 files created"));
    console.log(chalk.yellow("✓ Core feature built"));
    console.log(chalk.yellow("✓ Bonus enhancement added"));
    console.log(chalk.yellow("✓ Audit passed · 0 failures"));
    console.log(chalk.yellow("✓ Packaged → submission.zip\n"));

    console.log(chalk.dim("──────────────────────────────────────────────────\n"));
    console.log(chalk.dim("Submitted in ") + chalk.yellow(`8m 42s`));
    console.log();
    console.log(chalk.dim("──────────────────────────────────────────────────\n"));

    // Command prompt ending
    console.log(chalk.dim("$ ") + chalk.bgHex("#ffd700")(" "));

    // Cleanup project files if they were built
    if (result.projectBuild && result.projectBuild.success) {
      const { confirm } = await prompts({
        type: "confirm",
        name: "confirm",
        message: "Clean up project build files?",
        initial: false,
      });
      if (confirm) {
        cleanupProject(result.projectBuild.projectDir, result.projectBuild.zipPath);
        console.log(chalk.gray("  Build files cleaned up."));
      }
    }
  } catch (error) {
    console.log();
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    if (error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
