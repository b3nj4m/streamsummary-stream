var Stream = require('stream');

function SS(size, streamOpts) {
  Stream.Writable.call(this, streamOpts);

  this.size = size || 10;
  this.trackedElements = new Map();
  this.registers = new Array(this.size);
  this.numUsedBuckets = 0;

  for (var i = 0; i < this.registers.length; i++) {
    this.registers[i] = {
      count: null,
      elements: new Map()
    };
  }
}

SS.prototype = Object.create(Stream.Writable.prototype);
SS.prototype.constructor = SS;

SS.prototype.write = function(chunk, enc, next) {
  var buf = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk);
  var key = buf.toString('hex');
  var oldCount = this.trackedElements.get(key);

  if (oldCount === undefined) {
    if (this.trackedElements.size === this.size) {
      //kick out the min element
      var deletedKey = this.registers[0].elements.keys().next().value;
      this.registers[0].elements.delete(deletedKey);
      this.trackedElements.delete(deletedKey);

      var err = this.registers[0].count;
      var nextBucket = 1;

      if (this.registers[0].elements.size === 0) {
        //move empty bucket to the end
        this.registers[0].count = null;
        this.registers.push(this.registers.splice(0, 1)[0]);
        this.numUsedBuckets--;
        nextBucket = 0;
      }

      //nextBucket is larger count, add new bucket
      this.addElement(chunk, key, oldCount + 1, err, nextBucket);
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
    next();
  }

  return true;
};

SS.prototype.findInsertionIdx = function(count) {
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
  var idx = this.findIdx(this.trackedElements.get(key));
  var element = this.registers[idx].elements.get(key);
  this.registers[idx].elements.delete(key);

  return this.addElement(element, key, this.registers[idx].count + 1);
};

SS.prototype.addElement = function(element, key, count, error, idx) {
  idx = idx === undefined ? this.findInsertionIdx(count) : idx;

  if (this.registers[idx].count !== count) {
    this.registers.splice(idx, 0, this.registers.pop());
    this.registers[idx].count = count;
    this.numUsedBuckets++;
  }
  //TODO error is per-element
  this.registers[idx].error = error;
  this.registers[idx].elements.set(key, element);

  this.trackedElements.set(key, count);
};

SS.prototype.frequency = function(element) {
  if (!Buffer.isBuffer(element)) {
    element = new Buffer(element);
  }

  var key = element.toString('hex');
  var count = this.trackedElements.get(key);
  return count === undefined ? null : count;
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
