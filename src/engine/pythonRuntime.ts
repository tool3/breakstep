
import { NO_BENCHMARK_MESSAGE } from './benchNotice';

export const PYTHON_BOOTSTRAP = String.raw`
# NOTE ON NAMING: every injected hook uses a SINGLE leading underscore.
# Python mangles any identifier written as \`__name\` inside a class body into
# \`_ClassName__name\`, so double-underscore hooks would resolve to nothing the
# moment a template defines a method — which every structure template does.
import ast, json, sys, builtins, time

class BreakstepOperationLimit(Exception):
    pass

class _Instrumenter(ast.NodeTransformer):
    """Insert _breakstep_op() at every loop iteration and function entry.

    When \`auto\` is set it also injects auto-trace hooks, so ordinary textbook
    code visualizes itself. The hooks are guarded by \`_breakstep_capturing and ...\`
    so that \`locals()\` - the snapshot - is never evaluated during a benchmark
    sweep, where capture is off. Python has no temporal dead zone, so unlike the
    JavaScript side no scope analysis is needed: \`locals()\` is exactly the set
    of bindings that currently exist.
    """

    def __init__(self, auto=False, debug=False):
        self.auto = auto
        self.debug = debug
        # Methods report as \`Class.method\`, matching the names the debug panel
        # lists, so a breakpoint switch cannot stop in the wrong class.
        self.method_owner = {}

    def visit_ClassDef(self, node):
        for statement in node.body:
            if isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)):
                self.method_owner[id(statement)] = node.name
        self.generic_visit(node)
        return node

    def _op(self):
        return ast.Expr(
            value=ast.Call(func=ast.Name(id="_breakstep_op", ctx=ast.Load()), args=[], keywords=[])
        )

    def _guarded(self, fn, args):
        call = ast.Call(func=ast.Name(id=fn, ctx=ast.Load()), args=args, keywords=[])
        return ast.Expr(
            value=ast.BoolOp(
                op=ast.And(),
                values=[ast.Name(id="_breakstep_capturing", ctx=ast.Load()), call],
            )
        )

    def _fn_label(self, node):
        owner = self.method_owner.get(id(node))
        return "%s.%s" % (owner, node.name) if owner else node.name

    def _scope(self):
        return ast.Call(func=ast.Name(id="locals", ctx=ast.Load()), args=[], keywords=[])

    def _with_op(self, node):
        self.generic_visit(node)
        node.body.insert(0, self._op())
        return node

    def _loop(self, node):
        self.generic_visit(node)
        if self.auto:
            node.body.insert(
                0,
                self._guarded("_breakstep_step", [ast.Constant(value=node.lineno), self._scope()]),
            )
        node.body.insert(0, self._op())
        return node

    def _function(self, node):
        self.generic_visit(node)
        if not self.auto:
            node.body.insert(0, self._op())
            return node

        # try: <body> finally: _breakstep_exit()
        guarded_exit = ast.Expr(
            value=ast.BoolOp(
                op=ast.And(),
                values=[
                    ast.Name(id="_breakstep_capturing", ctx=ast.Load()),
                    ast.Call(func=ast.Name(id="_breakstep_exit", ctx=ast.Load()), args=[], keywords=[]),
                ],
            )
        )
        wrapped = ast.Try(
            body=node.body,
            handlers=[],
            orelse=[],
            finalbody=[guarded_exit],
        )
        node.body = [
            self._op(),
            self._guarded(
                "_breakstep_enter",
                [
                    ast.Constant(value=self._fn_label(node)),
                    ast.Constant(value=node.lineno),
                    self._scope(),
                ],
            ),
            wrapped,
        ]
        return node

    visit_For = _loop
    visit_AsyncFor = _loop
    visit_While = _loop
    visit_FunctionDef = _function
    visit_AsyncFunctionDef = _function

    # -- statement-level hooks (debug runs only) --------------------------
    #
    # Python has no temporal dead zone, so \`locals()\` is always safe to read;
    # the only care needed is not to displace a docstring and not to walk into
    # class bodies, where the statements are definitions rather than steps.
    BODY_FIELDS = ("body", "orelse", "finalbody")

    def add_statement_hooks(self, tree):
        if not self.debug:
            return tree

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                continue

            for field in self.BODY_FIELDS:
                body = getattr(node, field, None)
                if not isinstance(body, list) or not body:
                    continue
                # A loop's own hook already fires at the top of its body.
                skip_first = field == "body" and isinstance(
                    node, (ast.For, ast.AsyncFor, ast.While)
                )
                setattr(node, field, self._interleave(body, skip_first))

        return tree

    def _interleave(self, body, skip_first):
        out = []
        for index, statement in enumerate(body):
            leading_docstring = (
                index == 0
                and isinstance(statement, ast.Expr)
                and isinstance(statement.value, ast.Constant)
                and isinstance(statement.value.value, str)
            )
            already_hooked = index == 0 and skip_first
            definition = isinstance(
                statement, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
            )
            # Hooks injected by the earlier pass carry no source position —
            # that is what marks them as ours rather than the user's.
            is_hook = getattr(statement, "lineno", None) is None

            if not (leading_docstring or already_hooked or definition or is_hook):
                out.append(
                    self._guarded(
                        "_breakstep_step",
                        [ast.Constant(value=statement.lineno), self._scope(),
                         ast.Constant(value="stmt")],
                    )
                )
            out.append(statement)
        return out

    def _wrap_elt(self, node, attr="elt"):
        self.generic_visit(node)
        original = getattr(node, attr)
        setattr(
            node,
            attr,
            ast.Call(func=ast.Name(id="_breakstep_ope", ctx=ast.Load()), args=[original], keywords=[]),
        )
        return node

    def visit_ListComp(self, node):
        return self._wrap_elt(node)

    def visit_SetComp(self, node):
        return self._wrap_elt(node)

    def visit_GeneratorExp(self, node):
        return self._wrap_elt(node)

    def visit_DictComp(self, node):
        return self._wrap_elt(node, "value")


class _Breakstep:
    def __init__(self):
        self.frames = []
        self.traces = []
        self.logs = []
        self.params = {}
        self.ops = 0
        self.op_limit = 20000000
        self.frame_limit = 2000
        self.step_limit = 20000
        self.capturing = True
        self._label = None
        self._bench = None
        self._started = time.perf_counter()

    # -- counters ---------------------------------------------------------
    def count(self):
        self.ops += 1
        if self.ops > self.op_limit:
            raise BreakstepOperationLimit("Operation limit exceeded - is there an infinite loop?")

    def count_expr(self, value):
        self.count()
        return value

    def reset_ops(self):
        self.ops = 0

    # -- user-facing API --------------------------------------------------
    def show(self, value, opts=None, **kwargs):
        """Capture a frame. \`opts\` may be a dict or a zero-arg callable.

        Building a highlight map often costs O(n) per frame, which would swamp
        the very algorithm being measured. Passing \`lambda: {...}\` defers that
        work so it never runs during a benchmark sweep, where capture is off.
        """
        if not self.capturing or len(self.frames) >= self.frame_limit:
            return
        if callable(opts):
            opts = opts() or {}
        opts = dict(opts or {})
        opts.update(kwargs)
        # \`as\` is a Python keyword, so accept \`kind=\` / \`as_=\` as aliases.
        for alias in ("kind", "as_"):
            if alias in opts:
                opts["as"] = opts.pop(alias)
        label = opts.pop("label", None) or self._label or ("Step " + str(len(self.frames) + 1))
        self._label = None
        self.frames.append(
            {
                "id": len(self.frames),
                "label": label,
                "payload": _encode(value),
                "options": _encode(opts),
            }
        )

    viz = show

    def log(self, *args, level="log"):
        if not self.capturing or len(self.logs) >= 5000:
            return
        text = " ".join(_display(a) for a in args)
        self.logs.append(
            {"level": level, "text": text, "at": int((time.perf_counter() - self._started) * 1000)}
        )

    def warn(self, *args):
        self.log(*args, level="warn")

    def error(self, *args):
        self.log(*args, level="error")

    def label(self, text):
        self._label = text

    def param(self, name, fallback=None):
        value = self.params.get(name, fallback)
        return fallback if value is None else value

    def bench(self, input=None, run=None, sizes=None, **kwargs):
        self._bench = {
            "input": input or kwargs.get("gen"),
            "run": run or kwargs.get("fn"),
            "sizes": sizes,
        }

    # -- auto-trace hooks -------------------------------------------------
    # These only record; the JavaScript side runs the same subject-selection
    # logic it uses for JS, so both languages produce identical pictures.
    def trace_step(self, line, scope, tag=None):
        # Statement steps feed only the debugger, so they get their own budget:
        # a debug run records far more of them than there are frames.
        limit = self.step_limit if tag == "stmt" else self.frame_limit
        if len(self.traces) >= limit:
            return
        self.traces.append(
            {"k": "step", "line": line, "tag": tag, "scope": _encode(_clean_scope(scope))}
        )

    def trace_enter(self, name, line, scope):
        if len(self.traces) >= self.frame_limit:
            return
        self.traces.append(
            {"k": "enter", "name": name, "line": line, "scope": _encode(_clean_scope(scope))}
        )

    def trace_exit(self):
        if len(self.traces) >= self.frame_limit:
            return
        self.traces.append({"k": "exit"})

    def random_ints(self, count, max=100, seed=42):
        s = seed & 0xFFFFFFFF
        out = []
        for _ in range(count):
            s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
            out.append(s % max)
        return out

    randomInts = random_ints


_SCOPE_SKIP = {"breakstep", "params", "print", "json", "sys", "ast", "time", "builtins", "math"}


def _clean_scope(scope):
    """Drop imports, callables and machinery so only the data remains."""
    import types as _types

    out = {}
    for key, value in list(scope.items())[:60]:
        if key.startswith("_") or key in _SCOPE_SKIP:
            continue
        if isinstance(value, (_types.ModuleType, _types.FunctionType, _types.BuiltinFunctionType)):
            continue
        if isinstance(value, type):
            continue
        out[key] = value
    return out


def _display(value, depth=0):
    if isinstance(value, str):
        return value if depth == 0 else repr(value)
    try:
        return repr(value) if depth else str(value)
    except Exception:
        return "<unprintable>"


_PRIMITIVES = (bool, int, float, str, type(None))


def _encode(obj, seen=None, depth=0):
    """Serialize to a JSON graph, replacing revisits with {"__ref__": n}."""
    if seen is None:
        seen = {}
    if isinstance(obj, _PRIMITIVES):
        if isinstance(obj, float) and (obj != obj or obj in (float("inf"), float("-inf"))):
            return str(obj)
        return obj
    if depth > 40:
        return "<max depth>"

    key = id(obj)
    if key in seen:
        return {"__ref__": seen[key]}
    index = len(seen)
    seen[key] = index

    if isinstance(obj, (list, tuple)):
        return {"__id__": index, "t": "list", "v": [_encode(x, seen, depth + 1) for x in obj[:500]]}
    if isinstance(obj, (set, frozenset)):
        items = list(obj)[:500]
        try:
            items.sort(key=lambda x: (str(type(x)), str(x)))
        except Exception:
            pass
        return {"__id__": index, "t": "set", "v": [_encode(x, seen, depth + 1) for x in items]}
    if isinstance(obj, dict):
        return {
            "__id__": index,
            "t": "map",
            "v": [
                [_encode(k, seen, depth + 1), _encode(v, seen, depth + 1)]
                for k, v in list(obj.items())[:500]
            ],
        }
    if callable(obj):
        return "<function " + getattr(obj, "__name__", "anonymous") + ">"

    fields = {}
    source = getattr(obj, "__dict__", None)
    if source is None and hasattr(obj, "__slots__"):
        source = {s: getattr(obj, s, None) for s in obj.__slots__}
    if source is None:
        return _display(obj)
    for k, v in list(source.items())[:200]:
        if k.startswith("__"):
            continue
        fields[k] = _encode(v, seen, depth + 1)
    return {
        "__id__": index,
        "t": "obj",
        "cls": type(obj).__name__,
        "v": fields,
    }


def _prepare(source, auto=False, debug=False):
    tree = ast.parse(source, filename="<breakstep>", mode="exec")
    instrumenter = _Instrumenter(auto=auto, debug=debug)
    tree = instrumenter.visit(tree)
    tree = instrumenter.add_statement_hooks(tree)
    ast.fix_missing_locations(tree)
    return compile(tree, "<breakstep>", "exec")


def _make_globals(breakstep, params):
    class _Console:
        @staticmethod
        def log(*a):
            breakstep.log(*a)

    g = {
        "__name__": "__breakstep__",
        "__builtins__": builtins,
        "breakstep": breakstep,
        "params": params,
        "_breakstep_op": breakstep.count,
        "_breakstep_ope": breakstep.count_expr,
        "_breakstep_step": breakstep.trace_step,
        "_breakstep_enter": breakstep.trace_enter,
        "_breakstep_exit": breakstep.trace_exit,
        "_breakstep_capturing": breakstep.capturing,
    }
    g["print"] = lambda *a, **kw: breakstep.log(*a)
    return g


_BREAKSTEP = _Breakstep()


def _breakstep_run(source, params, op_limit, frame_limit, auto_trace=False, debug=False):
    """Execute user code once. Returns a JSON string the worker relays."""
    breakstep = _Breakstep()
    breakstep.params = params or {}
    breakstep.op_limit = op_limit
    breakstep.frame_limit = frame_limit
    breakstep.step_limit = 20000 if debug else frame_limit
    global _BREAKSTEP
    _BREAKSTEP = breakstep

    g = _make_globals(breakstep, breakstep.params)
    started = time.perf_counter()
    error = None
    try:
        code = _prepare(source, auto=auto_trace, debug=debug)
    except SyntaxError as e:
        return json.dumps(
            {
                "error": {
                    "message": type(e).__name__ + ": " + str(e.msg),
                    "line": e.lineno,
                    "column": e.offset,
                },
                "logs": [],
                "frames": [],
                "traces": [],
                "durationMs": 0,
                "operations": 0,
                "hasBenchmark": False,
            }
        )

    try:
        exec(code, g)
    except BaseException as e:
        import traceback

        tb = e.__traceback__
        line = None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "<breakstep>":
                line = tb.tb_lineno
            tb = tb.tb_next
        error = {
            "message": type(e).__name__ + ": " + str(e),
            "stack": "".join(traceback.format_exception(type(e), e, e.__traceback__))[-4000:],
            "line": line,
        }

    duration = (time.perf_counter() - started) * 1000
    return json.dumps(
        {
            "error": error,
            "logs": breakstep.logs,
            "frames": breakstep.frames,
            "traces": breakstep.traces,
            "durationMs": duration,
            "operations": breakstep.ops,
            "hasBenchmark": breakstep._bench is not None,
        }
    )


def _breakstep_bench(source, params, sizes, op_limit):
    breakstep = _Breakstep()
    breakstep.params = params or {}
    breakstep.op_limit = op_limit
    breakstep.capturing = False
    g = _make_globals(breakstep, breakstep.params)

    try:
        exec(_prepare(source, auto=False, debug=False), g)
    except BaseException as e:
        return json.dumps({"samples": [], "error": type(e).__name__ + ": " + str(e)})

    spec = breakstep._bench
    if not spec or not spec.get("input") or not spec.get("run"):
        return json.dumps(
            {
                "samples": [],
                "error": ${JSON.stringify(NO_BENCHMARK_MESSAGE)},
            }
        )

    sweep = spec.get("sizes") or sizes
    samples = []
    stopped = None
    started = time.perf_counter()

    for n in sweep:
        try:
            data = spec["input"](n)
        except BaseException as e:
            stopped = "input(" + str(n) + ") raised " + type(e).__name__ + ": " + str(e)
            break
        breakstep.reset_ops()
        t0 = time.perf_counter()
        try:
            spec["run"](data)
        except BaseException as e:
            stopped = "stopped at n=" + str(n) + ": " + type(e).__name__ + ": " + str(e)
            break
        ms = (time.perf_counter() - t0) * 1000
        samples.append({"n": n, "operations": breakstep.ops, "ms": ms})
        if breakstep.ops > op_limit / 4:
            stopped = "stopped after n=" + str(n) + " - the next size would exceed the operation budget"
            break
        if time.perf_counter() - started > 20:
            stopped = "stopped after n=" + str(n) + " - benchmark time budget reached"
            break

    if len(samples) < 3:
        return json.dumps({"samples": samples, "error": stopped or "Not enough sizes completed to fit a curve."})
    return json.dumps({"samples": samples})
`;

type Encoded =
  | null
  | boolean
  | number
  | string
  | { __ref__: number }
  | { __id__: number; t: 'list' | 'set' | 'map' | 'obj'; v: unknown; cls?: string };

function isEncodedNode(v: unknown): v is Extract<Encoded, { __id__: number }> {
  return typeof v === 'object' && v !== null && '__id__' in (v as object);
}

function isRef(v: unknown): v is { __ref__: number } {
  return typeof v === 'object' && v !== null && '__ref__' in (v as object);
}

export function revivePython(encoded: unknown): unknown {
  const registry = new Map<number, unknown>();
  const fillQueue: (() => void)[] = [];

  const build = (node: unknown): unknown => {
    if (node === null || typeof node !== 'object') return node;
    if (isRef(node)) {
      const id = node.__ref__;
      return registry.has(id) ? registry.get(id) : { __pendingRef__: id };
    }
    if (!isEncodedNode(node)) return node;

    const { __id__: id, t, v } = node;

    if (t === 'list' || t === 'set') {
      const shell: unknown[] = [];
      registry.set(id, shell);
      fillQueue.push(() => {
        for (const item of (v as unknown[]) ?? []) shell.push(build(item));
      });
      return shell;
    }

    if (t === 'map') {
      const entries = (v as [unknown, unknown][]) ?? [];
      const allStringKeys = entries.every(([k]) => typeof k === 'string');
      if (allStringKeys) {
        const shell: Record<string, unknown> = {};
        registry.set(id, shell);
        fillQueue.push(() => {
          for (const [k, val] of entries) shell[String(k)] = build(val);
        });
        return shell;
      }
      const shell = new Map<unknown, unknown>();
      registry.set(id, shell);
      fillQueue.push(() => {
        for (const [k, val] of entries) shell.set(build(k), build(val));
      });
      return shell;
    }

    const shell: Record<string, unknown> = {};
    registry.set(id, shell);
    fillQueue.push(() => {
      for (const [k, val] of Object.entries((v as Record<string, unknown>) ?? {})) {
        shell[k] = build(val);
      }
    });
    return shell;
  };

  const root = build(encoded);

  while (fillQueue.length) fillQueue.shift()!();

  const seen = new Set<unknown>();
  const patch = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const pending = pendingId(value[i]);
        value[i] = pending !== null ? (registry.get(pending) ?? null) : patch(value[i]);
      }
    } else if (value instanceof Map) {
      for (const [k, val] of value) {
        const pending = pendingId(val);
        if (pending !== null) value.set(k, registry.get(pending) ?? null);
        else patch(val);
      }
    } else {
      const rec = value as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        const pending = pendingId(rec[k]);
        rec[k] = pending !== null ? (registry.get(pending) ?? null) : patch(rec[k]);
      }
    }
    return value;
  };

  return patch(root);
}

function pendingId(v: unknown): number | null {
  if (typeof v === 'object' && v !== null && '__pendingRef__' in (v as object)) {
    return (v as { __pendingRef__: number }).__pendingRef__;
  }
  return null;
}
