/**
 * The single source of truth for the editor session.
 *
 * Holds the selected template, language, editor mode, edited code and
 * parameters, and owns the execution engine. Everything the panels render is
 * derived from here, so there is exactly one place where "what is currently
 * running" is decided.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createEngine, type EngineHandle } from '@/engine/runner';
import { analyzeStatic } from '@/analysis';
import { boundParams, writeParamToSource } from '@/engine/paramBinding';
import {
  DEFAULT_TEMPLATE_ID,
  assembleRunnable,
  defaultParams,
  getTemplate,
  registerTemplate,
  templateSource,
} from '@/templates';
import { getProblem } from '@/leetcode/catalogue';
import { loadDetail } from '@/leetcode/details';
import { buildJudgePlan, judgeResult, withoutJudgeLine } from '@/submissions/judge';
import { LOCAL_OWNER, SUBMISSION_SCHEMA } from '@/submissions/store';
import type { SubmissionDraft } from '@/submissions/types';
import {
  problemTemplate,
  slugFromTemplateId,
  solutionSource,
  starterSource,
} from '@/leetcode/toTemplate';
import type { LeetProblem } from '@/leetcode/types';
import { readStored, useLocalStorage, writeStored, removeStored } from './useLocalStorage';
import type { DebugStep } from '@/types/debug';
import type {
  ComplexityReport,
  EditorMode,
  Frame,
  Language,
  LogEntry,
  ParamValues,
  RunResult,
  RunStatus,
  Template,
} from '@/types';

/**
 * How long after the last keystroke the rest of the app hears about the buffer,
 * and the longest it may be deferred while someone types without pausing.
 */
const PUBLISH_IDLE_MS = 200;
const PUBLISH_MAX_MS = 1200;

/** Storage key for a problem assembled from LeetCode's published metadata. */
const generatedKey = (slug: string) => `generated:${slug}`;

/**
 * The problem behind a problem template id, if there is one.
 *
 * Problems written out here are found by slug. A generated one only exists
 * because someone opened it, so it is kept in storage — otherwise reloading the
 * page would drop you back to the default template.
 */
function problemFor(id: string): LeetProblem | undefined {
  const slug = slugFromTemplateId(id);
  if (!slug) return undefined;
  return getProblem(slug) ?? readStored<LeetProblem | undefined>(generatedKey(slug), undefined);
}

/** Edits are kept per template, language *and* mode, so nothing is ever lost. */
const codeKey = (templateId: string, language: Language, mode: EditorMode) =>
  `code:${templateId}:${language}:${mode}`;
const paramsKey = (templateId: string, mode: EditorMode) => `params:${templateId}:${mode}`;

export interface Workspace {
  templateId: string;
  language: Language;
  mode: EditorMode;
  code: string;
  params: ParamValues;
  /**
   * Parameters whose constant is still present in the source. A renamed or
   * deleted binding disables its control rather than silently doing nothing.
   */
  boundParams: Set<string>;

  status: RunStatus;
  /** Frames captured so far — updated live while the run is in flight. */
  frames: Frame[];
  logs: LogEntry[];
  result: RunResult | null;
  /** Runtime boot messages, e.g. Pyodide download progress. */
  detail: string;

  analysis: ComplexityReport | null;
  analyzing: boolean;
  /** True once the code has changed since the last analysis. */
  analysisStale: boolean;

  isDirty: boolean;
  template: Template;
  /**
   * Whether this template actually has a `breakstep.*` variant to reveal.
   *
   * A LeetCode problem does not: it is plain code with an auto-traced run, and
   * the two sources are identical. Offering the toggle anyway gave you a button
   * that changed the badge and nothing else.
   */
  hasInstrumented: boolean;
  /** The LeetCode problem currently in the editor, if the template is one. */
  problemSlug: string | null;
  /** That problem in full, for the panel that shows it beside the code. */
  problem: LeetProblem | null;

  selectTemplate: (id: string) => void;
  setLanguage: (language: Language) => void;
  setMode: (mode: EditorMode) => void;
  setCode: (code: string) => void;
  /**
   * Bumped when the app replaces the buffer, never when the user types. The
   * editor applies `code` when this changes and ignores it otherwise, which is
   * what keeps a keystroke from making a round trip through React.
   */
  docVersion: number;
  /** Force the pending publish through — before reading `code` for anything. */
  flushCode: () => void;
  /**
   * The buffer as it is this instant, for the callers that cannot wait for a
   * re-render — anything reading it inside a click handler that has just
   * flushed, where the closure still holds the pre-flush value.
   */
  currentCode: () => string;
  setParam: (name: string, value: unknown) => void;
  resetParams: () => void;
  resetCode: () => void;
  run: () => void;
  /**
   * Run with recording on. Resolves with the steps that belong to the user's
   * own code — harness lines are dropped, since stepping into the driver the
   * app appended would only be confusing.
   */
  debugRun: () => Promise<DebugStep[]>;
  /** Open a LeetCode problem — the starter by default, or the worked solution. */
  loadProblem: (problem: LeetProblem, variant?: 'starter' | 'solution') => void;
  /**
   * Put a specific buffer back in the editor — the code from a past submission.
   *
   * Takes the language with it, because an attempt written in Python is not
   * something to drop into the TypeScript slot.
   */
  restoreCode: (code: string, language?: Language) => void;
  /**
   * Judge the current buffer against the problem's published examples.
   *
   * Resolves with a record ready to store, or null when there is no problem
   * open. The run itself is untraced: nothing is drawn, so the time reported is
   * the algorithm's rather than the visualizer's.
   */
  submit: () => Promise<SubmissionDraft | null>;
  /** True while a submission is being judged. */
  judging: boolean;
  analyze: () => void;
  cancel: () => void;
}

export function useWorkspace(): Workspace {
  const engineRef = useRef<EngineHandle | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine();

  const [templateId, setTemplateId] = useLocalStorage<string>('templateId', DEFAULT_TEMPLATE_ID);
  const [language, setLanguageState] = useLocalStorage<Language>('language', 'typescript');
  const [mode, setModeState] = useLocalStorage<EditorMode>('editorMode', 'clean');

  /** The problem behind the current template, if it is one. */
  const problem = useMemo(() => problemFor(templateId) ?? null, [templateId]);

  const template = useMemo(() => {
    // A problem the last session left open only exists once it is registered
    // again, so restore it before anything asks for it.
    if (problem) return registerTemplate(problemTemplate(problem));
    return getTemplate(templateId);
  }, [templateId, problem]);
  const pristine = useMemo(
    () => templateSource(template, language, mode),
    [template, language, mode],
  );

  const hasInstrumented = useMemo(
    () =>
      templateSource(template, language, 'instrumented') !==
      templateSource(template, language, 'clean'),
    [template, language],
  );

  /**
   * The published buffer: what the rest of the app sees.
   *
   * Deliberately *not* what the editor holds. Monaco owns the text, and this
   * catches up when typing pauses — see `setCode` below for why.
   */
  const [code, setCodeState] = useState<string>(() =>
    readStored(codeKey(templateId, language, mode), pristine),
  );
  /** The buffer as it is this instant. The only thing a keystroke touches. */
  const liveCode = useRef(code);
  /**
   * Bumped when the *app* replaces the buffer — a template switch, a revealed
   * solution, a slider rewriting a literal — and never when the user types. The
   * editor watches this rather than the text, so its own edits never round-trip
   * back through React.
   */
  const [docVersion, setDocVersion] = useState(0);
  const [params, setParams] = useState<ParamValues>(() => {
    const source = readStored(codeKey(templateId, language, mode), pristine);
    return readStored(paramsKey(templateId, mode), defaultParams(template, language, mode, source));
  });

  const [status, setStatus] = useState<RunStatus>('idle');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [detail, setDetail] = useState('');

  const [judging, setJudging] = useState(false);
  const [analysis, setAnalysis] = useState<ComplexityReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStale, setAnalysisStale] = useState(true);

  useEffect(() => () => engineRef.current?.dispose(), []);

  /** In clean mode the panel mirrors literals in the code; instrumented uses `breakstep.param`. */
  const bound = useMemo(
    () => (mode === 'clean' ? boundParams(code, template.params, language) : new Set(template.params.map((p) => p.name))),
    [mode, code, template.params, language],
  );

  /**
   * Publishing the buffer.
   *
   * Everything downstream of the text is expensive: persisting it, re-reading
   * the bound literals out of it, and — through the panels — type-stripping and
   * parsing it to find the entry function. Doing that per keystroke cost 35ms of
   * synchronous work inside the input handler and put keystroke-to-paint at
   * 48ms, which is exactly what "laggy" feels like. None of it is needed until
   * you stop typing, so none of it happens until you do.
   */
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the current burst of typing began, for the max-wait below. */
  const burstStart = useRef(0);

  /** Held in a ref so the timer always runs against the current slot. */
  const publish = useRef<() => void>(() => {});
  publish.current = () => {
    publishTimer.current = null;
    burstStart.current = 0;

    const next = liveCode.current;
    setCodeState(next);
    writeStored(codeKey(templateId, language, mode), next);
    setAnalysisStale(true);

    // Editing a bound constant by hand must move the slider, not desync it.
    if (mode === 'clean') {
      setParams((prev) => {
        const merged = { ...prev, ...defaultParams(template, language, mode, next) };
        writeStored(paramsKey(templateId, mode), merged);
        return merged;
      });
    }
  };

  const currentCode = useCallback(() => liveCode.current, []);

  const flushCode = useCallback(() => {
    if (!publishTimer.current) return;
    clearTimeout(publishTimer.current);
    publish.current();
  }, []);

  /**
   * Nothing is lost to the debounce: a hidden tab, a closing page or an
   * unmounting workspace all force the pending publish through first.
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushCode();
    };
    window.addEventListener('pagehide', flushCode);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushCode);
      document.removeEventListener('visibilitychange', onHide);
      flushCode();
    };
  }, [flushCode]);

  /**
   * Drop the pending publish and put a new buffer in place at once — for the
   * app's own writes, which must be visible everywhere immediately.
   */
  const replaceCode = useCallback((next: string) => {
    if (publishTimer.current) {
      clearTimeout(publishTimer.current);
      publishTimer.current = null;
    }
    burstStart.current = 0;
    liveCode.current = next;
    setCodeState(next);
    setDocVersion((version) => version + 1);
  }, []);

  const clearResults = useCallback(() => {
    setFrames([]);
    setLogs([]);
    setResult(null);
    setAnalysis(null);
    setAnalysisStale(true);
    setStatus('idle');
    setDetail('');
  }, []);

  /** Load the stored (or pristine) source whenever the slot changes. */
  const loadSlot = useCallback(
    (nextId: string, nextLanguage: Language, nextMode: EditorMode) => {
      // Whatever the debounce is still holding belongs to the slot being left,
      // so it goes to storage before the slot changes underneath it.
      flushCode();
      const next = getTemplate(nextId);
      const fresh = templateSource(next, nextLanguage, nextMode);
      const source = readStored(codeKey(nextId, nextLanguage, nextMode), fresh);
      replaceCode(source);
      setParams(
        readStored(
          paramsKey(nextId, nextMode),
          defaultParams(next, nextLanguage, nextMode, source),
        ),
      );
      clearResults();
    },
    [clearResults, replaceCode, flushCode],
  );

  const selectTemplate = useCallback(
    (id: string) => {
      setTemplateId(id);
      loadSlot(id, language, mode);
    },
    [language, mode, loadSlot, setTemplateId],
  );

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      loadSlot(templateId, next, mode);
    },
    [templateId, mode, loadSlot, setLanguageState],
  );

  const setMode = useCallback(
    (next: EditorMode) => {
      setModeState(next);
      loadSlot(templateId, language, next);
    },
    [templateId, language, loadSlot, setModeState],
  );

  /**
   * A keystroke. One assignment and one timer — no state, no storage, no
   * parsing, so React does not re-render and the frame belongs to Monaco.
   *
   * The publish is idle-debounced, with a ceiling so that typing without ever
   * pausing still persists roughly once a second.
   */
  const setCode = useCallback((next: string) => {
    liveCode.current = next;

    const now = Date.now();
    if (!burstStart.current) burstStart.current = now;
    if (publishTimer.current) clearTimeout(publishTimer.current);

    const wait = Math.min(PUBLISH_IDLE_MS, Math.max(0, burstStart.current + PUBLISH_MAX_MS - now));
    publishTimer.current = setTimeout(() => publish.current(), wait);
  }, []);

  /**
   * Changing a parameter rewrites the literal it binds to, so the code on
   * screen is always exactly the code that runs.
   */
  const setParam = useCallback(
    (name: string, value: unknown) => {
      setParams((prev) => {
        const next = { ...prev, [name]: value };
        writeStored(paramsKey(templateId, mode), next);
        return next;
      });

      if (mode === 'clean') {
        const spec = template.params.find((p) => p.name === name);
        if (spec) {
          // Rewritten from the live buffer, not the published one: the slider
          // has to act on the text as it is on screen this instant.
          const { code: rewritten } = writeParamToSource(liveCode.current, spec, value, language);
          writeStored(codeKey(templateId, language, mode), rewritten);
          replaceCode(rewritten);
        }
      }

      setAnalysisStale(true);
    },
    [templateId, language, mode, template, replaceCode],
  );

  const resetParams = useCallback(() => {
    const fresh = templateSource(template, language, mode);
    const defaults = defaultParams(template, language, mode, fresh);
    setParams(defaults);
    writeStored(paramsKey(templateId, mode), defaults);

    if (mode === 'clean') {
      // Restore every bound literal without touching the rest of the file.
      let next = liveCode.current;
      for (const spec of template.params) {
        next = writeParamToSource(next, spec, defaults[spec.name], language).code;
      }
      writeStored(codeKey(templateId, language, mode), next);
      replaceCode(next);
    }

    setAnalysisStale(true);
  }, [template, templateId, language, mode, replaceCode]);

  const resetCode = useCallback(() => {
    removeStored(codeKey(templateId, language, mode));
    replaceCode(pristine);
    setParams(defaultParams(template, language, mode, pristine));
    setAnalysisStale(true);
  }, [templateId, language, mode, pristine, template, replaceCode]);

  /**
   * Load a problem into the editor.
   *
   * `starter` respects any earlier attempt that is still stored, so coming back
   * to a problem picks up where you left off. `solution` always overwrites —
   * that is the whole point of the Reveal button — and the previous buffer is
   * still one undo away in Monaco, with Reset code as the way back to the stub.
   */
  const loadProblem = useCallback(
    (problem: LeetProblem, variant: 'starter' | 'solution' = 'starter') => {
      flushCode();
      // A generated problem has to survive a reload; a written one is already
      // in the catalogue and needs nothing stored.
      if (problem.origin === 'generated') writeStored(generatedKey(problem.slug), problem);

      const next = registerTemplate(problemTemplate(problem));
      const key = codeKey(next.id, language, mode);

      const fresh =
        variant === 'solution'
          ? solutionSource(problem, language)
          : starterSource(problem, language);
      const source = variant === 'solution' ? fresh : readStored(key, fresh);

      setTemplateId(next.id);
      replaceCode(source);
      writeStored(key, source);
      setParams(readStored(paramsKey(next.id, mode), defaultParams(next, language, mode, source)));
      clearResults();
    },
    [language, mode, setTemplateId, clearResults, replaceCode, flushCode],
  );

  const restoreCode = useCallback(
    (next: string, nextLanguage?: Language) => {
      flushCode();
      const target = nextLanguage ?? language;
      setLanguageState(target);
      replaceCode(next);
      writeStored(codeKey(templateId, target, mode), next);
      setParams(
        readStored(paramsKey(templateId, mode), defaultParams(template, target, mode, next)),
      );
      setAnalysisStale(true);
    },
    [templateId, language, mode, template, setLanguageState, replaceCode, flushCode],
  );

  /** What actually executes: the buffer, plus the harness when in clean mode. */
  /**
   * What actually executes. Reads the live buffer rather than the published
   * one, so pressing Run mid-keystroke runs what is on screen — the debounce is
   * invisible to correctness, only to React.
   */
  const runnable = useCallback(
    () => assembleRunnable(template, language, mode, liveCode.current),
    [template, language, mode],
  );

  const execute = useCallback(
    (debug: boolean) => {
      const engine = engineRef.current!;
      setStatus(language === 'python' ? 'preparing' : 'running');
      setFrames([]);
      setLogs([]);
      setResult(null);
      setDetail('');

      return engine
        .run({
          code: runnable(),
          language,
          params,
          debug,
          onProgress: (update) => {
            if (update.frames) setFrames(update.frames);
            if (update.logs) setLogs(update.logs);
            if (update.detail) {
              setDetail(update.detail);
              setStatus('running');
            }
          },
        })
        .then((res) => {
          setResult(res);
          setFrames(res.frames);
          setLogs(res.logs);
          setStatus(res.status === 'done' ? 'done' : res.status);
          setDetail('');
          return res;
        });
    },
    [runnable, language, params],
  );

  const run = useCallback(() => {
    void execute(false);
  }, [execute]);

  const debugRun = useCallback(async () => {
    const res = await execute(true);
    // Everything past the last line the user can see belongs to the harness.
    const visible = liveCode.current.split('\n').length;
    return (res.steps ?? []).filter((step) => step.line <= visible);
  }, [execute]);

  /**
   * Run the buffer against the problem's published cases and report the verdict.
   *
   * Deliberately not a Run: the judge harness is appended, auto-tracing is off,
   * and the frames on screen are left alone, so submitting never disturbs the
   * picture you were reading. The log is shown as usual, minus the one line the
   * harness reports its answers on.
   */
  const submit = useCallback(async (): Promise<SubmissionDraft | null> => {
    // Guarded here rather than only on the button: the keyboard route reaches
    // this directly, and two judged runs at once would race over the panel.
    if (!problem || judging) return null;

    const engine = engineRef.current!;
    setJudging(true);
    setStatus(language === 'python' ? 'preparing' : 'running');
    setLogs([]);
    setResult(null);
    setDetail('');

    // A missing shard is a normal outcome, not a failure: the plan falls back
    // to comparing printed output, or says there is nothing to judge.
    const problemDetail = await loadDetail(problem.slug, problem.number).catch(() => null);
    const source_ = liveCode.current;
    const plan = buildJudgePlan(problem, problemDetail, language, source_);
    const base = assembleRunnable(template, language, mode, source_);
    const source = plan.kind === 'cases' ? `${base}\n\n${plan.harness}` : base;

    const res = await engine.run({
      code: source,
      language,
      params,
      autoTrace: false,
      onProgress: (update) => {
        if (update.logs) setLogs(withoutJudgeLine(update.logs));
        if (update.detail) {
          setDetail(update.detail);
          setStatus('running');
        }
      },
    });

    const visible = withoutJudgeLine(res.logs);
    setResult({ ...res, logs: visible });
    setLogs(visible);
    setStatus(res.status === 'done' ? 'done' : res.status);
    setDetail('');
    setJudging(false);

    const judgement = judgeResult(plan, res);
    const staticReport = analyzeStatic(source_, language);
    const measured = !analysisStale ? analysis?.empirical : undefined;

    return {
      schema: SUBMISSION_SCHEMA,
      owner: LOCAL_OWNER,
      problemSlug: problem.slug,
      problemNumber: problem.number,
      problemTitle: problem.title,
      difficulty: problem.difficulty,
      language,
      submittedAt: new Date().toISOString(),
      verdict: judgement.verdict,
      entry: judgement.entry,
      passed: judgement.passed,
      total: judgement.total,
      cases: judgement.cases,
      runtimeMs: judgement.runtimeMs,
      totalMs: res.durationMs,
      operations: res.operations,
      complexity: {
        time: staticReport.time,
        space: staticReport.space,
        confidence: staticReport.confidence,
      },
      empirical:
        measured && measured.best !== 'unknown'
          ? { time: measured.best, confidence: measured.confidence }
          : undefined,
      code: source_,
      error: judgement.error,
      note: judgement.note,
    };
  }, [problem, judging, template, language, mode, params, analysis, analysisStale]);

  const analyze = useCallback(() => {
    const engine = engineRef.current!;
    setAnalyzing(true);
    setDetail('');

    // The static pass is synchronous and instant; show it immediately so the
    // panel is never empty while the sweep runs.
    const staticReport = analyzeStatic(liveCode.current, language);
    setAnalysis({ static: staticReport });

    engine
      .bench({
        code: runnable(),
        language,
        params,
        onProgress: (update) => {
          if (update.detail) setDetail(update.detail);
        },
      })
      .then((empirical) => {
        setAnalysis({ static: staticReport, empirical });
        setAnalyzing(false);
        setAnalysisStale(false);
        setDetail('');
      });
  }, [runnable, language, params]);

  const cancel = useCallback(() => {
    engineRef.current?.cancel();
    setStatus('cancelled');
    setAnalyzing(false);
    setDetail('');
  }, []);

  return {
    templateId,
    language,
    mode,
    code,
    params,
    boundParams: bound,
    status,
    frames,
    logs,
    result,
    detail,
    analysis,
    analyzing,
    analysisStale,
    isDirty: code !== pristine,
    template,
    hasInstrumented,
    problemSlug: slugFromTemplateId(templateId),
    problem,
    selectTemplate,
    setLanguage,
    setMode,
    setCode,
    docVersion,
    flushCode,
    currentCode,
    setParam,
    resetParams,
    resetCode,
    run,
    debugRun,
    loadProblem,
    restoreCode,
    submit,
    judging,
    analyze,
    cancel,
  };
}
