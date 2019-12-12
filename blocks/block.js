import { Elem } from '../utils/elem.js'
import { contextMenu } from '../utils/context-menu.js'

import { Component, TextComponent } from './component.js'
import { BlockType, ArgumentType, NullCategory } from './constants.js'
import {
  Input,
  StringInput,
  NumberInput,
  AngleInput,
  BooleanInput,
  renderOptions as inputRenderOptions
} from './input.js'
import { Stack, Script } from './scripts.js'

const paddingTypes = {
  [BlockType.COMMAND]: 'Stack',
  [BlockType.REPORTER]: 'Reporter',
  [BlockType.BOOLEAN]: 'Boolean'
}

const paramRegex = /\[([A-Z0-9_]+)\]/g

function getIndicesOf (component) {
  const indices = []
  while (component.parent) {
    if (component.parent instanceof Block) {
      indices.unshift(component.parent.getParamID(component))
    } else if (!(component.parent instanceof Input)) {
      indices.unshift(component.parent.components.indexOf(component))
    }
    component = component.parent
  }
  if (component.workspace) {
    indices.unshift(component.workspace.scripts.indexOf(component))
    indices.unshift(component.workspace)
  }
  return indices
}

class Block extends Component {
  constructor (blocks, initBlock, initParams = {}) {
    super()
    this.updateLabel = this.updateLabel.bind(this)

    this.blocks = blocks
    this.cloneOnDrag = false
    this.elem.classList.add('block-block')
    this._path = Elem('path', { class: 'block-back' }, [], true)
    this.elem.appendChild(this._path)
    this._params = {}
    if (initBlock) {
      this.setBlock(initBlock)
      for (const [paramID, value] of Object.entries(initParams)) {
        this._params[paramID] = this.createParam(this.blockData.args[paramID] || {}, value)
      }
      this.updateLabel()
    }

    blocks.onDrag(this.elem, this._onDrag.bind(this))
    blocks.onRightClick(this.elem, e => {
      let items
      if (this.cloneOnDrag) {
        items = [
          { label: blocks.getTranslation('_.help'), fn: () => { console.log('help') } }
        ]
      } else {
        items = [
          { label: blocks.getTranslation('_.duplicate'), fn: () => { console.log('duplicate') } },
          { label: blocks.getTranslation('_.delete'), fn: () => { console.log('delete') } },
          '---',
          { label: blocks.getTranslation('_.addComment'), fn: () => { console.log('add comment') } },
          { label: blocks.getTranslation('_.help'), fn: () => { console.log('help') } }
        ]
        if (this.blockData.alternatives.length) {
          items.push(
            '---',
            ...this.blockData.alternatives.map(alternative => {
              if (alternative[0] === '#') {
                alternative = `${this.category}.${alternative.slice(1)}`
              }
              return {
                label: this.blocks.getTranslation(alternative)
                  .replace(paramRegex, this.blocks.getTranslation('_.paramPlaceholder')),
                fn: () => {
                  this.setBlock(alternative)
                  this.updateLabel()
                  this.resize()
                }
              }
            })
          )
        }
      }
      contextMenu(items, e.clientX + 1, e.clientY, this.blocks.dir === 'rtl')
      e.preventDefault()
    })
    blocks.on('language-change', this.updateLabel)
  }

  setBlock (blockOpcode) {
    if (this._onBlockAdded) {
      this.blocks.off('block-added', this._onBlockAdded)
      this._onBlockAdded = null
    }
    const { category, blockData, opcode } = this.blocks.getBlockData(blockOpcode)
    this.category = category
    this.blockOpcode = blockOpcode
    this.blockData = blockData || Block.nonexistentBlock
    if (!blockData) {
      this._onBlockAdded = this.blocks.on('block-added', opcode => {
        if (blockOpcode === opcode) {
          this.setBlock(blockOpcode)
        }
      })
    }
    this.elem.dataset.category = category || NullCategory
    this.elem.dataset.opcode = opcode
  }

  /**
   * Used for both changing languages and swapping blocks by means of right-click.
   */
  updateLabel () {
    this.clear()
    const text = this.blocks.getTranslation(this.blockOpcode)
    // This allows unused parameters from previous block to be discarded
    const oldParams = this._params
    this._params = {}
    paramRegex.lastIndex = 0
    let i = 0
    let exec
    while ((exec = paramRegex.exec(text))) {
      if (exec.index > i) {
        const str = text.slice(i, exec.index).trim()
        if (str) {
          this.add(new TextComponent(str))
        }
      }
      const [match, paramID] = exec
      // It is assumed that if they have the same ID and the block was changed by
      // right click, they are effectively the same parameter and should be kept.
      if (oldParams[paramID]) {
        // Welcome back!
        this.add(oldParams[paramID])
        this._params[paramID] = oldParams[paramID]
      } else {
        const param = this.createParam(this.blockData.args[paramID])
        if (param) {
          this.add(param)
          this._params[paramID] = param
        }
      }
      i = exec.index + match.length
    }
    if (i < text.length) {
      const str = text.slice(i).trim()
      if (str) {
        this.add(new TextComponent(str))
      }
    }
  }

  // TODO: Translate default strings
  createParam ({ type, default: defaultVal, menu = null }, value = defaultVal) {
    if (value) {
      if (value.opcode) {
        value = this.blocks.blockFromJSON(value)
      } else if (value[0] && value[0].opcode) {
        value = value.map(data => this.blocks.blockFromJSON(data))
      }
    }
    if (typeof menu === 'string' && menu[0] === '#') {
      menu = `${this.category}.${menu.slice(1)}`
    }
    switch (type) {
      case ArgumentType.BRANCH:
        return new Stack(value)
      case ArgumentType.STRING:
        return new StringInput(this.blocks, menu, value)
      case ArgumentType.NUMBER:
        return new NumberInput(this.blocks, menu, value)
      case ArgumentType.ANGLE:
        return new AngleInput(this.blocks, menu, value)
      case ArgumentType.BOOLEAN:
        return new BooleanInput(this.blocks, menu, value)
      default:
        return menu
          ? new Input(this.blocks, menu)
          : null
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

  getParamComponent (paramID) {
    return this._params[paramID]
  }

  getParamID (component) {
    for (const [paramID, input] of Object.entries(this._params)) {
      if (input === component) {
        return paramID
      }
    }
    return null
  }

  reposition () {
    const cInserts = []
    const dir = this.blocks.dir === 'rtl' ? -1 : 1
    const {
      stackMinWidth,
      stackMinHeight,
      stackVertPadding,
      notchLeft,
      notchTotalWidth,
      notchToLeft,
      notchToRight,
      branchWidth,
      branchMinHeight,
      hatLeft,
      hatRight,
      hatTopPadding,
      hatMinWidth,
      undefinedMinBlockWidth,
      cMinWidth,
      reporterMinWidth,
      booleanMinWidth,
      betweenInputs
    } = Block.renderOptions
    const hat = this.blocks.dir === 'rtl' ? hatRight : hatLeft
    const notchForth = this.blocks.dir === 'rtl' ? notchToLeft : notchToRight
    const notchBack = this.blocks.dir === 'rtl' ? notchToRight : notchToLeft
    const minWidth = !this.blockData.blockType ? undefinedMinBlockWidth
      : this.blockData.blockType === BlockType.REPORTER ? reporterMinWidth
        : this.blockData.blockType === BlockType.BOOLEAN ? booleanMinWidth
          : this.blockData.hat ? hatMinWidth : stackMinWidth
    const minHeight = stackMinHeight
    const vertPadding = stackVertPadding
    const sidePaddingPrefix = `b${paddingTypes[this.blockData.blockType]}I`
    const getSidePadding = component => {
      let suffix
      if (component instanceof TextComponent) {
        suffix = 'Text'
      } else if (component instanceof StringInput) {
        suffix = 'String'
      } else if (component instanceof NumberInput) {
        suffix = 'Number'
      } else if (component instanceof BooleanInput) {
        suffix = 'Boolean'
      } else if (component.menu) {
        suffix = 'String'
      } else {
        return 0
      }
      return Block.renderOptions[sidePaddingPrefix + suffix] || 0
    }

    let maxWidth = minWidth
    let cSlotMaxWidth = 0
    let maxHeight = minHeight
    let y = this.blockData.hat ? hatTopPadding : 0
    let x = 0
    let firstInRow = 0
    for (let i = 0; i < this.components.length; i++) {
      const component = this.components[i]
      if (component instanceof Stack) {
        // Vertically centre all components in the row
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
        if (i > firstInRow) {
          x += getSidePadding(this.components[i - 1])
        }
        if (x > maxWidth) {
          maxWidth = x
        }
        if (maxWidth < cMinWidth) {
          maxWidth = cMinWidth
        }

        maxHeight = minHeight
        x = 0
        firstInRow = i + 1

        component.setPosition(branchWidth * dir, y)
        const branchHeight = Math.max(branchMinHeight, component.measurements.height)
        cInserts.push([y, y + branchHeight])
        y += branchHeight
        if (component.measurements.width > cSlotMaxWidth) {
          cSlotMaxWidth = component.measurements.width
        }
      } else {
        if (i === firstInRow) {
          x += getSidePadding(component)
        } else {
          x += betweenInputs
        }
        if (component instanceof TextComponent) {
          component.setPosition((x + component.measurements.width / 2) * dir, 0)
        } else {
          component.setPosition(x * dir, 0)
        }
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
    if (this.components.length > firstInRow) {
      x += getSidePadding(this.components[this.components.length - 1])
    }
    if (x > maxWidth) {
      maxWidth = x
    }

    switch (this.blockData.blockType) {
      case BlockType.COMMAND: {
        let path = `${this.blockData.hat ? `M0 ${hatTopPadding} ${hat}`
          : `M0 0 h${notchLeft * dir} ${notchForth}`} H${maxWidth * dir}`
        for (const [start, end] of cInserts) {
          path += `V${start} H${(branchWidth + notchTotalWidth) * dir}` +
            `${notchBack} h${-notchLeft * dir}`
          path += `V${end} h${notchLeft * dir} ${notchForth} H${maxWidth * dir}`
        }
        path += `V${y} ${this.blockData.terminal ? ''
          : `H${notchTotalWidth * dir} ${notchBack}`} H0 z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
      case BlockType.REPORTER: {
        const radius = y / 2
        const curveHeader = this.blocks.dir === 'rtl'
          ? `a${radius} ${radius} 0 0 0`
          : `a${radius} ${radius} 0 0 1`
        const path = `M${radius * dir} ${y} ${curveHeader} 0 ${-y}` +
          `H${(maxWidth - radius) * dir} ${curveHeader} 0 ${y} z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
      case BlockType.BOOLEAN: {
        const side = y / 2
        const path = `M0 ${side} L${side * dir} 0 H${(maxWidth - side) * dir}` +
          `L${maxWidth * dir} ${side} L${(maxWidth - side) * dir} ${y}` +
          ` H${side * dir} z`
        this._path.setAttributeNS(null, 'd', path)
        break
      }
      default: {
        const path = `M0 0 H${maxWidth * dir} V${y} H0 z`
        this._path.setAttributeNS(null, 'd', path)
      }
    }

    this.measurements = { width: Math.max(maxWidth, branchWidth + cSlotMaxWidth), height: y }
    this.trigger('reposition', this.measurements)
  }

  _onDrag (initMouseX, initMouseY) {
    const workspace = this.getWorkspace()
    const { x, y } = this.getWorkspaceOffset()
    const { x: scriptX, y: scriptY } = workspace.scriptToCSSCoords(x, y)
    let target
    if (this.cloneOnDrag) {
      target = [this.toJSON()]
    } else {
      if (this.parent instanceof Script && this.parent.components[0] === this) {
        // Dragging the entire script, effectively
        const script = this.parent
        target = {
          workspace,
          index: workspace.scripts.indexOf(script),
          ...script.position
        }
      } else {
        target = { indices: getIndicesOf(this) }
      }
    }
    return this.blocks.dragBlocks({
      target,
      initMouseX,
      initMouseY,
      dx: scriptX - initMouseX,
      dy: scriptY - initMouseY,
      type: this.blockData.blockType
    })
  }

  clone () {
    return this.blocks.createBlock(
      this.blockOpcode,
      this.getParams(true)
    )
  }

  getReporterAnchorPoint () {
    return [
      inputRenderOptions.reporterConnectionLeft * (this.blocks.dir === 'rtl' ? -1 : 1),
      this.measurements.height / 2
    ]
  }

  getReporterConnections (block) {
    const arr = []
    for (const component of this.components) {
      if (component instanceof Input || component instanceof Stack) {
        arr.push(...component.getReporterConnections(block)
          .map(([x, y, data]) => [x + component.position.x, y + component.position.y, data]))
      }
    }
    return arr
  }

  destroy () {
    this.blocks.removeListeners(this.elem)
    this.blocks.off('language-change', this.updateLabel)
    if (this._onBlockAdded) {
      this.blocks.off('block-added', this._onBlockAdded)
      this._onBlockAdded = null
    }
    super.destroy()
  }

  toJSON () {
    const params = this.getParams()
    for (const [paramID, value] of Object.entries(params)) {
      if (value instanceof Block) {
        params[paramID] = value.toJSON()
      } else if (Array.isArray(value)) {
        params[paramID] = value.map(block => block.toJSON())
      }
    }
    return {
      opcode: this.blockOpcode,
      params
    }
  }
}

Block.nonexistentBlock = {
  opcode: 'nonexistent',
  blockType: null,
  text: '???',
  args: {}
}

Block.renderOptions = {
  stackMinWidth: 34,
  stackMinHeight: 16,
  stackVertPadding: 3,
  notchLeft: 10,
  notchWallWidth: 3,
  notchWidth: 8,
  notchHeight: 3,
  get notchX () {
    const { notchLeft, notchWallWidth, notchWidth } = this
    return notchLeft + notchWallWidth + notchWidth / 2
  },
  get notchTotalWidth () {
    const { notchLeft, notchWallWidth, notchWidth } = this
    return notchLeft + notchWallWidth * 2 + notchWidth
  },
  get notchToLeft () {
    const { notchWallWidth, notchWidth, notchHeight } = this
    return `l${-notchWallWidth} ${notchHeight} h${-notchWidth} l${-notchWallWidth} ${-notchHeight}`
  },
  get notchToRight () {
    const { notchWallWidth, notchWidth, notchHeight } = this
    return `l${notchWallWidth} ${notchHeight} h${notchWidth} l${notchWallWidth} ${-notchHeight}`
  },
  branchWidth: 15,
  branchMinHeight: 9,
  hatLeft: 'c20 -15 60 -15 80 0',
  hatRight: 'c-20 -15 -60 -15 -80 0',
  hatTopPadding: 15,
  hatMinWidth: 80,
  undefinedMinBlockWidth: 10,
  cMinWidth: 83,
  reporterMinWidth: 16,
  booleanMinWidth: 16,
  // Padding between the edge of a block and an input/text
  // b[Stack|Reporter|Boolean]I[String|Number|Boolean|Text]
  bStackIString: 6,
  bStackINumber: 6,
  bStackIBoolean: 6,
  bStackIText: 6,
  bReporterIString: 4,
  bReporterINumber: 4,
  bReporterIBoolean: 4,
  bReporterIText: 8,
  bBooleanIString: 8,
  bBooleanINumber: 8,
  bBooleanIBoolean: 5,
  bBooleanIText: 10,
  betweenInputs: 4
}

Block.maxSnapDistance = 30

export { Block, getIndicesOf }
