import { Button } from 'antd';
import { ApartmentOutlined, BulbOutlined } from '@ant-design/icons';
import { tagLabel } from '@/leetcode/topics';
import { PATTERN_LABEL, type Technique } from '@/leetcode/types';
import { getTemplate } from '@/templates';
import styles from './TechniqueCard.module.scss';

/**
 * One recommended technique, with the reason it fits and a way into the
 * template that teaches it.
 *
 * Shared by the finder drawer and the problem panel: the drawer needs it for
 * problems it cannot open, the panel for the one it did.
 */
export function TechniqueCard({
  technique,
  onOpenTemplate,
}: {
  technique: Technique;
  onOpenTemplate: (templateId: string) => void;
}) {
  const known = technique.complexity.time !== 'unknown';

  return (
    <li className={styles.technique} data-rank={technique.rank}>
      <div className={styles.head}>
        <span className={styles.rank}>{technique.rank === 1 ? 'reach for' : 'also works'}</span>
        <span className={styles.name}>{PATTERN_LABEL[technique.pattern]}</span>
        {known && (
          <span className={styles.cost}>
            {technique.complexity.time} time · {technique.complexity.space} space
          </span>
        )}
      </div>

      <p className={styles.why}>{technique.why}</p>

      <Button
        size="small"
        type="link"
        className={styles.link}
        icon={<BulbOutlined />}
        onClick={() => onOpenTemplate(technique.pattern)}
      >
        Open the {PATTERN_LABEL[technique.pattern].toLowerCase()} template
      </Button>
    </li>
  );
}

/** The structures a problem's tags point at, as ways into their templates. */
export function StructureLinks({
  structures,
  onOpenTemplate,
}: {
  structures: string[];
  onOpenTemplate: (templateId: string) => void;
}) {
  if (structures.length === 0) return null;

  return (
    <div className={styles.structures}>
      <span className={styles.structuresLabel}>Structures it leans on</span>
      {structures.map((id) => (
        <Button
          key={id}
          size="small"
          icon={<ApartmentOutlined />}
          onClick={() => onOpenTemplate(id)}
        >
          {getTemplate(id).title}
        </Button>
      ))}
    </div>
  );
}

/** Tags Breakstep has no template for — named rather than quietly dropped. */
export function UnmappedTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <p className={styles.unmapped}>
      LeetCode also tags it {tags.map(tagLabel).join(', ')} — Breakstep has no template for{' '}
      {tags.length > 1 ? 'those' : 'that'} yet.
    </p>
  );
}
