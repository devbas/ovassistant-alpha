class Queue {
  constructor(elements) {

    if(elements.length > 0) {
      this.items = elements 
    } else {
      this.items = []
    }

  }

  enqueue(element) {
    this.items.push(element)
  }

  dequeue() {
    if(this.isEmpty()) {
      return false 
    }

    return this.items.shift()
  }

  front() {
    if(this.isEmpty()) {
      return false 
    }

    return this.items[0]
  }

  isEmpty() {
    return this.items.length === 0
  }

  queueSize() { 
    return this.items.length
  }
}

module.exports = { Queue };