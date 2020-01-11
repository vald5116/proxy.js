var 
dns = require('dns'), // Модуль необходимый, если у вас dyndns для автоматического разрешения прокси, под ваш IP
httpProxy = require("http-proxy"), http = require("http"), url = require("url"), net = require('net'), config = require('./config'),
access = '::ffff:' + config.ip,
regex_hostport = /^([^:]+)(:([0-9]+))?$/,
server = http.createServer(function (req, res) {
  var urlObj = url.parse(req.url);
  var target = urlObj.protocol + "//" + urlObj.host;
  if(res.socket.remoteAddress != access) return res.end("Access Denied");
  console.log("Proxy HTTP request for:", target);
  var proxy = httpProxy.createProxyServer({});
  proxy.on("error", function (err, req, res) {
    res.end("Offline");
  });
  proxy.web(req, res, {target: target});
}).listen(config.port); // Порт для запуска сервера.

if(config.ddns) {
  setInterval(() => {
    return dns.lookup(config.ddns, (err, address, family) => { access = '::ffff:' + address; });
  }, 300000);
}

var getHostPortFromString = function (hostString, defaultPort) {
  let host = hostString, port = defaultPort,
  result = regex_hostport.exec(hostString);
  if (result != null) { host = result[1]; if (result[2] != null) port = result[3]; }
  return ([host, port]);
};

server.addListener('connect', function (req, socket, bodyhead) {
  var hostPort = getHostPortFromString(req.url, 443),
  hostDomain = hostPort[0],
  port = parseInt(hostPort[1]),
  proxySocket = new net.Socket();
  if(req.socket.remoteAddress != access) return socket.end("Access Denied");
  proxySocket.connect(port, hostDomain, function () {
      proxySocket.write(bodyhead);
      socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    }
  );
  proxySocket.on('error', function () { socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n"); socket.end(); });
  proxySocket.on('data', (chunk) => socket.write(chunk));
  proxySocket.on('end', () => socket.end());
  socket.on('data', (chunk) =>proxySocket.write(chunk));
  socket.on('end', () => proxySocket.end());
  socket.on('error', () => proxySocket.end());
});