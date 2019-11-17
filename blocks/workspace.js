// Relies on utils/elem

class Workspace {
  constructor (blocks, wrapper) {
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onStartScroll = this._onStartScroll.bind(this)

    this.blocks = blocks
    this.scripts = []

    this.wrapper = wrapper
    this.scriptsElem = Elem('g', {class: 'block-scripts'}, [], true)
    this.svg = Elem('svg', {class: 'block-workspace'}, [
      this.scriptsElem
    ], true)
    wrapper.appendChild(this.svg)
    this.scrollTo(0, 0)

    this._pointers = {}
    this.svg.addEventListener('pointerdown', this._onPointerDown)
    this.svg.addEventListener('pointermove', this._onPointerMove)
    this.svg.addEventListener('pointerup', this._onPointerUp)

    blocks.onDrag(this.svg, this._onStartScroll)
  }

  add (script) {
    this.scripts.push(script)
    this.scriptsElem.appendChild(script.elem)
  }

  scrollTo (left, top) {
    this.scriptsElem.setAttributeNS(null, 'transform', `translate(${-left}, ${-top})`)
    this.scrollPosition = {left, top}
  }

  _onStartScroll (initX, initY) {
    const {left: initLeft, top: initTop} = this.scrollPosition
    return {
      move: (x, y) => {
        this.scrollTo(initLeft + initX - x, initTop + initY - y)
      }
    }
  }

  _onPointerDown (e) {
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
        const {move, end} = listener(pointerEntry.startX, pointerEntry.startY)
        pointerEntry.dragMove = move
        pointerEntry.dragEnd = end
        this.svg.setPointerCapture(e.pointerId)
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

  /**
   * Compares the legs and hypotenuse
   */
  static _pythagoreanMagic(a, b, c) {
    return c * c - (a * a + b * b)
  }
}

Workspace.minDragDistance = 3

class PaletteWorkspace {
  constructor () {
    // TODO
  }
}
