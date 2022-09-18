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


let pc;
let localStream;
let meetingID;
let version = 1;

const signaling = new BroadcastChannel('webrtc');
const wsOrigin = location.origin.replace(/^http/, 'ws');
const signaling2 = new WebSocket(wsOrigin);

signaling2.onopen = e => {
  console.log("WS connected to " + wsOrigin)  
};

signaling.onmessage = e => {
  if (!localStream) {
    console.log('not ready yet');
    return;
  }
  switch (e.data.type) {
    case 'offer':
      handleOffer(e.data);
      break;
    case 'answer':
      handleAnswer(e.data);
      break;
    case 'candidate':
      handleCandidate(e.data);
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
  meetingID = document.getElementById('meetingID').value;
  if (!meetingID) {
    alert("Set meetingID")
    return
  }

  localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
  localVideo.srcObject = localStream;


  startButton.disabled = true;
  hangupButton.disabled = false;

  signalEvent({head: {meetingID: meetingID}, body: {type: 'ready'}})
};

hangupButton.onclick = async () => {
  hangup();
  signalEvent({head: {meetingID: meetingID}, body: {type: 'bye'}})
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
  pc = new RTCPeerConnection();
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
    signalEvent({head: {meetingID: meetingID}, body: message});
    console.log("New ICE candidate, SDP=" + JSON.stringify(message));
  };
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function makeCall() {
  console.log("makeCall " + JSON.stringify(pc));

  await createPeerConnection();

  const offer = await pc.createOffer();
  signalEvent({head: {meetingID: meetingID}, body: {type: 'offer', sdp: offer.sdp}});
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
  signalEvent({head: {meetingID: meetingID}, body: {type: 'answer', sdp: answer.sdp}});
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
    signaling2.send(JSON.stringify(message))
  }
  else 
    signaling2.send(JSON.stringify(message))
}