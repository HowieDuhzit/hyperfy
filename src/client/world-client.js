// import 'ses'
// import '../core/lockdown'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createClientWorld } from '../core/createClientWorld'
import { loadPhysX } from './loadPhysX'
import { CoreUI } from './components/CoreUI'
import { WorldProvider } from './WorldContext'

export { System } from '../core/systems/System'

const styles = {
  app: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100vh'
  },
  viewport: {
    position: 'absolute',
    inset: 0
  },
  ui: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    userSelect: 'none'
  }
}

export function Client({ wsUrl, onSetup }) {
  const viewportRef = useRef()
  const uiRef = useRef()
  const world = useMemo(() => createClientWorld(), [])
  
  useEffect(() => {
    const viewport = viewportRef.current
    const ui = uiRef.current
    const baseEnvironment = {
      model: '/base-environment.glb',
      bg: '/day2-2k.jpg',
      hdr: '/day2.hdr',
      sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
      sunIntensity: 1,
      sunColor: 0xffffff,
      fogNear: null,
      fogFar: null,
      fogColor: null,
    }
    const config = { viewport, ui, wsUrl, loadPhysX, baseEnvironment }
    onSetup?.(world, config)
    world.init(config)
  }, [])

  return (
    <WorldProvider world={world}>
      <div className='App' style={styles.app}>
        <div className='App__viewport' ref={viewportRef} style={styles.viewport}>
          <div className='App__ui' ref={uiRef} style={styles.ui}>
            <CoreUI world={world} />
          </div>
        </div>
      </div>
    </WorldProvider>
  )
}
