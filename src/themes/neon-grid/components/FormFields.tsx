import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../default/components/icons';
import styles from './FormFields.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Terminal input: a prompt label, a lit underline while focused, password reveal. */
export function TextField({ label, hint, error, className, type, ...rest }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const { t } = useTranslation('auth');
  const isPassword = type === 'password';
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {/* The prompt sits outside the label so it never becomes part of the field's name. */}
      <div className={styles.labelRow}>
        <span className={styles.prompt} aria-hidden="true">
          &gt;
        </span>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      </div>
      <div className={styles.control} data-invalid={error ? true : undefined}>
        <input
          {...rest}
          id={id}
          type={isPassword && revealed ? 'text' : type}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => {
              setRevealed((value) => !value);
            }}
            aria-label={revealed ? t('credentials.hidePassword') : t('credentials.showPassword')}
            aria-pressed={revealed}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} />
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={styles.checkboxRow}>
      <input
        id={id}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <label htmlFor={id} className={styles.checkboxLabel}>
        <span className={styles.box} aria-hidden="true">
          <Icon name="check" />
        </span>
        <span>
          {label}
          {hint && (
            <span id={`${id}-hint`} className={styles.checkboxHint}>
              {hint}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

const NOTICE_ICONS = { info: 'info', error: 'alert', success: 'check' } as const;
const NOTICE_CLASSES = {
  info: undefined,
  error: styles.noticeError,
  success: styles.noticeSuccess,
} as const;

export function Notice({
  kind,
  children,
}: {
  kind: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <div
      className={[styles.notice, NOTICE_CLASSES[kind]].filter(Boolean).join(' ')}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={NOTICE_ICONS[kind]} className={styles.noticeIcon} />
      <div>{children}</div>
    </div>
  );
}
