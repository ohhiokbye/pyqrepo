'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useState, type ReactNode } from 'react'

const Aurora = dynamic(() => import('./Aurora'), { ssr: false })
class BackgroundBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

export function TutorBackground() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      let available = false
      if (!motion.matches) {
        try {
          const gl = document.createElement('canvas').getContext('webgl2')
          available = Boolean(gl)
          gl?.getExtension('WEBGL_lose_context')?.loseContext()
        } catch { /* static background */ }
      }
      setEnabled(available)
    }
    update()
    motion.addEventListener('change', update)
    return () => motion.removeEventListener('change', update)
  }, [])
  return <div className="tutor-background" aria-hidden="true">
    {enabled && <BackgroundBoundary><Aurora colorStops={['#a7a6ce', '#687ba7', '#45446b']} amplitude={0.7} blend={0.7} speed={0.15} /></BackgroundBoundary>}
    <div className="tutor-background-overlay" />
  </div>
}
