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
