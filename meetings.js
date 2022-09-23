const express = require('express');
const router = express.Router();

// Map of meetingId to the meeting
// A meeting is an array of clients that joined together
var meetingsMap = new Map();

// Get the info about all meetings
router.get('/', (req, res) => {
    let result = [];
    meetingsMap.forEach((meeting, meetingId) => {
        console.log("pushing meeting " + JSON.stringify(meeting));
        result.push({meetingId: meetingId});
    });

    res.send(result);
})

// Get info about a single meeting
router.get('/:meetingId', (req, res) => {
    meeting = meetingsMap.get(req.params.meetingId);
    if (!meeting) { // HTTP 404
        res.status(404).send('meeting not found');
    }
    res.send(meeting);
})

// Create a new meeting
// info about the meeting is in the body of the request
router.post('/', (req, res) => {

    const meeting = {
        meetingId: uuidv4(),
    };

    meetingsMap.set(meeting.meetingId, []);

    // Send created user to the client
    res.send(meeting);
})

// Join a meeting
router.post('/:meetingId', (req, res) => {
    meetingId = req.params.meetingId
})

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}  

module.exports = router;
module.exports.meetingsMap = meetingsMap;
