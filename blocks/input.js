import { Elem } from '../utils/elem.js'
import { contextMenu } from '../utils/context-menu.js'

import { Component, TextComponent } from './component.js'
import { Block } from './block.js'

const renderOptions = {
  stringHorizPadding: 4,
  stringVertPadding: 2,
  stringHeight: 12,
  numberHorizPadding: 4,
  numberVertPadding: 2,
  numberHeight: 12,
  numberMinWidth: 8,
  booleanHeight: 14,
  booleanWidth: 30,
  booleanSide: 7,
  reporterConnectionLeft: 8,
  popOutOffset: 10,
  menuArrowWidth: 12, // size of hit area, not icon itself
  menuArrowHeight: 12,
  menuArrow: 'M-4 -2 H4 L0 2 z',
  menuArrowPadding: 0
}

class MenuArrow extends Component {
  constructor () {
    super()
    this.elem.classList.add('block-menu-arrow')

    this._arrow = Elem('path', { class: 'block-menu-arrow-path' }, [], true)
    this._back = Elem('path', { class: 'block-menu-arrow-hit-area' }, [], true)
    this.elem.appendChild(this._back)
    this.elem.appendChild(this._arrow)
  }

  reposition () {
    const {
      menuArrowWidth: width,
      menuArrowHeight: height,
      menuArrow
    } = renderOptions
    this._back.setAttributeNS(null, 'd',
      `M${-width / 2} ${-height / 2} h${width} v${height} h${-width} z`)
    this._arrow.setAttributeNS(null, 'd', menuArrow)
    this.measurements = { width, height }
    this.trigger('reposition', this.measurements)
  }
}

class Input extends Component {
  constructor (blocks, menu, initValue, {
    isEditable = false,
    isNumber = false
  } = {}) {
    super()
    this.blocks = blocks

    this.isEditable = isEditable
    if (isEditable) {
      blocks.onClick(this.elem, this._onClick.bind(this))
      blocks.onRightClick(this.elem, this._onClick.bind(this))
    }
    this.isNumber = isNumber

    this.elem.classList.add('block-input')
    this.path = Elem('path', { class: 'block-input-back' }, [], true)
    this.elem.appendChild(this.path)
    this.text = new TextComponent()
    this.text.elem.classList.add('block-input-value')
    this.add(this.text)

    if (menu) {
      this.menu = menu
      this.elem.classList.add('block-menu')
      this.menuArrow = new MenuArrow()
      if (isEditable) {
        blocks.onClick(this.menuArrow.elem, this._openMenu.bind(this))
      } else {
        blocks.onClick(this.elem, this._openMenu.bind(this))
        this.elem.classList.add('block-only-menu')
      }
      this.add(this.menuArrow)
    }

    if (initValue instanceof Block) {
      this.insertBlock(initValue)
    } else if (initValue !== undefined) {
      this.setValue(initValue, true)
    }
  }

  /**
   * Pass in `null` to pull out the block.
   */
  insertBlock (block) {
    if (this._block) {
      this.remove(this._block)
    }
    if (block) {
      this.elem.classList.add('block-input-has-block')
      this.add(block)
    } else {
      this.elem.classList.remove('block-input-has-block')
    }
    this._block = block
  }

  setValue (value, preventUpdate = false) {
    this.value = value
    this.text.text = this.displayValue(false)
    if (!preventUpdate) {
      return this.text.resize()
    }
  }

  setValueFromUserInput (userInput, preventUpdate) {
    return this.setValue(userInput, preventUpdate)
  }

  displayValue (textInput = false) {
    return this.value === undefined ? '' : this.value
  }

  getValue () {
    return this._block || this.value
  }

  reposition () {
    this.measurements = this._block ? this._block.measurements : this.drawInputBack()
    this.trigger('reposition', this.measurements)
  }

  drawInputBack () {
    const dir = this.blocks.dir === 'rtl' ? -1 : 1
    const {
      stringHorizPadding: horizPadding,
      stringVertPadding: vertPadding,
      stringHeight: inputHeight,
      menuArrowPadding
    } = renderOptions
    const { width } = this.text.measurements
    this.text.setPosition((horizPadding + width / 2) * dir, vertPadding + inputHeight / 2)
    let totalWidth = width + horizPadding * 2
    if (this.menu) {
      const { width } = this.menuArrow.measurements
      totalWidth += menuArrowPadding + width
      this.menuArrow.setPosition((totalWidth - width / 2) * dir, vertPadding + inputHeight / 2)
    }
    const path = `M0 0 H${totalWidth * dir} V${inputHeight + vertPadding * 2} H0 z`
    this.path.setAttributeNS(null, 'd', path)
    return { width: totalWidth, height: inputHeight + vertPadding * 2 }
  }

  _onClick () {
    this.considerShowingInput()
  }

  considerShowingInput () {
    if (!this._block) {
      const workspace = this.getWorkspace()
      if (workspace) {
        const input = workspace.showInput({
          change: value => {
            this.setValueFromUserInput(value, true)
            this.text.text = value
            this.text.resize()
              .then(() => {
                input.style.width = this.measurements.width + 'px'
                input.style.height = this.measurements.height + 'px'
              })
          },
          hide: this.onInputHide.bind(this),
          tab: next => {
            const inputs = workspace.getAllInputs()
            const index = inputs.indexOf(this)
            if (~index) {
              return inputs[next ? index + 1 : index - 1]
            }
          }
        }, this.isNumber)
        this._updateInputPosition(input)
        this.onInputShow(input)
        this._removingListeners = []
        this._positionChangeListeners = []
        let component = this
        while (component) {
          this._removingListeners.push([
            component,
            component.on('removing', () => {
              workspace.hideInput()
            })
          ])
          this._positionChangeListeners.push([
            component,
            component.on('position-change', () => {
              this._updateInputPosition(input)
            })
          ])
          component = component.parent
        }
      }
    }
  }

  _updateInputPosition (input) {
    const { x, y } = this.getWorkspaceOffset()
    if (this.blocks.dir === 'rtl') {
      input.style.left = (x - this.measurements.width) + 'px'
    } else {
      input.style.left = x + 'px'
    }
    input.style.top = y + 'px'
    input.style.width = this.measurements.width + 'px'
    input.style.height = this.measurements.height + 'px'
  }

  onInputShow (input) {
    input.value = this.displayValue(true)
    input.setSelectionRange(0, input.value.length)
    this.elem.classList.add('block-input-open')
    if (this.menu) {
      input.classList.add('block-menu')
    }
  }

  onInputHide (input) {
    this.elem.classList.remove('block-input-open')
    for (const [component, listener] of this._removingListeners) {
      component.off('removing', listener)
    }
    for (const [component, listener] of this._positionChangeListeners) {
      component.off('position-change', listener)
    }
    this._removingListeners = null
    this._positionChangeListeners = null
  }

  storeAllInputsIn (arr) {
    if (this._block) {
      super.storeAllInputsIn(arr)
    } else if (this.isEditable) {
      arr.push(this)
    }
  }

  _openMenu () {
    const entry = typeof this.menu === 'string'
      ? this.blocks.menus[this.menu]
      : this.menu
    const menu = Array.isArray(entry) ? entry : entry()
    const { x: offsetX, y: offsetY } = this.getWorkspaceOffset()
    const { x, y } = this.getWorkspace().scriptToCSSCoords(
      offsetX,
      offsetY + this.measurements.height
    )
    contextMenu(
      menu.map(label => ({ label, fn: () => {
        this.setValueFromUserInput(label)
      } })),
      x,
      y,
      this.blocks.dir === 'rtl'
    )
  }

  canAcceptBlock (block) {
    return true
  }

  getReporterConnections (block) {
    const arr = []
    if (this.canAcceptBlock(block)) {
      arr.push([
        renderOptions.reporterConnectionLeft,
        this.measurements.height / 2,
        this
      ])
    }
    if (this._block) {
      arr.push(...this._block.getReporterConnections())
    }
    return arr
  }

  destroy () {
    this.blocks.removeListeners(this.elem)
    if (this.menuArrow) {
      this.blocks.removeListeners(this.menuArrow.elem)
    }
    super.destroy()
  }
}

class StringInput extends Input {
  constructor (blocks, menu, initValue) {
    super(blocks, menu, initValue, {
      isEditable: true
    })

    this.elem.classList.add('block-string-input')
  }

  onInputShow (input) {
    super.onInputShow(input)
    input.classList.add('block-string-input')
  }

  onInputHide (input) {
    super.onInputHide(input)
    input.classList.remove('block-string-input')
  }
}

class NumberInput extends Input {
  constructor (blocks, menu, initValue) {
    super(blocks, menu, initValue, {
      isEditable: true,
      isNumber: true
    })

    this.elem.classList.add('block-number-input')
  }

  setValueFromUserInput (userInput, preventUpdate) {
    const num = typeof userInput === 'number'
      ? userInput
      : +userInput.replace(/,/g, '.')
    return this.setValue(Number.isNaN(num) ? 0 : num, preventUpdate)
  }

  drawInputBack () {
    const dir = this.blocks.dir === 'rtl' ? -1 : 1
    const {
      numberHorizPadding: horizPadding,
      numberVertPadding: vertPadding,
      numberHeight: inputHeight,
      numberMinWidth: minWidth,
      menuArrowPadding
    } = renderOptions
    const width = Math.max(this.text.measurements.width, minWidth)
    const radius = vertPadding + inputHeight / 2
    this.text.setPosition((horizPadding + width / 2) * dir, radius)
    let totalWidth = width + horizPadding * 2
    if (this.menu) {
      const { width } = this.menuArrow.measurements
      totalWidth += menuArrowPadding + width
      this.menuArrow.setPosition((totalWidth - width / 2) * dir, radius)
    }
    const curveHeader = this.blocks.dir === 'rtl'
      ? `a${radius} ${radius} 0 0 0`
      : `a${radius} ${radius} 0 0 1`
    const path = `M${radius * dir} ${radius * 2} ${curveHeader} 0 ${-radius * 2}` +
      `H${(totalWidth - radius) * dir} ${curveHeader} 0 ${radius * 2} z`
    this.path.setAttributeNS(null, 'd', path)
    return { width: totalWidth, height: radius * 2 }
  }

  onInputShow (input) {
    super.onInputShow(input)
    input.classList.add('block-number-input')
  }

  onInputHide (input) {
    super.onInputHide(input)
    input.classList.remove('block-number-input')
  }
}

class AngleInput extends NumberInput {
  constructor (blocks, menu, initValue) {
    super(blocks, menu, initValue)

    this.elem.classList.add('block-angle-input')
  }

  displayValue (textInput = false) {
    return super.displayValue(textInput) + (textInput ? '' : '°')
  }
}

class BooleanInput extends Input {
  constructor (blocks, menu, initValue) {
    super(blocks, menu, initValue)
    this.elem.classList.add('block-boolean-input')
  }

  drawInputBack () {
    const dir = this.blocks.dir === 'rtl' ? -1 : 1
    const {
      booleanHeight: height,
      booleanWidth: width,
      booleanSide: side
    } = renderOptions
    const path = `M0 ${height / 2} L${side * dir} 0 H${(width - side) * dir} L${width * dir} ${height / 2}` +
      `L${(width - side) * dir} ${height} H${side * dir} z`
    this.path.setAttributeNS(null, 'd', path)
    return { width, height }
  }
}

export {
  Input,
  StringInput,
  NumberInput,
  AngleInput,
  BooleanInput,
  renderOptions
}
