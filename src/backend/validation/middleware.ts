import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

type ValidationTarget = "body" | "query" | "params";

function parseZodErrors(error: ZodError): { field: string; message: string }[] {
  try {
    const parsed = JSON.parse(error.message) as any[];
    return parsed.map((e: any) => ({
      field: (e.path || []).join("."),
      message: e.message || "قيمة مش صحيحة",
    }));
  } catch {
    return [{ field: "", message: error.message || "البيانات مش صحيحة" }];
  }
}

export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = parseZodErrors(result.error);
      return res.status(400).json({
        success: false,
        message: "البيانات اللي دخلتها مش صحيحة",
        errors,
      });
    }
    req[target] = result.data;
    next();
  };
}
