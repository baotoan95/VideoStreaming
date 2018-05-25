var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');
var url = require('url');
var fs = require('fs');

var indexRouter = require('./routes/video-streaming');
var usersRouter = require('./routes/users');

var app = express();

var server = http.createServer(app);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

server.listen(3000, () => {
  console.log('Server started on port ' + server.address().port);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  httpListener(req, res);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

var resourceLocation = '/home/baotoan/Temps';
var mimeNames = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'application/ogg',
  '.ogv': 'video/ogg',
  '.oga': 'audio/ogg',
  '.txt': 'text/plain',
  '.wav': 'audio/x-wav',
  '.webm': 'video/webm'
}

function httpListener(req, res) {
  var fileName = resourceLocation + url.parse(req.url, true, true).pathname.split('/').join(path.sep);

  if (!fs.existsSync(fileName)) {
    sendResponse(res, 404, null, null);
    return null;
  }

  var responseHeaders = {};
  var stat = fs.statSync(fileName);
  var rangeRequest = readRangeHeader(req.headers['range'], stat.size);

  // If 'Range' header exists, we will parse it with Regular Expression
  if (rangeRequest === null) {
    responseHeaders['Content-Type'] = getMimeNameFormExt(path.extname(fileName));
    responseHeaders['Content-Length'] = stat.size;
    responseHeaders['Accept-Ranges'] = 'bytes';
    // If not, will return file directly
    sendResponse(res, 200, responseHeaders, fs.createReadStream(fileName));
  }

  var start = rangeRequest.Start;
  var end = rangeRequest.End;

  if (start >= stat.size || end >= stat.size) {
    // Indicate the acceptable range
    responseHeaders['Content-Range'] = 'bytes */' + stat.size;
    // Return the 416 'Requested Range Not Satisfiable'
    sendResponse(res, 416, responseHeaders, null);
    return null;
  }

  // Indicate current range
  responseHeaders['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
  responseHeaders['Content-Length'] = start === end ? 0 : (end - start + 1);
  responseHeaders['Content-Type'] = getMimeNameFormExt(path.extname(fileName));
  responseHeaders['Accept-Ranges'] = 'bytes';
  responseHeaders['Cache-Control'] = 'no-cache';

  sendResponse(res, 206, responseHeaders, fs.createReadStream(fileName, { start: start, end: end }));
}

function sendResponse(response, responseStatus, responseHeaders, readable) {
  response.writeHead(responseStatus, responseHeaders);

  if (readable === null) {
    response.end('Not response');
  } else {
    readable.on('open', () => {
      readable.pipe(response);
    });
  }
  return null;
}

function getMimeNameFormExt(ext) {
  var result = mimeNames[ext.toLowerCase()];

  if (result == null) {
    return 'application/octet-stream';
  }
  return result;
}

function readRangeHeader(range, totalLength) {
  if (range === null || range.length === 0) {
    return null;
  }
  
  var array = range.split(/bytes=([0-9]*)-([0-9]*)/);
  var start = parseInt(array[1]);
  var end = parseInt(array[2]);
  var result = {
    Start: isNaN(start) ? 0 : start,
    End: isNaN(end) ? (totalLength - 1) : end
  }

  if (!isNaN(start) && isNaN(end)) {
    result.Start = start;
    result.End = totalLength - 1;
  }

  if (isNaN(start) && !isNaN(end)) {
    result.Start = totalLength - end;
    result.End = totalLength - 1;
  }

  return result;
}