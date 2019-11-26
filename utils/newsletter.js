/**
 * A Newsletter allows one to subscribe to events that it may trigger.
 */
class Newsletter {
  constructor () {
    this._listeners = {}
  }

  on (eventName, fn) {
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = []
    }
    this._listeners[eventName].push(fn)
    return fn
  }

  off (eventName, fn) {
    const listeners = this._listeners[eventName]
    if (listeners) {
      const index = listeners.indexOf(fn)
      if (~index) {
        listeners.splice(index, 1)
      }
    }
  }

  trigger (eventName, ...args) {
    const listeners = this._listeners[eventName]
    if (listeners) {
      for (const fn of listeners) {
        fn(...args)
      }
    }
  }
}

export { Newsletter }
