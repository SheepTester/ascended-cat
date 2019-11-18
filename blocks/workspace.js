// Relies on utils/elem, blocks/component

const numberInputKeys = /^[0-9e.\-]$/i

class Workspace {
  constructor (blocks, wrapper) {
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onStartScroll = this._onStartScroll.bind(this)
    this.acceptDrop = this.acceptDrop.bind(this)

    this.wrapper = wrapper
    this.scriptsElem = Elem('g', {class: 'block-scripts'}, [], true)
    this.svg = Elem('svg', {
      class: 'block-workspace',
      onwheel: e => {
        if (!e.altKey) {
          if (e.ctrlKey || e.metaKey) {
            // Zoom
          } else if (e.shiftKey) {
            this.scrollTo(this._transform.left + e.deltaY, this._transform.top + e.deltaX)
          } else {
            this.scrollTo(this._transform.left + e.deltaX, this._transform.top + e.deltaY)
          }
          e.preventDefault()
        }
      }
    }, [
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

    this._pointers = {}
    this.svg.addEventListener('pointerdown', this._onPointerDown)
    this.svg.addEventListener('pointermove', this._onPointerMove)
    this.svg.addEventListener('pointerup', this._onPointerUp)

    blocks.onDrag(this.svg, this._onStartScroll)
    blocks.onDrop(this.svg, {
      acceptDrop: this.acceptDrop
    })
  }

  acceptDrop (script, x, y) {
    this.add(script)
    script.setPosition(
      x - this.rect.x + this._transform.left,
      y - this.rect.y + this._transform.top
    )
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
  }

  _updateTransformation () {
    const {left, top, scale} = this._transform
    this.scriptsElem.setAttributeNS(null, 'transform', `scale(${scale}) translate(${-left}, ${-top})`)
    this._input.style.transform = `scale(${scale}) translate(${-left}px, ${-top}px)`
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
    } else if (pointerEntry.dragging) {
      if (pointerEntry.dragMove) {
        pointerEntry.dragMove(e.clientX, e.clientY)
      }
    } else if (this.constructor._pythagoreanMagic(
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

  /**
   * Compares the legs and hypotenuse
   */
  static _pythagoreanMagic(a, b, c) {
    return c * c - (a * a + b * b)
  }
}

Workspace.minDragDistance = 3

class PaletteSpace extends Component {
  constructor (height) {
    super()
    this.height = height
  }

  reposition () {
    this.measurements = {width: 0, height: this.height}
  }
}

class PaletteWorkspace extends Workspace {
  constructor (blocks, wrapper) {
    super(blocks, wrapper)

    // TEMP:
    const masterScript = blocks.createScript()
    for (const category of blocks.categories) {
      for (const blockData of category.blocks) {
        if (blockData[0] === '-') {
          masterScript.add(new PaletteSpace(10))
        } else {
          const block = blocks.createBlock(`${category.id}.${blockData.opcode}`)
          block.cloneOnDrag = true
          masterScript.add(block)
          masterScript.add(new PaletteSpace(10))
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
}
