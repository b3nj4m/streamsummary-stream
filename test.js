var Stream = require('stream');
var SS = require('./index');

var expect = require('chai').expect;

describe('StreamSummary', function() {
  describe('basic functionality', function() {
    it('should work', function() {
      var s = new SS();
      s.write('beans');
      s.write('beans');
      s.write('cheese');
      expect(s.frequency('beans')).to.equal(2);
      expect(s.frequency('cheese')).to.equal(1);
      expect(s.top()).to.deep.equal(['cheese', 'beans']);
    });
  });
});
