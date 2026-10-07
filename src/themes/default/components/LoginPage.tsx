import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CredentialsStepModel,
  QuickConnectStepModel,
  ServerStepModel,
} from '@/hooks/auth/types';
import { useSecondsUntil } from '@/hooks/useNow';
import type { LoginPageProps } from '../../contract';
import { AuthLayout } from './AuthLayout';
import { Button } from './Button';
import { Checkbox, TextField } from './Field';
import { Icon } from './icons';
import styles from './LoginPage.module.css';
import { Notice } from './Notice';
import { Spinner } from './Spinner';
import { errorText, hostOf, serverProblemText } from './text';

function ServerStep({ model }: { model: ServerStepModel }) {
  const { t } = useTranslation('auth');
  const [address, setAddress] = useState(model.initialAddress);
  const problem = model.problem
    ? serverProblemText(t, model.problem, model.minimumVersion)
    : undefined;

  return (
    <AuthLayout title={t('server.title')} subtitle={t('server.subtitle')}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          model.connect(address);
        }}
      >
        <TextField
          label={t('server.address')}
          placeholder={t('server.placeholder')}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}

          autoFocus={model.servers.length === 0}
          hint={t('server.hint', { version: model.minimumVersion })}
          error={problem}
        />
        <Button type="submit" size="lg" block busy={model.checking}>
          {t('server.connect')}
        </Button>
      </form>

      {model.servers.length > 0 && (
        <section className={styles.saved} aria-labelledby="saved-servers">
          <h2 id="saved-servers" className={styles.sectionTitle}>
            {t('server.saved')}
          </h2>
          <ul className={styles.list}>
            {model.servers.map((server) => (
              <li key={server.id} className={styles.listItem}>
                <button
                  type="button"
                  className={styles.listButton}
                  onClick={() => {
                    model.choose(server.id);
                  }}
                >
                  <Icon name="server" className={styles.listIcon} />
                  <span className={styles.listText}>
                    <span className={styles.listTitle}>{server.name}</span>
                    <span className={styles.listMeta}>
                      {hostOf(server.url)} · {t('server.version', { version: server.version })}
                    </span>
                  </span>
                  <Icon name="chevronRight" className={styles.chevron} />
                </button>
                {server.removable && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label={t('server.remove', { name: server.name })}
                    onClick={() => {
                      model.remove(server.id);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </AuthLayout>
  );
}

function CredentialsStep({ model }: { model: CredentialsStepModel }) {
  const { t } = useTranslation('auth');
  const { t: tErrors } = useTranslation('errors');
  const [username, setUsername] = useState(model.initialUsername);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [missingUsername, setMissingUsername] = useState(false);

  let error: string | null = null;
  if (model.error) {
    error =
      model.error.kind === 'auth'
        ? t('credentials.invalid')
        : errorText(tErrors, model.error).message;
  }

  return (
    <AuthLayout
      title={t('credentials.title')}
      subtitle={t('credentials.subtitle', { server: model.server.name })}
      actions={
        <>
          {model.quickConnect && (
            <Button variant="ghost" icon={<Icon name="link" />} onClick={model.quickConnect}>
              {t('credentials.useQuickConnect')}
            </Button>
          )}
          {model.showProfiles && (
            <Button variant="ghost" icon={<Icon name="user" />} onClick={model.showProfiles}>
              {t('credentials.showProfiles')}
            </Button>
          )}
          {model.changeServer && (
            <Button variant="ghost" icon={<Icon name="server" />} onClick={model.changeServer}>
              {t('changeServer')}
            </Button>
          )}
        </>
      }
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (username.trim() === '') {
            setMissingUsername(true);
            return;
          }
          model.submit({ username, password, remember });
        }}
      >
        {model.notice === 'expired' && <Notice kind="info">{t('credentials.expired')}</Notice>}
        {model.demo && <Notice kind="info">{t('credentials.demoHint')}</Notice>}
        <TextField
          label={t('credentials.username')}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setMissingUsername(false);
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}

          autoFocus={model.initialUsername === ''}
          error={missingUsername ? t('credentials.usernameRequired') : undefined}
        />
        <TextField
          type="password"
          label={t('credentials.password')}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          autoComplete="current-password"
          // eslint-disable-next-line jsx-a11y-x/no-autofocus -- single-purpose screen; remotes and keyboards need a starting point
          autoFocus={model.initialUsername !== ''}
        />
        <Checkbox
          label={t('remember')}
          hint={t('rememberHint')}
          checked={remember}
          onChange={setRemember}
        />
        {error && <Notice kind="error">{error}</Notice>}
        <Button type="submit" size="lg" block busy={model.submitting}>
          {t('credentials.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const { t } = useTranslation('auth');
  const seconds = useSecondsUntil(expiresAt);
  return (
    <span className={styles.countdown}>
      {t('quickConnect.expiresIn', { time: formatCountdown(seconds) })}
    </span>
  );
}

function QuickConnectCode({ code }: { code: string }) {
  const { t } = useTranslation('auth');
  return (
    <p className={styles.code}>
      <span className="visually-hidden">
        {t('quickConnect.codeLabel', { code: code.split('').join(' ') })}
      </span>
      {code.split('').map((digit, index) => (
        <span key={index} className={styles.digit} aria-hidden="true">
          {digit}
        </span>
      ))}
    </p>
  );
}

function QuickConnectStep({ model }: { model: QuickConnectStepModel }) {
  const { t } = useTranslation('auth');
  const { t: tErrors } = useTranslation('errors');
  const { state } = model;

  return (
    <AuthLayout
      title={t('quickConnect.title')}
      subtitle={t('quickConnect.subtitle', { server: model.server.name })}
      actions={
        <>
          <Button variant="ghost" icon={<Icon name="lock" />} onClick={model.usePassword}>
            {t('quickConnect.usePassword')}
          </Button>
          {model.changeServer && (
            <Button variant="ghost" icon={<Icon name="server" />} onClick={model.changeServer}>
              {t('changeServer')}
            </Button>
          )}
        </>
      }
    >
      <div className={styles.form}>
        {(state.status === 'waiting' || state.status === 'signingIn') && (
          <>
            <ol className={styles.steps}>
              <li>{t('quickConnect.step1')}</li>
              <li>{t('quickConnect.step2')}</li>
              <li>{t('quickConnect.step3')}</li>
            </ol>
            <QuickConnectCode code={state.code} />
            {model.demo && state.status === 'waiting' && (
              <Notice kind="info">{t('quickConnect.demoHint')}</Notice>
            )}
            <div className={styles.waiting}>
              <Spinner />
              <span role="status">
                {state.status === 'waiting'
                  ? t('quickConnect.waiting')
                  : t('quickConnect.signingIn')}
              </span>
              {state.status === 'waiting' && <Countdown expiresAt={state.expiresAt} />}
            </div>
          </>
        )}
        {state.status === 'starting' && (
          <div className={styles.waiting}>
            <Spinner />
            <span role="status">{t('quickConnect.starting')}</span>
          </div>
        )}
        {state.status === 'expired' && <Notice kind="info">{t('quickConnect.expired')}</Notice>}
        {state.status === 'unavailable' && (
          <Notice kind="info">{t('quickConnect.unavailable')}</Notice>
        )}
        {state.status === 'error' && (
          <Notice kind="error">{errorText(tErrors, state.error).message}</Notice>
        )}
        {(state.status === 'expired' || state.status === 'error') && (
          <Button size="lg" block icon={<Icon name="refresh" />} onClick={model.restart}>
            {t('quickConnect.newCode')}
          </Button>
        )}
        {state.status !== 'unavailable' && (
          <Checkbox
            label={t('remember')}
            hint={t('rememberHint')}
            checked={model.remember}
            onChange={model.setRemember}
          />
        )}
      </div>
    </AuthLayout>
  );
}

export function LoginPage({ flow }: LoginPageProps) {
  switch (flow.step) {
    case 'server':
      return <ServerStep model={flow} />;
    case 'credentials':
      return <CredentialsStep model={flow} />;
    case 'quickConnect':
      return <QuickConnectStep model={flow} />;
  }
}
