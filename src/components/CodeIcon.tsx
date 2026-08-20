/**
 * VS Code's own icons, from the font Monaco already ships.
 *
 * The debug toolbar was drawn with the nearest antd icons, and near was not
 * close enough: "step over" was a download tray, "step into" and "step out" were
 * the login and logout arrows, and stop was a circle with a slash through it —
 * which reads as *forbidden*, not as stop. None of them said what the button did.
 *
 * Monaco bundles the codicon font — the same file VS Code draws its interface
 * with — so the real glyphs are already in the page. Referencing them by
 * codepoint gets the exact shapes with no new asset and no icon library: an arc
 * over a dot for step over, an arrow down into one for step into, up out of one
 * for step out, a leftward arc for step back.
 *
 * Codepoints come from `vs/base/common/codiconsLibrary.js`, which is where
 * Monaco declares them, so they cannot drift from the font that renders them.
 */
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
  /** Bigger than the 16px default, for the one button you press most. */
  size?: number;
}

export function CodeIcon({ glyph, size }: Props) {
  return (
    <span
      className={styles.icon}
      style={size ? { fontSize: size } : undefined}
      // The glyph is decoration: every button that carries one has an aria-label.
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
