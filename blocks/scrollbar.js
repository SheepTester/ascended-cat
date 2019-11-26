import { Elem } from '../utils/elem.js'

class Scrollbar {
  constructor (workspace, horizontal = false) {
    this.workspace = workspace
    this.horizontal = horizontal
    this._scrollBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    this.elem = Elem('rect', { class: 'block-scrollbar' }, [], true)
    if (horizontal) {
      this.elem.classList.add('block-scrollbar-horizontal')
    } else {
      this.elem.classList.add('block-scrollbar-vertical')
    }
    this.updateScrollbar()
    workspace.svg.appendChild(this.elem)

    workspace.on('rect-update', rect => {
      if (horizontal) {
        this.elem.style.setProperty('--window', rect.height + 'px')
      } else {
        this.elem.style.setProperty('--window', rect.width + 'px')
      }
    })
    workspace.on('scroll-bounds', scrollBounds => {
      this._scrollBounds = scrollBounds
    })
    workspace.on('scroll', transform => {
      this.updateScrollbar()
    })

    workspace.blocks.onDrag(this.elem, this._onDrag.bind(this))
  }

  updateScrollbar () {
    if (!this.workspace.rect || !this.workspace.transform) return
    let offset, range
    if (this.horizontal) {
      const { minX, maxX } = this._scrollBounds
      const { width } = this.workspace.rect
      const { left } = this.workspace.transform
      const scrollWidth = Math.max(maxX, width) - minX
      offset = (left - minX) / scrollWidth
      range = width / scrollWidth
    } else {
      const { minY, maxY } = this._scrollBounds
      const { height } = this.workspace.rect
      const { top } = this.workspace.transform
      const scrollHeight = Math.max(maxY, height) - minY
      offset = (top - minY) / scrollHeight
      range = height / scrollHeight
    }
    this.elem.style.setProperty('--offset', offset * 100 + '%')
    this.elem.style.setProperty('--range', range * 100 + '%')
  }

  _onDrag (initMouseX, initMouseY) {
    return {
      move: (x, y) => {
        //
      },
      end: () => {
        //
      }
    }
  }
}

export { Scrollbar }
