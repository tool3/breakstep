import { useMemo } from 'react';
import { Button, Empty, Tag, Tooltip } from 'antd';
import { ExportOutlined, EyeOutlined, LockOutlined, UndoOutlined } from '@ant-design/icons';
import { StructureLinks, TechniqueCard, UnmappedTags } from './TechniqueCard';
import { VERDICT } from './SubmissionsPanel';
import { readTopics } from '@/leetcode/topics';
import { problemUrl } from '@/leetcode/synthesize';
import type { LeetProblem } from '@/leetcode/types';
import type { Verdict } from '@/submissions/types';
import type { Language } from '@/types';
import styles from './ProblemPanel.module.scss';

interface Props {
  problem: LeetProblem | null;
  language: Language;
  verdict: Verdict | null;
  onReveal: (problem: LeetProblem) => void;
  onResetToStarter: () => void;
  onOpenTemplate: (templateId: string) => void;
  onFindProblem: () => void;
}

const DIFFICULTY_COLOR = { Easy: 'green', Medium: 'gold', Hard: 'red' } as const;

export function ProblemPanel({
  problem,
  language,
  verdict,
  onReveal,
  onResetToStarter,
  onOpenTemplate,
  onFindProblem,
}: Props) {
  const topics = useMemo(() => readTopics(problem?.topics ?? []), [problem?.topics]);

  if (!problem) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No problem loaded. Paste a LeetCode link to open one."
          />
          <Button onClick={onFindProblem}>Find a problem</Button>
        </div>
      </div>
    );
  }

  const written = problem.origin !== 'generated';
  const techniques = [...problem.techniques].sort((a, b) => a.rank - b.rank);

  return (
    <div className={styles.panel}>
      <div className={styles.actions}>
        {written ? (
          <Tooltip title={`Replace the editor with a worked solution in ${language}`}>
            <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => onReveal(problem)}>
              Reveal the solution
            </Button>
          </Tooltip>
        ) : (
          <span className={styles.noSolution}>
            No solution to reveal — LeetCode publishes none to take, and this one is not written out
            here.
          </span>
        )}

        <Tooltip title="Throw away this attempt and start from the stub again">
          <Button size="small" icon={<UndoOutlined />} onClick={onResetToStarter}>
            Reset to starter
          </Button>
        </Tooltip>

        <a
          className={styles.leetLink}
          href={problemUrl(problem.slug)}
          target="_blank"
          rel="noreferrer noopener"
        >
          <ExportOutlined /> On LeetCode
        </a>
      </div>

      <div className={styles.scroll}>
        <section className={styles.section}>
          <div className={styles.head}>
            <span className={styles.number}>{problem.number}</span>
            <h3 className={styles.title}>{problem.title}</h3>
            <Tag color={DIFFICULTY_COLOR[problem.difficulty]}>{problem.difficulty}</Tag>
            {verdict && verdict !== 'unjudged' && (
              <Tag
                className={styles.verdict}
                icon={VERDICT[verdict].icon}
                color={verdict === 'accepted' ? 'success' : verdict === 'wrong-answer' ? 'error' : 'warning'}
                bordered={false}
              >
                {VERDICT[verdict].label}
              </Tag>
            )}
            {!written && (
              <Tooltip title="Assembled from LeetCode's published interface and examples">
                <Tag icon={<LockOutlined />} color="default">
                  statement on LeetCode
                </Tag>
              </Tooltip>
            )}
          </div>

          <p className={styles.prompt}>{problem.prompt}</p>

          <div className={styles.topics}>
            {problem.topics.map((topic) => (
              <span key={topic} className={styles.topic}>
                {topic}
              </span>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>Examples</h4>
          <ul className={styles.examples}>
            {problem.examples.map((example, i) => (
              <li key={example.input} className={styles.example}>
                <span className={styles.exampleLabel}>{i + 1}</span>
                <div className={styles.exampleBody}>
                  <code className={styles.exampleIn}>{example.input}</code>
                  <code className={styles.exampleOut}>→ {example.output}</code>
                  {example.note && <span className={styles.exampleNote}>{example.note}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {problem.constraints.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.heading}>Constraints</h4>
            <ul className={styles.constraints}>
              {problem.constraints.map((line) => (
                <li key={line}>
                  <code>{line}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {techniques.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.heading}>
              {written ? 'Recommended technique' : 'Technique, from its tags'}
            </h4>
            <ul className={styles.techniques}>
              {techniques.map((technique) => (
                <TechniqueCard
                  key={technique.pattern}
                  technique={technique}
                  onOpenTemplate={onOpenTemplate}
                />
              ))}
            </ul>
            <StructureLinks structures={topics.structures} onOpenTemplate={onOpenTemplate} />
            <UnmappedTags tags={topics.unmapped} />
          </section>
        )}

        {/*
          Provenance, with the problem it belongs to. A reader looking at a
          restated prompt beside a LeetCode number deserves to be told which
          parts came from where, without going to find a README.
        */}
        <section className={styles.section}>
          <p className={styles.provenance}>
            {written
              ? 'Task restated and solved here; the numbering, the topic tags and the example data are LeetCode’s.'
              : 'Assembled from the interface and example cases LeetCode publishes. The statement is LeetCode’s writing and is not reproduced — read it there.'}{' '}
            Breakstep is not affiliated with or endorsed by LeetCode.
          </p>
        </section>
      </div>
    </div>
  );
}
