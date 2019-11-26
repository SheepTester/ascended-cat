import { Elem } from '../utils/elem.js'

import { Component, TextComponent } from './component.js'
import { Block } from './block.js'

class Input extends Component {
  constructor (blocks, initValue) {
    super()
    this.blocks = blocks
    this.isEditable = false
    this.isNumber = false
    this.elem.classList.add('block-input')
    this.path = Elem('path', { class: 'block-input-back' }, [], true)
    this.elem.appendChild(this.path)
    this.text = new TextComponent()
    this.text.elem.classList.add('block-input-value')
    this.add(this.text)
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
    this.text.text = value
    if (!preventUpdate) {
      return this.text.resize()
    }
  }

  getValue () {
    return this._block || this.value
  }

  reposition () {
    this.measurements = this._block ? this._block.measurements : this.drawInputBack()
    this.trigger('reposition', this.measurements)
  }

  drawInputBack () {
    return this.text.measurements
  }

  considerShowingInput () {
    if (!this._block) {
      const workspace = this.getWorkspace()
      if (workspace) {
        const input = workspace.showInput({
          change: value => {
            this.setValue(value)
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
    input.style.left = x + 'px'
    input.style.top = y + 'px'
    input.style.width = this.measurements.width + 'px'
    input.style.height = this.measurements.height + 'px'
  }

  onInputShow (input) {
    input.value = this.text.text
    this.elem.classList.add('block-input-open')
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

  canAcceptBlock (block) {
    return true
  }

  getReporterConnections (block) {
    const arr = []
    if (this.canAcceptBlock(block)) {
      arr.push([
        Input.renderOptions.reporterConnectionLeft,
        this.measurements.height / 2,
        this
      ])
    }
    if (this._block) {
      arr.push(...this._block.getReporterConnections())
    }
    return arr
  }
}

Input.renderOptions = {
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
  popOutOffset: 10
}

class StringInput extends Input {
  constructor (blocks, initValue) {
    super(blocks, initValue)

    this.elem.classList.add('block-string-input')
    this.isEditable = true

    this.blocks.onClick(this.elem, this._onClick.bind(this))
  }

  drawInputBack () {
    const {
      stringHorizPadding: horizPadding,
      stringVertPadding: vertPadding,
      stringHeight: inputHeight
    } = super.constructor.renderOptions
    const { width } = this.text.measurements
    this.text.setPosition(horizPadding, vertPadding + inputHeight / 2)
    const path = `M0 0 H${width + horizPadding * 2} V${inputHeight + vertPadding * 2} H0 z`
    this.path.setAttributeNS(null, 'd', path)
    return { width: width + horizPadding * 2, height: inputHeight + vertPadding * 2 }
  }

  _onClick () {
    this.considerShowingInput()
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
  constructor (blocks, initValue) {
    super(blocks, initValue)

    this.elem.classList.add('block-number-input')
    this.isEditable = true
    this.isNumber = true

    this.blocks.onClick(this.elem, this._onClick.bind(this))
  }

  drawInputBack () {
    const {
      numberHorizPadding: horizPadding,
      numberVertPadding: vertPadding,
      numberHeight: inputHeight,
      numberMinWidth: minWidth
    } = super.constructor.renderOptions
    const width = Math.max(this.text.measurements.width, minWidth)
    const radius = vertPadding + inputHeight / 2
    this.text.setPosition(horizPadding, radius)
    const path = `M${radius} ${radius * 2} a${radius} ${radius} 0 0 1 0 ${-radius * 2}` +
      `H${width + horizPadding * 2 - radius} a${radius} ${radius} 0 0 1 0 ${radius * 2} z`
    this.path.setAttributeNS(null, 'd', path)
    return { width: width + horizPadding * 2, height: radius * 2 }
  }

  _onClick () {
    this.considerShowingInput()
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

class BooleanInput extends Input {
  constructor (blocks, initValue) {
    super(blocks, initValue)
    this.elem.classList.add('block-boolean-input')
  }

  drawInputBack () {
    const {
      booleanHeight: height,
      booleanWidth: width,
      booleanSide: side
    } = super.constructor.renderOptions
    const path = `M0 ${height / 2} L${side} 0 H${width - side} L${width} ${height / 2}` +
      `L${width - side} ${height} H${side} z`
    this.path.setAttributeNS(null, 'd', path)
    return { width, height }
  }
}

export { Input, StringInput, NumberInput, BooleanInput }
