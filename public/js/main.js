/*
 *  Copyright (c) 2021 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
hangupButton.disabled = true;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteAudio = document.getElementById('remoteAudio');


let pc;
let localStream;
let meetingId;
let version = 2;
let signaling;

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
    }
  ]
}

if (version === 1)
  signaling = new BroadcastChannel('webrtc');
else {
  const wsOrigin = location.origin.replace(/^http/, 'ws');
    signaling = new WebSocket(wsOrigin);

    signaling.onopen = e => {
      console.log("WS connected to " + wsOrigin) 
    }
}

signaling.onmessage = e => {
  if (!localStream) {
    console.log('not ready yet');
    return;
  }

  let msg;

  if (version === 1)
    msg = e.data;
  else
    msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'offer':
      handleOffer(msg);
      break;
    case 'answer':
      handleAnswer(msg);
      break;
    case 'candidate':
      handleCandidate(msg);
      break;
    case 'ready':
      // A second tab joined. This tab will initiate a call unless in a call already.
      if (pc) {
        console.log('already in call, ignoring');
        return;
      }
      makeCall();
      break;
    case 'bye':
      if (pc) {
        hangup();
      }
      break;
    default:
      console.log('unhandled', e);
      break;
  }
};

startButton.onclick = async () => {
  meetingId = document.getElementById('meetingId').value;
  if (!meetingId) {
    alert("Set meetingId")
    return
  }

  localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  
  localVideo.muted = true;
  localVideo.srcObject = localStream;

  startButton.disabled = true;
  hangupButton.disabled = false;

  signalEvent({head: {meetingId: meetingId}, body: {type: 'ready'}})
};

hangupButton.onclick = async () => {
  hangup();
  signalEvent({head: {meetingId: meetingId}, body: {type: 'bye'}})
};

async function hangup() {
  if (pc) {
    pc.close();
    pc = null;
  }
  localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  startButton.disabled = false;
  hangupButton.disabled = true;
};

function createPeerConnection() {
  pc = new RTCPeerConnection(servers);
  pc.onicecandidate = e => {
    const message = {
      type: 'candidate',
      candidate: null,
    };
    if (e.candidate) {
      message.candidate = e.candidate.candidate;
      message.sdpMid = e.candidate.sdpMid;
      message.sdpMLineIndex = e.candidate.sdpMLineIndex;
    }
    signalEvent({head: {meetingId: meetingId}, body: message});
    console.log("New ICE candidate, SDP=" + JSON.stringify(message));
  };
  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    //remoteAudio.srcObject = e.streams[1];
  }
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function makeCall() {
  await createPeerConnection();
  console.log("makeCall " + JSON.stringify(pc));

  const offer = await pc.createOffer();
  signalEvent({head: {meetingId: meetingId}, body: {type: 'offer', sdp: offer.sdp}});
  await pc.setLocalDescription(offer);
}

async function handleOffer(offer) {
  if (pc) {
    console.error('existing peerconnection');
    return;
  }
  await createPeerConnection();
  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  signalEvent({head: {meetingId: meetingId}, body: {type: 'answer', sdp: answer.sdp}});
  console.log("ICE reply " + JSON.stringify(answer));
  await pc.setLocalDescription(answer);
}

async function handleAnswer(answer) {
  if (!pc) {
    console.error('no peerconnection');
    return;
  }
  await pc.setRemoteDescription(answer);
}

async function handleCandidate(candidate) {
  if (!pc) {
    console.error('no peerconnection');
    return;
  }
  if (!candidate.candidate) {
    await pc.addIceCandidate(null);
  } else {
    await pc.addIceCandidate(candidate);
  }
}

function signalEvent(message) {
  console.log("SENDING " + JSON.stringify(message))
  if (version === 1) {
    signaling.postMessage(message.body);
  } else {
    signaling.send(JSON.stringify(message))
  }
}
