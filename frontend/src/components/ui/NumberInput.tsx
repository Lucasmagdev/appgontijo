import { useEffect, useRef, useState } from 'react'

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null
  onChange: (value: number | null) => void
}

// Aceita virgula ou ponto como separador decimal. Mantem o texto digitado
// (inclusive a virgula no fim) em vez de reformatar o numero a cada tecla,
// o que travava a digitacao de centavos em inputs controlados por number.
const VALID_PARTIAL = /^-?\d*[.,]?\d*$/

function toText(value: number | null) {
  return value == null || !Number.isFinite(value) ? '' : String(value).replace('.', ',')
}

function parse(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === ',' || trimmed === '.') return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export default function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  const [text, setText] = useState(() => toText(value))
  const focused = useRef(false)

  // Ressincroniza com o valor externo apenas quando ele diverge do texto atual
  // (ex.: reset de formulario, carregamento de dados). Nao mexe enquanto digita.
  useEffect(() => {
    if (focused.current) return
    if (parse(text) !== value) setText(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(event) => {
        focused.current = true
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        focused.current = false
        setText(toText(value))
        props.onBlur?.(event)
      }}
      onChange={(event) => {
        const raw = event.target.value
        if (!VALID_PARTIAL.test(raw)) return
        setText(raw)
        onChange(parse(raw))
      }}
    />
  )
}
