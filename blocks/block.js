// Relies on blocks/component, utils/elem, blocks/constants

class Block extends Component {
  constructor (blocks, initBlock) {
    super()
    this.blocks = blocks
    this._path = Elem('path', {class: 'block-back'}, [], true)
    this.elem.appendChild(this._path)
    this._params = {}
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
    this.elem.dataset.category = this.category
    this.elem.dataset.opcode = this.blockData.opcode
    if (previousCategory) {
      this._path.classList.remove('block-category-' + previousCategory)
    }
    this._path.classList.add('block-category-' + this.category)
    this.clear()
    this.setLabelFromBlock()
  }

  /**
   * Used for both changing languages and swapping blocks by means of right-click.
   */
  setLabelFromBlock () {
    // TODO: Use translated string if this.blocks.language is set
    const text = this.blockData.text
    const paramRegex = /\[([A-Z0-9_]+)\]/g
    // This allows unused parameters from previous block to be discarded
    const oldParams = this._params
    this._params = {}
    let i = 0
    let exec
    while (exec = paramRegex.exec(text)) {
      if (exec.index > i) {
        this.add(new TextComponent(text.slice(i, exec.index)))
      }
      const [match, paramID] = exec
      // It is assumed that if they have the same ID and the block was changed by
      // right click, they are effectively the same parameter and should be kept.
      if (oldParams[paramID]) {
        // Welcome back!
        this.add(oldParams[paramID])
        this._params[paramID] = oldParams[paramID]
      } else {
        const argument = this.blockData.arguments[paramID]
        let param
        switch (argument.type) {
          case ArgumentType.BRANCH:
            param = new Stack()
            break
        }
        if (param) {
          this.add(param)
          this._params[paramID] = param
        }
      }
      i = exec.index + match.length
    }
    if (i < text.length) {
      this.add(new TextComponent(text.slice(i)))
    }
  }

  reposition () {
    const cInserts = []
    const {
      stackMinWidth,
      stackMinHeight: minHeight,
      stackHorizPadding: horizPadding,
      stackVertPadding: vertPadding,
      notchLeft,
      notchWallWidth,
      notchHeight,
      notchWidth,
      branchWidth,
      branchMinHeight,
      hat,
      hatMinWidth
    } = Block.renderOptions
    const minWidth = this.blockData.hat ? hatMinWidth : stackMinWidth

    let maxWidth = minWidth
    let maxHeight = minHeight
    let y = 0
    let x = horizPadding
    let firstInRow = 0
    for (let i = 0; i < this.components.length; i++) {
      const component = this.components[i]
      if (component instanceof Stack) {
        const height = maxHeight + vertPadding * 2
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
        const branchHeight = Math.max(branchMinHeight, component.measurements.height)
        cInserts.push([y, y + branchHeight])
        y += branchHeight
      } else {
        component.setPosition(x, 0)
        x += component.measurements.width
        if (component.measurements.height > maxHeight) {
          maxHeight = component.measurements.height
        }
      }
    }
    const height = maxHeight + vertPadding * 2
    for (let i = firstInRow; i < this.components.length; i++) {
      const rowComponent = this.components[i]
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

    const totalNotchWidth = notchLeft + notchWallWidth * 2 + notchWidth
    const notchToRight = `l${notchWallWidth} ${notchHeight} h${notchWidth} l${notchWallWidth} ${-notchHeight}`
    const notchToLeft = `l${-notchWallWidth} ${notchHeight} h${-notchWidth} l${-notchWallWidth} ${-notchHeight}`
    let path = `M0 0 ${this.blockData.hat ? hat : `h${notchLeft} ${notchToRight}`} H${maxWidth}`
    for (const [start, end] of cInserts) {
      path += `V${start} H${branchWidth + totalNotchWidth} ${notchToLeft} h${-notchLeft}`
      path += `V${end} h${notchLeft} ${notchToRight} H${maxWidth}`
    }
    path += `V${y} ${this.blockData.terminal ? '' : `H${totalNotchWidth} ${notchToLeft}`} H0 z`
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
  stackMinWidth: 34,
  stackMinHeight: 10,
  stackHorizPadding: 4,
  stackVertPadding: 3,
  notchLeft: 10,
  notchWallWidth: 3,
  notchWidth: 8,
  notchHeight: 3,
  branchWidth: 15,
  branchMinHeight: 9,
  hat: 'c20 -15 60 -15 80 0',
  hatMinWidth: 80
}
