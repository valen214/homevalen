

const http = require('http');
const fs = require("fs");

const hostname = '0.0.0.0';
const port = 8128;

const server = http.createServer((req, res) => {
    console.log(req.path);
    console.log(req.method, req.url);


    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // res.setHeader("Set-Cookie", "cookie1=cookievalue1;exip");
    // res.cookie();
    
    res.end(fs.readFileSync("./pages/images.htm"));
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});