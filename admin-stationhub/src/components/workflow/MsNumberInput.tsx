import { useEffect, useState } from 'react';

type Props = {
  value: number;
  onChange: (n: number) => void;
  onCommitted?: (n: number) => void;
  min?: number;
  className?: string;
};

/** Input số ms — cho phép xóa hết rồi gõ lại (vd. 1000 → 100) mà không bị snap về 0. */
export function MsNumberInput({
  value,
  onChange,
  onCommitted,
  min = 0,
  className,
}: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Math.max(min, Number(raw) || 0);
    setText(String(n));
    onChange(n);
    onCommitted?.(n);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== '' && !/^\d+$/.test(raw)) return;
        setText(raw);
        if (raw !== '') onChange(Number(raw));
      }}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}
