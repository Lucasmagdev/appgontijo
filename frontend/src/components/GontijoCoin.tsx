type GontijoCoinProps = {
  size?: number
  className?: string
  title?: string
}

/**
 * Moeda virtual da Gontijo — moeda vermelha da marca com o "G".
 * Usada como ícone da "moeda" de pontos/recompensas (cursos, ranking, sorteio).
 */
export default function GontijoCoin({ size = 24, className, title = 'Moeda Gontijo' }: GontijoCoinProps) {
  const gid = 'gc'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`${gid}-red`} cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor="#ff5a5d" />
          <stop offset="55%" stopColor="#e53235" />
          <stop offset="100%" stopColor="#a31114" />
        </radialGradient>
        <radialGradient id={`${gid}-rim`} cx="50%" cy="36%" r="75%">
          <stop offset="0%" stopColor="#ff7d7f" />
          <stop offset="100%" stopColor="#8f0f12" />
        </radialGradient>
      </defs>

      <circle cx="256" cy="256" r="248" fill={`url(#${gid}-rim)`} />
      <circle cx="256" cy="256" r="248" fill="none" stroke="#7d0d10" strokeWidth="6" />
      <circle cx="256" cy="256" r="214" fill={`url(#${gid}-red)`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="6" />

      <text
        x="256"
        y="368"
        fill="#ffffff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="300"
        fontWeight="800"
        textAnchor="middle"
      >
        G
      </text>

      <ellipse cx="200" cy="160" rx="120" ry="58" fill="#ffffff" fillOpacity="0.10" />
    </svg>
  )
}
