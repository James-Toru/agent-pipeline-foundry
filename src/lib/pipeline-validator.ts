import { type PipelineSpec, PipelineSpecSchema } from "@/types/pipeline";

export type ValidationResult =
  | { valid: true; spec: PipelineSpec }
  | { valid: false; errors: string[] };

export function validatePipelineSpec(raw: unknown): ValidationResult {
  const result = PipelineSpecSchema.safeParse(raw);

  if (result.success) {
    return { valid: true, spec: result.data as PipelineSpec };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { valid: false, errors };
}
