const express = require('express');
var fs = require('fs');
const Joi = require('joi');

const http = require('http');
const https = require('https');

const privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
const certificate = fs.readFileSync('sslcert/server.crt', 'utf8');

const credentials = {key: privateKey, cert: certificate};

// Create express application
const app = express();

// To enable parsing json objects in the app
app.use(express.json());
app.use(express.static('public'))

const users = [
    {id: 1, username: 'reza', password: 'reza'},
    {id: 2, username: 'serban', password: 'serban'},
    {id: 3, username: 'lukas', password: 'likas'},
    {id: 3, username: 'michelle', password: 'michelle'},
];

lastId = 1;

// first argument is the route
// the second is a callback function to handle the route
app.get('/', (req, res) => {
    res.send('Hello World\n');
})

app.get('/api/users', (req, res) => {
    res.send(users)
})

// route to get a single user
app.get('/api/users/:id', (req, res) => {
    const user = users.find(c => c.id === parseInt(req.params.id));
    if (!user) { // HTTP 404
        res.status(404).send('user not found');
    }
    res.send(user);
})

// Create a user
// info about the user is in the body of the request
app.post('/api/users', (req, res) => {

    // We can use joi for validation, define a joi schema for validation
    const schema = Joi.object({
        username: Joi.string().min(3).required()
    });

    const result = schema.validate(req.body.username)
    if (result.error) {
        // 400 Bad request
        res.status(400).send(result.error)
        return
    }

    const user = {
        id: lastId,
        username: req.body.username,
    };
    lastId++

    users.push(user);

    // Send created user to the client
    res.send(user);
})

const port = process.env.PORT || 3000;
const securePort = port + 443

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(port, () => {console.log(`Listening on port ${port} ...`)});
httpsServer.listen(securePort, () => {console.log(`Listening on port ${securePort} ...`)});
//app.listen(port, () => {console.log(`Listening on port ${port} ...`)})
