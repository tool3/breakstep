import styles from './CodeIcon.module.scss';

export const CODICON = {
  continue: '',
  pause: '',
  restart: '',
  stepInto: '',
  stepOut: '',
  stepOver: '',
  stop: '',
  stepBack: '',
} as const;

interface Props {
  glyph: (typeof CODICON)[keyof typeof CODICON];
  size?: number;
}

export function CodeIcon({ glyph, size }: Props) {
  return (
    <span
      className={styles.icon}
      style={size ? { fontSize: size } : undefined}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
