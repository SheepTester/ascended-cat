// Relies on blocks/component, blocks/block

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
    this.measurements = {width: maxWidth, height: y}
  }

  /**
   * Stack block connections are just the rough locations of each notch.
   */
  getStackBlockConnections () {
    const blocks = this.components.filter(block => block instanceof Block)
    const {branchWidth, notchX} = Block.renderOptions
    const arr = []
    if (!blocks.length || !blocks[0].blockData.hat) {
      arr.push([notchX, 0, {before: true, in: this}])
      if (!blocks.length) return arr
    }
    for (const block of blocks) {
      if (blocks[0] !== block) {
        arr.push([notchX, block.position.y, {insertBefore: block, in: this}])
      }
      for (const component of block.components) {
        if (component instanceof Stack) {
          arr.push(...component.getStackBlockConnections()
            .map(([x, y, data]) => [branchWidth + x, block.position.y + component.position.y + y, data]))
        }
      }
    }
    if (!blocks[blocks.length - 1].blockData.terminal) {
      arr.push([notchX, this.measurements.height, {after: true, in: this}])
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
  }

  remove (component) {
    super.remove(component)
    if (!this.components.length) {
      this.removeFromWorkspace()
    }
  }

  removeFromWorkspace () {
    if (!this.workspace) return
    this.workspace.scriptsElem.removeChild(this.elem)
    const index = this.workspace.scripts.indexOf(this)
    if (~index) {
      this.workspace.scripts.splice(index, 1)
    }
    this.workspace = null
  }
}

class PaletteStack extends Stack {
  constructor (initBlocks) {
    super(initBlocks)
  }

  getStackBlockConnections () {
    return []
  }
}
