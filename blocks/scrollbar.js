import { Elem } from '../utils/elem.js'

class Scrollbar {
  constructor (workspace, horizontal = false) {
    this.workspace = workspace
    this.horizontal = horizontal
    this.elem = Elem('div', { className: 'block-scrollbar-wrapper' }, [
      Elem('div', { className: 'block-scrollbar' })
    ])
    if (horizontal) {
      this.elem.classList.add('block-scrollbar-horizontal')
    } else {
      this.elem.classList.add('block-scrollbar-vertical')
    }
    workspace.wrapper.appendChild(this.elem)

    this._scrollBounds = null
    workspace.on('scroll-bounds', scrollBounds => {
      this._scrollBounds = scrollBounds
    })

    this.updateScrollbar()
    workspace.on('scroll', transform => {
      this.updateScrollbar()
    })

    workspace.blocks.onDrag(this.elem, this._onDrag.bind(this))
  }

  updateScrollbar () {
    if (!this.workspace.rect || !this.workspace.transform || !this._scrollBounds) {
      return
    }
    let offset
    let range
    if (this.horizontal) {
      const { minX, maxX } = this._scrollBounds
      const { width } = this.workspace.rect
      const { left } = this.workspace.transform
      const scrollWidth = maxX - minX
      offset = (left - minX) / scrollWidth
      range = width / scrollWidth
      this._cssPxToScroll = (scrollWidth - width) / ((1 - range) * width)
    } else {
      const { minY, maxY } = this._scrollBounds
      const { height } = this.workspace.rect
      const { top } = this.workspace.transform
      const scrollHeight = maxY - minY
      offset = (top - minY) / scrollHeight
      range = height / scrollHeight
      this._cssPxToScroll = (scrollHeight - height) / ((1 - range) * height)
    }
    if (range === 1) {
      this.elem.classList.add('block-no-scroll')
    } else {
      this.elem.style.setProperty('--offset', offset * 100 + '%')
      this.elem.style.setProperty('--range', range * 100 + '%')
      this.elem.classList.remove('block-no-scroll')
    }
  }

  _onDrag (initMouseX, initMouseY) {
    this.elem.classList.add('dragging')
    const cssPxToScroll = this._cssPxToScroll
    const initScroll = this.horizontal
      ? this.workspace.transform.left
      : this.workspace.transform.top
    const initPos = this.horizontal ? initMouseX : initMouseY
    return {
      move: (x, y) => {
        const pos = this.horizontal ? x : y
        const scroll = (pos - initPos) * cssPxToScroll + initScroll
        if (this.horizontal) {
          this.workspace.scrollTo(scroll, this.workspace.transform.top)
        } else {
          this.workspace.scrollTo(this.workspace.transform.left, scroll)
        }
      },
      end: () => {
        this.elem.classList.remove('dragging')
      }
    }
  }
}

export { Scrollbar }
