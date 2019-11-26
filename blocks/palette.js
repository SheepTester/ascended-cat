import { Elem } from '../utils/elem.js'

import { NullCategory } from './constants.js'
import { ScriptsWorkspace } from './workspace.js'
import { Stack } from './scripts.js'
import { Block } from './block.js'
import { TextComponent, Component, Space } from './component.js'

class CategoryHeader extends Component {
  constructor (categoryID = NullCategory, label = '') {
    super()
    this.categoryID = categoryID

    this.elem.classList.add('block-category-header')
    this.elem.dataset.category = categoryID

    this.label = new TextComponent(label)
    this.add(this.label)

    this.line = Elem('path', { class: 'block-category-header-line' }, [], true)
    this.elem.appendChild(this.line)
  }

  reposition () {
    const { width, height } = this.label.measurements
    const { paddingBefore, paddingAfter, totalLinePadding } = CategoryHeader.renderOptions
    const centre = paddingBefore + height / 2
    this.label.setPosition(totalLinePadding, centre)
    this.line.setAttributeNS(null, 'transform', `translate(0, ${centre})`)
    this.measurements = {
      width: width + totalLinePadding * 2,
      height: paddingBefore + height + paddingAfter
    }
    this._textWidth = width
    this.trigger('reposition', this.measurements)
  }

  setLineLength (maxWidth) {
    const { lineMinLength, linePadding, totalLinePadding } = CategoryHeader.renderOptions
    const path = `M0 0 H${lineMinLength} M${totalLinePadding + this._textWidth +
      linePadding} 0 H${maxWidth}`
    this.line.setAttributeNS(null, 'd', path)
  }
}

CategoryHeader.renderOptions = {
  paddingBefore: 15,
  paddingAfter: 5,
  lineMinLength: 10,
  linePadding: 5,
  get totalLinePadding () {
    return this.lineMinLength + this.linePadding
  }
}

class PaletteStack extends Stack {
  constructor () {
    super()

    this.categoryOffsets = null
  }

  reposition () {
    const categoryOffsets = []
    let maxWidth = 0
    let y = 0
    let lastComponent
    for (const component of this.components) {
      // In case new components were added during the measuring process (their
      // `measurements` will be `null`), they should be ignored until they are
      // later reprocessed.
      if (!component.visible || !component.measurements) continue

      if (lastComponent instanceof Block && component instanceof Block) {
        y += PaletteStack.blockSpace
      }
      component.setPosition(0, y)
      if (component instanceof CategoryHeader) {
        categoryOffsets.push({
          header: component,
          id: component.id,
          offset: y
        })
      }
      y += component.measurements.height
      if (component.measurements.width > maxWidth) {
        maxWidth = component.measurements.width
      }
      lastComponent = component
    }
    this.measurements = { width: maxWidth, height: y }
    for (const { header } of categoryOffsets) {
      header.setLineLength(this.measurements.width)
    }
    this.categoryOffsets = categoryOffsets
    this.trigger('reposition', this.measurements)
  }
}

PaletteStack.blockSpace = 10

PaletteStack.separatorSpace = 10

PaletteStack.padding = 10
PaletteStack.vertPadding = -5

// To leave space for the scroll bar
PaletteStack.extraRightPadding = 15

class PaletteWorkspace extends ScriptsWorkspace {
  constructor (blocks, wrapper, initBlockOrder) {
    super(blocks, wrapper)

    this._list = new PaletteStack()
    this._list.setPosition(PaletteStack.padding, PaletteStack.vertPadding)
    this.add(this._list)
    this._blocks = {}

    this.blockOrder = initBlockOrder
    this.updateBlockOrder()
    this.filter()
  }

  updateBlockOrder () {
    const blocks = this.blocks
    const blockOrder = this.blockOrder
    const list = this._list
    const oldBlocks = this._blocks
    const newBlocks = {}
    const filters = {}
    list.clear()
    for (const { id, blocks: items = [] } of blockOrder) {
      list.add(new CategoryHeader(id, blocks.getTranslation(id) || id))
      for (const item of items) {
        if (!item) continue
        if (item[0] === '-') {
          // Separator
          list.add(new Space(PaletteStack.separatorSpace))
        } else {
          const { opcode, filter = null } = item
          const blockOpcode = `${id}.${opcode}`
          if (oldBlocks[blockOpcode]) {
            newBlocks[blockOpcode] = oldBlocks[blockOpcode]
            delete oldBlocks[blockOpcode]
          } else {
            const block = blocks.createBlock(blockOpcode)
            block.cloneOnDrag = true
            newBlocks[blockOpcode] = block
          }
          list.add(newBlocks[blockOpcode])
          filters[blockOpcode] = filter
        }
      }
    }
    for (const block of Object.values(oldBlocks)) {
      block.destroy()
    }
    this._blocks = newBlocks
    this._filters = filters
    return this
  }

  /**
   * Only shows blocks whose filter tags have all of the specified filters
   */
  filter (filters = []) {
    for (const blockOpcode of Object.keys(this._blocks)) {
      const blockFilter = this._filters[blockOpcode]
      const block = this._blocks[blockOpcode]
      if (!blockFilter || filters.every(filter => blockFilter.includes(filter))) {
        block.visible = true
      } else {
        block.visible = false
      }
    }
    return this._list.resize()
  }

  recalculateScrollBounds () {
    if (!this.rect || !this._list.measurements) return
    const padding = PaletteStack.padding * 2 + PaletteStack.extraRightPadding
    const categoryOffsets = this._list.categoryOffsets
    this._scrollBounds = {
      minX: 0,
      minY: 0,
      maxX: Math.max(this._list.measurements.width + padding, this.rect.width),
      maxY: Math.max(
        this._list.measurements.height + padding,
        // Add extra scrolling space to the bottom of the last category so
        // when we add scrolling to categories, it can show just that last
        // category (like Scratch 3.0).
        categoryOffsets.length
          ? categoryOffsets[categoryOffsets.length - 1].offset +
            this.rect.height + PaletteStack.vertPadding
          : this.rect.height
      )
    }
    this.trigger('scroll-bounds', this._scrollBounds)
  }

  acceptDrop (script, x, y) {
    script.destroy()
  }

  getStackBlockConnections () {
    return []
  }

  getReporterConnections (block) {
    return []
  }
}

export { PaletteWorkspace }
