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
    if (!blocks.length) {
      return [[notchX, 0, {after: true, in: this}]]
    }
    const arr = []
    for (const block of blocks) {
      if (!block.blockData.hat) {
        arr.push([notchX, block.position.y, {insertBefore: block, in: this}])
      }
      for (const component of block.components) {
        if (component instanceof Stack) {
          arr.push(...component.getStackBlockConnections()
            .map(([x, y, data]) => [
              branchWidth + x,
              block.position.y + component.position.y + y,
              data
            ]))
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
  
  getStackBlockConnections () {
    const arr = super.getStackBlockConnections()
    // In 2.0, I believe you attach on the bottom for scripts, but insert
    // with the top in C blocks. Also with C blocks you can both attach
    // from the bottom or wrap around by connecting to the top. It's rather
    // complex.
    if (arr[0][2].insertBefore && arr[0][2].in === this) {
      arr[0][2].beforeScript = true
    }
    return arr
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
