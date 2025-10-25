interface IssueLike {
  path?: unknown;
  message?: unknown;
}

interface IssueContainer {
  issues?: unknown;
  details?: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export interface NormalizedZodIssue {
  path: (string | number)[];
  message: string;
}

const extractIssueArrays = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (isObject(value)) {
    const issues = (value as IssueContainer).issues;
    if (Array.isArray(issues)) {
      return issues;
    }

    const nested = (value as IssueContainer).details;
    if (nested) {
      return extractIssueArrays(nested);
    }
  }

  return [];
};

export const normalizeZodIssues = (details: unknown): NormalizedZodIssue[] => {
  const sources = extractIssueArrays(details);

  return sources.reduce<NormalizedZodIssue[]>((acc, issue) => {
    if (!isObject(issue)) {
      return acc;
    }

    const rawPath = Array.isArray((issue as IssueLike).path)
      ? ((issue as IssueLike).path as unknown[])
      : [];
    const path = rawPath.filter((segment): segment is string | number => {
      return typeof segment === "string" || typeof segment === "number";
    });

    const message = (issue as IssueLike).message;
    if (typeof message !== "string" || message.trim().length === 0) {
      return acc;
    }

    acc.push({ path, message });
    return acc;
  }, []);
};

