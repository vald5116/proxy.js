var 
httpProxy = require("http-proxy"),
http = require("http"),
access = '::ffff:46.147.253.218', // IP Для которого разрешен доступ. Можно переделать под in_array. 
url = require("url"),
logger = require('pino')(),
net = require('net'),
regex_hostport = /^([^:]+)(:([0-9]+))?$/,
server = http.createServer(function (req, res) {
  var urlObj = url.parse(req.url);
  var target = urlObj.protocol + "//" + urlObj.host;
  if(res.socket.remoteAddress != access) return res.end("Access Denied: " + res.socket.remoteAddress); // При заходе на HTTP при блоке выдаст ваш адрес.
  logger.info(req);
  console.log("Proxy HTTP request for:", target);
  var proxy = httpProxy.createProxyServer({});
  proxy.on("error", function (err, req, res) {
    console.log("proxy error", err);
    res.end();
  });
  proxy.web(req, res, {target: target});
}).listen(65535); 

var getHostPortFromString = function (hostString, defaultPort) {
  let 
  host = hostString,
  port = defaultPort,
  result = regex_hostport.exec(hostString);
  if (result != null) {
    host = result[1];
    if (result[2] != null) port = result[3];
  }
  return ([host, port]);
};

server.addListener('connect', function (req, socket, bodyhead) {
  var 
  hostPort = getHostPortFromString(req.url, 443),
  hostDomain = hostPort[0],
  port = parseInt(hostPort[1]),
  proxySocket = new net.Socket();
  console.log("Proxying HTTPS request for:", hostDomain, port);
  if(req.socket.remoteAddress != access) return socket.end("Access Denied");
  logger.info(req);
  proxySocket.connect(port, hostDomain, function () {
      proxySocket.write(bodyhead);
      socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    }
  );
  proxySocket.on('error', function () {
    socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
    socket.end();
  });
  proxySocket.on('data', (chunk) => socket.write(chunk));
  proxySocket.on('end', () => socket.end());
  socket.on('data', (chunk) =>proxySocket.write(chunk));
  socket.on('end', () => proxySocket.end());
  socket.on('error', () => proxySocket.end());
});