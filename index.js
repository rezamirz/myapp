const express = require('express');
//const helmet = require("helmet");

// Get a debug logger for web socket
const wsDebugger = require('debug')('mypeer:ws');

// Middleware function to log HTTP requests
const morgan = require('morgan');

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
app.use(express.static('public'));
//app.use(helmet());

if (app.get('env') === 'development') {
    app.use(morgan('tiny'));
    console.log('Morgan enabled ...');
}


var clients = new Map();

// Map of meetingId to the meeting
// A meeting is an array of clients that joined together
var meetings = new Map();

// first argument is the route
// the second is a callback function to handle the route
app.get('/', (req, res) => {
    res.send('Hello World\n');
})

// Get the info about all meetings
app.get('/api/meetings', (req, res) => {
    let result = [];
    meetings.forEach((meeting, meetingId) => {
        console.log("pushing meeting " + JSON.stringify(meeting));
        result.push({meetingId: meetingId});
    });

    res.send(result);
})

// Get info about a single meeting
app.get('/api/meetings/:meetingId', (req, res) => {
    meeting = meetings.get(req.params.meetingId);
    if (!meeting) { // HTTP 404
        res.status(404).send('meeting not found');
    }
    res.send(meeting);
})

// Create a new meeting
// info about the meeting is in the body of the request
app.post('/api/meetings', (req, res) => {

    const meeting = {
        meetingId: uuidv4(),
    };

    meetings.set(meeting.meetingId, []);

    // Send created user to the client
    res.send(meeting);
})

// Join a meeting
app.post('/api/meetings/:meetingId', (req, res) => {
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
        wsDebugger("Add ws.id " + client.id + " to the meeting ... len=" + meeting.length);
    }
    meetings.set(meetingId, meeting);
    return meeting;
}

function broadcastMessage(meeting, wsSocket, msg) {
    for (var i = 0; i < meeting.length; i++) {
        if (meeting[i] && meeting[i] != wsSocket) {
            try {
                wsDebugger("broadcastMessage to " + meeting[i].id + ", wsSoket.id=" + wsSocket.id + ", msg=" + JSON.stringify(msg));
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
  