var Stream = require('stream');

function SS(size, streamOpts) {
  streamOpts = streamOpts || {};
  streamOpts.decodeStrings = false;
  Stream.Writable.call(this, streamOpts);

  this.streamOpts = streamOpts;
  this.size = size || 10;
  this.trackedElements = new Map();
  this.registers = new Array(this.size);
  this.numUsedBuckets = 0;
  this.computeConstants();

  for (var i = 0; i < this.registers.length; i++) {
    this.registers[i] = {
      count: null,
      elements: new Map()
    };
  }
}

SS.prototype = Object.create(Stream.Writable.prototype);
SS.prototype.constructor = SS;

SS.prototype.computeConstants = function() {
  this.nextCounter = 0;
  this.nextLimit = 1000;
};

SS.prototype._write = function(chunk, enc, next) {
  var buf = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk);
  var key = buf.toString('hex');

  if (this.trackedElements.has(key)) {
    //increment count
    this.incrementElement(key);
  }
  else {
    if (this.trackedElements.size === this.size) {
      //kick out the min element
      this.popElement(0);
      this.addElement(chunk, key, this.registers[0].count + 1, this.registers[0].count);
    }
    else {
      this.addElement(chunk, key, 1, 0, 0);
    }
  }

  if (next) {
    this.nextCounter = (this.nextCounter + 1) % this.nextLimit;
    if (this.nextCounter === 0) {
      setTimeout(next, 0);
    }
    else {
      next();
    }
  }

  return true;
};

SS.prototype.findInsertionIdx = function(count) {
  //check first bucket since the min element will be replaced often
  if (this.registers[0].count >= count) {
    return 0;
  }

  var curIdx = Math.floor(this.numUsedBuckets / 2);
  var delta = Math.max(1, Math.floor(curIdx / 2));
  var maxIdx = this.numUsedBuckets - 1;

  do {
    if (this.registers[curIdx].count === count) {
      break;
    }
    if (this.registers[curIdx].count < count) {
      curIdx += delta;
    }
    else {
      curIdx -= delta;
    }
    delta = Math.max(1, Math.floor(delta / 2));
  } while (curIdx > 0 && curIdx < maxIdx);

  return Math.max(0, Math.min(this.numUsedBuckets, curIdx));
};

SS.prototype.findIdx = function(count) {
  return Math.min(this.numUsedBuckets - 1, this.findInsertionIdx(count));
};

SS.prototype.incrementElement = function(key) {
  var result = this.removeElement(key);
  return this.addElement(result.value, key, result.count + 1, result.error);
};

SS.prototype.popElement = function(idx) {
  return this.removeElement(this.registers[idx].elements.keys().next().value, idx);
};

SS.prototype.removeElement = function(key, idx) {
  var record = this.trackedElements.get(key);
  idx = idx === undefined ? this.findIdx(record.count) : idx;

  this.registers[idx].elements.delete(key);
  this.trackedElements.delete(key);

  if (this.registers[idx].elements.size === 0) {
    this.registers[idx].count = null;
    this.registers.push(this.registers.splice(idx, 1)[0]);
    this.numUsedBuckets--;
  }

  return record;
};

SS.prototype.addElement = function(element, key, count, error, idx) {
  idx = idx === undefined ? this.findInsertionIdx(count) : idx;
  error = error || 0;

  if (this.registers[idx].count !== count) {
    this.registers.splice(idx, 0, this.registers.pop());
    this.registers[idx].count = count;
    this.numUsedBuckets++;
  }
  this.registers[idx].elements.set(key, true);

  this.trackedElements.set(key, {count: count, error: error, value: element});
};

SS.prototype.frequency = function(element) {
  if (!Buffer.isBuffer(element)) {
    element = new Buffer(element);
  }

  var key = element.toString('hex');
  var record = this.trackedElements.get(key);
  return record === undefined ? null : record.count - record.error;
};

SS.prototype.top = function() {
  var results = [];

  for (var i = 0; i < this.numUsedBuckets; i++) {
    for (var key of this.registers[i].elements.keys()) {
      results.push(this.trackedElements.get(key).value);
    }
  }

  return results;
};

SS.prototype.export = function() {
  var trackedElements = {};
  for (var entry of this.trackedElements.entries()) {
    trackedElements[entry[0]] = {
      value: entry[1].value,
      count: entry[1].count,
      error: entry[1].error
    };
  }

  var registers = [];
  var elements;
  for (var entry of this.registers.entries()) {
    entry = entry[1];
    elements = {};
    for (var element of entry.elements.entries()) {
      elements[element[0]] = element[1];
    }
    registers.push({elements: elements, count: entry.count});
  }

  return {
    size: this.size,
    trackedElements: trackedElements,
    registers: registers,
    numUsedBuckets: this.numUsedBuckets
  };
};

SS.prototype.import = function(data) {
  this.size = data.size;
  this.numUsedBuckets = data.numUsedBuckets;
  this.computeConstants();
  this.registers = new Array(this.size);
  this.trackedElements = new Map();

  for (var key in data.trackedElements) {
    if (data.trackedElements.hasOwnProperty(key)) {
      this.trackedElements.set(key, {
        value: data.trackedElements[key].value,
        count: data.trackedElements[key].count,
        error: data.trackedElements[key].error
      });
    }
  }

  for (var i = 0; i < this.registers.length; i++) {
    this.registers[i] = {
      count: data.registers[i].count,
      elements: new Map()
    };

    for (key in data.registers[i].elements) {
      if (data.registers[i].elements.hasOwnProperty(key)) {
        this.registers[i].elements.set(key, true);
      }
    }
  }
};

SS.prototype.merge = function(ss) {
  var result = new SS(this.size + ss.size, this.streamOpts);

  //merge tracked elements
  var mergedElements = new Map();
  var el1;
  var el2;
  for (var key of this.trackedElements.keys()) {
    el1 = this.trackedElements.get(key);

    if (ss.trackedElements.has(key)) {
      el2 = ss.trackedElements.get(key);

      mergedElements.set(key, {
        value: el1.value,
        count: el1.count + el2.count,
        error: el1.error + el2.error
      });
    }
    else {
      mergedElements.set(key, {
        value: el1.value,
        count: el1.count,
        error: el1.error
      });
    }
  }
  for (key of ss.trackedElements.keys()) {
    if (!this.trackedElements.has(key)) {
      el1 = ss.trackedElements.get(key);

      mergedElements.set(key, {
        value: el1.value,
        count: el1.count,
        error: el1.error
      });
    }
  }

  //add elements to registers
  for (var entry of mergedElements.entries()) {
    result.addElement(entry[1].value, entry[0], entry[1].count, entry[1].error);
  }

  return result;
};

module.exports = SS;
