import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons';
import styles from './Admin.module.css';

const BACK_KEYS = new Set(['Escape', 'GoBack', 'BrowserBack', 'XF86Back']);
/** Back buttons of TV remotes that only report a key code (webOS, Tizen). */
const BACK_KEY_CODES = new Set([461, 10009]);

function isTextField(element: EventTarget | null): boolean {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file'].includes(element.type))
  );
}

/**
 * A modal dialog (native `<dialog>`: focus stays inside, the page behind is inert). Escape and
 * the remote's back key close it instead of leaving the page; Backspace outside text fields does
 * nothing here. The keys are caught on the window before anything else sees them, also when the
 * focus has left the dialog (a click on the backdrop's edge, a reloaded module).
 */
export function AdminDialog({
  title,
  onClose,
  footer,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('content');
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Backspace' && !isTextField(event.target)) {
        event.preventDefault();
        return;
      }
      // TV browsers report their back buttons only as key codes, so the deprecated field is needed.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (BACK_KEYS.has(event.key) || BACK_KEY_CODES.has(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      dialog?.close();
    };
  }, []);

  return (
    // The backdrop click closes; keyboard users have Escape and the close button.
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions, jsx-a11y-x/click-events-have-key-events
    <dialog
      ref={ref}
      className={wide ? `${styles.dialog} ${styles.wide}` : styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('admin.close')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}

/** A labelled control: text, number, date, select or textarea get the same frame. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Genres, tags or studios as removable chips with a field to add more. */
export function ChipInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation('content');
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const add = () => {
    const entries = draft
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '' && !values.includes(entry));
    if (entries.length > 0) onChange([...values, ...entries]);
    setDraft('');
  };
  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${inputId}-label`}>
        {label}
      </span>
      {values.length > 0 && (
        <ul className={styles.chips} aria-labelledby={`${inputId}-label`}>
          {values.map((value) => (
            <li key={value} className={styles.chip}>
              <span>{value}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={t('admin.metadataDialog.remove', { name: value })}
                onClick={() => {
                  onChange(values.filter((entry) => entry !== value));
                }}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.chipAdd}>
        <label htmlFor={inputId} className="visually-hidden">
          {t('admin.metadataDialog.addTo', { list: label })}
        </label>
        <input
          id={inputId}
          className={styles.input}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </div>
    </div>
  );
}
