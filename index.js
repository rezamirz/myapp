const express = require('express');
const fs = require('fs');
const Joi = require('joi');
const http = require('http');
const https = require('https');
const ws = require('ws');

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

var clients = new Map();
var meetings = new Map();

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

app.post('/api/call/:meetingId', (req, res) => {
    meetingId = req.params.meetingId
})

const port = process.env.PORT || 3000;
const securePort = port + 443

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

const wsServer = new ws.Server({ noServer: true });
wsServer.on('connection', wsSocket => {
  wsSocket.id = uuidv4();
  wsSocket.on('message', message => {
    msg = JSON.parse(message);
    if (!msg.head.meetingId) {
        console.log("ERROR missing meetingId, wsSocket=" + JSON.stringify(wsSocket));
        return;
    }

    console.log("wsSocket.id " + wsSocket.id + " got " + JSON.stringify(msg));

    meetingId = clients.get(wsSocket);
    // If this is the first message coming from this client set the meeting ID for the client.
    if (!meetingId) {
        meetingId = msg.head.meetingId;
        clients.set(wsSocket, meetingId);
    } else if (meetingId != msg.head.meetingId) {
        console.log("ERROR mismatch meetingId, exisitng meetingId=" + meetingId + ", new meetingId=" + msg.head.meetingId);
        return;
    }

    meeting = addToMeeting(meetingId, wsSocket);
    broadcastMessage(meeting, wsSocket, msg.body);

  });
});

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function addToMeeting(meetingId, client) {
    let meeting = meetings.get(meetingId);
    if (!meeting) {
        console.log("addToMeeting meetingId=" + meetingId + " not found");
        meeting = [];
    }

    let c = meeting.find(c => c === client);
    if (!c) {
        meeting.push(client);
        //console.log("Add ws.id " + client.id + " to the meeting ... len=" + meeting.length);
    }
    meetings.set(meetingId, meeting);
    return meeting;
}

function broadcastMessage(meeting, wsSocket, msg) {
    for (var i = 0; i < meeting.length; i++) {
        if (meeting[i] && meeting[i] != wsSocket) {
            try {
                //console.log("broadcastMessage to " + meeting[i].id + ", wsSoket.id=" + wsSocket.id + ", msg=" + JSON.stringify(msg));
                meeting[i].send(JSON.stringify(msg));
            } catch(e) {}
        }
    }
}

httpServer.listen(port, () => {console.log(`Listening on port ${port} ...`)});
httpsServer.listen(securePort, () => {console.log(`Listening on port ${securePort} ...`)});

httpServer.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, socket => {
    wsServer.emit('connection', socket, request);
  });
});

httpsServer.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
});
  