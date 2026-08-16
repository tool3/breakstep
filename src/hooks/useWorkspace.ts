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
  /** The LeetCode problem currently in the editor, if the template is one. */
  problemSlug: string | null;

  selectTemplate: (id: string) => void;
  setLanguage: (language: Language) => void;
  setMode: (mode: EditorMode) => void;
  setCode: (code: string) => void;
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
  analyze: () => void;
  cancel: () => void;
}

export function useWorkspace(): Workspace {
  const engineRef = useRef<EngineHandle | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine();

  const [templateId, setTemplateId] = useLocalStorage<string>('templateId', DEFAULT_TEMPLATE_ID);
  const [language, setLanguageState] = useLocalStorage<Language>('language', 'typescript');
  const [mode, setModeState] = useLocalStorage<EditorMode>('editorMode', 'clean');

  const template = useMemo(() => {
    // A problem the last session left open only exists once it is registered
    // again, so restore it before anything asks for it.
    const problem = problemFor(templateId);
    if (problem) return registerTemplate(problemTemplate(problem));
    return getTemplate(templateId);
  }, [templateId]);
  const pristine = useMemo(
    () => templateSource(template, language, mode),
    [template, language, mode],
  );

  const [code, setCodeState] = useState<string>(() =>
    readStored(codeKey(templateId, language, mode), pristine),
  );
  const [params, setParams] = useState<ParamValues>(() => {
    const source = readStored(codeKey(templateId, language, mode), pristine);
    return readStored(paramsKey(templateId, mode), defaultParams(template, language, mode, source));
  });

  const [status, setStatus] = useState<RunStatus>('idle');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [detail, setDetail] = useState('');

  const [analysis, setAnalysis] = useState<ComplexityReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStale, setAnalysisStale] = useState(true);

  useEffect(() => () => engineRef.current?.dispose(), []);

  /** In clean mode the panel mirrors literals in the code; instrumented uses `breakstep.param`. */
  const bound = useMemo(
    () => (mode === 'clean' ? boundParams(code, template.params, language) : new Set(template.params.map((p) => p.name))),
    [mode, code, template.params, language],
  );

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
      const next = getTemplate(nextId);
      const fresh = templateSource(next, nextLanguage, nextMode);
      const source = readStored(codeKey(nextId, nextLanguage, nextMode), fresh);
      setCodeState(source);
      setParams(
        readStored(
          paramsKey(nextId, nextMode),
          defaultParams(next, nextLanguage, nextMode, source),
        ),
      );
      clearResults();
    },
    [clearResults],
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

  const setCode = useCallback(
    (next: string) => {
      setCodeState(next);
      writeStored(codeKey(templateId, language, mode), next);
      setAnalysisStale(true);

      // Editing a bound constant by hand must move the slider, not desync it.
      if (mode === 'clean') {
        setParams((prev) => {
          const fromSource = defaultParams(template, language, mode, next);
          const merged = { ...prev, ...fromSource };
          writeStored(paramsKey(templateId, mode), merged);
          return merged;
        });
      }
    },
    [templateId, language, mode, template],
  );

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
          setCodeState((prev) => {
            const { code: rewritten } = writeParamToSource(prev, spec, value, language);
            writeStored(codeKey(templateId, language, mode), rewritten);
            return rewritten;
          });
        }
      }

      setAnalysisStale(true);
    },
    [templateId, language, mode, template],
  );

  const resetParams = useCallback(() => {
    const fresh = templateSource(template, language, mode);
    const defaults = defaultParams(template, language, mode, fresh);
    setParams(defaults);
    writeStored(paramsKey(templateId, mode), defaults);

    if (mode === 'clean') {
      // Restore every bound literal without touching the rest of the file.
      setCodeState((prev) => {
        let next = prev;
        for (const spec of template.params) {
          next = writeParamToSource(next, spec, defaults[spec.name], language).code;
        }
        writeStored(codeKey(templateId, language, mode), next);
        return next;
      });
    }

    setAnalysisStale(true);
  }, [template, templateId, language, mode]);

  const resetCode = useCallback(() => {
    removeStored(codeKey(templateId, language, mode));
    setCodeState(pristine);
    setParams(defaultParams(template, language, mode, pristine));
    setAnalysisStale(true);
  }, [templateId, language, mode, pristine, template]);

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
      setCodeState(source);
      writeStored(key, source);
      setParams(readStored(paramsKey(next.id, mode), defaultParams(next, language, mode, source)));
      clearResults();
    },
    [language, mode, setTemplateId, clearResults],
  );

  /** What actually executes: the buffer, plus the harness when in clean mode. */
  const runnable = useCallback(
    () => assembleRunnable(template, language, mode, code),
    [template, language, mode, code],
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
    const visible = code.split('\n').length;
    return (res.steps ?? []).filter((step) => step.line <= visible);
  }, [execute, code]);

  const analyze = useCallback(() => {
    const engine = engineRef.current!;
    setAnalyzing(true);
    setDetail('');

    // The static pass is synchronous and instant; show it immediately so the
    // panel is never empty while the sweep runs.
    const staticReport = analyzeStatic(code, language);
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
  }, [code, runnable, language, params]);

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
    problemSlug: slugFromTemplateId(templateId),
    selectTemplate,
    setLanguage,
    setMode,
    setCode,
    setParam,
    resetParams,
    resetCode,
    run,
    debugRun,
    loadProblem,
    analyze,
    cancel,
  };
}
