/**
 * A simple example showing the use of the cursorstream pause function.
 *
 * @_class cursorstream
 * @_function pause
 * @ignore
 */
exports.shouldStreamDocumentsUsingTheCursorStreamPauseFunction = function(configuration, test) {
  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a lot of documents to insert
    var docs = []
    for(var i = 0; i < 1; i++) {
      docs.push({'a':i})
    }

    // Create a collection
    db.createCollection('test_cursorstream_pause', function(err, collection) {
      test.equal(null, err);

      // Insert documents into collection
      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find().stream();

        // For each data item
        stream.on("data", function(item) {
          // Check if cursor is paused
          test.equal(false, stream.paused);
          // Pause stream
          stream.pause();
          // Check if cursor is paused
          test.equal(true, stream.paused);

          // Restart the stream after 1 miliscecond
          setTimeout(function() {
            stream.resume();
            // Check if cursor is paused
            process.nextTick(function() {
              test.equal(false, stream.paused);
            })
          }, 1);
        });

        // When the stream is done
        stream.on("close", function() {
          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}

/**
 * A simple example showing the use of the cursorstream resume function.
 *
 * @_class cursorstream
 * @_function resume
 * @ignore
 */
exports.shouldStreamDocumentsUsingTheCursorStreamResumeFunction = function(configuration, test) {
  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a lot of documents to insert
    var docs = []
    for(var i = 0; i < 1; i++) {
      docs.push({'a':i})
    }

    // Create a collection
    db.createCollection('test_cursorstream_resume', function(err, collection) {
      test.equal(null, err);

      // Insert documents into collection
      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find().stream();

        // For each data item
        stream.on("data", function(item) {
          // Check if cursor is paused
          test.equal(false, stream.paused);
          // Pause stream
          stream.pause();
          // Check if cursor is paused
          test.equal(true, stream.paused);

          // Restart the stream after 1 miliscecond
          setTimeout(function() {

            // Resume the stream
            stream.resume();

            // Check if cursor is paused
            process.nextTick(function() {
              test.equal(false, stream.paused);
            });
          }, 1);
        });

        // When the stream is done
        stream.on("close", function() {
          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}

/**
 * A simple example showing the use of the cursorstream resume function.
 *
 * @_class cursorstream
 * @_function destroy
 * @ignore
 */
exports.shouldStreamDocumentsUsingTheCursorStreamDestroyFunction = function(configuration, test) {
  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a lot of documents to insert
    var docs = []
    for(var i = 0; i < 1; i++) {
      docs.push({'a':i})
    }

    // Create a collection
    db.createCollection('test_cursorstream_destroy', function(err, collection) {
      test.equal(null, err);

      // Insert documents into collection
      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find().stream();

        // For each data item
        stream.on("data", function(item) {
          // Destroy stream
          stream.destroy();
        });

        // When the stream is done
        stream.on("close", function() {
          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}

exports.shouldStreamDocumentsWithPauseAndResumeForFetching = function(configuration, test) {
  var docs = []

  for(var i = 0; i < 3000; i++) {
    docs.push({'a':i})
  }

  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // Establish connection to db
  db.open(function(err, db) {
    db.createCollection('test_streaming_function_with_limit_for_fetching2', function(err, collection) {

      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find({}).stream();
        var data = [];

        // For each data item
        stream.on("data", function(item) {
          stream.pause()

          collection.findOne({}, function(err, result) {
            data.push(1);
            stream.resume();
          })
        });

        // When the stream is done
        stream.on("close", function() {
          test.equal(3000, data.length);
          db.close();
          test.done();
        });
      });
    });
  });
}

exports.shouldStream10KDocuments = function(configuration, test) {
  var Binary = configuration.getMongoPackage().Binary;
  var docs = []

  for(var i = 0; i < 10000; i++) {
    docs.push({'a':i, bin: new Binary(new Buffer(256))})
  }

  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // Establish connection to db
  db.open(function(err, db) {
    db.createCollection('test_streaming_function_with_limit_for_fetching_2', function(err, collection) {

      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find({}).stream();
        var data = [];

        // For each data item
        stream.on("data", function(item) {
          stream.pause()

          collection.findOne({}, function(err, result) {
            data.push(1);
            stream.resume();
          })
        });

        // When the stream is done
        stream.on("close", function() {
          test.equal(10000, data.length);
          db.close();
          test.done();
        });
      });
    });
  });
}

exports.shouldTriggerMassiveAmountOfGetMores = function(configuration, test) {
  var Binary = configuration.getMongoPackage().Binary;
  var docs = []
  var counter = 0;
  var counter2 = 0;

  for(var i = 0; i < 1000; i++) {
    docs.push({'a':i, bin: new Binary(new Buffer(256))})
  }

  var db = configuration.newDbInstance({w:0}, {poolSize:1});

  // Establish connection to db
  db.open(function(err, db) {
    db.createCollection('test_streaming_function_with_limit_for_fetching_3', function(err, collection) {

      collection.insert(docs, {w:1}, function(err, ids) {
        // Peform a find to get a cursor
        var stream = collection.find({}).stream();
        var data = [];

        // For each data item
        stream.on("data", function(item) {
          counter++;
          stream.pause()
          stream.resume();
          counter2++;
        });

        // When the stream is done
        stream.on("close", function() {
          test.equal(1000, counter);
          test.equal(1000, counter2);
          db.close();
          test.done();
        });
      });
    });
  });
}

exports.shouldStreamRecordsCallsDataTheRightNumberOfTimes = function(configuration, test) {
  var client = configuration.db();

  client.createCollection('test_stream_records', function(err, collection) {

    collection.insert([{'a':1}, {'b' : 2}, {'c' : 3}, {'d' : 4}, {'e' : 5}], {w:1}, function(err, ids) {
      var stream = collection.find({}, {'limit' : 3}).streamRecords();
      var callsToEnd = 0;
      stream.on('end', function() { 
        test.done();
      });
      
      var callsToData = 0;
      stream.on('data',function(data){ 
        callsToData += 1;
        test.ok(callsToData <= 3);
      }); 
    });
  });    
}

exports.shouldStreamRecordsCallsEndTheRightNumberOfTimes = function(configuration, test) {
  var client = configuration.db();

  client.createCollection('test_stream_records', function(err, collection) {

    collection.insert([{'a':1}, {'b' : 2}, {'c' : 3}, {'d' : 4}, {'e' : 5}], {w:1}, function(err, ids) {
      var cursor = collection.find({}, {'limit' : 3});
      var stream = cursor.streamRecords(function(er,item) {}); 
      var callsToEnd = 0;
      stream.on('end', function() { 
        callsToEnd += 1;
        test.equal(1, callsToEnd);
        setTimeout(function() {
          // Let's close the db
          if (callsToEnd == 1) {
            test.done();
          }
        }.bind(this), 1000);
      });
      
      stream.on('data',function(data){ /* nothing here */ }); 
    });
  });    
}

exports.shouldStreamDocumentsWithLimitForFetching = function(configuration, test) {
  var client = configuration.db();
  var docs = []
  
  for(var i = 0; i < 3000; i++) {
    docs.push({'a':i})
  }

  client.createCollection('test_streaming_function_with_limit_for_fetching', function(err, collection) {

    collection.insert(docs, {w:1}, function(err, ids) {        
      var cursor = collection.find({});
      // Execute find on all the documents
      var stream = cursor.streamRecords({fetchSize:1000}); 
      var callsToEnd = 0;
      stream.on('end', function() { 
        test.done();
      });

      var callsToData = 0;
      stream.on('data',function(data){ 
        callsToData += 1;
        test.ok(callsToData <= 3000);
      }); 
    });
  });    
}
