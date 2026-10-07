import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Field.module.css';
import { Icon } from './icons';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}

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
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>
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

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function Checkbox({ label, checked, onChange, hint }: CheckboxProps) {
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
