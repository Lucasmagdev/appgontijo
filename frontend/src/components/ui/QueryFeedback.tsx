import { SkeletonLine } from './Skeleton'

type QueryFeedbackProps = {
  type: 'loading' | 'error' | 'empty'
  title: string
  description?: string
}

export default function QueryFeedback({ type, title, description }: QueryFeedbackProps) {
  if (type === 'loading') {
    return (
      <div className="feedback-card feedback-loading" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonLine width="55%" height="14px" />
        <SkeletonLine width="80%" height="12px" />
        <SkeletonLine width="65%" height="12px" />
        <SkeletonLine width="40%" height="12px" />
      </div>
    )
  }

  return (
    <div className={`feedback-card feedback-${type}`}>
      <div className="feedback-title">{title}</div>
      {description ? <p className="feedback-description">{description}</p> : null}
    </div>
  )
}
