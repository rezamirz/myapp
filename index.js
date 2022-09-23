const express = require('express');
const meetings = require('./meetings')
var meetingsMap = require('./meetings').meetingsMap;
const helmet = require("helmet");

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

// To handle static pages
app.use(express.static('public'));
app.use(helmet());

app.use('/api/meetings', meetings);

if (app.get('env') === 'development') {
    app.use(morgan('tiny'));
    console.log('Morgan enabled ...');
}


var clients = new Map();

// first argument is the route
// the second is a callback function to handle the route
app.get('/', (req, res) => {
    res.send('Welcome to MyPeer\n');
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
    let meeting = meetingsMap.get(meetingId);
    if (!meeting) {
        console.log("addToMeeting meetingId=" + meetingId + " not found");
        meeting = [];
    }

    let c = meeting.find(c => c === client);
    if (!c) {
        meeting.push(client);
        wsDebugger("Add ws.id " + client.id + " to the meeting ... len=" + meeting.length);
    }
    meetingsMap.set(meetingId, meeting);
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
  