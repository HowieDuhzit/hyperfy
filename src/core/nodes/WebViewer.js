import * as THREE from '../extras/three'
import { isBoolean, isNumber, isString } from 'lodash-es'

import { Node } from './Node'

const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  url: null,
  width: 3,
  height: 2,
  pivot: 'center',
  interactive: true,
  visible: true,
  sandbox: null,
  referrerPolicy: null,
  allow: null,
}

// pixel density per world unit (tune as needed)
const PX_PER_UNIT = 300
const MIN_PX = 256
const MAX_PX = 4096

const isBrowser = typeof window !== 'undefined'

export class WebViewer extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'webviewer'

    this.url = data.url
    this.width = data.width
    this.height = data.height
    this.pivot = data.pivot
    this.interactive = data.interactive
    this.visible = data.visible
    this.sandbox = data.sandbox
    this.referrerPolicy = data.referrerPolicy
    this.allow = data.allow

    this._n = 0
    this._mounted = false
    this._root = null // shared css3d root for all webviewers
    this._wrapper = null // carries 3d transform chain
    this._content = null // sized box that maps px->world units
    this._iframe = null
  }

  mount() {
    if (!isBrowser) return
    this._mounted = true
    this._ensureRoot()
    this._buildDom()
    this.ctx.world.setHot(this, true)
  }

  unmount() {
    if (!isBrowser) return
    this._mounted = false
    this._teardownDom()
    this._releaseRoot()
    this.ctx.world.setHot(this, false)
  }

  lateUpdate() {
    if (!this._mounted) return
    this._syncTransform()
  }

  commit(didMove) {
    // property changes handled eagerly in setters; movement handled in lateUpdate
  }

  // ----- DOM management -----

  _ensureRoot() {
    const world = this.ctx.world
    const uiRoot = world.pointer?.ui
    if (!uiRoot) return

    if (!world._webviewerRoot) {
      const root = document.createElement('div')
      root.style.position = 'absolute'
      root.style.left = '0'
      root.style.top = '0'
      root.style.right = '0'
      root.style.bottom = '0'
      root.style.pointerEvents = 'none'
      root.style.transformStyle = 'preserve-3d'
      root.style.contain = 'strict'
      world._webviewerRoot = root
      world._webviewerRefCount = 0
      uiRoot.appendChild(root)
    }
    world._webviewerRefCount++
    this._root = world._webviewerRoot
  }

  _releaseRoot() {
    const world = this.ctx.world
    if (!world._webviewerRoot) return
    world._webviewerRefCount = Math.max(0, (world._webviewerRefCount || 1) - 1)
    if (world._webviewerRefCount === 0) {
      try {
        world._webviewerRoot.remove()
      } catch {}
      world._webviewerRoot = null
    }
  }

  _buildDom() {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'absolute'
    wrapper.style.left = '0'
    wrapper.style.top = '0'
    wrapper.style.pointerEvents = 'none' // content controls events
    wrapper.style.transformStyle = 'preserve-3d'

    const content = document.createElement('div')
    content.style.position = 'absolute'
    content.style.left = '0'
    content.style.top = '0'
    content.style.willChange = 'transform'
    content.style.backfaceVisibility = 'hidden'

    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0'
    iframe.style.display = this._visible ? 'block' : 'none'

    // apply attributes
    this._applyIframeAttrs(iframe)

    // interaction capture
    const onEnter = () => {
      const world = this.ctx.world
      world.pointer?.setScreenHit?.({ node: this, coords: new THREE.Vector3() })
    }
    const onLeave = () => {
      const world = this.ctx.world
      world.pointer?.setScreenHit?.(null)
    }
    iframe.addEventListener('pointerenter', onEnter)
    iframe.addEventListener('pointerleave', onLeave)
    this._cleanupHover = () => {
      iframe.removeEventListener('pointerenter', onEnter)
      iframe.removeEventListener('pointerleave', onLeave)
      const world = this.ctx.world
      world.pointer?.setScreenHit?.(null)
    }

    content.appendChild(iframe)
    wrapper.appendChild(content)
    this._root?.appendChild(wrapper)

    this._wrapper = wrapper
    this._content = content
    this._iframe = iframe

    this._syncSizing()
    this._syncInteractivity()
  }

  _teardownDom() {
    if (this._cleanupHover) this._cleanupHover()
    this._cleanupHover = null

    if (this._wrapper) {
      try {
        this._wrapper.remove()
      } catch {}
    }
    this._wrapper = null
    this._content = null
    this._iframe = null
  }

  _applyIframeAttrs(iframe) {
    if (!iframe) return
    // url
    const url = this._url ? this.ctx.world.resolveURL(this._url) : null
    if (url) iframe.src = url

    // sandbox/referrer/allow
    if (this._sandbox) iframe.setAttribute('sandbox', this._sandbox)
    else iframe.removeAttribute('sandbox')

    if (this._referrerPolicy) iframe.setAttribute('referrerpolicy', this._referrerPolicy)
    else iframe.removeAttribute('referrerpolicy')

    if (this._allow) iframe.setAttribute('allow', this._allow)
    else iframe.removeAttribute('allow')
  }

  _syncInteractivity() {
    if (!this._content) return
    this._content.style.pointerEvents = this._interactive ? 'auto' : 'none'
  }

  _syncSizing() {
    if (!this._content) return
    const dpr = window.devicePixelRatio || 1
    const cssW = clamp(Math.round((this._width || defaults.width) * PX_PER_UNIT * dpr), MIN_PX, MAX_PX)
    const cssH = clamp(Math.round((this._height || defaults.height) * PX_PER_UNIT * dpr), MIN_PX, MAX_PX)

    this._content.style.width = cssW + 'px'
    this._content.style.height = cssH + 'px'

    const scaleX = (this._width || defaults.width) / cssW
    const scaleY = (this._height || defaults.height) / cssH
    const [ox, oy] = mapPivot(this._pivot)
    const tx = -ox * cssW
    const ty = -oy * cssH
    this._content.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`
    if (this._iframe) {
      this._iframe.style.display = this._visible ? 'block' : 'none'
    }
  }

  _syncTransform() {
    if (!this._wrapper) return
    if (this.ctx.world.xr?.isPresenting) {
      this._content.style.display = 'none'
      return
    } else if (this._visible) {
      this._content.style.display = 'block'
    }

    const stage = this.ctx.world.stage
    const rect = stage?.viewport?.getBoundingClientRect?.() || { height: window.innerHeight || 800 }
    const camera = this.ctx.world.camera

    const fov = (camera.fov * Math.PI) / 180
    const f = rect.height / (2 * Math.tan(fov / 2))

    // Update container perspective
    if (this._root) {
      this._root.style.perspective = f + 'px'
    }

    // Compose camera and object matrices
    const cameraCSS = getCameraCSSMatrix(camera.matrixWorldInverse)
    const objectCSS = getObjectCSSMatrix(this.matrixWorld)

    this._wrapper.style.transform = `translateZ(${f}px) ${cameraCSS} ${objectCSS}`
  }

  // ----- property accessors -----

  get url() {
    return this._url
  }
  set url(value = defaults.url) {
    if (value !== null && !isString(value)) throw new Error('[webviewer] url not null or string')
    if (this._url === value) return
    this._url = value
    if (this._iframe) this._applyIframeAttrs(this._iframe)
  }

  get width() {
    return this._width
  }
  set width(value = defaults.width) {
    if (!isNumber(value)) throw new Error('[webviewer] width not a number')
    if (this._width === value) return
    this._width = value
    this._syncSizing()
  }

  get height() {
    return this._height
  }
  set height(value = defaults.height) {
    if (!isNumber(value)) throw new Error('[webviewer] height not a number')
    if (this._height === value) return
    this._height = value
    this._syncSizing()
  }

  get pivot() {
    return this._pivot
  }
  set pivot(value = defaults.pivot) {
    if (!isPivot(value)) throw new Error(`[webviewer] pivot invalid: ${value}`)
    if (this._pivot === value) return
    this._pivot = value
    this._syncSizing()
  }

  get interactive() {
    return this._interactive
  }
  set interactive(value = defaults.interactive) {
    if (!isBoolean(value)) throw new Error('[webviewer] interactive not boolean')
    if (this._interactive === value) return
    this._interactive = value
    this._syncInteractivity()
  }

  get visible() {
    return this._visible
  }
  set visible(value = defaults.visible) {
    if (!isBoolean(value)) throw new Error('[webviewer] visible not boolean')
    if (this._visible === value) return
    this._visible = value
    this._syncSizing()
  }

  get sandbox() {
    return this._sandbox
  }
  set sandbox(value = defaults.sandbox) {
    if (value !== null && !isString(value)) throw new Error('[webviewer] sandbox not null or string')
    if (this._sandbox === value) return
    this._sandbox = value
    if (this._iframe) this._applyIframeAttrs(this._iframe)
  }

  get referrerPolicy() {
    return this._referrerPolicy
  }
  set referrerPolicy(value = defaults.referrerPolicy) {
    if (value !== null && !isString(value)) throw new Error('[webviewer] referrerPolicy not null or string')
    if (this._referrerPolicy === value) return
    this._referrerPolicy = value
    if (this._iframe) this._applyIframeAttrs(this._iframe)
  }

  get allow() {
    return this._allow
  }
  set allow(value = defaults.allow) {
    if (value !== null && !isString(value)) throw new Error('[webviewer] allow not null or string')
    if (this._allow === value) return
    this._allow = value
    if (this._iframe) this._applyIframeAttrs(this._iframe)
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get url() {
          return self.url
        },
        set url(value) {
          self.url = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get interactive() {
          return self.interactive
        },
        set interactive(value) {
          self.interactive = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
        },
        get sandbox() {
          return self.sandbox
        },
        set sandbox(value) {
          self.sandbox = value
        },
        get referrerPolicy() {
          return self.referrerPolicy
        },
        set referrerPolicy(value) {
          self.referrerPolicy = value
        },
        get allow() {
          return self.allow
        },
        set allow(value) {
          self.allow = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()))
      this.proxy = proxy
    }
    return this.proxy
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function isPivot(value) {
  return pivots.includes(value)
}

function mapPivot(pivot) {
  switch (pivot) {
    case 'top-left':
      return [0, 0]
    case 'top-center':
      return [0.5, 0]
    case 'top-right':
      return [1, 0]
    case 'center-left':
      return [0, 0.5]
    case 'center':
      return [0.5, 0.5]
    case 'center-right':
      return [1, 0.5]
    case 'bottom-left':
      return [0, 1]
    case 'bottom-center':
      return [0.5, 1]
    case 'bottom-right':
      return [1, 1]
    default:
      return [0.5, 0.5]
  }
}

// CSS3D matrix helpers (adapted from three.js CSS3DRenderer)
function epsilon(value) {
  return Math.abs(value) < 1e-10 ? 0 : value
}

function getCameraCSSMatrix(m) {
  const e = m.elements
  // flip Y for CSS coordinate system
  return (
    'matrix3d(' +
    [
      epsilon(e[0]),
      epsilon(-e[1]),
      epsilon(e[2]),
      epsilon(e[3]),
      epsilon(e[4]),
      epsilon(-e[5]),
      epsilon(e[6]),
      epsilon(e[7]),
      epsilon(e[8]),
      epsilon(-e[9]),
      epsilon(e[10]),
      epsilon(e[11]),
      epsilon(e[12]),
      epsilon(-e[13]),
      epsilon(e[14]),
      epsilon(e[15]),
    ].join(',') +
    ')'
  )
}

function getObjectCSSMatrix(m) {
  const e = m.elements
  return (
    'matrix3d(' +
    [
      epsilon(e[0]),
      epsilon(-e[1]),
      epsilon(e[2]),
      epsilon(e[3]),
      epsilon(e[4]),
      epsilon(-e[5]),
      epsilon(e[6]),
      epsilon(e[7]),
      epsilon(e[8]),
      epsilon(-e[9]),
      epsilon(e[10]),
      epsilon(e[11]),
      epsilon(e[12]),
      epsilon(-e[13]),
      epsilon(e[14]),
      epsilon(e[15]),
    ].join(',') +
    ')'
  )
}
