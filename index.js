var Stream = require('stream');

function SS(size, streamOpts) {
  streamOpts = streamOpts || {};
  streamOpts.decodeStrings = false;
  Stream.Writable.call(this, streamOpts);

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
  var oldRecord = this.trackedElements.get(key);

  if (oldRecord === undefined) {
    if (this.trackedElements.size === this.size) {
      //kick out the min element
      this.popElement(0);
      this.addElement(chunk, key, this.registers[0].count + 1, this.registers[0].count);
    }
    else {
      this.addElement(chunk, key, 1, 0, 0);
    }
  }
  else {
    //increment count
    this.incrementElement(key);
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
  return this.addElement(result.element, key, result.record.count + 1, result.record.error);
};

SS.prototype.popElement = function(idx) {
  return this.removeElement(this.registers[idx].elements.keys().next().value, idx);
};

SS.prototype.removeElement = function(key, idx) {
  var record = this.trackedElements.get(key);
  idx = idx === undefined ? this.findIdx(record.count) : idx;
  var element = this.registers[idx].elements.get(key);
  this.registers[idx].elements.delete(key);

  if (this.registers[idx].elements.size === 0) {
    this.registers[idx].count = null;
    this.registers.push(this.registers.splice(idx, 1)[0]);
    this.numUsedBuckets--;
  }

  return {element: element, record: record};
};

SS.prototype.addElement = function(element, key, count, error, idx) {
  //console.log(element, new Error().stack);
  idx = idx === undefined ? this.findInsertionIdx(count) : idx;
  error = error || 0;

  if (this.registers[idx].count !== count) {
    this.registers.splice(idx, 0, this.registers.pop());
    this.registers[idx].count = count;
    this.numUsedBuckets++;
  }
  this.registers[idx].elements.set(key, element);

  this.trackedElements.set(key, {count: count, error: error});
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
    for (var element of this.registers[i].elements.values()) {
      results.push(element);
    }
  }

  return results;
};

module.exports = SS;
