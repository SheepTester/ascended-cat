// Relies on blocks/component, utils/elem, blocks/constants

class Block extends Component {
  constructor (blocks, initBlock) {
    super()
    this.blocks = blocks
    this._path = Elem('path', {class: 'block'}, [], true)
    this.elem.appendChild(this._path)
    if (initBlock) this.setBlock(initBlock)
  }

  setBlock(blockOpcode) {
    const previousCategory = this.category
    const previousBlockData = this.blockData
    const [categoryID, opcode] = blockOpcode.split('.')
    const category = this.blocks.categories.find(({id}) => id === categoryID)
    if (category) {
      this.category = categoryID
      this.blockData = category.blocks.find(block => block.opcode === opcode)
        || Block.nonexistentBlock
    } else {
      this.category = 'nonexistent'
      this.blockData = Block.nonexistentBlock
    }
    if (previousCategory) {
      this._path.classList.remove('block-category-' + previousCategory)
    }
    this._path.classList.add('block-category-' + this.category)
  }

  reposition () {
    const cInserts = []
    const {
      stackMinWidth: minWidth,
      stackMinHeight: minHeight,
      stackHorizPadding: horizPadding,
      stackVertPadding: vertPadding,
      branchWidth,
      notchLeft,
      notchWallWidth,
      notchHeight,
      notchWidth
    } = Block.renderOptions

    let maxWidth = minWidth
    let maxHeight = minHeight
    let y = 0
    let x = horizPadding
    let firstInRow = 0
    for (let i = 0; i < this.components.length; i++) {
      const component = this.components[i]
      // TEMP: Will be the C block thing later
      if (component instanceof Node) {
        const height = maxHeight + vertPadding
        for (let j = firstInRow; j < i; j++) {
          const rowComponent = this.components[j]
          rowComponent.setPosition(
            rowComponent.position.x,
            y + (height - rowComponent.measurements.height) / 2
          )
        }
        y += height
        x += horizPadding
        if (x > maxWidth) {
          maxWidth = x
        }

        maxHeight = minHeight
        x = horizPadding
        firstInRow = i

        component.setPosition(branchWidth, y)
        cInserts.push([y, y + component.measurements.height])
        y += component.measurements.height
      } else {
        component.setPosition(x, 0)
        x += component.measurements.width
        if (block.measurements.height > maxHeight) {
          maxHeight = block.measurements.height
        }
      }
    }
    const height = maxHeight + vertPadding
    for (let i = firstInRow; i < this.components.length; i++) {
      const rowComponent = this.components[i]
      rowComponent.setPosition(
        rowComponent.position.x,
        y + (height - rowComponent.measurements.height) / 2
      )
    }
    y += height

    const totalNotchWidth = notchLeft + notchWallWidth * 2 + notchWidth
    const notchStart = maxWidth - branchWidth - totalNotchWidth
    const notchToRight = `l${notchWallWidth} ${notchHeight} h${notchWidth} l${notchWallWidth} ${-notchHeight}`
    const notchToLeft = `l${-notchWallWidth} ${notchHeight} h${-notchWidth} l${-notchWallWidth} ${-notchHeight}`
    let path = `M0 0 h${notchLeft} ${notchToRight} H${maxWidth}`
    for (const [start, end] of cInserts) {
      path += `V${start} H${notchStart} ${notchToLeft} h${-notchLeft}`
      path += `V${end} h${notchLeft} ${notchToRight} H${maxWidth}`
    }
    path += `V${y} H${maxWidth - branchWidth} ${notchToLeft} H0 z`
    this._path.setAttributeNS(null, 'd', path)

    // TODO: `maxWidth` ignores width of c inserts; this shouldn't be hard to fix
    this.measurements = {width: maxWidth, height: y}
  }
}

Block.nonexistentBlock = {
  opcode: 'nonexistent',
  blockType: BlockType.COMMAND,
  text: '???'
}

Block.renderOptions = {
  stackMinWidth: 39,
  stackMinHeight: 16,
  stackHorizPadding: 4,
  stackVertPadding: 3,
  notchLeft: 12,
  notchWallWidth: 3,
  notchWidth: 9,
  notchHeight: 3,
  branchWidth: 15
}
