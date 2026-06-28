type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

function stripComment(s: string): string {
  const i = s.indexOf('#');
  return i >= 0 ? s.slice(0, i) : s;
}

function indentOf(s: string): number {
  return s.length - s.trimStart().length;
}

function peekLine(lines: string[], i: number): string | null {
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed !== '' && trimmed[0] !== '#') return lines[i];
    i++;
  }
  return null;
}

export function parse(yamlStr: string): YamlValue {
  const lines = yamlStr.split('\n');
  const [val, _next] = readValue(lines, 0, 0);
  return val;
}

function readValue(lines: string[], i: number, baseIndent: number): [YamlValue, number] {
  let line = peekLine(lines, i);
  if (!line) return [null, lines.length];

  const indent = indentOf(line);
  if (indent < baseIndent) return [null, i];

  const trimmed = stripComment(line.trim());

  if (trimmed.startsWith('- ')) {
    return readSequence(lines, i, indent);
  }

  const kvMatch = trimmed.match(/^(\S[\w_]*):\s*(.*)/);
  if (kvMatch) {
    return readMapping(lines, i, indent);
  }

  const arrMatch = trimmed.match(/^(\[.*\])\s*$/);
  if (arrMatch) {
    return [parseInlineArray(arrMatch[1]), i + 1];
  }

  return [parseScalar(trimmed), i + 1];
}

function readMapping(
  lines: string[],
  start: number,
  baseIndent: number,
): [Record<string, YamlValue>, number] {
  const map: Record<string, YamlValue> = {};
  let i = start;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = stripComment(raw.trim());
    if (trimmed === '' || trimmed[0] === '#') {
      i++;
      continue;
    }

    const indent = indentOf(raw);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      i++;
      continue;
    }

    if (trimmed.startsWith('- ')) break;

    const m = trimmed.match(/^(\S[\w_]*):\s*(.*)/);
    if (!m) break;

    const key = m[1];
    const valStr = m[2];

    if (valStr === '') {
      const next = peekLine(lines, i + 1);
      if (next && indentOf(next) > indent) {
        const [val, nextI] = readValue(lines, i + 1, indent + 2);
        map[key] = val;
        i = nextI;
        continue;
      }
      map[key] = null;
      i++;
    } else if (valStr.startsWith('[') && valStr.endsWith(']')) {
      map[key] = parseInlineArray(valStr);
      i++;
    } else {
      map[key] = parseScalar(valStr);
      i++;
    }
  }

  return [map, i];
}

function readSequence(lines: string[], start: number, baseIndent: number): [YamlValue[], number] {
  const items: YamlValue[] = [];
  let i = start;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = stripComment(raw.trim());
    if (trimmed === '' || trimmed[0] === '#') {
      i++;
      continue;
    }

    const indent = indentOf(raw);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      i++;
      continue;
    }

    const seqMatch = trimmed.match(/^-\s*(.*)/);
    if (!seqMatch) break;

    const rest = seqMatch[1];
    const contentIndent = indent + 2;

    if (rest === '') {
      const next = peekLine(lines, i + 1);
      if (next && indentOf(next) > indent) {
        const [val, nextI] = readValue(lines, i + 1, contentIndent);
        items.push(val);
        i = nextI;
        continue;
      }
      items.push(null);
      i++;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      items.push(parseInlineArray(rest));
      i++;
    } else if (rest.match(/^["'].*["']$/)) {
      items.push(parseScalar(rest));
      i++;
    } else {
      const kvMatch = rest.match(/^(\S[\w_]*):\s*(.*)/);
      if (kvMatch) {
        const initialMap: Record<string, YamlValue> = { [kvMatch[1]]: parseScalar(kvMatch[2]) };
        const [moreMap, nextI] = readMapping(lines, i + 1, contentIndent);
        const merged = { ...initialMap, ...moreMap };
        items.push(merged);
        i = nextI;
      } else {
        items.push(parseScalar(rest));
        i++;
      }
    }
  }

  return [items, i];
}

function parseInlineArray(s: string): YamlValue[] {
  const inner = s.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((x) => parseScalar(x.trim()));
}

function parseScalar(s: string): YamlValue {
  s = s.trim();
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  const q1 = s.match(/^'(.*)'$/);
  if (q1) return q1[1];
  const q2 = s.match(/^"(.*)"$/);
  if (q2) return q2[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  const num = Number(s);
  if (!Number.isNaN(num) && s !== '') return num;
  return s;
}
