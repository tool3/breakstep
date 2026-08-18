import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisualizerPanel } from './VisualizerPanel';
import { OutputPanel } from './OutputPanel';
import { ParamsPanel, parseNumberArray, parseStringArray } from './ParamsPanel';
import { ComplexityPanel, prettyClass } from './ComplexityPanel';
import { TemplatePicker } from './TemplatePicker';
import { SplitPane } from './SplitPane';
import { Header, ModeBadge } from './Header';
import { normalize } from '@/engine/normalize';
import { NO_BENCHMARK } from '@/engine/benchNotice';
import { getTemplate } from '@/templates';
import type { Frame } from '@/types/viz';
import type { ComplexityReport, RunResult, Template } from '@/types';

const frames: Frame[] = [
  { id: 0, label: 'first step', view: normalize([1, 2, 3]), meta: { sum: 6 } },
  { id: 1, label: 'second step', view: normalize([1, 2, 3], { highlight: [0] }) },
  { id: 2, label: 'third step', view: normalize([3, 2, 1]) },
];

describe('VisualizerPanel', () => {
  it('invites a run when there is nothing to show', async () => {
    const onRun = vi.fn();
    render(<VisualizerPanel frames={[]} status="idle" onRun={onRun} />);

    expect(screen.getByText('Nothing to visualize yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run the code' }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('shows the first frame with its label, kind and metadata', () => {
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);
    expect(screen.getByText('first step')).toBeInTheDocument();
    expect(screen.getByText('Array')).toBeInTheDocument();
    expect(screen.getByText('sum')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('steps forward and backward through the timeline', async () => {
    const user = userEvent.setup();
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('second step')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('disables the back button on the first frame and forward on the last', async () => {
    const user = userEvent.setup();
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('restarts from the beginning', async () => {
    const user = userEvent.setup();
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    await user.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('advances with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('keys only the colours the run actually uses', () => {
    // These frames only ever mark the current position, which is all
    // auto-traced code can produce. Listing four colours under them described
    // something that could not happen.
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.queryByText('match / done')).not.toBeInTheDocument();
    expect(screen.queryByText('comparing')).not.toBeInTheDocument();
  });

  it('keys the rest as soon as a frame uses them', () => {
    const marked: Frame[] = [
      {
        id: 0,
        label: 'searching',
        view: normalize([1, 2, 3], { highlight: { 0: 'compare', 1: 'match', 2: 'visited' } }),
      },
    ];
    render(<VisualizerPanel frames={marked} status="done" onRun={vi.fn()} />);
    expect(screen.getByText('comparing')).toBeInTheDocument();
    expect(screen.getByText('match / done')).toBeInTheDocument();
    expect(screen.getByText('visited')).toBeInTheDocument();
    // And not the one nothing used.
    expect(screen.queryByText('current')).not.toBeInTheDocument();
  });

  it('says it is running while the worker is busy', () => {
    render(<VisualizerPanel frames={[]} status="running" onRun={vi.fn()} />);
    expect(screen.getByText('Running…')).toBeInTheDocument();
  });
});

describe('OutputPanel', () => {
  const logs = [
    { level: 'log' as const, text: 'hello', at: 1 },
    { level: 'warn' as const, text: 'careful', at: 2 },
    { level: 'error' as const, text: 'broken', at: 3 },
  ];

  it('renders every log line with its timestamp', () => {
    render(
      <OutputPanel logs={logs} result={null} status="done" detail="" onGoToLine={vi.fn()} />,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('careful')).toBeInTheDocument();
    expect(screen.getByText('1ms')).toBeInTheDocument();
  });

  it('filters by level', async () => {
    const user = userEvent.setup();
    render(
      <OutputPanel logs={logs} result={null} status="done" detail="" onGoToLine={vi.fn()} />,
    );
    await user.click(screen.getByText('Errors 1'));
    expect(screen.getByText('broken')).toBeInTheDocument();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('reports the run summary', () => {
    const result: RunResult = {
      status: 'done',
      logs: [],
      frames: [],
      durationMs: 12.5,
      operations: 4200,
    };
    render(<OutputPanel logs={[]} result={result} status="done" detail="" onGoToLine={vi.fn()} />);
    expect(screen.getByText('✓ finished')).toBeInTheDocument();
    expect(screen.getByText('12.5 ms')).toBeInTheDocument();
    expect(screen.getByText('4,200 ops')).toBeInTheDocument();
  });

  it('offers a jump to the failing line', async () => {
    const user = userEvent.setup();
    const onGoToLine = vi.fn();
    const result: RunResult = {
      status: 'error',
      logs: [],
      frames: [],
      durationMs: 1,
      error: { message: 'TypeError: nope', line: 7, column: 3 },
    };
    render(
      <OutputPanel logs={[]} result={result} status="error" detail="" onGoToLine={onGoToLine} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('TypeError: nope');
    await user.click(screen.getByRole('button', { name: 'line 7:3' }));
    expect(onGoToLine).toHaveBeenCalledWith(7);
  });

  it('surfaces runtime boot progress', () => {
    render(
      <OutputPanel
        logs={[]}
        result={null}
        status="running"
        detail="Downloading Python runtime…"
        onGoToLine={vi.fn()}
      />,
    );
    expect(screen.getByText('Downloading Python runtime…')).toBeInTheDocument();
  });
});

describe('ParamsPanel', () => {
  const template = getTemplate('two-pointers');

  it('renders a control per parameter', () => {
    render(
      <ParamsPanel
        template={template}
        values={{ nums: [1, 2], target: 3 }}
        mode="instrumented"
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText('Sorted array')).toBeInTheDocument();
    expect(screen.getByText('Target sum')).toBeInTheDocument();
  });

  it('parses a comma-separated number array', () => {
    const onChange = vi.fn();
    render(
      <ParamsPanel
        template={template}
        values={{ nums: [1], target: 3 }}
        mode="instrumented"
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    // The field is fully controlled, so drive it with one change event rather
    // than per-keystroke typing (which React would immediately revert).
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '4, 5, 6' } });
    expect(onChange).toHaveBeenCalledWith('nums', [4, 5, 6]);
  });

  it('resets to the template defaults', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <ParamsPanel
        template={template}
        values={{ nums: [1], target: 3 }}
        mode="instrumented"
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Reset/ }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders a select for enumerated parameters', () => {
    render(
      <ParamsPanel
        template={getTemplate('sorting')}
        values={{ size: 14, algorithm: 'merge' }}
        mode="instrumented"
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText('Merge sort — O(n log n)')).toBeInTheDocument();
  });

  it('says so when a template takes no parameters', () => {
    const bare = { ...template, params: [] } as Template;
    render(
      <ParamsPanel template={bare} values={{}} mode="clean" onChange={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getByText('This template takes no parameters.')).toBeInTheDocument();
  });
});

describe('parameter parsing', () => {
  it('accepts commas, spaces and mixed separators', () => {
    expect(parseNumberArray('1, 2  3,4')).toEqual([1, 2, 3, 4]);
  });

  it('drops values that are not numbers', () => {
    expect(parseNumberArray('1, x, 3')).toEqual([1, 3]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseNumberArray('  ')).toEqual([]);
    expect(parseStringArray('')).toEqual([]);
  });

  it('trims string entries', () => {
    expect(parseStringArray(' a , b ')).toEqual(['a', 'b']);
  });
});

describe('ComplexityPanel', () => {
  const template = getTemplate('two-pointers');

  const report: ComplexityReport = {
    static: {
      time: 'O(n)',
      space: 'O(1)',
      confidence: 0.7,
      notes: ['one loop over the input', 'Space: no growing allocations detected.'],
      maxLoopDepth: 1,
      recursion: { detected: false, functions: [] },
    },
    empirical: {
      samples: [
        { n: 16, operations: 32, ms: 0.1 },
        { n: 32, operations: 64, ms: 0.2 },
        { n: 64, operations: 128, ms: 0.4 },
        { n: 128, operations: 256, ms: 0.8 },
      ],
      ranking: [
        { cls: 'O(n)', r2: 1, coefficient: 2 },
        { cls: 'O(n log n)', r2: 0.8, coefficient: 0.4 },
      ],
      best: 'O(n)',
      confidence: 0.92,
    },
  };

  it('explains itself before any analysis has run', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(
      <ComplexityPanel
        report={null}
        analyzing={false}
        stale
        detail=""
        template={template}
        language="typescript"
        onAnalyze={onAnalyze}
      />,
    );
    expect(screen.getByText('Complexity analysis')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Analyze complexity/ }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it('shows both verdicts and the textbook answer', () => {
    render(
      <ComplexityPanel
        report={report}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText('Measured time')).toBeInTheDocument();
    expect(screen.getByText('Static time')).toBeInTheDocument();
    expect(screen.getByText('Textbook answer')).toBeInTheDocument();
    expect(screen.getAllByText('O(n)').length).toBeGreaterThanOrEqual(2);
  });

  it('celebrates agreement between the two methods', () => {
    render(
      <ComplexityPanel
        report={report}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText('Both methods agree: O(n).')).toBeInTheDocument();
  });

  it('flags disagreement and explains why it happens', () => {
    const disagreeing: ComplexityReport = {
      ...report,
      static: { ...report.static, time: 'O(n^2)' },
    };
    render(
      <ComplexityPanel
        report={disagreeing}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/measured O\(n\) — better than the O\(n²\) the source allows/),
    ).toBeInTheDocument();
    // Beating the static worst case is good news, so it must not be a warning.
    expect(document.querySelector('.ant-alert-success')).not.toBeNull();
    expect(document.querySelector('.ant-alert-warning')).toBeNull();
  });

  it('warns only when the run came out worse than the source', () => {
    const worse: ComplexityReport = {
      ...report,
      static: { ...report.static, time: 'O(log n)' },
    };
    render(
      <ComplexityPanel
        report={worse}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/measured O\(n\) — worse than the O\(log n\) the source suggested/),
    ).toBeInTheDocument();
    expect(document.querySelector('.ant-alert-warning')).not.toBeNull();
  });

  it('lists the static evidence', () => {
    render(
      <ComplexityPanel
        report={report}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText('one loop over the input')).toBeInTheDocument();
    expect(screen.getByText('loop depth 1')).toBeInTheDocument();
  });

  it('renders the sample table', () => {
    render(
      <ComplexityPanel
        report={report}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    // One header row plus one row per sample.
    expect(rows).toHaveLength(5);
    // Doubling n doubles the operation count, so every growth factor is 2.00x.
    expect(within(rows[4]).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '128',
      '256',
      '2.0',
      '2.00×',
      '0.80 ms',
    ]);
  });

  it('offers a re-analysis when the code has changed', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(
      <ComplexityPanel
        report={report}
        analyzing={false}
        stale
        detail=""
        template={template}
        language="typescript"
        onAnalyze={onAnalyze}
      />,
    );
    expect(screen.getByText(/changed since this analysis/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Re-analyze/ }));
    expect(onAnalyze).toHaveBeenCalled();
  });

  it('surfaces a benchmark failure rather than hiding it', () => {
    const failed: ComplexityReport = {
      static: report.static,
      empirical: {
        samples: [],
        ranking: [],
        best: 'unknown',
        confidence: 0,
        error: 'The benchmark timed out and was stopped.',
      },
    };
    render(
      <ComplexityPanel
        report={failed}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText('The benchmark could not complete')).toBeInTheDocument();
    expect(screen.getByText('The benchmark timed out and was stopped.')).toBeInTheDocument();
  });
});

describe('prettyClass', () => {
  it('renders exponents as superscripts', () => {
    expect(prettyClass('O(n^2)')).toBe('O(n²)');
    expect(prettyClass('O(n^3)')).toBe('O(n³)');
    expect(prettyClass('O(2^n)')).toBe('O(2ⁿ)');
    expect(prettyClass('O(n^2 log n)')).toBe('O(n² log n)');
    expect(prettyClass('O(n log n)')).toBe('O(n log n)');
  });
});

describe('TemplatePicker', () => {
  it('lists templates grouped by category, structures first', () => {
    render(
      <TemplatePicker open currentId="two-pointers" onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Data structures', 'Patterns', 'Worked examples', 'Scratch']);
    expect(screen.getByText('Priority Queue')).toBeInTheDocument();
    expect(screen.getByText('DAG & Topological Sort')).toBeInTheDocument();
  });

  it('filters by search text across titles and tags', async () => {
    const user = userEvent.setup();
    render(
      <TemplatePicker open currentId="two-pointers" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await user.type(screen.getByPlaceholderText(/Search templates/), 'trie');
    expect(screen.getAllByText(/^Trie/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Priority Queue$/)).not.toBeInTheDocument();
  });

  it('reports when nothing matches', async () => {
    const user = userEvent.setup();
    render(
      <TemplatePicker open currentId="two-pointers" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await user.type(screen.getByPlaceholderText(/Search templates/), 'zzzzz');
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it('selects a template and closes', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<TemplatePicker open currentId="two-pointers" onSelect={onSelect} onClose={onClose} />);

    await user.click(screen.getAllByRole('button', { name: /^Trie/ })[0]);
    expect(onSelect).toHaveBeenCalledWith('trie');
    expect(onClose).toHaveBeenCalled();
  });

  it('marks the current template', () => {
    render(<TemplatePicker open currentId="trie" onSelect={vi.fn()} onClose={vi.fn()} />);
    // Two templates start with "Trie"; the structure comes first.
    expect(screen.getAllByRole('button', { name: /^Trie/ })[0]).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('SplitPane', () => {
  it('sizes each pane from the ratio', () => {
    render(
      <SplitPane first={<p>left</p>} second={<p>right</p>} ratio={30} onRatioChange={vi.fn()} />,
    );
    expect(screen.getByText('left').parentElement).toHaveStyle({ flexBasis: '30%' });
    expect(screen.getByText('right').parentElement).toHaveStyle({ flexBasis: '70%' });
  });

  it('exposes the divider as an accessible separator', () => {
    render(
      <SplitPane first={<p>a</p>} second={<p>b</p>} ratio={40} onRatioChange={vi.fn()} />,
    );
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-valuenow', '40');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('resizes with the arrow keys', async () => {
    const user = userEvent.setup();
    const onRatioChange = vi.fn();
    render(
      <SplitPane first={<p>a</p>} second={<p>b</p>} ratio={50} onRatioChange={onRatioChange} />,
    );

    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{ArrowRight}');
    expect(onRatioChange).toHaveBeenCalledWith(52);
    await user.keyboard('{ArrowLeft}');
    expect(onRatioChange).toHaveBeenCalledWith(48);
  });

  it('clamps to the configured bounds', async () => {
    const user = userEvent.setup();
    const onRatioChange = vi.fn();
    render(
      <SplitPane
        first={<p>a</p>}
        second={<p>b</p>}
        ratio={21}
        min={20}
        max={80}
        onRatioChange={onRatioChange}
      />,
    );
    screen.getByRole('separator').focus();
    await user.keyboard('{ArrowLeft}');
    expect(onRatioChange).toHaveBeenCalledWith(20);
  });

  it('stacks both panes when told to', () => {
    render(
      <SplitPane first={<p>a</p>} second={<p>b</p>} ratio={50} onRatioChange={vi.fn()} stacked />,
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});

describe('responsive rendering', () => {
  it('shortens the visualizer header on a phone', () => {
    render(<VisualizerPanel frames={frames} status="done" compact onRun={vi.fn()} />);
    // Speed control is dropped; the transport that matters stays.
    expect(screen.queryByLabelText('Playback speed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next step' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('keeps the speed control on a wide screen', () => {
    render(<VisualizerPanel frames={frames} status="done" onRun={vi.fn()} />);
    // antd Select renders both a combobox and a hidden input under the label.
    expect(screen.getAllByLabelText('Playback speed').length).toBeGreaterThan(0);
  });

  it('trims the frame metadata on a phone', () => {
    const busy: Frame[] = [
      {
        id: 0,
        label: 'step',
        view: normalize([1]),
        meta: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
      },
    ];
    const { rerender } = render(
      <VisualizerPanel frames={busy} status="done" compact onRun={vi.fn()} />,
    );
    expect(screen.queryByText('f')).not.toBeInTheDocument();

    rerender(<VisualizerPanel frames={busy} status="done" onRun={vi.fn()} />);
    expect(screen.getByText('f')).toBeInTheDocument();
  });

  it('gives the template picker the full width on a phone', () => {
    const { container } = render(
      <TemplatePicker open compact currentId="stack" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    const wrapper = container.ownerDocument.querySelector('.ant-drawer-content-wrapper');
    expect(wrapper).toHaveStyle({ width: '100%' });
  });
});

describe('ComplexityPanel — nothing to measure', () => {
  const template = getTemplate('two-pointers');
  const staticHalf = {
    time: 'O(n)' as const,
    space: 'O(1)' as const,
    confidence: 0.7,
    notes: ['one loop over the input'],
    maxLoopDepth: 1,
    recursion: { detected: false, functions: [] },
  };
  const noBench: ComplexityReport = {
    static: staticHalf,
    empirical: {
      best: 'unknown',
      confidence: 0,
      samples: [],
      ranking: [],
      error: `${NO_BENCHMARK} Analyze grows the input and watches how the work grows with it.`,
    },
  };

  it('shows a harness you can read instead of a type signature', () => {
    render(
      <ComplexityPanel
        report={noBench}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        benchFn="twoSumSorted"
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByText('Nothing to measure yet')).toBeInTheDocument();
    // The example refers to the reader's own function, and says what each half
    // of the harness is for.
    expect(screen.getByText(/run: \(data\) => twoSumSorted\(data\)/)).toBeInTheDocument();
    expect(screen.getByText(/Build an input of size n/)).toBeInTheDocument();
  });

  it('writes the example in the language being edited', () => {
    render(
      <ComplexityPanel
        report={noBench}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="python"
        benchFn="twoSumSorted"
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByText(/run=lambda data: two_sum_sorted\(data\)/)).toBeInTheDocument();
  });

  it('leaves an unrelated benchmark failure alone', () => {
    render(
      <ComplexityPanel
        report={{ static: staticHalf, empirical: { ...noBench.empirical!, error: 'The benchmark timed out.' } }}
        analyzing={false}
        stale={false}
        detail=""
        template={template}
        language="typescript"
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByText('The benchmark could not complete')).toBeInTheDocument();
    expect(screen.getByText('The benchmark timed out.')).toBeInTheDocument();
  });
});

describe('Header — progressive disclosure', () => {
  const headerProps = {
    template: getTemplate('stack'),
    language: 'typescript' as const,
    mode: 'clean' as const,
    status: 'idle' as const,
    analyzing: false,
    isDirty: false,
    hasInstrumented: true,
    theme: 'midnight' as const,
    onOpenTemplates: vi.fn(),
    onOpenProblems: vi.fn(),
    onLanguage: vi.fn(),
    onMode: vi.fn(),
    onRun: vi.fn(),
    onSubmit: vi.fn(),
    canSubmit: false,
    judging: false,
    onDebug: vi.fn(),
    debugging: false,
    onAnalyze: vi.fn(),
    onCancel: vi.fn(),
    onResetCode: vi.fn(),
    onTheme: vi.fn(),
  };

  it('offers Submit only when there is a problem to be judged against', async () => {
    const user = userEvent.setup();
    render(<Header {...headerProps} layout="desktop" canSubmit={false} />);
    // A template has no right answer, so a permanently disabled button would
    // be clutter on every screen but one.
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toHaveClass('ant-btn-primary');

    cleanup();
    render(<Header {...headerProps} layout="desktop" canSubmit />);
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toHaveClass('ant-btn-primary');
    // Submit takes the primary weight; Run keeps working, quieter.
    expect(screen.getByRole('button', { name: 'Run' })).not.toHaveClass('ant-btn-primary');

    await user.click(submit);
    expect(headerProps.onSubmit).toHaveBeenCalled();
  });

  it('says when a submission is being judged, and refuses a second', () => {
    render(<Header {...headerProps} layout="desktop" canSubmit judging />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('will not offer instrumentation a template does not have', () => {
    render(<Header {...headerProps} layout="desktop" hasInstrumented={false} />);
    // A LeetCode problem is plain code either way; the toggle used to change
    // the badge and nothing else.
    expect(screen.getByRole('button', { name: 'Show instrumentation' })).toBeDisabled();
  });

  it('shows the full control set on a desktop', () => {
    render(<Header {...headerProps} layout="desktop" />);
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument();
  });

  it('moves the secondary controls into a menu on a phone', () => {
    render(<Header {...headerProps} layout="compact" />);

    // Run and the template picker always stay on the bar.
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Template: Stack/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();

    // The rest have moved, not vanished.
    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
  });

  it('offers every relocated control inside the menu', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<Header {...headerProps} layout="compact" onAnalyze={onAnalyze} />);

    await user.click(screen.getByRole('button', { name: 'More options' }));

    expect(await screen.findByText('Analyze complexity')).toBeInTheDocument();
    expect(screen.getByText('Show instrumentation')).toBeInTheDocument();
    expect(screen.getByText('Reset code')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Midnight')).toBeInTheDocument();

    await user.click(screen.getByText('Analyze complexity'));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  it('shortens the mode badge on a phone', () => {
    const { rerender } = render(<ModeBadge mode="clean" />);
    expect(screen.getByText(/Breakstep traces it automatically/)).toBeInTheDocument();

    rerender(<ModeBadge mode="clean" compact />);
    expect(screen.getByText('Plain code — auto-traced')).toBeInTheDocument();
  });
});
