// Relies on blocks/component, utils/elem, blocks/constants, blocks/input

class Block extends Component {
  constructor (blocks, initBlock, initParams = {}) {
    super()
    this._onDrag = this._onDrag.bind(this)

    this.blocks = blocks
    this.cloneOnDrag = false
    this.elem.classList.add('block-block')
    this._path = Elem('path', {class: 'block-back'}, [], true)
    this.elem.appendChild(this._path)
    this._params = {}
    if (initBlock) {
      this.setBlock(initBlock)
      for (const [paramID, value] of Object.entries(initParams)) {
        this._params[paramID] = this.createParam(this.blockData.arguments[paramID], value)
      }
      this.updateLabel()
    }
    blocks.onDrag(this.elem, this._onDrag)
  }

  setBlock (blockOpcode) {
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
  }

  /**
   * Used for both changing languages and swapping blocks by means of right-click.
   */
  updateLabel () {
    this.clear()
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
        const param = this.createParam(this.blockData.arguments[paramID])
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

  createParam (argumentData, value = argumentData.default) {
    switch (argumentData.type) {
      case ArgumentType.BRANCH:
        return new Stack(value)
      case ArgumentType.STRING:
        return new StringInput(this.blocks, value)
      case ArgumentType.NUMBER:
        return new NumberInput(this.blocks, value)
      case ArgumentType.BOOLEAN:
        return new BooleanInput(this.blocks, value)
      default:
        return null
    }
  }

  getParams (cloneBlocks = false) {
    const params = {}
    for (const [paramID, input] of Object.entries(this._params)) {
      if (input instanceof Input) {
        const value = input.getValue()
        params[paramID] = cloneBlocks && value instanceof Block
          ? value.clone()
          : value
      } else {
        params[paramID] = cloneBlocks
          ? input.components.map(block => block.clone())
          : input.components
      }
    }
    return params
  }

  reposition () {
    const cInserts = []
    const {
      stackMinWidth,
      stackMinHeight,
      stackHorizPadding,
      stackVertPadding,
      notchLeft,
      notchTotalWidth,
      notchToLeft,
      notchToRight,
      branchWidth,
      branchMinHeight,
      hat,
      hatTopPadding,
      hatMinWidth,
      booleanTextFirstPadding,
      reporterTextFirstPadding
    } = this.constructor.renderOptions
    const minWidth = this.blockData.hat ? hatMinWidth : stackMinWidth
    const minHeight = stackMinHeight
    const horizPadding = stackHorizPadding
    const vertPadding = stackVertPadding
    const textFirstPadding = this.blockData.blockType === BlockType.BOOLEAN
      ? booleanTextFirstPadding
      : this.blockData.blockType === BlockType.REPORTER
      ? reporterTextFirstPadding
      : stackHorizPadding

    let maxWidth = minWidth
    let cSlotMaxWidth = 0
    let maxHeight = minHeight
    let y = this.blockData.hat ? hatTopPadding : 0
    let x = horizPadding
    let firstInRow = 0
    for (let i = 0; i < this.components.length; i++) {
      const component = this.components[i]
      if (component instanceof Stack) {
        for (let j = firstInRow; j < i; j++) {
          const rowComponent = this.components[j]
          if (rowComponent instanceof TextComponent) {
            rowComponent.setPosition(rowComponent.position.x, y + maxHeight / 2)
          } else {
            rowComponent.setPosition(
              rowComponent.position.x,
              y + (maxHeight - rowComponent.measurements.height) / 2
            )
          }
        }
        y += maxHeight
        x += horizPadding
        if (x > maxWidth) {
          maxWidth = x
        }

        maxHeight = minHeight
        x = horizPadding
        firstInRow = i + 1

        component.setPosition(branchWidth, y)
        const branchHeight = Math.max(branchMinHeight, component.measurements.height)
        cInserts.push([y, y + branchHeight])
        y += branchHeight
        if (component.measurements.width > cSlotMaxWidth) {
          cSlotMaxWidth = component.measurements.width
        }
      } else {
        if (i === firstInRow && component instanceof TextComponent) {
          x = textFirstPadding
        }
        component.setPosition(x, 0)
        x += component.measurements.width
        const height = Math.max(minHeight, component.measurements.height) + vertPadding * 2
        if (height > maxHeight) {
          maxHeight = height
        }
      }
    }
    for (let i = firstInRow; i < this.components.length; i++) {
      const rowComponent = this.components[i]
      if (rowComponent instanceof TextComponent) {
        rowComponent.setPosition(rowComponent.position.x, y + maxHeight / 2)
      } else {
        rowComponent.setPosition(
          rowComponent.position.x,
          y + (maxHeight - rowComponent.measurements.height) / 2
        )
      }
    }
    y += maxHeight
    x += horizPadding
    if (x > maxWidth) {
      maxWidth = x
    }

    switch (this.blockData.blockType) {
      case BlockType.COMMAND: {
        let path = `${this.blockData.hat ? `M0 ${hatTopPadding} ${hat}` : `M0 0 h${notchLeft} ${notchToRight}`} H${maxWidth}`
        for (const [start, end] of cInserts) {
          path += `V${start} H${branchWidth + notchTotalWidth} ${notchToLeft} h${-notchLeft}`
          path += `V${end} h${notchLeft} ${notchToRight} H${maxWidth}`
        }
        path += `V${y} ${this.blockData.terminal ? '' : `H${notchTotalWidth} ${notchToLeft}`} H0 z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
      case BlockType.REPORTER: {
        const radius = y / 2
        const path = `M${radius} ${y} a${radius} ${radius} 0 0 1 0 ${-y}`
          + `H${maxWidth - radius} a${radius} ${radius} 0 0 1 0 ${y} z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
      case BlockType.BOOLEAN: {
        const side = y / 2
        const path = `M0 ${side} L${side} 0 H${maxWidth - side} L${maxWidth} ${side}`
          + `L${maxWidth - side} ${y} H${side} z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
    }

    this.measurements = {width: Math.max(maxWidth, branchWidth + cSlotMaxWidth), height: y}
  }

  _onDrag (initMouseX, initMouseY) {
    const workspace = this.getWorkspace()
    const {x, y} = this.getWorkspaceOffset()
    const {x: workspaceX, y: workspaceY} = workspace.rect
    const {left, top} = workspace.getTransform()
    const script = this.blocks.createScript()
    if (this.cloneOnDrag) {
      script.add(this.clone())
    } else {
      const oldParent = this.parent
      if (oldParent instanceof Input) {
        oldParent.insertBlock(null)
        script.add(this)
      } else {
        const index = oldParent.components.indexOf(this)
        if (~index) {
          let component
          while (component = oldParent.components[index]) {
            oldParent.remove(component)
            script.add(component)
          }
        } else {
          return
        }
      }
      oldParent.resize()
    }
    script.setPosition(workspaceX + x - left, workspaceY + y - top)
    return this.blocks.dragBlocks({
      script,
      dx: initMouseX - script.position.x,
      dy: initMouseY - script.position.y,
      type: this.blockData.blockType,
      onReady: script.resize()
    })
  }

  clone () {
    return this.blocks.createBlock(
      `${this.category}.${this.blockData.opcode}`,
      this.getParams(true)
    )
  }
  
  getReporterConnections () {
    const arr = []
    for (const component of this.components) {
      if (component instanceof Input || component instanceof Stack) {
        arr.push(...component.getReporterConnections()
          .map(([x, y, data]) => [x + component.position.x, y + component.position.y, data]))
      }
    }
    return arr
  }
}

Block.nonexistentBlock = {
  opcode: 'nonexistent',
  blockType: BlockType.COMMAND,
  text: '???'
}

Block.renderOptions = {
  stackMinWidth: 34,
  stackMinHeight: 16,
  stackHorizPadding: 4,
  stackVertPadding: 3,
  notchLeft: 10,
  notchWallWidth: 3,
  notchWidth: 8,
  notchHeight: 3,
  get notchX () {
    const {notchLeft, notchWallWidth, notchWidth} = this
    return notchLeft + notchWallWidth + notchWidth / 2
  },
  get notchTotalWidth () {
    const {notchLeft, notchWallWidth, notchWidth} = this
    return notchLeft + notchWallWidth * 2 + notchWidth
  },
  get notchToLeft () {
    const {notchWallWidth, notchWidth, notchHeight} = this
    return `l${-notchWallWidth} ${notchHeight} h${-notchWidth} l${-notchWallWidth} ${-notchHeight}`
  },
  get notchToRight () {
    const {notchWallWidth, notchWidth, notchHeight} = this
    return `l${notchWallWidth} ${notchHeight} h${notchWidth} l${notchWallWidth} ${-notchHeight}`
  },
  branchWidth: 15,
  branchMinHeight: 9,
  hat: 'c20 -15 60 -15 80 0',
  hatTopPadding: 15,
  hatMinWidth: 80,
  booleanTextFirstPadding: 10,
  reporterTextFirstPadding: 6
}

Block.maxSnapDistance = 30
