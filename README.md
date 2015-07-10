## streamsummary-stream

Stream-based implementation of the StreamSummary data structure described in [this paper](https://icmi.cs.ucsb.edu/research/tech_reports/reports/2005-23.pdf).

Pipe in your buffers/strings to get approximate top-K most frequent elements.

```javascript
var StreamSummary = require('streamsummary-stream');
var es = require('event-stream');
var fs = require('fs');

var ss = new StreamSummary(50);

fs.createReadStream('data.txt')
  .pipe(es.split())
  .pipe(ss);

ss.on('finish', function() {
  console.log('frequency of 42', ss.frequency('42'));
  console.log('top values', ss.top());
});
```

### Requires es6 `Map`

This module uses es6 `Map`s, so you probably need node.js >= 0.12 or io.js.

### API

#### StreamSummary(size, streamOpts)

Construct a new writable StreamSummary to track the `size` most frequent elements (extends [`Stream.Writable`](https://nodejs.org/api/stream.html#stream_class_stream_writable)).

* `size` - the number of elements to track
* `streamOpts` - the options to pass to the Stream constructor

#### StreamSummary.frequency(element)

Get the approximate frequency of `element`. Returns `null` if the element isn't in the top `size` elements.

* `element` - the value in question

#### StreamSummary.top()

Get the top `size` most frequent elements in ascending order of frequency.

#### StreamSummary.export()

Export the StreamSummary data as an object. Exported object will look like:

```javascript
{
  size: 42,
  numUsedBuckets: 40,
  trackedElements: {...},
  registers: [...]
}
```

#### StreamSummary.import(data)

Import a StreamSummary data object (expects same format as `export()` returns).

* `data` - object containing StreamSummary data

#### StreamSummary.merge(ss)

Merge another StreamSummary with this one. Returns a new StreamSummary of `size` equal to the combined sizes of the two.

* `ss` - another StreamSummary instance

