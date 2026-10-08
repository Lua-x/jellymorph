import styles from './Backdrop.module.css';

/**
 * The perspective grid behind every Neon Grid screen, plus the SVG filters for the image
 * effects. Fixed, decorative and dim enough that text contrast stays at the token values.
 */
export function Backdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.horizon} />
      <div className={styles.floor}>
        <div className={styles.plane} />
      </div>
      <svg className={styles.defs} width="0" height="0" focusable="false">
        <defs>
          {/* Chromatic aberration: red shifted left, blue shifted right, recombined. */}
          <filter id="ng-aberration" x="-5%" y="0" width="110%" height="100%">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="red"
            />
            <feOffset in="red" dx="-3" dy="0" result="redShift" />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="green"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blue"
            />
            <feOffset in="blue" dx="3" dy="0" result="blueShift" />
            <feBlend in="redShift" in2="green" mode="screen" result="redGreen" />
            <feBlend in="redGreen" in2="blueShift" mode="screen" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
