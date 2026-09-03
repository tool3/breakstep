import { useMemo, useState } from 'react';
import { Drawer, Empty, Input, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { allTemplates, templatesByCategory } from '@/templates';
import { prettyClass } from './ComplexityPanel';
import styles from './TemplatePicker.module.scss';

interface Props {
  open: boolean;
  currentId: string;
  compact?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ open, currentId, compact, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templatesByCategory();

    const all = allTemplates();
    const matches = all.filter((t) =>
      [t.title, t.blurb, t.category, ...t.tags].join(' ').toLowerCase().includes(needle),
    );

    const byCategory = new Map<string, typeof all>();
    for (const t of matches) {
      if (!byCategory.has(t.category)) byCategory.set(t.category, []);
      byCategory.get(t.category)!.push(t);
    }
    return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
  }, [query]);

  const empty = groups.every((g) => g.items.length === 0);

  return (
    <Drawer
      title="Choose a structure"
      placement="left"
      width={compact ? '100%' : 380}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.search}>
        <Input
          allowClear
          autoFocus
          size="middle"
          prefix={<SearchOutlined />}
          placeholder="Search templates, tags, ideas…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {empty && (
          <Empty
            className={styles.empty}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`Nothing matches “${query}”`}
          />
        )}

        {groups.map(
          (group) =>
            group.items.length > 0 && (
              <section key={group.category} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.category}</h3>
                {group.items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={[styles.item, template.id === currentId ? styles.itemActive : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onSelect(template.id);
                      onClose();
                    }}
                    aria-current={template.id === currentId}
                  >
                    <span className={styles.itemHead}>
                      <span className={styles.itemTitle}>{template.title}</span>
                      {template.expected && (
                        <span className={styles.itemComplexity}>
                          {prettyClass(template.expected.time)}
                        </span>
                      )}
                    </span>
                    <span className={styles.itemBlurb}>{template.blurb}</span>
                    <span className={styles.itemTags}>
                      {template.tags.slice(0, compact ? 2 : 4).map((tag) => (
                        <Tag key={tag} className={styles.tag} bordered={false}>
                          {tag}
                        </Tag>
                      ))}
                    </span>
                  </button>
                ))}
              </section>
            ),
        )}
      </div>
    </Drawer>
  );
}
