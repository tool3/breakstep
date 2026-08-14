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
  templateSource,
} from '@/templates';
import { readStored, useLocalStorage, writeStored, removeStored } from './useLocalStorage';
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

  selectTemplate: (id: string) => void;
  setLanguage: (language: Language) => void;
  setMode: (mode: EditorMode) => void;
  setCode: (code: string) => void;
  setParam: (name: string, value: unknown) => void;
  resetParams: () => void;
  resetCode: () => void;
  run: () => void;
  analyze: () => void;
  cancel: () => void;
}

export function useWorkspace(): Workspace {
  const engineRef = useRef<EngineHandle | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine();

  const [templateId, setTemplateId] = useLocalStorage<string>('templateId', DEFAULT_TEMPLATE_ID);
  const [language, setLanguageState] = useLocalStorage<Language>('language', 'typescript');
  const [mode, setModeState] = useLocalStorage<EditorMode>('editorMode', 'clean');

  const template = useMemo(() => getTemplate(templateId), [templateId]);
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

  /** What actually executes: the buffer, plus the harness when in clean mode. */
  const runnable = useCallback(
    () => assembleRunnable(template, language, mode, code),
    [template, language, mode, code],
  );

  const run = useCallback(() => {
    const engine = engineRef.current!;
    setStatus(language === 'python' ? 'preparing' : 'running');
    setFrames([]);
    setLogs([]);
    setResult(null);
    setDetail('');

    engine
      .run({
        code: runnable(),
        language,
        params,
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
      });
  }, [runnable, language, params]);

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
    selectTemplate,
    setLanguage,
    setMode,
    setCode,
    setParam,
    resetParams,
    resetCode,
    run,
    analyze,
    cancel,
  };
}
