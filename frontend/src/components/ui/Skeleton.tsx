type SkeletonLineProps = {
  width?: string
  height?: string
  style?: React.CSSProperties
}

type SkeletonBlockProps = {
  height?: string
  style?: React.CSSProperties
}

export function SkeletonLine({ width = '100%', height = '14px', style }: SkeletonLineProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, ...style }}
    />
  )
}

export function SkeletonBlock({ height = '80px', style }: SkeletonBlockProps) {
  return (
    <div
      className="skeleton"
      style={{ width: '100%', height, borderRadius: '10px', ...style }}
    />
  )
}

export function SkeletonForm({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonLine width="35%" height="12px" />
          <SkeletonBlock height="44px" />
        </div>
      ))}
    </div>
  )
}
