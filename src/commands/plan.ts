import { Planner } from "../services/planner";
import type { PlanOptions } from "../types";

export async function planCommand(options: PlanOptions): Promise<void> {
  const planner = new Planner({ verbose: options.verbose });
  await planner.run(options);
}
