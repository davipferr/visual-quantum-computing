import type { Vec3 } from 'visual-quantum-computing'
import { useRef, type PointerEvent } from 'react'
import { arrow, useCanvas, type Frame } from './canvas'

/**
 * A Bloch sphere drawn on a 2-D canvas with an orthographic camera.
 *
 * World axes follow the physics convention: z up (|0⟩ at the north pole),
 * x towards the viewer (|+⟩), y to the right (|+i⟩). The camera spins about z
 * by `yaw` and tilts by `pitch`; drag the sphere to orbit it.
 */

export interface View {
  yaw: number
  pitch: number
}

const DEG = Math.PI / 180

export const defaultView = (): View => ({ yaw: -115 * DEG, pitch: 18 * DEG })

export interface Projected {
  x: number
  y: number
  /** > 0 in front of the sphere's centre plane, < 0 behind it. */
  depth: number
}

export interface Projector {
  cx: number
  cy: number
  radius: number
  project: (v: Vec3) => Projected
  /** Screen point → point on the sphere's surface, on the front or back hemisphere. */
  unproject: (x: number, y: number, front: boolean) => Vec3
}

export function projector(cx: number, cy: number, radius: number, { yaw, pitch }: View): Projector {
  const cy_ = Math.cos(yaw), sy = Math.sin(yaw)
  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  return {
    cx,
    cy,
    radius,
    project([x, y, z]) {
      const x1 = x * cy_ - y * sy
      const y1 = x * sy + y * cy_
      const y2 = y1 * cp - z * sp
      const z2 = y1 * sp + z * cp
      return { x: cx + x1 * radius, y: cy - z2 * radius, depth: -y2 }
    },
    unproject(sx, sy2, front) {
      let x1 = (sx - cx) / radius
      let z2 = -(sy2 - cy) / radius
      const r2 = x1 * x1 + z2 * z2
      let y2 = 0
      if (r2 > 1) {
        const r = Math.sqrt(r2)
        x1 /= r
        z2 /= r
      } else {
        y2 = (front ? -1 : 1) * Math.sqrt(1 - r2)
      }
      const y1 = y2 * cp + z2 * sp
      const z = -y2 * sp + z2 * cp
      return [x1 * cy_ + y1 * sy, -x1 * sy + y1 * cy_, z]
    },
  }
}

export interface SphereVector {
  v: Vec3
  color: string
  width?: number
}

export interface SphereScene {
  vectors?: SphereVector[]
  trails?: { points: Vec3[]; color: string; width?: number }[]
  /** A rotation axis, drawn as a dashed line straight through the sphere. */
  axis?: { v: Vec3; color: string }
  points?: { v: Vec3; color: string; radius?: number; label?: string }[]
  /** Small spheres skip the ket labels. */
  compact?: boolean
  /** Highlight one pole (e.g. a measurement axis). */
  measureAxis?: { v: Vec3; color: string }
}

const axisLabels: { v: Vec3; text: string }[] = [
  { v: [0, 0, 1], text: '|0⟩' },
  { v: [0, 0, -1], text: '|1⟩' },
  { v: [1, 0, 0], text: '|+⟩' },
  { v: [-1, 0, 0], text: '|−⟩' },
  { v: [0, 1, 0], text: '|+i⟩' },
  { v: [0, -1, 0], text: '|−i⟩' },
]

const scaleVec = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]

/** Draw a sphere in the frame (or in a sub-box of it) and return its projector. */
export function drawBlochSphere(
  frame: Frame,
  view: View,
  scene: SphereScene = {},
  box = { x: 0, y: 0, width: frame.width, height: frame.height },
): Projector {
  const { ctx, color } = frame
  const margin = scene.compact ? 10 : 34
  const radius = Math.max(10, Math.min(box.width, box.height) / 2 - margin)
  const p = projector(box.x + box.width / 2, box.y + box.height / 2, radius, view)

  // Great circles, split into the half behind the sphere and the half in front.
  const circles: ((t: number) => Vec3)[] = [
    (t) => [Math.cos(t), Math.sin(t), 0],
    (t) => [Math.cos(t), 0, Math.sin(t)],
    (t) => [0, Math.cos(t), Math.sin(t)],
  ]
  const drawCircles = (front: boolean) => {
    ctx.strokeStyle = color('--sphere-line')
    ctx.lineWidth = 1
    ctx.setLineDash(front ? [] : [3, 4])
    ctx.globalAlpha = front ? 0.9 : 0.55
    for (const circle of circles) {
      ctx.beginPath()
      const steps = 96
      for (let i = 0; i < steps; i++) {
        const a = p.project(circle((i / steps) * Math.PI * 2))
        const b = p.project(circle(((i + 1) / steps) * Math.PI * 2))
        if (a.depth + b.depth >= 0 !== front) continue
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  const drawAxes = (front: boolean) => {
    ctx.lineWidth = 1
    ctx.strokeStyle = color('--muted')
    for (const { v } of axisLabels) {
      const tip = p.project(v)
      if (tip.depth >= 0 !== front) continue
      ctx.globalAlpha = front ? 0.8 : 0.4
      ctx.beginPath()
      ctx.moveTo(p.cx, p.cy)
      ctx.lineTo(tip.x, tip.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawCircles(false)
  drawAxes(false)

  // The sphere itself: a soft, translucent disc.
  const gradient = ctx.createRadialGradient(
    p.cx - radius * 0.35,
    p.cy - radius * 0.4,
    radius * 0.1,
    p.cx,
    p.cy,
    radius,
  )
  gradient.addColorStop(0, color('--sphere-light'))
  gradient.addColorStop(1, color('--sphere-dark'))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(p.cx, p.cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color('--sphere-line')
  ctx.lineWidth = 1.25
  ctx.stroke()

  drawCircles(true)
  drawAxes(true)

  // Labels for the six cardinal states.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (!scene.compact) {
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif'
    for (const { v, text } of axisLabels) {
      const at = p.project(scaleVec(v, 1.16))
      ctx.fillStyle = color('--muted')
      ctx.globalAlpha = at.depth < -0.3 ? 0.55 : 1
      ctx.fillText(text, at.x, at.y)
    }
  } else {
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = color('--muted')
    const top = p.project([0, 0, 1.0])
    const bottom = p.project([0, 0, -1.0])
    ctx.fillText('0', top.x, top.y - 6)
    ctx.fillText('1', bottom.x, bottom.y + 7)
  }
  ctx.globalAlpha = 1
  ctx.textBaseline = 'alphabetic'

  const fade = (depth: number) => (depth < 0 ? 0.4 + 0.6 * (1 + Math.max(-1, depth)) * 0.5 : 1)

  if (scene.measureAxis) {
    const { v, color: c } = scene.measureAxis
    for (const end of [v, scaleVec(v, -1)]) {
      const at = p.project(end)
      ctx.globalAlpha = fade(at.depth)
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(at.x, at.y, 7, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (scene.axis) {
    const a = p.project(scaleVec(scene.axis.v, 1.25))
    const b = p.project(scaleVec(scene.axis.v, -1.25))
    ctx.strokeStyle = scene.axis.color
    ctx.lineWidth = 2
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(a.x, a.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = scene.axis.color
    ctx.beginPath()
    ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const trail of scene.trails ?? []) {
    ctx.strokeStyle = trail.color
    ctx.lineWidth = trail.width ?? 2
    ctx.lineCap = 'round'
    for (let i = 1; i < trail.points.length; i++) {
      const a = p.project(trail.points[i - 1])
      const b = p.project(trail.points[i])
      ctx.globalAlpha = fade((a.depth + b.depth) / 2) * (0.35 + (0.65 * i) / trail.points.length)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
    ctx.globalAlpha = 1
  }

  for (const point of scene.points ?? []) {
    const at = p.project(point.v)
    ctx.globalAlpha = fade(at.depth)
    ctx.fillStyle = point.color
    ctx.beginPath()
    ctx.arc(at.x, at.y, point.radius ?? 4, 0, Math.PI * 2)
    ctx.fill()
    if (point.label) {
      ctx.fillStyle = color('--text')
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(point.label, at.x + 7, at.y - 5)
    }
  }
  ctx.globalAlpha = 1

  for (const vector of scene.vectors ?? []) {
    const length = Math.hypot(...vector.v)
    const tip = p.project(vector.v)
    ctx.globalAlpha = fade(tip.depth)
    if (length < 0.03) {
      // A maximally mixed qubit has no direction at all.
      ctx.strokeStyle = vector.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.cx, p.cy, 5, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      arrow(ctx, p.cx, p.cy, tip.x, tip.y, vector.color, vector.width ?? (scene.compact ? 2.5 : 3.5))
      if (!scene.compact) {
        ctx.fillStyle = vector.color
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  return p
}

/**
 * A canvas holding a draggable Bloch sphere. Dragging empty space orbits the
 * camera. If `grab` returns the current state's vector and the pointer starts
 * on its tip, dragging moves the state instead and reports it via `onDrag`.
 */
export function useBlochCanvas(
  draw: (frame: Frame, view: View) => Projector,
  options: {
    grab?: () => Vec3 | null
    onDrag?: (v: Vec3) => void
    onDragEnd?: () => void
  } = {},
) {
  const view = useRef<View>(defaultView())
  const projection = useRef<Projector | null>(null)
  const drag = useRef<{ mode: 'view' | 'state'; x: number; y: number; front: boolean } | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const canvas = useCanvas((frame) => {
    projection.current = draw(frame, view.current)
  })

  const local = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(event)
    const p = projection.current
    const v = optionsRef.current.grab?.()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (p && v && optionsRef.current.onDrag) {
      const tip = p.project(v)
      if (Math.hypot(tip.x - x, tip.y - y) < 18) {
        drag.current = { mode: 'state', x, y, front: tip.depth >= 0 }
        return
      }
    }
    drag.current = { mode: 'view', x, y, front: true }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const { x, y } = local(event)
    if (d.mode === 'view') {
      view.current = {
        yaw: view.current.yaw - (x - d.x) * 0.012,
        pitch: Math.max(-1.45, Math.min(1.45, view.current.pitch + (y - d.y) * 0.012)),
      }
      d.x = x
      d.y = y
      canvas.redraw()
    } else if (projection.current) {
      optionsRef.current.onDrag?.(projection.current.unproject(x, y, d.front))
    }
  }

  const onPointerUp = () => {
    if (drag.current?.mode === 'state') optionsRef.current.onDragEnd?.()
    drag.current = null
  }

  const resetView = () => {
    view.current = defaultView()
    canvas.redraw()
  }

  return {
    ref: canvas.ref,
    redraw: canvas.redraw,
    resetView,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}
