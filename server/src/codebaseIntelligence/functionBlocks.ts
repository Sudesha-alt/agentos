export interface FunctionBlock {
  id: string;
  name: string;
  kind: "function" | "method" | "arrow" | "class";
  startLine: number;
  endLine: number;
  lineCount: number;
  summary?: string;
}

const FUNCTION_PATTERNS = [
  /^(export\s+)?async\s+function\s+(\w+)/,
  /^(export\s+)?function\s+(\w+)/,
  /^(export\s+)?const\s+(\w+)\s*=\s*async\s*\(/,
  /^(export\s+)?const\s+(\w+)\s*=\s*\(/,
  /^\s+async\s+(\w+)\s*\(/,
  /^\s+(\w+)\s*\([^)]*\)\s*\{/,
  /^(export\s+)?class\s+(\w+)/,
];

export function extractFunctionBlocks(
  content: string,
  filePath: string
): FunctionBlock[] {
  const lines = content.split("\n");
  const blocks: FunctionBlock[] = [];
  const isTs =
    filePath.endsWith(".ts") ||
    filePath.endsWith(".tsx") ||
    filePath.endsWith(".js") ||
    filePath.endsWith(".jsx");

  if (!isTs) {
    return [
      {
        id: "module",
        name: filePath.split("/").pop() ?? "module",
        kind: "function",
        startLine: 1,
        endLine: lines.length,
        lineCount: lines.length,
      },
    ];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    for (const pattern of FUNCTION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (!match) continue;

      const name = match[2] ?? match[1] ?? `anonymous_${i}`;
      const endLine = findBlockEnd(lines, i);
      blocks.push({
        id: `${name}-${i}`,
        name,
        kind: trimmed.includes("class ")
          ? "class"
          : trimmed.includes("=>") || trimmed.includes("= async")
            ? "arrow"
            : trimmed.startsWith(" ") || trimmed.startsWith("\t")
              ? "method"
              : "function",
        startLine: i + 1,
        endLine,
        lineCount: endLine - i,
      });
      break;
    }
  }

  if (blocks.length === 0 && lines.length > 0) {
    blocks.push({
      id: "file-body",
      name: "module scope",
      kind: "function",
      startLine: 1,
      endLine: lines.length,
      lineCount: lines.length,
    });
  }

  return blocks.slice(0, 80);
}

function findBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === "{") {
        depth += 1;
        started = true;
      } else if (char === "}") {
        depth -= 1;
      }
    }
    if (started && depth <= 0) return i + 1;
  }
  return Math.min(startIndex + 40, lines.length);
}

export function layoutFunctionBlocks(
  blocks: FunctionBlock[],
  width: number,
  height: number
): Array<FunctionBlock & { x: number; y: number; w: number; h: number }> {
  const total = blocks.reduce((sum, b) => sum + Math.max(b.lineCount, 1), 0) || 1;
  let y = 4;
  const padding = 4;

  return blocks.map((block) => {
    const h = Math.max(12, ((block.lineCount / total) * (height - padding * 2)));
    const laid = {
      ...block,
      x: padding,
      y,
      w: width - padding * 2,
      h,
    };
    y += h + 2;
    return laid;
  });
}
