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

const PUBLISH_IDLE_MS = 200;
const PUBLISH_MAX_MS = 1200;

const generatedKey = (slug: string) => `generated:${slug}`;

function problemFor(id: string): LeetProblem | undefined {
  const slug = slugFromTemplateId(id);
  if (!slug) return undefined;
  return getProblem(slug) ?? readStored<LeetProblem | undefined>(generatedKey(slug), undefined);
}

const codeKey = (templateId: string, language: Language, mode: EditorMode) =>
  `code:${templateId}:${language}:${mode}`;
const paramsKey = (templateId: string, mode: EditorMode) => `params:${templateId}:${mode}`;

export interface Workspace {
  templateId: string;
  language: Language;
  mode: EditorMode;
  code: string;
  params: ParamValues;
  boundParams: Set<string>;

  status: RunStatus;
  frames: Frame[];
  logs: LogEntry[];
  result: RunResult | null;
  detail: string;

  analysis: ComplexityReport | null;
  analyzing: boolean;
  analysisStale: boolean;

  isDirty: boolean;
  template: Template;
  hasInstrumented: boolean;
  problemSlug: string | null;
  problem: LeetProblem | null;

  selectTemplate: (id: string) => void;
  setLanguage: (language: Language) => void;
  setMode: (mode: EditorMode) => void;
  setCode: (code: string) => void;
  docVersion: number;
  flushCode: () => void;
  currentCode: () => string;
  setParam: (name: string, value: unknown) => void;
  resetParams: () => void;
  resetCode: () => void;
  run: () => void;
  debugRun: () => Promise<DebugStep[]>;
  loadProblem: (problem: LeetProblem, variant?: 'starter' | 'solution') => void;
  restoreCode: (code: string, language?: Language) => void;
  submit: () => Promise<SubmissionDraft | null>;
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

  const problem = useMemo(() => problemFor(templateId) ?? null, [templateId]);

  const template = useMemo(() => {
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

  const [code, setCodeState] = useState<string>(() =>
    readStored(codeKey(templateId, language, mode), pristine),
  );
  const liveCode = useRef(code);
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

  const bound = useMemo(
    () => (mode === 'clean' ? boundParams(code, template.params, language) : new Set(template.params.map((p) => p.name))),
    [mode, code, template.params, language],
  );

  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstStart = useRef(0);

  const publish = useRef<() => void>(() => {});
  publish.current = () => {
    publishTimer.current = null;
    burstStart.current = 0;

    const next = liveCode.current;
    setCodeState(next);
    writeStored(codeKey(templateId, language, mode), next);
    setAnalysisStale(true);

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

  const loadSlot = useCallback(
    (nextId: string, nextLanguage: Language, nextMode: EditorMode) => {
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

  const setCode = useCallback((next: string) => {
    liveCode.current = next;

    const now = Date.now();
    if (!burstStart.current) burstStart.current = now;
    if (publishTimer.current) clearTimeout(publishTimer.current);

    const wait = Math.min(PUBLISH_IDLE_MS, Math.max(0, burstStart.current + PUBLISH_MAX_MS - now));
    publishTimer.current = setTimeout(() => publish.current(), wait);
  }, []);

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

  const loadProblem = useCallback(
    (problem: LeetProblem, variant: 'starter' | 'solution' = 'starter') => {
      flushCode();
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
    const visible = liveCode.current.split('\n').length;
    return (res.steps ?? []).filter((step) => step.line <= visible);
  }, [execute]);

  const submit = useCallback(async (): Promise<SubmissionDraft | null> => {
    if (!problem || judging) return null;

    const engine = engineRef.current!;
    setJudging(true);
    setStatus(language === 'python' ? 'preparing' : 'running');
    setLogs([]);
    setResult(null);
    setDetail('');

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
