type QueryFeedbackProps = {
  type: 'loading' | 'error' | 'empty'
  title: string
  description?: string
}

export default function QueryFeedback({ type, title, description }: QueryFeedbackProps) {
  return (
    <div className={`feedback-card feedback-${type}`}>
      <div className="feedback-title">{title}</div>
      {description ? <p className="feedback-description">{description}</p> : null}
    </div>
  )
}
