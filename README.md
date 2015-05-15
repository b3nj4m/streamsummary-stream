## streamsummary-stream

Stream-based implementation of the StreamSummary data structure described in [this paper](https://icmi.cs.ucsb.edu/research/tech_reports/reports/2005-23.pdf).

Pipe in your buffers/strings to get approximate top-K most frequent elements.

```javascript
var StreamSummary = require('streamsummary-stream');
var ss = new StreamSummary(50);

//...

myDataSource.pipe(ss);

ss.on('finish', function() {
  console.log(ss.frequency('42'));
  console.log(ss.top());
});
```

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

Export the StreamSummary data as an object.

#### StreamSummary.import(data)

Import a StreamSummary data object (expects same format as `export()` returns).

* `data` - object containing StreamSummary data

#### StreamSummary.merge(ss)

Merge another StreamSummary with this one. The two StreamSummaries must have the same `size`. Returns a new StreamSummary.

* `ss` - another StreamSummary instance

