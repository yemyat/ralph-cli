import { Builder } from "../services/builder";
import type { BuildOptions } from "../types";

export async function buildCommand(options: BuildOptions): Promise<void> {
  const builder = new Builder({ verbose: options.verbose });
  await builder.run(options);
}
