/**
 * Turn a problem's published interface into code you can run.
 *
 * LeetCode publishes, separately from the statement, the shape of the function
 * a problem wants — its name, parameter names and types, and return type — and
 * the example inputs. Put those together with the expected answers and you can
 * generate the whole scaffold: a correctly typed stub, the datasets as literals,
 * and a driver that runs each example. Nothing here reproduces their prose; it
 * is all built from the interface and the data.
 */
import type { ProblemDetail } from './details';

export interface GeneratedSource {
  typescript: string;
  python: string;
}

/** LeetCode's type names → TypeScript. */
const TS_TYPES: Record<string, string> = {
  integer: 'number',
  double: 'number',
  long: 'number',
  string: 'string',
  boolean: 'boolean',
  character: 'string',
  void: 'void',
  ListNode: 'ListNode | null',
  TreeNode: 'TreeNode | null',
};

/** The same, for the Python annotations in the docstring. */
const PY_TYPES: Record<string, string> = {
  integer: 'int',
  double: 'float',
  long: 'int',
  string: 'str',
  boolean: 'bool',
  character: 'str',
  void: 'None',
  ListNode: 'ListNode',
  TreeNode: 'TreeNode',
};

/**
 * `list<integer>` and `integer[]` mean the same thing; normalise to the latter.
 *
 * Nesting has to be unwrapped from the outside in, keeping any `[]` already on
 * the end — `list<list<integer>>` is `integer[][]`, not `list<integer>[]`.
 */
function normalizeType(type: string): string {
  let out = type.trim();
  for (;;) {
    const match = out.match(/^list<([\s\S]+)>((?:\[\])*)$/);
    if (!match) break;
    out = `${match[1]}[]${match[2]}`;
  }
  return out;
}

function baseOf(type: string): { base: string; depth: number } {
  const normalized = normalizeType(type);
  const depth = (normalized.match(/\[\]/g) ?? []).length;
  return { base: normalized.replace(/\[\]/g, '').trim(), depth };
}

function tsType(type: string): string | null {
  const { base, depth } = baseOf(type);
  const mapped = TS_TYPES[base];
  if (!mapped) return null;
  // A node type inside an array is not something this generates helpers for.
  if (depth > 0 && (base === 'ListNode' || base === 'TreeNode')) return null;
  return mapped + '[]'.repeat(depth);
}

function pyType(type: string): string | null {
  const { base, depth } = baseOf(type);
  const mapped = PY_TYPES[base];
  if (!mapped) return null;
  if (depth > 0 && (base === 'ListNode' || base === 'TreeNode')) return null;

  let out = mapped;
  for (let i = 0; i < depth; i++) out = `list[${out}]`;
  return out;
}

/** What a stub should return so the file runs before anything is written. */
function tsPlaceholder(type: string): string {
  const { base, depth } = baseOf(type);
  if (depth > 0) return '[]';
  if (base === 'ListNode' || base === 'TreeNode') return 'null';
  if (base === 'boolean') return 'false';
  if (base === 'string' || base === 'character') return "''";
  if (base === 'void') return '';
  return '0';
}

function pyPlaceholder(type: string): string {
  const { base, depth } = baseOf(type);
  if (depth > 0) return '[]';
  if (base === 'ListNode' || base === 'TreeNode') return 'None';
  if (base === 'boolean') return 'False';
  if (base === 'string' || base === 'character') return "''";
  if (base === 'void') return 'None';
  return '0';
}

/** `twoSum` → `two_sum`, the way the same problem is written in Python. */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Rewrite a JSON-ish literal for Python.
 *
 * The values are JSON, so only the three keywords differ — and they must not be
 * touched inside a string, which is why this walks the text rather than
 * replacing globally.
 */
export function toPythonLiteral(literal: string): string {
  let out = '';
  let inString = false;
  let i = 0;

  while (i < literal.length) {
    const ch = literal[i];

    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < literal.length) {
        out += literal[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }

    if (literal.startsWith('true', i)) {
      out += 'True';
      i += 4;
      continue;
    }
    if (literal.startsWith('false', i)) {
      out += 'False';
      i += 5;
      continue;
    }
    if (literal.startsWith('null', i)) {
      out += 'None';
      i += 4;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/** Can a runnable file be built for this problem at all? */
export function canGenerate(detail: ProblemDetail): boolean {
  // Nothing to print, so nothing to check an example against.
  if (normalizeType(detail.returns) === 'void') return false;
  if (detail.cases.length === 0) return false;
  if (detail.params.length === 0) return false;
  if (!tsType(detail.returns)) return false;
  return detail.params.every(([, type]) => tsType(type) !== null);
}

/** Which node helpers the generated file needs. */
function neededHelpers(detail: ProblemDetail): { list: boolean; tree: boolean } {
  const types = [...detail.params.map(([, t]) => t), detail.returns];
  return {
    list: types.some((t) => baseOf(t).base === 'ListNode'),
    tree: types.some((t) => baseOf(t).base === 'TreeNode'),
  };
}

const TS_LIST_HELPERS = `class ListNode {
  val: number;
  next: ListNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

/** Build a linked list from an array, and read one back out. */
function toList(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    const node = new ListNode(values[i]);
    node.next = head;
    head = node;
  }
  return head;
}

function fromList(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head; node !== null; node = node.next) out.push(node.val);
  return out;
}
`;

const TS_TREE_HELPERS = `class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) {
    this.val = val;
  }
}

/** Build a tree from LeetCode's level-order array, and read one back out. */
function toTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;

  const root = new TreeNode(values[0]);
  const queue: TreeNode[] = [root];
  let i = 1;

  while (i < values.length) {
    const node = queue.shift()!;
    if (i < values.length && values[i] !== null) {
      node.left = new TreeNode(values[i] as number);
      queue.push(node.left);
    }
    i++;
    if (i < values.length && values[i] !== null) {
      node.right = new TreeNode(values[i] as number);
      queue.push(node.right);
    }
    i++;
  }

  return root;
}

function fromTree(root: TreeNode | null): (number | null)[] {
  if (root === null) return [];

  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === null) {
      out.push(null);
      continue;
    }
    out.push(node.val);
    queue.push(node.left, node.right);
  }

  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}
`;

const PY_LIST_HELPERS = `class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None


def to_list(values):
    """Build a linked list from a list of values."""
    head = None
    for value in reversed(values):
        node = ListNode(value)
        node.next = head
        head = node
    return head


def from_list(head):
    out = []
    node = head
    while node is not None:
        out.append(node.val)
        node = node.next
    return out
`;

const PY_TREE_HELPERS = `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def to_tree(values):
    """Build a tree from LeetCode's level-order array."""
    if not values or values[0] is None:
        return None

    root = TreeNode(values[0])
    queue = [root]
    i = 1

    while i < len(values):
        node = queue.pop(0)
        if i < len(values) and values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1

    return root


def from_tree(root):
    if root is None:
        return []

    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)

    while out and out[-1] is None:
        out.pop()
    return out
`;

/** Wrap an example input so it arrives as the type the signature asks for. */
function wrapInput(literal: string, type: string, python: boolean): string {
  const { base } = baseOf(type);
  const value = python ? toPythonLiteral(literal) : literal;

  if (base === 'ListNode') return python ? `to_list(${value})` : `toList(${value})`;
  if (base === 'TreeNode') return python ? `to_tree(${value})` : `toTree(${value})`;
  return value;
}

/** Read the answer back out, when it is a node rather than a value. */
function unwrapCall(call: string, type: string, python: boolean): string {
  const { base } = baseOf(type);
  if (base === 'ListNode') return python ? `from_list(${call})` : `fromList(${call})`;
  if (base === 'TreeNode') return python ? `from_tree(${call})` : `fromTree(${call})`;
  return call;
}

export interface GenerateOptions {
  detail: ProblemDetail;
  number: number;
  title: string;
  difficulty: string;
  /** Where the statement lives, since Breakstep does not reproduce it. */
  url: string;
}

/**
 * The whole file: a header, the helpers it needs, a typed stub, and a driver
 * that runs every published example with the expected answer beside it.
 */
export function generateStarter({
  detail,
  number,
  title,
  difficulty,
  url,
}: GenerateOptions): GeneratedSource {
  const helpers = neededHelpers(detail);
  const pyFn = toSnakeCase(detail.fn);

  const tsHeader =
    `// PROBLEM ${number} · ${title}  (${difficulty})\n` +
    `//\n` +
    `// The statement is LeetCode's, so it is not reproduced here:\n` +
    `//   ${url}\n` +
    `//\n` +
    `// What is here is everything you need to run it — the published example\n` +
    `// inputs, the answers they expect, and a stub with the right signature.\n\n`;

  const pyHeader =
    `# PROBLEM ${number} · ${title}  (${difficulty})\n` +
    `#\n` +
    `# The statement is LeetCode's, so it is not reproduced here:\n` +
    `#   ${url}\n` +
    `#\n` +
    `# What is here is everything you need to run it - the published example\n` +
    `# inputs, the answers they expect, and a stub with the right signature.\n\n`;

  const tsSignature = detail.params
    .map(([name, type]) => `${name}: ${tsType(type)}`)
    .join(', ');
  const tsStub =
    `function ${detail.fn}(${tsSignature}): ${tsType(detail.returns)} {\n` +
    `  // TODO\n` +
    `  return ${tsPlaceholder(detail.returns)};\n` +
    `}\n`;

  const pyArgs = detail.params.map(([name]) => toSnakeCase(name)).join(', ');
  const pyDoc = detail.params
    .map(([name, type]) => `${toSnakeCase(name)}: ${pyType(type)}`)
    .join(', ');
  const pyStub =
    `def ${pyFn}(${pyArgs}):\n` +
    `    """${pyDoc} -> ${pyType(detail.returns)}"""\n` +
    `    # TODO\n` +
    `    return ${pyPlaceholder(detail.returns)}\n`;

  const tsCases = detail.cases
    .map((testCase, i) => {
      const args = testCase.input
        .map((literal, index) => wrapInput(literal, detail.params[index][1], false))
        .join(', ');
      const call = unwrapCall(`${detail.fn}(${args})`, detail.returns, false);
      return `console.log('example ${i + 1} ->', ${call});  // expected ${testCase.expected}`;
    })
    .join('\n');

  const pyCases = detail.cases
    .map((testCase, i) => {
      const args = testCase.input
        .map((literal, index) => wrapInput(literal, detail.params[index][1], true))
        .join(', ');
      const call = unwrapCall(`${pyFn}(${args})`, detail.returns, true);
      return `print('example ${i + 1} ->', ${call})  # expected ${testCase.expected}`;
    })
    .join('\n');

  const tsHelpers = [helpers.list ? TS_LIST_HELPERS : '', helpers.tree ? TS_TREE_HELPERS : '']
    .filter(Boolean)
    .join('\n');
  const pyHelpers = [helpers.list ? PY_LIST_HELPERS : '', helpers.tree ? PY_TREE_HELPERS : '']
    .filter(Boolean)
    .join('\n');

  return {
    typescript:
      tsHeader +
      (tsHelpers ? `${tsHelpers}\n` : '') +
      tsStub +
      `\n// --- examples ---------------------------------------------------------------\n` +
      `${tsCases}\n`,
    python:
      pyHeader +
      (pyHelpers ? `${pyHelpers}\n` : '') +
      pyStub +
      `\n# --- examples ---------------------------------------------------------------\n` +
      `${pyCases}\n`,
  };
}
