var Stream = require('stream');
var SS = require('./index');

var expect = require('chai').expect;

function makeSummary(size, numElements, callback) {
  var s = new SS(size);
  var rs = new Stream.Readable({encoding: 'utf-8'});
  var i = 0;
  var element = '42';

  rs._read = function() {
    var pushed = true;

    while (pushed && i < size) {
      pushed = this.push((i++).toString());
    }
    while (pushed && numElements > 0) {
      pushed = this.push(element);
      numElements--;
    }
    if (pushed) {
      this.push(null);
    }
  };

  s.on('finish', callback.bind(this, s, element));

  rs.pipe(s);
}

describe('StreamSummary', function() {
  describe('initial state', function() {
    it('should have empty trackedElements', function() {
      var s = new SS();
      expect(s.trackedElements).to.be.an.instanceof(Map);
      expect(s.trackedElements.size).to.equal(0);
    });
    it('should have `size` registers with empty elements map', function() {
      var s = new SS();
      expect(s.registers.length).to.equal(s.size);
      for (var i = 0; i < s.registers.length; i++) {
        expect(s.registers[i].elements).to.be.an.instanceof(Map);
        expect(s.registers[i].elements.size).to.equal(0);
        expect(s.registers[i].count).to.be.null;
      }
    });

    it('should have 0 used buckets', function() {
      var s = new SS();
      expect(s.numUsedBuckets).to.equal(0);
    });
  });

  describe('import/export', function() {
    it('should export', function(done) {
      makeSummary(10, 10, function(s, element) {
        var data = s.export();
        expect(data.size).to.equal(s.size);
        expect(data.numUsedBuckets).to.equal(s.numUsedBuckets);
        expect(data.registers).not.to.equal(s.registers);
        expect(data.registers.length).to.equal(s.registers.length);
        expect(data.trackedElements).not.to.equal(s.trackedElements);
        expect(data.trackedElements).to.be.an('object');

        for (var i = 0; i < data.registers.length; i++) {
          expect(data.registers[i]).not.to.equal(s.registers[i]);
          expect(data.registers[i].count).to.equal(s.registers[i].count);
          expect(data.registers[i].elements).not.to.equal(s.registers[i].elements);
          expect(data.registers[i].elements).to.be.an('object');

          for (var key in data.registers[i].elements) {
            if (data.registers[i].elements.hasOwnProperty(key)) {
              expect(data.registers[i].elements[key]).to.equal(s.registers[i].elements.get(key));
            }
          }
        }

        for (var key in data.trackedElements) {
          if (data.trackedElements.hasOwnProperty(key)) {
            expect(data.trackedElements[key].count).to.equal(s.trackedElements.get(key).count);
            expect(data.trackedElements[key].error).to.equal(s.trackedElements.get(key).error);
          }
        }

        done();
      });
    });

    it('should import', function(done) {
      makeSummary(10, 10, function(s, element) {
        var s2 = new SS();
        s2.import(s.export());

        expect(s2.size).to.equal(s.size);
        expect(s2.numUsedBuckets).to.equal(s.numUsedBuckets);
        expect(s2.registers).not.to.equal(s.registers);
        expect(s2.registers.length).to.equal(s.registers.length);
        expect(s2.trackedElements).not.to.equal(s.trackedElements);
        expect(s2.trackedElements).to.be.an.instanceof(Map);

        for (var i = 0; i < s2.registers.length; i++) {
          expect(s2.registers[i]).not.to.equal(s.registers[i]);
          expect(s2.registers[i].count).to.equal(s.registers[i].count);
          expect(s2.registers[i].elements).not.to.equal(s.registers[i].elements);
          expect(s2.registers[i].elements).to.be.an.instanceof(Map);

          for (var entry of s.registers[i].elements.entries()) {
            expect(s2.registers[i].elements.get(entry[0])).to.equal(entry[1]);
          }
        }

        for (entry of s.trackedElements.entries()) {
          expect(s2.trackedElements.get(entry[0]).count).to.equal(entry[1].count);
          expect(s2.trackedElements.get(entry[0]).error).to.equal(entry[1].error);
        }

        done();
      });
    });
  });

  describe('frequency', function() {
    it('should count frequent element', function(done) {
      makeSummary(10, 10, function(s, element) {
        expect(s.frequency(element)).to.equal(10);

        var top = s.top();
        expect(top.length).to.equal(10);
        expect(top[9]).to.equal(element);
        done();
      });
    });
  });
});
