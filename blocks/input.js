// Relies blocks/component

class Input extends Component {
  constructor (blocks, initValue) {
    super()
    this.onInputHide = this.onInputHide.bind(this)

    this.blocks = blocks
    this.isEditable = false
    this.isNumber = false
    this.elem.classList.add('block-input')
    this.path = Elem('path', {class: 'block-input-back'}, [], true)
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

  insertBlock (block) {
    if (block) {
      this.elem.classList.add('block-input-has-block')
      this.add(block)
    } else {
      this.elem.classList.remove('block-input-has-block')
      if (this._block) this.remove(this._block)
    }
    this._block = block
  }

  setValue (value, preventUpdate = false) {
    this.value = value
    this.text.setText(value)
    if (!preventUpdate) {
      return this.text.resize()
    }
  }

  reposition () {
    this.measurements = this._block ? this._block.measurements : this.drawInputBack()
  }

  drawInputBack () {
    return this.text.measurements
  }

  considerShowingInput () {
    if (!this._block) {
      let parent = this.parent
      while (parent && !parent.workspace) {
        parent = parent.parent
      }
      const workspace = parent.workspace
      if (workspace) {
        const transform = workspace.getTransform()
        const workspaceRect = workspace.svg.getBoundingClientRect()
        const myRect = this.path.getBoundingClientRect()
        const input = workspace.showInput({
          change: value => {
            this.setValue(value)
              .then(() => {
                input.style.width = this.measurements.width + 'px'
              })
          },
          hide: this.onInputHide,
          tab: next => {
            const inputs = workspace.getAllInputs()
            const index = inputs.indexOf(this)
            if (~index) {
              return inputs[next ? index + 1 : index - 1]
            }
          }
        }, this.isNumber)
        input.style.left = (myRect.left - workspaceRect.left + transform.left) + 'px'
        input.style.top = (myRect.top - workspaceRect.top + transform.top) + 'px'
        input.style.width = this.measurements.width + 'px'
        input.style.height = this.measurements.height + 'px'
        this.onInputShow(input)
      }
    }
  }

  onInputShow (input) {
    input.value = this.text.getText()
    this.elem.classList.add('block-input-open')
  }

  onInputHide (input) {
    this.elem.classList.remove('block-input-open')
  }

  storeAllInputsIn (arr) {
    if (this._block) {
      super.storeAllInputsIn(arr)
    } else if (this.isEditable) {
      arr.push(this)
    }
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
  booleanSide: 7
}

class StringInput extends Input {
  constructor(blocks, initValue) {
    super(blocks, initValue)
    this._onClick = this._onClick.bind(this)

    this.elem.classList.add('block-string-input')
    this.isEditable = true

    this.blocks.onClick(this.elem, this._onClick)
  }

  drawInputBack () {
    const {
      stringHorizPadding: horizPadding,
      stringVertPadding: vertPadding,
      stringHeight: inputHeight
    } = Input.renderOptions
    const {width, height} = this.text.measurements
    this.text.setPosition(horizPadding, vertPadding + inputHeight / 2)
    const path = `M0 0 H${width + horizPadding * 2} V${inputHeight + vertPadding * 2} H0 z`
    this.path.setAttributeNS(null, 'd', path)
    return {width: width + horizPadding * 2, height: inputHeight + vertPadding * 2}
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
  constructor(blocks, initValue) {
    super(blocks, initValue)
    this._onClick = this._onClick.bind(this)

    this.elem.classList.add('block-number-input')
    this.isEditable = true
    this.isNumber = true

    this.blocks.onClick(this.elem, this._onClick)
  }

  drawInputBack () {
    const {
      numberHorizPadding: horizPadding,
      numberVertPadding: vertPadding,
      numberHeight: inputHeight,
      numberMinWidth: minWidth
    } = Input.renderOptions
    const {height} = this.text.measurements
    const width = Math.max(this.text.measurements.width, minWidth)
    const radius = vertPadding + inputHeight / 2
    this.text.setPosition(horizPadding, radius)
    const path = `M${radius} ${radius * 2} a${radius} ${radius} 0 0 1 0 ${-radius * 2}`
      + `H${width + horizPadding * 2 - radius} a${radius} ${radius} 0 0 1 0 ${radius * 2} z`
    this.path.setAttributeNS(null, 'd', path)
    return {width: width + horizPadding * 2, height: radius * 2}
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
  constructor(blocks) {
    super(blocks)
    this.elem.classList.add('block-boolean-input')
  }

  drawInputBack() {
    const {
      booleanHeight: height,
      booleanWidth: width,
      booleanSide: side
    } = Input.renderOptions
    const path = `M0 ${height / 2} L${side} 0 H${width - side} L${width} ${height / 2}`
      + `L${width - side} ${height} H${side} z`
    this.path.setAttributeNS(null, 'd', path)
    return {width, height}
  }
}
