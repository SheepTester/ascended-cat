// Relies blocks/component

class Input extends Component {
  constructor (blocks, initValue) {
    super()
    this.blocks = blocks
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
    this._block = block
    if (block) {
      this.path.classList.add('block-hidden')
      this.text.classList.add('block-hidden')
    } else {
      this.path.classList.remove('block-hidden')
      this.text.classList.remove('block-hidden')
    }
  }

  setValue (value, preventUpdate = false) {
    this.value = value
    this.text.setText(value)
    if (!preventUpdate) {
      this.text.resize()
    }
  }

  reposition () {
    this.measurements = this._block ? this._block.measurements : this.drawInputBack()
  }

  drawInputBack () {
    return this.text.measurements
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
    this.elem.classList.add('block-string-input')
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
}

class NumberInput extends Input {
  constructor(blocks, initValue) {
    super(blocks, initValue)
    this.elem.classList.add('block-number-input')
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
