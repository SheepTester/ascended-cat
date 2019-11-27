// Not part of Ascended Cat Blocks; just a plugin that uses it to show
// the categories in a palette.

import { Elem, Fragment } from '../utils/elem.js'

class PaletteCategories {
  constructor (palette, elem) {
    this.palette = palette
    this.elem = elem
    this._categoryElems = {}
    this._highlighting = null
    this._updateCategories()

    elem.addEventListener('click', e => {
      if (e.target.classList.contains('block-category')) {
        const offset = palette.categoryOffsets
          .find(({ id }) => id === e.target.dataset.category)
        if (offset) {
          palette.scrollTo(palette.transform.left, offset.offset)
        }
      }
    })
    palette.on('scroll', ({ top }) => {
      const offsets = palette.categoryOffsets
      if (!offsets.length) return
      const index = offsets.findIndex(({ offset }) => offset > top)
      const category = index === -1 ? offsets[offsets.length - 1]
        : index === 0 ? offsets[0] : offsets[index - 1]
      const elem = this._categoryElems[category.id]
      if (elem !== this._highlighting) {
        if (this._highlighting) {
          this._highlighting.classList.remove('block-selected-category')
        }
        this._highlighting = elem
        elem.classList.add('block-selected-category')
      }
    })
    palette.on('update-block-order', this._updateCategories.bind(this))
    palette.blocks.on('language-change', this._updateLabels.bind(this))
  }

  _updateCategories () {
    // Remove all children
    while (this.elem.firstChild) this.elem.removeChild(this.elem.firstChild)

    const elems = this._categoryElems
    const categories = this.palette.blockOrder.map(({ id }) => id)
    // Remove categories that aren't listed anymore.
    for (const oldCategory of Object.keys(elems)) {
      if (!categories.includes(oldCategory)) {
        delete elems[oldCategory]
      }
    }
    // Add the category elements back in, creating them if they're new.
    this.elem.appendChild(Fragment(categories.map(category => {
      if (!elems[category]) {
        const elem = Elem('div', {
          className: 'block-category',
          data: { category }
        }, [this.palette.blocks.getTranslation(category)])
        elems[category] = elem
      }
      return elems[category]
    })))

    // Update the palette's rect because things.
    window.requestAnimationFrame(() => {
      this.palette.updateRect()
    })
  }

  _updateLabels () {
    for (const [category, elem] of Object.entries(this._categoryElems)) {
      elem.textContent = this.palette.blocks.getTranslation(category)
    }
  }
}

export { PaletteCategories }
