import type { SVGProps } from 'react'

type Props = {
  size?: number | string
  color?: string
  strokeWidth?: number | string
} & Omit<SVGProps<SVGSVGElement>, 'color'>

// Continuous flight auger (CFA / "helice continua") piling rig:
// crawler base, cab, vertical mast and a helical auger drilling into the ground.
// Drop-in replacement for the lucide `Tractor` icon (same size/color/strokeWidth API).
export default function HeliceContinuaIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  ...props
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* ground line */}
      <path d="M3 21h18" />
      {/* crawler track base */}
      <rect x="3" y="16.8" width="9" height="3.2" rx="1.6" />
      {/* rig cab / body */}
      <path d="M5 16.8V12h4v4.8" />
      {/* vertical mast (leader) */}
      <path d="M11.5 16V2.6" />
      {/* mast top sheave */}
      <circle cx="11.5" cy="2" r="0.9" />
      {/* link from mast top to the auger shaft */}
      <path d="M11.5 4.4h4.2" />
      {/* auger shaft drilling into the ground */}
      <path d="M15.7 4.4V21" />
      {/* helical auger flights */}
      <path d="M13.6 7.2l4.2 1.1M13.6 10.4l4.2 1.1M13.6 13.6l4.2 1.1M13.6 16.8l4.2 1.1" />
    </svg>
  )
}
