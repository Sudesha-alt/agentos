function renderInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      parts.push(
        <strong key={key++} className="font-semibold text-app-ink">
          {bold[1]}
        </strong>
      );
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    const code = remaining.match(/^`([^`]+)`/);
    if (code) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-app-surface-muted px-1 py-0.5 font-mono text-[11px] text-app-ink"
        >
          {code[1]}
        </code>
      );
      remaining = remaining.slice(code[0].length);
      continue;
    }

    const link = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      parts.push(
        <a
          key={key++}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo hover:underline"
        >
          {link[1]}
        </a>
      );
      remaining = remaining.slice(link[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/(\*\*|`|\[)/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    }
    if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
      continue;
    }

    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}

export default function MarkdownPreview({ content }) {
  if (!content?.trim()) {
    return <p className="text-sm text-app-ink-dim">No content to preview.</p>;
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={blockKey++}
          className="overflow-x-auto rounded-app-sm border border-app-border bg-app-surface-muted p-4 font-mono text-xs text-app-ink"
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#+\s*/, "");
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const className =
        level === 1
          ? "text-xl font-semibold text-app-ink"
          : level === 2
            ? "text-lg font-semibold text-app-ink"
            : "text-base font-semibold text-app-ink";
      blocks.push(
        <Tag key={blockKey++} className={className}>
          {renderInline(text)}
        </Tag>
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s*/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={blockKey++} className="list-disc space-y-1 pl-5 text-sm text-app-ink-dim">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s*/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={blockKey++} className="list-decimal space-y-1 pl-5 text-sm text-app-ink-dim">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !lines[i].startsWith("```")) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={blockKey++} className="text-sm leading-relaxed text-app-ink-dim">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}
