import { Component } from './component.js'
import { Block } from './block.js'
import { BlockType } from './constants.js'

class Stack extends Component {
  constructor (initBlocks = []) {
    super()
    for (const block of initBlocks) {
      this.add(block)
    }
  }

  reposition () {
    let maxWidth = 0
    let y = 0
    for (const block of this.components) {
      block.setPosition(0, y)
      y += block.measurements.height
      if (block.measurements.width > maxWidth) {
        maxWidth = block.measurements.width
      }
    }
    this.measurements = { width: maxWidth, height: y }
    this.trigger('reposition', this.measurements)
  }

  /**
   * Stack block connections are just the rough locations of each notch.
   */
  getStackBlockConnections (rtl) {
    const dir = rtl ? -1 : 1
    const blocks = this.components.filter(block => block instanceof Block)
    const { branchWidth, notchX } = Block.renderOptions
    if (!blocks.length) {
      return [[notchX * dir, 0, { after: true, in: this }]]
    }
    const arr = []
    for (const block of blocks) {
      if (block.blockData.blockType === BlockType.COMMAND && !block.blockData.hat) {
        arr.push([notchX * dir, block.position.y, { insertBefore: block, in: this }])
      }
      for (const component of block.components) {
        if (component instanceof Stack) {
          arr.push(...component.getStackBlockConnections(rtl)
            .map(([x, y, data]) => [
              x + branchWidth * dir,
              block.position.y + component.position.y + y,
              data
            ]))
        }
      }
    }
    if (blocks[blocks.length - 1].blockData.blockType === BlockType.COMMAND &&
      !blocks[blocks.length - 1].blockData.terminal) {
      arr.push([notchX * dir, this.measurements.height, { after: true, in: this }])
    }
    return arr
  }

  /**
   * Reporter connections are vertically the centre of the block but
   * horizontally on the left.
   */
  getReporterConnections (block) {
    const arr = []
    for (const component of this.components) {
      if (component instanceof Block) {
        arr.push(...component.getReporterConnections(block)
          .map(([x, y, data]) => [x + component.position.x, y + component.position.y, data]))
      }
    }
    return arr
  }
}

/**
 * Autodeletes when the last block is removed.
 */
class Script extends Stack {
  constructor (blocks, initBlocks) {
    super(initBlocks)
    this.blocks = blocks
    this._onClick = this._onClick.bind(this)
    blocks.onClick(this.elem, this._onClick)
  }

  add (component, beforeIndex) {
    if (component instanceof Block) {
      return super.add(component, beforeIndex)
    } else {
      throw new Error('wucky: Scripts strictly only accept blocks.')
    }
  }

  remove (component) {
    super.remove(component)
    if (!this.components.length) {
      this.removeFromWorkspace()
      this.destroy()
    }
  }

  removeFromWorkspace () {
    if (!this.workspace) return
    this.workspace.scriptsElem.removeChild(this.elem)
    const index = this.workspace.scripts.indexOf(this)
    if (~index) {
      this.workspace.scripts.splice(index, 1)
    }
    this.trigger('workspace-remove', this.workspace)
    this.workspace = null
  }

  getStackBlockConnections (rtl) {
    const arr = super.getStackBlockConnections(rtl)
    if (!arr.length) return arr
    // In 2.0, I believe you attach on the bottom for scripts, but insert
    // with the top in C blocks. Also with C blocks you can both attach
    // from the bottom or wrap around by connecting to the top. It's rather
    // complex.
    const first = arr[0][2]
    const myFirstBlock = this.components[0]
    if (first.insertBefore && first.insertBefore === myFirstBlock) {
      first.beforeScript = true
    }
    return arr
  }

  _onClick () {
    this.blocks.trigger('script-click', this)
  }

  destroy () {
    this.blocks.removeListeners(this.elem)
    super.destroy()
  }

  toJSON () {
    return {
      ...this.position,
      blocks: this.components.map(block => block.toJSON())
    }
  }
}

export { Stack, Script }
