import { useState, type KeyboardEvent } from 'react';
import { DEFAULT_SHORTCUT } from '../preferences';

type ShortcutInputProps = {
  value: string;
  error: string;
  onChange: (shortcut: string) => void;
};

function shortcutKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function formatShortcutKey(part: string): string {
  if (part === 'Space') return 'Espaço';
  if (/^Key[A-Z]$/.test(part)) return part.slice(3);
  if (/^Digit[0-9]$/.test(part)) return part.slice(5);
  return part;
}

function formatShortcut(shortcut: string): string {
  return shortcut.split('+').map(formatShortcutKey).join(' + ');
}

export function ShortcutInput({ value, error, onChange }: ShortcutInputProps) {
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState('');
  const instruction =
    'Use Ctrl, Alt, Shift ou Super com outra tecla. Esc cancela.';

  function captureShortcut(event: KeyboardEvent<HTMLButtonElement>) {
    if (!capturing || event.key === 'Tab') return;
    event.preventDefault();

    if (event.key === 'Escape') {
      setCapturing(false);
      setHint('');
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;

    const modifiers = [
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
      event.metaKey && 'Super',
    ].filter((modifier): modifier is string => Boolean(modifier));

    if (modifiers.length === 0) {
      setHint('Inclua Ctrl, Alt, Shift ou Super.');
      return;
    }

    const key = shortcutKey(event.code);
    if (
      !key ||
      ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(key)
    ) {
      return;
    }

    onChange([...modifiers, key].join('+'));
    setCapturing(false);
    setHint('');
  }

  return (
    <div className="shortcut-control">
      <div className="shortcut-field">
        <button
          id="global-shortcut"
          className={capturing ? 'shortcut-input capturing' : 'shortcut-input'}
          type="button"
          onClick={() => {
            setCapturing(true);
            setHint('');
          }}
          onKeyDown={captureShortcut}
          onBlur={() => {
            setCapturing(false);
            setHint('');
          }}
          aria-invalid={error ? true : undefined}
          aria-labelledby="shortcut-label shortcut-value"
          aria-describedby={capturing || error ? 'shortcut-hint' : undefined}
        >
          <span id="shortcut-value" className="sr-only">
            {capturing ? 'capturando teclas' : formatShortcut(value)}
          </span>
          {capturing ? (
            <span className="shortcut-placeholder" aria-hidden="true">
              Pressione as teclas…
            </span>
          ) : (
            <span className="shortcut-keys" aria-hidden="true">
              {value.split('+').map((part, index) => (
                <span className="shortcut-key-group" key={`${part}-${index}`}>
                  {index > 0 && <span className="shortcut-plus">+</span>}
                  <kbd className="shortcut-key">{formatShortcutKey(part)}</kbd>
                </span>
              ))}
            </span>
          )}
        </button>
        <button
          className="shortcut-reset"
          type="button"
          onClick={() => {
            onChange(DEFAULT_SHORTCUT);
            setCapturing(false);
            setHint('');
          }}
          aria-label="Restaurar atalho padrão"
        >
          Padrão
        </button>
      </div>
      {(capturing || error) && (
        <small
          className="shortcut-hint"
          id="shortcut-hint"
          role={capturing ? 'status' : 'alert'}
        >
          {capturing ? hint || instruction : error}
        </small>
      )}
    </div>
  );
}
