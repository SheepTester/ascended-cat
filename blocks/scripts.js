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
    const {notchLeft, notchWallWidth, notchWidth, branchWidth} = Block.renderOptions
    const connectionX = notchLeft + notchWallWidth + notchWidth
    const arr = []
    for (const block of this.components) {
      arr.push([connectionX, block.position.y, {before: block, in: this}])
      for (const component of block.components) {
        if (component instanceof Stack) {
          arr.push(...component.getStackBlockConnections()
            .map(([x, y, data]) => [branchWidth + x, y, data]))
        }
      }
    }
    arr.push([connectionX, this.measurements.height, {before: null, in: this}])
  }
}

// Autodelete when last block is removed?
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
