// Relies on utils/elem, blocks/component, utils/math, blocks/scripts, blocks/input,
// blocks/block

import {Elem} from '../utils/elem.js'
import {pythagoreanCompare} from '../utils/math.js'

import {Input} from './input.js'
import {Block} from './block.js'
import {Stack} from './scripts.js'
import {Space} from './component.js'

const numberInputKeys = /^[0-9e.\-]$/i

class Workspace {
  constructor (blocks, wrapper) {
    this.wrapper = wrapper
    this.scriptsElem = Elem('g', {class: 'block-scripts'}, [], true)
    this.svg = Elem('svg', {
      class: 'block-workspace',
      onwheel: e => {
        if (!e.altKey && !e.ctrlKey && !e.metaKey) {
          if (e.shiftKey) {
            this.scrollTo(this._transform.left + e.deltaY, this._transform.top + e.deltaX)
          } else {
            this.scrollTo(this._transform.left + e.deltaX, this._transform.top + e.deltaY)
          }
          e.preventDefault()
        }
      }
    }, [
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
            Elem('feMergeNode', {in: 'colouredBlur'}, [], true),
            Elem('feMergeNode', {in: 'SourceGraphic'}, [], true)
          ], true)
        ], true)
      ], true),
      this.scriptsElem
    ], true)
    wrapper.appendChild(this.svg)
    this._input = Elem('input', {
      className: 'block-input block-hidden',
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
    this._transform = {left: 0, top: 0, scale: 1}
    this._recallMoveEvents = true

    this._pointers = {}
    this.svg.addEventListener('pointerdown', this._onPointerDown.bind(this))
    this.svg.addEventListener('pointermove', this._onPointerMove.bind(this))
    this.svg.addEventListener('pointerup', this._onPointerUp.bind(this))

    blocks.onDrag(this.svg, this._onStartScroll.bind(this))
    blocks.onDrop(this.svg, {
      acceptDrop: this.acceptDrop.bind(this),
      getStackBlockConnections: this.getStackBlockConnections.bind(this),
      getReporterConnections: this.getReporterConnections.bind(this),
      getRect: () => {
        return this.rect
      },
      getTransform: this.getTransform.bind(this)
    })
  }

  acceptDrop (script, x, y, snapTo, wrappingC) {
    if (snapTo) {
      if (snapTo instanceof Input) {
        const oldValue = snapTo.getValue()
        if (oldValue instanceof Block) {
          // NOTE: Scratch puts it on the right of the script, vertically
          // in the middle.
          const offset = Input.renderOptions.popOutOffset
          const {x, y} = oldValue.getWorkspaceOffset()
          snapTo.insertBlock(null)
          const script = this.blocks.createScript()
          script.setPosition(x + offset, y + offset)
          script.add(oldValue)
          this.add(script)
        }
        snapTo.insertBlock(script.components[0])
        snapTo.resize()
        return
      } else if (snapTo.insertBefore) {
        const index = snapTo.in.components.indexOf(snapTo.insertBefore)
        if (wrappingC) {
          const firstLoop = script.components[0].components
            .find(component => component instanceof Stack)
          const blocksInserted = script.components.length
          while (script.components.length) {
            const component = script.components[script.components.length - 1]
            script.remove(component)
            snapTo.in.add(component, index)
          }
          while (snapTo.in.components[blocksInserted + index]) {
            const component = snapTo.in.components[blocksInserted + index]
            snapTo.in.remove(component)
            firstLoop.add(component)
          }
          if (snapTo.beforeScript) {
            snapTo.in.setPosition(
              snapTo.in.position.x - firstLoop.position.x,
              snapTo.in.position.y - firstLoop.position.y
            )
          }
          firstLoop.resize()
        } else {
          // Prepend each component in the script from bottom to top
          // to the insert index of the target script.
          while (script.components.length) {
            const component = script.components[script.components.length - 1]
            script.remove(component)
            snapTo.in.add(component, index)
          }
          // Shift the target script up so it looks like they were merged
          // rather than inserted if this was a prepending.
          if (snapTo.beforeScript) {
            snapTo.in.setPosition(
              snapTo.in.position.x,
              snapTo.in.position.y - script.measurements.height
            )
          }
        }
      } else if (snapTo.after) {
        // Append each component in the script from top to bottom
        // to the end of the target script.
        while (script.components.length) {
          const component = script.components[0]
          script.remove(component)
          snapTo.in.add(component)
        }
      }
      snapTo.in.resize()
    } else {
      this.add(script)
      script.setPosition(
        x - this.rect.x + this._transform.left,
        y - this.rect.y + this._transform.top
      )
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

  add (script) {
    script.workspace = this
    this.scripts.push(script)
    this.scriptsElem.appendChild(script.elem)
    return script
  }

  _updateTransformation () {
    const {left, top, scale} = this._transform
    this.scriptsElem.setAttributeNS(null, 'transform', `scale(${scale}) translate(${-left}, ${-top})`)
    this._input.style.transform = `scale(${scale}) translate(${-left}px, ${-top}px)`
    if (this._recallMoveEvents) {
      // Prevent the move event listeners from being recursively called
      this._recallMoveEvents = false
      for (const {lastMoveEvent} of Object.values(this._pointers)) {
        this._onPointerMove(lastMoveEvent)
      }
      this._recallMoveEvents = true
    }
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

  getTransform () {
    const {left, top, scale} = this._transform
    return {left, top, scale}
  }

  _onStartScroll (initX, initY) {
    if (this._scrolling) return
    const {left: initLeft, top: initTop, scale: initScale} = this._transform
    this._scrolling = true
    return {
      move: (x, y) => {
        // Should also notify the dragged blocks to recalculate their snappables
        this.scrollTo(
          initLeft + initX / initScale - x / this._transform.scale,
          initTop + initY / initScale - y / this._transform.scale
        )
      },
      end: () => {
        this._scrolling = false
      }
    }
  }

  _onPointerDown (e) {
    if (this._pointers[e.pointerId]) return
    this._pointers[e.pointerId] = {
      elem: e.target,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false
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
      this.constructor.minDragDistance
    ) < 0) {
      pointerEntry.dragging = true
      const dragElem = pointerEntry.elem.closest('[data-block-drag]')
      if (dragElem) {
        const listener = this.blocks.dragListeners[dragElem.dataset.blockDrag]
        const dragListeners = listener(pointerEntry.startX, pointerEntry.startY)
        if (dragListeners) {
          pointerEntry.dragMove = dragListeners.move
          pointerEntry.dragEnd = dragListeners.end
          this.svg.setPointerCapture(e.pointerId)
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
        this.blocks.clickListeners[clickElem.dataset.blockClick]()
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
    const {left, top, width, height} = this.svg.getBoundingClientRect()
    this.rect = {x: left, y: top, width, height}
  }

  getStackBlockConnections () {
    const arr = []
    for (const script of this.scripts) {
      arr.push(...script.getStackBlockConnections()
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

  toJSON () {
    return this.scripts.map(script => script.toJSON())
  }
}

Workspace.minDragDistance = 3

class PaletteWorkspace extends Workspace {
  constructor (blocks, wrapper) {
    super(blocks, wrapper)

    const masterScript = new Stack()
    for (const category of blocks.categories) {
      for (const blockData of category.blocks) {
        if (blockData[0] === '-') {
          masterScript.add(new Space(10))
        } else {
          const block = blocks.createBlock(`${category.id}.${blockData.opcode}`)
          block.cloneOnDrag = true
          masterScript.add(block)
          masterScript.add(new Space(10))
        }
      }
    }
    this.add(masterScript)
    masterScript.setPosition(10, 10)
    masterScript.resize()
    this.list = masterScript
  }

  scrollTo (left, top) {
    super.scrollTo(0, Math.max(Math.min(top, this.list.measurements.height), 0))
  }

  acceptDrop (script, x, y) {
    // Delete by doing nothing!
  }

  getStackBlockConnections () {
    return []
  }

  getReporterConnections (block) {
    return []
  }
}

export {Workspace, PaletteWorkspace}
