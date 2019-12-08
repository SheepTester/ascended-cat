import { Elem } from '../utils/elem.js'
import { pythagoreanCompare } from '../utils/math.js'
import { Newsletter } from '../utils/newsletter.js'

import { Input } from './input.js'
import { Block, getIndicesOf } from './block.js'
import { Stack } from './scripts.js'
import { Scrollbar } from './scrollbar.js'

const numberInputKeys = /^[0-9e.,-]$/i

class Workspace extends Newsletter {
  constructor (blocks, wrapper) {
    super()

    this.wrapper = wrapper
    wrapper.classList.add('block-workspace-wrapper')
    this.scriptsElem = Elem('g', { class: 'block-scripts' }, [], true)
    this.svg = Elem('svg', { class: 'block-workspace' }, [
      Elem('defs', {}, [
        // https://stackoverflow.com/questions/9630008/how-can-i-create-a-glow-around-a-rectangle-with-svg
        Elem('filter', {
          id: 'block-snap-glow',
          x: '-30%',
          y: '-30%',
          width: '160%',
          height: '160%'
        }, [
          Elem('feGaussianBlur', {
            stdDeviation: 3,
            result: 'blur'
          }, [], true),
          // https://codepen.io/dipscom/pen/mVYjPw
          Elem('feFlood', {
            'flood-color': 'white',
            result: 'colour'
          }, [], true),
          Elem('feComposite', {
            in: 'colour',
            in2: 'blur',
            operator: 'in',
            result: 'colouredBlur'
          }, [], true),
          Elem('feMerge', {}, [
            Elem('feMergeNode', { in: 'colouredBlur' }, [], true),
            Elem('feMergeNode', { in: 'SourceGraphic' }, [], true)
          ], true)
        ], true)
      ], true),
      this.scriptsElem
    ], true)
    wrapper.appendChild(this.svg)
    this._input = Elem('input', {
      className: 'block-input block-input-elem block-hidden',
      oninput: () => {
        if (this._showingInput && this._showingInput.on.change) {
          this._showingInput.on.change(this._input.value)
        }
      },
      onkeypress: e => {
        if (this._showingInput && this._showingInput.number) {
          if (!numberInputKeys.test(e.key)) {
            e.preventDefault()
          }
        }
      },
      onkeydown: e => {
        if (e.key === 'Tab' && !(e.ctrlKey || e.metaKey || e.altKey)) {
          if (this._showingInput && this._showingInput.on.tab) {
            const nextInput = this._showingInput.on.tab(!e.shiftKey)
            if (nextInput) {
              nextInput.considerShowingInput()
              e.preventDefault()
            }
          }
        }
      }
    })
    wrapper.appendChild(this._input)

    this.blocks = blocks
    this.scripts = []
    this._transform = { left: 0, top: 0, scale: 1 }
    this._recallMoveEvents = true

    this._pointers = {}
    wrapper.addEventListener('pointerdown', this._onPointerDown.bind(this))
    wrapper.addEventListener('pointermove', this._onPointerMove.bind(this))
    wrapper.addEventListener('pointerup', this._onPointerUp.bind(this))
    wrapper.addEventListener('pointercancel', this._onPointerUp.bind(this))
    wrapper.addEventListener('wheel', e => {
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.shiftKey) {
          this.scrollTo(this._transform.left + e.deltaY, this._transform.top + e.deltaX)
        } else {
          this.scrollTo(this._transform.left + e.deltaX, this._transform.top + e.deltaY)
        }
        e.preventDefault()
      }
    })

    blocks.onDrag(this.wrapper, this._onStartScroll.bind(this))
    blocks.onDrop(this.wrapper, this)
  }

  dropBlocks ({ script, x, y, snapTo, wrappingC }) {
    if (snapTo) {
      if (snapTo instanceof Input) {
        return { indices: getIndicesOf(snapTo) }
      } else if (snapTo.insertBefore) {
        if (wrappingC) {
          const firstBranch = script.components[0].components
            .find(component => component instanceof Stack)
          return {
            indices: getIndicesOf(snapTo.insertBefore),
            dx: snapTo.beforeScript ? -firstBranch.position.x : 0,
            dy: snapTo.beforeScript ? -firstBranch.position.y : 0,
            // Referencing by param ID in case the language changes
            branchAround: script.components[0].getParamID(firstBranch)
          }
        } else {
          return {
            indices: getIndicesOf(snapTo.insertBefore),
            dy: snapTo.beforeScript ? -script.measurements.height : 0
          }
        }
      } else if (snapTo.after) {
        return {
          indices: [
            ...getIndicesOf(snapTo.in),
            snapTo.in.components.length
          ]
        }
      }
    } else {
      return {
        workspace: this,
        index: this.scripts.length,
        x: (x - this.rect.x + this._transform.left) / this._transform.scale,
        y: (y - this.rect.y + this._transform.top) / this._transform.scale
      }
    }
  }

  hideInput () {
    if (this._showingInput && this._showingInput.on.hide) {
      this._showingInput.on.hide(this._input)
    }
    this._showingInput = null
    this._input.classList.add('block-hidden')
  }

  showInput (listeners, isNumber) {
    if (this._showingInput) {
      this.hideInput()
    }
    this._showingInput = {
      on: listeners,
      number: isNumber
    }
    this._input.classList.remove('block-hidden')
    this._input.focus()
    return this._input
  }

  add (script, beforeIndex = this.scripts.length) {
    if (!(script instanceof Stack)) {
      throw new Error('wucky: Workspaces are picky and only want Stacks.')
    }
    if (script.workspace) {
      script.removeFromWorkspace()
    }
    if (beforeIndex < this.scripts.length) {
      this.scriptsElem.insertBefore(script.elem, this.scripts[beforeIndex].elem)
    } else {
      this.scriptsElem.appendChild(script.elem)
    }
    this.scripts.splice(beforeIndex, 0, script)
    script.workspace = this
    return script
  }

  _updateTransformation () {
    const { left, top, scale } = this._transform
    this.scriptsElem.setAttributeNS(null, 'transform', `translate(${-left}, ${-top}) scale(${scale})`)
    this._input.style.transform = `translate(${-left}px, ${-top}px) scale(${scale})`
    if (this._recallMoveEvents) {
      // Prevent the move event listeners from being recursively called
      this._recallMoveEvents = false
      for (const { lastMoveEvent, dontRefireOnScroll } of Object.values(this._pointers)) {
        if (!dontRefireOnScroll) {
          this._onPointerMove(lastMoveEvent)
        }
      }
      this._recallMoveEvents = true
    }
    this.trigger('scroll', { left, top, scale })
  }

  scrollTo (left, top) {
    this._transform.left = left
    this._transform.top = top
    this._updateTransformation()
  }

  zoomTo (scale) {
    this._transform.scale = scale
    this._updateTransformation()
  }

  get transform () {
    const { left, top, scale } = this._transform
    return { left, top, scale }
  }

  _onStartScroll (initX, initY) {
    if (this._scrolling) return
    const { left: initLeft, top: initTop } = this._transform
    this._scrolling = true
    return {
      move: (x, y) => {
        this.scrollTo(initLeft + initX - x, initTop + initY - y)
      },
      end: () => {
        this._scrolling = false
      },
      dontRefireOnScroll: true
    }
  }

  _onPointerDown (e) {
    if (this._pointers[e.pointerId]) return
    this._pointers[e.pointerId] = {
      elem: e.target,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      lastMoveEvent: e
    }
  }

  _onPointerMove (e) {
    const pointerEntry = this._pointers[e.pointerId]
    if (!pointerEntry) {
      return
    }
    pointerEntry.lastMoveEvent = e
    if (pointerEntry.dragging) {
      if (pointerEntry.dragMove) {
        pointerEntry.dragMove(e.clientX, e.clientY)
      }
    } else if (pythagoreanCompare(
      e.clientX - pointerEntry.startX,
      e.clientY - pointerEntry.startY,
      Workspace.minDragDistance
    ) < 0) {
      pointerEntry.dragging = true
      const dragElem = pointerEntry.elem.closest('[data-block-drag]')
      if (dragElem) {
        const listener = this.blocks.dragListeners[dragElem.dataset.blockDrag]
        const dragListeners = listener(pointerEntry.startX, pointerEntry.startY)
        if (dragListeners) {
          pointerEntry.dragMove = dragListeners.move
          pointerEntry.dragEnd = dragListeners.end
          pointerEntry.dontRefireOnScroll = dragListeners.dontRefireOnScroll
          this.wrapper.setPointerCapture(e.pointerId)
        }
      }
    }
  }

  _onPointerUp (e) {
    const pointerEntry = this._pointers[e.pointerId]
    if (!pointerEntry) {
      return
    } else if (pointerEntry.dragging) {
      if (pointerEntry.dragEnd) {
        pointerEntry.dragEnd()
      }
    } else {
      const clickElem = pointerEntry.elem.closest('[data-block-click]')
      if (clickElem) {
        const isTouch = e.pointerType === 'touch'
        this.blocks.clickListeners[clickElem.dataset.blockClick](isTouch)
      }
    }
    delete this._pointers[e.pointerId]
  }

  getAllInputs () {
    const arr = []
    for (const script of this.scripts) {
      script.storeAllInputsIn(arr)
    }
    return arr
  }

  updateRect () {
    const { left, top, width, height } = this.wrapper.getBoundingClientRect()
    this.rect = { x: left, y: top, width, height }
    this.trigger('rect-update', this.rect)
  }

  getStackBlockConnections () {
    const arr = []
    for (const script of this.scripts) {
      arr.push(...script.getStackBlockConnections(this.blocks.dir === 'rtl')
        .map(([x, y, data]) => [
          x + script.position.x,
          y + script.position.y,
          data
        ]))
    }
    return arr
  }

  getReporterConnections (block) {
    const arr = []
    for (const script of this.scripts) {
      arr.push(...script.getReporterConnections(block)
        .map(([x, y, data]) => [
          x + script.position.x,
          y + script.position.y,
          data
        ]))
    }
    return arr
  }

  resizeAll (force = false) {
    return Promise.all(this.scripts.map(script => script.resize(force)))
  }

  toJSON () {
    return this.scripts.map(script => script.toJSON())
  }
}

Workspace.minDragDistance = 3

class ScriptsWorkspace extends Workspace {
  constructor (blocks, wrapper) {
    super(blocks, wrapper)
    this.updateScroll = this.updateScroll.bind(this)

    this._scrollBounds = null
    this._horizScrollbar = new Scrollbar(this, true)
    this._vertScrollbar = new Scrollbar(this, false)
  }

  /**
   * Get the bounding box of all the scripts in the workspace to determine the
   * minimum scrolling area.
   */
  recalculateScrollBounds () {
    if (!this.rect) return
    const scale = this.transform.scale
    const { width, height } = this.rect
    let minX = 0
    let minY = 0
    let maxX = 0
    let maxY = 0
    for (const script of this.scripts) {
      if (!script.measurements) continue
      const { x, y } = script.position
      const { width, height } = script.measurements
      if (y < minY) minY = y
      if (y + height > maxY) maxY = y + height
      if (this.blocks.dir === 'rtl') {
        if (x - width < minX) minX = x - width
        if (x > maxX) maxX = x
      } else {
        if (x < minX) minX = x
        if (x + width > maxX) maxX = x + width
      }
    }
    minX *= scale
    maxX *= scale
    minY *= scale
    maxY *= scale
    const padding = ScriptsWorkspace.padding
    const scrollPadding = ScriptsWorkspace.scrollPadding
    minY -= padding
    maxY = Math.max(maxY + scrollPadding, minY + height)
    if (this.blocks.dir === 'rtl') {
      // Reverse of LTR, ish; only doing X in the if/else because RTL
      // flips horizontally.
      maxX += scrollPadding
      minX = Math.min(minX - padding, maxX - width)
    } else {
      minX -= padding
      // If the maxX + padding will make the scroll width shorter than the
      // viewable width, then use the viewable width instead as the scroll width.
      maxX = Math.max(maxX + scrollPadding, minX + width)
    }
    this._scrollBounds = { minX, minY, maxX, maxY }
    this.trigger('scroll-bounds', this._scrollBounds)
  }

  add (script, beforeIndex) {
    super.add(script, beforeIndex)
    this._scrollBounds = null
    this.updateScroll()
    const onWorkspaceRemove = () => {
      script.off('reposition', this.updateScroll)
      script.off('workspace-remove', onWorkspaceRemove)
      this.updateScroll()
    }
    script.on('reposition', this.updateScroll)
    script.on('workspace-remove', onWorkspaceRemove)
  }

  scrollTo (left, top) {
    if (!this._scrollBounds) {
      this.recalculateScrollBounds()
    }
    if (!this._scrollBounds) {
      return
    }
    const { width, height } = this.rect
    const { minX, minY, maxX, maxY } = this._scrollBounds
    if (left < minX) {
      left = minX
    } else if (left > maxX - width) {
      left = maxX - width
    }
    if (top < minY) {
      top = minY
    } else if (top > maxY - height) {
      top = maxY - height
    }
    super.scrollTo(left, top)
  }

  zoomTo (scale) {
    super.zoomTo(scale)
    Promise.resolve()
      .then(() => {
        this.updateScroll()
      })
  }

  updateScroll () {
    if (!this._willUpdateScroll) {
      this._willUpdateScroll = Promise.resolve()
        .then(() => {
          this._willUpdateScroll = null
          this._scrollBounds = null
          const { left, top } = this.transform
          this.scrollTo(left, top)
        })
    }
  }

  updateRect () {
    super.updateRect()
    Promise.resolve()
      .then(() => {
        this.updateScroll()
      })
  }

  flip (newDir) {
    for (const script of this.scripts) {
      const { x, y } = script.position
      script.setPosition(-x, y)
    }
  }
}

ScriptsWorkspace.padding = 10
ScriptsWorkspace.scrollPadding = 25

export { Workspace, ScriptsWorkspace }
